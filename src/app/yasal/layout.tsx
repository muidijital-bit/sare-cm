import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { LEGAL, LEGAL_IS_DRAFT, LEGAL_LINKS } from "@/lib/legal";

/** Herkese açık yasal sayfalar (oturum gerekmez — bkz. middleware: yalnızca /app ve /platform korunur). */
export default function YasalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/giris">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.logoDark} alt={BRAND.name} className="h-6 w-auto" />
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-gray-600">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-violet-700">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {LEGAL_IS_DRAFT && (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Taslak — bu metin hukuki inceleme bekliyor; şirket bilgileri henüz tamamlanmadı.
          </p>
        )}
        <article className="legal rounded-2xl border border-gray-200 bg-white p-6 text-[15px] leading-7 text-gray-700 shadow-theme-xs sm:p-10">
          {children}
        </article>
        <p className="mt-6 text-center text-xs text-gray-400">
          Yürürlük tarihi: {LEGAL.effectiveDate} · Sürüm {LEGAL.version} · {LEGAL.companyTitle}
        </p>
      </main>
    </div>
  );
}
