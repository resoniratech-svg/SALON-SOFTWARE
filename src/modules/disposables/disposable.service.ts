import { prisma } from '../../config/database.js';
import { DisposableRepository, disposableRepository } from './disposable.repository.js';
import {
  CreateDisposableInput,
  UpdateDisposableInput,
  DisposableListQuery,
} from './disposable.types.js';
import { BadRequestError, NotFoundError, AppError } from '../../utils/app-error.js';
import { Prisma } from '@prisma/client';

export class DisposableService {
  constructor(private repo: DisposableRepository = disposableRepository) {}

  async create(tenantId: string, input: CreateDisposableInput) {
    let resolvedCategory = input.category?.trim();

    // 1. Verify Category if categoryId is provided (must belong to this tenant)
    if (input.categoryId) {
      const categoryRecord = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!categoryRecord) {
        throw new BadRequestError(`Product category not found with ID '${input.categoryId}'`);
      }
      if (!resolvedCategory) {
        resolvedCategory = categoryRecord.name;
      }
    }

    if (!resolvedCategory) {
      resolvedCategory = 'Disposables';
    }

    // 2. Check case-insensitive uniqueness of name within category and tenant
    const existingName = await this.repo.findByNameAndCategory(tenantId, input.name, resolvedCategory);
    if (existingName) {
      throw new AppError(`Disposable '${input.name}' already exists in category '${resolvedCategory}'`, 409);
    }

    // 3. Check barcode uniqueness within tenant if provided
    if (input.barcode && input.barcode.trim()) {
      const existingBarcode = await this.repo.findByBarcode(tenantId, input.barcode.trim());
      if (existingBarcode) {
        throw new AppError(`Disposable with barcode '${input.barcode}' already exists`, 409);
      }
    }

    // 4. Check code uniqueness within tenant if provided
    if (input.code && input.code.trim()) {
      const existingCode = await this.repo.findByCode(tenantId, input.code.trim());
      if (existingCode) {
        throw new AppError(`Disposable with code '${input.code}' already exists`, 409);
      }
    }

    // 5. Create disposable stamped with tenantId
    const createData: Prisma.DisposableUncheckedCreateInput = {
      tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      category: resolvedCategory,
      categoryId: input.categoryId || null,
      price: new Prisma.Decimal(input.price ?? 0),
      salePrice: input.salePrice !== undefined && input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(input.quantity ?? 1),
      unit: input.unit?.trim() || 'pcs',
      gender: input.gender || 'Both',
      isRetail: input.isRetail ?? false,
      hideFromCatalogue: input.hideFromCatalogue ?? false,
      isNonDiscountable: input.isNonDiscountable ?? false,
      description: input.description?.trim() || null,
      barcode: input.barcode?.trim() || null,
      position: input.position ?? 0,
      hsnCode: input.hsnCode?.trim() || null,
      productTag: input.productTag?.trim() || null,
      isActive: input.isActive ?? true,
    };

