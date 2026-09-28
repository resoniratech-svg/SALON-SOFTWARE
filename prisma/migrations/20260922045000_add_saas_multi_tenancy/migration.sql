-- CreateTable: tenants
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_code_key" ON "tenants"("code");

-- Insert Default Primary Tenant if not exists
INSERT INTO "tenants" ("id", "name", "code", "is_active", "created_at", "updated_at")
VALUES ('11111111-1111-1111-1111-111111111111', 'Primary Salon Tenant', 'primary-salon', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- DropIndex
DROP INDEX IF EXISTS "designations_name_key";
DROP INDEX IF EXISTS "disposables_barcode_key";
DROP INDEX IF EXISTS "disposables_category_name_key";
DROP INDEX IF EXISTS "disposables_code_key";
DROP INDEX IF EXISTS "product_categories_name_key";
DROP INDEX IF EXISTS "products_barcode_key";
DROP INDEX IF EXISTS "products_category_id_name_key";
DROP INDEX IF EXISTS "products_store_sku_key";
DROP INDEX IF EXISTS "service_categories_name_key";
DROP INDEX IF EXISTS "services_category_id_name_key";
DROP INDEX IF EXISTS "shifts_name_key";
DROP INDEX IF EXISTS "staff_joining_details_employee_number_key";

-- AlterTable with default backfill
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "disposables" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111';

-- Drop defaults
ALTER TABLE "designations" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "disposables" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "product_categories" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "service_categories" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "services" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "shifts" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "staff" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "designations_tenant_id_idx" ON "designations"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "designations_tenant_id_name_key" ON "designations"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "disposables_tenant_id_idx" ON "disposables"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "disposables_tenant_id_category_name_key" ON "disposables"("tenant_id", "category", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "disposables_tenant_id_barcode_key" ON "disposables"("tenant_id", "barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "disposables_tenant_id_code_key" ON "disposables"("tenant_id", "code");

CREATE INDEX IF NOT EXISTS "product_categories_tenant_id_idx" ON "product_categories"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_tenant_id_name_key" ON "product_categories"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON "products"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_category_id_name_key" ON "products"("tenant_id", "category_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_barcode_key" ON "products"("tenant_id", "barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_store_sku_key" ON "products"("tenant_id", "store_sku");

CREATE INDEX IF NOT EXISTS "service_categories_tenant_id_idx" ON "service_categories"("tenant_id");
CREATE INDEX IF NOT EXISTS "service_categories_name_idx" ON "service_categories"("name");
CREATE INDEX IF NOT EXISTS "service_categories_is_active_idx" ON "service_categories"("is_active");
CREATE INDEX IF NOT EXISTS "service_categories_position_idx" ON "service_categories"("position");
CREATE UNIQUE INDEX IF NOT EXISTS "service_categories_tenant_id_name_key" ON "service_categories"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "services_tenant_id_idx" ON "services"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "services_tenant_id_category_id_name_key" ON "services"("tenant_id", "category_id", "name");

CREATE INDEX IF NOT EXISTS "shifts_tenant_id_idx" ON "shifts"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_tenant_id_name_key" ON "shifts"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "staff_tenant_id_idx" ON "staff"("tenant_id");
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "designations" ADD CONSTRAINT "designations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disposables" ADD CONSTRAINT "disposables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
