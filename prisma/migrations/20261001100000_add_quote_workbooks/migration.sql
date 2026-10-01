-- CreateEnum
CREATE TYPE "QuoteWorkbookKind" AS ENUM ('TEMPLATE', 'QUOTE');

-- CreateTable
CREATE TABLE "quote_workbooks" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "kind" "QuoteWorkbookKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "customer_id" UUID,
    "source_template_id" UUID,
    "converted_quote_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quote_workbooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_workbooks_company_id_kind_idx" ON "quote_workbooks"("company_id", "kind");

-- AddForeignKey
ALTER TABLE "quote_workbooks" ADD CONSTRAINT "quote_workbooks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_workbooks" ADD CONSTRAINT "quote_workbooks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (elle — migrate diff üretmez); tabloyu oluşturan migration'ın içinde (bkz. 20260929120000_add_projects).
ALTER TABLE "quote_workbooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_workbooks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "quote_workbooks";
CREATE POLICY tenant_isolation ON "quote_workbooks"
  USING (company_id = app_current_company_id() OR app_bypass_rls())
  WITH CHECK (company_id = app_current_company_id() OR app_bypass_rls());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_workbooks" TO app_user;
  END IF;
END $$;
