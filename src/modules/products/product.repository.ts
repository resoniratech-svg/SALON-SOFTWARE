import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class ProductRepository {
  async findMany(params: {
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
    skip?: number;
    take?: number;
  }) {
    const products = await prisma.product.findMany({
      where: params.where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            group: true,
            stores: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        supplier: {
          select: {
            id: true,
            vendorName: true,
            firmName: true,
          },
        },
        stockTransactions: {
          select: {
            type: true,
            quantity: true,
          },
        },
      },
    });

    return products.map((p) => {
      let inward = 0;
      let outward = 0;
      for (const t of p.stockTransactions || []) {
        const qty = Number(t.quantity);
        if (t.type === 'INWARD' || t.type === 'RECONCILED') {
          inward += qty;
        } else {
          outward += qty;
        }
      }
      const currentStock = Math.max(0, inward - outward);
      const { stockTransactions, ...rest } = p;
      return {
        ...rest,
        currentStock,
      };
    });
  }

  async count(where?: Prisma.ProductWhereInput): Promise<number> {
    return prisma.product.count({ where });
  }

  async findById(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            group: true,
            stores: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        supplier: {
          select: {
            id: true,
            vendorName: true,
            firmName: true,
          },
        },
        stockTransactions: {
          select: {
            id: true,
            type: true,
            quantity: true,
            unitPrice: true,
            transactionDate: true,
          },
        },
      },
    });

    if (!product) return null;

    let inward = 0;
    let outward = 0;
    for (const t of product.stockTransactions || []) {
      const qty = Number(t.quantity);
      if (t.type === 'INWARD' || t.type === 'RECONCILED') {
        inward += qty;
      } else {
        outward += qty;
      }
    }
    const currentStock = Math.max(0, inward - outward);

    return {
      ...product,
      currentStock,
    };
  }

  async countHistoricalUsage(tenantId: string, id: string) {
    const [posCount, stockCount, vendorItemCount, poCount, trCount] = await Promise.all([
      prisma.posOrderItem.count({ where: { tenantId, productId: id } }),
      prisma.stockTransaction.count({ where: { tenantId, productId: id } }),
      prisma.vendorItem.count({ where: { tenantId, productId: id } }),
      prisma.purchaseOrderItem.count({ where: { productId: id } }),
      prisma.transferRequestItem.count({ where: { productId: id } }),
    ]);

    return {
      posOrders: posCount,
      stockTransactions: stockCount,
      vendorItems: vendorItemCount,
      purchaseOrders: poCount,
      transferRequests: trCount,
      total: posCount + stockCount + vendorItemCount + poCount + trCount,
    };
  }

  async findByNameAndCategory(tenantId: string, name: string, categoryId: string, excludeId?: string) {
    return prisma.product.findFirst({
      where: {
        tenantId,
        categoryId,
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
    return prisma.product.findFirst({
      where: {
        tenantId,
        barcode: barcode.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findBySku(tenantId: string, storeSku: string, excludeId?: string) {
    if (!storeSku || !storeSku.trim()) return null;
    return prisma.product.findFirst({
      where: {
        tenantId,
        storeSku: storeSku.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async createWithStock(
    data: Prisma.ProductUncheckedCreateInput,
    stockOptions?: { initialStock?: number; location?: string | null }
  ) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              group: true,
            },
          },
          subcategory: {
            select: {
              id: true,
              name: true,
            },
          },
          supplier: {
            select: {
              id: true,
              vendorName: true,
              firmName: true,
            },
          },
        },
      });

      if (stockOptions?.initialStock && stockOptions.initialStock > 0) {
        await tx.stockTransaction.create({
          data: {
            tenantId: data.tenantId,
            productId: product.id,
            type: 'INWARD',
            quantity: new Prisma.Decimal(stockOptions.initialStock),
            unitPrice: data.purchasePrice || data.price,
            totalAmount: new Prisma.Decimal(
              stockOptions.initialStock * Number(data.purchasePrice || data.price)
            ),
            destinationStore: stockOptions.location || null,
            notes: 'Initial stock on product creation',
          },
        });
      }

      return product;
    });
  }

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return prisma.product.update({
      where: { id },
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            vendorName: true,
            firmName: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.product.delete({
      where: { id },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.product.update({
      where: { id },
      data: { isActive },
      include: {
        category: {
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

export const productRepository = new ProductRepository();
