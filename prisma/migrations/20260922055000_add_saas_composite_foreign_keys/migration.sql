-- DropForeignKey
ALTER TABLE "disposables" DROP CONSTRAINT IF EXISTS "disposables_category_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_category_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "designations_id_tenant_id_key" ON "designations"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "disposables_id_tenant_id_key" ON "disposables"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_id_tenant_id_key" ON "product_categories"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "products_id_tenant_id_key" ON "products"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "service_categories_id_tenant_id_key" ON "service_categories"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "services_id_tenant_id_key" ON "services"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_id_tenant_id_key" ON "shifts"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_id_tenant_id_key" ON "staff"("id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_id_tenant_id_key" ON "users"("id", "tenant_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_tenant_id_fkey" FOREIGN KEY ("category_id", "tenant_id") REFERENCES "service_categories"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_tenant_id_fkey" FOREIGN KEY ("category_id", "tenant_id") REFERENCES "product_categories"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposables" ADD CONSTRAINT "disposables_category_id_tenant_id_fkey" FOREIGN KEY ("category_id", "tenant_id") REFERENCES "product_categories"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
