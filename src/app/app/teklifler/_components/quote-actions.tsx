"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr } from "@/lib/i18n/tr";

interface Props {
  quoteId: string;
  status: string;
  canEdit: boolean;
  canConvert: boolean;
  hasOrder: boolean;
}

async function callAction(url: string) {
  const res = await fetch(url, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? tr.common.error);
  return body;
}

export function QuoteActions({ quoteId, status, canEdit, canConvert, hasOrder }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, redirectTo?: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (redirectTo && result && typeof result === "object" && "id" in result) {
        router.push(`${redirectTo}/${(result as { id: string }).id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <button
          disabled={busy}
          onClick={() => run(() => callAction(`/api/quotes/${quoteId}/send`))}
          className="rounded-md bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {tr.quote.actions.send}
        </button>
      )}
      {status === "SENT" && (
        <>
          <button
            disabled={busy}
            onClick={() => run(() => callAction(`/api/quotes/${quoteId}/accept`))}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {tr.quote.actions.accept}
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => callAction(`/api/quotes/${quoteId}/reject`))}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {tr.quote.actions.reject}
          </button>
        </>
      )}
      {status !== "DRAFT" && (
        <button
          disabled={busy}
          onClick={() => run(() => callAction(`/api/quotes/${quoteId}/revise`), "/app/teklifler")}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {tr.quote.actions.revise}
        </button>
      )}
      {status === "ACCEPTED" && canConvert && !hasOrder && (
        <button
          disabled={busy}
          onClick={() => run(() => callAction(`/api/quotes/${quoteId}/convert`), "/app/siparisler")}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {tr.quote.actions.convert}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
