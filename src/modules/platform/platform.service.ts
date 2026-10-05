import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { platformRepository, PlatformRepository } from './platform.repository.js';
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  UpdateSubscriptionInput,
  RenewSubscriptionInput,
  UpdateModulesInput,
  CreateAdminInput,
  UpdateAdminInput,
  CreateSuperAdminInput,
  CompanyQueryParams,
  AuditLogQueryParams,
} from './platform.types.js';
import { AuthenticatedUser, JwtPayload } from '../auth/auth.types.js';
import { UserStatus } from '@prisma/client';
import { config } from '../../config/environment.js';
import { AppError, NotFoundError, BadRequestError } from '../../utils/app-error.js';

export class PlatformService {
  constructor(private repo: PlatformRepository = platformRepository) {}

  async createCompany(input: CreateCompanyInput, actor: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.repo.findCompanyByCode(input.code);
    if (existing) {
      throw new AppError(`Company code '${input.code}' is already registered`, 409);
    }

    const tenant = await this.repo.createCompany({
      name: input.name,
      code: input.code.toLowerCase(),
      plan: input.plan || 'TRIAL',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: input.subscriptionExpiresAt ? new Date(input.subscriptionExpiresAt) : undefined,
      trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : undefined,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      address: input.address,
      city: input.city,
      primaryBranchName: input.primaryBranchName,
      logoUrl: input.logoUrl,
      cashierLimit: input.cashierLimit !== undefined ? input.cashierLimit : 2,
      enabledModules: input.enabledModules || ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF'],
    });

    const adminPayload = input.adminUser || input.admin;
    let adminUser = null;
    if (adminPayload) {
      const existingUser = await this.repo.findUserByUsername(adminPayload.username);
      if (existingUser) {
        throw new AppError(`Username '${adminPayload.username}' is already taken`, 409);
      }

      const adminRole = await this.repo.findRoleByName('ADMIN');
      if (!adminRole) {
        throw new AppError('ADMIN role not configured in system', 500);
      }

      const rawPassword = adminPayload.password || 'AdminTempPassword123!';
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      adminUser = await this.repo.createAdminUser({
        username: adminPayload.username,
        email: adminPayload.email || input.contactEmail,
        phone: adminPayload.phone,
        passwordHash,
        roleId: adminRole.id,
        tenantId: tenant.id,
      });
    }

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: tenant.id,
      action: 'COMPANY_CREATED',
      entityType: 'TENANT',
      entityId: tenant.id,
      metadata: { name: tenant.name, code: tenant.code, plan: tenant.plan },
      ipAddress,
    });

    return {
      company: tenant,
      adminUser: adminUser
        ? {
            id: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            phone: adminUser.phone,
          }
        : null,
    };
  }

  async listCompanies(params: CompanyQueryParams) {
    return this.repo.findCompanies(params);
  }

  async getCompanyById(id: string) {
    const company = await this.repo.findCompanyById(id);
    if (!company) {
      throw new NotFoundError(`Company not found with ID '${id}'`);
    }

    const stats = await this.repo.getCompanyStats(id);

    return {
      ...company,
      stats,
    };
  }

  async updateCompany(id: string, input: UpdateCompanyInput, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getCompanyById(id);

    if (input.code) {
      const existing = await this.repo.findCompanyByCode(input.code);
      if (existing && existing.id !== id) {
        throw new AppError(`Company code '${input.code}' is already registered`, 409);
      }
    }

    const updated = await this.repo.updateCompany(id, {
      ...(input.name ? { name: input.name } : {}),
      ...(input.code ? { code: input.code.toLowerCase() } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.primaryBranchName !== undefined ? { primaryBranchName: input.primaryBranchName } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.cashierLimit !== undefined ? { cashierLimit: input.cashierLimit } : {}),
      ...(input.enabledModules !== undefined ? { enabledModules: input.enabledModules } : {}),
    });

    if (input.ownerName && input.ownerName.trim()) {
      const adminUsers = await this.repo.findAdmins(id);
      if (adminUsers.length > 0) {
        await this.repo.updateAdminUser(adminUsers[0].id, {
          username: input.ownerName.trim(),
          ...(input.contactEmail !== undefined ? { email: input.contactEmail } : {}),
          ...(input.contactPhone !== undefined ? { phone: input.contactPhone } : {}),
        });
      }
    }

    if (input.adminPassword && input.adminPassword.trim().length >= 6) {
      const adminUsers = await this.repo.findAdmins(id);
      if (adminUsers.length > 0) {
        const passwordHash = await bcrypt.hash(input.adminPassword.trim(), 10);
        await this.repo.updateAdminPassword(adminUsers[0].id, passwordHash, false);
      }
    }

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: id,
      action: 'COMPANY_UPDATED',
      entityType: 'TENANT',
      entityId: id,
      metadata: input,
      ipAddress,
    });

    return updated;
  }

  async updateCompanyStatus(id: string, isActive: boolean, reason?: string, actor?: AuthenticatedUser, ipAddress?: string) {
    await this.getCompanyById(id);

    const updated = await this.repo.updateCompany(id, { isActive });

    if (actor) {
      await this.repo.createAuditLog({
        actorId: actor.id,
        actorType: 'SUPERADMIN',
        actorName: actor.username,
        tenantId: id,
        action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_SUSPENDED',
        entityType: 'TENANT',
        entityId: id,
        metadata: { isActive, reason },
        ipAddress,
      });
    }

    return updated;
  }

  async updateSubscription(id: string, input: UpdateSubscriptionInput, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getCompanyById(id);

    const data: any = {};
    if (input.plan) data.plan = input.plan;
    if (input.subscriptionStatus) data.subscriptionStatus = input.subscriptionStatus;
    if (input.subscriptionExpiresAt !== undefined) {
      data.subscriptionExpiresAt = input.subscriptionExpiresAt ? new Date(input.subscriptionExpiresAt) : null;
    }
    if (input.trialEndsAt !== undefined) {
      data.trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
    }
    if (input.expiryAlertDays !== undefined) data.expiryAlertDays = input.expiryAlertDays;

    const updated = await this.repo.updateCompany(id, data);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: id,
      action: 'SUBSCRIPTION_UPDATED',
      entityType: 'TENANT',
      entityId: id,
      metadata: input,
      ipAddress,
    });

    return updated;
  }

  async updateModules(id: string, input: UpdateModulesInput, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getCompanyById(id);

    const updated = await this.repo.updateCompany(id, {
      enabledModules: input.enabledModules,
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: id,
      action: 'MODULES_UPDATED',
      entityType: 'TENANT',
      entityId: id,
      metadata: { enabledModules: input.enabledModules },
      ipAddress,
    });

    return updated;
  }

  async renewSubscription(id: string, input: RenewSubscriptionInput, actor: AuthenticatedUser, ipAddress?: string) {
    const tenant = await this.getCompanyById(id);

    const now = new Date();
    const currentExpiry = tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
    const isCurrentlyActive =
      tenant.subscriptionStatus !== 'EXPIRED' &&
      currentExpiry !== null &&
      currentExpiry > now;

    // Milliseconds in durationDays
    const durationMs = input.durationDays * 24 * 60 * 60 * 1000;

    // SECTION 15, 16, 18:
    // If active: newExpiry = currentExpiry + duration (preserve remaining days!)
    // If expired: newExpiry = now + duration
    const newExpiry = isCurrentlyActive && currentExpiry
      ? new Date(currentExpiry.getTime() + durationMs)
      : new Date(now.getTime() + durationMs);

    const updated = await this.repo.updateCompany(id, {
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: newExpiry,
      ...(input.plan ? { plan: input.plan } : {}),
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: id,
      action: 'SUBSCRIPTION_RENEWED',
      entityType: 'TENANT',
      entityId: id,
      metadata: {
        previousExpiry: currentExpiry ? currentExpiry.toISOString() : null,
        renewalDurationDays: input.durationDays,
        newExpiry: newExpiry.toISOString(),
        plan: input.plan || tenant.plan,
      },
      ipAddress,
    });

    return updated;
  }

  async updateCashierLimit(id: string, cashierLimit: number, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getCompanyById(id);

    const updated = await this.repo.updateCompany(id, { cashierLimit });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: id,
      action: 'CASHIER_LIMIT_UPDATED',
      entityType: 'TENANT',
      entityId: id,
      metadata: { cashierLimit },
      ipAddress,
    });

    return updated;
  }

  async createAdmin(tenantId: string, input: CreateAdminInput, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getCompanyById(tenantId);

    const existingUser = await this.repo.findUserByUsername(input.username);
    if (existingUser) {
      throw new AppError(`Username '${input.username}' is already taken`, 409);
    }

    const adminRole = await this.repo.findRoleByName('ADMIN');
    if (!adminRole) {
      throw new AppError('ADMIN role not configured in system', 500);
    }

    const rawPassword = input.password || 'AdminTempPassword123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await this.repo.createAdminUser({
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleId: adminRole.id,
      tenantId,
      mustChangePassword: true,
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId,
      action: 'ADMIN_CREATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { username: user.username, email: user.email, phone: user.phone },
      ipAddress,
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      tenantId: user.tenantId,
      temporaryPassword: rawPassword,
    };
  }

  async resetAdminPassword(tenantId: string, userId?: string, customTempPassword?: string, actor?: AuthenticatedUser, ipAddress?: string) {
    const company = await this.getCompanyById(tenantId);
    
    // Find target admin: by specific userId if provided, or default to the company's ADMIN user
    let targetUser = userId
      ? company.users.find((u) => u.id === userId)
      : company.users.find((u) => u.role?.name === 'ADMIN');

    if (!targetUser && !userId) {
      targetUser = company.users[0];
    }

    if (!targetUser) {
      if (userId) {
        throw new NotFoundError(`Admin user '${userId}' does not belong to company '${tenantId}'`);
      }
      throw new NotFoundError(`No admin user found for company '${tenantId}'`);
    }

    const tempPassword = customTempPassword || `Temp${crypto.randomBytes(4).toString('hex')}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.repo.updateAdminPassword(targetUser.id, passwordHash, true);

    if (actor) {
      await this.repo.createAuditLog({
        actorId: actor.id,
        actorType: 'SUPERADMIN',
        actorName: actor.username,
        tenantId,
        action: 'ADMIN_PASSWORD_RESET',
        entityType: 'USER',
        entityId: targetUser.id,
        metadata: {
          username: targetUser.username,
          mustChangePassword: true,
        },
        ipAddress,
      });
    }

    return {
      message: 'Admin password reset successfully',
      userId: targetUser.id,
      username: targetUser.username,
      temporaryPassword: tempPassword,
      mustChangePassword: true,
    };
  }

  async listAdmins(tenantId?: string) {
    if (tenantId) {
      await this.getCompanyById(tenantId);
    }
    return this.repo.findAdmins(tenantId);
  }

  async getAdminById(userId: string, tenantId?: string) {
    const admin = await this.repo.findAdminById(userId, tenantId);
    if (!admin) {
      throw new NotFoundError(`Admin user '${userId}' not found${tenantId ? ` in company '${tenantId}'` : ''}`);
    }
    return admin;
  }

  async updateAdmin(
    userId: string,
    input: UpdateAdminInput,
    actor: AuthenticatedUser,
    tenantId?: string,
    ipAddress?: string
  ) {
    const admin = await this.getAdminById(userId, tenantId);

    const updateData: any = {};
    if (input.username && input.username !== admin.username) {
      const existing = await this.repo.findUserByUsername(input.username);
      if (existing && existing.id !== userId) {
        throw new AppError(`Username '${input.username}' is already taken`, 409);
      }
      updateData.username = input.username;
    }

    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.mustChangePassword !== undefined) updateData.mustChangePassword = input.mustChangePassword;

    if (input.password) {
      updateData.passwordHash = await bcrypt.hash(input.password, 10);
    }

    const updated = await this.repo.updateAdmin(userId, updateData);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: admin.tenantId,
      action: 'ADMIN_UPDATED',
      entityType: 'USER',
      entityId: userId,
      metadata: {
        updatedFields: Object.keys(updateData).filter((k) => k !== 'passwordHash'),
      },
      ipAddress,
    });

    return updated;
  }

  async updateAdminStatus(
    userId: string,
    status: UserStatus,
    actor: AuthenticatedUser,
    tenantId?: string,
    ipAddress?: string
  ) {
    const admin = await this.getAdminById(userId, tenantId);

    const updated = await this.repo.updateAdmin(userId, { status });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: admin.tenantId,
      action: status === UserStatus.ACTIVE ? 'ADMIN_ACTIVATED' : 'ADMIN_DEACTIVATED',
      entityType: 'USER',
      entityId: userId,
      metadata: { previousStatus: admin.status, newStatus: status },
      ipAddress,
    });

    return updated;
  }

  async listCompanyCashiers(tenantId: string) {
    await this.getCompanyById(tenantId);
    return this.repo.findCashiers(tenantId);
  }

  async createSuperAdmin(input: CreateSuperAdminInput, actor: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.repo.findUserByUsername(input.username);
    if (existing) {
      throw new AppError(`Username '${input.username}' is already taken`, 409);
    }

    const superAdminRole = await this.repo.findRoleByName('SUPERADMIN');
    if (!superAdminRole) {
      throw new AppError('SUPERADMIN role not configured in system', 500);
    }

    const passwordHash = await bcrypt.hash(input.password || 'SuperAdminSecretPassword123!', 10);

    const user = await this.repo.createSuperAdmin({
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleId: superAdminRole.id,
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: null,
      action: 'SUPERADMIN_CREATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { username: user.username, email: user.email, phone: user.phone },
      ipAddress,
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      isSuperAdmin: true,
    };
  }

  async getAdminResetRequests() {
    return this.repo.findPendingAdminResetRequests();
  }

  async approveAdminResetRequest(userId: string, actor: AuthenticatedUser, ipAddress?: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new NotFoundError(`Admin user '${userId}' not found`);
    }

    if (user.role.name !== 'ADMIN') {
      throw new BadRequestError('Only Company Administrator accounts can be approved through this portal');
    }

    if (!user.passwordResetRequested) {
      throw new BadRequestError('Admin does not have an active password reset request pending');
    }

    const tempPassword = `AdminPass#${crypto.randomBytes(4).toString('hex')}!1A`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const updatedUser = await this.repo.approveAdminReset(userId, passwordHash);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: user.tenantId,
      action: 'PASSWORD_RESET_APPROVED',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        adminUsername: user.username,
        role: 'ADMIN',
        companyId: user.tenantId,
      },
      ipAddress,
    });

    return {
      message: 'Admin password reset approved successfully. Provide this temporary password to the company administrator. They will be required to change it upon first login.',
      userId: updatedUser.id,
      username: updatedUser.username,
      temporaryPassword: tempPassword,
      mustChangePassword: true,
    };
  }

  async listSuperAdmins() {
    return this.repo.findSuperAdmins();
  }

  // ==========================================
  // IMPERSONATION ENGINE
  // ==========================================

  async startImpersonation(tenantId: string, actor: AuthenticatedUser, ipAddress?: string) {
    const company = await this.repo.findCompanyById(tenantId);
    if (!company) {
      throw new NotFoundError(`Target company not found with ID '${tenantId}'`);
    }

    if (!company.isActive) {
      throw new BadRequestError(`Cannot impersonate inactive or suspended company '${company.name}'`);
    }

    if (company.subscriptionStatus === 'EXPIRED') {
      throw new BadRequestError(`Cannot impersonate expired company '${company.name}'. Please renew subscription first.`);
    }

    // SECTION 4 & 10: Build signed impersonation token preserving SuperAdmin identity and targetTenantId
    const impersonationPayload: JwtPayload = {
      userId: actor.id,
      username: actor.username,
      tenantId: company.id, // Effective tenant context
      roleId: actor.role.id,
      role: 'SUPERADMIN', // SECTION 3: Role is NEVER changed to ADMIN
      isSuperAdmin: true,
      impersonating: true,
      originalActorId: actor.id,
      originalRole: 'SUPERADMIN',
      targetTenantId: company.id,
      effectiveTenantId: company.id,
    };

    // Time-limited: 1 hour expiration
    const impersonatedToken = jwt.sign(impersonationPayload, config.jwt.secret, {
      expiresIn: '1h',
    } as SignOptions);

    // Audit log impersonation start
    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      tenantId: company.id,
      action: 'IMPERSONATION_STARTED',
      entityType: 'TENANT',
      entityId: company.id,
      metadata: { companyName: company.name, companyCode: company.code },
      ipAddress,
    });

    return {
      token: impersonatedToken,
      impersonatedToken,
      impersonating: true,
      expiresIn: '1h',
      targetCompany: {
        id: company.id,
        name: company.name,
        code: company.code,
        plan: company.plan,
        enabledModules: company.enabledModules,
        logoUrl: company.logoUrl,
      },
      actor: {
        id: actor.id,
        username: actor.username,
        role: actor.role.name,
      },
    };
  }

  async exitImpersonation(actor: AuthenticatedUser, targetTenantId?: string, ipAddress?: string) {
    const tenantId = targetTenantId || actor.targetTenantId || actor.tenantId;

    if (tenantId) {
      await this.repo.createAuditLog({
        actorId: actor.id,
        actorType: 'SUPERADMIN',
        actorName: actor.username,
        tenantId,
        action: 'IMPERSONATION_ENDED',
        entityType: 'TENANT',
        entityId: tenantId,
        metadata: { originalActorId: actor.originalActorId || actor.id },
        ipAddress,
      });
    }

    return {
      message: 'Impersonation ended successfully. Please restore and resume your original platform SuperAdmin token.',
    };
  }

  async listSubscriptionPlans() {
    return this.repo.findPlans();
  }

  getSubscriptionPlans() {
    return this.listSubscriptionPlans();
  }

  async createSubscriptionPlan(input: any, actor: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.repo.findPlanByName(input.name);
    if (existing) {
      throw new AppError(`Subscription plan with name '${input.name}' already exists`, 409);
    }

    const created = await this.repo.createPlan(input);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      action: 'SUBSCRIPTION_PLAN_CREATED',
      entityType: 'PLAN',
      entityId: created.id,
      metadata: { name: created.name, price: created.price, durationDays: created.durationDays },
      ipAddress,
    });

    return created;
  }

  async updateSubscriptionPlan(id: string, input: any, actor: AuthenticatedUser, ipAddress?: string) {
    const plan = await this.repo.findPlanById(id);
    if (!plan) {
      throw new NotFoundError(`Subscription plan not found with ID '${id}'`);
    }

    if (input.name && input.name !== plan.name) {
      const existing = await this.repo.findPlanByName(input.name);
      if (existing) {
        throw new AppError(`Subscription plan with name '${input.name}' already exists`, 409);
      }
    }

    const updated = await this.repo.updatePlan(id, input);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      action: 'SUBSCRIPTION_PLAN_UPDATED',
      entityType: 'PLAN',
      entityId: id,
      metadata: input,
      ipAddress,
    });

    return updated;
  }

  async deleteSubscriptionPlan(id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const plan = await this.repo.findPlanById(id);
    if (!plan) {
      throw new NotFoundError(`Subscription plan not found with ID '${id}'`);
    }

    await this.repo.deletePlan(id);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: 'SUPERADMIN',
      actorName: actor.username,
      action: 'SUBSCRIPTION_PLAN_DELETED',
      entityType: 'PLAN',
      entityId: id,
      metadata: { name: plan.name },
      ipAddress,
    });

    return { message: `Subscription plan '${plan.name}' deleted successfully` };
  }

  getAvailableModules() {
    return [
      { code: 'SERVICES', name: 'Services & Pricing', description: 'Salon services catalog and categorisation', isCore: true },
      { code: 'PRODUCTS', name: 'Products & Retail', description: 'Retail inventory and merchandise management', isCore: true },
      { code: 'DISPOSABLES', name: 'Disposables & Consumables', description: 'Internal salon operational inventory & usage tracking', isCore: false },
      { code: 'STAFF', name: 'Staff & Stylists', description: 'Staff roster, roles, shifts, and scheduling', isCore: true },
      { code: 'RESOURCES', name: 'Resources & Rooms', description: 'Rooms, stations, chairs, and operational salon equipment', isCore: false },
      { code: 'POS', name: 'Point of Sale & Billing', description: 'Sales register, invoices, cashier desks, and checkout', isCore: false },
      { code: 'APPOINTMENTS', name: 'Appointments & Booking', description: 'Online and in-store customer booking calendar', isCore: false },
      { code: 'ANALYTICS', name: 'Reports & Analytics', description: 'Financial analytics, staff performance, revenue trends', isCore: false },
    ];
  }

  async getCompanySubscriptionHistory(tenantId: string) {
    const company = await this.getCompanyById(tenantId);
    const history = await this.repo.findSubscriptionHistory(tenantId);

    return {
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        plan: company.plan,
        subscriptionStatus: company.subscriptionStatus,
        subscriptionExpiresAt: company.subscriptionExpiresAt,
        trialEndsAt: company.trialEndsAt,
        cashierLimit: company.cashierLimit,
        enabledModules: company.enabledModules,
      },
      history,
    };
  }

  async getAuditLogs(params: AuditLogQueryParams) {
    return this.repo.findAuditLogs(params);
  }

  async getMetricsOverview() {
    return this.repo.getPlatformMetrics();
  }
}

export const platformService = new PlatformService();
