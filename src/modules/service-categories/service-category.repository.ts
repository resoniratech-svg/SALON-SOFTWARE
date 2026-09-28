import { prisma } from '../../config/database.js';
import {
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
  ServiceCategoryListQuery,
} from './service-category.types.js';

export class ServiceCategoryRepository {
  async findByName(tenantId: string, name: string, excludeId?: string) {
    return prisma.serviceCategory.findFirst({
      where: {
        tenantId,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findById(tenantId: string, id: string) {
    return prisma.serviceCategory.findFirst({
      where: { id, tenantId },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        },
        services: {
          select: { id: true, name: true, price: true, isActive: true },
          take: 20,
        },
      },
    });
  }

  async countRelations(tenantId: string, id: string) {
    const [servicesCount, subServicesCount, childrenCount] = await Promise.all([
      prisma.service.count({ where: { tenantId, categoryId: id } }),
      prisma.service.count({ where: { tenantId, subcategoryId: id } }),
      prisma.serviceCategory.count({ where: { tenantId, parentId: id } }),
    ]);
    return {
      services: servicesCount + subServicesCount,
      children: childrenCount,
    };
  }

  async list(tenantId: string, query: ServiceCategoryListQuery) {
    const { search, group, isActive, hideFromCatalogue, parentId, store, tree } = query;
    const where: any = { tenantId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (group) {
      where.group = group;
    }

    if (hideFromCatalogue !== undefined) {
      where.hideFromCatalogue = hideFromCatalogue;
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    } else if (tree) {
      where.parentId = null; // root only for tree
    }

    if (search) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const categories = await prisma.serviceCategory.findMany({
      where,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: { services: true, children: true },
        },
      },
    });

    if (store && store.trim()) {
      const s = store.trim().toLowerCase();
      return categories.filter((cat) => {
        const catStores = Array.isArray(cat.stores) ? (cat.stores as string[]) : [];
        if (catStores.length === 0) return true; // active in all stores
        return catStores.some((st) => st.toLowerCase() === s);
      });
    }

    return categories;
  }

  async create(tenantId: string, data: CreateServiceCategoryInput) {
    return prisma.serviceCategory.create({
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

  async update(id: string, data: UpdateServiceCategoryInput) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.group !== undefined) updateData.group = data.group;
    if (data.hideFromCatalogue !== undefined) updateData.hideFromCatalogue = data.hideFromCatalogue;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.stores !== undefined) updateData.stores = data.stores;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.serviceCategory.update({
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
    return prisma.serviceCategory.update({
      where: { id },
      data: { isActive },
    });
  }

  async delete(id: string) {
    return prisma.serviceCategory.delete({
      where: { id },
    });
  }
}

export const serviceCategoryRepository = new ServiceCategoryRepository();
