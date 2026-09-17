"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tr } from "@/lib/i18n/tr";
import { Badge } from "@/components/ui/badge";
import type { MembershipRole } from "@/lib/auth/rbac";

export interface UserRow {
  kind: "member" | "invitation";
  id: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  isActive: boolean;
  expiresAt?: string;
}

const ROLE_OPTIONS: MembershipRole[] = ["OWNER", "ADMIN", "SALES", "ACCOUNTING", "VIEWER"];

export function UserList({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeRole(membershipId: string, role: MembershipRole) {
    setBusyId(membershipId);
    setError(null);
    const res = await fetch(`/api/users/${membershipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  async function toggleActive(membershipId: string, isActive: boolean) {
    setBusyId(membershipId);
    setError(null);
    const res = await fetch(`/api/users/${membershipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  async function cancelInvitation(invitationId: string) {
    setBusyId(invitationId);
    setError(null);
    const res = await fetch(`/api/users/invitations/${invitationId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? tr.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">{tr.users.email}</th>
            <th className="px-4 py-3">{tr.users.role}</th>
            <th className="px-4 py-3">{tr.users.status}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`}>
              <td className="px-4 py-3">
                <span className="font-medium text-gray-900">{row.name ?? row.email}</span>
                {row.name && <span className="ml-1 text-xs text-gray-400">({row.email})</span>}
              </td>
              <td className="px-4 py-3">
                {row.kind === "member" ? (
                  <select
                    value={row.role}
                    disabled={busyId === row.id}
                    onChange={(e) => changeRole(row.id, e.target.value as MembershipRole)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {tr.users.roleLabels[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-600">{tr.users.roleLabels[row.role]}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {row.kind === "invitation" ? (
                  <Badge color="amber">{tr.users.pending}</Badge>
                ) : row.isActive ? (
                  <Badge color="green">{tr.users.active}</Badge>
                ) : (
                  <Badge color="gray">{tr.users.inactive}</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {row.kind === "invitation" ? (
                  <button onClick={() => cancelInvitation(row.id)} disabled={busyId === row.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                    {tr.customer.delete}
                  </button>
                ) : (
                  <button
                    onClick={() => toggleActive(row.id, !row.isActive)}
                    disabled={busyId === row.id}
                    className="text-xs text-gray-600 hover:underline disabled:opacity-50"
                  >
                    {row.isActive ? tr.users.deactivate : tr.users.reactivate}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
