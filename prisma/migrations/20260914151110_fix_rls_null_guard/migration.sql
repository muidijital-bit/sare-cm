-- Düzeltme: `current_setting('app.current_company_id', true)::uuid` ifadesi, bir
-- bağlantıda bu özel (custom) GUC en az bir kez `SET LOCAL`/`set_config(..., true)` ile
-- ayarlandıktan SONRA, o transaction bittiğinde NULL'a değil BOŞ DİZGEYE ('') döner —
-- bu, Postgres'in "placeholder" özel GUC'lar için bilinen bir davranışıdır. `''::uuid`
-- hata verir ("invalid input syntax for type uuid"). Bağlantı havuzlaması (Neon pooled
-- uç noktası) nedeniyle bir bağlantı farklı isteklerde/transaction'larda yeniden
-- kullanıldığında bu durum gerçek bir çalışma zamanı hatasına yol açar (doğrulandı:
-- scripts/verify-infra.ts, temizlik adımında bu hatayı üretti).
--
-- Çözüm: iki yardımcı fonksiyon üzerinden `NULLIF(value, '')` ile boş dizgeyi NULL'a
-- çevirip GÜVENLİ cast yapmak. Tüm politikalar bu fonksiyonları kullanacak şekilde
-- yeniden oluşturulur.

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
-- =========================================================

DROP POLICY IF EXISTS tenant_isolation ON customer_tags;
CREATE POLICY tenant_isolation ON customer_tags
  USING (
    app_bypass_rls()
    OR customer_id IN (SELECT id FROM customers WHERE company_id = app_current_company_id())
  );

DROP POLICY IF EXISTS tenant_isolation ON quote_items;
CREATE POLICY tenant_isolation ON quote_items
  USING (
    app_bypass_rls()
    OR quote_id IN (SELECT id FROM quotes WHERE company_id = app_current_company_id())
  );

DROP POLICY IF EXISTS tenant_isolation ON order_items;
CREATE POLICY tenant_isolation ON order_items
  USING (
    app_bypass_rls()
    OR order_id IN (SELECT id FROM orders WHERE company_id = app_current_company_id())
  );

DROP POLICY IF EXISTS tenant_isolation ON payment_schedules;
CREATE POLICY tenant_isolation ON payment_schedules
  USING (
    app_bypass_rls()
    OR order_id IN (SELECT id FROM orders WHERE company_id = app_current_company_id())
  );

DROP POLICY IF EXISTS tenant_isolation ON payment_allocations;
CREATE POLICY tenant_isolation ON payment_allocations
  USING (
    app_bypass_rls()
    OR payment_id IN (SELECT id FROM payments WHERE company_id = app_current_company_id())
  );

-- =========================================================
-- Pattern C: companies — company_id değil, `id` üzerinden korunur
-- =========================================================

DROP POLICY IF EXISTS tenant_isolation ON companies;
CREATE POLICY tenant_isolation ON companies
  USING (id = app_current_company_id() OR app_bypass_rls())
  WITH CHECK (id = app_current_company_id() OR app_bypass_rls());

-- =========================================================
-- Pattern D: audit_logs — company_id NULL olabilir
-- =========================================================

DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (company_id = app_current_company_id() OR company_id IS NULL OR app_bypass_rls())
  WITH CHECK (company_id = app_current_company_id() OR company_id IS NULL OR app_bypass_rls());
