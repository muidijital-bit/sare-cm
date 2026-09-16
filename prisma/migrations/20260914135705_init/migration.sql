-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'SALES', 'ACCOUNTING', 'VIEWER');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('POTENTIAL', 'ACTIVE', 'PASSIVE', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PHONE', 'EMAIL', 'VISIT', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'PREPARING', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'CHECK');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ROLE_CHANGE', 'USER_INVITE', 'USER_DEACTIVATE', 'EXPORT', 'SUPERADMIN_ACCESS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ACTIVITY_REMINDER', 'ORDER_DUE', 'QUOTE_EXPIRING', 'PAYMENT_OVERDUE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTE', 'ORDER');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_customers" INTEGER NOT NULL,
    "max_storage_mb" INTEGER NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'TRIAL',
    "plan_id" UUID NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "subscription_ends_at" TIMESTAMP(3),
    "tax_office" TEXT,
    "tax_number" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "logo_url" TEXT,
    "default_vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "quote_validity_days" INTEGER NOT NULL DEFAULT 15,
    "quote_number_format" TEXT NOT NULL DEFAULT 'TKF-{yil}-{sira}',
    "order_number_format" TEXT NOT NULL DEFAULT 'SIP-{yil}-{sira}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_tokens" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sources" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customer_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "CustomerType" NOT NULL,
    "title" TEXT NOT NULL,
    "tax_office" TEXT,
    "tax_number" TEXT,
    "address" TEXT,
    "source_id" UUID,
    "status" "CustomerStatus" NOT NULL DEFAULT 'POTENTIAL',
    "owner_user_id" UUID,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "customer_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("customer_id","tag_id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "contact_id" UUID,
    "type" "ActivityType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "next_action" TEXT,
    "remind_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "list_price" DECIMAL(18,4) NOT NULL,
    "default_cost" DECIMAL(18,4),
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "contact_id" UUID,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "exchange_rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "document_discount_type" "DiscountType",
    "document_discount_value" DECIMAL(18,4),
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vat_total" DECIMAL(18,4) NOT NULL,
    "grand_total" DECIMAL(18,4) NOT NULL,
    "parent_quote_id" UUID,
    "revision_number" INTEGER NOT NULL DEFAULT 1,
    "owner_user_id" UUID NOT NULL,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "product_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "unit_price" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4),
    "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discount_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "line_total" DECIMAL(18,4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "quote_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "order_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "delivery_address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "exchange_rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "document_discount_type" "DiscountType",
    "document_discount_value" DECIMAL(18,4),
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vat_total" DECIMAL(18,4) NOT NULL,
    "grand_total" DECIMAL(18,4) NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "note" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" UUID,
    "cancel_reason" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "unit_price" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4),
    "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discount_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "line_total" DECIMAL(18,4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "description" TEXT,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "spent_at" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "vat_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vendor" TEXT,
    "method" "PaymentMethod",
    "account_id" UUID,
    "note" TEXT,
    "recurring_rule" TEXT,
    "is_recurring_template" BOOLEAN NOT NULL DEFAULT false,
    "parent_expense_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "changes" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "is_super_admin_access" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "doc_type" "DocumentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_company_id_idx" ON "memberships"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_company_id_key" ON "memberships"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokens_token_key" ON "invitation_tokens"("token");

-- CreateIndex
CREATE INDEX "invitation_tokens_company_id_idx" ON "invitation_tokens"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sources_company_id_name_key" ON "customer_sources"("company_id", "name");

-- CreateIndex
CREATE INDEX "customers_company_id_status_idx" ON "customers"("company_id", "status");

