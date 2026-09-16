"use client";

import { signOut } from "next-auth/react";
import { tr } from "@/lib/i18n/tr";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/giris" })}
      className="text-sm text-brand-200 hover:text-white"
    >
      {tr.auth.logout}
    </button>
  );
}
