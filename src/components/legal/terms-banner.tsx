"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Güncel yasal metin sürümünü henüz onaylamamış (eski/önceden davet edilmiş) kullanıcılar için şerit. */
export function TermsBanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function accept() {
    setBusy(true);
    const res = await fetch("/api/me/terms", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <p>
        <a href="/yasal/kullanim-kosullari" target="_blank" className="font-medium underline">
          Kullanım Koşulları
        </a>{" "}
        ve{" "}
        <a href="/yasal/kvkk-aydinlatma" target="_blank" className="font-medium underline">
          KVKK Aydınlatma Metni
        </a>{" "}
        yayımlandı. Hizmeti kullanmaya devam etmek için lütfen okuyup onaylayın.
      </p>
      <button onClick={accept} disabled={busy} className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? "Kaydediliyor…" : "Okudum, onaylıyorum"}
      </button>
    </div>
  );
}
