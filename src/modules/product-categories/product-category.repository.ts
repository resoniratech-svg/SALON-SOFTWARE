import { prisma } from '../../config/database.js';
import { CreateProductCategoryDTO, UpdateProductCategoryDTO, ProductCategoryQueryParams } from './product-category.types.js';

export class ProductCategoryRepository {
  async create(tenantId: string, data: CreateProductCategoryDTO) {
    return prisma.productCategory.create({
      data: {
        tenantId,
        parentId: data.parentId ?? null,
        name: data.name.trim(),
        position: data.position ?? 0,
        group: data.group ?? 'Both',
        hideFromCatalogue: data.hideFromCatalogue ?? false,
        imageUrl: data.imageUrl ?? null,
        stores: data.stores ?? [],
        isActive: data.isActive ?? true,
      },
      include: {
        parent: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findMany(tenantId: string, filters: ProductCategoryQueryParams) {
    const where: any = { tenantId };

    if (filters.search) {
      where.name = {
        contains: filters.search.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.group !== undefined) {
      where.group = filters.group;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.hideFromCatalogue !== undefined) {
      where.hideFromCatalogue = filters.hideFromCatalogue;
    }

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId;
    } else if (filters.tree) {
      where.parentId = null;
    }

    const categories = await prisma.productCategory.findMany({
      where,
      orderBy: [
        { position: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: { products: true, children: true, disposables: true },
        },
      },
    });

    if (filters.store && filters.store.trim()) {
      const s = filters.store.trim().toLowerCase();
      return categories.filter((cat) => {
        const catStores = Array.isArray(cat.stores) ? (cat.stores as string[]) : [];
        if (catStores.length === 0) return true;
        return catStores.some((st) => st.toLowerCase() === s);
      });
    }

    return categories;
  }

  async countRelations(tenantId: string, id: string) {
    const [productsCount, subProductsCount, disposablesCount, childrenCount] = await Promise.all([
      prisma.product.count({ where: { tenantId, categoryId: id } }),
      prisma.product.count({ where: { tenantId, subcategoryId: id } }),
      prisma.disposable.count({ where: { tenantId, categoryId: id } }),
      prisma.productCategory.count({ where: { tenantId, parentId: id } }),
    ]);
    return {
      products: productsCount + subProductsCount + disposablesCount,
      children: childrenCount,
    };
  }

  async findById(tenantId: string, id: string) {
    return prisma.productCategory.findFirst({
      where: { id, tenantId },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        },
        products: {
          select: { id: true, name: true, price: true, isActive: true },
          take: 20,
        },
      },
    });
  }

  async findByName(tenantId: string, name: string) {
    return prisma.productCategory.findFirst({
      where: { name, tenantId },
    });
  }

  async findByNameInsensitive(tenantId: string, name: string, excludeId?: string) {
    const where: any = {
      tenantId,
      name: {
        equals: name.trim(),
        mode: 'insensitive',
      },
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return prisma.productCategory.findFirst({
      where,
    });
  }

  async update(id: string, data: UpdateProductCategoryDTO) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.group !== undefined) updateData.group = data.group;
    if (data.hideFromCatalogue !== undefined) updateData.hideFromCatalogue = data.hideFromCatalogue;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.stores !== undefined) updateData.stores = data.stores;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.productCategory.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.productCategory.update({
      where: { id },
      data: { isActive },
    });
  }

  async delete(id: string) {
    return prisma.productCategory.delete({
      where: { id },
    });
  }
}

export const productCategoryRepository = new ProductCategoryRepository();
