-- `prisma migrate dev` şema diff'i RLS politikalarını (Postgres-özel, schema.prisma'da
-- ifade edilemeyen bir kavram) otomatik EKLEMEZ — önceki elle yazılmış migration'larla
-- (bkz. 20260924100000_add_modules_entitlements, 20260928090000_add_purchasing_stock)
-- AYNI "Pattern A" burada elle uygulanır. payroll_run_items KASITLI OLARAK dışarıda
-- bırakıldı: company_id taşımıyor (purchase_order_items ile aynı desen), koruması üst
-- kaydın (payroll_runs) servis katmanında join edilmesiyle sağlanıyor.

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['employees', 'leave_requests', 'payroll_runs', 'tax_obligations'] LOOP
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON employees, leave_requests, payroll_runs, payroll_run_items, tax_obligations TO app_user;
  END IF;
END $$;
