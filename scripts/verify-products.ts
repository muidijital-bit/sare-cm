// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Ürün Yönetimi (katalog) modülü uçtan uca doğrulaması: CRUD, RBAC, ÇEKİRDEK modül olduğu
 * için lisans kapalıyken bile HER ZAMAN açık olması (Free pakette bile teklif/sipariş ürün
 * seçicisi çalışsın diye), RLS izolasyonu, soft-delete geçmiş kayıtları bozmaz.
 * Test verisi sonunda tamamen temizlenir.
 */
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createProduct, updateProduct, deleteProduct, getProduct, listProducts } from "../src/lib/modules/products/service";
import { computeEnabledModules } from "../src/lib/modules/entitlements/resolve";
import { getScope } from "../src/lib/auth/access";
import type { TenantSession } from "../src/lib/auth/session";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) console.log(`✅ ${label}`);
  else { console.error(`❌ ${label}`); failures++; }
}

async function main() {
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const company = await withPlatformBypass((tx) => tx.company.findFirstOrThrow({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } }));
  const catalog = await withPlatformBypass((tx) => tx.appModule.findMany({ where: { isActive: true }, select: { key: true, isCore: true, isFree: true } }));

  const base: TenantSession = {
    userId: owner.id, userName: owner.name, userEmail: owner.email, companyId: company.id, companyName: company.name,
    companyStatus: "ACTIVE", role: "OWNER", enabledModules: ["*"], membershipCount: 1,
  };
  const salesSession: TenantSession = { ...base, role: "SALES" };

  // 1) Çekirdek modül: hiçbir pakette (Free dahil) kapatılamaz
  const freeOnly = computeEnabledModules({ catalog, planModuleKeys: [], overrides: [] });
  check("Ürün modülü ÇEKİRDEK: boş pakette bile açık", freeOnly.includes("product"));
  const explicitlyOff = computeEnabledModules({ catalog, planModuleKeys: [], overrides: [{ moduleKey: "product", enabled: false, expiresAt: null }] });
  check("Ürün modülü override ile kapatılamaz", explicitlyOff.includes("product"));

  // 2) RBAC
  check("getScope: SALES + product → yalnızca görüntüleme", getScope(salesSession, "product", "view") === "all" && getScope(salesSession, "product", "create") === null);
  check("getScope: OWNER + product → serbest", getScope(base, "product", "create") === "all");

  let productId = "";
  try {
    // 3) CRUD
    const createRes = await createProduct(base, { code: "__TEST-001__", name: "__Test Ürün__", unit: "adet", listPrice: 150, defaultCost: 90, vatRate: 20, isActive: true });
    check("Ürün oluşturuldu", createRes.ok);
    if (!createRes.ok) return;
    productId = createRes.data.id;

    const listRes = await listProducts(base, { page: 1, pageSize: 20 });
    check("Ürün listede görünüyor", listRes.ok && listRes.data.items.some((p) => p.id === productId));

    const updRes = await updateProduct(base, productId, { code: "__TEST-001__", name: "__Test Ürün__", unit: "adet", listPrice: 200, defaultCost: 90, vatRate: 20, isActive: false });
    check("Ürün güncellendi", updRes.ok);
    const getRes = await getProduct(base, productId);
    check("Güncel fiyat doğru (200) ve pasif", getRes.ok && Number(getRes.data.listPrice) === 200 && getRes.data.isActive === false);

    // 4) RLS izolasyonu
    const otherCompany = await withPlatformBypass((tx) => tx.company.findFirst({ where: { id: { not: company.id }, deletedAt: null } }));
    if (otherCompany) {
      const crossSession: TenantSession = { ...base, companyId: otherCompany.id };
      const crossRes = await getProduct(crossSession, productId);
      check("RLS: başka şirket bu ürünü göremiyor (notFound)", !crossRes.ok && crossRes.status === 404);
    }

    // 5) Soft delete
    const delRes = await deleteProduct(base, productId);
    check("Ürün silindi (soft delete)", delRes.ok);
    const afterDelete = await getProduct(base, productId);
    check("Silinen ürün artık görünmüyor (notFound)", !afterDelete.ok && afterDelete.status === 404);
    const stillInDb = await withPlatformBypass((tx) => tx.product.findUnique({ where: { id: productId } }));
    check("Silinen ürün DB'de HÂLÂ var (geçmiş kayıtlar bozulmasın diye sert silinmedi)", !!stillInDb && stillInDb.deletedAt !== null);
  } finally {
    await withPlatformBypass(async (tx) => {
      if (productId) {
        await tx.auditLog.deleteMany({ where: { entityId: productId } });
        await tx.product.delete({ where: { id: productId } }).catch(() => {});
      }
    });
    console.log("· test verisi temizlendi");
  }

  console.log(failures === 0 ? "\n🎉 Ürün Yönetimi modülü tüm kontrollerden geçti." : `\n${failures} KONTROL BAŞARISIZ`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
