-- CreateTable
CREATE TABLE "public"."resources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_tenant_id_name_key" ON "public"."resources"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "resources_tenant_id_idx" ON "public"."resources"("tenant_id");

-- CreateIndex
CREATE INDEX "resources_name_idx" ON "public"."resources"("name");

-- CreateIndex
CREATE INDEX "resources_is_active_idx" ON "public"."resources"("is_active");

-- AddForeignKey
ALTER TABLE "public"."resources" ADD CONSTRAINT "resources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
