// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * §5.9 Dashboard grafik verilerini (getDashboardCharts) CANLI veritabanına karşı,
 * bilinen test verisiyle doğrular. Çalıştırma: npx tsx scripts/verify-dashboard-charts.ts
 */
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { getDashboardCharts } from "../src/lib/modules/dashboard/service";
import { createQuote, sendQuote, acceptQuote, rejectQuote } from "../src/lib/modules/quotes/service";
import { createOrderFromQuote } from "../src/lib/modules/orders/service";
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

  const customerName = `Grafik Test ${randomUUID().slice(0, 8)}`;
  const customer = await withPlatformBypass((tx) =>
    tx.customer.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        type: "CORPORATE",
        title: customerName,
        status: "ACTIVE",
        ownerUserId: owner.id,
        createdBy: owner.id,
      },
    }),
  );
  const kiraCategory = await withPlatformBypass((tx) => tx.expenseCategory.findFirstOrThrow({ where: { companyId: DEMO_COMPANY_ID, name: "Kira" } }));

  const now = new Date();
  const currentMonthKey = dayjs(now).format("YYYY-MM");

  const before = await getDashboardCharts(session);
  const monthBefore = before.monthlyRevenueVsCollected.find((m) => m.month === currentMonthKey)!;
  const kiraBefore = before.expenseByCategory.find((c) => c.categoryName === "Kira")?.total ?? 0;

  // Kabul edilip siparişe dönüşecek teklif: net 1000, KDV %20 -> grandTotal 1200
  const quote = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: now,
    validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Grafik test ürünü", quantity: 1, unit: "adet", unitPrice: 1000, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!quote.ok) throw new Error("quote create failed");
  await sendQuote(session, quote.data.id);
  const acceptRes = await acceptQuote(session, quote.data.id);
  if (!acceptRes.ok) throw new Error("accept failed");
  const orderRes = await createOrderFromQuote(session, quote.data.id);
  if (!orderRes.ok) throw new Error("order create failed");

  // Reddedilecek ikinci bir teklif (huninin "Gönderildi" adımına girer, "Kabul"e girmez)
  const rejectedQuote = await createQuote(session, {
    customerId: customer.id,
    contactId: null,
    issueDate: now,
    validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Reddedilecek kalem", quantity: 1, unit: "adet", unitPrice: 200, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
  });
  if (!rejectedQuote.ok) throw new Error("rejected quote create failed");
  await sendQuote(session, rejectedQuote.data.id);
  await rejectQuote(session, rejectedQuote.data.id);

  // Kısmi tahsilat: 400 TL
  await createPayment(session, {
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: now,
    amount: 400,
    method: "CASH",
    reference: "",
    note: "",
    allocations: [{ orderId: orderRes.data.id, amount: 400 }],
  });

  // Bilinen bir "Kira" gideri: 250 TL
  await createExpense(session, {
    categoryId: kiraCategory.id,
    spentAt: now,
    amount: 250,
    vatAmount: 0,
    vendor: "Grafik Test Gideri",
    method: null,
    accountId: null,
    note: "",
    isRecurringTemplate: false,
    recurringRule: null,
  });

  const after = await getDashboardCharts(session);
  const monthAfter = after.monthlyRevenueVsCollected.find((m) => m.month === currentMonthKey)!;
  const kiraAfter = after.expenseByCategory.find((c) => c.categoryName === "Kira")?.total ?? 0;

  assert(after.monthlyRevenueVsCollected.length === 12, "Aylık seri 12 ay içeriyor");
  assert(Math.abs(monthAfter.revenue - monthBefore.revenue - 1000) < 0.01, `Bu ayın cirosu +1000 arttı (${monthBefore.revenue} → ${monthAfter.revenue})`);
  assert(Math.abs(monthAfter.collected - monthBefore.collected - 400) < 0.01, `Bu ayın tahsilatı +400 arttı (${monthBefore.collected} → ${monthAfter.collected})`);
  assert(Math.abs(kiraAfter - kiraBefore - 250) < 0.01, `Kira kategorisi gideri +250 arttı (${kiraBefore} → ${kiraAfter})`);

  const sentBefore = before.quoteFunnel.find((f) => f.stage === "Gönderildi")!.count;
  const sentAfter = after.quoteFunnel.find((f) => f.stage === "Gönderildi")!.count;
  const acceptedBefore = before.quoteFunnel.find((f) => f.stage === "Kabul Edildi")!.count;
  const acceptedAfter = after.quoteFunnel.find((f) => f.stage === "Kabul Edildi")!.count;
  const convertedBefore = before.quoteFunnel.find((f) => f.stage === "Siparişe Dönüştü")!.count;
  const convertedAfter = after.quoteFunnel.find((f) => f.stage === "Siparişe Dönüştü")!.count;
  assert(sentAfter === sentBefore + 2, `Huni "Gönderildi" +2 arttı (kabul edilen + reddedilen) (${sentBefore} → ${sentAfter})`);
  assert(acceptedAfter === acceptedBefore + 1, `Huni "Kabul Edildi" +1 arttı (${acceptedBefore} → ${acceptedAfter})`);
  assert(convertedAfter === convertedBefore + 1, `Huni "Siparişe Dönüştü" +1 arttı (${convertedBefore} → ${convertedAfter})`);

  const topCustomer = after.topCustomers.find((c) => c.customerTitle === customerName);
  assert(!!topCustomer && Math.abs(topCustomer.revenue - 1000) < 0.01, `Test müşterisi en yüksek cirolu listede doğru rakamla yer alıyor (1000)`);
  assert(after.canViewExpense === true, "OWNER rolü gider grafiğini görebiliyor");

  // Temizlik
  await withPlatformBypass(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.payment.deleteMany({ where: { customerId: customer.id } });
    await tx.expense.deleteMany({ where: { vendor: "Grafik Test Gideri" } });
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
  console.log(failures === 0 ? "\n🎉 Dashboard grafik verileri tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());