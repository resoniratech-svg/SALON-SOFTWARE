import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import {
  CreateEnquiryInput,
  CreateFollowUpInput,
  CreateReferralInput,
  EnquiryFilterQuery,
  ReferralDashboardMetrics,
  ReferralFilterQuery,
  UpdateEnquiryInput,
  UpdateFollowUpInput,
  UpdateReferralInput,
} from './enquiries.types.js';
import { normalizePriority, normalizeStatus } from './enquiries.dto.js';
import { NotFoundError } from '../../utils/app-error.js';

export class EnquiriesRepository {
  // ==========================================
  // 1. ENQUIRIES CRUD & SEARCH
  // ==========================================

  async findEnquiries(tenantId: string, filters: EnquiryFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EnquiryWhereInput = {
      tenantId,
    };

    if (filters.store && filters.store.toLowerCase() !== 'all') {
      where.store = { equals: filters.store.trim(), mode: 'insensitive' };
    }

    if (filters.status && filters.status.toLowerCase() !== 'all') {
      const normalized = normalizeStatus(filters.status);
      where.status = { equals: normalized, mode: 'insensitive' };
    }

    if (filters.priority && filters.priority.toLowerCase() !== 'all') {
      const normalized = normalizePriority(filters.priority);
      where.priority = { equals: normalized, mode: 'insensitive' };
    }

    if (filters.service && filters.service.toLowerCase() !== 'all') {
      where.service = { contains: filters.service.trim(), mode: 'insensitive' };
    }

    const fromDateStr = filters.fromDate || filters.from || filters.startDate;
    const toDateStr = filters.toDate || filters.to || filters.endDate;
    if (fromDateStr || toDateStr) {
      where.createdAt = {};
      if (fromDateStr) where.createdAt.gte = new Date(fromDateStr);
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        if (toDateStr.length === 10) toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { service: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { referralSource: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    const [total, data] = await Promise.all([
      prisma.enquiry.count({ where }),
      prisma.enquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: { select: { id: true, username: true } },
          lastUpdatedBy: { select: { id: true, username: true } },
          guest: { select: { id: true, name: true, mobile: true, email: true } },
          serviceRef: { select: { id: true, name: true } },
          assignedStaff: { select: { id: true, name: true } },
          followUps: {
            orderBy: { followUpDate: 'desc' },
            take: 3,
          },
          _count: {
            select: { followUps: true, histories: true },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findEnquiryById(tenantId: string, id: string) {
    return prisma.enquiry.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { select: { id: true, username: true } },
        lastUpdatedBy: { select: { id: true, username: true } },
        guest: { select: { id: true, name: true, mobile: true, email: true } },
        serviceRef: { select: { id: true, name: true } },
        assignedStaff: { select: { id: true, name: true } },
        followUps: {
          orderBy: { followUpDate: 'desc' },
          include: {
            createdBy: { select: { id: true, username: true } },
          },
        },
        histories: {
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, username: true } },
          },
        },
      },
    });
  }

  async createEnquiry(tenantId: string, input: CreateEnquiryInput, userId?: string) {
    // 1. Resolve customer/guest link
    let resolvedGuestId: string | null = input.guestId || null;
    if (!resolvedGuestId) {
      // Find existing guest by mobile
      const cleanMobile = input.mobile.replace(/\D/g, '').slice(-10);
      const existingGuest = await prisma.guest.findFirst({
        where: {
          tenantId,
          OR: [
            { mobile: { contains: cleanMobile } },
            { mobile: input.mobile.trim() },
          ],
        },
      });
      if (existingGuest) {
        resolvedGuestId = existingGuest.id;
      } else {
        // Auto-create guest profile for unified CRM consistency
        try {
          const newGuest = await prisma.guest.create({
            data: {
              tenantId,
              name: input.name.trim(),
              mobile: input.mobile.trim(),
              email: input.email ? input.email.trim() : null,
              source: input.referralSource || 'ENQUIRY',
              customerType: 'WALK_IN',
            },
          });
          resolvedGuestId = newGuest.id;
        } catch {
          // If guest creation fails due to non-critical constraint, proceed without crashing
          resolvedGuestId = null;
        }
      }
    }

    const priority = normalizePriority(input.priority);
    const status = normalizeStatus(input.status);
    const followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;

    return prisma.$transaction(async (tx) => {
      // Create Enquiry
      const enquiry = await tx.enquiry.create({
        data: {
          tenantId,
          store: input.store || 'kalyaninagar',
          guestId: resolvedGuestId,
          name: input.name.trim(),
          mobile: input.mobile.trim(),
          email: input.email ? input.email.trim() : null,
          priority,
          status,
          service: input.service || null,
          serviceId: input.serviceId || null,
          assignedStaffId: input.assignedStaffId || null,
          referralSource: input.referralSource || null,
          description: input.description || null,
          followUpDate,
          createdById: userId || null,
          lastUpdatedById: userId || null,
        },
        include: {
          createdBy: { select: { id: true, username: true } },
          lastUpdatedBy: { select: { id: true, username: true } },
          guest: { select: { id: true, name: true, mobile: true, email: true } },
          serviceRef: { select: { id: true, name: true } },
          assignedStaff: { select: { id: true, name: true } },
        },
      });

      // If initial follow-up date is provided, create follow-up record
      if (followUpDate) {
        await tx.enquiryFollowUp.create({
          data: {
            tenantId,
            enquiryId: enquiry.id,
            followUpDate,
            notes: input.description || 'Initial Follow-up scheduled',
            status: 'PENDING',
            createdById: userId || null,
          },
        });
      }

      // Record audit history
      await tx.enquiryHistory.create({
        data: {
          tenantId,
          enquiryId: enquiry.id,
          action: 'CREATED',
          notes: `Enquiry created with status: ${status}, priority: ${priority}`,
          performedById: userId || null,
        },
      });

      return enquiry;
    });
  }

  async updateEnquiry(tenantId: string, id: string, input: UpdateEnquiryInput, userId?: string) {
    const existing = await this.findEnquiryById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Enquiry not found');
    }

    const newPriority = input.priority !== undefined ? normalizePriority(input.priority) : existing.priority;
    const newStatus = input.status !== undefined ? normalizeStatus(input.status) : existing.status;
    const newFollowUpDate = input.followUpDate !== undefined
      ? (input.followUpDate ? new Date(input.followUpDate) : null)
      : existing.followUpDate;

    return prisma.$transaction(async (tx) => {
      // Record audit changes
      if (input.status && newStatus !== existing.status) {
        await tx.enquiryHistory.create({
          data: {
            tenantId,
            enquiryId: id,
            action: 'STATUS_CHANGED',
            fieldName: 'status',
            oldValue: existing.status,
            newValue: newStatus,
            notes: `Status changed from ${existing.status} to ${newStatus}`,
            performedById: userId || null,
          },
        });
      }

      if (input.priority && newPriority !== existing.priority) {
        await tx.enquiryHistory.create({
          data: {
            tenantId,
            enquiryId: id,
            action: 'PRIORITY_CHANGED',
            fieldName: 'priority',
            oldValue: existing.priority,
            newValue: newPriority,
            notes: `Priority changed from ${existing.priority} to ${newPriority}`,
            performedById: userId || null,
          },
        });
      }

      if (input.followUpDate !== undefined && newFollowUpDate?.getTime() !== existing.followUpDate?.getTime()) {
        await tx.enquiryHistory.create({
          data: {
            tenantId,
            enquiryId: id,
            action: 'FOLLOW_UP_ADDED',
            fieldName: 'followUpDate',
            oldValue: existing.followUpDate ? existing.followUpDate.toISOString() : null,
            newValue: newFollowUpDate ? newFollowUpDate.toISOString() : null,
            notes: `Follow-up date rescheduled`,
            performedById: userId || null,
          },
        });

        if (newFollowUpDate) {
          await tx.enquiryFollowUp.create({
            data: {
              tenantId,
              enquiryId: id,
              followUpDate: newFollowUpDate,
              notes: input.description || 'Follow-up rescheduled via update',
              status: 'PENDING',
              createdById: userId || null,
            },
          });
        }
      }

      const updated = await tx.enquiry.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.mobile ? { mobile: input.mobile.trim() } : {}),
          ...(input.email !== undefined && { email: input.email ? input.email.trim() : null }),
          ...(input.priority !== undefined && { priority: newPriority }),
          ...(input.status !== undefined && { status: newStatus }),
          ...(input.service !== undefined && { service: input.service || null }),
          ...(input.serviceId !== undefined && { serviceId: input.serviceId || null }),
          ...(input.assignedStaffId !== undefined && { assignedStaffId: input.assignedStaffId || null }),
          ...(input.referralSource !== undefined && { referralSource: input.referralSource || null }),
          ...(input.description !== undefined && { description: input.description || null }),
          ...(input.followUpDate !== undefined && { followUpDate: newFollowUpDate }),
          ...(input.store ? { store: input.store } : {}),
          ...(input.guestId !== undefined && { guestId: input.guestId || null }),
          lastUpdatedById: userId || null,
        },
        include: {
          createdBy: { select: { id: true, username: true } },
          lastUpdatedBy: { select: { id: true, username: true } },
          guest: { select: { id: true, name: true, mobile: true, email: true } },
          serviceRef: { select: { id: true, name: true } },
          assignedStaff: { select: { id: true, name: true } },
          followUps: {
            orderBy: { followUpDate: 'desc' },
            take: 3,
          },
        },
      });

      return updated;
    });
  }

  async deleteEnquiry(tenantId: string, id: string) {
    const existing = await this.findEnquiryById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Enquiry not found');
    }

    await prisma.enquiry.delete({ where: { id } });
    return { success: true, message: 'Enquiry deleted successfully' };
  }

  // ==========================================
  // 2. FOLLOW-UPS & HISTORY
  // ==========================================

  async createFollowUp(tenantId: string, enquiryId: string, input: CreateFollowUpInput, userId?: string) {
    const existing = await this.findEnquiryById(tenantId, enquiryId);
    if (!existing) {
      throw new NotFoundError('Enquiry not found');
    }

    const followUpDate = new Date(input.followUpDate);

    return prisma.$transaction(async (tx) => {
      const followUp = await tx.enquiryFollowUp.create({
        data: {
          tenantId,
          enquiryId,
          followUpDate,
          notes: input.notes || null,
          status: input.status || 'PENDING',
          createdById: userId || null,
        },
        include: {
          createdBy: { select: { id: true, username: true } },
        },
      });

      // Update enquiry's latest follow up date and status if needed
      await tx.enquiry.update({
        where: { id: enquiryId },
        data: {
          followUpDate,
          status: existing.status === 'NEW' ? 'FOLLOWING_UP' : existing.status,
          lastUpdatedById: userId || null,
        },
      });

      // Record in history
      await tx.enquiryHistory.create({
        data: {
          tenantId,
          enquiryId,
          action: 'FOLLOW_UP_ADDED',
          notes: input.notes || `Follow-up scheduled for ${followUpDate.toDateString()}`,
          performedById: userId || null,
        },
      });

      return followUp;
    });
  }

  async getFollowUps(tenantId: string, enquiryId: string) {
    const existing = await this.findEnquiryById(tenantId, enquiryId);
    if (!existing) {
      throw new NotFoundError('Enquiry not found');
    }

    return prisma.enquiryFollowUp.findMany({
      where: { tenantId, enquiryId },
      orderBy: { followUpDate: 'desc' },
      include: {
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async updateFollowUp(tenantId: string, followUpId: string, input: UpdateFollowUpInput) {
    const existing = await prisma.enquiryFollowUp.findFirst({
      where: { id: followUpId, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Follow-up not found');
    }

    return prisma.enquiryFollowUp.update({
      where: { id: followUpId },
      data: {
        ...(input.followUpDate ? { followUpDate: new Date(input.followUpDate) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
  }

  async getEnquiryHistory(tenantId: string, enquiryId: string) {
    const existing = await this.findEnquiryById(tenantId, enquiryId);
    if (!existing) {
      throw new NotFoundError('Enquiry not found');
    }

    return prisma.enquiryHistory.findMany({
      where: { tenantId, enquiryId },
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: { select: { id: true, username: true } },
      },
    });
  }

  // ==========================================
  // 3. REFERRALS & REFERRAL DASHBOARD
  // ==========================================

  async findReferrals(tenantId: string, filters: ReferralFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReferralWhereInput = {
      tenantId,
    };

    if (filters.store && filters.store.toLowerCase() !== 'all') {
      where.store = { equals: filters.store.trim(), mode: 'insensitive' };
    }

    if (filters.status && filters.status.toLowerCase() !== 'all') {
      where.status = { equals: filters.status.trim().toUpperCase(), mode: 'insensitive' };
    }

    const fromDateStr = filters.fromDate || filters.from || filters.startDate;
    const toDateStr = filters.toDate || filters.to || filters.endDate;
    if (fromDateStr || toDateStr) {
      where.referredDate = {};
      if (fromDateStr) where.referredDate.gte = new Date(fromDateStr);
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        if (toDateStr.length === 10) toDate.setHours(23, 59, 59, 999);
        where.referredDate.lte = toDate;
      }
    }

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { referralName: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
        { referralCode: { contains: search, mode: 'insensitive' } },
        { referrerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.referral.count({ where }),
      prisma.referral.findMany({
        where,
        skip,
        take: limit,
        orderBy: { referredDate: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createReferral(tenantId: string, input: CreateReferralInput) {
    const referralCode = input.referralCode || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return prisma.referral.create({
      data: {
        tenantId,
        store: input.store || 'kalyaninagar',
        referralName: input.referralName.trim(),
        mobileNumber: input.mobileNumber.trim(),
        referredDate: input.referredDate ? new Date(input.referredDate) : new Date(),
        referrerGuestId: input.referrerGuestId || null,
        referrerName: input.referrerName || null,
        referralCode,
        status: input.status || 'PENDING',
        benefitToReferral: input.benefitToReferral || '10% OFF first visit',
        benefitToReferrer: input.benefitToReferrer || '₹100 reward points',
      },
    });
  }

  async updateReferral(tenantId: string, id: string, input: UpdateReferralInput) {
    const existing = await prisma.referral.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Referral not found');
    }

    return prisma.referral.update({
      where: { id },
      data: {
        ...(input.referralName ? { referralName: input.referralName.trim() } : {}),
        ...(input.mobileNumber ? { mobileNumber: input.mobileNumber.trim() } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.benefitToReferral !== undefined ? { benefitToReferral: input.benefitToReferral || null } : {}),
        ...(input.benefitToReferrer !== undefined ? { benefitToReferrer: input.benefitToReferrer || null } : {}),
        ...(input.store ? { store: input.store } : {}),
        ...(input.referredDate ? { referredDate: new Date(input.referredDate) } : {}),
      },
    });
  }

  async deleteReferral(tenantId: string, id: string) {
    const existing = await prisma.referral.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Referral not found');
    }

    await prisma.referral.delete({ where: { id } });
    return { success: true, message: 'Referral deleted successfully' };
  }

  async getReferralDashboard(tenantId: string, filters: ReferralFilterQuery): Promise<ReferralDashboardMetrics> {
    const listResult = await this.findReferrals(tenantId, filters);

    const baseWhere: Prisma.ReferralWhereInput = {
      tenantId,
      ...(filters.store && filters.store.toLowerCase() !== 'all'
        ? { store: { equals: filters.store.trim(), mode: 'insensitive' } }
        : {}),
    };

    const fromDateStr = filters.fromDate || filters.from || filters.startDate;
    const toDateStr = filters.toDate || filters.to || filters.endDate;
    if (fromDateStr || toDateStr) {
      baseWhere.referredDate = {};
      if (fromDateStr) baseWhere.referredDate.gte = new Date(fromDateStr);
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        if (toDateStr.length === 10) toDate.setHours(23, 59, 59, 999);
        baseWhere.referredDate.lte = toDate;
      }
    }

    const [totalReferrals, usedReferrals, pendingReferrals, enquiriesCount] = await Promise.all([
      prisma.referral.count({ where: baseWhere }),
      prisma.referral.count({ where: { ...baseWhere, status: 'USED' } }),
      prisma.referral.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.enquiry.count({
        where: {
          tenantId,
          ...(filters.store && filters.store.toLowerCase() !== 'all'
            ? { store: { equals: filters.store.trim(), mode: 'insensitive' } }
            : {}),
        },
      }),
    ]);

    const conversionRate = totalReferrals > 0 ? Number(((usedReferrals / totalReferrals) * 100).toFixed(2)) : 0;

    return {
      totalReferrals,
      usedReferrals,
      pendingReferrals,
      conversionRate,
      enquiries: enquiriesCount,
      referrals: listResult.data,
      total: listResult.total,
      page: listResult.page,
      limit: listResult.limit,
      totalPages: listResult.totalPages,
    };
  }
}
