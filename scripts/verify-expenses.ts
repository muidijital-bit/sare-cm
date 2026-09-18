// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

/**
 * Gider modülünü CANLI veritabanına karşı doğrular: oluşturma, kategori raporu,
 * tekrarlayan gider şablonundan otomatik üretim (GD-03), yumuşak silme.
 *
 * Çalıştırma: npx tsx scripts/verify-expenses.ts
 */
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createExpense, listExpenses, getCategoryReport, deleteExpense, getExpense } from "../src/lib/modules/expenses/service";
import type { TenantSession } from "../src/lib/auth/session";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000002";

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

  const kiraCategory = await withPlatformBypass((tx) => tx.expenseCategory.findFirstOrThrow({ where: { companyId: DEMO_COMPANY_ID, name: "Kira" } }));

  // 1) Basit gider oluşturma
  const create1 = await createExpense(session, {
    categoryId: kiraCategory.id,
    spentAt: new Date(),
    amount: 1000,
    vatAmount: 200,
    vendor: `Test Tedarikçi ${randomUUID().slice(0, 6)}`,
    method: "BANK_TRANSFER",
    accountId: null,
    note: "",
    isRecurringTemplate: false,
    recurringRule: null,
  });
  assert(create1.ok, "Basit gider oluşturuldu");

  // 2) Kategori raporu — Kira kategorisinde bu tutar görünmeli
  const report1 = await getCategoryReport(session);
  assert(report1.ok && report1.data.some((r) => r.categoryName === "Kira" && r.total >= 1000), "Kategori raporunda Kira toplamı doğru");

  // 3) Tekrarlayan şablon — 3 ay önceki bir tarihten başlayıp lazy üretimle eksik ayları tamamlamalı
  const threeMonthsAgo = dayjs().subtract(3, "month").toDate();
  const templateResult = await createExpense(session, {
    categoryId: kiraCategory.id,
    spentAt: threeMonthsAgo,
    amount: 500,
    vatAmount: 0,
    vendor: "Aylık Kira Şablonu",
    method: null,
    accountId: null,
    note: "",
    isRecurringTemplate: true,
    recurringRule: "MONTHLY",
  });
  assert(templateResult.ok, "Tekrarlayan gider şablonu oluşturuldu");

  // Listeleme, şablonun 3-4 aylık eksik kaydı ürettiğini tetikler (lazy generation)
  const listResult = await listExpenses(session, { page: 1, pageSize: 50 });
  assert(listResult.ok, "Liste sorgusu başarılı (lazy generation tetiklendi)");
  if (listResult.ok && templateResult.ok) {
    const generated = listResult.data.items.filter((e) => e.parentExpenseId === templateResult.data.id);
    assert(generated.length >= 3, `Tekrarlayan şablondan en az 3 kayıt üretildi (üretilen: ${generated.length})`);
    assert(
      listResult.data.items.every((e) => !e.isRecurringTemplate),
      "Şablonun kendisi listede görünmüyor (yalnızca ürettiği kayıtlar var)",
    );
  }

  // 4) Yumuşak silme
  if (create1.ok) {
    const del = await deleteExpense(session, create1.data.id);
    assert(del.ok, "Gider yumuşak silindi");
    const afterDelete = await getExpense(session, create1.data.id);
    assert(!afterDelete.ok && afterDelete.status === 404, "Silinen gider artık görünmüyor");
  }

  // Temizlik
  await withPlatformBypass(async (tx) => {
    if (templateResult.ok) {
      await tx.expense.deleteMany({ where: { parentExpenseId: templateResult.data.id } });
      await tx.expense.delete({ where: { id: templateResult.data.id } });
    }
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Gider modülü tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());