"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/i18n/tr";

export default function SirketSecPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <p className="p-8 text-center text-sm text-gray-500">{tr.common.loading}</p>;
  }

  const memberships = session?.memberships ?? [];

  async function selectCompany(companyId: string) {
    await update({ activeCompanyId: companyId });
    router.push("/app");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-950 px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={tr.common.appName} className="h-16 w-auto" />
      <p className="mb-6 mt-2 text-sm text-white/70">{tr.common.tagline}</p>
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900">{tr.company.select}</h2>

        {memberships.length === 0 ? (
          <p className="text-sm text-gray-600">{tr.company.noMembership}</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">{tr.company.selectPrompt}</p>
            <ul className="space-y-2">
              {memberships.map((m) => (
                <li key={m.companyId}>
                  <button
                    onClick={() => selectCompany(m.companyId)}
                    className="w-full rounded-md border border-gray-300 px-4 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="font-medium text-gray-900">{m.companyName}</span>
                    <span className="ml-2 text-xs text-gray-500">{m.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
