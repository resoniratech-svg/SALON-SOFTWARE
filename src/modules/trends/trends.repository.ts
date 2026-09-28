import { prisma } from '../../config/database.js';
import { DateRange, TrendCategory, TrendPeriod, RevenuePeriod } from './trends.dto.js';

export interface RevenueSplitItem {
  key: string;
  label: string;
  amount: number;
}

export interface TimeSeriesInterval {
  period: string;
  date: string;
  values: Record<string, number>;
}

export class TrendsRepository {
  // 1. Get Available Locations / Branches
  async getLocations(tenantId: string): Promise<Array<{ id: string; name: string }>> {
    // 1. Fetch distinct stores from guests
    const guestStores = await prisma.guest.findMany({
      where: { tenantId, store: { not: null } },
      select: { store: true },
      distinct: ['store'],
    });

    const set = new Set<string>();
    for (const g of guestStores) {
      if (g.store && g.store.trim()) {
        set.add(g.store.trim().toLowerCase());
      }
    }

    // 2. Fetch distinct branches from staff bank details
    try {
      const staffBranches = await prisma.staffBankDetail.findMany({
        where: { staff: { tenantId } },
        select: { branch: true },
        distinct: ['branch'],
      });
      for (const b of staffBranches) {
        if (b.branch && b.branch.trim()) {
          set.add(b.branch.trim().toLowerCase());
        }
      }
    } catch {
      // bankDetails optional
    }

    // Default to Kalyaninagar if no stores present
    if (set.size === 0) {
      set.add('kalyaninagar');
    }

    return Array.from(set).map((storeKey) => {
      const displayName = storeKey.charAt(0).toUpperCase() + storeKey.slice(1);
      return {
        id: storeKey,
        name: displayName,
      };
    });
  }

