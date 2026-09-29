import Link from "next/link";

/**
 * Ortak sayfalama — mevcut filtreleri (searchParams) koruyarak sayfa değiştirir. Çok sayfada
 * tüm numaraları basmak yerine ilk/son + etrafındaki pencereyi gösterir.
 */
export function Pagination({
  pathname,
  searchParams,
  page,
  total,
  pageSize,
}: {
  pathname: string;
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  total: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = Array.from(pages).sort((a, b) => a - b);

  const href = (p: number) => ({ pathname, query: { ...searchParams, page: p } });
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-xs text-gray-500">
        {from.toLocaleString("tr-TR")}–{to.toLocaleString("tr-TR")} / {total.toLocaleString("tr-TR")} kayıt
      </span>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-100">
            ‹ Önceki
          </Link>
        )}
        {sorted.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - sorted[i - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
            <Link
              href={href(p)}
              className={`min-w-[2rem] rounded-md px-2.5 py-1 text-center ${p === page ? "bg-brand-800 font-medium text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {p}
            </Link>
          </span>
        ))}
        {page < totalPages && (
          <Link href={href(page + 1)} className="rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-100">
            Sonraki ›
          </Link>
        )}
      </div>
    </div>
  );
}
