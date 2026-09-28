import type { ReactNode } from "react";

/**
 * TailAdmin'in Button.tsx'inden port edildi (bkz. tailwind.config.ts üstündeki not).
 * Sayfalar şu an hâlâ kendi inline `<button className="...">` sınıflarını kullanıyor —
 * bu, "sayfa sayfa yeniden tasarım" ilerledikçe onların yerini alacak ortak bileşen.
 */
export type ButtonVariant = "primary" | "outline" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps {
  children: ReactNode;
  type?: "button" | "submit";
  size?: ButtonSize;
  variant?: ButtonVariant;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white shadow-theme-xs hover:bg-brand-700 disabled:bg-brand-300",
  outline: "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50",
  danger: "bg-white text-error-600 ring-1 ring-inset ring-error-300 hover:bg-error-50",
};

export function Button({
  children,
  type = "button",
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  disabled = false,
  className = "",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${className}`}
    >
      {startIcon}
      {children}
      {endIcon}
    </button>
  );
}