    return this.repo.create(createData);
  }

  async list(tenantId: string, query: DisposableListQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.DisposableWhereInput = { tenantId };

    if (query.category) {
      where.category = {
        equals: query.category.trim(),
        mode: 'insensitive',
      };
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.gender) {
      where.gender = query.gender;
    }

    if (query.unit) {
      where.unit = {
        equals: query.unit.trim(),
        mode: 'insensitive',
      };
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
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { productTag: { contains: search, mode: 'insensitive' } },
        { hsnCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'position';
    const sortOrder = query.sortOrder || 'asc';
    const orderBy: Prisma.DisposableOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [items, total] = await Promise.all([
      this.repo.findMany({ where, orderBy, skip, take: limit }),
      this.repo.count(where),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const disposable = await this.repo.findById(tenantId, id);
    if (!disposable) {
      throw new NotFoundError(`Disposable not found with ID '${id}'`);
    }
    return disposable;
  }

  async update(tenantId: string, id: string, input: UpdateDisposableInput) {
    const existing = await this.getById(tenantId, id);

    let resolvedCategory = existing.category;
    if (input.categoryId !== undefined && input.categoryId !== null) {
      const categoryRecord = await prisma.productCategory.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!categoryRecord) {
        throw new BadRequestError(`Product category not found with ID '${input.categoryId}'`);
      }
      if (!input.category) {
        resolvedCategory = categoryRecord.name;
      }
    }

    if (input.category !== undefined) {
      resolvedCategory = input.category.trim();
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;

    // Check uniqueness of category + name if either changed within tenant
    if (newName.toLowerCase() !== existing.name.toLowerCase() || resolvedCategory.toLowerCase() !== existing.category.toLowerCase()) {
      const duplicateName = await this.repo.findByNameAndCategory(tenantId, newName, resolvedCategory, id);
      if (duplicateName) {
        throw new AppError(`Disposable '${newName}' already exists in category '${resolvedCategory}'`, 409);
      }
    }

    // Check barcode uniqueness within tenant if changed
    if (input.barcode !== undefined) {
      const newBarcode = input.barcode ? input.barcode.trim() : null;
      if (newBarcode) {
        const existingBarcode = await this.repo.findByBarcode(tenantId, newBarcode, id);
        if (existingBarcode) {
          throw new AppError(`Disposable with barcode '${newBarcode}' already exists`, 409);
        }
      }
    }

    // Check code uniqueness within tenant if changed
    if (input.code !== undefined) {
      const newCode = input.code ? input.code.trim() : null;
      if (newCode) {
        const existingCode = await this.repo.findByCode(tenantId, newCode, id);
        if (existingCode) {
          throw new AppError(`Disposable with code '${newCode}' already exists`, 409);
        }
      }
    }

    // Build update payload
    const updateData: Prisma.DisposableUncheckedUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.code !== undefined) updateData.code = input.code ? input.code.trim() : null;
    if (input.category !== undefined || input.categoryId !== undefined) {
      updateData.category = resolvedCategory;
    }
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.price !== undefined) updateData.price = new Prisma.Decimal(input.price);
    if (input.salePrice !== undefined) {
      updateData.salePrice = input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : new Prisma.Decimal(0);
    }
    if (input.quantity !== undefined) updateData.quantity = new Prisma.Decimal(input.quantity);
    if (input.unit !== undefined) updateData.unit = input.unit.trim();
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.isRetail !== undefined) updateData.isRetail = input.isRetail;
    if (input.hideFromCatalogue !== undefined) updateData.hideFromCatalogue = input.hideFromCatalogue;
    if (input.isNonDiscountable !== undefined) updateData.isNonDiscountable = input.isNonDiscountable;
    if (input.description !== undefined) updateData.description = input.description ? input.description.trim() : null;
    if (input.barcode !== undefined) updateData.barcode = input.barcode ? input.barcode.trim() : null;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.hsnCode !== undefined) updateData.hsnCode = input.hsnCode ? input.hsnCode.trim() : null;
    if (input.productTag !== undefined) updateData.productTag = input.productTag ? input.productTag.trim() : null;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return this.repo.update(id, updateData);
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    await this.getById(tenantId, id);
    return this.repo.updateStatus(id, isActive);
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    const stockUsage = await prisma.stockTransaction.count({ where: { tenantId, disposableId: id } });
    if (stockUsage > 0) {
      // Module Isolation: preserve stock transaction history, reports, and audit logs.
      await this.repo.update(id, { isActive: false, hideFromCatalogue: true });
      return { success: true, message: 'Disposable removed from catalog (stock history preserved)', softDeleted: true };
    }
    await prisma.vendorItem.deleteMany({ where: { tenantId, disposableId: id } });
    await this.repo.delete(id);
    return { success: true, message: 'Disposable deleted successfully' };
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

export const disposableService = new DisposableService();
