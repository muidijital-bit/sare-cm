import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route koruması — §3/§PF-08 — ve alan adına (host) göre ayrım.
 *
 * Alan adı ayrımı (yalnızca ortam değişkenleri tanımlıysa; yerelde/önizlemede tanımsızsa kapalı):
 * - APP_HOSTNAME       (örn. app.muiflow.com)      → müşteri uygulaması; /platform ERİŞİLEMEZ (404).
 * - PLATFORM_HOSTNAME  (örn. platform.muiflow.com) → yalnızca yönetim paneli (+ giriş ve API);
 *                                                     /app ERİŞİLEMEZ, `/` → /platform.
 * Değerler `host` başlığıyla birebir karşılaştırılır (yerelde port dahil: app.localhost:3000).
 *
 * Kimlik koruması:
 * - `/platform/**`  → yalnızca isSuperAdmin=true (2FA doğrulaması route/layout seviyesinde
 *   ayrıca yapılır, bkz. src/lib/auth/session.ts getSuperAdminSession).
 * - `/app/**`       → oturum açmış herhangi bir kullanıcı; aktif şirket seçimi olmayan
 *   kullanıcı şirket seçim ekranına yönlendirilir.
 * - `/giris`, `/api/auth/**` ve diğer sayfalar → herkese açık.
 */
const APP_HOST = process.env.APP_HOSTNAME?.toLowerCase();
const PLATFORM_HOST = process.env.PLATFORM_HOSTNAME?.toLowerCase();

function notFound(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/404";
  return NextResponse.rewrite(url, { status: 404 });
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const host = (req.headers.get("host") ?? "").toLowerCase();
    const token = req.nextauth.token;

    // --- Alan adına göre ayrım ---
    if (PLATFORM_HOST && host === PLATFORM_HOST) {
      if (pathname === "/") return NextResponse.redirect(new URL("/platform", req.url));
      if (pathname.startsWith("/app")) return NextResponse.redirect(new URL("/platform", req.url));
    }
    if (APP_HOST && host === APP_HOST && pathname.startsWith("/platform")) {
      return notFound(req);
    }

    // --- Kimlik/yetki ---
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
      // Yalnızca /app ve /platform oturum ister; diğer yollar (/, /giris, ...) herkese açık.
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Müşteri alan adında /platform'un varlığı hiç belli edilmez: girişsiz de 404 (middleware'e düşsün).
        const host = (req.headers.get("host") ?? "").toLowerCase();
        if (APP_HOST && host === APP_HOST && pathname.startsWith("/platform")) return true;
        if (pathname.startsWith("/app") || pathname.startsWith("/platform")) return !!token;
        return true;
      },
    },
    pages: {
      signIn: "/giris",
    },
  },
);

export const config = {
  // API, statik dosya ve görseller hariç her yol (alan adı ayrımı `/` dahil hepsinde çalışsın).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|muiflow-|login-bg/).*)"],
};
