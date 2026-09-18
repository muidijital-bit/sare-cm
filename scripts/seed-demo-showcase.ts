// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * SUNUM İÇİN GÖSTERİM VERİSİ — kalıcı seed değildir, `prisma/seed.ts`'in bir parçası değildir.
 * Demo şirketi ("Sare Havuz & Spa" olarak yeniden adlandırır) gerçekçi görünen müşteri,
 * teklif, sipariş, tahsilat ve gider kayıtlarıyla doldurur ki dashboard grafikleri (§5.9)
 * sunumda dolu görünsün. Tüm kayıtlar geriye izlenebilir şekilde işaretlenir
 * (customer.address / expense.note = "DEMO-SUNUM") — sunum bitince
 * `npx tsx scripts/cleanup-demo-showcase.ts` ile TAMAMEN geri alınabilir.
 *
 * Çalıştırma: npx tsx scripts/seed-demo-showcase.ts
 */
import dayjs from "dayjs";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createQuote, sendQuote, acceptQuote, rejectQuote } from "../src/lib/modules/quotes/service";
import { createOrder } from "../src/lib/modules/orders/service";
import { createPayment } from "../src/lib/modules/payments/service";
import { createExpense } from "../src/lib/modules/expenses/service";
import type { TenantSession } from "../src/lib/auth/session";

const DEMO_MARKER = "DEMO-SUNUM";
const COMPANY_ID = "00000000-0000-0000-0000-000000000002";
const ACCOUNT_ID = "00000000-0000-0000-0000-000000000010";
const NEW_COMPANY_NAME = "Sare Havuz & Spa";

const CUSTOMER_NAMES: { title: string; type: "CORPORATE" | "INDIVIDUAL" }[] = [
  { title: "Grand Otel Belek", type: "CORPORATE" },
  { title: "Akdeniz Tatil Köyü", type: "CORPORATE" },
  { title: "Palmiye Spa Merkezi", type: "CORPORATE" },
  { title: "Deniz Manzara Sitesi Yönetimi", type: "CORPORATE" },
  { title: "Mavi Dalga Otel", type: "CORPORATE" },
  { title: "Yılmaz Ailesi Bahçe Havuzu", type: "INDIVIDUAL" },
  { title: "Kaya Ailesi Villa Havuzu", type: "INDIVIDUAL" },
  { title: "Öztürk Villaları", type: "INDIVIDUAL" },
];

