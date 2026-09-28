-- CreateTable
CREATE TABLE "pos_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "guest_id" TEXT NOT NULL,
    "cashier_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_value" DECIMAL(10,2) DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "coupon_code" TEXT,
    "coupon_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gift_card_code" TEXT,
    "gift_card_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referral_code" TEXT,
    "referral_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "membership_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_details" JSONB DEFAULT '[]',
    "tip_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL DEFAULT 'CASH',
    "payment_status" TEXT NOT NULL DEFAULT 'PAID',
    "notes" TEXT,
    "instruction" TEXT,
    "invoice_pdf_url" TEXT,
    "whatsapp_status" TEXT DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL DEFAULT 'SERVICE',
    "service_id" TEXT,
    "product_id" TEXT,
    "staff_id" TEXT,
    "item_name" TEXT NOT NULL,
    "item_category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_tenant_id_order_number_key" ON "pos_orders"("tenant_id", "order_number");
CREATE INDEX "pos_orders_tenant_id_idx" ON "pos_orders"("tenant_id");
CREATE INDEX "pos_orders_tenant_id_guest_id_idx" ON "pos_orders"("tenant_id", "guest_id");
CREATE INDEX "pos_orders_tenant_id_cashier_id_idx" ON "pos_orders"("tenant_id", "cashier_id");
CREATE INDEX "pos_orders_tenant_id_status_idx" ON "pos_orders"("tenant_id", "status");
CREATE INDEX "pos_orders_tenant_id_order_date_idx" ON "pos_orders"("tenant_id", "order_date");
CREATE INDEX "pos_orders_tenant_id_created_at_idx" ON "pos_orders"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "pos_order_items_tenant_id_idx" ON "pos_order_items"("tenant_id");
CREATE INDEX "pos_order_items_tenant_id_order_id_idx" ON "pos_order_items"("tenant_id", "order_id");
CREATE INDEX "pos_order_items_tenant_id_service_id_idx" ON "pos_order_items"("tenant_id", "service_id");
CREATE INDEX "pos_order_items_tenant_id_product_id_idx" ON "pos_order_items"("tenant_id", "product_id");
CREATE INDEX "pos_order_items_tenant_id_staff_id_idx" ON "pos_order_items"("tenant_id", "staff_id");

-- CreateIndex
CREATE INDEX "pos_payments_tenant_id_idx" ON "pos_payments"("tenant_id");
CREATE INDEX "pos_payments_tenant_id_order_id_idx" ON "pos_payments"("tenant_id", "order_id");

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
