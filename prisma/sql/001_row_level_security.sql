-- Row-Level Security (RLS) politikaları — çok-kiracılı izolasyonun veritabanı seviyesindeki
-- son savunma hattı (bkz. docs/v1-isterler-dokumani.md §3, §9; .claude/agents/db-schema-architect.md).
--
-- BU DOSYA REFERANSTIR — gerçek migration geçmişi prisma/migrations/ altındadır:
--   20260914135705_init                 (tablolar + ilk RLS politikaları)
--   20260914151110_fix_rls_null_guard   (bu dosyadaki güncel/doğru hali — bkz. aşağıdaki not)
-- Yeni bir ortamda sıfırdan kuruyorsanız `prisma migrate deploy` bu iki migration'ı da
-- sırayla uygular; bu dosyayı ayrıca elle çalıştırmanıza gerek YOKTUR. Bu dosya yalnızca
-- "RLS şu an nasıl çalışıyor" sorusuna tek bakışta cevap vermek için referans amaçlıdır.
--
-- ÖNEMLİ ÇALIŞMA ZAMANI KURALI: uygulama, Neon'un sahip (owner) rolüyle DEĞİL, bu
-- politikalara gerçekten tabi (NOBYPASSRLS) `app_user` rolüyle bağlanır — bkz.
-- scripts/setup-app-role.ts, src/lib/db/prisma.ts, APP_DATABASE_URL. Neon'un varsayılan
-- sahip rolü BYPASSRLS özniteliğine sahiptir ve bununla bağlanmak RLS'i sessizce atlar
-- (bu ortamda gerçek bir Neon veritabanına karşı test edilirken keşfedildi).
--
-- Oturum bağlamı (tenant context) her istekte uygulama katmanından set edilir:
--   SELECT set_config('app.current_company_id', $1, true);  -- $1: aktif şirketin UUID'si
--   SELECT set_config('app.bypass_rls', 'off', true);       -- yalnızca platform/süper admin
-- Bkz. src/lib/db/tenant-context.ts — bu iki ayar transaction/connection bazında set edilir,
-- ASLA global olarak set edilmez (connection pooling ile sızıntı riskine karşı).
--
-- Önemli: RLS tek başına yeterli görülmez — her sorgu uygulama katmanında da company_id ile
-- filtrelenir (savunma derinliği). Aşağıdaki `FORCE ROW LEVEL SECURITY`, tablo sahibi
-- (migration'ları çalıştıran DB kullanıcısı) dahil kimsenin bu kuralı atlayamamasını sağlar;
-- yalnızca `app.bypass_rls = 'on'` set edildiğinde (yalnızca platform/süper admin kod
-- yollarında) çapraz-şirket okuma/yazma mümkün olur ve bu her zaman audit_logs'a
-- `is_super_admin_access = true` ile kaydedilir (bkz. PF-07).
--
-- Neden yardımcı fonksiyon (app_current_company_id/app_bypass_rls)? Bir bağlantıda bu
-- özel GUC'lar en az bir kez `set_config(..., true)` ile ayarlandıktan sonra, transaction
-- bitince NULL'a değil BOŞ DİZGEYE ('') döner (Postgres'in placeholder GUC davranışı).
-- `''::uuid` hata verir. `NULLIF(value, '')` bunu güvenli hale getirir; bu mantık iki
-- fonksiyonda merkezileştirilmiştir (tekrar tekrar yazılmaz, tek yerden düzeltilir).

CREATE OR REPLACE FUNCTION app_current_company_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean AS $$
  SELECT current_setting('app.bypass_rls', true) = 'on'
$$ LANGUAGE sql STABLE;

-- =========================================================
-- Pattern A: company_id kolonu doğrudan tabloda olan tablolar
-- =========================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'memberships',
    'invitation_tokens',
    'customer_sources',
    'customers',
    'contacts',
    'activities',
    'tags',
    'products',
    'quotes',
    'orders',
    'payments',
    'accounts',
    'expenses',
    'expense_categories',
    'attachments',
    'notifications',
    'document_sequences'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (company_id = app_current_company_id() OR app_bypass_rls())
         WITH CHECK (company_id = app_current_company_id() OR app_bypass_rls())',
      tbl
    );
  END LOOP;
END $$;

-- =========================================================
-- Pattern B: company_id'si olmayan, üst kayıttan miras alan satır tabloları
-- (join/line-item tabloları — ekstra bir kolon eklemek yerine subquery ile korunur)
-- =========================================================

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON customer_tags;
CREATE POLICY tenant_isolation ON customer_tags
  USING (
    app_bypass_rls()
    OR customer_id IN (SELECT id FROM customers WHERE company_id = app_current_company_id())
  );

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON quote_items;
CREATE POLICY tenant_isolation ON quote_items
  USING (
    app_bypass_rls()
    OR quote_id IN (SELECT id FROM quotes WHERE company_id = app_current_company_id())
  );

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON order_items;
CREATE POLICY tenant_isolation ON order_items
  USING (
    app_bypass_rls()
    OR order_id IN (SELECT id FROM orders WHERE company_id = app_current_company_id())
  );

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payment_schedules;
CREATE POLICY tenant_isolation ON payment_schedules
  USING (
    app_bypass_rls()
    OR order_id IN (SELECT id FROM orders WHERE company_id = app_current_company_id())
  );

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payment_allocations;
CREATE POLICY tenant_isolation ON payment_allocations
  USING (
    app_bypass_rls()
    OR payment_id IN (SELECT id FROM payments WHERE company_id = app_current_company_id())
  );

-- =========================================================
-- Pattern C: companies — company_id değil, `id` üzerinden korunur
-- =========================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON companies;
CREATE POLICY tenant_isolation ON companies
  USING (id = app_current_company_id() OR app_bypass_rls())
  WITH CHECK (id = app_current_company_id() OR app_bypass_rls());

-- =========================================================
-- Pattern D: audit_logs — company_id NULL olabilir (henüz şirkete bağlanmamış kimlik
-- olayları: login/login_failed/logout, ve süper admin platform olayları)
-- =========================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (company_id = app_current_company_id() OR company_id IS NULL OR app_bypass_rls())
  WITH CHECK (company_id = app_current_company_id() OR company_id IS NULL OR app_bypass_rls());

-- Not: `plans`, `users`, `password_reset_tokens` şirket bazlı değildir, bu yüzden
-- tenant RLS uygulanmaz. `users`/`password_reset_tokens` uygulama katmanında yalnızca
-- oturum sahibinin kendi kaydına erişimiyle korunur; `plans` herkese okunur, yazması
-- yalnızca süper admin koduna açıktır (uygulama katmanı yetkisiyle).
