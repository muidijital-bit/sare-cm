/**
 * Etkin modül kümesi = çekirdek + ücretsiz + paket modülleri + şirkete eklenenler − çıkarılanlar.
 * Saf fonksiyon (DB'siz) — birim test edilebilir; oturum kurulurken (session.ts) çağrılır.
 */
export interface ModuleOverride {
  moduleKey: string;
  enabled: boolean;
  expiresAt: Date | null;
}

export function computeEnabledModules(input: {
  /** Katalogdaki aktif modüller (anahtar + çekirdek/ücretsiz bayrakları). */
  catalog: { key: string; isCore: boolean; isFree: boolean }[];
  planModuleKeys: string[];
  overrides: ModuleOverride[];
  now?: Date;
}): string[] {
  const now = input.now ?? new Date();

  // Katalog hiç tohumlanmamışsa (yeni/boş ortam) kimseyi kilitlemeyiz: tüm modüller açık sayılır.
  // Bu bir GÜVENLİK sınırı değil (RBAC + RLS ayrıca geçerli), yalnızca ürün lisansıdır.
  if (input.catalog.length === 0) return ["*"];

  const enabled = new Set<string>();
  for (const m of input.catalog) if (m.isCore || m.isFree) enabled.add(m.key);
  for (const key of input.planModuleKeys) enabled.add(key);

  for (const o of input.overrides) {
    if (o.expiresAt && o.expiresAt.getTime() <= now.getTime()) continue;
    if (o.enabled) enabled.add(o.moduleKey);
    else enabled.delete(o.moduleKey);
  }

  // Çekirdek modüller hiçbir override ile kapatılamaz.
  for (const m of input.catalog) if (m.isCore) enabled.add(m.key);
  return Array.from(enabled);
}

export function isModuleEnabled(enabledModules: readonly string[], key: string): boolean {
  return enabledModules.includes("*") || enabledModules.includes(key);
}
