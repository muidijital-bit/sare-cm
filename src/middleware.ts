import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Route koruması — §3/§PF-08.
 *
 * - `/platform/**`  → yalnızca isSuperAdmin=true (2FA doğrulaması route/layout seviyesinde
 *   ayrıca yapılır, bkz. src/lib/auth/session.ts getSuperAdminSession TODO notu).
 * - `/app/**`       → oturum açmış herhangi bir kullanıcı; aktif şirket seçimi olmayan
 *   kullanıcı şirket seçim ekranına yönlendirilir.
 * - `/giris`, `/api/auth/**` → herkese açık.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (pathname.startsWith("/platform") && !token?.isSuperAdmin) {
      return NextResponse.redirect(new URL("/giris", req.url));
    }

    if (pathname.startsWith("/app") && !token?.activeCompanyId && !pathname.startsWith("/app/sirket-sec")) {
      return NextResponse.redirect(new URL("/app/sirket-sec", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/giris",
    },
  },
);

export const config = {
  matcher: ["/app/:path*", "/platform/:path*"],
};
