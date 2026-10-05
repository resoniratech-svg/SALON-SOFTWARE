import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { GuestQueryFilters, PaginatedResult } from './guest.types.js';
import { NotFoundError, BadRequestError } from '../../utils/app-error.js';

export class GuestRepository {
  private readonly defaultIncludes = {
    salutationRef: {
      select: { id: true, title: true },
    },
    crmSegmentRef: {
      select: { id: true, name: true },
    },
    membershipRef: {
      select: { id: true, name: true, price: true, discountPercentage: true },
    },
    referredByGuest: {
      select: { id: true, name: true, mobile: true, guestCode: true },
    },
    guestPackages: {
      include: { package: true },
      orderBy: { purchaseDate: 'desc' as const },
    },
  };

  async create(tenantId: string, data: Prisma.GuestUncheckedCreateInput) {
    return prisma.guest.create({
      data: {
        ...data,
        tenantId,
      },
      include: this.defaultIncludes,
    });
  }

  async findById(tenantId: string, id: string) {
    return prisma.guest.findFirst({
      where: {
        id,
        tenantId,
      },
      include: this.defaultIncludes,
    });
  }

  async findByMobile(tenantId: string, mobile: string, excludeId?: string) {
    return prisma.guest.findFirst({
      where: {
        tenantId,
        mobile,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findByCode(tenantId: string, guestCode: string, excludeId?: string) {
    return prisma.guest.findFirst({
      where: {
        tenantId,
        guestCode,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async countByTenant(tenantId: string): Promise<number> {
    return prisma.guest.count({
      where: { tenantId },
    });
  }

  async findMany(tenantId: string, filters: GuestQueryFilters): Promise<PaginatedResult<any>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.GuestWhereInput = {
      tenantId,
    };

    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { mobile: { contains: s, mode: 'insensitive' } },
        { alternateMobile: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { guestCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (filters.gender) {
      where.gender = { equals: filters.gender.toUpperCase(), mode: 'insensitive' };
    }

    if (filters.customerType) {
      where.customerType = { equals: filters.customerType.toUpperCase(), mode: 'insensitive' };
    }

    if (filters.crmSegmentId) {
      where.crmSegmentId = filters.crmSegmentId;
    }

    if (filters.membershipId) {
      where.membershipId = filters.membershipId;
    }

    if (filters.hasMembership !== undefined) {
      where.membershipId = filters.hasMembership ? { not: null } : null;
    }

    if (filters.hairType) {
      where.hairType = { contains: filters.hairType, mode: 'insensitive' };
    }

    if (filters.source) {
      where.source = { equals: filters.source, mode: 'insensitive' };
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else {
      where.isActive = true;
    }

    if (filters.isBlocked !== undefined) {
      where.isBlocked = filters.isBlocked;
    }

    if (filters.minSpend !== undefined || filters.maxSpend !== undefined) {
      where.totalSpend = {};
      if (filters.minSpend !== undefined) where.totalSpend.gte = new Prisma.Decimal(filters.minSpend);
      if (filters.maxSpend !== undefined) where.totalSpend.lte = new Prisma.Decimal(filters.maxSpend);
    }

    if (filters.minVisits !== undefined || filters.maxVisits !== undefined) {
      where.totalVisits = {};
      if (filters.minVisits !== undefined) where.totalVisits.gte = filters.minVisits;
      if (filters.maxVisits !== undefined) where.totalVisits.lte = filters.maxVisits;
    }

    if (filters.hasAnniversaryToday) {
      const todayGuests: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM guests 
        WHERE tenant_id = ${tenantId} 
          AND anniversary IS NOT NULL 
          AND EXTRACT(MONTH FROM anniversary) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM anniversary) = EXTRACT(DAY FROM CURRENT_DATE)
      `;
      where.id = { in: todayGuests.map((g) => g.id) };
    }

    if (filters.hasBirthdayToday) {
      const todayBirthdayGuests: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM guests 
        WHERE tenant_id = ${tenantId} 
          AND date_of_birth IS NOT NULL 
          AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
      `;
      where.id = { in: todayBirthdayGuests.map((g) => g.id) };
    }

    const allowedSortFields = ['name', 'createdAt', 'totalSpend', 'totalVisits', 'loyaltyPoints', 'lastVisitDate', 'mobile'];
    const sortBy = allowedSortFields.includes(filters.sortBy || '') ? filters.sortBy! : 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        include: this.defaultIncludes,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.guest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async update(tenantId: string, id: string, data: Prisma.GuestUncheckedUpdateInput) {
    return prisma.guest.update({
      where: { id },
      data,
      include: this.defaultIncludes,
    });
  }

  async delete(tenantId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Break self-referential referral loops
      await tx.guest.updateMany({
        where: { tenantId, referredByGuestId: id },
        data: { referredByGuestId: null },
      });

      // 2. Check if guest has historical POS orders
      const orderCount = await tx.posOrder.count({
        where: { tenantId, guestId: id },
      });

      // Module Isolation: If customer has historical POS orders, preserve them!
      // DO NOT delete pos_orders or transactions, so Reports, Trends, and Cash Management are never affected.
      if (orderCount > 0) {
        // Soft-delete the guest by setting isActive: false so they disappear from CRM,
        // while preserving all financial transactions in Reports, Trends, and Cash Management.
        return tx.guest.update({
          where: { id },
          data: { isActive: false },
        });
      }

      // If customer has NO POS orders, safe to hard delete child records and guest:
      await tx.appointment.deleteMany({
        where: { tenantId, guestId: id },
      });

      await tx.enquiry.deleteMany({
        where: { tenantId, guestId: id },
      });

      return tx.guest.delete({
        where: { id },
      });
    });
  }

  async getReferrals(tenantId: string, guestId: string) {
    return prisma.guest.findMany({
      where: {
        tenantId,
        referredByGuestId: guestId,
      },
      select: {
        id: true,
        guestCode: true,
        name: true,
        mobile: true,
        customerType: true,
        totalSpend: true,
        totalVisits: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // CRM GUEST LISTING (WITH CRM METRICS & FILTERS)
  // ==========================================
  async getCrmGuestList(tenantId: string, filters: any) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.GuestWhereInput = { tenantId };

    if (filters.search && filters.search.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { mobile: { contains: s, mode: 'insensitive' } },
        { alternateMobile: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { guestCode: { contains: s, mode: 'insensitive' } },
        { referralCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (filters.customerType) {
      where.customerType = { equals: filters.customerType.toUpperCase(), mode: 'insensitive' };
    }

    if (filters.gender && filters.gender !== 'ALL') {
      where.gender = { equals: filters.gender.toUpperCase(), mode: 'insensitive' };
    }

    if (filters.hairType && filters.hairType !== 'All') {
      where.hairType = { contains: filters.hairType, mode: 'insensitive' };
    }

    if (filters.store) {
      where.store = { contains: filters.store, mode: 'insensitive' };
    }

    if (filters.hasAdvance) {
      where.advanceBalance = { gt: new Prisma.Decimal(0) };
    }

    if (filters.hasBalance) {
      where.dueBalance = { gt: new Prisma.Decimal(0) };
    }

    if (filters.visitType) {
      if (filters.visitType === 'NEW_GUEST') {
        where.totalVisits = { lte: 1 };
      } else if (filters.visitType === 'REPETITIVE_GUEST') {
        where.totalVisits = { gt: 1 };
      }
    }

    if (filters.clientRetention) {
      where.totalVisits = { gte: 2 };
    }

    if (filters.lastVisited) {
      if (filters.lastVisited === 'NON_RETURNING') {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        where.OR = [
          { lastVisitDate: null },
          { lastVisitDate: { lte: sixtyDaysAgo } },
        ];
      }
    }

    if (filters.minPurchaseAmount !== undefined || filters.maxPurchaseAmount !== undefined) {
      where.totalSpend = {};
      if (filters.minPurchaseAmount !== undefined) where.totalSpend.gte = new Prisma.Decimal(filters.minPurchaseAmount);
      if (filters.maxPurchaseAmount !== undefined) where.totalSpend.lte = new Prisma.Decimal(filters.maxPurchaseAmount);
    }

    const [rawGuests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        include: {
          guestMemberships: { where: { status: 'ACTIVE' }, select: { id: true } },
          posOrders: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, subtotal: true, orderDate: true },
            orderBy: { orderDate: 'desc' },
          },
          appointments: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, bookingSource: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.guest.count({ where }),
    ]);

    const items = (rawGuests as any[]).map((g) => {
      const orderCount = g.posOrders?.length || 0;
      const totalPurchased = Number(g.totalSpend);
      const avgPurchase = orderCount > 0 ? Math.round(totalPurchased / orderCount) : 0;
      const onlineVisitsCount = g.appointments?.filter((a: any) => a.bookingSource === 'ONLINE').length || 0;

      return {
        id: g.id,
        mobile: g.mobile,
        alternateMobile: g.alternateMobile,
        name: g.name,
        gender: g.gender || 'Unspecified',
        lastVisited: g.lastVisitDate ? g.lastVisitDate.toISOString().split('T')[0] : null,
        totalOrders: orderCount,
        totalPurchaseAmount: totalPurchased,
        averagePurchaseAmount: avgPurchase,
        onlineVisits: onlineVisitsCount,
        loyalty: g.loyaltyPoints,
        referralCode: g.referralCode || '-',
        advance: Number(g.advanceBalance),
        balance: Number(g.dueBalance),
        membershipCount: g.guestMemberships?.length || g.membershipCount || 0,
        email: g.email || '-',
        birthDate: g.dateOfBirth ? g.dateOfBirth.toISOString().split('T')[0] : null,
        anniversary: g.anniversary ? g.anniversary.toISOString().split('T')[0] : null,
        store: g.store || 'kalyaninagar',
        hairType: g.hairType || '-',
        gstNumber: g.gstNumber || '-',
        customerType: g.customerType,
        isActive: g.isActive,
        isBlocked: g.isBlocked,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ==========================================
  // GUEST 360 PROFILE (COMPREHENSIVE VIEW)
  // ==========================================
  async getGuest360(tenantId: string, guestId: string) {
    const guest = await prisma.guest.findFirst({
      where: { tenantId, id: guestId },
      include: {
        crmSegmentRef: true,
        salutationRef: true,
        guestMemberships: {
          include: { staff: true, membership: true },
          orderBy: { purchaseDate: 'desc' },
        },
        guestPackages: {
          include: { package: true },
          orderBy: { purchaseDate: 'desc' },
        },
        walletTransactions: {
          include: { staff: true },
          orderBy: { transactionDate: 'desc' },
        },
        followUps: {
          include: { staff: true },
          orderBy: { dueDate: 'asc' },
        },
        guestNotes: {
          include: { staff: true },
          orderBy: { createdAt: 'desc' },
        },
        familyMembers: {
          orderBy: { createdAt: 'desc' },
        },
        formSubmissions: {
          include: { customForm: true, staff: true },
          orderBy: { submittedAt: 'desc' },
        },
        posOrders: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            items: {
              include: { service: true, product: true, staff: true },
            },
            payments: true,
          },
          orderBy: { orderDate: 'desc' },
          take: 20,
        },
        appointments: {
          include: {
            items: { include: { service: true, staff: true } },
          },
          orderBy: { appointmentDate: 'desc' },
          take: 20,
        },
        referrals: {
          select: { id: true, name: true, mobile: true, createdAt: true, totalSpend: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!guest) return null;

    const totalOrders = guest.posOrders.length;
    const totalPurchased = Number(guest.totalSpend);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalPurchased / totalOrders) : 0;

    return {
      profileInfo: {
        id: guest.id,
        name: guest.name,
        phone: guest.mobile,
        alternateMobile: guest.alternateMobile,
        email: guest.email,
        gstNumber: guest.gstNumber,
        gender: guest.gender,
        birthDate: guest.dateOfBirth,
        anniversaryDate: guest.anniversary,
        store: guest.store || 'kalyaninagar',
        hairType: guest.hairType,
        customerType: guest.customerType,
        lifetimeVisitCount: guest.totalVisits,
        loyaltyPoints: guest.loyaltyPoints,
        referralCode: guest.referralCode,
        advanceBalance: Number(guest.advanceBalance),
        dueBalance: Number(guest.dueBalance),
        totalSpend: totalPurchased,
        avgOrderValue,
        isActive: guest.isActive,
        isBlocked: guest.isBlocked,
        blockReason: guest.blockReason,
      },
      orders: guest.posOrders.map((o) => ({
        id: o.id,
        invoiceNo: o.orderNumber,
        orderDate: o.orderDate,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountAmount),
        couponDiscount: Number(o.couponDiscount),
        giftCardAmount: Number(o.giftCardAmount),
        grandTotal: Number(o.subtotal) - Number(o.discountAmount) - Number(o.couponDiscount) - Number(o.giftCardAmount),
        status: o.status,
        items: o.items.map((it) => ({
          id: it.id,
          name: it.itemName,
          itemType: it.itemType,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          staffName: it.staff?.name || 'Any',
          discountAmount: Number(it.discountAmount),
          total: Number(it.total),
        })),
        payments: o.payments.map((p) => ({
          paymentMethod: p.method,
          amount: Number(p.amount),
        })),
      })),
      memberships: guest.guestMemberships.map((m) => ({
        id: m.id,
        invoiceNumber: m.invoiceNumber,
        membershipCode: m.membershipCode,
        name: m.name,
        membershipType: m.membershipType,
        planFee: Number(m.planFee),
        totalCredit: Number(m.totalCredit),
        remainingCredit: Number(m.remainingCredit),
        validityDays: m.validityDays,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
        status: m.status,
        staffName: m.staff?.name || null,
        paymentDetails: m.paymentDetails,
      })),
      packages: guest.guestPackages.map((p) => ({
        id: p.id,
        name: p.name,
        invoiceNumber: p.invoiceNumber,
        price: Number(p.price),
        validityDays: p.validityDays,
        totalSessions: p.totalSessions,
        remainingSessions: p.remainingSessions,
        services: p.services,
        purchaseDate: p.purchaseDate,
        expiryDate: p.expiryDate,
        status: p.status,
      })),
      wallet: {
        advanceBalance: Number(guest.advanceBalance),
        dueBalance: Number(guest.dueBalance),
        loyaltyPoints: guest.loyaltyPoints,
        transactions: guest.walletTransactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: Number(tx.amount),
          runningBalance: tx.runningBalance ? Number(tx.runningBalance) : null,
          paymentMethod: tx.paymentMethod,
          notes: tx.notes,
          staffName: tx.staff?.name || null,
          transactionDate: tx.transactionDate,
        })),
      },
      followUps: guest.followUps.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        dueDate: f.dueDate,
        status: f.status,
        completedAt: f.completedAt,
        staffName: f.staff?.name || null,
        createdAt: f.createdAt,
      })),
      notes: guest.guestNotes.map((n) => ({
        id: n.id,
        note: n.note,
        tag: n.tag,
        staffName: n.staff?.name || null,
        createdAt: n.createdAt,
      })),
      familyMembers: guest.familyMembers.map((fam) => ({
        id: fam.id,
        name: fam.name,
        relationship: fam.relationship,
        mobile: fam.mobile,
        gender: fam.gender,
        dateOfBirth: fam.dateOfBirth,
        createdAt: fam.createdAt,
      })),
      formSubmissions: guest.formSubmissions.map((form) => ({
        id: form.id,
        formName: form.formName,
        responses: form.responses,
        staffName: form.staff?.name || null,
        submittedAt: form.submittedAt,
      })),
      pastBookings: guest.appointments.map((a) => ({
        id: a.id,
        appointmentDate: a.appointmentDate,
        startTime: a.items[0]?.startTime || null,
        endTime: a.items[0]?.endTime || null,
        status: a.status,
        services: a.items.map((i) => i.service?.name).filter(Boolean),
        staff: a.items.map((i) => i.staff?.name).filter(Boolean),
      })),
      referrals: guest.referrals.map((ref) => ({
        id: ref.id,
        name: ref.name,
        mobile: ref.mobile,
        totalSpend: Number(ref.totalSpend),
        registeredAt: ref.createdAt,
      })),
    };
  }

  // ==========================================
  // ADD GUEST MEMBERSHIP
  // ==========================================
  async addGuestMembership(tenantId: string, guestId: string, input: any) {
    return prisma.$transaction(async (tx) => {
      const count = await tx.guestMembership.count({ where: { tenantId } });
      const invoiceNumber = `MEM/${String(count + 1).padStart(4, '0')}`;
      const membershipCode = `PR/${Math.floor(1000 + Math.random() * 9000)}`;

      const purchaseDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (input.validityDays || 365));

      const membership = await tx.guestMembership.create({
        data: {
          tenantId,
          guestId,
          membershipId: input.membershipId || null,
          staffId: input.staffId || null,
          name: input.name,
          invoiceNumber,
          membershipCode,
          membershipType: input.membershipType || 'Fixed',
          planFee: input.planFee,
          totalCredit: input.totalCredit || input.planFee,
          remainingCredit: input.totalCredit || input.planFee,
          validityDays: input.validityDays || 365,
          purchaseDate,
          expiryDate,
          status: 'ACTIVE',
          paymentDetails: input.payWith || {},
          notes: input.notes || null,
        },
      });

      // Update Guest's membership count and advance/due balance if split payments used
      const payWith = input.payWith || {};
      let advanceDeduction = Number(payWith.advance || 0);
      let balanceAdded = Number(payWith.balance || 0);

      const guest = await tx.guest.findUnique({ where: { id: guestId } });
      if (guest) {
        const newAdvance = Math.max(0, Number(guest.advanceBalance) - advanceDeduction);
        const newDue = Number(guest.dueBalance) + balanceAdded;

        await tx.guest.update({
          where: { id: guestId },
          data: {
            membershipCount: { increment: 1 },
            advanceBalance: newAdvance,
            dueBalance: newDue,
          },
        });

        if (advanceDeduction > 0) {
          await tx.guestWalletTransaction.create({
            data: {
              tenantId,
              guestId,
              type: 'ADVANCE_REDEMPTION',
              amount: advanceDeduction,
              runningBalance: newAdvance,
              paymentMethod: 'Advance Wallet',
              notes: `Payment for Membership ${invoiceNumber}`,
              transactionDate: purchaseDate,
            },
          });
        }

        if (balanceAdded > 0) {
          await tx.guestWalletTransaction.create({
            data: {
              tenantId,
              guestId,
              type: 'DUE_BALANCE_ADDED',
              amount: balanceAdded,
              runningBalance: newDue,
              paymentMethod: 'Due Balance',
              notes: `Outstanding Due for Membership ${invoiceNumber}`,
              transactionDate: purchaseDate,
            },
          });
        }
      }

      return membership;
    });
  }

  // ==========================================
  // ADD GUEST PACKAGE
  // ==========================================
  async addGuestPackage(tenantId: string, guestId: string, input: any) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (input.validityDays || 365));

    return prisma.guestPackage.create({
      data: {
        tenantId,
        guestId,
        packageId: input.packageId || null,
        name: input.name,
        price: input.price,
        validityDays: input.validityDays || 365,
        totalSessions: input.totalSessions || 1,
        remainingSessions: input.totalSessions || 1,
        services: input.services || [],
        purchaseDate: new Date(),
        expiryDate,
        status: 'ACTIVE',
      },
    });
  }

  async redeemPackageSession(tenantId: string, guestId: string, packageId: string, sessions: number = 1) {
    const pkg = await prisma.guestPackage.findFirst({
      where: {
        guestId,
        tenantId,
        OR: [
          { id: packageId },
          { packageId: packageId },
        ],
      },
    });
    if (!pkg) {
      throw new NotFoundError('Guest package not found');
    }
    if (pkg.status !== 'ACTIVE') {
      throw new BadRequestError(`Cannot redeem package with status '${pkg.status}'`);
    }
    if (pkg.remainingSessions < sessions) {
      throw new BadRequestError(`Insufficient remaining sessions. Available: ${pkg.remainingSessions}`);
    }

    const newRemaining = pkg.remainingSessions - sessions;
    const newStatus = newRemaining === 0 ? 'COMPLETED' : 'ACTIVE';

    return prisma.guestPackage.update({
      where: { id: pkg.id },
      data: {
        remainingSessions: newRemaining,
        status: newStatus,
      },
    });
  }

  // ==========================================
  // WALLET & BALANCE TRANSACTIONS
  // ==========================================
  async recordWalletTransaction(tenantId: string, guestId: string, input: any, staffId?: string) {
    return prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findFirst({ where: { tenantId, id: guestId } });
      if (!guest) throw new NotFoundError('Guest not found');

      let newAdvance = Number(guest.advanceBalance);
      let newDue = Number(guest.dueBalance);
      let newLoyalty = guest.loyaltyPoints;
      const amt = Number(input.amount);

      if (input.type === 'ADVANCE_DEPOSIT') {
        newAdvance += amt;
      } else if (input.type === 'ADVANCE_REDEMPTION') {
        if (newAdvance < amt) throw new BadRequestError('Insufficient advance balance');
        newAdvance -= amt;
      } else if (input.type === 'DUE_BALANCE_PAID') {
        newDue = Math.max(0, newDue - amt);
      } else if (input.type === 'DUE_BALANCE_ADDED') {
        newDue += amt;
      } else if (input.type === 'LOYALTY_CREDIT') {
        newLoyalty += Math.round(amt);
      } else if (input.type === 'LOYALTY_DEBIT') {
        if (newLoyalty < amt) throw new BadRequestError(`Insufficient loyalty points balance. Available: ${newLoyalty}`);
        newLoyalty -= Math.round(amt);
      }

      await tx.guest.update({
        where: { id: guestId },
        data: {
          advanceBalance: newAdvance,
          dueBalance: newDue,
          loyaltyPoints: newLoyalty,
        },
      });

      let validStaffId: string | null = null;
      if (staffId) {
        const staff = await tx.staff.findFirst({ where: { tenantId, id: staffId } });
        if (staff) validStaffId = staff.id;
      }

      let runningBal = newAdvance;
      if (input.type.startsWith('DUE')) runningBal = newDue;
      else if (input.type.startsWith('LOYALTY')) runningBal = newLoyalty;

      return tx.guestWalletTransaction.create({
        data: {
          tenantId,
          guestId,
          staffId: validStaffId,
          type: input.type,
          amount: amt,
          runningBalance: runningBal,
          paymentMethod: input.paymentMethod || (input.type.startsWith('LOYALTY') ? 'Loyalty Points' : 'Cash'),
          notes: input.notes || null,
          transactionDate: new Date(),
        },
      });
    });
  }

  // ==========================================
  // FOLLOW UPS
  // ==========================================
  async createFollowUp(tenantId: string, guestId: string, input: any) {
    let validStaffId: string | null = null;
    if (input.staffId) {
      const staff = await prisma.staff.findFirst({ where: { tenantId, id: input.staffId } });
      if (staff) validStaffId = staff.id;
    }

    return prisma.guestFollowUp.create({
      data: {
        tenantId,
        guestId,
        staffId: validStaffId,
        title: input.title.trim(),
        description: input.description ? input.description.trim() : null,
        dueDate: new Date(input.dueDate),
        status: input.status || 'PENDING',
      },
    });
  }

  async updateFollowUp(tenantId: string, id: string, status: string, notes?: string) {
    return prisma.guestFollowUp.update({
      where: { id },
      data: {
        status,
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(notes ? { description: notes } : {}),
      },
    });
  }

  // ==========================================
  // NOTES
  // ==========================================
  async addGuestNote(tenantId: string, guestId: string, input: any, staffId?: string) {
    let validStaffId: string | null = null;
    if (staffId) {
      const staff = await prisma.staff.findFirst({ where: { tenantId, id: staffId } });
      if (staff) validStaffId = staff.id;
    }

    return prisma.guestNote.create({
      data: {
        tenantId,
        guestId,
        staffId: validStaffId,
        note: input.note.trim(),
        tag: input.tag || 'GENERAL',
      },
    });
  }

  async deleteGuestNote(tenantId: string, id: string) {
    return prisma.guestNote.delete({ where: { id } });
  }

  // ==========================================
  // FAMILY MEMBERS
  // ==========================================
  async addFamilyMember(tenantId: string, guestId: string, input: any) {
    return prisma.guestFamilyMember.create({
      data: {
        tenantId,
        guestId,
        name: input.name.trim(),
        relationship: input.relationship,
        mobile: input.mobile ? input.mobile.trim() : null,
        gender: input.gender || null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      },
    });
  }

  async deleteFamilyMember(tenantId: string, id: string) {
    return prisma.guestFamilyMember.delete({ where: { id } });
  }

  // ==========================================
  // FORM SUBMISSION
  // ==========================================
  async submitGuestForm(tenantId: string, guestId: string, input: any, staffId?: string) {
    let validStaffId: string | null = null;
    if (staffId) {
      const staff = await prisma.staff.findFirst({ where: { tenantId, id: staffId } });
      if (staff) validStaffId = staff.id;
    }

    return prisma.guestFormSubmission.create({
      data: {
        tenantId,
        guestId,
        formId: input.formId || null,
        staffId: validStaffId,
        formName: input.formName.trim(),
        responses: input.responses || {},
        submittedAt: new Date(),
      },
    });
  }
}

export const guestRepository = new GuestRepository();

