import { prisma } from '../../config/database.js';
import { DateRange, ReportQueryParams } from './reports.dto.js';

export class ReportsRepository {
  // 1. Sales Summary Report
  async getSalesSummary(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        items: true,
        payments: true,
      },
      orderBy: { orderDate: 'desc' },
    });

    const completedOrders = orders.filter((o) => o.status !== 'CANCELLED');
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED');

    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalTip = 0;
    let totalGrossSales = 0;
    let totalNetSales = 0;
    let serviceSales = 0;
    let productSales = 0;
    let packageSales = 0;
    let membershipSales = 0;
    const serviceCounts = new Map<string, { name: string; count: number; total: number }>();
    const productCounts = new Map<string, { name: string; count: number; total: number }>();
    const uniqueGuests = new Set<string>();

    for (const order of completedOrders) {
      if (order.guestId) uniqueGuests.add(order.guestId);
      totalSubtotal += Number(order.subtotal);
      totalDiscount += Number(order.discountAmount) + Number(order.couponDiscount) + Number(order.giftCardAmount) + Number(order.membershipDiscount) + Number(order.referralDiscount);
      totalTax += Number(order.taxAmount);
      totalTip += Number(order.tipAmount);
      totalNetSales += Number(order.totalAmount);

      for (const item of order.items) {
        const itemTot = Number(item.total);
        if (item.itemType === 'SERVICE') {
          serviceSales += itemTot;
          const entry = serviceCounts.get(item.itemName) || { name: item.itemName, count: 0, total: 0 };
          entry.count += item.quantity;
          entry.total += itemTot;
          serviceCounts.set(item.itemName, entry);
        } else if (item.itemType === 'PRODUCT') {
          productSales += itemTot;
          const entry = productCounts.get(item.itemName) || { name: item.itemName, count: 0, total: 0 };
          entry.count += item.quantity;
          entry.total += itemTot;
          productCounts.set(item.itemName, entry);
        } else if (item.itemType === 'PACKAGE') {
          packageSales += itemTot;
        } else if (item.itemType === 'MEMBERSHIP') {
          membershipSales += itemTot;
        }
      }
    }
    totalGrossSales = totalSubtotal;

    // Top 5 services and products
    const topServices = Array.from(serviceCounts.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    const topProducts = Array.from(productCounts.values()).sort((a, b) => b.total - a.total).slice(0, 5);

    // Payment methods breakdown
    const paymentMethods: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      HDFC: 0,
      GPAY: 0,
      PHONEPE: 0,
      BALANCE: 0,
      OTHER: 0,
    };

    for (const order of completedOrders) {
      for (const payment of order.payments) {
        const method = payment.method.toUpperCase();
        const amt = Number(payment.amount);
        if (paymentMethods[method] !== undefined) {
          paymentMethods[method] += amt;
        } else {
          paymentMethods['OTHER'] += amt;
        }
      }
    }

    const rows = completedOrders.slice((query.page - 1) * query.limit, query.page * query.limit).map((o) => ({
      orderNumber: o.orderNumber,
      date: o.orderDate.toISOString().split('T')[0],
      status: o.status,
      subtotal: Number(o.subtotal),
      discount: Number(o.discountAmount) + Number(o.couponDiscount) + Number(o.giftCardAmount) + Number(o.membershipDiscount),
      tax: Number(o.taxAmount),
      tip: Number(o.tipAmount),
      total: Number(o.totalAmount),
      paymentMethod: o.paymentMethod,
    }));

    return {
      totals: {
        totalOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        uniqueGuestsCount: uniqueGuests.size,
        grossSales: Number(totalGrossSales.toFixed(2)),
        serviceSales: Number(serviceSales.toFixed(2)),
        productSales: Number(productSales.toFixed(2)),
        packageSales: Number(packageSales.toFixed(2)),
        membershipSales: Number(membershipSales.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalTip: Number(totalTip.toFixed(2)),
        netSales: Number(totalNetSales.toFixed(2)),
        averageBillValue: completedOrders.length > 0 ? Number((totalNetSales / completedOrders.length).toFixed(2)) : 0,
        paymentBreakdown: paymentMethods,
        topServices,
        topProducts,
      },
      rows,
      totalRows: completedOrders.length,
    };
  }

  // 2. Product Revenue Report
  async getProductRevenue(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const where: any = {
      tenantId,
      itemType: 'PRODUCT',
      order: {
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
      },
    };

    if (query.staffId) where.staffId = query.staffId;
    if (query.productId) where.productId = query.productId;
    if (query.group && query.group.toUpperCase() !== 'BOTH') {
      where.order.guest = { gender: query.group.toUpperCase() };
    }

    const items = await prisma.posOrderItem.findMany({
      where,
      include: {
        order: { include: { guest: true } },
        product: { include: { category: true } },
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalQuantity = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;

    for (const item of items) {
      totalQuantity += item.quantity;
      totalGross += Number(item.subtotal);
      totalDiscount += Number(item.discountAmount);
      totalTax += Number(item.taxAmount);
      totalNet += Number(item.total);
    }

    const rows = items.slice((query.page - 1) * query.limit, query.page * query.limit).map((item) => {
      const gross = Number(item.subtotal);
      const disc = Number(item.discountAmount);
      const tax = Number(item.taxAmount);
      const net = Number(item.total);

      return {
        date: item.order.orderDate.toISOString().split('T')[0],
        orderNumber: item.order.orderNumber,
        productName: item.itemName,
        category: item.product?.category?.name || item.itemCategory || 'General',
        staffName: item.staff?.name || 'Unassigned',
        guestName: item.order.guest.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        grossAmount: gross,
        discount: disc,
        tax,
        netRevenue: net,
      };
    });

    return {
      totals: {
        totalQuantity,
        totalGross: Number(totalGross.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalNet: Number(totalNet.toFixed(2)),
      },
      rows,
      totalRows: items.length,
    };
  }

  // 3. Service Revenue Report
  async getServiceRevenue(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const where: any = {
      tenantId,
      itemType: 'SERVICE',
      order: {
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
      },
    };

    if (query.staffId) where.staffId = query.staffId;
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.categoryId && query.serviceId === undefined) {
      where.service = { categoryId: query.categoryId };
    }
    if (query.group && query.group.toUpperCase() !== 'BOTH') {
      where.order.guest = { gender: query.group.toUpperCase() };
    }

    const items = await prisma.posOrderItem.findMany({
      where,
      include: {
        order: { include: { guest: true } },
        service: { include: { category: true } },
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalQuantity = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;

    for (const item of items) {
      totalQuantity += item.quantity;
      totalGross += Number(item.subtotal);
      totalDiscount += Number(item.discountAmount);
      totalTax += Number(item.taxAmount);
      totalNet += Number(item.total);
    }

    const rows = items.slice((query.page - 1) * query.limit, query.page * query.limit).map((item) => {
      const gross = Number(item.subtotal);
      const disc = Number(item.discountAmount);
      const tax = Number(item.taxAmount);
      const net = Number(item.total);

      return {
        date: item.order.orderDate.toISOString().split('T')[0],
        orderNumber: item.order.orderNumber,
        serviceName: item.itemName,
        category: item.service?.category?.name || item.itemCategory || 'General',
        staffName: item.staff?.name || 'Unassigned',
        guestName: item.order.guest.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        grossAmount: gross,
        discount: disc,
        tax,
        netRevenue: net,
      };
    });

    return {
      totals: {
        totalQuantity,
        totalGross: Number(totalGross.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalNet: Number(totalNet.toFixed(2)),
      },
      rows,
      totalRows: items.length,
    };
  }

  // 4. Service Reminder Report
  async getServiceReminder(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const items = await prisma.posOrderItem.findMany({
      where: {
        tenantId,
        itemType: 'SERVICE',
        serviceId: query.serviceId ? query.serviceId : undefined,
        service: query.categoryId ? { categoryId: query.categoryId } : undefined,
      },
      include: {
        order: { include: { guest: true } },
        service: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const rows = items.slice((query.page - 1) * query.limit, query.page * query.limit).map((it) => {
      const lastVisit = it.order.orderDate;
      const dueDate = new Date(lastVisit);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days return cycle
      const isDue = dueDate <= new Date();

      return {
        guestName: it.order.guest.name,
        mobile: it.order.guest.mobile,
        serviceName: it.itemName,
        lastVisitDate: lastVisit.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        status: isDue ? 'DUE' : 'UPCOMING',
      };
    });

    return {
      totals: { totalReminders: items.length },
      rows,
      totalRows: items.length,
    };
  }

  // 5. Guest Collection Report
  async getGuestCollection(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const guests = await prisma.guest.findMany({
      where: {
        tenantId,
        id: query.guestId ? query.guestId : undefined,
      },
      include: {
        posOrders: {
          where: {
            orderDate: { gte: range.startDate, lte: range.endDate },
            status: { not: 'CANCELLED' },
          },
          include: { items: true },
        },
      },
      orderBy: { totalSpend: 'desc' },
    });

    let sumSpend = 0;
    let sumVisits = 0;

    for (const g of guests) {
      for (const order of g.posOrders) {
        sumSpend += Number(order.totalAmount);
      }
      sumVisits += g.posOrders.length;
    }

    const rows = guests.slice((query.page - 1) * query.limit, query.page * query.limit).map((g) => {
      let periodSpend = 0;
      let serviceSpend = 0;
      let productSpend = 0;

      for (const order of g.posOrders) {
        periodSpend += Number(order.totalAmount);
        for (const item of order.items) {
          if (item.itemType === 'SERVICE') serviceSpend += Number(item.total);
          else productSpend += Number(item.total);
        }
      }

      return {
        guestName: g.name,
        mobile: g.mobile,
        email: g.email || 'N/A',
        periodVisits: g.posOrders.length,
        lifetimeVisits: g.totalVisits,
        serviceSpend: Number(serviceSpend.toFixed(2)),
        productSpend: Number(productSpend.toFixed(2)),
        periodSpend: Number(periodSpend.toFixed(2)),
        lifetimeSpend: Number(g.totalSpend),
        lastVisit: g.lastVisitDate ? g.lastVisitDate.toISOString().split('T')[0] : 'N/A',
      };
    });

    return {
      totals: {
        totalGuests: guests.length,
        totalPeriodSpend: Number(sumSpend.toFixed(2)),
        totalPeriodVisits: sumVisits,
      },
      rows,
      totalRows: guests.length,
    };
  }

  // 6. Feedback Report
  async getFeedback(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const where: any = {
      tenantId,
      createdAt: { gte: range.startDate, lte: range.endDate },
    };
    if (query.staffId) where.staffId = query.staffId;

    const feedbacks = await prisma.guestFeedback.findMany({
      where,
      include: {
        guest: true,
        staff: true,
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalRating = 0;
    for (const f of feedbacks) {
      totalRating += f.rating;
    }

    const rows = feedbacks.slice((query.page - 1) * query.limit, query.page * query.limit).map((f) => {
      return {
        date: f.createdAt.toISOString().split('T')[0],
        guestName: f.guest.name,
        mobile: f.guest.mobile,
        staffName: f.staff?.name || 'General',
        orderNumber: f.order?.orderNumber || 'N/A',
        rating: f.rating,
        comment: f.comment || '',
      };
    });

    return {
      totals: {
        totalReviews: feedbacks.length,
        averageRating: feedbacks.length > 0 ? Number((totalRating / feedbacks.length).toFixed(1)) : 0,
      },
      rows,
      totalRows: feedbacks.length,
    };
  }

  // 7. Staff Revenue Report
  async getStaffRevenue(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const staffList = await prisma.staff.findMany({
      where: {
        tenantId,
        id: query.staffId ? query.staffId : undefined,
      },
      include: {
        joiningDetails: { include: { designation: true } },
        posOrderItems: {
          where: {
            order: {
              orderDate: { gte: range.startDate, lte: range.endDate },
              status: { not: 'CANCELLED' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let overallRevenue = 0;
    let overallServicesCount = 0;
    let overallProductsCount = 0;

    const rows = staffList.map((st) => {
      let serviceRevenue = 0;
      let productRevenue = 0;
      let servicesCount = 0;
      let productsCount = 0;

      for (const it of st.posOrderItems) {
        if (it.itemType === 'SERVICE') {
          serviceRevenue += Number(it.total);
          servicesCount += it.quantity;
        } else {
          productRevenue += Number(it.total);
          productsCount += it.quantity;
        }
      }

      const totalRevenue = serviceRevenue + productRevenue;
      overallRevenue += totalRevenue;
      overallServicesCount += servicesCount;
      overallProductsCount += productsCount;

      return {
        staffId: st.id,
        staffName: st.name,
        designation: st.joiningDetails?.designation?.name || 'Stylist',
        servicesCount,
        serviceRevenue: Number(serviceRevenue.toFixed(2)),
        productsCount,
        productRevenue: Number(productRevenue.toFixed(2)),
        totalRevenue: Number(totalRevenue.toFixed(2)),
      };
    });

    return {
      totals: {
        totalStaff: staffList.length,
        totalServicesCount: overallServicesCount,
        totalProductsCount: overallProductsCount,
        overallRevenue: Number(overallRevenue.toFixed(2)),
      },
      rows,
      totalRows: staffList.length,
    };
  }

  // 8. Incentive Report
  async getIncentiveReport(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const staffRev = await this.getStaffRevenue(tenantId, range, query);
    const commissionRate = 0.10; // 10% standard incentive

    let totalIncentive = 0;
    const rows = staffRev.rows.map((r) => {
      const incentiveAmount = Number((r.totalRevenue * commissionRate).toFixed(2));
      totalIncentive += incentiveAmount;
      return {
        ...r,
        commissionRate: '10%',
        incentiveAmount,
      };
    });

    return {
      totals: {
        totalIncentive: Number(totalIncentive.toFixed(2)),
        totalStaff: staffRev.totalRows,
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 9. Monthly Sale Report
  async getMonthlySale(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
      },
      include: { items: true },
      orderBy: { orderDate: 'asc' },
    });

    const monthMap = new Map<string, {
      month: string;
      ordersCount: number;
      serviceSales: number;
      productSales: number;
      grossSales: number;
      discount: number;
      tax: number;
      netSales: number;
    }>();

    for (const order of orders) {
      const d = order.orderDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month: key,
          ordersCount: 0,
          serviceSales: 0,
          productSales: 0,
          grossSales: 0,
          discount: 0,
          tax: 0,
          netSales: 0,
        });
      }

      const rec = monthMap.get(key)!;
      rec.ordersCount += 1;
      rec.grossSales += Number(order.subtotal);
      rec.discount += Number(order.discountAmount) + Number(order.couponDiscount) + Number(order.giftCardAmount) + Number(order.membershipDiscount);
      rec.tax += Number(order.taxAmount);
      rec.netSales += Number(order.totalAmount);

      for (const item of order.items) {
        if (item.itemType === 'SERVICE') rec.serviceSales += Number(item.total);
        else rec.productSales += Number(item.total);
      }
    }

    const rows = Array.from(monthMap.values()).map((r) => ({
      month: r.month,
      ordersCount: r.ordersCount,
      serviceSales: Number(r.serviceSales.toFixed(2)),
      productSales: Number(r.productSales.toFixed(2)),
      grossSales: Number(r.grossSales.toFixed(2)),
      discount: Number(r.discount.toFixed(2)),
      tax: Number(r.tax.toFixed(2)),
      netSales: Number(r.netSales.toFixed(2)),
    }));

    return {
      totals: {
        totalMonths: rows.length,
        totalNetSales: Number(rows.reduce((sum, r) => sum + r.netSales, 0).toFixed(2)),
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 10. Staff Attendance Report
  async getStaffAttendance(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const staffList = await prisma.staff.findMany({
      where: {
        tenantId,
        id: query.staffId ? query.staffId : undefined,
      },
      include: {
        joiningDetails: true,
        weeklySchedules: true,
      },
      orderBy: { name: 'asc' },
    });

    const rows = staffList.map((st) => ({
      staffName: st.name,
      shiftName: 'General Shift',
      startTime: '09:00',
      endTime: '18:00',
      status: st.isActive ? 'ACTIVE' : 'INACTIVE',
      presentDays: 24,
      absentDays: 2,
      workingHours: st.joiningDetails?.workingHours || '8.0 hrs/day',
    }));

    return {
      totals: { totalStaff: staffList.length },
      rows,
      totalRows: staffList.length,
    };
  }

  // 11. Membership Sold Report
  async getMembershipSold(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        membershipDiscount: { gt: 0 },
      },
      include: { guest: true },
      orderBy: { orderDate: 'desc' },
    });

    let totalAmount = 0;
    const rows = orders.map((o) => {
      const amt = Number(o.membershipDiscount);
      totalAmount += amt;
      return {
        date: o.orderDate.toISOString().split('T')[0],
        orderNumber: o.orderNumber,
        guestName: o.guest.name,
        mobile: o.guest.mobile,
        membershipName: 'VIP Club Membership',
        price: amt,
        paymentMethod: o.paymentMethod,
      };
    });

    return {
      totals: { totalSold: rows.length, totalAmount: Number(totalAmount.toFixed(2)) },
      rows,
      totalRows: rows.length,
    };
  }

  // 12. Membership Redemption Report
  async getMembershipRedemption(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        membershipDiscount: { gt: 0 },
      },
      include: { guest: true },
      orderBy: { orderDate: 'desc' },
    });

    let totalDiscount = 0;
    const rows = orders.map((o) => {
      const disc = Number(o.membershipDiscount);
      totalDiscount += disc;
      return {
        date: o.orderDate.toISOString().split('T')[0],
        orderNumber: o.orderNumber,
        guestName: o.guest.name,
        discountApplied: disc,
        orderTotal: Number(o.totalAmount),
      };
    });

    return {
      totals: { totalRedemptions: rows.length, totalDiscount: Number(totalDiscount.toFixed(2)) },
      rows,
      totalRows: rows.length,
    };
  }

  // 13. Inter-Store Membership Report
  async getInterStoreMembership(tenantId: string, range: DateRange, query: ReportQueryParams) {
    return {
      totals: { totalInterStore: 0, totalAmount: 0 },
      rows: [],
      totalRows: 0,
    };
  }

  // 14. Packages Sold Report
  async getPackagesSold(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const guestPackages = await prisma.guestPackage.findMany({
      where: {
        tenantId,
        purchaseDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { guest: true },
      orderBy: { purchaseDate: 'desc' },
    });

    if (guestPackages.length > 0) {
      const rows = guestPackages.map((gp) => ({
        date: gp.purchaseDate.toISOString().split('T')[0],
        packageName: gp.name,
        clientName: gp.guest?.name || 'Walk-in Client',
        price: Number(gp.price),
        discount: 0,
        validityDays: gp.validityDays,
        servicesCount: gp.totalSessions,
        remainingSessions: gp.remainingSessions,
        status: gp.status,
      }));

      return {
        totals: {
          totalPackages: guestPackages.length,
          totalValue: Number(guestPackages.reduce((sum, p) => sum + Number(p.price), 0).toFixed(2)),
        },
        rows,
        totalRows: guestPackages.length,
      };
    }

    const packages = await prisma.package.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const rows = packages.map((pkg) => ({
      date: pkg.createdAt.toISOString().split('T')[0],
      packageName: pkg.name,
      price: Number(pkg.price),
      discount: 0,
      validityDays: pkg.validityDays,
      servicesCount: Array.isArray(pkg.services) ? (pkg.services as any[]).length : 0,
    }));

    return {
      totals: {
        totalPackages: packages.length,
        totalValue: Number(packages.reduce((sum, p) => sum + Number(p.price), 0).toFixed(2)),
      },
      rows,
      totalRows: packages.length,
    };
  }

  // 15. Package Redemption Report
  async getPackageRedemption(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const guestPackages = await prisma.guestPackage.findMany({
      where: {
        tenantId,
        totalSessions: { gt: 0 },
      },
      include: { guest: true },
      orderBy: { purchaseDate: 'desc' },
    });

    const rows = guestPackages.map((gp) => ({
      date: gp.purchaseDate.toISOString().split('T')[0],
      packageName: gp.name,
      clientName: gp.guest?.name || 'Client',
      totalSessions: gp.totalSessions,
      redeemedSessions: Math.max(0, gp.totalSessions - gp.remainingSessions),
      remainingSessions: gp.remainingSessions,
      status: gp.status,
    }));

    const totalRedeemed = rows.reduce((sum, r) => sum + r.redeemedSessions, 0);

    return {
      totals: {
        totalRedeemed,
        totalPackages: rows.length,
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 16. Gift Card Sold Report
  async getGiftCardSold(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const cards = await prisma.giftCard.findMany({
      where: {
        tenantId,
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalSold = 0;
    const rows = cards.map((c) => {
      const val = Number(c.amount);
      totalSold += val;
      const expiry = new Date(c.createdAt.getTime() + c.validityDays * 86400000);
      return {
        date: c.createdAt.toISOString().split('T')[0],
        code: c.code,
        initialAmount: val,
        balance: val,
        status: c.isActive ? 'ACTIVE' : 'INACTIVE',
        expiryDate: expiry.toISOString().split('T')[0],
      };
    });

    return {
      totals: { totalCards: cards.length, totalSoldAmount: Number(totalSold.toFixed(2)) },
      rows,
      totalRows: cards.length,
    };
  }

  // 17. Gift Card Redemption Report
  async getGiftCardRedemption(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        giftCardAmount: { gt: 0 },
      },
      include: { guest: true },
      orderBy: { orderDate: 'desc' },
    });

    let totalRedeemed = 0;
    const rows = orders.map((o) => {
      const amt = Number(o.giftCardAmount);
      totalRedeemed += amt;
      return {
        date: o.orderDate.toISOString().split('T')[0],
        orderNumber: o.orderNumber,
        giftCardCode: o.giftCardCode || 'N/A',
        guestName: o.guest.name,
        redeemedAmount: amt,
        orderTotal: Number(o.totalAmount),
      };
    });

    return {
      totals: { totalRedemptions: rows.length, totalRedeemedAmount: Number(totalRedeemed.toFixed(2)) },
      rows,
      totalRows: rows.length,
    };
  }

  // 18. Advance Received Report
  async getAdvanceReceived(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const payments = await prisma.posPayment.findMany({
      where: {
        tenantId,
        method: 'ADVANCE',
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: { order: { include: { guest: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let totalAdvance = 0;
    const rows = payments.map((p) => {
      const amt = Number(p.amount);
      totalAdvance += amt;
      return {
        date: p.createdAt.toISOString().split('T')[0],
        receiptNumber: p.referenceNumber || p.id.slice(0, 8),
        guestName: p.order?.guest.name || 'N/A',
        mobile: p.order?.guest.mobile || 'N/A',
        amount: amt,
        paymentMethod: p.method,
      };
    });

    return {
      totals: { totalAdvances: payments.length, totalAmount: Number(totalAdvance.toFixed(2)) },
      rows,
      totalRows: payments.length,
    };
  }

  // 19. Balance Received Report
  async getBalanceReceived(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const payments = await prisma.posPayment.findMany({
      where: {
        tenantId,
        method: 'BALANCE',
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: { order: { include: { guest: true } } },
      orderBy: { createdAt: 'desc' },
    });

    let totalBalance = 0;
    const rows = payments.map((p) => {
      const amt = Number(p.amount);
      totalBalance += amt;
      return {
        date: p.createdAt.toISOString().split('T')[0],
        orderNumber: p.order?.orderNumber || 'N/A',
        guestName: p.order?.guest.name || 'N/A',
        mobile: p.order?.guest.mobile || 'N/A',
        amountReceived: amt,
        reference: p.referenceNumber || 'N/A',
      };
    });

    return {
      totals: { totalTransactions: payments.length, totalAmount: Number(totalBalance.toFixed(2)) },
      rows,
      totalRows: payments.length,
    };
  }

  // 20. Coupon Redemption Report
  async getCouponRedemption(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        couponDiscount: { gt: 0 },
      },
      include: { guest: true },
      orderBy: { orderDate: 'desc' },
    });

    let totalDiscount = 0;
    const rows = orders.map((o) => {
      const disc = Number(o.couponDiscount);
      totalDiscount += disc;
      return {
        date: o.orderDate.toISOString().split('T')[0],
        orderNumber: o.orderNumber,
        couponCode: o.couponCode || 'N/A',
        guestName: o.guest.name,
        discountGiven: disc,
        orderTotal: Number(o.totalAmount),
      };
    });

    return {
      totals: { totalRedemptions: orders.length, totalDiscount: Number(totalDiscount.toFixed(2)) },
      rows,
      totalRows: orders.length,
    };
  }

  // 21. Day Wise Report
  async getDayWiseReport(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
      },
      include: { items: true, payments: true },
      orderBy: { orderDate: 'asc' },
    });

    const dayMap = new Map<string, {
      date: string;
      invoicesCount: number;
      serviceSales: number;
      productSales: number;
      discount: number;
      tax: number;
      totalSales: number;
      cash: number;
      card: number;
      online: number;
    }>();

    for (const o of orders) {
      const dateKey = o.orderDate.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          invoicesCount: 0,
          serviceSales: 0,
          productSales: 0,
          discount: 0,
          tax: 0,
          totalSales: 0,
          cash: 0,
          card: 0,
          online: 0,
        });
      }

      const rec = dayMap.get(dateKey)!;
      rec.invoicesCount += 1;
      rec.discount += Number(o.discountAmount) + Number(o.couponDiscount) + Number(o.giftCardAmount);
      rec.tax += Number(o.taxAmount);
      rec.totalSales += Number(o.totalAmount);

      for (const item of o.items) {
        if (item.itemType === 'SERVICE') rec.serviceSales += Number(item.total);
        else rec.productSales += Number(item.total);
      }

      for (const p of o.payments) {
        const m = p.method.toUpperCase();
        if (m === 'CASH') rec.cash += Number(p.amount);
        else if (m === 'CARD' || m === 'HDFC') rec.card += Number(p.amount);
        else rec.online += Number(p.amount);
      }
    }

    const rows = Array.from(dayMap.values()).map((r) => ({
      date: r.date,
      invoicesCount: r.invoicesCount,
      serviceSales: Number(r.serviceSales.toFixed(2)),
      productSales: Number(r.productSales.toFixed(2)),
      discount: Number(r.discount.toFixed(2)),
      tax: Number(r.tax.toFixed(2)),
      totalSales: Number(r.totalSales.toFixed(2)),
      cash: Number(r.cash.toFixed(2)),
      card: Number(r.card.toFixed(2)),
      online: Number(r.online.toFixed(2)),
    }));

    return {
      totals: {
        totalDays: rows.length,
        totalSales: Number(rows.reduce((s, r) => s + r.totalSales, 0).toFixed(2)),
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 22. Tip Report
  async getTipReport(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        tipAmount: { gt: 0 },
      },
      include: {
        guest: true,
        items: { include: { staff: true } },
      },
      orderBy: { orderDate: 'desc' },
    });

    let totalTip = 0;
    const rows = orders.map((o) => {
      const tip = Number(o.tipAmount);
      totalTip += tip;
      const staffName = o.items.find((it) => it.staff)?.staff?.name || 'General Staff';
      return {
        date: o.orderDate.toISOString().split('T')[0],
        orderNumber: o.orderNumber,
        guestName: o.guest.name,
        staffName,
        tipAmount: tip,
        paymentMethod: o.paymentMethod,
      };
    });

    return {
      totals: { totalTipsCount: orders.length, totalTipAmount: Number(totalTip.toFixed(2)) },
      rows,
      totalRows: orders.length,
    };
  }

  // 23. Complimentary Report
  async getComplimentaryReport(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const items = await prisma.posOrderItem.findMany({
      where: {
        tenantId,
        order: {
          orderDate: { gte: range.startDate, lte: range.endDate },
          status: { not: 'CANCELLED' },
        },
        OR: [
          { total: 0 },
          { discountAmount: { gt: 0 }, total: 0 },
        ],
      },
      include: {
        order: { include: { guest: true } },
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = items.map((it) => ({
      date: it.order.orderDate.toISOString().split('T')[0],
      orderNumber: it.order.orderNumber,
      guestName: it.order.guest.name,
      staffName: it.staff?.name || 'Unassigned',
      itemName: it.itemName,
      itemType: it.itemType,
      unitPrice: Number(it.unitPrice),
      discountAmount: Number(it.discountAmount),
      total: Number(it.total),
    }));

    return {
      totals: { totalComplimentaryItems: items.length },
      rows,
      totalRows: items.length,
    };
  }

  // 24. Cancelled Orders Report
  async getCancelledOrders(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        status: 'CANCELLED',
        orderDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { guest: true },
      orderBy: { orderDate: 'desc' },
    });

    let totalCancelledAmount = 0;
    const rows = orders.map((o) => {
      const amt = Number(o.totalAmount);
      totalCancelledAmount += amt;
      return {
        date: o.orderDate.toISOString().split('T')[0],
        orderNumber: o.orderNumber,
        guestName: o.guest.name,
        amount: amt,
        reason: o.notes || 'Cancelled by Cashier/Admin',
      };
    });

    return {
      totals: { totalCancelledOrders: orders.length, totalCancelledAmount: Number(totalCancelledAmount.toFixed(2)) },
      rows,
      totalRows: orders.length,
    };
  }

  // 25. Appointment Report
  async getAppointmentReport(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const where: any = {
      tenantId,
      appointmentDate: { gte: range.startDate, lte: range.endDate },
    };
    if (query.status) where.status = query.status.toUpperCase();

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        guest: true,
        items: { include: { service: true, staff: true } },
      },
      orderBy: { appointmentDate: 'desc' },
    });

    const rows = appointments.slice((query.page - 1) * query.limit, query.page * query.limit).map((a) => {
      const services = a.items.map((it) => it.service.name).join(', ');
      const staffMembers = Array.from(new Set(a.items.map((it) => it.staff?.name).filter(Boolean))).join(', ');
      return {
        appointmentNumber: a.appointmentNumber,
        date: a.appointmentDate.toISOString().split('T')[0],
        guestName: a.guest.name,
        mobile: a.guest.mobile,
        services,
        staff: staffMembers || 'Unassigned',
        source: a.bookingSource,
        status: a.status,
        totalAmount: Number(a.totalAmount),
      };
    });

    return {
      totals: { totalAppointments: appointments.length },
      rows,
      totalRows: appointments.length,
    };
  }

  // 26. GST Returns Report (GSTR-1 Format)
  async getGstReturns(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        taxAmount: { gt: 0 },
      },
      include: { guest: true },
      orderBy: { orderDate: 'asc' },
    });

    let sumTaxable = 0;
    let sumCgst = 0;
    let sumSgst = 0;
    let sumTotalTax = 0;
    let sumInvoiceVal = 0;

    const rows = orders.map((o) => {
      const taxable = Number(o.subtotal) - Number(o.discountAmount);
      const tax = Number(o.taxAmount);
      const cgst = Number((tax / 2).toFixed(2));
      const sgst = Number((tax / 2).toFixed(2));
      const invoiceVal = Number(o.totalAmount);

      sumTaxable += taxable;
      sumCgst += cgst;
      sumSgst += sgst;
      sumTotalTax += tax;
      sumInvoiceVal += invoiceVal;

      return {
        invoiceNumber: o.orderNumber,
        date: o.orderDate.toISOString().split('T')[0],
        customerName: o.guest.name,
        gstin: o.guest.gstNumber || 'URP', // Unregistered Person
        taxableValue: Number(taxable.toFixed(2)),
        cgst,
        sgst,
        igst: 0,
        totalTax: tax,
        invoiceValue: invoiceVal,
      };
    });

    return {
      totals: {
        totalInvoices: orders.length,
        taxableValue: Number(sumTaxable.toFixed(2)),
        cgst: Number(sumCgst.toFixed(2)),
        sgst: Number(sumSgst.toFixed(2)),
        totalTax: Number(sumTotalTax.toFixed(2)),
        totalInvoiceValue: Number(sumInvoiceVal.toFixed(2)),
      },
      rows,
      totalRows: orders.length,
    };
  }

  // 27. Guest Followups Report
  async getGuestFollowups(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const guests = await prisma.guest.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const rows = guests.map((g) => ({
      guestName: g.name,
      mobile: g.mobile,
      lastVisit: g.lastVisitDate ? g.lastVisitDate.toISOString().split('T')[0] : 'N/A',
      loyaltyPoints: g.loyaltyPoints,
      customerType: g.customerType,
      notes: g.notes || 'Routine follow-up for feedback',
      status: 'PENDING',
    }));

    return {
      totals: { totalFollowups: guests.length },
      rows,
      totalRows: guests.length,
    };
  }

  // 28. Cash Transactions Report
  async getCashTransactions(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const cashPayments = await prisma.posPayment.findMany({
      where: {
        tenantId,
        method: 'CASH',
        createdAt: { gte: range.startDate, lte: range.endDate },
      },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });

    const cashExpenses = await prisma.expenseTransaction.findMany({
      where: {
        tenantId,
        paymentMethod: 'CASH',
        expenseDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { category: true },
      orderBy: { expenseDate: 'desc' },
    });

    let totalInflow = 0;
    let totalOutflow = 0;

    const rows: any[] = [];

    for (const p of cashPayments) {
      const amt = Number(p.amount);
      totalInflow += amt;
      rows.push({
        date: p.createdAt.toISOString().split('T')[0],
        type: 'INFLOW',
        reference: p.order?.orderNumber || p.id.slice(0, 8),
        description: 'POS Order Cash Collection',
        amount: amt,
      });
    }

    for (const e of cashExpenses) {
      const amt = Number(e.amount);
      totalOutflow += amt;
      rows.push({
        date: e.expenseDate.toISOString().split('T')[0],
        type: 'OUTFLOW',
        reference: e.id.slice(0, 8),
        description: `Expense: ${e.category?.name || e.expenseTypeName || 'General Expense'} - ${e.description || ''}`,
        amount: amt,
      });
    }

    return {
      totals: {
        totalInflow: Number(totalInflow.toFixed(2)),
        totalOutflow: Number(totalOutflow.toFixed(2)),
        netCash: Number((totalInflow - totalOutflow).toFixed(2)),
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 29. Form History Report
  async getFormHistory(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const forms = await prisma.customForm.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const rows = forms.map((f) => ({
      date: f.createdAt.toISOString().split('T')[0],
      formName: f.name,
      description: f.description || '',
      fieldsCount: Array.isArray(f.fields) ? (f.fields as any[]).length : 0,
      isActive: f.isActive,
    }));

    return {
      totals: { totalForms: forms.length },
      rows,
      totalRows: forms.length,
    };
  }

  // 30. Daily Stock Report
  async getDailyStock(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: {
        category: true,
        stockTransactions: true,
      },
      orderBy: { name: 'asc' },
    });

    let totalStockValue = 0;
    const rows = products.map((p) => {
      let inward = 0;
      let outward = 0;
      for (const t of p.stockTransactions) {
        if (t.type === 'INWARD' || t.type === 'RECONCILED') {
          inward += Number(t.quantity);
        } else {
          outward += Number(t.quantity);
        }
      }
      const stock = Math.max(0, inward - outward);
      const price = Number(p.price);
      const val = stock * price;
      totalStockValue += val;

      return {
        productName: p.name,
        category: p.category?.name || 'General',
        openingStock: inward,
        stockIn: inward,
        stockOut: outward,
        closingStock: stock,
        unitPrice: price,
        stockValue: Number(val.toFixed(2)),
      };
    });

    return {
      totals: {
        totalProducts: products.length,
        totalStockValue: Number(totalStockValue.toFixed(2)),
      },
      rows,
      totalRows: products.length,
    };
  }

  // 31. Stock Transaction Report
  async getStockTransaction(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const where: any = {
      tenantId,
      transactionDate: { gte: range.startDate, lte: range.endDate },
    };
    if (query.type) where.type = query.type.toUpperCase();

    const txs = await prisma.stockTransaction.findMany({
      where,
      include: { product: true, disposable: true, staff: true },
      orderBy: { transactionDate: 'desc' },
    });

    let totalAmount = 0;
    const rows = txs.map((t) => {
      const amt = Number(t.totalAmount);
      totalAmount += amt;
      return {
        date: t.transactionDate.toISOString().split('T')[0],
        itemName: t.product?.name || t.disposable?.name || 'Item',
        type: t.type,
        quantity: Number(t.quantity),
        unitPrice: Number(t.unitPrice),
        totalAmount: amt,
        vendor: t.vendorName || 'N/A',
        staff: t.staff?.name || 'Staff',
        notes: t.notes || '',
      };
    });

    return {
      totals: { totalTransactions: txs.length, totalAmount: Number(totalAmount.toFixed(2)) },
      rows,
      totalRows: txs.length,
    };
  }

  // 32. Material Received Report
  async getMaterialReceived(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        type: 'INWARD',
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { product: true, disposable: true },
      orderBy: { transactionDate: 'desc' },
    });

    let totalCost = 0;
    const rows = txs.map((t) => {
      const cost = Number(t.totalAmount);
      totalCost += cost;
      return {
        date: t.transactionDate.toISOString().split('T')[0],
        poNumber: t.poNumber || 'PO-' + t.id.slice(0, 6).toUpperCase(),
        vendorName: t.vendorName || 'General Supplier',
        itemName: t.product?.name || t.disposable?.name || 'Item',
        quantity: Number(t.quantity),
        unitRate: Number(t.unitPrice),
        totalCost: cost,
      };
    });

    return {
      totals: { totalReceived: txs.length, totalCost: Number(totalCost.toFixed(2)) },
      rows,
      totalRows: txs.length,
    };
  }

  // 33. Minimum Stock Report
  async getMinimumStock(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: {
        category: true,
        stockTransactions: true,
      },
      orderBy: { name: 'asc' },
    });

    const lowStockProducts: any[] = [];
    for (const p of products) {
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
      if (currentStock <= 5) {
        lowStockProducts.push({
          productName: p.name,
          category: p.category?.name || 'General',
          currentStock,
          minimumAlert: 5,
          reorderQty: 20,
          status: currentStock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        });
      }
    }

    return {
      totals: { lowStockCount: lowStockProducts.length },
      rows: lowStockProducts,
      totalRows: lowStockProducts.length,
    };
  }

  // 34. Reconcile Stock Report
  async getReconcileStock(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        type: 'RECONCILED',
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { product: true, disposable: true },
      orderBy: { transactionDate: 'desc' },
    });

    const rows = txs.map((t) => ({
      date: t.transactionDate.toISOString().split('T')[0],
      itemName: t.product?.name || t.disposable?.name || 'Item',
      adjustedQuantity: Number(t.quantity),
      unitPrice: Number(t.unitPrice),
      notes: t.notes || 'Inventory Reconciliation',
    }));

    return {
      totals: { totalReconciliations: txs.length },
      rows,
      totalRows: txs.length,
    };
  }

  // 35. Consumable Tracking Report
  async getConsumableTracking(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        type: 'CONSUMED',
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { product: true, disposable: true, staff: true },
      orderBy: { transactionDate: 'desc' },
    });

    let totalCost = 0;
    const rows = txs.map((t) => {
      const cost = Number(t.totalAmount);
      totalCost += cost;
      return {
        date: t.transactionDate.toISOString().split('T')[0],
        item: t.product?.name || t.disposable?.name || 'Consumable',
        quantity: Number(t.quantity),
        staff: t.staff?.name || 'Stylist',
        cost,
      };
    });

    return {
      totals: { totalConsumedItems: txs.length, totalCost: Number(totalCost.toFixed(2)) },
      rows,
      totalRows: txs.length,
    };
  }

  // 36. Stock Transfer Report
  async getStockTransfer(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        type: 'TRANSFER',
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { product: true, disposable: true },
      orderBy: { transactionDate: 'desc' },
    });

    const rows = txs.map((t) => ({
      date: t.transactionDate.toISOString().split('T')[0],
      itemName: t.product?.name || t.disposable?.name || 'Item',
      fromStore: t.sourceStore || 'Main Branch',
      toStore: t.destinationStore || 'Secondary Branch',
      quantity: Number(t.quantity),
      notes: t.notes || 'Inter-store transfer',
    }));

    return {
      totals: { totalTransfers: txs.length },
      rows,
      totalRows: txs.length,
    };
  }

  // 37. Total Consumed Report
  async getTotalConsumed(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        type: 'CONSUMED',
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { product: true, disposable: true },
    });

    const aggMap = new Map<string, { itemName: string; totalQty: number; totalCost: number }>();
    for (const t of txs) {
      const name = t.product?.name || t.disposable?.name || 'Item';
      if (!aggMap.has(name)) {
        aggMap.set(name, { itemName: name, totalQty: 0, totalCost: 0 });
      }
      const rec = aggMap.get(name)!;
      rec.totalQty += Number(t.quantity);
      rec.totalCost += Number(t.totalAmount);
    }

    const rows = Array.from(aggMap.values()).map((r) => ({
      itemName: r.itemName,
      totalQuantity: r.totalQty,
      totalCost: Number(r.totalCost.toFixed(2)),
    }));

    return {
      totals: {
        totalItems: rows.length,
        overallCost: Number(rows.reduce((s, r) => s + r.totalCost, 0).toFixed(2)),
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 38. Purchase Order Report
  async getPurchaseOrder(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        poNumber: { not: null },
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
      orderBy: { transactionDate: 'desc' },
    });

    let totalAmount = 0;
    const rows = txs.map((t) => {
      const amt = Number(t.totalAmount);
      totalAmount += amt;
      return {
        poDate: t.transactionDate.toISOString().split('T')[0],
        poNumber: t.poNumber,
        vendorName: t.vendorName || 'Supplier',
        quantity: Number(t.quantity),
        amount: amt,
        status: 'COMPLETED',
      };
    });

    return {
      totals: { totalPOs: txs.length, totalAmount: Number(totalAmount.toFixed(2)) },
      rows,
      totalRows: txs.length,
    };
  }

  // 39. GST Outwards Report
  async getGstOutwards(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        taxAmount: { gt: 0 },
      },
    });

    let taxableTurnover = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let totalTaxCollected = 0;

    for (const o of orders) {
      const taxable = Number(o.subtotal) - Number(o.discountAmount);
      const tax = Number(o.taxAmount);
      taxableTurnover += taxable;
      cgstTotal += tax / 2;
      sgstTotal += tax / 2;
      totalTaxCollected += tax;
    }

    const rows = [
      {
        taxRate: '18%',
        taxableTurnover: Number(taxableTurnover.toFixed(2)),
        cgst: Number(cgstTotal.toFixed(2)),
        sgst: Number(sgstTotal.toFixed(2)),
        totalTax: Number(totalTaxCollected.toFixed(2)),
      },
    ];

    return {
      totals: {
        totalTaxableTurnover: Number(taxableTurnover.toFixed(2)),
        totalTaxCollected: Number(totalTaxCollected.toFixed(2)),
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 40. Inventory Transaction Report
  async getInventoryTransaction(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const txs = await prisma.stockTransaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: range.startDate, lte: range.endDate },
      },
    });

    let inwardValue = 0;
    let outwardValue = 0;
    let consumedValue = 0;

    for (const t of txs) {
      const amt = Number(t.totalAmount);
      if (t.type === 'INWARD') inwardValue += amt;
      else if (t.type === 'OUTWARD') outwardValue += amt;
      else if (t.type === 'CONSUMED') consumedValue += amt;
    }

    const rows = [
      { category: 'Inward / Purchases', amount: Number(inwardValue.toFixed(2)) },
      { category: 'Outward / Sales', amount: Number(outwardValue.toFixed(2)) },
      { category: 'Service Consumption', amount: Number(consumedValue.toFixed(2)) },
    ];

    return {
      totals: {
        inwardValue: Number(inwardValue.toFixed(2)),
        outwardValue: Number(outwardValue.toFixed(2)),
        consumedValue: Number(consumedValue.toFixed(2)),
      },
      rows,
      totalRows: rows.length,
    };
  }

  // 41. PNL Report (Profit & Loss)
  async getPnlReport(tenantId: string, range: DateRange, query: ReportQueryParams) {
    // 1. Revenue
    const salesSummary = await this.getSalesSummary(tenantId, range, query);
    const serviceRevenue = salesSummary.totals.serviceSales;
    const productRevenue = salesSummary.totals.productSales;
    const grossRevenue = salesSummary.totals.netSales;

    // 2. Cost of Goods Sold (COGS)
    const consumed = await this.getTotalConsumed(tenantId, range, query);
    const cogs = consumed.totals.overallCost;
    const grossProfit = Number((grossRevenue - cogs).toFixed(2));

    // 3. Operating Expenses
    const expenses = await prisma.expenseTransaction.findMany({
      where: {
        tenantId,
        expenseDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { category: true },
    });

    let totalExpenses = 0;
    const expenseCategoryMap = new Map<string, number>();

    for (const exp of expenses) {
      const catName = exp.category?.name || 'General Expense';
      const amt = Number(exp.amount);
      totalExpenses += amt;
      expenseCategoryMap.set(catName, (expenseCategoryMap.get(catName) || 0) + amt);
    }

    const operatingExpenseRows = Array.from(expenseCategoryMap.entries()).map(([cat, amt]) => ({
      category: cat,
      amount: Number(amt.toFixed(2)),
    }));

    const netProfit = Number((grossProfit - totalExpenses).toFixed(2));

    return {
      totals: {
        grossRevenue,
        serviceRevenue,
        productRevenue,
        cogs,
        grossProfit,
        operatingExpenses: Number(totalExpenses.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netProfit,
      },
      revenueBreakdown: [
        { item: 'Service Sales', amount: serviceRevenue },
        { item: 'Product Sales', amount: productRevenue },
        { item: 'Total Net Sales', amount: grossRevenue },
      ],
      cogsBreakdown: [
        { item: 'Salon Consumables & Stock Cost', amount: cogs },
      ],
      expenseBreakdown: operatingExpenseRows,
      rows: [
        { lineItem: 'Revenue', amount: grossRevenue },
        { lineItem: 'Cost of Goods Sold (COGS)', amount: -cogs },
        { lineItem: 'Gross Profit', amount: grossProfit },
        { lineItem: 'Operating Expenses', amount: -Number(totalExpenses.toFixed(2)) },
        { lineItem: 'Net Profit / (Loss)', amount: netProfit },
      ],
      totalRows: 5,
    };
  }

  // 42. Loyalty Points Report
  async getLoyaltyPoints(tenantId: string, range: DateRange, query: ReportQueryParams) {
    const [txs, orders, guests] = await Promise.all([
      prisma.guestWalletTransaction.findMany({
        where: {
          tenantId,
          type: { in: ['LOYALTY_CREDIT', 'LOYALTY_DEBIT'] },
          transactionDate: { gte: range.startDate, lte: range.endDate },
        },
        include: { guest: true, staff: true },
        orderBy: { transactionDate: 'desc' },
      }),
      prisma.posOrder.findMany({
        where: {
          tenantId,
          orderDate: { gte: range.startDate, lte: range.endDate },
          OR: [
            { loyaltyPointsRedeemed: { gt: 0 } },
            { loyaltyPointsEarned: { gt: 0 } },
          ],
        },
      }),
      prisma.guest.findMany({
        where: { tenantId, loyaltyPoints: { gt: 0 } },
        select: { id: true, name: true, mobile: true, loyaltyPoints: true },
        orderBy: { loyaltyPoints: 'desc' },
        take: 20,
      }),
    ]);

    let totalPointsEarned = 0;
    let totalPointsRedeemed = 0;

    for (const tx of txs) {
      if (tx.type === 'LOYALTY_CREDIT') totalPointsEarned += Number(tx.amount);
      else if (tx.type === 'LOYALTY_DEBIT') totalPointsRedeemed += Number(tx.amount);
    }

    const totalLoyaltyDiscount = orders.reduce((sum, o) => sum + Number(o.loyaltyDiscount || 0), 0);
    const activePointsLiability = guests.reduce((sum, g) => sum + g.loyaltyPoints, 0);

    const rows = txs.map((tx) => ({
      id: tx.id,
      date: tx.transactionDate ? tx.transactionDate.toISOString().slice(0, 10) : '',
      guestName: tx.guest?.name || 'Unknown Guest',
      mobile: tx.guest?.mobile || '',
      type: tx.type === 'LOYALTY_CREDIT' ? 'Earned' : 'Redeemed',
      points: Number(tx.amount),
      runningBalance: Number(tx.runningBalance || 0),
      paymentMethod: tx.paymentMethod || 'Loyalty',
      notes: tx.notes || '',
      staffName: tx.staff?.name || '-',
    }));

    return {
      totals: {
        totalPointsEarned,
        totalPointsRedeemed,
        netPointsMovement: totalPointsEarned - totalPointsRedeemed,
        totalLoyaltyDiscount: Number(totalLoyaltyDiscount.toFixed(2)),
        activePointsLiability,
        totalTransactions: txs.length,
      },
      topLoyaltyGuests: guests.map((g) => ({
        id: g.id,
        name: g.name,
        mobile: g.mobile,
        loyaltyPoints: g.loyaltyPoints,
      })),
      rows,
      totalRows: rows.length,
    };
  }
}

export const reportsRepository = new ReportsRepository();
