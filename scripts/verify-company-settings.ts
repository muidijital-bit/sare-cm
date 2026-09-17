/**
 * Şirket Ayarları modülünü (SA-01..SA-07) CANLI veritabanına karşı doğrular.
 * Çalıştırma: npx tsx scripts/verify-company-settings.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import {
  getCompanySettings,
  updateCompanySettings,
  createCustomerSource,
  updateCustomerSource,
  deleteCustomerSource,
  createExpenseCategory,
  deleteExpenseCategory,
  createAccount,
  deleteAccount,
} from "../src/lib/modules/company-settings/service";
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
  const salesSession: TenantSession = { ...ownerSession, role: "SALES" };

  const before = await getCompanySettings(ownerSession);
  assert(before.ok, "Şirket ayarları okunabiliyor");
  if (!before.ok) return report();

  const updateResult = await updateCompanySettings(ownerSession, {
    name: before.data.name,
    taxOffice: "Test Vergi Dairesi",
    taxNumber: before.data.taxNumber ?? "",
    address: before.data.address ?? "",
    phone: before.data.phone ?? "",
    defaultVatRate: 18,
    quoteValidityDays: 20,
    quoteNumberFormat: before.data.quoteNumberFormat,
    orderNumberFormat: before.data.orderNumberFormat,
  });
  assert(updateResult.ok, "Şirket bilgileri güncellendi");

  const after = await getCompanySettings(ownerSession);
  assert(after.ok && Number(after.data.defaultVatRate) === 18, "KDV oranı doğru kaydedildi");
  assert(after.ok && after.data.taxOffice === "Test Vergi Dairesi", "Vergi dairesi doğru kaydedildi");

  // RBAC: SALES şirket ayarlarını göremez/değiştiremez
  const deniedView = await getCompanySettings(salesSession);
  assert(!deniedView.ok && deniedView.status === 403, "SALES şirket ayarlarını göremiyor (403)");

  // Kaynak CRUD
  const sourceName = `Test Kaynak ${randomUUID().slice(0, 6)}`;
  const sourceResult = await createCustomerSource(ownerSession, sourceName);
  assert(sourceResult.ok, "Müşteri kaynağı oluşturuldu");
  if (sourceResult.ok) {
    const renamed = await updateCustomerSource(ownerSession, sourceResult.data.id, `${sourceName}-v2`);
    assert(renamed.ok, "Kaynak adı güncellendi");
    const deleted = await deleteCustomerSource(ownerSession, sourceResult.data.id);
    assert(deleted.ok, "Kullanılmayan kaynak silinebiliyor");
  }

  // Kullanımda olan kaynak silinemez
  const usedSource = await withPlatformBypass((tx) => tx.customerSource.findFirstOrThrow({ where: { companyId: DEMO_COMPANY_ID, name: "Web sitesi" } }));
  await withPlatformBypass((tx) =>
    tx.customer.create({ data: { companyId: DEMO_COMPANY_ID, type: "CORPORATE", title: `Kaynak testi ${randomUUID().slice(0, 6)}`, sourceId: usedSource.id, ownerUserId: owner.id, createdBy: owner.id } }),
  );
  const blockedDelete = await deleteCustomerSource(ownerSession, usedSource.id);
  assert(!blockedDelete.ok && blockedDelete.status === 409, "Kullanımdaki kaynak silinemiyor (409)");
  await withPlatformBypass((tx) => tx.customer.deleteMany({ where: { sourceId: usedSource.id, title: { startsWith: "Kaynak testi" } } }));

  // Gider kategorisi CRUD
  const categoryResult = await createExpenseCategory(ownerSession, `Test Kategori ${randomUUID().slice(0, 6)}`);
  assert(categoryResult.ok, "Gider kategorisi oluşturuldu");
  if (categoryResult.ok) {
    const deleted = await deleteExpenseCategory(ownerSession, categoryResult.data.id);
    assert(deleted.ok, "Kullanılmayan kategori silinebiliyor");
  }

  // Kasa/banka hesabı CRUD
  const accountResult = await createAccount(ownerSession, `Test Hesap ${randomUUID().slice(0, 6)}`, "BANK");
  assert(accountResult.ok, "Kasa/banka hesabı oluşturuldu");
  if (accountResult.ok) {
    const deleted = await deleteAccount(ownerSession, accountResult.data.id);
    assert(deleted.ok, "Kullanılmayan hesap silinebiliyor");
  }

  // Ayarları eski haline getir
  await updateCompanySettings(ownerSession, {
    name: before.data.name,
    taxOffice: before.data.taxOffice ?? "",
    taxNumber: before.data.taxNumber ?? "",
    address: before.data.address ?? "",
    phone: before.data.phone ?? "",
    defaultVatRate: Number(before.data.defaultVatRate),
    quoteValidityDays: before.data.quoteValidityDays,
    quoteNumberFormat: before.data.quoteNumberFormat,
    orderNumberFormat: before.data.orderNumberFormat,
  });
  console.log("· ayarlar eski haline döndürüldü");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Şirket Ayarları modülü tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
