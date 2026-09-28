import { prisma } from '../../config/database.js';
import { CreatePurchaseOrderInput, CreateTransferRequestInput, CreateVendorInput, SingleReconcileInput, UpdatePurchaseOrderInput, UpdateTransferRequestInput, UpdateVendorInput } from './inventory.dto.js';
import { Decimal } from '@prisma/client/runtime/library';

export class InventoryRepository {
  // ==========================================
  // DASHBOARD
  // ==========================================
  async getDashboardStats(tenantId: string) {
    // 1. PO Counts
    const [pendingPoCount, approvedPoCount, rejectedPoCount] = await Promise.all([
      prisma.purchaseOrder.count({ where: { tenantId, status: 'PLACED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'APPROVED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'REJECTED' } }),
    ]);

    // 2. Product Summary & Stock In Hand
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: {
        stockTransactions: true,
      },
    });

    let totalStockInHand = 0;
    let minStockCount = 0;
    let activeProducts = 0;
    let inactiveProducts = 0;

    for (const p of products) {
      if (p.isActive) activeProducts++;
      else inactiveProducts++;

      let inward = 0;
      let outward = 0;
      for (const t of p.stockTransactions) {
        if (t.type === 'INWARD' || t.type === 'RECONCILED') {
          inward += Number(t.quantity);
        } else {
          outward += Number(t.quantity);
        }
      }
      const currentStock = Math.max(0, inward - outward);
      totalStockInHand += currentStock;
      if (currentStock <= 5) {
        minStockCount++;
      }
    }

    // 3. Stock Yet To Be Received (from active POs)
    const activePos = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: ['PLACED', 'APPROVED', 'PARTIAL_SETTLED'] },
      },
      include: { items: true },
    });

    let stockYetToBeReceived = 0;
    for (const po of activePos) {
      for (const it of po.items) {
        const remaining = it.requiredQty - it.receivedQty;
        if (remaining > 0) stockYetToBeReceived += remaining;
      }
    }

    // 4. Transfer Request Counts
    const [inRequestedTrCount, inApprovedTrCount, inRejectedTrCount, stockTransferReportCount] = await Promise.all([
      prisma.transferRequest.count({ where: { tenantId, status: 'REQUESTED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'APPROVED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'REJECTED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'RECEIVED' } }),
    ]);

    // 5. Top Selling Items
    const topSales = await prisma.posOrderItem.groupBy({
      by: ['productId'],
      where: {
        tenantId,
        productId: { not: null },
        order: { status: { not: 'CANCELLED' } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    });

    const topSellingItems: any[] = [];
    for (const item of topSales) {
      if (!item.productId) continue;
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (product) {
        const images = Array.isArray(product.displayImages) ? (product.displayImages as string[]) : [];
        topSellingItems.push({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          imageUrl: images[0] || null,
          itemsSold: item._sum.quantity || 0,
        });
      }
    }

    return {
      pendingPoCount,
      approvedPoCount,
      rejectedPoCount,
      minStockItemCount: minStockCount,
      inventorySummary: {
        stockInHand: totalStockInHand,
        stockYetToBeReceived,
      },
      productSummary: {
        totalItems: products.length,
        activeItems: activeProducts,
        inactiveItems: inactiveProducts,
      },
      transferRequest: {
        inRequestedTrCount,
        inApprovedTrCount,
        inRejectedTrCount,
        stockTransferReportCount,
      },
      topSellingItems,
    };
  }

  // ==========================================
  // VENDORS
  // ==========================================
  async getVendors(tenantId: string, search?: string, isActive?: boolean, page = 1, limit = 50) {
    const where: any = { tenantId };
    if (isActive !== undefined) where.isActive = isActive;
    if (search && search.trim()) {
      where.OR = [
        { firmName: { contains: search.trim(), mode: 'insensitive' } },
        { vendorName: { contains: search.trim(), mode: 'insensitive' } },
        { mobile: { contains: search.trim() } },
        { city: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, vendors] = await Promise.all([
      prisma.vendor.count({ where }),
      prisma.vendor.findMany({
        where,
        include: {
          _count: { select: { purchaseOrders: true } },
        },
        orderBy: { firmName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      vendors,
      total,
      page,
      limit,
    };
  }

  async getVendorById(tenantId: string, id: string) {
    return prisma.vendor.findFirst({
      where: { tenantId, id },
      include: {
        vendorItems: {
          include: { product: true, disposable: true },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async getVendorByFirmName(tenantId: string, firmName: string) {
    return prisma.vendor.findFirst({
      where: {
        tenantId,
        firmName: { equals: firmName.trim(), mode: 'insensitive' },
      },
    });
  }

  async getVendorByMobile(tenantId: string, mobile: string) {
    return prisma.vendor.findFirst({
      where: {
        tenantId,
        mobile: mobile.trim(),
      },
    });
  }

  async getVendorByEmail(tenantId: string, email: string) {
    return prisma.vendor.findFirst({
      where: {
        tenantId,
        email: { equals: email.trim(), mode: 'insensitive' },
      },
    });
  }

  async createVendor(tenantId: string, data: CreateVendorInput) {
    return prisma.vendor.create({
      data: {
        tenantId,
        vendorName: data.vendorName.trim(),
        firmName: data.firmName.trim(),
        mobile: data.mobile.trim(),
        alternateMobile: data.alternateMobile ? data.alternateMobile.trim() : null,
        email: data.email ? data.email.trim() : null,
        gstNumber: data.gstNumber ? data.gstNumber.trim().toUpperCase() : null,
        address: data.address.trim(),
        area: data.area ? data.area.trim() : null,
        landmark: data.landmark ? data.landmark.trim() : null,
        city: data.city.trim(),
        pincode: data.pincode ? data.pincode.trim() : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async updateVendor(tenantId: string, id: string, data: UpdateVendorInput) {
    return prisma.vendor.update({
      where: { id },
      data: {
        ...(data.vendorName && { vendorName: data.vendorName.trim() }),
        ...(data.firmName && { firmName: data.firmName.trim() }),
        ...(data.mobile && { mobile: data.mobile.trim() }),
        ...(data.alternateMobile !== undefined && { alternateMobile: data.alternateMobile ? data.alternateMobile.trim() : null }),
        ...(data.email !== undefined && { email: data.email ? data.email.trim() : null }),
        ...(data.gstNumber !== undefined && { gstNumber: data.gstNumber ? data.gstNumber.trim().toUpperCase() : null }),
        ...(data.address && { address: data.address.trim() }),
        ...(data.area !== undefined && { area: data.area ? data.area.trim() : null }),
        ...(data.landmark !== undefined && { landmark: data.landmark ? data.landmark.trim() : null }),
        ...(data.city && { city: data.city.trim() }),
        ...(data.pincode !== undefined && { pincode: data.pincode ? data.pincode.trim() : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async deleteVendor(tenantId: string, id: string) {
    return prisma.vendor.delete({
      where: { id },
    });
  }

  async setVendorItems(tenantId: string, vendorId: string, items: Array<{ productId?: string | null; disposableId?: string | null; price: number }>) {
    return prisma.$transaction(async (tx) => {
      // Remove existing mapped items
      await tx.vendorItem.deleteMany({ where: { tenantId, vendorId } });

      // Create new items
      const created = [];
      for (const it of items) {
        const item = await tx.vendorItem.create({
          data: {
            tenantId,
            vendorId,
            productId: it.productId || null,
            disposableId: it.disposableId || null,
            price: it.price,
          },
        });
        created.push(item);
      }
      return created;
    });
  }

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================
  async generateNextPoNumber(tenantId: string): Promise<string> {
    const count = await prisma.purchaseOrder.count({ where: { tenantId } });
    return `Inv/Po/${count + 1}`;
  }

  async createPurchaseOrder(tenantId: string, data: CreatePurchaseOrderInput) {
    const poNumber = await this.generateNextPoNumber(tenantId);
    let totalItems = 0;
    let totalValue = 0;

    // Fetch product details for lines
    const lineData: any[] = [];
    for (const it of data.items) {
      const product = await prisma.product.findFirst({
        where: { tenantId, id: it.productId },
        include: { stockTransactions: true },
      });
      if (!product) continue;

      let inward = 0;
      let outward = 0;
      for (const t of product.stockTransactions) {
        if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += Number(t.quantity);
        else outward += Number(t.quantity);
      }
      const inStock = Math.max(0, inward - outward);

      const lineTotal = Number((it.requiredQty * it.price).toFixed(2));
      const srvPercent = it.servicesPercent || 0;
      const srvAmount = Number(((lineTotal * srvPercent) / 100).toFixed(2));

      totalItems += it.requiredQty;
      totalValue += lineTotal;

      lineData.push({
        tenantId,
        productId: product.id,
        itemName: product.name,
        inStock,
        requiredQty: it.requiredQty,
        price: it.price,
        servicesPercent: srvPercent,
        servicesAmount: srvAmount,
        totalValue: lineTotal,
      });
    }

    return prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        vendorId: data.vendorId,
        status: 'PLACED',
        poDate: data.poDate ? new Date(data.poDate) : new Date(),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        totalItems,
        totalValue,
        comment: data.comment || null,
        items: {
          create: lineData,
        },
      },
      include: {
        vendor: true,
        items: true,
      },
    });
  }

  async getPurchaseOrders(
    tenantId: string,
    filters: {
      from?: string;
      to?: string;
      status?: string;
      search?: string;
      vendorId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const where: any = { tenantId };

    if (filters.status && filters.status !== 'ALL' && filters.status !== 'TOTAL') {
      where.status = filters.status;
    }

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters.from || filters.to) {
      where.poDate = {};
      if (filters.from) {
        const fromDate = new Date(filters.from);
        fromDate.setHours(0, 0, 0, 0);
        where.poDate.gte = fromDate;
      }
      if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        where.poDate.lte = toDate;
      }
    }

    if (filters.search && filters.search.trim()) {
      where.OR = [
        { poNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { vendor: { firmName: { contains: filters.search.trim(), mode: 'insensitive' } } },
        { vendor: { vendorName: { contains: filters.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    // Fetch tab counts across all statuses
    const [
      placedCount,
      approvedCount,
      rejectedCount,
      partialSettledCount,
      settledCount,
      cancelledCount,
      totalCount,
      totalMatching,
      orders,
    ] = await Promise.all([
      prisma.purchaseOrder.count({ where: { tenantId, status: 'PLACED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'APPROVED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'REJECTED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'PARTIAL_SETTLED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'SETTLED' } }),
      prisma.purchaseOrder.count({ where: { tenantId, status: 'CANCELLED' } }),
      prisma.purchaseOrder.count({ where: { tenantId } }),
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: true,
          items: true,
        },
        orderBy: { poDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      statusCounts: {
        placed: placedCount,
        approved: approvedCount,
        rejected: rejectedCount,
        partialSettled: partialSettledCount,
        settled: settledCount,
        cancelled: cancelledCount,
        total: totalCount,
      },
      orders,
      total: totalMatching,
      page,
      limit,
    };
  }

  async getPurchaseOrderById(tenantId: string, id: string) {
    return prisma.purchaseOrder.findFirst({
      where: { tenantId, id },
      include: {
        vendor: true,
        items: {
          include: { product: true },
        },
      },
    });
  }

  async updatePurchaseOrder(tenantId: string, id: string, data: UpdatePurchaseOrderInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { tenantId, id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error('Purchase order not found');
      }

      let totalItems = existing.totalItems;
      let totalValue = Number(existing.totalValue);

      if (data.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
        totalItems = 0;
        totalValue = 0;

        for (const it of data.items) {
          const product = await tx.product.findFirst({
            where: { tenantId, id: it.productId },
            include: { stockTransactions: true },
          });
          if (!product) continue;

          let inward = 0;
          let outward = 0;
          for (const t of product.stockTransactions) {
            if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += Number(t.quantity);
            else outward += Number(t.quantity);
          }
          const inStock = Math.max(0, inward - outward);
          const lineTotal = Number((it.requiredQty * it.price).toFixed(2));
          const srvPercent = it.servicesPercent || 0;
          const srvAmount = Number(((lineTotal * srvPercent) / 100).toFixed(2));

          totalItems += it.requiredQty;
          totalValue += lineTotal;

          await tx.purchaseOrderItem.create({
            data: {
              tenantId,
              poId: id,
              productId: product.id,
              itemName: product.name,
              inStock,
              requiredQty: it.requiredQty,
              price: it.price,
              servicesPercent: srvPercent,
              servicesAmount: srvAmount,
              totalValue: lineTotal,
            },
          });
        }
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(data.vendorId && { vendorId: data.vendorId }),
          ...(data.expectedDate !== undefined && { expectedDate: data.expectedDate ? new Date(data.expectedDate) : null }),
          ...(data.poDate !== undefined && { poDate: data.poDate ? new Date(data.poDate) : new Date() }),
          ...(data.comment !== undefined && { comment: data.comment }),
          totalItems,
          totalValue,
        },
        include: {
          vendor: true,
          items: true,
        },
      });
    });
  }

  async updatePoStatus(tenantId: string, id: string, status: string, rejectionReason?: string) {
    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        ...(rejectionReason !== undefined && { rejectionReason }),
        ...(status === 'APPROVED' && { approvedAt: new Date() }),
      },
      include: {
        vendor: true,
        items: true,
      },
    });
  }

  async receivePurchaseOrder(tenantId: string, id: string, receivedItems?: Array<{ itemId: string; receivedQty: number }>, comment?: string) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { tenantId, id },
        include: { items: true, vendor: true },
      });

      if (!po) {
        throw new Error('Purchase order not found');
      }

      let allSettled = true;

      for (const item of po.items) {
        let qtyToReceive = item.requiredQty - item.receivedQty;
        if (receivedItems && receivedItems.length > 0) {
          const match = receivedItems.find((r) => r.itemId === item.id);
          if (match) {
            qtyToReceive = match.receivedQty;
          }
        }

        if (qtyToReceive > 0) {
          const newReceivedQty = item.receivedQty + qtyToReceive;
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { receivedQty: newReceivedQty },
          });

          // Create INWARD stock transaction
          await tx.stockTransaction.create({
            data: {
              tenantId,
              productId: item.productId,
              type: 'INWARD',
              quantity: qtyToReceive,
              unitPrice: item.price,
              totalAmount: Number((qtyToReceive * Number(item.price)).toFixed(2)),
              vendorName: po.vendor.firmName,
              poNumber: po.poNumber,
              notes: comment || `Received against PO ${po.poNumber}`,
              transactionDate: new Date(),
            },
          });

          if (newReceivedQty < item.requiredQty) {
            allSettled = false;
          }
        }
      }

      const finalStatus = allSettled ? 'SETTLED' : 'PARTIAL_SETTLED';

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: finalStatus,
          receivedAt: new Date(),
          ...(comment && { comment }),
        },
        include: {
          vendor: true,
          items: true,
        },
      });
    });
  }

  // ==========================================
  // TRANSFER REQUESTS
  // ==========================================
  async generateNextTrNumber(tenantId: string): Promise<string> {
    const count = await prisma.transferRequest.count({ where: { tenantId } });
    return `Inv/Tr/${count + 1}`;
  }

  async createTransferRequest(tenantId: string, data: CreateTransferRequestInput, requestor = 'kalyaninagar') {
    const trNumber = await this.generateNextTrNumber(tenantId);
    let totalItems = 0;
    let totalValue = 0;

    const lineData: any[] = [];
    for (const it of data.items) {
      const product = await prisma.product.findFirst({
        where: { tenantId, id: it.productId },
        include: { stockTransactions: true },
      });
      if (!product) continue;

      let inward = 0;
      let outward = 0;
      for (const t of product.stockTransactions) {
        if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += Number(t.quantity);
        else outward += Number(t.quantity);
      }
      const inStock = Math.max(0, inward - outward);
      const lineTotal = Number((it.requestedQty * it.price).toFixed(2));

      totalItems += it.requestedQty;
      totalValue += lineTotal;

      lineData.push({
        tenantId,
        productId: product.id,
        itemName: product.name,
        inStock,
        requestedQty: it.requestedQty,
        price: it.price,
        totalValue: lineTotal,
      });
    }

    return prisma.transferRequest.create({
      data: {
        tenantId,
        trNumber,
        sender: data.sender.trim(),
        requestor: data.requestor ? data.requestor.trim() : requestor,
        status: 'REQUESTED',
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        totalItems,
        totalValue,
        comment: data.comment || null,
        items: {
          create: lineData,
        },
      },
      include: {
        items: true,
      },
    });
  }

  async getTransferRequests(
    tenantId: string,
    filters: {
      from?: string;
      to?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const where: any = { tenantId };

    if (filters.status && filters.status !== 'ALL') {
      if (filters.status === 'TRANSFER_IN') {
        where.status = { in: ['REQUESTED', 'APPROVED'] };
      } else if (filters.status === 'TRANSFER_OUT') {
        where.status = 'DISPATCHED';
      } else {
        where.status = filters.status;
      }
    }

    if (filters.search && filters.search.trim()) {
      where.OR = [
        { trNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { sender: { contains: filters.search.trim(), mode: 'insensitive' } },
        { requestor: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const [
      requestedCount,
      approvedCount,
      dispatchedCount,
      receivedCount,
      rejectedCount,
      cancelledCount,
      totalCount,
      totalMatching,
      requests,
    ] = await Promise.all([
      prisma.transferRequest.count({ where: { tenantId, status: 'REQUESTED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'APPROVED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'DISPATCHED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'RECEIVED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'REJECTED' } }),
      prisma.transferRequest.count({ where: { tenantId, status: 'CANCELLED' } }),
      prisma.transferRequest.count({ where: { tenantId } }),
      prisma.transferRequest.count({ where }),
      prisma.transferRequest.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      statusCounts: {
        transferIn: requestedCount + approvedCount,
        transferOut: dispatchedCount,
        dispatched: dispatchedCount,
        received: receivedCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
        total: totalCount,
      },
      requests,
      total: totalMatching,
      page,
      limit,
    };
  }

  async getTransferRequestById(tenantId: string, id: string) {
    return prisma.transferRequest.findFirst({
      where: { tenantId, id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
  }

  async updateTransferRequest(tenantId: string, id: string, data: UpdateTransferRequestInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.transferRequest.findFirst({
        where: { tenantId, id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error('Transfer request not found');
      }

      let totalItems = existing.totalItems;
      let totalValue = Number(existing.totalValue);

      if (data.items) {
        await tx.transferRequestItem.deleteMany({ where: { trId: id } });
        totalItems = 0;
        totalValue = 0;

        for (const it of data.items) {
          const product = await tx.product.findFirst({
            where: { tenantId, id: it.productId },
            include: { stockTransactions: true },
          });
          if (!product) continue;

          let inward = 0;
          let outward = 0;
          for (const t of product.stockTransactions) {
            if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += Number(t.quantity);
            else outward += Number(t.quantity);
          }
          const inStock = Math.max(0, inward - outward);
          const lineTotal = Number((it.requestedQty * it.price).toFixed(2));

          totalItems += it.requestedQty;
          totalValue += lineTotal;

          await tx.transferRequestItem.create({
            data: {
              tenantId,
              trId: id,
              productId: product.id,
              itemName: product.name,
              inStock,
              requestedQty: it.requestedQty,
              price: it.price,
              totalValue: lineTotal,
            },
          });
        }
      }

      return tx.transferRequest.update({
        where: { id },
        data: {
          ...(data.sender && { sender: data.sender.trim() }),
          ...(data.expectedDate !== undefined && { expectedDate: data.expectedDate ? new Date(data.expectedDate) : null }),
          ...(data.comment !== undefined && { comment: data.comment }),
          totalItems,
          totalValue,
        },
        include: { items: true },
      });
    });
  }

  async updateTrStatus(tenantId: string, id: string, status: string, rejectionReason?: string) {
    return prisma.transferRequest.update({
      where: { id },
      data: {
        status,
        ...(rejectionReason !== undefined && { rejectionReason }),
        ...(status === 'APPROVED' && { approvedAt: new Date() }),
        ...(status === 'DISPATCHED' && { dispatchedAt: new Date() }),
      },
      include: { items: true },
    });
  }

  async receiveTransferRequest(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const tr = await tx.transferRequest.findFirst({
        where: { tenantId, id },
        include: { items: true },
      });

      if (!tr) throw new Error('Transfer request not found');

      for (const item of tr.items) {
        // Record transfer stock transaction
        await tx.stockTransaction.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'TRANSFER',
            quantity: item.requestedQty,
            unitPrice: item.price,
            totalAmount: item.totalValue,
            sourceStore: tr.sender,
            destinationStore: tr.requestor,
            notes: `Received from Transfer Request ${tr.trNumber}`,
            transactionDate: new Date(),
          },
        });

        await tx.transferRequestItem.update({
          where: { id: item.id },
          data: { transferredQty: item.requestedQty },
        });
      }

      return tx.transferRequest.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  // ==========================================
  // APPROVALS (CENTRALIZED INBOX)
  // ==========================================
  async getPendingApprovals(tenantId: string) {
    const [purchaseOrders, transferRequests] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { tenantId, status: 'PLACED' },
        include: {
          vendor: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transferRequest.findMany({
        where: { tenantId, status: 'REQUESTED' },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      counts: {
        purchaseOrders: purchaseOrders.length,
        transferRequests: transferRequests.length,
        total: purchaseOrders.length + transferRequests.length,
      },
      purchaseOrders,
      transferRequests,
    };
  }

  // ==========================================
  // STOCK RECONCILIATION
  // ==========================================
  async getReconciliationItems(tenantId: string, search?: string, categoryId?: string, type = 'ALL') {
    const productWhere: any = { tenantId };
    if (categoryId && categoryId !== 'All' && categoryId !== 'ALL') {
      productWhere.categoryId = categoryId;
    }
    if (search && search.trim()) {
      productWhere.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const disposableWhere: any = { tenantId };
    if (search && search.trim()) {
      disposableWhere.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const items: any[] = [];

    // 1. Fetch Products
    if (type === 'ALL' || type === 'PRODUCT') {
      const products = await prisma.product.findMany({
        where: productWhere,
        include: {
          category: true,
          stockTransactions: true,
        },
        orderBy: { name: 'asc' },
      });

      for (const p of products) {
        let inward = 0;
        let outward = 0;
        let consumableUsed = 0;

        for (const t of p.stockTransactions) {
          const qty = Number(t.quantity);
          if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += qty;
          else if (t.type === 'CONSUMED') consumableUsed += qty;
          else outward += qty;
        }

        const actualStock = Math.max(0, inward - outward);
        const price = Number(p.price);
        const stockValue = Number((actualStock * price).toFixed(2));

        items.push({
          id: p.id,
          type: 'PRODUCT',
          categoryName: p.category?.name || 'General',
          itemName: p.name,
          actualStock,
          adjustStock: actualStock,
          stockDifference: 0,
          stockValue,
          actualConsumable: consumableUsed,
          adjustConsumable: consumableUsed,
          unit: 'ml',
          consumableDifference: 0,
          remark: '',
        });
      }
    }

    // 2. Fetch Disposables
    if (type === 'ALL' || type === 'DISPOSABLE') {
      const disposables = await prisma.disposable.findMany({
        where: disposableWhere,
        include: {
          productCategory: true,
          stockTransactions: true,
        },
        orderBy: { name: 'asc' },
      });

      for (const d of disposables) {
        let inward = 0;
        let outward = 0;
        for (const t of d.stockTransactions) {
          const qty = Number(t.quantity);
          if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += qty;
          else outward += qty;
        }

        const actualStock = Math.max(0, inward - outward);
        const price = Number(d.price);
        const stockValue = Number((actualStock * price).toFixed(2));

        items.push({
          id: d.id,
          type: 'DISPOSABLE',
          categoryName: d.productCategory?.name || d.category || 'Disposables',
          itemName: d.name,
          actualStock,
          adjustStock: actualStock,
          stockDifference: 0,
          stockValue,
          actualConsumable: 0,
          adjustConsumable: 0,
          unit: d.unit || 'pcs',
          consumableDifference: 0,
          remark: '',
        });
      }
    }

    return items;
  }

  async adjustItemStock(tenantId: string, input: SingleReconcileInput, staffId?: string) {
    const diff = input.adjustStock - input.actualStock;

    return prisma.$transaction(async (tx) => {
      let unitPrice = 0;

      if (input.itemType === 'PRODUCT') {
        const product = await tx.product.findFirst({
          where: { tenantId, id: input.itemId },
        });
        if (product) unitPrice = Number(product.price);
      } else {
        const disposable = await tx.disposable.findFirst({
          where: { tenantId, id: input.itemId },
        });
        if (disposable) unitPrice = Number(disposable.price);
      }

      let validStaffId: string | null = null;
      if (staffId) {
        const staff = await tx.staff.findFirst({ where: { tenantId, id: staffId } });
        if (staff) validStaffId = staff.id;
      }

      const txType = diff >= 0 ? 'INWARD' : 'OUTWARD';

      const txRecord = await tx.stockTransaction.create({
        data: {
          tenantId,
          productId: input.itemType === 'PRODUCT' ? input.itemId : null,
          disposableId: input.itemType === 'DISPOSABLE' ? input.itemId : null,
          type: txType,
          quantity: Math.abs(diff),
          unitPrice,
          totalAmount: Number((Math.abs(diff) * unitPrice).toFixed(2)),
          staffId: validStaffId,
          notes: `Reconciliation Adjustment (${diff >= 0 ? 'Stock Increased' : 'Stock Decreased'}): ${input.remark}. Previous: ${input.actualStock}, New: ${input.adjustStock}, Diff: ${diff}`,
          transactionDate: new Date(),
        },
      });

      return {
        success: true,
        itemId: input.itemId,
        itemType: input.itemType,
        previousStock: input.actualStock,
        newStock: input.adjustStock,
        difference: diff,
        transactionId: txRecord.id,
      };
    });
  }

  async bulkAdjustStock(tenantId: string, items: SingleReconcileInput[], staffId?: string) {
    const results = [];
    for (const item of items) {
      const res = await this.adjustItemStock(tenantId, item, staffId);
      results.push(res);
    }
    return results;
  }

  // ==========================================
  // VENDOR ITEMS
  // ==========================================
  async getVendorItems(tenantId: string, vendorId: string) {
    return prisma.vendorItem.findMany({
      where: { tenantId, vendorId },
      include: {
        product: {
          include: { category: true },
        },
        disposable: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // DELETIONS
  // ==========================================
  async deletePurchaseOrder(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({
        where: { tenantId, poId: id },
      });
      return tx.purchaseOrder.delete({
        where: { id },
      });
    });
  }

  async deleteTransferRequest(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.transferRequestItem.deleteMany({
        where: { tenantId, trId: id },
      });
      return tx.transferRequest.delete({
        where: { id },
      });
    });
  }
}

export const inventoryRepository = new InventoryRepository();
