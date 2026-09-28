import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class DisposableRepository {
  async findMany(params: {
    where?: Prisma.DisposableWhereInput;
    orderBy?: Prisma.DisposableOrderByWithRelationInput;
    skip?: number;
    take?: number;
  }) {
    return prisma.disposable.findMany({
      where: params.where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: {
        productCategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.DisposableWhereInput): Promise<number> {
    return prisma.disposable.count({ where });
  }

  async findById(tenantId: string, id: string) {
    return prisma.disposable.findFirst({
      where: { id, tenantId },
      include: {
        productCategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });
  }

  async findByNameAndCategory(tenantId: string, name: string, category: string, excludeId?: string) {
    return prisma.disposable.findFirst({
      where: {
        tenantId,
        category: {
          equals: category.trim(),
          mode: 'insensitive',
        },
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findByBarcode(tenantId: string, barcode: string, excludeId?: string) {
    if (!barcode || !barcode.trim()) return null;
    return prisma.disposable.findFirst({
      where: {
        tenantId,
        barcode: barcode.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findByCode(tenantId: string, code: string, excludeId?: string) {
    if (!code || !code.trim()) return null;
    return prisma.disposable.findFirst({
      where: {
        tenantId,
        code: code.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async create(data: Prisma.DisposableUncheckedCreateInput) {
    return prisma.disposable.create({
      data,
      include: {
        productCategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.DisposableUncheckedUpdateInput) {
    return prisma.disposable.update({
      where: { id },
      data,
      include: {
        productCategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.disposable.delete({
      where: { id },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.disposable.update({
      where: { id },
      data: { isActive },
      include: {
        productCategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
      },
    });
  }
}

export const disposableRepository = new DisposableRepository();