-- CreateIndex
CREATE INDEX "customers_company_id_owner_user_id_idx" ON "customers"("company_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "contacts_company_id_customer_id_idx" ON "contacts"("company_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_company_id_name_key" ON "tags"("company_id", "name");

-- CreateIndex
CREATE INDEX "activities_company_id_customer_id_idx" ON "activities"("company_id", "customer_id");

-- CreateIndex
CREATE INDEX "activities_company_id_remind_at_idx" ON "activities"("company_id", "remind_at");

-- CreateIndex
CREATE INDEX "products_company_id_is_active_idx" ON "products"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "quotes_company_id_status_idx" ON "quotes"("company_id", "status");

-- CreateIndex
CREATE INDEX "quotes_company_id_owner_user_id_idx" ON "quotes"("company_id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_company_id_number_key" ON "quotes"("company_id", "number");

-- CreateIndex
CREATE INDEX "quote_items_quote_id_idx" ON "quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "orders_company_id_status_idx" ON "orders"("company_id", "status");

-- CreateIndex
CREATE INDEX "orders_company_id_owner_user_id_idx" ON "orders"("company_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "orders_company_id_due_date_idx" ON "orders"("company_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "orders_company_id_number_key" ON "orders"("company_id", "number");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "payment_schedules_order_id_idx" ON "payment_schedules"("order_id");

-- CreateIndex
CREATE INDEX "payments_company_id_customer_id_idx" ON "payments"("company_id", "customer_id");

-- CreateIndex
CREATE INDEX "payments_company_id_paid_at_idx" ON "payments"("company_id", "paid_at");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_order_id_idx" ON "payment_allocations"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_company_id_name_key" ON "expense_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "expenses_company_id_spent_at_idx" ON "expenses"("company_id", "spent_at");

-- CreateIndex
CREATE INDEX "expenses_company_id_category_id_idx" ON "expenses"("company_id", "category_id");

-- CreateIndex
CREATE INDEX "attachments_company_id_entity_type_entity_id_idx" ON "attachments"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_entity_type_entity_id_idx" ON "audit_logs"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_company_id_user_id_read_at_idx" ON "notifications"("company_id", "user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_company_id_doc_type_year_key" ON "document_sequences"("company_id", "doc_type", "year");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_sources" ADD CONSTRAINT "customer_sources_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "customer_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_quote_id_fkey" FOREIGN KEY ("parent_quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_parent_expense_id_fkey" FOREIGN KEY ("parent_expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================
-- Row-Level Security (bkz. prisma/sql/001_row_level_security.sql)
-- =========================================================

-- Row-Level Security (RLS) politikaları — çok-kiracılı izolasyonun veritabanı seviyesindeki
-- son savunma hattı (bkz. docs/v1-isterler-dokumani.md §3, §9; .claude/agents/db-schema-architect.md).
--
-- Bu dosya `prisma migrate dev` ile OTOMATİK OLUŞTURULMAZ (Prisma RLS'i şema dilinde ifade
-- edemez). İlk migration oluşturulduktan sonra bu dosyanın içeriği ilgili migration.sql
-- dosyasının sonuna eklenir, ya da ayrı bir "boş" migration içine
-- (`npx prisma migrate dev --create-only --name row_level_security`) kopyalanır.
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
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (
           company_id = current_setting(''app.current_company_id'', true)::uuid
           OR current_setting(''app.bypass_rls'', true) = ''on''
         )
         WITH CHECK (
           company_id = current_setting(''app.current_company_id'', true)::uuid
           OR current_setting(''app.bypass_rls'', true) = ''on''
         )',
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
CREATE POLICY tenant_isolation ON customer_tags
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR customer_id IN (
      SELECT id FROM customers
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quote_items
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR quote_id IN (
      SELECT id FROM quotes
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR order_id IN (
      SELECT id FROM orders
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_schedules
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR order_id IN (
      SELECT id FROM orders
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_allocations
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR payment_id IN (
      SELECT id FROM payments
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
  );

-- =========================================================
-- Pattern C: companies — company_id değil, `id` üzerinden korunur
-- =========================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON companies
  USING (
    id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- =========================================================
-- Pattern D: audit_logs — company_id NULL olabilir (henüz şirkete bağlanmamış kimlik
-- olayları: login/login_failed/logout, ve süper admin platform olayları)
-- =========================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR company_id IS NULL
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR company_id IS NULL
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Not: `plans`, `users`, `password_reset_tokens` şirket bazlı değildir, bu yüzden
-- tenant RLS uygulanmaz. `users`/`password_reset_tokens` uygulama katmanında yalnızca
-- oturum sahibinin kendi kaydına erişimiyle korunur; `plans` herkese okunur, yazması
-- yalnızca süper admin koduna açıktır (uygulama katmanı yetkisiyle).
