"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "react-feather";
import type { Onboarding } from "@/lib/modules/onboarding/service";
import { confirmAction, notifyError } from "@/lib/ui/sweetalert";

/** Panel üstündeki "Kurulumu tamamla" kartı — adımlar gerçek veriden işaretlenir. */
export function OnboardingChecklist({ data }: { data: Onboarding }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const total = data.steps.length;
  const pct = total ? Math.round((data.doneCount / total) * 100) : 100;
  const next = data.steps.find((s) => !s.done);

  async function dismiss() {
    if (!(await confirmAction("Kurulum listesi panelden kaldırılsın mı? Tekrar gösterilmez.", "Listeyi gizle"))) return;
    const res = await fetch("/api/onboarding/dismiss", { method: "POST" });
    if (!res.ok) return notifyError("Gizlenemedi, tekrar deneyin.");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-white shadow-theme-xs">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {data.doneCount === total ? "Kurulum tamamlandı 🎉" : "Kurulumu tamamlayın"}
            <span className="ml-2 text-sm font-normal text-gray-500">
              {data.doneCount}/{total} adım
            </span>
          </h2>
          <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {next && !open && (
          <Link href={next.href} className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Sıradaki: {next.cta}
          </Link>
        )}
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50" aria-label={open ? "Daralt" : "Genişlet"}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button onClick={dismiss} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-gray-50" title="Listeyi gizle" aria-label="Listeyi gizle">
          <X size={16} />
        </button>
      </div>
      {open && (
        <ol className="divide-y divide-gray-100 border-t border-gray-100">
          {data.steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-4 px-5 py-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done ? "bg-emerald-100 text-emerald-700" : s === next ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.done ? <Check size={14} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${s.done ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.title}</p>
                {!s.done && <p className="text-xs text-gray-500">{s.hint}</p>}
              </div>
              {!s.done && (
                <Link
                  href={s.href}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    s === next ? "bg-brand-800 text-white hover:bg-brand-700" : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {s.cta}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
