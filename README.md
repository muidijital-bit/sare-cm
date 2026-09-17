# Sare CM — Çok Şirketli CRM & Satış Yönetimi Platformu

İsterler dokümanı: [`docs/v1-isterler-dokumani.md`](docs/v1-isterler-dokumani.md)

## Teknoloji Yığını

- **Next.js 13.5** (App Router) + TypeScript + Tailwind CSS
- **PostgreSQL (Neon)** + **Prisma ORM** — çok-kiracılı izolasyon, Row-Level Security (RLS)
- **NextAuth v4** (credentials + JWT) — kimlik doğrulama ve çok-şirketli oturum yönetimi

> **Node sürümü notu:** Bu proje Node 16.15 ile çalışacak şekilde kuruldu (Next 13.5.11,
> Node 16.14+ destekler). Node 18.18+/20 LTS'e geçildiğinde Next 14/15'e yükseltmek sorunsuz olur.

## Modüller (V1 durumu)

| Modül | Durum |
|---|---|
| Giriş / RBAC / çok-şirketli oturum | ✅ |
| Müşteri/CRM (kayıt, kişi, kaynak, görüşme+hatırlatma, MC-10 bakiye) | ✅ |
| Teklif (durum makinesi, revizyon, tekliften sipariş) | ✅ |
| Sipariş (ödeme planı, durum ilerletme, iptal) | ✅ |
| Tahsilat (mahsuplaşma, kısmi/fazla ödeme, iade) | ✅ |
| Gider (kategori raporu, tekrarlayan gider) | ✅ |
| Dashboard (§7 metrikleri gerçek veriye bağlı) | ✅ |
| İşlem geçmişi (genel log + kayıt bazlı geçmiş) | ✅ |
| Şirket Ayarları (bilgiler, kaynak/kategori/hesap CRUD) | ✅ |
| Kullanıcı davet akışı (rol, son-Sahip koruması, paket limiti) | ✅ |
| Şifre sıfırlama | ✅ |
| Platform paneli (şirket/paket oluşturma, askıya alma) | ✅ |
| **Kapsam dışı / eksik** | Excel içe-dışa aktarma, dosya eki yükleme, e-posta gönderimi (davet/sıfırlama linkleri UI'da gösteriliyor), PF-05 (abonelik bitişi yaklaşanlar), PF-07 (destek erişimi), PF-08 (süper admin 2FA), gerçek deploy |

## Klasör Yapısı

```
docs/                    İsterler dokümanı
.claude/agents/          Bu proje için tanımlı uzman subagent'lar
prisma/schema.prisma     Veritabanı şeması (§8)
prisma/sql/              Güncel RLS politikalarının referans kopyası
prisma/migrations/       Migration geçmişi
prisma/seed.ts           Geliştirme başlangıç verisi (demo şirket + süper admin)
scripts/setup-app-role.ts  En-az-ayrıcalıklı `app_user` DB rolünü oluşturan tek seferlik betik
scripts/verify-*.ts        Canlı DB'ye karşı modül doğrulama betikleri (bkz. aşağı)
src/app/
  giris/, sifremi-unuttum/, sifre-sifirla/[token]/, davet/[token]/   Public sayfalar
  app/                   Şirket içi uygulama (müşteriler, teklifler, siparişler, tahsilatlar,
                          giderler, ayarlar, kullanıcılar, işlem-geçmişi)
  platform/              Süper admin paneli
src/lib/auth/            RBAC matrisi (§4), NextAuth config, şifre/oturum yardımcıları
src/lib/db/              Prisma client + tenant-context (RLS oturum değişkenleri)
src/lib/modules/         Modül bazlı iş mantığı (her modülün kendi service.ts'i)
src/lib/i18n/            Türkçe metin sözlüğü
src/middleware.ts        Route koruması (/app, /platform)
```

## Kurulum

### 1. Veritabanı (Neon)

[Neon](https://neon.tech) üzerinde proje zaten kuruldu. Sıfırdan kuruyorsanız:

1. neon.tech'te proje oluşturun, **pooled connection string**'i kopyalayın.
2. `.env.example` → `.env`, `DATABASE_URL`'e yapıştırın (Neon'un **sahip** rolü — yalnızca
   migration/admin betikleri için).
3. `npm run db:migrate:deploy` — şema + RLS politikalarını kurar.
4. `npx tsx scripts/setup-app-role.ts` — RLS'e gerçekten tabi `app_user` rolünü oluşturur.
5. Çıktıdaki bağlantıyı `.env`'deki `APP_DATABASE_URL`'e yapıştırın.

> ⚠️ Neon'un varsayılan sahip rolü `BYPASSRLS` taşır — bununla bağlanmak TÜM RLS'i sessizce
> atlar. Uygulama çalışma zamanı (`src/lib/db/prisma.ts`) her zaman `APP_DATABASE_URL`'i kullanır.

### 2. Ortam değişkenleri ve bağımlılıklar

```bash
cp .env.example .env   # NEXTAUTH_SECRET için: openssl rand -base64 32
npm install
```

> Not: Bu makinede `~/.npmrc` ilgisiz bir kurumsal registry/proxy'ye işaret ediyor olabilir;
> proje kökündeki `.npmrc` (genel npm registry'sine sabitler) bunu aşar.

### 3. Şema, RLS ve seed

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

**Seed sonrası girişler:**
- Şirket kullanıcısı: `sahip@demo.test` / `DemoSifre#2026` (Demo Şirket A.Ş., Sahip rolü)
- Platform (süper admin): `admin@platform.test` / `SuperAdmin#2026` → otomatik `/platform`'a yönlenir

### 4. Geliştirme sunucusu

```bash
npm run dev
```

## Doğrulama

Her modül canlı Neon veritabanına karşı yazılmış betiklerle doğrulanmıştır (toplam ~120 kontrol):

```bash
npx tsx scripts/verify-infra.ts               # RLS izolasyonu, şifre, RBAC
npx tsx scripts/verify-customers.ts            # Müşteri/CRM
npx tsx scripts/verify-sales-flow.ts           # Teklif → Sipariş → Tahsilat
npx tsx scripts/verify-expenses.ts             # Gider + tekrarlayan gider
npx tsx scripts/verify-dashboard.ts            # Dashboard metrikleri (§7)
npx tsx scripts/verify-audit-and-balance.ts    # İşlem geçmişi + MC-10 bakiye
npx tsx scripts/verify-company-settings.ts     # Şirket Ayarları
npx tsx scripts/verify-user-invite.ts          # Kullanıcı davet akışı
npx tsx scripts/verify-password-reset.ts       # Şifre sıfırlama
npx tsx scripts/verify-platform.ts             # Platform paneli
```

`npx tsc --noEmit`, `npx next lint`, `npx next build` her zaman temiz tutulur.

> Not: Bu geliştirme ortamından Neon'a bağlantı ara sıra (`P1017`, "server has closed the
> connection") kopabiliyor — bu ağ kaynaklı, koddan değil; script'i tekrar çalıştırmak yeterli.

**Yol boyunca bulunup düzeltilen 2 gerçek altyapı hatası** (şeffaflık için):
1. Neon sahip rolünün `BYPASSRLS` taşıması — ayrı `app_user` rolüyle çözüldü.
2. `current_setting()` boş-dizge/NULL tutarsızlığı — `NULLIF` içeren yardımcı fonksiyonla çözüldü
   (`prisma/migrations/20260914151110_fix_rls_null_guard`).

## Uzman Subagent'lar

`.claude/agents/` altında bu proje için tanımlanmış 5 uzman subagent var: `db-schema-architect`,
`auth-tenant-security`, `api-backend-dev`, `frontend-ui-dev`, `qa-tenant-isolation`. Claude Code
içinde bu isimlerle otomatik devreye girerler.