const SERVICE_ITEMS = [
  "Havuz Aylık Bakım Paketi",
  "Havuz Kimyasal Malzeme Takviyesi",
  "Filtrasyon Sistemi Yenileme",
  "Spa Ekipmanı Kurulumu",
  "Havuz Isıtma Sistemi Bakımı",
  "UV Dezenfeksiyon Sistemi Kurulumu",
  "Sauna Kurulumu",
  "Havuz Temizlik Robotu Tedariki",
];

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) / 100) * 100;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Sunum verisi oluşturuluyor...");

  const company = await withPlatformBypass((tx) =>
    tx.company.update({ where: { id: COMPANY_ID }, data: { name: NEW_COMPANY_NAME } }),
  );
  console.log(`· şirket adı değiştirildi: ${company.name}`);

  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const session: TenantSession = {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    companyId: COMPANY_ID,
    companyName: company.name,
    companyStatus: "ACTIVE",
    role: "OWNER",
    membershipCount: 1,
  };

  // Ek gider kategorileri (havuz & spa işine özgü) — seed.ts'teki sabit iki kategoriye ek
  const extraCategories = await withPlatformBypass(async (tx) => {
    const chem = await tx.expenseCategory.upsert({
      where: { companyId_name: { companyId: COMPANY_ID, name: "Kimyasal Malzeme" } },
      update: {},
      create: { companyId: COMPANY_ID, name: "Kimyasal Malzeme" },
    });
    const maint = await tx.expenseCategory.upsert({
      where: { companyId_name: { companyId: COMPANY_ID, name: "Bakım ve Onarım" } },
      update: {},
      create: { companyId: COMPANY_ID, name: "Bakım ve Onarım" },
    });
    const rent = await tx.expenseCategory.findFirstOrThrow({ where: { companyId: COMPANY_ID, name: "Kira" } });
    const subs = await tx.expenseCategory.findFirstOrThrow({ where: { companyId: COMPANY_ID, name: "Abonelik/Yazılım" } });
    return { chem, maint, rent, subs };
  });
  console.log("· gider kategorileri hazır");

  // --- Müşteriler ---
  const customerIds: string[] = [];
  for (const c of CUSTOMER_NAMES) {
    const created = await withPlatformBypass((tx) =>
      tx.customer.create({
        data: {
          companyId: COMPANY_ID,
          type: c.type,
          title: c.title,
          status: "ACTIVE",
          address: DEMO_MARKER,
          ownerUserId: owner.id,
          createdBy: owner.id,
        },
      }),
    );
    customerIds.push(created.id);
  }
  console.log(`· ${customerIds.length} müşteri oluşturuldu`);

  // --- Teklifler → bir kısmı kabul+sipariş, bir kısmı red, bir kısmı bekliyor ---
  // Son 9 ay boyunca aya 2 teklif (18 toplam): 10 kabul+sipariş, 4 red, 4 bekleyen (SENT)
  let quoteCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let orderCount = 0;
  let paymentCount = 0;

  for (let monthOffset = 8; monthOffset >= 0; monthOffset--) {
    const monthDate = dayjs().subtract(monthOffset, "month").date(monthOffset === 0 ? 1 : 10 + Math.floor(Math.random() * 8));
    const quotesThisMonth = monthOffset === 0 ? 2 : 2;

    for (let i = 0; i < quotesThisMonth; i++) {
      const customerId = pick(customerIds);
      const unitPrice = randomBetween(3000, 25000);
      const issueDate = monthDate.add(i, "day").toDate();

      const quote = await createQuote(session, {
        customerId,
        contactId: null,
        issueDate,
        validUntil: dayjs(issueDate).add(15, "day").toDate(),
        ownerUserId: owner.id,
        note: DEMO_MARKER,
        documentDiscount: null,
        items: [
          {
            description: pick(SERVICE_ITEMS),
            quantity: 1,
            unit: "adet",
            unitPrice,
            unitCost: Math.round(unitPrice * 0.4),
            discountType: "PERCENT",
            discountValue: 0,
            vatRate: 20,
          },
        ],
      });
      if (!quote.ok) {
        console.error("teklif oluşturulamadı, atlanıyor", quote);
        continue;
      }
      quoteCount++;
      await sendQuote(session, quote.data.id);

      // Dağılım: ~%65 kabul, ~%20 red, ~%15 bekliyor (bu ay dahil — dashboard'ın "bu ay" kartları
      // da gerçek veri göstersin, yalnızca bekleyen bir teklifle boş/negatif görünmesin).
      const roll = Math.random();
      if (roll < 0.65) {
        const accepted = await acceptQuote(session, quote.data.id);
        if (accepted.ok) {
          acceptedCount++;
          const orderDate = dayjs(issueDate).add(2, "day").toDate();
          const orderRes = await createOrder(session, {
            customerId,
            quoteId: quote.data.id,
            orderDate,
            dueDate: null,
            deliveryAddress: "",
            ownerUserId: owner.id,
            note: DEMO_MARKER,
            documentDiscount: null,
            items: [
              {
                description: pick(SERVICE_ITEMS),
                quantity: 1,
                unit: "adet",
                unitPrice,
                unitCost: Math.round(unitPrice * 0.4),
                discountType: "PERCENT",
                discountValue: 0,
                vatRate: 20,
              },
            ],
            paymentSchedules: [],
          });
          if (orderRes.ok) {
            orderCount++;
            const grandTotal = Math.round(unitPrice * 1.2);
            const isFullyPaid = Math.random() < 0.6;
            const paidAmount = isFullyPaid ? grandTotal : Math.round(grandTotal * 0.5);
            const paidAt = dayjs(orderDate).add(1 + Math.floor(Math.random() * 10), "day").toDate();
            await createPayment(session, {
              customerId,
              accountId: ACCOUNT_ID,
              paidAt,
              amount: paidAmount,
              method: pick(["CASH", "BANK_TRANSFER", "CREDIT_CARD"] as const),
              reference: "",
              note: DEMO_MARKER,
              allocations: [{ orderId: orderRes.data.id, amount: paidAmount }],
            });
            paymentCount++;
          }
        }
      } else if (roll < 0.85) {
        await rejectQuote(session, quote.data.id);
        rejectedCount++;
      }
      // else: SENT durumunda bırakılır (bekleyen teklif)
    }
  }
  console.log(`· ${quoteCount} teklif (kabul: ${acceptedCount}, red: ${rejectedCount}), ${orderCount} sipariş, ${paymentCount} tahsilat`);

  // --- Giderler: son 7 ay, 4 kategori ---
  let expenseCount = 0;
  for (let monthOffset = 6; monthOffset >= 0; monthOffset--) {
    const monthDate = dayjs().subtract(monthOffset, "month");

    await createExpense(session, {
      categoryId: extraCategories.rent.id,
      spentAt: monthDate.date(1).toDate(),
      amount: 15000,
      vatAmount: 0,
      vendor: "Sare Havuz & Spa Ofis Kirası",
      method: "BANK_TRANSFER",
      accountId: ACCOUNT_ID,
      note: DEMO_MARKER,
      isRecurringTemplate: false,
      recurringRule: null,
    });
    expenseCount++;

    await createExpense(session, {
      categoryId: extraCategories.subs.id,
      spentAt: monthDate.date(3).toDate(),
      amount: 1450,
      vatAmount: 0,
      vendor: "Muhasebe/CRM Yazılım Aboneliği",
      method: "CREDIT_CARD",
      accountId: ACCOUNT_ID,
      note: DEMO_MARKER,
      isRecurringTemplate: false,
      recurringRule: null,
    });
    expenseCount++;

    await createExpense(session, {
      categoryId: extraCategories.chem.id,
      spentAt: monthDate.date(12).toDate(),
      amount: randomBetween(2000, 7000),
      vatAmount: 0,
      vendor: "Havuz Kimyasalları Tedarikçisi",
      method: "BANK_TRANSFER",
      accountId: ACCOUNT_ID,
      note: DEMO_MARKER,
      isRecurringTemplate: false,
      recurringRule: null,
    });
    expenseCount++;

    if (monthOffset % 2 === 0) {
      await createExpense(session, {
        categoryId: extraCategories.maint.id,
        spentAt: monthDate.date(20).toDate(),
        amount: randomBetween(1500, 5000),
        vatAmount: 0,
        vendor: "Teknik Bakım ve Onarım Ekibi",
        method: "CASH",
        accountId: ACCOUNT_ID,
        note: DEMO_MARKER,
        isRecurringTemplate: false,
        recurringRule: null,
      });
      expenseCount++;
    }
  }
  console.log(`· ${expenseCount} gider kaydı oluşturuldu`);

  console.log("\n🎉 Sunum verisi hazır. Girişte gösterebilirsiniz.");
  console.log("Geri almak için: npx tsx scripts/cleanup-demo-showcase.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());