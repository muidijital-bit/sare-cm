// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Modül lisansı (entitlement) doğrulaması: saf çözümleyici + canlı katalog/paketler + servis katmanı
 * zorlaması (Free pakette olmayan modül, rol ne olursa olsun 403).
 */
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { computeEnabledModules } from "../src/lib/modules/entitlements/resolve";
import { getScope } from "../src/lib/auth/access";
import { createOrder } from "../src/lib/modules/orders/service";
import type { TenantSession } from "../src/lib/auth/session";
import { createCustomer } from "../src/lib/modules/customers/service";
import { getCompanyModules, setCompanyModule } from "../src/lib/modules/platform/service";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) console.log(`✅ ${label}`);
  else { console.error(`❌ ${label}`); failures++; }
}

async function main() {
  const catalog = await prisma.appModule.findMany({ where: { isActive: true }, select: { key: true, isCore: true, isFree: true } });
  const keysOf = async (planName: string) =>
    (await prisma.planModule.findMany({ where: { plan: { name: planName } }, select: { module: { select: { key: true } } } })).map((x) => x.module.key);
  const has = (arr: string[], k: string) => arr.includes(k);

  // 1) Paketler
  const free = computeEnabledModules({ catalog, planModuleKeys: await keysOf("Free"), overrides: [] });
  check("Free: müşteri/teklif/panel/kullanıcı/ayarlar AÇIK", ["customer", "quote", "dashboard", "userManagement", "companySettings"].every((k) => has(free, k)));
  check("Free: sipariş/tahsilat/gider/işlem geçmişi KAPALI", ["order", "payment", "expense", "auditLog"].every((k) => !has(free, k)));
  const starter = computeEnabledModules({ catalog, planModuleKeys: await keysOf("Starter"), overrides: [] });
  check("Starter: sipariş+tahsilat açık, gider kapalı", has(starter, "order") && has(starter, "payment") && !has(starter, "expense"));
  const pro = computeEnabledModules({ catalog, planModuleKeys: await keysOf("Pro"), overrides: [] });
  check("Pro: tüm modüller açık", catalog.every((m) => has(pro, m.key)));

  // 2) Override'lar
  const now = new Date("2026-01-01T00:00:00Z");
  const addOn = computeEnabledModules({ catalog, planModuleKeys: [], overrides: [{ moduleKey: "expense", enabled: true, expiresAt: null }], now });
  check("Override: pakete gider EKLENİR", has(addOn, "expense"));
  const expired = computeEnabledModules({ catalog, planModuleKeys: [], overrides: [{ moduleKey: "expense", enabled: true, expiresAt: new Date("2025-12-31") }], now });
  check("Override: süresi dolan ekleme yok sayılır", !has(expired, "expense"));
  const removed = computeEnabledModules({ catalog, planModuleKeys: ["order"], overrides: [{ moduleKey: "order", enabled: false, expiresAt: null }], now });
  check("Override: paketten modül ÇIKARILIR", !has(removed, "order"));
  const coreRemoved = computeEnabledModules({ catalog, planModuleKeys: [], overrides: [{ moduleKey: "companySettings", enabled: false, expiresAt: null }], now });
  check("Çekirdek modül override ile kapatılamaz", has(coreRemoved, "companySettings"));
  check("Boş katalog: kimse kilitlenmez (['*'])", computeEnabledModules({ catalog: [], planModuleKeys: [], overrides: [] })[0] === "*");
  const catalogNoAudit = catalog.filter((m) => m.key !== "auditLog");
  const inactiveModuleLeak = computeEnabledModules({ catalog: catalogNoAudit, planModuleKeys: ["auditLog", "order"], overrides: [{ moduleKey: "auditLog", enabled: true, expiresAt: null }], now });
  check("isActive:false modül PAKETTE olsa da sızmaz", !has(inactiveModuleLeak, "auditLog") && has(inactiveModuleLeak, "order"));
  const legacy = await prisma.plan.findMany({ where: { name: { notIn: ["Free", "Starter", "Pro"] } }, select: { id: true, name: true } });
  const totalCatalogSize = await prisma.appModule.count(); // isActive filtresiz — MODULE_CATALOG'daki TÜM modül sayısı
  for (const p of legacy) {
    const n = await prisma.planModule.count({ where: { planId: p.id } });
    check(`Mevcut paket "${p.name}" tüm modüllere bağlı (${n}/${totalCatalogSize})`, n === totalCatalogSize);
  }

  // 3) Servis katmanı zorlaması (Free pakette sipariş oluşturulamaz, müşteri oluşturulabilir)
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const company = await withPlatformBypass((tx) => tx.company.findFirstOrThrow({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } }));
  const base: TenantSession = {
    userId: owner.id, userName: owner.name, userEmail: owner.email, companyId: company.id, companyName: company.name,
    companyStatus: "ACTIVE", role: "OWNER", enabledModules: free, membershipCount: 1,
  };
  check("getScope: OWNER + Free → order YASAK", getScope(base, "order", "create") === null);
  check("getScope: OWNER + Free → customer serbest", getScope(base, "customer", "create") === "all");
  const orderRes = await createOrder(base, {} as never);
  check("createOrder Free pakette 403", !orderRes.ok && orderRes.status === 403);
  check("getScope: enabledModules ['*'] eski davranış", getScope({ ...base, enabledModules: ["*"] }, "order", "create") === "all");

  // 4) Platform servisi: modül ekle/çıkar/geri al (demo şirkette, sonunda temizlenir)
  const admin = { userId: owner.id };
  const eff = async (key: string) => { const r = await getCompanyModules(company.id); return r.ok ? r.data.find((m) => m.key === key)?.effective : undefined; };
  check("Platform: mevcut demo şirkette 'order' açık", (await eff("order")) === true);
  const off = await setCompanyModule(admin, company.id, { moduleKey: "order", enabled: false });
  check("Platform: modül kapatıldı", off.ok && (await eff("order")) === false);
  const back = await setCompanyModule(admin, company.id, { moduleKey: "order", enabled: null });
  check("Platform: override silinince pakete döner (açık)", back.ok && (await eff("order")) === true);
  const core = await setCompanyModule(admin, company.id, { moduleKey: "companySettings", enabled: false });
  check("Platform: çekirdek modül kapatılamaz (409)", !core.ok && core.status === 409);
  const bad = await setCompanyModule(admin, company.id, { moduleKey: "olmayan", enabled: true });
  check("Platform: olmayan modül 404", !bad.ok && bad.status === 404);

  // 5) Müşteri limiti: geçici paket (maxCustomers=1) + geçici şirket; sonunda tamamen silinir
  const tmpPlan = await prisma.plan.create({ data: { name: `__limit_test_${Date.now()}`, maxUsers: 1, maxCustomers: 1, maxStorageMb: 1, price: 0 } });
  const tmpCompany = await withPlatformBypass((tx) => tx.company.create({ data: { name: "__limit_test__", planId: tmpPlan.id, status: "ACTIVE" } }));
  try {
    const limited: TenantSession = { ...base, companyId: tmpCompany.id, companyName: tmpCompany.name, enabledModules: ["*"] };
    const c1 = await createCustomer(limited, { type: "CORPORATE", title: "Limit Test 1", contacts: [], tags: [] } as never);
    check("Limit: paket sınırı içinde ilk müşteri oluşur", c1.ok);
    const c2 = await createCustomer(limited, { type: "CORPORATE", title: "Limit Test 2", contacts: [], tags: [] } as never);
    check("Limit: sınır aşılınca 409 + yükseltme mesajı", !c2.ok && c2.status === 409 && /limit/i.test(c2.message));
  } finally {
    await withPlatformBypass(async (tx) => {
      await tx.customer.deleteMany({ where: { companyId: tmpCompany.id } });
      await tx.auditLog.deleteMany({ where: { companyId: tmpCompany.id } });
      await tx.company.delete({ where: { id: tmpCompany.id } });
    });
    await prisma.plan.delete({ where: { id: tmpPlan.id } });
  }

  console.log(failures === 0 ? "\nTÜM LİSANS KONTROLLERİ GEÇTİ" : `\n${failures} KONTROL BAŞARISIZ`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
