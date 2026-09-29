/**
 * Genel amaçlı durum rozeti — tek bileşen, tek renk sözlüğü (bkz.
 * .claude/agents/frontend-ui-dev.md: "durum rozetleri tutarlı olmalı"). Yeni bir durum
 * eklerken yalnızca ilgili dict'e (örn. CUSTOMER_STATUS_COLORS) bir satır eklenir.
 *
 * Görsel dil TailAdmin'in "light" rozet varyantından port edildi (bkz. tailwind.config.ts
 * üstündeki not) — anahtar adları (gray/blue/green/amber/red) KORUNDU, yalnızca renk
 * değerleri tailwind.config.ts'teki yeni success/error/warning/brand skalasına bağlandı;
 * bu sayede onlarca dosyadaki `<Badge color="green">` gibi kullanımlar değişmeden kalır.
 */
export type BadgeColor = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "sky" | "indigo" | "pink" | "teal" | "orange";

/** Açık zemin + koyu metin + ince halka (okunaklılık için kontrast ≥ 4.5:1) + renkli nokta. */
const COLOR_CLASSES: Record<BadgeColor, { chip: string; dot: string }> = {
  gray: { chip: "bg-gray-100 text-gray-700 ring-gray-200", dot: "bg-gray-400" },
  blue: { chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  green: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  amber: { chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  red: { chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  violet: { chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  sky: { chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  indigo: { chip: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  pink: { chip: "bg-pink-50 text-pink-700 ring-pink-200", dot: "bg-pink-500" },
  teal: { chip: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500" },
  orange: { chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
};

export function Badge({ color = "gray", children, dot = true }: { color?: BadgeColor; children: React.ReactNode; dot?: boolean }) {
  const c = COLOR_CLASSES[color];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-theme-xs font-medium ring-1 ring-inset ${c.chip}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />}
      {children}
    </span>
  );
}

/**
 * Serbest metin etiketleri (kategori, kaynak, müşteri etiketi, departman) için KARARLI renk:
 * aynı metin her yerde aynı rengi alır (basit metin özeti → paletten seçim). Durum renkleriyle
 * (yeşil=olumlu, kırmızı=olumsuz) karışmasın diye bu palette yeşil/kırmızı/sarı yok.
 */
const TAG_PALETTE: BadgeColor[] = ["violet", "sky", "indigo", "pink", "teal", "orange", "blue"];
export function tagColor(text: string | null | undefined): BadgeColor {
  if (!text) return "gray";
  let h = 0;
  for (const ch of text.toLocaleLowerCase("tr")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

export const CUSTOMER_TYPE_COLORS: Record<string, BadgeColor> = {
  INDIVIDUAL: "sky",
  CORPORATE: "indigo",
};

export const PAYMENT_METHOD_COLORS: Record<string, BadgeColor> = {
  CASH: "teal",
  BANK_TRANSFER: "indigo",
  CREDIT_CARD: "violet",
  CHECK: "orange",
};

export const TAX_TYPE_COLORS: Record<string, BadgeColor> = {
  KDV: "violet",
  MUHTASAR: "indigo",
  GECICI_VERGI: "sky",
  SGK_PRIMI: "teal",
  GELIR_VERGISI_STOPAJI: "pink",
  DIGER: "gray",
};

export const ROLE_COLORS: Record<string, BadgeColor> = {
  OWNER: "violet",
  ADMIN: "indigo",
  SALES: "sky",
  ACCOUNTING: "teal",
  VIEWER: "gray",
};

export const STOCK_MOVEMENT_COLORS: Record<string, BadgeColor> = {
  PURCHASE: "green",
  ORDER_RESERVED: "sky",
  ORDER_CANCELLED: "amber",
  ADJUSTMENT: "gray",
  PROJECT_CONSUMED: "violet",
};

export const CUSTOMER_STATUS_COLORS: Record<string, BadgeColor> = {
  POTENTIAL: "sky",
  ACTIVE: "green",
  PASSIVE: "gray",
  LOST: "red",
};

export const QUOTE_STATUS_COLORS: Record<string, BadgeColor> = {
  DRAFT: "gray",
  SENT: "sky",
  ACCEPTED: "green",
  REJECTED: "red",
  EXPIRED: "amber",
};

export const ORDER_STATUS_COLORS: Record<string, BadgeColor> = {
  CONFIRMED: "indigo",
  PREPARING: "amber",
  DELIVERED: "teal",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const PROJECT_STATUS_COLORS: Record<string, BadgeColor> = {
  PLANNED: "gray",
  IN_PROGRESS: "indigo",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const PURCHASE_ORDER_STATUS_COLORS: Record<string, BadgeColor> = {
  DRAFT: "gray",
  RECEIVED: "green",
  CANCELLED: "red",
};

export const EMPLOYEE_STATUS_COLORS: Record<string, BadgeColor> = {
  ACTIVE: "green",
  ON_LEAVE: "amber",
  TERMINATED: "red",
};

export const PAYROLL_RUN_STATUS_COLORS: Record<string, BadgeColor> = {
  DRAFT: "gray",
  COMPLETED: "green",
};

export const TAX_OBLIGATION_STATUS_COLORS: Record<string, BadgeColor> = {
  PENDING: "amber",
  PAID: "green",
};
