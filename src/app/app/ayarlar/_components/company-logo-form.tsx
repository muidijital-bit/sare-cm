"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "react-feather";
import { notifyError } from "@/lib/ui/sweetalert";
import { prepareLogo, readFileAsDataUrl } from "@/lib/ui/logo";
import { LogoImage } from "@/components/ui/logo-image";

/** Firma logosu: tarayıcıda 400 px genişliğe küçültülür (PNG) ve kaydedilir. */
export function CompanyLogoForm({ initialLogo, canEdit }: { initialLogo: string | null; canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(initialLogo);
  const [busy, setBusy] = useState(false);

  async function save(next: string | null) {
    setBusy(true);
    const res = await fetch("/api/company-settings/logo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: next }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return notifyError(body.error ?? "Logo kaydedilemedi.");
    setLogo(next);
    router.refresh();
  }

  async function onFile(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return notifyError("PNG veya JPG yükleyin.");
    // Beyaz zemin şeffaflaştırılır ve logo kadar kırpılır; açık renkli logo üst çubukta koyu zeminle gösterilir.
    const { dataUrl } = await prepareLogo(await readFileAsDataUrl(file), 400);
    if (dataUrl.length > 400_000) return notifyError("Logo çok büyük; daha küçük bir görsel deneyin.");
    await save(dataUrl);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs">
      <h2 className="text-sm font-semibold text-gray-900">Firma logosu</h2>
      <p className="mt-1 text-xs text-gray-500">Üst çubukta firma adının yanında ve yeni teklif şablonlarının antetinde kullanılır.</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-2">
          {logo ? (
            <LogoImage src={logo} alt="Firma logosu" className="max-h-full max-w-full" />
          ) : (
            <span className="text-xs text-gray-400">Logo yok</span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0]).finally(() => input.current && (input.current.value = ""))} />
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload size={14} /> {busy ? "Kaydediliyor…" : logo ? "Değiştir" : "Logo yükle"}
            </button>
            {logo && (
              <button type="button" disabled={busy} onClick={() => save(null)} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                Kaldır
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
