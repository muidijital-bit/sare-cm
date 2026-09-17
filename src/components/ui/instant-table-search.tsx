"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Filtrelenecek satırların class'ı (her `<tr>` üzerinde). Örn: "searchable-row-customers" */
  rowSelector: string;
  placeholder: string;
  /** Sunucu tarafı arama (tüm sayfalarda ara) için mevcut query değeri — sadece bilgi amaçlı gösterilir. */
  serverQuery?: string;
  /** Enter'a basınca sunucuda (tüm kayıtlarda) aramak için çağrılır. */
  onServerSearch?: (value: string) => void;
  totalOnPage: number;
}

/**
 * ANINDA arama — yazdıkça sunucuya HİÇ gitmez, o an ekranda yüklü olan satırları
 * (`data-search` özniteliğindeki metne göre) DOM'da gizler/gösterir. Böylece arama kutusu
 * ağ gecikmesinden (Neon'a ~1,4sn round-trip) tamamen bağımsız, anlık çalışır.
 *
 * Sunucu tarafı arama (sayfalama sınırlarını aşan, TÜM kayıtlarda arama) hâlâ mümkün:
 * Enter'a basıldığında `onServerSearch` ile tetiklenir.
 */
export function InstantTableSearch({ rowSelector, placeholder, serverQuery, onServerSearch, totalOnPage }: Props) {
  const [value, setValue] = useState("");
  const [visibleCount, setVisibleCount] = useState(totalOnPage);
  const inputRef = useRef<HTMLInputElement>(null);

  // Satırları anında filtrele (ağ yok, sunucu yok — sadece DOM).
  useEffect(() => {
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>(`.${rowSelector}`));
    const needle = value.trim().toLocaleLowerCase("tr");
    let shown = 0;

    for (const row of rows) {
      const haystack = (row.dataset.search ?? row.textContent ?? "").toLocaleLowerCase("tr");
      const match = needle === "" || haystack.includes(needle);
      row.hidden = !match;
      if (match) shown++;
    }
    setVisibleCount(shown);
  }, [value, rowSelector, totalOnPage]);

  return (
    <div className="min-w-[240px] flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onServerSearch) {
              e.preventDefault();
              onServerSearch(value.trim());
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-16 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
          >
            Temizle
          </button>
        )}
      </div>
      {value && (
        <p className="mt-1 text-xs text-gray-400">
          Bu sayfada {visibleCount} kayıt eşleşti.
          {onServerSearch && " Tüm kayıtlarda aramak için Enter'a basın."}
        </p>
      )}
      {!value && serverQuery && (
        <p className="mt-1 text-xs text-gray-400">
          Sunucuda &quot;{serverQuery}&quot; aramasının sonuçları gösteriliyor.
        </p>
      )}
    </div>
  );
}
