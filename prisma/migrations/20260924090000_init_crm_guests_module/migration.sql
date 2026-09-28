-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guest_code" TEXT,
    "salutation" TEXT,
    "salutation_id" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "gender" TEXT,
    "date_of_birth" DATE,
    "mobile" TEXT NOT NULL,
    "alternate_mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "postal_code" TEXT,
    "anniversary" DATE,
    "gst_number" TEXT,
    "hair_type" TEXT,
    "preferences" TEXT,
    "notes" TEXT,
    "tags" JSONB DEFAULT '[]',
    "customer_type" TEXT NOT NULL DEFAULT 'REGULAR',
    "source" TEXT,
    "referral_code" TEXT,
    "referred_by_guest_id" TEXT,
    "crm_segment_id" TEXT,
    "membership_id" TEXT,
    "membership_expiry" TIMESTAMP(3),
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "total_spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_visits" INTEGER NOT NULL DEFAULT 0,
    "last_visit_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guests_tenant_id_mobile_key" ON "guests"("tenant_id", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "guests_tenant_id_guest_code_key" ON "guests"("tenant_id", "guest_code");

-- CreateIndex
CREATE INDEX "guests_tenant_id_idx" ON "guests"("tenant_id");

-- CreateIndex
CREATE INDEX "guests_tenant_id_mobile_idx" ON "guests"("tenant_id", "mobile");

-- CreateIndex
CREATE INDEX "guests_tenant_id_name_idx" ON "guests"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "guests_tenant_id_email_idx" ON "guests"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "guests_tenant_id_is_active_idx" ON "guests"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "guests_tenant_id_is_blocked_idx" ON "guests"("tenant_id", "is_blocked");

-- CreateIndex
CREATE INDEX "guests_tenant_id_customer_type_idx" ON "guests"("tenant_id", "customer_type");

-- CreateIndex
CREATE INDEX "guests_tenant_id_crm_segment_id_idx" ON "guests"("tenant_id", "crm_segment_id");

-- CreateIndex
CREATE INDEX "guests_tenant_id_membership_id_idx" ON "guests"("tenant_id", "membership_id");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_salutation_id_fkey" FOREIGN KEY ("salutation_id") REFERENCES "salutations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_crm_segment_id_fkey" FOREIGN KEY ("crm_segment_id") REFERENCES "crm_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_referred_by_guest_id_fkey" FOREIGN KEY ("referred_by_guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
