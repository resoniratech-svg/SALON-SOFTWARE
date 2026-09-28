-- AlterTable tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "cashier_limit" INTEGER NOT NULL DEFAULT 2;

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "enabled_modules" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_requested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_requested_at" TIMESTAMP(3);
