/**
 * Firma tema rengi — Şirket Ayarları'nda 5 hazır seçenekten biri (renk seçici yok). Seçim
 * companies.settings.themeColor'da tutulur; uygulama içinde (yalnızca /app) `brand-*` Tailwind
 * renkleri CSS değişkenlerinden okunduğu için tüm butonlar, odak halkaları, aktif menü vb. değişir.
 * Değerler "R G B" (Tailwind `<alpha-value>` için).
 */
export const THEME_KEYS = ["mor", "mavi", "turkuaz", "yesil", "antrasit"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export const DEFAULT_THEME: ThemeKey = "mor";

const STEPS = ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");

export const THEMES: Record<ThemeKey, { label: string; swatch: string; ramp: string[] }> = {
  mor: {
    label: "Mor",
    swatch: "#6d28d9",
    ramp: ["#f8f5ff", "#f1ebff", "#e4d8ff", "#cbb3ff", "#ab82ff", "#9061fa", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#3b1370", "#2a0e52"],
  },
  mavi: {
    label: "Mavi",
    swatch: "#1d4ed8",
    ramp: ["#f5f9ff", "#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"],
  },
  turkuaz: {
    label: "Turkuaz",
    swatch: "#0e7490",
    ramp: ["#f3fcfe", "#ecfeff", "#cffafe", "#a5f3fc", "#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63", "#083344"],
  },
  yesil: {
    label: "Yeşil",
    swatch: "#047857",
    ramp: ["#f3fdf8", "#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#022c22"],
  },
  antrasit: {
    label: "Antrasit",
    swatch: "#334155",
    ramp: ["#fafbfc", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"],
  },
};

export function themeKeyOf(settings: unknown): ThemeKey {
  const v = (settings as Record<string, unknown> | null)?.themeColor;
  return THEME_KEYS.includes(v as ThemeKey) ? (v as ThemeKey) : DEFAULT_THEME;
}

/** `:root { --brand-50: R G B; … }` — uygulama layout'unda <style> olarak basılır. */
export function themeCss(key: ThemeKey): string {
  const ramp = THEMES[key].ramp;
  return `:root{${STEPS.map((s, i) => `--brand-${s}:${hex(ramp[i])};`).join("")}}`;
}

/** Tailwind config için: brand-<adım> → CSS değişkeni (varsayılanlar globals.css'te, mor). */
export const BRAND_TAILWIND = Object.fromEntries(STEPS.map((s) => [s, `rgb(var(--brand-${s}) / <alpha-value>)`]));
