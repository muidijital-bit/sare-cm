// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * Tablo iyileştirmeleri (sil/toplu seçme/dışa aktar) CANLI veritabanına karşı doğrulanır.
 * Çalıştırma: npx tsx scripts/verify-table-actions.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createQuote, sendQuote, deleteQuote, bulkDeleteQuotes } from "../src/lib/modules/quotes/service";
import { createOrder } from "../src/lib/modules/orders/service";
import { createPayment, bulkCancelPayments, exportPayments } from "../src/lib/modules/payments/service";
import { createExpense, bulkDeleteExpenses, exportExpenses } from "../src/lib/modules/expenses/service";
import { bulkDeleteCustomers, listCustomers } from "../src/lib/modules/customers/service";
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
    companyName: "Sare Havuz & Spa",
    companyStatus: "ACTIVE",
    role: "OWNER",
    membershipCount: 1,
  };

  // --- deleteQuote: yalnızca DRAFT silinebilir ---
  const draftQuote = await createQuote(session, {
    customerId: (await ensureCustomer()).id,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Test kalemi", quantity: 1, unit: "adet", unitPrice: 1000, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!draftQuote.ok) throw new Error("draft quote create failed");
  const deleteDraftRes = await deleteQuote(session, draftQuote.data.id);
  assert(deleteDraftRes.ok, "Taslak teklif silinebiliyor");

  const sentQuote = await createQuote(session, {
    customerId: (await ensureCustomer()).id,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Test kalemi 2", quantity: 1, unit: "adet", unitPrice: 1000, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!sentQuote.ok) throw new Error("sent quote create failed");
  await sendQuote(session, sentQuote.data.id);
  const deleteSentRes = await deleteQuote(session, sentQuote.data.id);
  assert(!deleteSentRes.ok && deleteSentRes.status === 409, "Gönderilmiş teklif silinemiyor (409 conflict)");

  // --- bulkDeleteQuotes: 2 taslak + içinde 1 gönderilmiş id ---
  const customer = await ensureCustomer();
  const draftA = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Toplu A", quantity: 1, unit: "adet", unitPrice: 500, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  const draftB = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Toplu B", quantity: 1, unit: "adet", unitPrice: 500, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!draftA.ok || !draftB.ok) throw new Error("bulk draft create failed");
  const bulkRes = await bulkDeleteQuotes(session, [draftA.data.id, draftB.data.id, sentQuote.data.id]);
  assert(bulkRes.succeeded.length === 2 && bulkRes.failed.length === 1, `bulkDeleteQuotes: 2 başarılı, 1 başarısız (${bulkRes.succeeded.length}/${bulkRes.failed.length})`);

  // --- bulkDeleteCustomers ---
  const custA = await withPlatformBypass((tx) =>
    tx.customer.create({ data: { companyId: DEMO_COMPANY_ID, type: "INDIVIDUAL", title: `Bulk Test A ${randomUUID().slice(0, 6)}`, status: "ACTIVE", ownerUserId: owner.id, createdBy: owner.id } }),
  );
  const custB = await withPlatformBypass((tx) =>
    tx.customer.create({ data: { companyId: DEMO_COMPANY_ID, type: "INDIVIDUAL", title: `Bulk Test B ${randomUUID().slice(0, 6)}`, status: "ACTIVE", ownerUserId: owner.id, createdBy: owner.id } }),
  );
  const bulkCustRes = await bulkDeleteCustomers(session, [custA.id, custB.id]);
  assert(bulkCustRes.succeeded.length === 2, `bulkDeleteCustomers: 2 kayıt silindi (${bulkCustRes.succeeded.length})`);
  const listAfterBulk = await listCustomers(session, { page: 1, pageSize: 5, q: "Bulk Test" });
  assert(listAfterBulk.ok && listAfterBulk.data.items.length === 0, "Silinen müşteriler listede görünmüyor");

  // --- bulkDeleteExpenses + exportExpenses ---
  const kiraCategory = await withPlatformBypass((tx) => tx.expenseCategory.findFirstOrThrow({ where: { companyId: DEMO_COMPANY_ID, name: "Kira" } }));
  const uniqueVendor = `Bulk Gider Test ${randomUUID().slice(0, 8)}`;
  const expA = await createExpense(session, {
    categoryId: kiraCategory.id,
    spentAt: new Date(),
    amount: 777,
    vatAmount: 0,
    vendor: uniqueVendor,
    method: null,
    accountId: null,
    note: "",
    isRecurringTemplate: false,
    recurringRule: null,
  });
  if (!expA.ok) throw new Error("expense create failed");

  const exportRes = await exportExpenses(session, { q: uniqueVendor });
  assert(exportRes.ok && exportRes.data.length === 1 && exportRes.data[0].amount === 777, "exportExpenses filtreyle doğru satırı döndürüyor");

  const bulkExpRes = await bulkDeleteExpenses(session, [expA.data.id]);
  assert(bulkExpRes.succeeded.length === 1, "bulkDeleteExpenses kaydı sildi");

  // --- bulkCancelPayments + exportPayments ---
  const quoteForOrder = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Ödeme test kalemi", quantity: 1, unit: "adet", unitPrice: 1000, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!quoteForOrder.ok) throw new Error("quote for order create failed");
  const orderRes = await createOrder(session, {
    customerId: customer.id,
    quoteId: quoteForOrder.data.id,
    orderDate: new Date(),
    dueDate: null,
    deliveryAddress: "",
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Ödeme test kalemi", quantity: 1, unit: "adet", unitPrice: 1000, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
    paymentSchedules: [],
  });
  if (!orderRes.ok) throw new Error("order create failed");
  const paymentRes = await createPayment(session, {
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: new Date(),
    amount: 500,
    method: "CASH",
    reference: "BULK-TEST",
    note: "",
    allocations: [{ orderId: orderRes.data.id, amount: 500 }],
  });
  if (!paymentRes.ok) throw new Error("payment create failed");

  const exportPayRes = await exportPayments(session, { q: customer.title });
  const foundExported = exportPayRes.ok && exportPayRes.data.find((r) => r.reference === "BULK-TEST");
  assert(!!foundExported && foundExported.amount === 500, "exportPayments doğru satırı döndürüyor");

  const bulkCancelRes = await bulkCancelPayments(session, [paymentRes.data.id], "Toplu iptal testi");
  assert(bulkCancelRes.succeeded.length === 1, "bulkCancelPayments ödemeyi iptal etti");
  const cancelledPayment = await withPlatformBypass((tx) => tx.payment.findUniqueOrThrow({ where: { id: paymentRes.data.id } }));
  assert(cancelledPayment.isCancelled && cancelledPayment.cancelReason === "Toplu iptal testi", "İptal gerekçesi doğru kaydedildi");

  // İkinci bulk-cancel denemesi aynı kayıt için başarısız olmalı (zaten iptal)
  const doubleCancel = await bulkCancelPayments(session, [paymentRes.data.id], "İkinci deneme");
  assert(doubleCancel.failed.length === 1, "Zaten iptal edilmiş ödeme tekrar iptal edilemiyor");

  // Temizlik
  await withPlatformBypass(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.payment.deleteMany({ where: { customerId: customer.id } });
    await tx.orderItem.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.order.deleteMany({ where: { customerId: customer.id } });
    await tx.quoteItem.deleteMany({ where: { quote: { customerId: customer.id } } });
    await tx.quote.deleteMany({ where: { customerId: customer.id } });
    await tx.customer.delete({ where: { id: customer.id } });
  });
  console.log("· test verisi temizlendi");

  report();

  async function ensureCustomer() {
    return withPlatformBypass((tx) =>
      tx.customer.upsert({
        where: { id: "00000000-0000-0000-0000-0000000000c1" },
        update: {},
        create: {
          id: "00000000-0000-0000-0000-0000000000c1",
          companyId: DEMO_COMPANY_ID,
          type: "CORPORATE",
          title: "Tablo Aksiyon Test Müşterisi",
          status: "ACTIVE",
          ownerUserId: owner.id,
          createdBy: owner.id,
        },
      }),
    );
  }
}

function report() {
  console.log(failures === 0 ? "\n🎉 Tablo aksiyonları tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());