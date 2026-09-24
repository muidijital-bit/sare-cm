-- Modül / paket / şirket-özel lisans (entitlement) altyapısı. Yalnızca EKLEMELİ:
-- mevcut tablo ve veriye dokunmaz (plans'a null'lanabilir kolonlar eklenir).

ALTER TABLE "plans" ADD COLUMN "yearly_price" DECIMAL(18,4),
ADD COLUMN "description" TEXT;

CREATE TABLE "app_modules" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_modules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_modules_key_key" ON "app_modules"("key");

CREATE TABLE "plan_modules" (
    "plan_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("plan_id","module_id")
);
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "app_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "company_modules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_modules_company_id_module_id_key" ON "company_modules"("company_id","module_id");
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "app_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: company_modules şirket bazlıdır (diğer kiracı tabloları gibi). Şirket kendi satırlarını
-- okur; yazma yalnızca platform kod yollarında (app.bypass_rls='on') yapılır.
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_modules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON company_modules FOR SELECT
  USING (company_id = app_current_company_id() OR app_bypass_rls());
CREATE POLICY platform_write ON company_modules FOR ALL
  USING (app_bypass_rls()) WITH CHECK (app_bypass_rls());

-- app_user rolü (uygulama bağlantısı) yeni tablolara erişebilsin.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app_modules, plan_modules, company_modules TO app_user;
  END IF;
END $$;
