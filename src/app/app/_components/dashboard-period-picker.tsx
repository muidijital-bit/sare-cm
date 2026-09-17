"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { startRouteLoading } from "@/lib/ui/route-loading";

interface Props {
  defaultFrom: string;
  defaultTo: string;
  /** Sunucuda O AN uygulanmış aralık — geri/ileri tuşunda ve yeni sayfa render'ında
   *  kutular gerçekten uygulanan değerle senkron kalsın (eskiden useState bir kez
   *  kurulduğu için kutular ile uygulanan filtre birbirinden kopabiliyordu). */
  activeFrom: string;
  activeTo: string;
}

function toInput(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function DashboardPeriodPicker({ defaultFrom, defaultTo, activeFrom, activeTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(activeFrom);
  const [to, setTo] = useState(activeTo);

  // Sunucudan gelen aktif aralık değişince kutuları senkronla.
  useEffect(() => {
    setFrom(activeFrom);
    setTo(activeTo);
  }, [activeFrom, activeTo]);

  function push(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startRouteLoading();
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(preset: "thisMonth" | "last3Months" | "thisYear") {
    const now = new Date();
    if (preset === "thisMonth") {
      push(toInput(new Date(now.getFullYear(), now.getMonth(), 1)), toInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      return;
    }
    if (preset === "last3Months") {
      push(toInput(new Date(now.getFullYear(), now.getMonth() - 2, 1)), toInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      return;
    }
    push(toInput(new Date(now.getFullYear(), 0, 1)), toInput(new Date(now.getFullYear(), 11, 31)));
  }

  const isDefaultRange = from === defaultFrom && to === defaultTo;

  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <div className="flex gap-1">
        <PresetButton onClick={() => applyPreset("thisMonth")} active={isDefaultRange}>
          Bu ay
        </PresetButton>
        <PresetButton onClick={() => applyPreset("last3Months")}>Son 3 ay</PresetButton>
        <PresetButton onClick={() => applyPreset("thisYear")}>Bu yıl</PresetButton>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Başlangıç</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500">Bitiş</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
        />
      </div>
      <button
        onClick={() => push(from, to)}
        className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        Uygula
      </button>
    </div>
  );
}

function PresetButton({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
        active ? "border-brand-300 bg-brand-50 text-brand-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
