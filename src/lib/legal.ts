/**
 * Yasal metinlerin (KVKK aydınlatma, gizlilik/çerez, kullanım koşulları) TEK kaynağı.
 *
 * - Şirket bilgileri aşağıda doldurulmalı; köşeli parantezli ([...]) bir değer kaldıkça sayfalar
 *   "Taslak — hukuki inceleme bekliyor" uyarısı gösterir (isDraft).
 * - Metin içeriği değişince `version` güncellenir: kullanıcılar uygulamada yeniden onay şeridi görür
 *   (users.terms_version ≠ LEGAL.version).
 * - Metinler bir hukukçu tarafından gözden geçirilmelidir; burada muiflow'un gerçek teknik
 *   işleyişine (barındırma, çerezler, loglar) göre hazırlanmış bir taslak vardır.
 */
export const LEGAL = {
  version: "2026-09-29",
  effectiveDate: "29.09.2026",

  // --- Veri sorumlusu / hizmet sağlayıcı bilgileri (doldurulmalı) ---
  companyTitle: "[Muimedya ticari unvanı — örn. Muimedya Reklam ve Yazılım Ltd. Şti.]",
  address: "[Açık adres]",
  mersisNo: "[MERSİS no]",
  taxOffice: "[Vergi dairesi ve vergi no]",
  kepAddress: "[KEP adresi — varsa]",
  contactEmail: "info@muimedya.com",
  kvkkEmail: "[KVKK başvuruları için e-posta — örn. kvkk@muiflow.com]",
  website: "https://muiflow.com",
  jurisdiction: "[İstanbul (Merkez)]",

  // --- Teknik altyapı (gerçek kurulumla uyumlu) ---
  hosting: [
    { name: "Vercel Inc.", role: "Uygulama barındırma ve içerik dağıtımı", location: "ABD / küresel" },
    { name: "Neon Inc. (Amazon Web Services altyapısı)", role: "Veritabanı barındırma", location: "ABD (us-east-2, Ohio)" },
  ],
  emailProvider: { name: "Resend Inc.", role: "İşlemsel e-posta gönderimi (davet, şifre sıfırlama)", location: "ABD" },
} as const;

export const LEGAL_LINKS = [
  { href: "/yasal/kvkk-aydinlatma", label: "KVKK Aydınlatma Metni" },
  { href: "/yasal/gizlilik", label: "Gizlilik ve Çerez Politikası" },
  { href: "/yasal/kullanim-kosullari", label: "Kullanım Koşulları" },
] as const;

/** Köşeli parantezli yer tutucu kaldıysa metinler taslaktır. */
export const LEGAL_IS_DRAFT = Object.values(LEGAL).some((v) => typeof v === "string" && /\[.*\]/.test(v));
