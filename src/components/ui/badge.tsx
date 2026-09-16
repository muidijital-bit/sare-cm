/**
 * Genel amaçlı durum rozeti — tek bileşen, tek renk sözlüğü (bkz.
 * .claude/agents/frontend-ui-dev.md: "durum rozetleri tutarlı olmalı"). Yeni bir durum
 * eklerken yalnızca ilgili dict'e (örn. CUSTOMER_STATUS_COLORS) bir satır eklenir.
 */
export type BadgeColor = "gray" | "blue" | "green" | "amber" | "red";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
};

export function Badge({ color = "gray", children }: { color?: BadgeColor; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_CLASSES[color]}`}>
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
