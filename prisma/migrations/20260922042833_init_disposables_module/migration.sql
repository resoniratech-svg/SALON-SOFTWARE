-- CreateTable
CREATE TABLE "disposables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Disposables',
    "category_id" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2) DEFAULT 0,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "gender" TEXT NOT NULL DEFAULT 'Both',
    "is_retail" BOOLEAN NOT NULL DEFAULT false,
    "hide_from_catalogue" BOOLEAN NOT NULL DEFAULT false,
    "is_non_discountable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "barcode" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hsn_code" TEXT,
    "product_tag" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disposables_code_key" ON "disposables"("code");

-- CreateIndex
CREATE UNIQUE INDEX "disposables_barcode_key" ON "disposables"("barcode");

-- CreateIndex
CREATE INDEX "disposables_name_idx" ON "disposables"("name");

-- CreateIndex
CREATE INDEX "disposables_category_idx" ON "disposables"("category");

-- CreateIndex
CREATE INDEX "disposables_category_id_idx" ON "disposables"("category_id");

-- CreateIndex
CREATE INDEX "disposables_is_active_idx" ON "disposables"("is_active");

-- CreateIndex
CREATE INDEX "disposables_position_idx" ON "disposables"("position");

-- CreateIndex
CREATE UNIQUE INDEX "disposables_category_name_key" ON "disposables"("category", "name");

-- AddForeignKey
ALTER TABLE "disposables" ADD CONSTRAINT "disposables_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
