import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { PosOrderQuery } from './pos.types.js';

export class PosRepository {
  private readonly defaultIncludes = {
    guest: {
      select: {
        id: true,
        guestCode: true,
        name: true,
        mobile: true,
        email: true,
        gender: true,
        dateOfBirth: true,
        anniversary: true,
        gstNumber: true,
        hairType: true,
        customerType: true,
        totalSpend: true,
        totalVisits: true,
        lastVisitDate: true,
      },
    },
    cashier: {
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
      },
    },
    items: {
      include: {
        service: {
          select: {
            id: true,
            name: true,
            sacCode: true,
            price: true,
            salePrice: true,
            durationMinutes: true,
            category: { select: { id: true, name: true } },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            hsnCode: true,
            price: true,
            salePrice: true,
            category: { select: { id: true, name: true } },
          },
        },
        staff: {
          select: {
            id: true,
            name: true,
            isActive: true,
            personalDetails: {
              select: {
                mobile: true,
                email: true,
              },
            },
          },
        },
      },
    },
    payments: true,
  };

  async getNextOrderNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `INV-${datePrefix}-`;

    const latestOrder = await prisma.posOrder.findFirst({
      where: {
        tenantId,
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
      select: {
        orderNumber: true,
      },
    });

    let nextSeq = 1;
    if (latestOrder?.orderNumber) {
      const parts = latestOrder.orderNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    let orderNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    let exists = await prisma.posOrder.findFirst({
      where: { tenantId, orderNumber },
      select: { id: true },
    });
    while (exists) {
      nextSeq++;
      orderNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
      exists = await prisma.posOrder.findFirst({
        where: { tenantId, orderNumber },
        select: { id: true },
      });
    }

    return orderNumber;
  }

  async create(
    tenantId: string,
    orderData: {
      orderNumber: string;
      guestId: string;
      cashierId?: string | null;
      status: string;
      orderDate: Date;
      subtotal: Prisma.Decimal;
      discountType?: string | null;
      discountValue?: Prisma.Decimal | null;
      discountAmount: Prisma.Decimal;
      couponCode?: string | null;
      couponDiscount: Prisma.Decimal;
      giftCardCode?: string | null;
      giftCardAmount: Prisma.Decimal;
      referralCode?: string | null;
      referralDiscount: Prisma.Decimal;
      membershipDiscount: Prisma.Decimal;
      loyaltyPointsRedeemed?: number | null;
      loyaltyDiscount?: Prisma.Decimal;
      loyaltyPointsEarned?: number | null;
      taxAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxDetails: Prisma.InputJsonValue;
      tipAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      paymentMethod: string;
      paymentStatus: string;
      notes?: string | null;
      instruction?: string | null;
    },
    items: Array<{
      itemType: string;
      serviceId?: string | null;
      productId?: string | null;
      staffId?: string | null;
      itemName: string;
      itemCategory?: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      total: Prisma.Decimal;
      notes?: string | null;
    }>,
    payments: Array<{
      method: string;
      amount: Prisma.Decimal;
      referenceNumber?: string | null;
      status?: string;
    }>
  ) {
    let attempts = 0;
    const maxAttempts = 5;
    let currentOrderNumber = orderData.orderNumber;

    while (attempts < maxAttempts) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Create PosOrder
          const createdOrder = await tx.posOrder.create({
            data: {
              tenantId,
              ...orderData,
              orderNumber: currentOrderNumber,
              items: {
                create: items.map((item) => ({
                  tenantId,
                  itemType: item.itemType,
                  serviceId: item.serviceId,
                  productId: item.productId,
                  staffId: item.staffId,
                  itemName: item.itemName,
                  itemCategory: item.itemCategory,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountAmount: item.discountAmount,
                  taxAmount: item.taxAmount,
                  subtotal: item.subtotal,
                  total: item.total,
                  notes: item.notes,
                })),
              },
              payments: {
                create: payments.map((p) => ({
                  tenantId,
                  method: p.method,
                  amount: p.amount,
                  referenceNumber: p.referenceNumber,
                  status: p.status || 'SUCCESS',
                })),
              },
            },
            include: this.defaultIncludes,
          });

          // 2. Update Guest visit, spend stats, and loyalty points balance
          if (orderData.status === 'COMPLETED') {
            const guest = await tx.guest.findUnique({
              where: { id: orderData.guestId },
            });

            let newLoyalty = guest?.loyaltyPoints ?? 0;
            const redeemedPts = orderData.loyaltyPointsRedeemed || 0;
            const earnedPts = orderData.loyaltyPointsEarned || 0;

            if (redeemedPts > 0) {
              newLoyalty = Math.max(0, newLoyalty - redeemedPts);
              await tx.guestWalletTransaction.create({
                data: {
                  tenantId,
                  guestId: orderData.guestId,
                  staffId: null,
                  type: 'LOYALTY_DEBIT',
                  amount: redeemedPts,
                  runningBalance: newLoyalty,
                  paymentMethod: 'Loyalty Points',
                  notes: `Redeemed on Order ${currentOrderNumber}`,
                  transactionDate: orderData.orderDate,
                },
              });
            }

            if (earnedPts > 0) {
              newLoyalty += earnedPts;
              await tx.guestWalletTransaction.create({
                data: {
                  tenantId,
                  guestId: orderData.guestId,
                  staffId: null,
                  type: 'LOYALTY_CREDIT',
                  amount: earnedPts,
                  runningBalance: newLoyalty,
                  paymentMethod: 'Loyalty Earning',
                  notes: `Earned from Order ${currentOrderNumber}`,
                  transactionDate: orderData.orderDate,
                },
              });
            }

            await tx.guest.update({
              where: { id: orderData.guestId },
              data: {
                totalSpend: { increment: orderData.totalAmount },
                totalVisits: { increment: 1 },
                lastVisitDate: orderData.orderDate,
                loyaltyPoints: newLoyalty,
              },
            });
          }

          // 3. Increment coupon usage if applied
          if (orderData.couponCode) {
            await tx.coupon.updateMany({
              where: {
                tenantId,
                code: orderData.couponCode,
              },
              data: {
                usedCount: { increment: 1 },
              },
            });
          }

          // 4. Record Inventory Stock Movements for products sold in COMPLETED orders
          if (orderData.status === 'COMPLETED') {
            for (const item of items) {
              if (item.itemType === 'PRODUCT' && item.productId && /^[0-9a-fA-F-]{36}$/.test(item.productId)) {
                const prodExists = await tx.product.findUnique({ where: { id: item.productId } });
                if (prodExists) {
                  await tx.stockTransaction.create({
                    data: {
                      tenantId,
                      productId: item.productId,
                      type: 'OUTWARD',
                      quantity: new Prisma.Decimal(item.quantity),
                      unitPrice: item.unitPrice,
                      totalAmount: item.total,
                      notes: `POS Sale: ${currentOrderNumber}`,
                      transactionDate: orderData.orderDate,
                    },
                  });
                }
              }
            }
          }

          return createdOrder;
        });
      } catch (err: any) {
        if (
          err?.code === 'P2002' &&
          (err?.meta?.target?.includes('order_number') || String(err?.message).includes('order_number'))
        ) {
          attempts++;
          if (attempts >= maxAttempts) throw err;
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 20));
          currentOrderNumber = await this.getNextOrderNumber(tenantId);
          continue;
        }
        throw err;
      }
    }
  }

  async findById(tenantId: string, id: string) {
    return prisma.posOrder.findFirst({
      where: {
        id,
        tenantId,
      },
      include: this.defaultIncludes,
    });
  }

  async findByOrderNumber(tenantId: string, orderNumber: string) {
    return prisma.posOrder.findFirst({
      where: {
        orderNumber,
        tenantId,
      },
      include: this.defaultIncludes,
    });
  }

  async findMany(tenantId: string, filters: PosOrderQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PosOrderWhereInput = {
      tenantId,
    };

    if (filters.status) {
      if (filters.status === 'NEW') {
        where.status = { in: ['NEW', 'PENDING'] };
      } else {
        where.status = filters.status;
      }
    }

    if (filters.guestId) {
      where.guestId = filters.guestId;
    }

    if (filters.cashierId) {
      where.cashierId = filters.cashierId;
    }

    // Date range filtering
    const fromStr = filters.dateFrom || filters.startDate;
    const toStr = filters.dateTo || filters.endDate;
    if (fromStr || toStr) {
      where.orderDate = {};
      if (fromStr) {
        where.orderDate.gte = new Date(fromStr);
      }
      if (toStr) {
        const toDate = new Date(toStr);
        // If date-only string e.g. '2026-09-24', extend to end of day
        if (toStr.length === 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        where.orderDate.lte = toDate;
      }
    }

    // Search query on orderNumber, guest name, guest mobile
    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { guest: { name: { contains: search, mode: 'insensitive' } } },
        { guest: { mobile: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.PosOrderOrderByWithRelationInput = {};
    const sortBy = filters.sortBy || 'orderDate';
    const sortOrder = filters.sortOrder || 'desc';
    orderBy[sortBy as keyof Prisma.PosOrderOrderByWithRelationInput] = sortOrder;

    const [total, data] = await Promise.all([
      prisma.posOrder.count({ where }),
      prisma.posOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.defaultIncludes,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updateStatus(tenantId: string, id: string, status: string, notes?: string) {
    return prisma.posOrder.updateMany({
      where: { id, tenantId },
      data: {
        status,
        ...(notes ? { notes } : {}),
      },
    });
  }

  async acceptOrder(tenantId: string, id: string) {
    return prisma.posOrder.updateMany({
      where: { id, tenantId },
      data: {
        status: 'ACCEPTED',
      },
    });
  }

  async rejectOrder(tenantId: string, id: string, reason?: string) {
    return prisma.posOrder.updateMany({
      where: { id, tenantId },
      data: {
        status: 'REJECTED',
        ...(reason ? { notes: reason } : {}),
      },
    });
  }

  async updateOrder(
    tenantId: string,
    id: string,
    orderData: Partial<{
      guestId?: string;
      status?: string;
      subtotal?: Prisma.Decimal;
      discountType?: string | null;
      discountValue?: Prisma.Decimal | null;
      discountAmount?: Prisma.Decimal;
      couponCode?: string | null;
      couponDiscount?: Prisma.Decimal;
      giftCardCode?: string | null;
      giftCardAmount?: Prisma.Decimal;
      referralCode?: string | null;
      referralDiscount?: Prisma.Decimal;
      membershipDiscount?: Prisma.Decimal;
      taxAmount?: Prisma.Decimal;
      taxRate?: Prisma.Decimal;
      taxDetails?: Prisma.InputJsonValue;
      tipAmount?: Prisma.Decimal;
      totalAmount?: Prisma.Decimal;
      paymentMethod?: string;
      paymentStatus?: string;
      orderDate?: Date;
      staffId?: string | null;
      notes?: string | null;
      instruction?: string | null;
    }>,
    items?: Array<{
      itemType: string;
      serviceId?: string | null;
      productId?: string | null;
      staffId?: string | null;
      itemName: string;
      itemCategory?: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      total: Prisma.Decimal;
      notes?: string | null;
    }>,
    payments?: Array<{
      method: string;
      amount: Prisma.Decimal;
      referenceNumber?: string | null;
      status?: string;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.posOrder.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return null;
      }

      // If financial total changed and order is COMPLETED, adjust guest spend
      if (orderData.totalAmount !== undefined && existing.status === 'COMPLETED') {
        const diff = Number(orderData.totalAmount) - Number(existing.totalAmount);
        if (diff !== 0) {
          await tx.guest.update({
            where: { id: existing.guestId },
            data: {
              totalSpend: { increment: diff },
            },
          });
        }
      }

      // If items replaced
      if (items && items.length > 0) {
        await tx.posOrderItem.deleteMany({ where: { orderId: id, tenantId } });
        await tx.posOrderItem.createMany({
          data: items.map((item) => ({
            tenantId,
            orderId: id,
            itemType: item.itemType,
            serviceId: item.serviceId,
            productId: item.productId,
            staffId: item.staffId,
            itemName: item.itemName,
            itemCategory: item.itemCategory,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxAmount: item.taxAmount,
            subtotal: item.subtotal,
            total: item.total,
            notes: item.notes,
          })),
        });
      } else if (orderData.staffId) {
        // If staff reassigned without re-calculating whole items
        await tx.posOrderItem.updateMany({
          where: { orderId: id, tenantId },
          data: { staffId: orderData.staffId },
        });
      }

      // If payments replaced
      if (payments && payments.length > 0) {
        await tx.posPayment.deleteMany({ where: { orderId: id, tenantId } });
        await tx.posPayment.createMany({
          data: payments.map((p) => ({
            tenantId,
            orderId: id,
            method: p.method,
            amount: p.amount,
            referenceNumber: p.referenceNumber,
            status: p.status || 'SUCCESS',
          })),
        });
      }

      // Update order header (strip staffId which is for items)
      const { staffId: _staffIdToIgnore, ...fieldsToUpdate } = orderData;
      const updated = await tx.posOrder.update({
        where: { id },
        data: fieldsToUpdate,
        include: this.defaultIncludes,
      });

      return updated;
    });
  }

  async updateWhatsappStatus(tenantId: string, id: string, status: string) {
    return prisma.posOrder.updateMany({
      where: { id, tenantId },
      data: {
        whatsappStatus: status,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.posOrder.deleteMany({
      where: { id, tenantId },
    });
  }

  async getDashboardSummary(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const baseWhere: Prisma.PosOrderWhereInput = {
      tenantId,
    };

    if (dateFrom || dateTo) {
      baseWhere.orderDate = {};
      if (dateFrom) baseWhere.orderDate.gte = dateFrom;
      if (dateTo) baseWhere.orderDate.lte = dateTo;
    }

    const [newCount, acceptedCount, rejectedCount, completedCount, totalCount] = await Promise.all([
      prisma.posOrder.count({
        where: {
          ...baseWhere,
          status: { in: ['NEW', 'PENDING'] },
        },
      }),
      prisma.posOrder.count({
        where: {
          ...baseWhere,
          status: 'ACCEPTED',
        },
      }),
      prisma.posOrder.count({
        where: {
          ...baseWhere,
          status: 'REJECTED',
        },
      }),
      prisma.posOrder.count({
        where: {
          ...baseWhere,
          status: 'COMPLETED',
        },
      }),
      prisma.posOrder.count({
        where: baseWhere,
      }),
    ]);

    return {
      new: newCount,
      accepted: acceptedCount,
      rejected: rejectedCount,
      completed: completedCount,
      total: totalCount,
    };
  }

  async getStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const where: Prisma.PosOrderWhereInput = {
      tenantId,
      status: 'COMPLETED',
    };

    if (dateFrom || dateTo) {
      where.orderDate = {};
      if (dateFrom) where.orderDate.gte = dateFrom;
      if (dateTo) where.orderDate.lte = dateTo;
    }

    const [orders, countAgg, summary] = await Promise.all([
      prisma.posOrder.findMany({
        where,
        select: {
          id: true,
          totalAmount: true,
          subtotal: true,
          discountAmount: true,
          taxAmount: true,
          tipAmount: true,
          paymentMethod: true,
        },
      }),
      prisma.posOrder.aggregate({
        where,
        _sum: {
          totalAmount: true,
          subtotal: true,
          discountAmount: true,
          taxAmount: true,
          tipAmount: true,
        },
        _count: {
          id: true,
        },
      }),
      this.getDashboardSummary(tenantId, dateFrom, dateTo),
    ]);

    const totalOrders = countAgg._count.id || 0;
    const totalSales = Number(countAgg._sum.totalAmount || 0);
    const totalSubtotal = Number(countAgg._sum.subtotal || 0);
    const totalDiscounts = Number(countAgg._sum.discountAmount || 0);
    const totalTaxes = Number(countAgg._sum.taxAmount || 0);
    const totalTips = Number(countAgg._sum.tipAmount || 0);
    const averageOrderValue = totalOrders > 0 ? Number((totalSales / totalOrders).toFixed(2)) : 0;

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    for (const ord of orders) {
      const method = ord.paymentMethod || 'CASH';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + Number(ord.totalAmount);
    }

    return {
      totalOrders,
      totalSales,
      totalSubtotal,
      totalDiscounts,
      totalTaxes,
      totalTips,
      averageOrderValue,
      paymentBreakdown,
      statusSummary: summary,
    };
  }
}

export const posRepository = new PosRepository();
