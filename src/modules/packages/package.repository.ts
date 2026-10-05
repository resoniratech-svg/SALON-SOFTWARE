import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { PackageQuery } from './package.types.js';

export class PackageRepository {
  async create(data: Prisma.PackageUncheckedCreateInput) {
    return prisma.package.create({
      data,
    });
  }

  async list(tenantId: string, query: PackageQuery) {
    const { page = 1, limit = 50, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PackageWhereInput = {
      tenantId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            name: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.package.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.package.count({ where }),
    ]);

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

  async findById(tenantId: string, id: string) {
    return prisma.package.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  async findByName(tenantId: string, name: string, excludeId?: string) {
    return prisma.package.findFirst({
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

  async update(id: string, data: Prisma.PackageUncheckedUpdateInput) {
    return prisma.package.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.package.delete({
      where: { id },
    });
  }

  async countUsage(tenantId: string, id: string) {
    const count = await prisma.guestPackage.count({
      where: {
        tenantId,
        packageId: id,
      },
    });
    return count;
  }
}

export const packageRepository = new PackageRepository();
