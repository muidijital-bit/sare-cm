# Sare CM — Çok Şirketli CRM & Satış Yönetimi Platformu

İsterler dokümanı: [`docs/v1-isterler-dokumani.md`](docs/v1-isterler-dokumani.md)

## Teknoloji Yığını

- **Next.js 13.5** (App Router) + TypeScript + Tailwind CSS
- **PostgreSQL (Neon)** + **Prisma ORM** — çok-kiracılı izolasyon, Row-Level Security (RLS)
- **NextAuth v4** (credentials + JWT) — kimlik doğrulama ve çok-şirketli oturum yönetimi
- **Vitest** — test altyapısı

> **Node sürümü notu:** Bu proje şu anki geliştirme makinesinde Node 16.15 ile
> çalışacak şekilde kuruldu (Next 13.5.11, Node 16.14+ destekler). Node 18.18+ veya
> 20 LTS'e geçildiğinde Next.js 14/15'e ve daha yeni araç sürümlerine yükseltmek
> sorunsuz olur — o zamana kadar bu sürümlerde kalın.

## Klasör Yapısı

```
docs/                    İsterler dokümanı
.claude/agents/          Bu proje için tanımlı uzman subagent'lar
prisma/schema.prisma     Veritabanı şeması (§8)
prisma/sql/              Güncel RLS politikalarının referans kopyası (bkz. o dosyanın başlığı)
prisma/migrations/       Gerçek migration geçmişi (init + RLS düzeltmesi)
prisma/seed.ts           Geliştirme başlangıç verisi
scripts/setup-app-role.ts  En-az-ayrıcalıklı `app_user` DB rolünü oluşturan tek seferlik betik
scripts/verify-infra.ts    RLS izolasyonu + şifre + RBAC'ı canlı DB'ye karşı doğrulayan betik
src/app/                 Next.js sayfaları (App Router)
  giris/                 Giriş ekranı
  app/                   Şirket içi uygulama (aktif şirket bağlamı gerektirir)
  platform/              Süper admin paneli
  api/auth/              NextAuth route handler
src/lib/auth/            RBAC matrisi (§4), NextAuth config, şifre/oturum yardımcıları
src/lib/db/              Prisma client + tenant-context (RLS oturum değişkenleri)
src/lib/audit/           İşlem geçmişi (audit log) yardımcıları (§5.10)
src/lib/modules/         Modül bazlı iş mantığı (örn. belge numaralandırma)
src/lib/i18n/            Türkçe metin sözlüğü
src/middleware.ts        Route koruması (/app, /platform)
```

## Kurulum

### 1. Veritabanı (Neon)

[Neon](https://neon.tech) üzerinde ücretsiz bir proje açılıp bağlantı zaten kuruldu.
Sıfırdan bir ortam kuruyorsanız:

1. neon.tech'te proje oluşturun, **pooled connection string**'i kopyalayın.
2. `.env.example` dosyasını `.env` olarak kopyalayıp `DATABASE_URL`'e yapıştırın (bu, Neon'un
   **sahip** rolüdür — yalnızca migration/admin betikleri için kullanılır).
3. `npm run db:migrate:deploy` ile şemayı ve RLS politikalarını kurun.
4. `npx tsx scripts/setup-app-role.ts` çalıştırın — RLS'e gerçekten tabi, en-az-ayrıcalıklı
   `app_user` rolünü oluşturur ve bağlantı bilgisini konsola yazar.
5. Yazdırılan bilgiyi `.env`'deki `APP_DATABASE_URL`'e yapıştırın.

> ⚠️ **Neden iki ayrı rol/URL var?** Neon'un varsayılan sahip rolü (`neondb_owner`)
> `BYPASSRLS` özniteliğine sahiptir — bununla bağlanmak `FORCE ROW LEVEL SECURITY` dahil
> TÜM RLS politikalarını sessizce atlar. Bu, gerçek bir Neon veritabanına karşı test
> edilirken keşfedildi ve düzeltildi (bkz. aşağıdaki "Doğrulanan adımlar"). Uygulama
> çalışma zamanı (`src/lib/db/prisma.ts`) her zaman `APP_DATABASE_URL`'i kullanır.

### 2. Ortam değişkenleri

```bash
cp .env.example .env
# NEXTAUTH_SECRET için: openssl rand -base64 32
```

### 3. Bağımlılıklar

```bash
npm install
```

> Not: Bu makinede `~/.npmrc` bu projeyle ilgisiz bir kurumsal registry/proxy'ye
> işaret ediyor olabilir. Gerekirse proje kökündeki `.npmrc` (herkese açık npm
> registry'sine sabitler) kullanılır; global `~/.npmrc` değiştirilmedi.

### 4. Şema, RLS ve seed

```bash
npm run db:generate         # Prisma Client üretir
npm run db:migrate:deploy   # Tabloları + RLS politikalarını kurar (bkz. yukarıdaki adım 1.3-1.5)
npm run db:seed             # Demo şirket + sahip kullanıcı oluşturur
```

Seed sonrası giriş: `sahip@demo.test` / `DemoSifre#2026`

### 5. Geliştirme sunucusu

```bash
npm run dev
```

## Doğrulanan adımlar (canlı Neon veritabanına karşı, bu oturumda)

- ✅ `npx prisma validate` / `migrate deploy` — şema ve migration'lar geçerli, canlıda uygulandı
- ✅ `npx tsc --noEmit`, `npx next lint`, `npx next build` — hepsi temiz
- ✅ `npm run db:seed` — demo şirket/kullanıcı canlı DB'de oluşturuldu
- ✅ `npx tsx scripts/verify-infra.ts` — **canlı DB'ye karşı** şu senaryolar doğrulandı:
  - Şifre hash/doğrulama (bcrypt) doğru çalışıyor
  - **RLS izolasyonu**: Şirket A, Şirket B'nin kaydını listede GÖRMÜYOR; `company_id`'yi
    açıkça belirterek dahi erişemiyor
  - RBAC matrisi (§4) — rol × modül × kapsam kombinasyonları beklendiği gibi

**Yol boyunca bulunup düzeltilen 2 gerçek hata** (şeffaflık için not düşülüyor):

1. Neon'un sahip rolü `BYPASSRLS` taşıyor — tüm RLS'i sessizce atlıyordu. Çözüm: ayrı
   `app_user` (NOBYPASSRLS) rolü + `APP_DATABASE_URL` (bkz. yukarıdaki kurulum notu).
2. `current_setting('app.current_company_id', true)::uuid` ifadesi, bir bağlantıda bu
   GUC bir kez set edildikten sonra sıfırlandığında NULL değil boş dizge (`''`) dönüyor
   ve cast hata veriyordu. Çözüm: `NULLIF(value, '')` içeren `app_current_company_id()`
   yardımcı fonksiyonu (bkz. `prisma/migrations/20260914151110_fix_rls_null_guard`).

## Uzman Subagent'lar

`.claude/agents/` altında bu proje için tanımlanmış 5 uzman subagent var:

- `db-schema-architect` — şema, migration, RLS
- `auth-tenant-security` — kimlik, çok-şirketli oturum, RBAC, audit log
- `api-backend-dev` — Route Handler'lar, durum makineleri, iş mantığı
- `frontend-ui-dev` — sayfalar, bileşenler, TR yerelleştirme
- `qa-tenant-isolation` — izolasyon/yetki/finansal doğruluk testleri

Claude Code içinde bu isimlerle otomatik olarak devreye girerler; ilgili modülde
çalışırken hangi agent'ın devrede olduğunu görebilirsiniz.
