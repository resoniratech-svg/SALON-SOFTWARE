import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class SettingsRepository {
  // ==========================================
  // 1. TENANT SETTINGS (SINGLETON)
  // ==========================================
  async getOrCreateTenantSettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId },
      });
    }

    return settings;
  }

  async updateTenantSettings(tenantId: string, data: Prisma.TenantSettingsUpdateInput) {
    return prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data as any,
      },
      update: data,
    });
  }

  // ==========================================
  // 2. TAX MAPPINGS
  // ==========================================
  async createTaxMapping(tenantId: string, data: Prisma.TaxMappingCreateWithoutTenantInput) {
    return prisma.taxMapping.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listTaxMappings(tenantId: string, isActive?: boolean) {
    return prisma.taxMapping.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTaxMappingById(tenantId: string, id: string) {
    return prisma.taxMapping.findFirst({
      where: { id, tenantId },
    });
  }

  async findTaxMappingByName(tenantId: string, name: string) {
    return prisma.taxMapping.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updateTaxMapping(tenantId: string, id: string, data: Prisma.TaxMappingUpdateInput) {
    return prisma.taxMapping.update({
      where: { id },
      data,
    });
  }

  async deleteTaxMapping(tenantId: string, id: string) {
    return prisma.taxMapping.delete({
      where: { id },
    });
  }

  // ==========================================
  // 3. MEMBERSHIPS
  // ==========================================
  async createMembership(tenantId: string, data: Prisma.MembershipCreateWithoutTenantInput) {
    return prisma.membership.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listMemberships(tenantId: string, isActive?: boolean) {
    return prisma.membership.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMembershipById(tenantId: string, id: string) {
    return prisma.membership.findFirst({
      where: { id, tenantId },
    });
  }

  async findMembershipByName(tenantId: string, name: string) {
    return prisma.membership.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updateMembership(tenantId: string, id: string, data: Prisma.MembershipUpdateInput) {
    return prisma.membership.update({
      where: { id },
      data,
    });
  }

  async deleteMembership(tenantId: string, id: string) {
    return prisma.membership.delete({
      where: { id },
    });
  }

  // ==========================================
  // 4. PACKAGES
  // ==========================================
  async createPackage(tenantId: string, data: Prisma.PackageCreateWithoutTenantInput) {
    return prisma.package.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listPackages(tenantId: string, isActive?: boolean) {
    return prisma.package.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPackageById(tenantId: string, id: string) {
    return prisma.package.findFirst({
      where: { id, tenantId },
    });
  }

  async findPackageByName(tenantId: string, name: string) {
    return prisma.package.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updatePackage(tenantId: string, id: string, data: Prisma.PackageUpdateInput) {
    return prisma.package.update({
      where: { id },
      data,
    });
  }

  async deletePackage(tenantId: string, id: string) {
    return prisma.package.delete({
      where: { id },
    });
  }

  // ==========================================
  // 5. GIFT CARDS
  // ==========================================
  async createGiftCard(tenantId: string, data: Prisma.GiftCardCreateWithoutTenantInput) {
    return prisma.giftCard.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listGiftCards(tenantId: string, isActive?: boolean) {
    return prisma.giftCard.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGiftCardById(tenantId: string, id: string) {
    return prisma.giftCard.findFirst({
      where: { id, tenantId },
    });
  }

  async findGiftCardByCode(tenantId: string, code: string) {
    return prisma.giftCard.findFirst({
      where: { tenantId, code: { equals: code, mode: 'insensitive' } },
    });
  }

  async updateGiftCard(tenantId: string, id: string, data: Prisma.GiftCardUpdateInput) {
    return prisma.giftCard.update({
      where: { id },
      data,
    });
  }

  async deleteGiftCard(tenantId: string, id: string) {
    return prisma.giftCard.delete({
      where: { id },
    });
  }

  // ==========================================
  // 6. COUPONS
  // ==========================================
  async createCoupon(tenantId: string, data: Prisma.CouponCreateWithoutTenantInput) {
    return prisma.coupon.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listCoupons(tenantId: string, isActive?: boolean) {
    return prisma.coupon.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCouponById(tenantId: string, id: string) {
    return prisma.coupon.findFirst({
      where: { id, tenantId },
    });
  }

  async findCouponByCode(tenantId: string, code: string) {
    return prisma.coupon.findFirst({
      where: { tenantId, code: { equals: code, mode: 'insensitive' } },
    });
  }

  async updateCoupon(tenantId: string, id: string, data: Prisma.CouponUpdateInput) {
    return prisma.coupon.update({
      where: { id },
      data,
    });
  }

  async deleteCoupon(tenantId: string, id: string) {
    return prisma.coupon.delete({
      where: { id },
    });
  }

  // ==========================================
  // 7. PNL CATEGORIES
  // ==========================================
  async createPnlCategory(tenantId: string, data: Prisma.PnlCategoryCreateWithoutTenantInput) {
    return prisma.pnlCategory.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listPnlCategories(tenantId: string, type?: string, isActive?: boolean) {
    return prisma.pnlCategory.findMany({
      where: {
        tenantId,
        ...(type ? { type } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getPnlCategoryById(tenantId: string, id: string) {
    return prisma.pnlCategory.findFirst({
      where: { id, tenantId },
    });
  }

  async findPnlCategoryByName(tenantId: string, name: string) {
    return prisma.pnlCategory.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updatePnlCategory(tenantId: string, id: string, data: Prisma.PnlCategoryUpdateInput) {
    return prisma.pnlCategory.update({
      where: { id },
      data,
    });
  }

  async deletePnlCategory(tenantId: string, id: string) {
    return prisma.pnlCategory.delete({
      where: { id },
    });
  }

  // ==========================================
  // 8. PNL INCOME TAXES
  // ==========================================
  async createPnlIncomeTax(tenantId: string, data: Prisma.PnlIncomeTaxCreateWithoutTenantInput) {
    return prisma.pnlIncomeTax.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listPnlIncomeTaxes(tenantId: string, isActive?: boolean) {
    return prisma.pnlIncomeTax.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { fromAmount: 'asc' },
    });
  }

  async getPnlIncomeTaxById(tenantId: string, id: string) {
    return prisma.pnlIncomeTax.findFirst({
      where: { id, tenantId },
    });
  }

  async findOverlappingIncomeTax(
    tenantId: string,
    fromAmount: number,
    toAmount: number,
    excludeId?: string
  ) {
    // Two ranges [A, B] and [C, D] overlap if max(A, C) < min(B, D)
    const existing = await prisma.pnlIncomeTax.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return existing.find((item) => {
      const itemFrom = Number(item.fromAmount);
      const itemTo = Number(item.toAmount);
      return Math.max(fromAmount, itemFrom) < Math.min(toAmount, itemTo);
    });
  }

  async updatePnlIncomeTax(tenantId: string, id: string, data: Prisma.PnlIncomeTaxUpdateInput) {
    return prisma.pnlIncomeTax.update({
      where: { id },
      data,
    });
  }

  async deletePnlIncomeTax(tenantId: string, id: string) {
    return prisma.pnlIncomeTax.delete({
      where: { id },
    });
  }

  // ==========================================
  // 9. CRM SEGMENTS
  // ==========================================
  async createCrmSegment(tenantId: string, data: Prisma.CrmSegmentCreateWithoutTenantInput) {
    return prisma.crmSegment.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listCrmSegments(tenantId: string, isActive?: boolean) {
    return prisma.crmSegment.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCrmSegmentById(tenantId: string, id: string) {
    return prisma.crmSegment.findFirst({
      where: { id, tenantId },
    });
  }

  async findCrmSegmentByName(tenantId: string, name: string) {
    return prisma.crmSegment.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updateCrmSegment(tenantId: string, id: string, data: Prisma.CrmSegmentUpdateInput) {
    return prisma.crmSegment.update({
      where: { id },
      data,
    });
  }

  async deleteCrmSegment(tenantId: string, id: string) {
    return prisma.crmSegment.delete({
      where: { id },
    });
  }

  // ==========================================
  // 10. CUSTOM FORMS
  // ==========================================
  async createCustomForm(tenantId: string, data: Prisma.CustomFormCreateWithoutTenantInput) {
    return prisma.customForm.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listCustomForms(tenantId: string, isActive?: boolean) {
    return prisma.customForm.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCustomFormById(tenantId: string, id: string) {
    return prisma.customForm.findFirst({
      where: { id, tenantId },
    });
  }

  async findCustomFormByName(tenantId: string, name: string) {
    return prisma.customForm.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updateCustomForm(tenantId: string, id: string, data: Prisma.CustomFormUpdateInput) {
    return prisma.customForm.update({
      where: { id },
      data,
    });
  }

  async deleteCustomForm(tenantId: string, id: string) {
    return prisma.customForm.delete({
      where: { id },
    });
  }

  // ==========================================
  // 11. SALUTATIONS
  // ==========================================
  async createSalutation(tenantId: string, data: Prisma.SalutationCreateWithoutTenantInput) {
    return prisma.salutation.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async listSalutations(tenantId: string, isActive?: boolean) {
    return prisma.salutation.findMany({
      where: {
        tenantId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  async getSalutationById(tenantId: string, id: string) {
    return prisma.salutation.findFirst({
      where: { id, tenantId },
    });
  }

  async findSalutationByTitle(tenantId: string, title: string) {
    return prisma.salutation.findFirst({
      where: { tenantId, title: { equals: title, mode: 'insensitive' } },
    });
  }

  async updateSalutation(tenantId: string, id: string, data: Prisma.SalutationUpdateInput) {
    return prisma.salutation.update({
      where: { id },
      data,
    });
  }

  async deleteSalutation(tenantId: string, id: string) {
    return prisma.salutation.delete({
      where: { id },
    });
  }

  // ==========================================
  // 12. DESIGNATIONS (REUSED)
  // ==========================================
  async createDesignation(tenantId: string, name: string, description?: string) {
    return prisma.designation.create({
      data: { tenantId, name, description },
    });
  }

  async listDesignations(tenantId: string) {
    return prisma.designation.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getDesignationById(tenantId: string, id: string) {
    return prisma.designation.findFirst({
      where: { id, tenantId },
    });
  }

  async findDesignationByName(tenantId: string, name: string) {
    return prisma.designation.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updateDesignation(tenantId: string, id: string, data: { name?: string; description?: string }) {
    return prisma.designation.update({
      where: { id },
      data,
    });
  }

  async checkDesignationInUse(tenantId: string, id: string) {
    return prisma.staffJoiningDetail.findFirst({
      where: { designationId: id, staff: { tenantId } },
    });
  }

  async deleteDesignation(tenantId: string, id: string) {
    return prisma.designation.delete({
      where: { id },
    });
  }

  // ==========================================
  // 13. SHIFTS (REUSED)
  // ==========================================
  async createShift(
    tenantId: string,
    data: {
      name: string;
      startTime: string;
      endTime: string;
      isActive?: boolean;
      timings?: any;
      breaks?: any;
    }
  ) {
    return prisma.shift.create({
      data: {
        tenantId,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive !== undefined ? data.isActive : true,
        timings: data.timings ?? [],
        breaks: data.breaks ?? [],
      },
    });
  }

  async listShifts(tenantId: string, filters?: { isActive?: boolean; search?: string }) {
    const where: any = { tenantId };
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }
    return prisma.shift.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }

  async getShiftById(tenantId: string, id: string) {
    return prisma.shift.findFirst({
      where: { id, tenantId },
    });
  }

  async findShiftByName(tenantId: string, name: string) {
    return prisma.shift.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async updateShift(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
      timings?: any;
      breaks?: any;
    }
  ) {
    return prisma.shift.update({
      where: { id },
      data,
    });
  }

  async checkShiftInUse(tenantId: string, id: string) {
    return prisma.staffWeeklySchedule.findFirst({
      where: { shiftId: id, staff: { tenantId } },
    });
  }

  async deleteShift(tenantId: string, id: string) {
    return prisma.shift.delete({
      where: { id },
    });
  }

  // ==========================================
  // 14. ROSTER (REUSED VIA STAFF & SCHEDULES)
  // ==========================================
  async getRoster(tenantId: string) {
    return prisma.staff.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        isActive: true,
        personalDetails: {
          select: {
            displayName: true,
            mobile: true,
          },
        },
        joiningDetails: {
          select: {
            employeeNumber: true,
            designation: {
              select: { id: true, name: true },
            },
          },
        },
        weeklySchedules: {
          select: {
            dayOfWeek: true,
            isWeeklyOff: true,
            shift: {
              select: {
                id: true,
                name: true,
                startTime: true,
                endTime: true,
                isActive: true,
                timings: true,
                breaks: true,
              },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateStaffRoster(
    tenantId: string,
    staffId: string,
    schedules: Array<{ dayOfWeek: number; shiftId?: string | null; isWeeklyOff: boolean }>
  ) {
    // Verify staff belongs to tenant
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });
    if (!staff) return null;

    return prisma.$transaction(async (tx) => {
      await tx.staffWeeklySchedule.deleteMany({
        where: { staffId },
      });

      await tx.staffWeeklySchedule.createMany({
        data: schedules.map((s) => ({
          staffId,
          dayOfWeek: s.dayOfWeek,
          shiftId: s.isWeeklyOff ? null : (s.shiftId || null),
          isWeeklyOff: s.isWeeklyOff,
        })),
      });

      return tx.staff.findUnique({
        where: { id: staffId },
        include: {
          weeklySchedules: {
            include: { shift: true },
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      });
    });
  }

  async applyShiftToStaff(
    tenantId: string,
    shiftId: string,
    staffIds: string[],
    daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6]
  ) {
    return prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      for (const staffId of staffIds) {
        // Ensure staff belongs to tenant
        const staff = await tx.staff.findFirst({
          where: { id: staffId, tenantId },
        });
        if (!staff) continue;

        for (const dayOfWeek of daysOfWeek) {
          await tx.staffWeeklySchedule.upsert({
            where: {
              staffId_dayOfWeek: { staffId, dayOfWeek },
            },
            create: {
              staffId,
              dayOfWeek,
              shiftId,
              isWeeklyOff: false,
            },
            update: {
              shiftId,
              isWeeklyOff: false,
            },
          });
        }
        updatedCount++;
      }
      return { success: true, updatedStaffCount: updatedCount, daysApplied: daysOfWeek };
    });
  }

  // ==========================================
  // 15. ACCESS CONTROL (RBAC)
  // ==========================================
  async listRoles() {
    return prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  async listTenantUsersWithRoles(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        role: { select: { id: true, name: true, description: true } },
        enabledModules: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const settingsRepository = new SettingsRepository();
