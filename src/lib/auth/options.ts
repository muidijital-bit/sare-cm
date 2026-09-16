import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { withPlatformBypass } from "@/lib/db/tenant-context";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionMembership } from "@/types/next-auth";

/** §KY-06 Ardışık 5 başarısız girişte geçici kilitleme */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 dakika

const GENERIC_ERROR = "E-posta veya şifre hatalı.";

/**
 * Bir kullanıcının üye olduğu TÜM şirketleri bulmak, doğası gereği tek bir şirket
 * bağlamına sığmayan bir sorgudur (aktif şirket henüz seçilmemişken bile çalışmalı).
 * `memberships` tablosu RLS'e tabi olduğundan (bkz. prisma/sql/001_row_level_security.sql),
 * bağlam set edilmeden yapılan düz bir sorgu HER ZAMAN boş döner — bu yüzden bilinçli
 * olarak `withPlatformBypass` kullanılır (giriş sırasında "kendi üyeliklerini görme"
 * meşru bir çapraz-şirket okumadır, aksi halde hiç kimse giriş yapamaz).
 */
async function loadMemberships(userId: string): Promise<SessionMembership[]> {
  const memberships = await withPlatformBypass((tx) =>
    tx.membership.findMany({
      where: { userId, isActive: true, company: { deletedAt: null } },
      include: { company: { select: { id: true, name: true } } },
    }),
  );
  return memberships.map((m) => ({
    companyId: m.companyId,
    companyName: m.company.name,
    role: m.role,
  }));
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // §KY-07 "beni hatırla" varsayılanı — bkz. not aşağıda
  pages: {
    signIn: "/giris",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error(GENERIC_ERROR);
        }
        const email = credentials.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
          throw new Error(GENERIC_ERROR);
        }

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          const dakika = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
          throw new Error(`Çok fazla başarısız deneme. ${dakika} dakika sonra tekrar deneyin.`);
        }

        const valid = await verifyPassword(credentials.password, user.passwordHash);

        if (!valid) {
          const failedLoginCount = user.failedLoginCount + 1;
          const lockedUntil =
            failedLoginCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;

          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: user.id },
              data: {
                failedLoginCount: lockedUntil ? 0 : failedLoginCount,
                lockedUntil,
              },
            });
            await tx.auditLog.create({
              data: { companyId: null, userId: user.id, action: "LOGIN_FAILED" },
            });
          });

          throw new Error(GENERIC_ERROR);
        }

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
          });
          await tx.auditLog.create({
            data: { companyId: null, userId: user.id, action: "LOGIN" },
          });
        });

        return { id: user.id, email: user.email, name: user.name, isSuperAdmin: user.isSuperAdmin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.isSuperAdmin = user.isSuperAdmin;
        const memberships = await loadMemberships(user.id);
        token.memberships = memberships;
        // Varsayılan aktif şirket: tek üyelik varsa otomatik seçilir; birden fazlaysa
        // kullanıcı arayüzdeki şirket seçiciden seçmelidir (bkz. §3).
        token.activeCompanyId = memberships.length === 1 ? memberships[0].companyId : null;
      }

      // Şirket seçici `update({ activeCompanyId })` çağırdığında buraya düşer.
      // Client'tan gelen değer KÖRÜ KÖRÜNE güvenilmez: yalnızca token'daki mevcut
      // üyelik listesinde varsa kabul edilir. Sunucu tarafı her istekte AYRICA
      // veritabanından yeniden doğrular (bkz. src/lib/auth/session.ts getTenantSession).
      if (trigger === "update" && session?.activeCompanyId) {
        const found = token.memberships?.some((m) => m.companyId === session.activeCompanyId);
        if (found) {
          token.activeCompanyId = session.activeCompanyId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.isSuperAdmin = token.isSuperAdmin;
      session.memberships = token.memberships ?? [];
      session.activeCompanyId = token.activeCompanyId ?? null;
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.userId) {
        await prisma.auditLog.create({
          data: { companyId: null, userId: token.userId as string, action: "LOGOUT" },
        });
      }
    },
  },
};

// Not (§KY-07): "beni hatırla" işaretlenmezse istemci tarafında daha kısa bir oturum
// süresi kullanılabilir (örn. sekme kapanınca sonlanan bir cookie); bu, `authorize`'a
// geçirilen credentials'daki bir `rememberMe` alanına göre `maxAge`'i dinamikleştirmeyi
// gerektirir ve frontend-ui-dev + bu dosya birlikte genişletilerek eklenir. "Aktif
// oturumları görüp sonlandırma" (KY-07) için JWT stratejisi yerine veritabanı
// oturumlarına (next-auth Prisma adapter, `session` tablosu) geçilmesi gerekir —
// V1.5 kapsamında değerlendirilmesi önerilir; bkz. açık madde.
