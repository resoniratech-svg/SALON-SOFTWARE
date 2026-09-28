import { guestRepository, GuestRepository } from './guest.repository.js';
import { CreateGuestInput, UpdateGuestInput, UpdateGuestStatusInput, GuestQueryFilters } from './guest.types.js';
import { AuthenticatedUser } from '../auth/auth.types.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../utils/app-error.js';
import { prisma } from '../../config/database.js';

export class GuestService {
  constructor(private repo: GuestRepository = guestRepository) {}

  async create(tenantId: string, input: CreateGuestInput, actor: AuthenticatedUser, ipAddress?: string) {
    const mobile = input.mobile.trim();

    // 1. Mobile uniqueness per tenant
    const existingByMobile = await this.repo.findByMobile(tenantId, mobile);
    if (existingByMobile) {
      throw new ConflictError(`Guest with mobile '${mobile}' already exists in this company`);
    }

    // 2. Guest code handling
    let guestCode = input.guestCode ? input.guestCode.trim() : null;
    if (guestCode) {
      const existingByCode = await this.repo.findByCode(tenantId, guestCode);
      if (existingByCode) {
        throw new ConflictError(`Guest with code '${guestCode}' already exists in this company`);
      }
    } else {
      const lastGuest = await prisma.guest.findFirst({
        where: { tenantId, guestCode: { startsWith: 'GST-' } },
        orderBy: { createdAt: 'desc' },
        select: { guestCode: true },
      });
      let nextNum = 1;
      if (lastGuest?.guestCode) {
        const match = lastGuest.guestCode.match(/GST-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      let candidate = `GST-${String(nextNum).padStart(5, '0')}`;
      while (await this.repo.findByCode(tenantId, candidate)) {
        nextNum++;
        candidate = `GST-${String(nextNum).padStart(5, '0')}`;
      }
      guestCode = candidate;
    }

    // 3. Resolve name / firstName / lastName
    let name = input.name ? input.name.trim() : '';
    let firstName = input.firstName ? input.firstName.trim() : null;
    let lastName = input.lastName ? input.lastName.trim() : null;

    if (!name && firstName) {
      name = [firstName, lastName].filter(Boolean).join(' ');
    } else if (name && !firstName) {
      const parts = name.split(' ');
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }

    // 4. Validate foreign keys if provided
    if (input.salutationId) {
      const sal = await prisma.salutation.findFirst({
        where: { id: input.salutationId, tenantId },
      });
      if (!sal) throw new BadRequestError('Invalid salutation ID for this company');
    }

    if (input.crmSegmentId) {
      const seg = await prisma.crmSegment.findFirst({
        where: { id: input.crmSegmentId, tenantId },
      });
      if (!seg) throw new BadRequestError('Invalid CRM segment ID for this company');
    }

    if (input.membershipId) {
      const mem = await prisma.membership.findFirst({
        where: { id: input.membershipId, tenantId },
      });
      if (!mem) throw new BadRequestError('Invalid membership ID for this company');
    }

    if (input.referredByGuestId) {
      const ref = await this.repo.findById(tenantId, input.referredByGuestId);
      if (!ref) throw new BadRequestError('Invalid referrer guest ID for this company');
    }

    // 5. Date conversions (support both dateOfBirth and dob)
    const dobValue = input.dateOfBirth || input.dob;
    const dateOfBirth = dobValue ? new Date(dobValue) : null;
    const anniversary = input.anniversary ? new Date(input.anniversary) : null;
    const membershipExpiry = input.membershipExpiry ? new Date(input.membershipExpiry) : null;

    const guestData: any = {
      tenantId,
      guestCode,
      salutation: input.salutation?.trim() || null,
      salutationId: input.salutationId || null,
      firstName,
      lastName,
      name,
      displayName: input.displayName?.trim() || name,
      gender: input.gender ? String(input.gender).toUpperCase() : null,
      dateOfBirth,
      mobile,
      alternateMobile: input.alternateMobile?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      country: input.country?.trim() || 'India',
      postalCode: input.postalCode?.trim() || null,
      anniversary,
      gstNumber: input.gstNumber?.trim() || null,
      hairType: input.hairType?.trim() || null,
      preferences: input.preferences?.trim() || null,
      notes: input.notes?.trim() || null,
      tags: Array.isArray(input.tags) ? input.tags : [],
      customerType: input.customerType ? String(input.customerType).toUpperCase() : 'REGULAR',
      source: input.source?.trim() || null,
      referralCode: input.referralCode?.trim() || null,
      referredByGuestId: input.referredByGuestId || null,
      crmSegmentId: input.crmSegmentId || null,
      membershipId: input.membershipId || null,
      membershipExpiry,
      loyaltyPoints: input.loyaltyPoints ?? 0,
      isActive: input.isActive !== undefined ? input.isActive : true,
      isBlocked: input.isBlocked !== undefined ? input.isBlocked : false,
      blockReason: input.blockReason?.trim() || null,
    };

    const guest = await this.repo.create(tenantId, guestData);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'GUEST_CREATED',
        entityType: 'GUEST',
        entityId: guest.id,
        metadata: {
          name: guest.name,
          mobile: guest.mobile,
          guestCode: guest.guestCode,
          customerType: guest.customerType,
        },
        ipAddress,
      },
    });

