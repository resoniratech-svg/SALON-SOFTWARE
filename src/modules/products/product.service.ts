import { prisma } from '../../config/database.js';
import { ProductRepository, productRepository } from './product.repository.js';
import {
  CreateProductInput,
  UpdateProductInput,
  ProductListQuery,
} from './product.types.js';
import { BadRequestError, NotFoundError, AppError } from '../../utils/app-error.js';
import { Prisma } from '@prisma/client';

export class ProductService {
  constructor(private repo: ProductRepository = productRepository) {}

  async create(tenantId: string, input: CreateProductInput) {
    // 1. Verify Product Category exists and belongs to current tenant
    const category = await prisma.productCategory.findFirst({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) {
      throw new BadRequestError(`Product category not found with ID '${input.categoryId}'`);
    }

    // 1.1 Verify Subcategory exists and belongs to current tenant if provided
    if (input.subcategoryId) {
      const subcat = await prisma.productCategory.findFirst({
        where: { id: input.subcategoryId, tenantId },
      });
      if (!subcat) {
        throw new BadRequestError(`Product subcategory not found with ID '${input.subcategoryId}'`);
      }
    }

    // 1.2 Verify Supplier exists and belongs to current tenant if provided
    if (input.supplierId) {
      const supplier = await prisma.vendor.findFirst({
        where: { id: input.supplierId, tenantId },
      });
      if (!supplier) {
        throw new BadRequestError(`Supplier not found with ID '${input.supplierId}'`);
      }
    }

    // 2. Check case-insensitive uniqueness of product name within this category and tenant
    const existingName = await this.repo.findByNameAndCategory(tenantId, input.name, input.categoryId);
    if (existingName) {
      throw new AppError(`Product '${input.name}' already exists in this category`, 409);
    }

    // 3. Check barcode uniqueness within tenant if provided
    if (input.barcode && input.barcode.trim()) {
      const existingBarcode = await this.repo.findByBarcode(tenantId, input.barcode.trim());
      if (existingBarcode) {
        throw new AppError(`Product with barcode '${input.barcode}' already exists`, 409);
      }
    }

    // 4. Check store SKU uniqueness within tenant if provided
    if (input.storeSku && input.storeSku.trim()) {
      const existingSku = await this.repo.findBySku(tenantId, input.storeSku.trim());
      if (existingSku) {
        throw new AppError(`Product with store SKU '${input.storeSku}' already exists`, 409);
      }
    }

    // 5. Inherit group from category if not explicitly specified
    const group = input.group || category.group || 'Both';

    // 6. Create product stamped with tenantId
    const createData: Prisma.ProductUncheckedCreateInput = {
      tenantId,
      name: input.name.trim(),
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId ?? null,
      position: input.position ?? 0,
      hsnCode: input.hsnCode?.trim() || null,
      productTag: input.productTag?.trim() || null,
      storeSku: input.storeSku?.trim() || null,
      isRetail: input.isRetail ?? true,
      group,
      hideFromCatalogue: input.hideFromCatalogue ?? false,
      price: new Prisma.Decimal(input.price),
      salePrice: input.salePrice !== undefined && input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : new Prisma.Decimal(0),
      purchasePrice: input.purchasePrice !== undefined && input.purchasePrice !== null ? new Prisma.Decimal(input.purchasePrice) : new Prisma.Decimal(0),
      isNonDiscountable: input.isNonDiscountable ?? false,
      description: input.description?.trim() || null,
      barcode: input.barcode?.trim() || null,
      supplierId: input.supplierId ?? null,
      variations: input.variations ?? [],
      taxes: input.taxes ?? [],
      videoLink: input.videoLink?.trim() || null,
      benefits: input.benefits?.trim() || null,
      ingredients: input.ingredients?.trim() || null,
      usageInstructions: input.usageInstructions?.trim() || null,
      displayImages: input.displayImages ?? [],
      isActive: input.isActive ?? true,
    };

    return this.repo.createWithStock(createData, {
      initialStock: input.initialStock,
      location: input.location,
    });
  }

  async list(tenantId: string, query: ProductListQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { tenantId };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.subcategoryId) {
      where.subcategoryId = query.subcategoryId;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.group) {
      where.group = query.group;
    }

    if (query.isRetail !== undefined) {
      where.isRetail = query.isRetail;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.hideFromCatalogue !== undefined) {
      where.hideFromCatalogue = query.hideFromCatalogue;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { barcode: { contains: s, mode: 'insensitive' } },
        { storeSku: { contains: s, mode: 'insensitive' } },
        { productTag: { contains: s, mode: 'insensitive' } },
        { hsnCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'position';
    const sortOrder = query.sortOrder || 'asc';
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    let [items, total] = await Promise.all([
      this.repo.findMany({ where, orderBy, skip, take: limit }),
      this.repo.count(where),
    ]);

    if (query.store && query.store.trim()) {
      const s = query.store.trim().toLowerCase();
      items = items.filter((prod: any) => {
        const catStores = Array.isArray(prod.category?.stores) ? (prod.category.stores as string[]) : [];
        if (catStores.length === 0) return true;
        return catStores.some((st: string) => st.toLowerCase() === s);
      });
      total = items.length;
    }

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const product = await this.repo.findById(tenantId, id);
    if (!product) {
      throw new NotFoundError(`Product not found with ID '${id}'`);
    }
    return product;
  }

  async update(tenantId: string, id: string, input: UpdateProductInput) {
    const current = await this.getById(tenantId, id);

    const targetCategoryId = input.categoryId ?? current.categoryId;
    const targetName = input.name ? input.name.trim() : current.name;

    // 1. If categoryId changed, verify new category exists in this tenant
    if (input.categoryId && input.categoryId !== current.categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestError(`Product category not found with ID '${input.categoryId}'`);
      }
    }

    // 1.1 If subcategoryId changed/provided, verify it exists in this tenant
    if (input.subcategoryId) {
      const subcat = await prisma.productCategory.findFirst({
        where: { id: input.subcategoryId, tenantId },
      });
      if (!subcat) {
        throw new BadRequestError(`Product subcategory not found with ID '${input.subcategoryId}'`);
      }
    }

    // 1.2 If supplierId changed/provided, verify supplier exists in this tenant
    if (input.supplierId) {
      const supplier = await prisma.vendor.findFirst({
        where: { id: input.supplierId, tenantId },
      });
      if (!supplier) {
        throw new BadRequestError(`Supplier not found with ID '${input.supplierId}'`);
      }
    }

    // 2. Check name uniqueness within tenant
    if (input.name || input.categoryId) {
      const existingName = await this.repo.findByNameAndCategory(tenantId, targetName, targetCategoryId, id);
      if (existingName) {
        throw new AppError(`Product '${targetName}' already exists in this category`, 409);
      }
    }

    // 3. Check barcode uniqueness within tenant if changed
    if (input.barcode !== undefined) {
      const newBarcode = input.barcode ? input.barcode.trim() : null;
      if (newBarcode) {
        const existingBarcode = await this.repo.findByBarcode(tenantId, newBarcode, id);
        if (existingBarcode) {
          throw new AppError(`Product with barcode '${newBarcode}' already exists`, 409);
        }
      }
    }

    // 4. Check store SKU uniqueness within tenant if changed
    if (input.storeSku !== undefined) {
      const newSku = input.storeSku ? input.storeSku.trim() : null;
      if (newSku) {
        const existingSku = await this.repo.findBySku(tenantId, newSku, id);
        if (existingSku) {
          throw new AppError(`Product with store SKU '${newSku}' already exists`, 409);
        }
      }
    }

    // 5. Build update payload
    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.hsnCode !== undefined) updateData.hsnCode = input.hsnCode ? input.hsnCode.trim() : null;
    if (input.productTag !== undefined) updateData.productTag = input.productTag ? input.productTag.trim() : null;
    if (input.storeSku !== undefined) updateData.storeSku = input.storeSku ? input.storeSku.trim() : null;
    if (input.isRetail !== undefined) updateData.isRetail = input.isRetail;
    if (input.group !== undefined) updateData.group = input.group;
    if (input.hideFromCatalogue !== undefined) updateData.hideFromCatalogue = input.hideFromCatalogue;
    if (input.price !== undefined) updateData.price = new Prisma.Decimal(input.price);
    if (input.salePrice !== undefined) {
      updateData.salePrice = input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : new Prisma.Decimal(0);
    }
    if (input.purchasePrice !== undefined) {
      updateData.purchasePrice = input.purchasePrice !== null ? new Prisma.Decimal(input.purchasePrice) : new Prisma.Decimal(0);
    }
    if (input.isNonDiscountable !== undefined) updateData.isNonDiscountable = input.isNonDiscountable;
    if (input.description !== undefined) updateData.description = input.description ? input.description.trim() : null;
    if (input.barcode !== undefined) updateData.barcode = input.barcode ? input.barcode.trim() : null;
    if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
    if (input.variations !== undefined) updateData.variations = input.variations;
    if (input.taxes !== undefined) updateData.taxes = input.taxes;
    if (input.videoLink !== undefined) updateData.videoLink = input.videoLink ? input.videoLink.trim() : null;
    if (input.benefits !== undefined) updateData.benefits = input.benefits ? input.benefits.trim() : null;
    if (input.ingredients !== undefined) updateData.ingredients = input.ingredients ? input.ingredients.trim() : null;
    if (input.usageInstructions !== undefined) {
      updateData.usageInstructions = input.usageInstructions ? input.usageInstructions.trim() : null;
    }
    if (input.displayImages !== undefined) updateData.displayImages = input.displayImages;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return this.repo.update(id, updateData);
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    await this.getById(tenantId, id);
    return this.repo.updateStatus(id, isActive);
  }

  async delete(tenantId: string, id: string) {
    const product = await this.getById(tenantId, id);
    const usage = await this.repo.countHistoricalUsage(tenantId, id);
    if (usage.total > 0) {
      throw new AppError(
        `Cannot delete product '${product.name}' because it is referenced in historical sales orders (${usage.posOrders}), stock transactions (${usage.stockTransactions}), or purchase orders (${usage.purchaseOrders}). Please deactivate it instead.`,
        409
      );
    }
    await this.repo.delete(id);
    return { success: true, message: 'Product deleted successfully' };
  }

  async generateBarcode(tenantId: string): Promise<string> {
    let attempts = 0;
    while (attempts < 10) {
      const randomPart = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const existing = await this.repo.findByBarcode(tenantId, randomPart);
      if (!existing) {
        return randomPart;
      }
      attempts++;
    }
    return `${Date.now()}`.slice(0, 12);
  }
}

export const productService = new ProductService();