  // 2. Get Series Options for Dropdown
  async getSeriesOptions(tenantId: string, category: TrendCategory, location?: string): Promise<string[]> {
    if (category === 'overall') {
      return ['Total', 'Product', 'Package', 'Gift Card', 'Service', 'Membership'];
    }

    if (category === 'service') {
      const categories = await prisma.serviceCategory.findMany({
        where: { tenantId, isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      const names = categories.map((c) => c.name);
      return names.length > 0 ? names : ['Hair', 'Skin', 'Nails', 'Spa'];
    }

    if (category === 'product') {
      const categories = await prisma.productCategory.findMany({
        where: { tenantId, isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      const names = categories.map((c) => c.name);
      return names.length > 0 ? names : ['Wella', 'L\'Oreal', 'Kerastase', 'Retail'];
    }

    if (category === 'staff') {
      const staffList = await prisma.staff.findMany({
        where: { tenantId, isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      return staffList.map((s) => s.name);
    }

    return [];
  }

  // Helper: Build Store Filter
  private buildLocationWhere(location?: string) {
    if (!location || location.toLowerCase() === 'all') return undefined;
    return {
      store: {
        equals: location.trim(),
        mode: 'insensitive' as const,
      },
    };
  }

  // 3. Revenue Split Aggregation
  async getRevenueSplit(
    tenantId: string,
    category: TrendCategory,
    range: DateRange,
    location?: string
  ): Promise<{
    category: TrendCategory;
    location: string;
    dateRange: { startDate: string; endDate: string };
    total: number;
    data: RevenueSplitItem[];
  }> {
    const guestWhere = this.buildLocationWhere(location);

    // Fetch Completed POS Orders
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        ...(guestWhere ? { guest: guestWhere } : {}),
      },
      include: {
        items: {
          include: {
            service: { include: { category: true } },
            product: { include: { category: true } },
            staff: true,
          },
        },
      },
    });

    // Fetch Guest Memberships
    const memberships = await prisma.guestMembership.findMany({
      where: {
        tenantId,
        purchaseDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        ...(guestWhere ? { guest: guestWhere } : {}),
      },
      include: { staff: true },
    });

    // Fetch Guest Packages
    const packages = await prisma.guestPackage.findMany({
      where: {
        tenantId,
        purchaseDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        ...(guestWhere ? { guest: guestWhere } : {}),
      },
    });

    let overallTotal = 0;
    const data: RevenueSplitItem[] = [];

    if (category === 'overall') {
      let serviceSales = 0;
      let productSales = 0;
      let packageSales = 0;
      let membershipSales = 0;
      let giftCardSales = 0;

      for (const o of orders) {
        for (const it of o.items) {
          const itemTot = Number(it.total);
          if (it.itemType === 'SERVICE') {
            serviceSales += itemTot;
          } else {
            productSales += itemTot;
          }
        }
        giftCardSales += Number(o.giftCardAmount || 0);
      }

      for (const m of memberships) {
        membershipSales += Number(m.planFee || 0);
      }

      for (const p of packages) {
        packageSales += Number(p.price || 0);
      }

      overallTotal = Number(
        (serviceSales + productSales + packageSales + membershipSales + giftCardSales).toFixed(2)
      );

      data.push(
        { key: 'Total', label: 'Total', amount: overallTotal },
        { key: 'Service', label: 'Service', amount: Number(serviceSales.toFixed(2)) },
        { key: 'Product', label: 'Product', amount: Number(productSales.toFixed(2)) },
        { key: 'Package', label: 'Package', amount: Number(packageSales.toFixed(2)) },
        { key: 'Membership', label: 'Membership', amount: Number(membershipSales.toFixed(2)) },
        { key: 'Gift Card', label: 'Gift Card', amount: Number(giftCardSales.toFixed(2)) }
      );
    } else if (category === 'service') {
      let totalServiceRevenue = 0;
      const categoryMap = new Map<string, number>();

      for (const o of orders) {
        for (const it of o.items) {
          if (it.itemType === 'SERVICE') {
            const amt = Number(it.total);
            totalServiceRevenue += amt;
            const catName = it.service?.category?.name || it.itemCategory || 'General';
            categoryMap.set(catName, (categoryMap.get(catName) || 0) + amt);
          }
        }
      }

      overallTotal = Number(totalServiceRevenue.toFixed(2));
      data.push({ key: 'Total', label: 'Total', amount: overallTotal });

      for (const [catName, amt] of categoryMap.entries()) {
        data.push({
          key: catName,
          label: catName,
          amount: Number(amt.toFixed(2)),
        });
      }
    } else if (category === 'product') {
      let totalProductRevenue = 0;
      const categoryMap = new Map<string, number>();

      for (const o of orders) {
        for (const it of o.items) {
          if (it.itemType === 'PRODUCT') {
            const amt = Number(it.total);
            totalProductRevenue += amt;
            const catName = it.product?.category?.name || it.itemCategory || it.itemName || 'Retail';
            categoryMap.set(catName, (categoryMap.get(catName) || 0) + amt);
          }
        }
      }

      overallTotal = Number(totalProductRevenue.toFixed(2));
      data.push({ key: 'Total', label: 'Total', amount: overallTotal });

      for (const [catName, amt] of categoryMap.entries()) {
        data.push({
          key: catName,
          label: catName,
          amount: Number(amt.toFixed(2)),
        });
      }
    } else if (category === 'staff') {
      const staffMap = new Map<string, number>();

      for (const o of orders) {
        for (const it of o.items) {
          const amt = Number(it.total);
          const staffName = it.staff?.name || 'Unassigned';
          staffMap.set(staffName, (staffMap.get(staffName) || 0) + amt);
          overallTotal += amt;
        }
      }

      for (const m of memberships) {
        if (m.staff?.name) {
          const amt = Number(m.planFee || 0);
          staffMap.set(m.staff.name, (staffMap.get(m.staff.name) || 0) + amt);
          overallTotal += amt;
        }
      }

      overallTotal = Number(overallTotal.toFixed(2));
      for (const [staffName, amt] of staffMap.entries()) {
        data.push({
          key: staffName,
          label: staffName,
          amount: Number(amt.toFixed(2)),
        });
      }
    }

    return {
      category,
      location: location || 'all',
      dateRange: { startDate: range.startDateStr, endDate: range.endDateStr },
      total: overallTotal,
      data,
    };
  }

  // 4. Time-Series Trends Aggregation
  async getTimeSeries(
    tenantId: string,
    category: TrendCategory,
    period: TrendPeriod,
    range: DateRange,
    location?: string,
    selectedSeries?: string[]
  ): Promise<{
    period: TrendPeriod;
    category: TrendCategory;
    location: string;
    dateRange: { startDate: string; endDate: string };
    series: string[];
    selectedSeries: string[];
    intervals: TimeSeriesInterval[];
  }> {
    const guestWhere = this.buildLocationWhere(location);

    // Fetch Completed POS Orders
    const orders = await prisma.posOrder.findMany({
      where: {
        tenantId,
        orderDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        ...(guestWhere ? { guest: guestWhere } : {}),
      },
      include: {
        items: {
          include: {
            service: { include: { category: true } },
            product: { include: { category: true } },
            staff: true,
          },
        },
      },
    });

    // Fetch Guest Memberships
    const memberships = await prisma.guestMembership.findMany({
      where: {
        tenantId,
        purchaseDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        ...(guestWhere ? { guest: guestWhere } : {}),
      },
      include: { staff: true },
    });

    // Fetch Guest Packages
    const packages = await prisma.guestPackage.findMany({
      where: {
        tenantId,
        purchaseDate: { gte: range.startDate, lte: range.endDate },
        status: { not: 'CANCELLED' },
        ...(guestWhere ? { guest: guestWhere } : {}),
      },
    });

    // Determine Available Series
    const availableSeries = await this.getSeriesOptions(tenantId, category, location);
    const activeSelectedSeries = selectedSeries && selectedSeries.length > 0
      ? availableSeries.filter((s) => selectedSeries.some((sel) => sel.toLowerCase() === s.toLowerCase()))
      : availableSeries;

    // Generate Buckets based on period
    const buckets = this.generateBuckets(period, range);

    // Populate each bucket
    for (const bucket of buckets) {
      // Initialize series values
      for (const s of availableSeries) {
        bucket.values[s] = 0;
      }
      if (category === 'overall') {
        bucket.values['Total'] = 0;
      }

      // 1. Process POS Orders
      for (const o of orders) {
        const orderTime = o.orderDate.getTime();
        if (orderTime >= bucket.startTime && orderTime <= bucket.endTime) {
          for (const it of o.items) {
            const itemTot = Number(it.total);
            if (category === 'overall') {
              if (it.itemType === 'SERVICE') {
                bucket.values['Service'] = (bucket.values['Service'] || 0) + itemTot;
              } else {
                bucket.values['Product'] = (bucket.values['Product'] || 0) + itemTot;
              }
              bucket.values['Total'] = (bucket.values['Total'] || 0) + itemTot;
            } else if (category === 'service' && it.itemType === 'SERVICE') {
              const catName = it.service?.category?.name || it.itemCategory || 'General';
              bucket.values[catName] = (bucket.values[catName] || 0) + itemTot;
            } else if (category === 'product' && it.itemType === 'PRODUCT') {
              const catName = it.product?.category?.name || it.itemCategory || it.itemName || 'Retail';
              bucket.values[catName] = (bucket.values[catName] || 0) + itemTot;
            } else if (category === 'staff') {
              const staffName = it.staff?.name || 'Unassigned';
              bucket.values[staffName] = (bucket.values[staffName] || 0) + itemTot;
            }
          }

          if (category === 'overall' && Number(o.giftCardAmount || 0) > 0) {
            const gc = Number(o.giftCardAmount);
            bucket.values['Gift Card'] = (bucket.values['Gift Card'] || 0) + gc;
            bucket.values['Total'] = (bucket.values['Total'] || 0) + gc;
          }
        }
      }

      // 2. Process Memberships
      for (const m of memberships) {
        const mTime = m.purchaseDate.getTime();
        if (mTime >= bucket.startTime && mTime <= bucket.endTime) {
          const fee = Number(m.planFee || 0);
          if (category === 'overall') {
            bucket.values['Membership'] = (bucket.values['Membership'] || 0) + fee;
            bucket.values['Total'] = (bucket.values['Total'] || 0) + fee;
          } else if (category === 'staff' && m.staff?.name) {
            bucket.values[m.staff.name] = (bucket.values[m.staff.name] || 0) + fee;
          }
        }
      }

      // 3. Process Packages
      for (const p of packages) {
        const pTime = p.purchaseDate.getTime();
        if (pTime >= bucket.startTime && pTime <= bucket.endTime) {
          const price = Number(p.price || 0);
          if (category === 'overall') {
            bucket.values['Package'] = (bucket.values['Package'] || 0) + price;
            bucket.values['Total'] = (bucket.values['Total'] || 0) + price;
          }
        }
      }

      // Round all values to 2 decimals
      for (const k of Object.keys(bucket.values)) {
        bucket.values[k] = Number((bucket.values[k] || 0).toFixed(2));
      }
    }

    const intervals: TimeSeriesInterval[] = buckets.map((b) => ({
      period: b.label,
      date: b.dateStr,
      values: b.values,
    }));

    return {
      period,
      category,
      location: location || 'all',
      dateRange: { startDate: range.startDateStr, endDate: range.endDateStr },
      series: availableSeries,
      selectedSeries: activeSelectedSeries,
      intervals,
    };
  }

  // 5. Generate Time Buckets for Line Chart
  private generateBuckets(
    period: TrendPeriod,
    range: DateRange
  ): Array<{
    label: string;
    dateStr: string;
    startTime: number;
    endTime: number;
    values: Record<string, number>;
  }> {
    const buckets: Array<{
      label: string;
      dateStr: string;
      startTime: number;
      endTime: number;
      values: Record<string, number>;
    }> = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (period === 'Week' || period === 'Month') {
      // Daily intervals
      const cur = new Date(range.startDate);
      while (cur <= range.endDate) {
        const startDay = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0);
        const endDay = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
        const dateStr = startDay.toISOString().split('T')[0];
        const dayNumber = cur.getDate().toString();

        buckets.push({
          label: period === 'Month' ? dayNumber : `${monthNames[cur.getMonth()]} ${cur.getDate()}`,
          dateStr,
          startTime: startDay.getTime(),
          endTime: endDay.getTime(),
          values: {},
        });

        cur.setDate(cur.getDate() + 1);
      }
    } else if (period === '3M') {
      // Weekly intervals across 90 days
      const cur = new Date(range.startDate);
      let weekIndex = 1;
      while (cur <= range.endDate) {
        const startWeek = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0);
        const endWeek = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 6, 23, 59, 59, 999);
        const effectiveEnd = endWeek > range.endDate ? range.endDate : endWeek;
        const dateStr = startWeek.toISOString().split('T')[0];

        buckets.push({
          label: `W${weekIndex} (${monthNames[startWeek.getMonth()]} ${startWeek.getDate()})`,
          dateStr,
          startTime: startWeek.getTime(),
          endTime: effectiveEnd.getTime(),
          values: {},
        });

        weekIndex++;
        cur.setDate(cur.getDate() + 7);
      }
    } else if (period === '6M') {
      // Monthly intervals across 6 months
      const cur = new Date(range.startDate);
      while (cur <= range.endDate) {
        const startMonth = new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0, 0);
        const endMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
        const dateStr = startMonth.toISOString().split('T')[0];

        buckets.push({
          label: `${monthNames[cur.getMonth()]} ${cur.getFullYear()}`,
          dateStr,
          startTime: Math.max(startMonth.getTime(), range.startDate.getTime()),
          endTime: Math.min(endMonth.getTime(), range.endDate.getTime()),
          values: {},
        });

        cur.setMonth(cur.getMonth() + 1);
        cur.setDate(1);
      }
    } else if (period === '1Y') {
      // Weekly or Monthly intervals (Frame 009 shows Week XX with date Aug 26)
      const cur = new Date(range.startDate);
      let weekNum = 1;
      while (cur <= range.endDate) {
        const startWeek = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0);
        const endWeek = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 6, 23, 59, 59, 999);
        const effectiveEnd = endWeek > range.endDate ? range.endDate : endWeek;
        const dateStr = startWeek.toISOString().split('T')[0];

        buckets.push({
          label: `Week ${weekNum}`,
          dateStr,
          startTime: startWeek.getTime(),
          endTime: effectiveEnd.getTime(),
          values: {},
        });

        weekNum++;
        cur.setDate(cur.getDate() + 7);
      }
    } else if (period === '5Y') {
      // Yearly intervals
      const cur = new Date(range.startDate);
      while (cur.getFullYear() <= range.endDate.getFullYear()) {
        const startYear = new Date(cur.getFullYear(), 0, 1, 0, 0, 0, 0);
        const endYear = new Date(cur.getFullYear(), 11, 31, 23, 59, 59, 999);
        const dateStr = startYear.toISOString().split('T')[0];

        buckets.push({
          label: cur.getFullYear().toString(),
          dateStr,
          startTime: Math.max(startYear.getTime(), range.startDate.getTime()),
          endTime: Math.min(endYear.getTime(), range.endDate.getTime()),
          values: {},
        });

        cur.setFullYear(cur.getFullYear() + 1);
      }
    }

    return buckets;
  }
}