    return guest;
  }

  async list(tenantId: string, filters: GuestQueryFilters) {
    return this.repo.findMany(tenantId, filters);
  }

  async getById(tenantId: string, id: string) {
    const guest = await this.repo.findById(tenantId, id);
    if (!guest) {
      throw new NotFoundError(`Guest not found with ID '${id}'`);
    }
    return guest;
  }

  async getByMobile(tenantId: string, mobile: string) {
    const guest = await this.repo.findByMobile(tenantId, mobile.trim());
    if (!guest) {
      throw new NotFoundError(`Guest not found with mobile '${mobile}'`);
    }
    return this.getById(tenantId, guest.id);
  }

  async update(tenantId: string, id: string, input: UpdateGuestInput, actor: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.getById(tenantId, id);

    // 1. Mobile uniqueness check if changing mobile
    if (input.mobile && input.mobile.trim() !== existing.mobile) {
      const mobileExists = await this.repo.findByMobile(tenantId, input.mobile.trim(), id);
      if (mobileExists) {
        throw new ConflictError(`Guest with mobile '${input.mobile}' already exists in this company`);
      }
    }

    // 2. Code uniqueness check if changing code
    if (input.guestCode && input.guestCode.trim() !== existing.guestCode) {
      const codeExists = await this.repo.findByCode(tenantId, input.guestCode.trim(), id);
      if (codeExists) {
        throw new ConflictError(`Guest with code '${input.guestCode}' already exists in this company`);
      }
    }

    // 3. Foreign key validations
    if (input.salutationId) {
      const sal = await prisma.salutation.findFirst({
        where: { id: input.salutationId, tenantId },
      });
      if (!sal) throw new BadRequestError('Invalid salutation ID for this company');
    }

    if (input.crmSegmentId) {
      const seg = await prisma.crmSegment.findFirst({
        where: { id: input.crmSegmentId, tenantId },
      });
      if (!seg) throw new BadRequestError('Invalid CRM segment ID for this company');
    }

    if (input.membershipId) {
      const mem = await prisma.membership.findFirst({
        where: { id: input.membershipId, tenantId },
      });
      if (!mem) throw new BadRequestError('Invalid membership ID for this company');
    }

    if (input.referredByGuestId) {
      if (input.referredByGuestId === id) {
        throw new BadRequestError('A guest cannot be referred by themselves');
      }
      const ref = await this.repo.findById(tenantId, input.referredByGuestId);
      if (!ref) throw new BadRequestError('Invalid referrer guest ID for this company');
    }

    const updateData: any = {};
    if (input.guestCode !== undefined) updateData.guestCode = input.guestCode ? input.guestCode.trim() : null;
    if (input.salutation !== undefined) updateData.salutation = input.salutation ? input.salutation.trim() : null;
    if (input.salutationId !== undefined) updateData.salutationId = input.salutationId || null;
    if (input.firstName !== undefined) updateData.firstName = input.firstName ? input.firstName.trim() : null;
    if (input.lastName !== undefined) updateData.lastName = input.lastName ? input.lastName.trim() : null;
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.displayName !== undefined) updateData.displayName = input.displayName ? input.displayName.trim() : null;
    if (input.gender !== undefined) updateData.gender = input.gender ? String(input.gender).toUpperCase() : null;
    if (input.dateOfBirth !== undefined || input.dob !== undefined) {
      const d = input.dateOfBirth || input.dob;
      updateData.dateOfBirth = d ? new Date(d) : null;
    }
    if (input.mobile !== undefined) updateData.mobile = input.mobile.trim();
    if (input.alternateMobile !== undefined) updateData.alternateMobile = input.alternateMobile ? input.alternateMobile.trim() : null;
    if (input.email !== undefined) updateData.email = input.email ? input.email.trim() : null;
    if (input.address !== undefined) updateData.address = input.address ? input.address.trim() : null;
    if (input.city !== undefined) updateData.city = input.city ? input.city.trim() : null;
    if (input.state !== undefined) updateData.state = input.state ? input.state.trim() : null;
    if (input.country !== undefined) updateData.country = input.country ? input.country.trim() : 'India';
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode ? input.postalCode.trim() : null;
    if (input.anniversary !== undefined) updateData.anniversary = input.anniversary ? new Date(input.anniversary) : null;
    if (input.gstNumber !== undefined) updateData.gstNumber = input.gstNumber ? input.gstNumber.trim() : null;
    if (input.hairType !== undefined) updateData.hairType = input.hairType ? input.hairType.trim() : null;
    if (input.preferences !== undefined) updateData.preferences = input.preferences ? input.preferences.trim() : null;
    if (input.notes !== undefined) updateData.notes = input.notes ? input.notes.trim() : null;
    if (input.tags !== undefined) updateData.tags = Array.isArray(input.tags) ? input.tags : [];
    if (input.customerType !== undefined) updateData.customerType = String(input.customerType).toUpperCase();
    if (input.source !== undefined) updateData.source = input.source ? input.source.trim() : null;
    if (input.referralCode !== undefined) updateData.referralCode = input.referralCode ? input.referralCode.trim() : null;
    if (input.referredByGuestId !== undefined) updateData.referredByGuestId = input.referredByGuestId || null;
    if (input.crmSegmentId !== undefined) updateData.crmSegmentId = input.crmSegmentId || null;
    if (input.membershipId !== undefined) updateData.membershipId = input.membershipId || null;
    if (input.membershipExpiry !== undefined) updateData.membershipExpiry = input.membershipExpiry ? new Date(input.membershipExpiry) : null;
    if (input.loyaltyPoints !== undefined) updateData.loyaltyPoints = input.loyaltyPoints;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.isBlocked !== undefined) updateData.isBlocked = input.isBlocked;
    if (input.blockReason !== undefined) updateData.blockReason = input.blockReason ? input.blockReason.trim() : null;

    const updated = await this.repo.update(tenantId, id, updateData);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'GUEST_UPDATED',
        entityType: 'GUEST',
        entityId: id,
        metadata: {
          updatedFields: Object.keys(updateData),
        },
        ipAddress,
      },
    });

    return updated;
  }

  async updateStatus(tenantId: string, id: string, input: UpdateGuestStatusInput, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getById(tenantId, id);

    const updateData: any = {};
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.isBlocked !== undefined) updateData.isBlocked = input.isBlocked;
    if (input.blockReason !== undefined) updateData.blockReason = input.blockReason ? input.blockReason.trim() : null;

    const updated = await this.repo.update(tenantId, id, updateData);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'GUEST_STATUS_UPDATED',
        entityType: 'GUEST',
        entityId: id,
        metadata: updateData,
        ipAddress,
      },
    });

    return updated;
  }

  async delete(tenantId: string, id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.getById(tenantId, id);

    // Soft delete by default or check if referrals exist
    const referrals = await this.repo.getReferrals(tenantId, id);
    if (referrals.length > 0) {
      // Deactivate rather than delete if dependent records exist
      await this.repo.update(tenantId, id, { isActive: false });
    } else {
      await this.repo.delete(tenantId, id);
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'GUEST_DELETED',
        entityType: 'GUEST',
        entityId: id,
        metadata: {
          name: existing.name,
          mobile: existing.mobile,
          guestCode: existing.guestCode,
        },
        ipAddress,
      },
    });

    return { success: true, message: 'Guests deleted successfully' };
  }

  async bulkDelete(tenantId: string, ids: string[], actor: AuthenticatedUser, ipAddress?: string) {
    let deletedCount = 0;
    for (const id of ids) {
      try {
        const referrals = await this.repo.getReferrals(tenantId, id);
        if (referrals.length > 0) {
          await this.repo.update(tenantId, id, { isActive: false });
        } else {
          await this.repo.delete(tenantId, id);
        }
        deletedCount++;
      } catch {
        // Continue with other IDs
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'GUEST_BULK_DELETED',
        entityType: 'GUEST',
        entityId: ids.join(','),
        metadata: {
          deletedCount,
          totalRequested: ids.length,
        },
        ipAddress,
      },
    });

    return {
      success: true,
      message: 'Guests deleted successfully',
      deletedCount,
    };
  }

  async exportCrmGuestsCsv(tenantId: string, filters: any): Promise<string> {
    const listResult = await this.repo.getCrmGuestList(tenantId, {
      ...filters,
      limit: 10000,
      page: 1,
    });

    const headers = [
      'Mobile No.',
      'Name',
      'Gender',
      'Last Visited',
      'Total Orders',
      'Total Purchase Amount',
      'Average Purchase Amount',
      'Online Visits',
      'Loyalty',
      'Referral Code',
      'Advance',
      'Balance',
      'Membership Count',
      'Email',
      'Birth Date',
      'Anniversary',
      'Store',
      'Hair Type',
      'GST Number',
    ];

    const lines = [headers.map((h) => `"${h}"`).join(',')];

    for (const g of listResult.items) {
      const row = [
        g.mobile || '',
        g.name || '',
        g.gender || '',
        g.lastVisited || '-',
        g.totalOrders || 0,
        g.totalPurchaseAmount || 0,
        g.averagePurchaseAmount || 0,
        g.onlineVisits || 0,
        g.loyalty || 0,
        g.referralCode || '-',
        g.advance || 0,
        g.balance || 0,
        g.membershipCount || 0,
        g.email || '-',
        g.birthDate || '-',
        g.anniversary || '-',
        g.store || '',
        g.hairType || '-',
        g.gstNumber || '-',
      ];
      lines.push(row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','));
    }

    return lines.join('\n');
  }

  async getReferrals(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    return this.repo.getReferrals(tenantId, id);
  }

  // ==========================================
  // CRM 360 EXTENSIONS
  // ==========================================
  async getCrmGuestList(tenantId: string, filters: any) {
    return this.repo.getCrmGuestList(tenantId, filters);
  }

  async getGuest360(tenantId: string, guestId: string) {
    const data = await this.repo.getGuest360(tenantId, guestId);
    if (!data) {
      throw new NotFoundError('Guest not found');
    }
    return data;
  }

  async addGuestMembership(tenantId: string, guestId: string, input: any, actor?: AuthenticatedUser) {
    await this.getById(tenantId, guestId);
    return this.repo.addGuestMembership(tenantId, guestId, input);
  }

  async addGuestPackage(tenantId: string, guestId: string, input: any, actor?: AuthenticatedUser) {
    await this.getById(tenantId, guestId);
    return this.repo.addGuestPackage(tenantId, guestId, input);
  }

  async redeemPackageSession(tenantId: string, guestId: string, packageId: string, sessions: number = 1) {
    await this.getById(tenantId, guestId);
    return this.repo.redeemPackageSession(tenantId, guestId, packageId, sessions);
  }

  async recordWalletTransaction(tenantId: string, guestId: string, input: any, staffId?: string) {
    await this.getById(tenantId, guestId);
    return this.repo.recordWalletTransaction(tenantId, guestId, input, staffId);
  }

  async createFollowUp(tenantId: string, guestId: string, input: any) {
    await this.getById(tenantId, guestId);
    return this.repo.createFollowUp(tenantId, guestId, input);
  }

  async updateFollowUp(tenantId: string, id: string, status: string, notes?: string) {
    const existing = await prisma.guestFollowUp.findFirst({ where: { tenantId, id } });
    if (!existing) throw new NotFoundError('Follow-up task not found');
    return this.repo.updateFollowUp(tenantId, id, status, notes);
  }

  async addGuestNote(tenantId: string, guestId: string, input: any, staffId?: string) {
    await this.getById(tenantId, guestId);
    return this.repo.addGuestNote(tenantId, guestId, input, staffId);
  }

  async deleteGuestNote(tenantId: string, id: string) {
    const existing = await prisma.guestNote.findFirst({ where: { tenantId, id } });
    if (!existing) throw new NotFoundError('Note not found');
    return this.repo.deleteGuestNote(tenantId, id);
  }

  async addFamilyMember(tenantId: string, guestId: string, input: any) {
    await this.getById(tenantId, guestId);
    return this.repo.addFamilyMember(tenantId, guestId, input);
  }

  async deleteFamilyMember(tenantId: string, id: string) {
    const existing = await prisma.guestFamilyMember.findFirst({ where: { tenantId, id } });
    if (!existing) throw new NotFoundError('Family member record not found');
    return this.repo.deleteFamilyMember(tenantId, id);
  }

  async submitGuestForm(tenantId: string, guestId: string, input: any, staffId?: string) {
    await this.getById(tenantId, guestId);
    return this.repo.submitGuestForm(tenantId, guestId, input, staffId);
  }
}

export const guestService = new GuestService();

