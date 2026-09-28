-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hsn_code" TEXT,
    "product_tag" TEXT,
    "store_sku" TEXT,
    "is_retail" BOOLEAN NOT NULL DEFAULT true,
    "group" TEXT NOT NULL DEFAULT 'Both',
    "hide_from_catalogue" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL,
    "sale_price" DECIMAL(10,2) DEFAULT 0,
    "is_non_discountable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "barcode" TEXT,
    "variations" JSONB DEFAULT '[]',
    "taxes" JSONB DEFAULT '[]',
    "video_link" TEXT,
    "benefits" TEXT,
    "ingredients" TEXT,
    "usage_instructions" TEXT,
    "display_images" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_store_sku_key" ON "products"("store_sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "products_position_idx" ON "products"("position");

-- CreateIndex
CREATE UNIQUE INDEX "products_category_id_name_key" ON "products"("category_id", "name");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
