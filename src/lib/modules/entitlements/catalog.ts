/**
 * Ürün modül kataloğu — TEK doğruluk kaynağı (kod tarafı). `key` değerleri rbac `Module`
 * anahtarlarıyla (ve "dashboard") birebir aynıdır; `scripts/seed-modules.ts` bunu
 * `app_modules` tablosuna yansıtır. Yeni modül eklemek = buraya satır + seed çalıştırmak.
 *
 * - isCore: kapatılamaz (şirket yönetimi olmadan ürün kullanılamaz).
 * - isFree: her pakette ve "Free" pakette açık gelir.
 * - isActive: false ise modül HERKESTEN gizlenir (menü/sayfa/API) — paketten bağımsız,
 *   ürün genelinde geçici bir "kapalı" anahtarı (bkz. auditLog: canlıya çıkana kadar kapalı).
 */
export interface CatalogModule {
  key: string;
  name: string;
  description: string;
  isCore: boolean;
  isFree: boolean;
  sortOrder: number;
  isActive?: boolean;
}

export const MODULE_CATALOG: CatalogModule[] = [
  { key: "dashboard", name: "Panel", description: "Özet göstergeler ve grafikler", isCore: true, isFree: true, sortOrder: 0 },
  { key: "customer", name: "Müşteriler", description: "Müşteri ve kişi yönetimi", isCore: false, isFree: true, sortOrder: 10 },
  // Teklif/sipariş ürün seçicisinin dayandığı katalog — çekirdek: hiçbir pakette kapatılamaz,
  // aksi halde Free pakette bile serbest olan "Teklifler" modülü kullanılamaz hale gelirdi.
  { key: "product", name: "Ürünler", description: "Ürün/hizmet kataloğu, fiyat ve maliyet", isCore: true, isFree: true, sortOrder: 15 },
  { key: "quote", name: "Teklifler", description: "Teklif hazırlama, gönderme, onay", isCore: false, isFree: true, sortOrder: 20 },
  { key: "order", name: "Siparişler", description: "Tekliften sipariş, durum takibi", isCore: false, isFree: false, sortOrder: 30 },
  { key: "payment", name: "Tahsilatlar", description: "Tahsilat, vade ve mahsuplaşma", isCore: false, isFree: false, sortOrder: 40 },
  { key: "expense", name: "Giderler", description: "Gider kaydı ve kategoriler", isCore: false, isFree: false, sortOrder: 50 },
  // GEÇİCİ: canlıya çıkana kadar kapalı (test/demo verisiyle dolu, henüz müşteriye gösterilecek durumda değil).
  // Canlıya alırken: isActive: false satırını kaldırıp `npx tsx scripts/seed-modules.ts` çalıştırın.
  { key: "auditLog", name: "İşlem Geçmişi", description: "Kim ne zaman ne yaptı", isCore: false, isFree: false, sortOrder: 60, isActive: false },
  { key: "userManagement", name: "Kullanıcılar", description: "Kullanıcı ve rol yönetimi", isCore: true, isFree: true, sortOrder: 70 },
  { key: "companySettings", name: "Şirket Ayarları", description: "Firma bilgileri, numaralandırma, KDV", isCore: true, isFree: true, sortOrder: 80 },
  { key: "supplier", name: "Tedarikçiler & Satın Alma", description: "Tedarikçi kaydı, alım, ürün maliyeti ve stok takibi", isCore: false, isFree: false, sortOrder: 90 },
  { key: "employee", name: "Personel Yönetimi", description: "Çalışan kaydı ve izin takibi", isCore: false, isFree: false, sortOrder: 100 },
  { key: "payroll", name: "Bordro", description: "Aylık bordro dönemi ve maaş ödemesi", isCore: false, isFree: false, sortOrder: 110 },
  { key: "taxObligation", name: "Vergi & SGK Takibi", description: "Vergi/SGK yükümlülük takvimi ve ödeme takibi", isCore: false, isFree: false, sortOrder: 120 },
];

export interface CatalogPlan {
  name: string;
  description: string;
  maxUsers: number;
  maxCustomers: number;
  maxStorageMb: number;
  price: number;
  yearlyPrice: number | null;
  /** Ücretsiz olmayan modül anahtarları (ücretsiz/çekirdekler zaten her pakette açık). */
  moduleKeys: string[];
}

/** Başlangıç paketleri — fiyatlar yer tutucudur, platform panelinden değiştirilir. */
export const DEFAULT_PLANS: CatalogPlan[] = [
  { name: "Free", description: "Müşteri ve teklif ile başlayın", maxUsers: 2, maxCustomers: 100, maxStorageMb: 200, price: 0, yearlyPrice: null, moduleKeys: [] },
  { name: "Starter", description: "Sipariş ve tahsilat takibi", maxUsers: 5, maxCustomers: 1000, maxStorageMb: 2000, price: 499, yearlyPrice: 4990, moduleKeys: ["order", "payment"] },
  { name: "Pro", description: "Tüm modüller", maxUsers: 25, maxCustomers: 20000, maxStorageMb: 20000, price: 999, yearlyPrice: 9990, moduleKeys: ["order", "payment", "expense", "auditLog", "supplier", "employee", "payroll", "taxObligation"] },
];
