import type { MembershipRole } from "@/lib/auth/rbac";
import type { DefaultSession } from "next-auth";

export interface SessionMembership {
  companyId: string;
  companyName: string;
  role: MembershipRole;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
    memberships: SessionMembership[];
    activeCompanyId: string | null;
    /** Oturumun açıldığı an (ms) — süper admin oturumunun kısa ömrü için. */
    loginAt: number;
  }

  interface User {
    id: string;
    isSuperAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    isSuperAdmin: boolean;
    memberships: SessionMembership[];
    activeCompanyId: string | null;
    loginAt: number;
  }
}
