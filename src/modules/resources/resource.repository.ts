import { prisma } from '../../config/database.js';
import { CreateResourceInput, UpdateResourceInput, ResourceQueryParams } from './resource.types.js';
import { Prisma } from '@prisma/client';

export class ResourceRepository {
  async findMany(tenantId: string, params: ResourceQueryParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, q, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const where: Prisma.ResourceWhereInput = {
      tenantId,
    };

    if (isActive !== undefined) {
      where.isActive = typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive);
    }

    const searchTerm = (search || q || '').trim();
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [totalItems, items] = await Promise.all([
      prisma.resource.count({ where }),
      prisma.resource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      meta: {
        page,
        limit,
        total: totalItems,
        totalPages,
      },
    };
  }

  async findById(tenantId: string, id: string) {
    return prisma.resource.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  async findByName(tenantId: string, name: string, excludeId?: string) {
    return prisma.resource.findFirst({
      where: {
        tenantId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async create(tenantId: string, data: CreateResourceInput) {
    return prisma.resource.create({
      data: {
        tenantId,
        name: data.name.trim(),
        capacity: data.capacity !== undefined ? data.capacity : 1,
        isActive: data.isActive !== undefined ? data.isActive : true,
        description: data.description ? data.description.trim() : null,
      },
    });
  }

  async update(tenantId: string, id: string, data: UpdateResourceInput) {
    const updateData: Prisma.ResourceUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    return prisma.resource.update({
      where: {
        id,
      },
      data: updateData,
    });
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    return prisma.resource.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.resource.delete({
      where: {
        id,
      },
    });
  }

  async countByIds(tenantId: string, ids: string[]) {
    if (!ids || ids.length === 0) return 0;
    return prisma.resource.count({
      where: {
        tenantId,
        id: { in: ids },
      },
    });
  }

  async findReferencingServices(tenantId: string, resourceId: string, resourceName: string) {
    // Services store resource mappings in resourceIds JSON array (can be UUID or name)
    const services = await prisma.service.findMany({
      where: { tenantId },
      select: { id: true, name: true, resourceIds: true },
    });

    return services.filter((s) => {
      if (!Array.isArray(s.resourceIds)) return false;
      const rList = s.resourceIds as string[];
      return rList.includes(resourceId) || rList.includes(resourceName);
    });
  }
}

export const resourceRepository = new ResourceRepository();
