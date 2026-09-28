-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "business_status" TEXT NOT NULL DEFAULT 'OPEN',
    "opening_time" TEXT NOT NULL DEFAULT '08:00 AM',
    "closing_time" TEXT NOT NULL DEFAULT '11:30 PM',
    "gender_specification" TEXT NOT NULL DEFAULT 'Both',
    "weekly_off_days" JSONB DEFAULT '[]',
    "home_delivery_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cod_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cash_on_pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "min_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "online_payment_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payment_gateways" JSONB DEFAULT '[]',
    "apply_to_orders" BOOLEAN NOT NULL DEFAULT true,
    "apply_to_appointments" BOOLEAN NOT NULL DEFAULT true,
    "notifications_config" JSONB DEFAULT '{}',
    "feedback_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rating_scale" INTEGER NOT NULL DEFAULT 5,
    "send_feedback_sms" BOOLEAN NOT NULL DEFAULT false,
    "send_feedback_email" BOOLEAN NOT NULL DEFAULT false,
    "feedback_questions" JSONB DEFAULT '[]',
    "referrals_enabled" BOOLEAN NOT NULL DEFAULT false,
    "referrer_reward_type" TEXT,
    "referrer_reward_value" DECIMAL(10,2),
    "referee_reward_type" TEXT,
    "referee_reward_value" DECIMAL(10,2),
    "referral_min_order" DECIMAL(10,2),
    "referral_validity_days" INTEGER,
    "loyalty_enabled" BOOLEAN NOT NULL DEFAULT false,
    "points_per_currency" DECIMAL(10,2) DEFAULT 1,
    "currency_per_point" DECIMAL(10,2) DEFAULT 1,
    "min_redeem_points" INTEGER DEFAULT 100,
    "max_redeem_points_per_order" INTEGER,
    "loyalty_expiry_days" INTEGER,
    "incentive_enabled" BOOLEAN NOT NULL DEFAULT false,
    "incentive_calculation_type" TEXT,
    "incentive_rules" JSONB DEFAULT '[]',
    "footer_text" TEXT,
    "footer_links" JSONB DEFAULT '[]',
    "contact_info" JSONB DEFAULT '{}',
    "privacy_policy" TEXT,
    "terms_and_conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "applicable_for" JSONB NOT NULL DEFAULT '["SERVICE","PRODUCT"]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "renewal_reminder_days" INTEGER NOT NULL DEFAULT 15,
    "discount_percentage" DECIMAL(5,2) DEFAULT 0,
    "benefits" TEXT,
    "applicable_services" JSONB DEFAULT '[]',
    "applicable_products" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "renewal_reminder_days" INTEGER NOT NULL DEFAULT 15,
    "services" JSONB DEFAULT '[]',
    "products" JSONB DEFAULT '[]',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discount_value" DECIMAL(10,2) NOT NULL,
    "min_order_value" DECIMAL(10,2) DEFAULT 0,
    "max_discount" DECIMAL(10,2),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "applicable_services" JSONB DEFAULT '[]',
    "applicable_products" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pnl_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EXPENSE',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pnl_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pnl_income_taxes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "to_amount" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pnl_income_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_segments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_forms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salutations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salutations_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");
CREATE INDEX "tenant_settings_tenant_id_idx" ON "tenant_settings"("tenant_id");

CREATE UNIQUE INDEX "tax_mappings_tenant_id_name_key" ON "tax_mappings"("tenant_id", "name");
CREATE INDEX "tax_mappings_tenant_id_idx" ON "tax_mappings"("tenant_id");
CREATE INDEX "tax_mappings_is_active_idx" ON "tax_mappings"("is_active");

CREATE UNIQUE INDEX "memberships_tenant_id_name_key" ON "memberships"("tenant_id", "name");
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");
CREATE INDEX "memberships_is_active_idx" ON "memberships"("is_active");

CREATE UNIQUE INDEX "packages_tenant_id_name_key" ON "packages"("tenant_id", "name");
CREATE INDEX "packages_tenant_id_idx" ON "packages"("tenant_id");
CREATE INDEX "packages_is_active_idx" ON "packages"("is_active");

CREATE UNIQUE INDEX "gift_cards_tenant_id_code_key" ON "gift_cards"("tenant_id", "code");
CREATE INDEX "gift_cards_tenant_id_idx" ON "gift_cards"("tenant_id");
CREATE INDEX "gift_cards_is_active_idx" ON "gift_cards"("is_active");

CREATE UNIQUE INDEX "coupons_tenant_id_code_key" ON "coupons"("tenant_id", "code");
CREATE INDEX "coupons_tenant_id_idx" ON "coupons"("tenant_id");
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

CREATE UNIQUE INDEX "pnl_categories_tenant_id_name_key" ON "pnl_categories"("tenant_id", "name");
CREATE INDEX "pnl_categories_tenant_id_idx" ON "pnl_categories"("tenant_id");
CREATE INDEX "pnl_categories_type_idx" ON "pnl_categories"("type");
CREATE INDEX "pnl_categories_is_active_idx" ON "pnl_categories"("is_active");

CREATE INDEX "pnl_income_taxes_tenant_id_idx" ON "pnl_income_taxes"("tenant_id");
CREATE INDEX "pnl_income_taxes_is_active_idx" ON "pnl_income_taxes"("is_active");

CREATE UNIQUE INDEX "crm_segments_tenant_id_name_key" ON "crm_segments"("tenant_id", "name");
CREATE INDEX "crm_segments_tenant_id_idx" ON "crm_segments"("tenant_id");
CREATE INDEX "crm_segments_is_active_idx" ON "crm_segments"("is_active");

CREATE UNIQUE INDEX "custom_forms_tenant_id_name_key" ON "custom_forms"("tenant_id", "name");
CREATE INDEX "custom_forms_tenant_id_idx" ON "custom_forms"("tenant_id");
CREATE INDEX "custom_forms_is_active_idx" ON "custom_forms"("is_active");

CREATE UNIQUE INDEX "salutations_tenant_id_title_key" ON "salutations"("tenant_id", "title");
CREATE INDEX "salutations_tenant_id_idx" ON "salutations"("tenant_id");
CREATE INDEX "salutations_is_active_idx" ON "salutations"("is_active");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_mappings" ADD CONSTRAINT "tax_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pnl_categories" ADD CONSTRAINT "pnl_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pnl_income_taxes" ADD CONSTRAINT "pnl_income_taxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_segments" ADD CONSTRAINT "crm_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salutations" ADD CONSTRAINT "salutations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
