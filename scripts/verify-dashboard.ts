/**
 * Dashboard metriklerini (§7) CANLI veritabanına karşı, bilinen test verisiyle doğrular.
 * Çalıştırma: npx tsx scripts/verify-dashboard.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { getDashboardMetrics } from "../src/lib/modules/dashboard/service";
import { createQuote, sendQuote } from "../src/lib/modules/quotes/service";
import { createOrderFromQuote, advanceOrderStatus } from "../src/lib/modules/orders/service";
import { createPayment } from "../src/lib/modules/payments/service";
import { createExpense } from "../src/lib/modules/expenses/service";
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
  const session: TenantSession = {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    companyId: DEMO_COMPANY_ID,
    companyName: "Demo Şirket A.Ş.",
    companyStatus: "ACTIVE",
    role: "OWNER",
    membershipCount: 1,
  };

  const customer = await withPlatformBypass((tx) =>
    tx.customer.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        type: "CORPORATE",
        title: `Dashboard Test ${randomUUID().slice(0, 8)}`,
        status: "ACTIVE",
        ownerUserId: owner.id,
        createdBy: owner.id,
      },
    }),
  );
  const kiraCategory = await withPlatformBypass((tx) => tx.expenseCategory.findFirstOrThrow({ where: { companyId: DEMO_COMPANY_ID, name: "Kira" } }));

  // Metrikleri ölçmeden önce mevcut durumu al (şirkette başka test verisi kalıntısı olabilir)
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const before = await getDashboardMetrics(session, from, to);

  // Bilinen bir sipariş: 1 satır, qty=2, price=1000, cost=400, KDV %20
  // net (KDV hariç) = 2000, KDV = 400, grandTotal = 2400. SMM = 2*400 = 800.
  const quote = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: now,
    validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Ürün X", quantity: 2, unit: "adet", unitPrice: 1000, unitCost: 400, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!quote.ok) throw new Error("quote create failed");
  await sendQuote(session, quote.data.id);
  const acceptRes = await (await import("../src/lib/modules/quotes/service")).acceptQuote(session, quote.data.id);
  if (!acceptRes.ok) throw new Error("accept failed");
  const orderRes = await createOrderFromQuote(session, quote.data.id);
  if (!orderRes.ok) throw new Error("order create failed");
  await advanceOrderStatus(session, orderRes.data.id); // CONFIRMED -> PREPARING (aktif sipariş sayılır)

  // Kısmi tahsilat: 1000 TL
  await createPayment(session, {
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: now,
    amount: 1000,
    method: "CASH",
    reference: "",
    note: "",
    allocations: [{ orderId: orderRes.data.id, amount: 1000 }],
  });

  // Bilinen bir gider: 300 TL
  await createExpense(session, {
    categoryId: kiraCategory.id,
    spentAt: now,
    amount: 300,
    vatAmount: 0,
    vendor: "Dashboard Test Gideri",
    method: null,
    accountId: null,
    note: "",
    isRecurringTemplate: false,
    recurringRule: null,
  });

  // İkinci bir bekleyen teklif (SENT durumunda kalacak, kabul edilmeyecek)
  const pendingQuote = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: now,
    validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Bekleyen kalem", quantity: 1, unit: "adet", unitPrice: 500, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (pendingQuote.ok) await sendQuote(session, pendingQuote.data.id);

  const after = await getDashboardMetrics(session, from, to);

  assert(Math.abs(after.revenue - before.revenue - 2000) < 0.01, `Ciro +2000 arttı (${before.revenue} → ${after.revenue})`);
  assert(Math.abs(after.collected - before.collected - 1000) < 0.01, `Tahsilat +1000 arttı (${before.collected} → ${after.collected})`);
  assert(Math.abs(after.cogs! - before.cogs! - 800) < 0.01, `SMM +800 arttı (${before.cogs} → ${after.cogs})`);
  assert(Math.abs(after.grossProfit! - before.grossProfit! - 1200) < 0.01, `Brüt kâr +1200 arttı (ciro-SMM=2000-800)`);
  assert(after.canViewExpense && Math.abs(after.expense! - before.expense! - 300) < 0.01, `Gider +300 arttı`);
  assert(Math.abs(after.netProfit! - before.netProfit! - 900) < 0.01, `Net kâr +900 arttı (brüt kâr-gider=1200-300)`);
  assert(after.pendingQuotesCount === before.pendingQuotesCount + 1, "Bekleyen teklif sayısı +1");
  assert(Math.abs(after.pendingQuotesTotal - before.pendingQuotesTotal - 600) < 0.01, "Bekleyen teklif toplamı +600 (500*1.2 KDV dahil)");
  assert(after.activeOrdersCount === before.activeOrdersCount + 1, "Aktif sipariş sayısı +1");
  assert(Math.abs(after.openReceivable - before.openReceivable - 1400) < 0.01, `Açık alacak +1400 arttı (2400 sipariş - 1000 tahsilat)`);

  // Temizlik
  await withPlatformBypass(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.payment.deleteMany({ where: { customerId: customer.id } });
    await tx.expense.deleteMany({ where: { vendor: "Dashboard Test Gideri" } });
    await tx.orderItem.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.order.deleteMany({ where: { customerId: customer.id } });
    await tx.quoteItem.deleteMany({ where: { quote: { customerId: customer.id } } });
    await tx.quote.deleteMany({ where: { customerId: customer.id } });
    await tx.customer.delete({ where: { id: customer.id } });
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Dashboard metrikleri tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
