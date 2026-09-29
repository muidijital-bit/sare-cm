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
export type BadgeColor = "gray" | "blue" | "green" | "amber" | "red";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-brand-50 text-brand-600",
  green: "bg-success-50 text-success-700",
  amber: "bg-warning-50 text-warning-700",
  red: "bg-error-50 text-error-700",
};

export function Badge({ color = "gray", children }: { color?: BadgeColor; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}

export const CUSTOMER_STATUS_COLORS: Record<string, BadgeColor> = {
  POTENTIAL: "blue",
  ACTIVE: "green",
  PASSIVE: "gray",
  LOST: "red",
};

export const QUOTE_STATUS_COLORS: Record<string, BadgeColor> = {
  DRAFT: "gray",
  SENT: "blue",
  ACCEPTED: "green",
  REJECTED: "red",
  EXPIRED: "amber",
};

export const ORDER_STATUS_COLORS: Record<string, BadgeColor> = {
  CONFIRMED: "blue",
  PREPARING: "amber",
  DELIVERED: "green",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const PROJECT_STATUS_COLORS: Record<string, BadgeColor> = {
  PLANNED: "gray",
  IN_PROGRESS: "blue",
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
