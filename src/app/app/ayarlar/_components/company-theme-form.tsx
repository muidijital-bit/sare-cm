"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "react-feather";
import { THEMES, THEME_KEYS, type ThemeKey } from "@/lib/theme";
import { notifyError } from "@/lib/ui/sweetalert";

/** Tema rengi — 5 hazır renk; seçim anında uygulanır (tüm kullanıcılar için, bu firma). */
export function CompanyThemeForm({ initialTheme, canEdit }: { initialTheme: ThemeKey; canEdit: boolean }) {
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [busy, setBusy] = useState(false);

  async function choose(key: ThemeKey) {
    if (!canEdit || key === theme) return;
    setBusy(true);
    const res = await fetch("/api/company-settings/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: key }) });
    setBusy(false);
    if (!res.ok) return notifyError("Tema kaydedilemedi.");
    setTheme(key);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs">
      <h2 className="text-sm font-semibold text-gray-900">Tema rengi</h2>
      <p className="mt-1 text-xs text-gray-500">Butonlar, menü vurgusu ve tablolarda kullanılır; firmadaki tüm kullanıcılar için geçerlidir.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {THEME_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={busy || !canEdit}
            onClick={() => choose(k)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${theme === k ? "border-gray-900 font-medium text-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-300"} disabled:cursor-default`}
            aria-pressed={theme === k}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: THEMES[k].swatch }}>
              {theme === k && <Check size={14} className="text-white" />}
            </span>
            {THEMES[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}
