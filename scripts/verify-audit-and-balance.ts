/**
 * İşlem geçmişi (audit log) ve MC-10 müşteri bakiye özetini CANLI veritabanına karşı
 * doğrular. Çalıştırma: npx tsx scripts/verify-audit-and-balance.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { listAuditLogs } from "../src/lib/modules/audit/service";
import { createCustomer, getCustomerBalance, updateCustomer } from "../src/lib/modules/customers/service";
import { createQuote, sendQuote, acceptQuote } from "../src/lib/modules/quotes/service";
import { createOrderFromQuote } from "../src/lib/modules/orders/service";
import { createPayment } from "../src/lib/modules/payments/service";
import type { TenantSession } from "../src/lib/auth/session";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000002";
const DEMO_ACCOUNT_ID = "00000000-0000-0000-0000-000000000010";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`✅ ${label}`);
  else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

async function main() {
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const ownerSession: TenantSession = {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    companyId: DEMO_COMPANY_ID,
    companyName: "Demo Şirket A.Ş.",
    companyStatus: "ACTIVE",
    role: "OWNER",
    membershipCount: 1,
  };

  // 1) Bir müşteri oluştur, güncelle — audit log'da CREATE + UPDATE görünmeli
  const createResult = await createCustomer(ownerSession, {
    type: "CORPORATE",
    title: `Audit Test ${randomUUID().slice(0, 8)}`,
    taxOffice: "",
    taxNumber: "",
    address: "",
    sourceId: null,
    status: "POTENTIAL",
    ownerUserId: owner.id,
    tags: [],
    contacts: [],
  });
  if (!createResult.ok) throw new Error("customer create failed");
  const customerId = createResult.data.id;

  await updateCustomer(ownerSession, customerId, {
    type: "CORPORATE",
    title: "Audit Test Güncellendi",
    taxOffice: "",
    taxNumber: "",
    address: "",
    sourceId: null,
    status: "ACTIVE",
    ownerUserId: owner.id,
    tags: [],
    contacts: [],
  });

  const auditResult = await listAuditLogs(ownerSession, { entityType: "customer", entityId: customerId, page: 1, pageSize: 10 });
  assert(auditResult.ok && auditResult.data.items.some((l) => l.action === "CREATE"), "CREATE olayı audit log'da görünüyor");
  assert(auditResult.ok && auditResult.data.items.some((l) => l.action === "UPDATE" && l.changes), "UPDATE olayı değişiklik diff'iyle görünüyor");
  assert(auditResult.ok && auditResult.data.items[0].userName === owner.name, "Kullanıcı adı doğru eşlendi");

  // 2) RBAC — SALES rolü audit log'u hiç göremez
  const salesSession: TenantSession = { ...ownerSession, role: "SALES" };
  const deniedAudit = await listAuditLogs(salesSession, { page: 1, pageSize: 10 });
  assert(!deniedAudit.ok && deniedAudit.status === 403, "SALES rolü işlem geçmişini göremiyor (403)");

  // 3) MC-10 Bakiye özeti — bilinen sipariş + tahsilat
  const quote = await createQuote(ownerSession, {
    customerId,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Kalem", quantity: 1, unit: "adet", unitPrice: 1000, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!quote.ok) throw new Error("quote failed");
  await sendQuote(ownerSession, quote.data.id);
  await acceptQuote(ownerSession, quote.data.id);
  const order = await createOrderFromQuote(ownerSession, quote.data.id);
  if (!order.ok) throw new Error("order failed");
  // grandTotal = 1200 (1000 + %20 kdv)

  await createPayment(ownerSession, {
    customerId,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: new Date(),
    amount: 500,
    method: "CASH",
    reference: "",
    note: "",
    allocations: [{ orderId: order.data.id, amount: 500 }],
  });

  const balance = await getCustomerBalance(ownerSession, customerId);
  assert(balance.ok && Math.abs(balance.data.totalOrders - 1200) < 0.01, `Toplam sipariş doğru (${balance.ok ? balance.data.totalOrders : "-"})`);
  assert(balance.ok && Math.abs(balance.data.totalPayments - 500) < 0.01, `Toplam tahsilat doğru (${balance.ok ? balance.data.totalPayments : "-"})`);
  assert(balance.ok && Math.abs(balance.data.openReceivable - 700) < 0.01, `Açık alacak doğru (${balance.ok ? balance.data.openReceivable : "-"})`);

  // Temizlik
  await withPlatformBypass(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { order: { customerId } } });
    await tx.payment.deleteMany({ where: { customerId } });
    await tx.orderItem.deleteMany({ where: { order: { customerId } } });
    await tx.order.deleteMany({ where: { customerId } });
    await tx.quoteItem.deleteMany({ where: { quote: { customerId } } });
    await tx.quote.deleteMany({ where: { customerId } });
    await tx.customer.delete({ where: { id: customerId } });
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 İşlem geçmişi + MC-10 bakiye tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
