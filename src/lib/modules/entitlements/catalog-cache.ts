import { prisma } from "@/lib/db/prisma";

/**
 * Global (şirket bazlı OLMAYAN) lisans verisi: modül kataloğu + paket→modül eşlemesi.
 * Bu tablolar nadiren değişir ve RLS'e tabi değildir; her istekte veritabanına sormak yerine
 * kısa süreli süreç-içi önbellekte tutulur (her Neon gidiş-dönüşü ~ onlarca-yüzlerce ms).
 * Şirkete özel `company_modules` KASITLI olarak önbelleğe alınmaz — panelden yapılan
 * ekle/çıkar anında etkili olmalı (bkz. session.ts).
 */
interface Snapshot {
  catalog: { key: string; isCore: boolean; isFree: boolean }[];
  planModuleKeys: Map<string, string[]>;
  fetchedAt: number;
}

const TTL_MS = 60_000;
let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

async function load(): Promise<Snapshot> {
  const [catalog, planModules] = await Promise.all([
    prisma.appModule.findMany({ where: { isActive: true }, select: { key: true, isCore: true, isFree: true } }),
    prisma.planModule.findMany({ select: { planId: true, module: { select: { key: true } } } }),
  ]);
  const planModuleKeys = new Map<string, string[]>();
  for (const pm of planModules) {
    const list = planModuleKeys.get(pm.planId) ?? [];
    list.push(pm.module.key);
    planModuleKeys.set(pm.planId, list);
  }
  return { catalog, planModuleKeys, fetchedAt: Date.now() };
}

export async function getLicenseSnapshot(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.fetchedAt < TTL_MS) return snapshot;
  // Aynı anda gelen isteklerin hepsi tek bir yüklemeyi bekler.
  inflight ??= load()
    .then((s) => (snapshot = s))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
