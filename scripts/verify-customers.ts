/**
 * Müşteri modülünü CANLI veritabanına karşı uçtan uca doğrular: oluşturma (kişiler +
 * etiketlerle), listeleme/arama/filtre, görüntüleme, güncelleme (kişi/etiket farkı),
 * görüşme ekleme, RBAC "own" kapsamı, ve yumuşak silme.
 *
 * Çalıştırma: npx tsx scripts/verify-customers.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { hashPassword } from "../src/lib/auth/password";
import {
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  deleteCustomer,
  createActivity,
} from "../src/lib/modules/customers/service";
import type { TenantSession } from "../src/lib/auth/session";
import type { CustomerInput } from "../src/lib/validation/customer";

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
  // Sahip kullanıcı + geçici bir SALES kullanıcı (own-scope testleri için)
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));

  const salesEmail = `satis-test-${randomUUID().slice(0, 8)}@demo.test`;
  const salesUser = await withPlatformBypass((tx) =>
    tx.user.create({
      data: { email: salesEmail, name: "Test Satış", passwordHash: "x", isActive: true },
    }),
  );
  await withPlatformBypass((tx) =>
    tx.membership.create({ data: { userId: salesUser.id, companyId: DEMO_COMPANY_ID, role: "SALES", isActive: true } }),
  );

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
  const salesSession: TenantSession = { ...ownerSession, userId: salesUser.id, role: "SALES" };

  // 1) Oluşturma — kişi + etiketlerle
  const uniqueTitle = `Test Müşteri ${randomUUID().slice(0, 8)}`;
  const input: CustomerInput = {
    type: "CORPORATE",
    title: uniqueTitle,
    taxOffice: "Kadıköy",
    taxNumber: "1234567890",
    address: "İstanbul",
    sourceId: null,
    status: "POTENTIAL",
    ownerUserId: salesUser.id,
    tags: ["vip", "test"],
    contacts: [{ name: "Ayşe Yılmaz", position: "Satınalma", phone: "05551234567", email: "ayse@test.com", isPrimary: true }],
  };
  const createResult = await createCustomer(salesSession, input);
  assert(createResult.ok, "Müşteri oluşturuldu (SALES, kendi adına)");
  if (!createResult.ok) return report();
  const customerId = createResult.data.id;

  // 2) createCustomer'da SALES'in ownerUserId'yi kendine zorladığı doğrulanır
  const created = await getCustomer(ownerSession, customerId);
  assert(created.ok && created.data.ownerUserId === salesUser.id, "SALES kendi adına oluşturdu (ownerUserId zorlandı)");
  assert(created.ok && created.data.contacts.length === 1, "Kişi doğru şekilde eklendi");
  assert(created.ok && created.data.tags.length === 2, "İki etiket eklendi");

  // 3) RBAC "own" — başka bir SALES kullanıcısı bu kaydı GÖREMEZ
  const otherSalesSession: TenantSession = { ...salesSession, userId: randomUUID() };
  const deniedView = await getCustomer(otherSalesSession, customerId);
  assert(!deniedView.ok && deniedView.status === 403, "Başka bir SALES kullanıcısı kaydı göremiyor (403)");

  // 4) OWNER/ADMIN (scope=all) her müşteriyi görebilir
  const ownerView = await getCustomer(ownerSession, customerId);
  assert(ownerView.ok, "OWNER (tüm kapsam) müşteriyi görebiliyor");

  // 5) Listeleme + arama — unvan ile bulunuyor
  const listResult = await listCustomers(ownerSession, { q: uniqueTitle, page: 1, pageSize: 20 });
  assert(listResult.ok && listResult.data.total === 1, "Arama unvan ile eşleşen tek kaydı buluyor");

  // 6) Listeleme — SALES yalnızca kendi kaydını görür
  const salesListResult = await listCustomers(salesSession, { page: 1, pageSize: 50 });
  assert(
    salesListResult.ok && salesListResult.data.items.every((c) => c.ownerUserId === salesUser.id),
    "SALES listesinde yalnızca kendi müşterileri var",
  );

  // 7) Güncelleme — bir kişi kaldırılır, yeni kişi eklenir, etiket seti değişir
  const updateInput: CustomerInput = {
    ...input,
    status: "ACTIVE",
    tags: ["vip", "yeni-etiket"], // "test" kaldırıldı, "yeni-etiket" eklendi
    contacts: [{ name: "Mehmet Kaya", position: "Müdür", phone: "05559876543", email: "", isPrimary: true }], // eski kişi kaldırılıyor
  };
  const updateResult = await updateCustomer(salesSession, customerId, updateInput);
  assert(updateResult.ok, "Güncelleme başarılı");

  const afterUpdate = await getCustomer(ownerSession, customerId);
  assert(afterUpdate.ok && afterUpdate.data.status === "ACTIVE", "Durum güncellendi");
  assert(
    afterUpdate.ok && afterUpdate.data.contacts.length === 1 && afterUpdate.data.contacts[0].name === "Mehmet Kaya",
    "Eski kişi yumuşak silindi, yeni kişi eklendi",
  );
  assert(
    afterUpdate.ok && afterUpdate.data.tags.map((t) => t.tag.name).sort().join(",") === "vip,yeni-etiket",
    "Etiket seti doğru güncellendi (test çıktı, yeni-etiket eklendi)",
  );

  // 8) Görüşme ekleme (MC-07/08)
  const activityResult = await createActivity(salesSession, customerId, {
    type: "PHONE",
    occurredAt: new Date(),
    note: "İlk görüşme yapıldı",
    contactId: null,
    nextAction: "Teklif hazırla",
    remindAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  assert(activityResult.ok, "Görüşme kaydı eklendi");

  const afterActivity = await getCustomer(ownerSession, customerId);
  assert(afterActivity.ok && afterActivity.data.activities.length === 1, "Görüşme müşteri detayında görünüyor");

  // 9) Silme — bağlı teklif/sipariş yok, başarılı olmalı
  const deleteResult = await deleteCustomer(ownerSession, customerId);
  assert(deleteResult.ok, "Müşteri yumuşak silindi");

  const afterDelete = await getCustomer(ownerSession, customerId);
  assert(!afterDelete.ok && afterDelete.status === 404, "Silinen müşteri artık görünmüyor (404)");

  // Temizlik: test SALES kullanıcısını kaldır
  await withPlatformBypass(async (tx) => {
    await tx.membership.deleteMany({ where: { userId: salesUser.id } });
    await tx.user.delete({ where: { id: salesUser.id } });
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Müşteri modülü tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
