import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cashierRepository, CashierRepository } from './cashier.repository.js';
import { CreateCashierInput, UpdateCashierInput, CashierQueryParams } from './cashier.types.js';
import { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError, BadRequestError, NotFoundError } from '../../utils/app-error.js';
import { UserStatus } from '@prisma/client';

export class CashierService {
  constructor(private repo: CashierRepository = cashierRepository) {}

  async createCashier(
    tenantId: string,
    input: CreateCashierInput,
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    // 1. Verify tenant organization and subscription validity
    const tenant = await this.repo.findTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant organization not found`);
    }

    if (!tenant.isActive) {
      throw new BadRequestError('Tenant organization is inactive or suspended');
    }

    const isExpired =
      tenant.subscriptionStatus === 'EXPIRED' ||
      (tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) <= new Date());

    if (isExpired) {
      throw new BadRequestError(
        'Your company subscription has expired. Please contact the Super Admin to renew the subscription.'
      );
    }

    // 2. Tier 1 Company Module Validation:
    // Admin cannot assign a module to Cashier if it is not enabled for the company
    const companyModules = Array.isArray(tenant.enabledModules)
      ? (tenant.enabledModules as string[])
      : ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF'];

    const moduleCompatibilityMap: Record<string, string[]> = {
      'SERVICES': ['SERVICES', 'Quick Sale POS', 'POS', 'All Modules'],
      'PRODUCTS': ['PRODUCTS', 'Quick Sale POS', 'POS', 'Salon Inventory & POs', 'All Modules'],
      'DISPOSABLES': ['DISPOSABLES', 'Quick Sale POS', 'POS', 'Salon Disposables & Wastage', 'Salon Inventory & POs', 'All Modules'],
      'STAFF': ['STAFF', 'Staff Payroll & Commissions', 'All Modules'],
    };

    const requestedModules = input.enabledModules || ['SERVICES', 'PRODUCTS', 'DISPOSABLES'];
    for (const mod of requestedModules) {
      const allowedIfAny = moduleCompatibilityMap[mod] || [mod];
      const isAllowed = companyModules.some(cm => allowedIfAny.includes(cm) || cm === mod);
      if (!isAllowed) {
        throw new BadRequestError(
          `Cannot assign module '${mod}' because it is not enabled for the company.`
        );
      }
    }

    // 3. Check username uniqueness
    const existingUser = await this.repo.findUserByUsername(input.username);
    if (existingUser) {
      throw new AppError(`Username '${input.username}' is already taken`, 409);
    }

    // 4. Find CASHIER role
    const cashierRole = await this.repo.findCashierRole();
    if (!cashierRole) {
      throw new AppError('CASHIER role not configured in the system', 500);
    }

    // 5. Hash password
    const rawPassword = input.password || 'CashierSecurePassword123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 6. Concurrency-safe creation with PostgreSQL row lock
    const { user, totalActiveCashiers, cashierLimit } = await this.repo.createCashierWithLock({
      tenantId,
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleId: cashierRole.id,
      enabledModules: requestedModules,
    });

    // 7. Audit log
    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'CASHIER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: {
        username: user.username,
        enabledModules: requestedModules,
        totalActiveCashiers,
        cashierLimit,
      },
      ipAddress,
    });

    return user;
  }

  async getCashiers(tenantId: string, params: CashierQueryParams) {
    return this.repo.findCashiers(tenantId, params);
  }

  async getCashierById(id: string, tenantId: string) {
    const cashier = await this.repo.findCashierById(id, tenantId);
    if (!cashier) {
      throw new NotFoundError(`Cashier account not found`);
    }
    return cashier;
  }

  async updateCashier(
    id: string,
    tenantId: string,
    input: UpdateCashierInput,
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    await this.getCashierById(id, tenantId);

    if (input.username) {
      const existing = await this.repo.findUserByUsername(input.username);
      if (existing && existing.id !== id) {
        throw new AppError(`Username '${input.username}' is already taken`, 409);
      }
    }

    let passwordHash: string | undefined;
    if (input.password && input.password.trim()) {
      passwordHash = await bcrypt.hash(input.password.trim(), 10);
    }

    const updated = await this.repo.updateCashier(id, tenantId, {
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'CASHIER_UPDATED',
      entityType: 'USER',
      entityId: id,
      metadata: {
        username: input.username,
        email: input.email,
        phone: input.phone,
        passwordUpdated: !!passwordHash,
      },
      ipAddress,
    });

    return updated;
  }

  async updateCashierStatus(
    id: string,
    tenantId: string,
    status: UserStatus,
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    await this.getCashierById(id, tenantId);

    const updated = await this.repo.updateCashier(id, tenantId, { status });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'CASHIER_STATUS_UPDATED',
      entityType: 'USER',
      entityId: id,
      metadata: { status },
      ipAddress,
    });

    return updated;
  }

  async updateCashierModules(
    id: string,
    tenantId: string,
    enabledModules: string[],
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    // 1. Verify tenant organization and subscription validity
    const tenant = await this.repo.findTenantById(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new BadRequestError('Tenant organization is inactive or suspended');
    }

    const isExpired =
      tenant.subscriptionStatus === 'EXPIRED' ||
      (tenant.subscriptionExpiresAt && new Date(tenant.subscriptionExpiresAt) <= new Date());

    if (isExpired) {
      throw new BadRequestError(
        'Your company subscription has expired. Please contact the Super Admin to renew the subscription.'
      );
    }

    // 2. Strict tenant isolation: Ensure cashier belongs to this tenant
    await this.getCashierById(id, tenantId);

    // 3. Tier 1 Company Module Validation:
    // Admin cannot assign a module to Cashier if it is not enabled for the company (Requirement 3)
    const companyModules = Array.isArray(tenant.enabledModules)
      ? (tenant.enabledModules as string[])
      : ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF'];

    const moduleCompatibilityMap: Record<string, string[]> = {
      'SERVICES': ['SERVICES', 'Quick Sale POS', 'POS', 'All Modules'],
      'PRODUCTS': ['PRODUCTS', 'Quick Sale POS', 'POS', 'Salon Inventory & POs', 'All Modules'],
      'DISPOSABLES': ['DISPOSABLES', 'Quick Sale POS', 'POS', 'Salon Disposables & Wastage', 'Salon Inventory & POs', 'All Modules'],
      'STAFF': ['STAFF', 'Staff Payroll & Commissions', 'All Modules'],
    };

    for (const mod of enabledModules) {
      const allowedIfAny = moduleCompatibilityMap[mod] || [mod];
      const isAllowed = companyModules.some(cm => allowedIfAny.includes(cm) || cm === mod);
      if (!isAllowed) {
        throw new BadRequestError(
          `Cannot assign module '${mod}' because it is not enabled for the company.`
        );
      }
    }

    const updated = await this.repo.updateCashier(id, tenantId, {
      enabledModules,
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'CASHIER_MODULES_UPDATED',
      entityType: 'USER',
      entityId: id,
      metadata: { enabledModules },
      ipAddress,
    });

    return updated;
  }

  async approvePasswordReset(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    // Strict tenant isolation: verify cashier belongs to authenticated Admin's tenant
    const cashier = await this.getCashierById(id, tenantId);

    // Generate secure temporary password
    const temporaryPassword = `TempPass#${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.repo.updateCashier(id, tenantId, {
      passwordHash,
      mustChangePassword: true,
      passwordResetRequested: false,
      passwordResetRequestedAt: null,
    });

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'PASSWORD_RESET_APPROVED',
      entityType: 'USER',
      entityId: id,
      metadata: { username: cashier.username, role: 'CASHIER' },
      ipAddress,
    });

    return {
      temporaryPassword,
      message:
        'Temporary password generated successfully. Provide this to the cashier. They will be required to change it upon first login.',
    };
  }

  async deleteCashier(
    id: string,
    tenantId: string,
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    const cashier = await this.getCashierById(id, tenantId);

    await this.repo.deleteCashier(id, tenantId);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'CASHIER_DELETED',
      entityType: 'USER',
      entityId: id,
      metadata: { username: cashier.username },
      ipAddress,
    });

    return { message: 'Cashier deleted successfully' };
  }

  async getCompanyPermissions(tenantId: string) {
    const tenant = await this.repo.getTenantCashierPermissions(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant organization with ID '${tenantId}' not found`);
    }
    return {
      tenantId: tenant.id,
      companyName: tenant.name,
      enabledModules: tenant.enabledModules,
      permissions: tenant.cashierPermissions || {},
    };
  }

  async updateCompanyPermissions(
    tenantId: string,
    permissions: any,
    actor: AuthenticatedUser,
    ipAddress?: string
  ) {
    const tenant = await this.repo.findTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant organization with ID '${tenantId}' not found`);
    }

    const updated = await this.repo.updateTenantCashierPermissions(tenantId, permissions);

    await this.repo.createAuditLog({
      actorId: actor.id,
      actorType: actor.role.name,
      actorName: actor.username,
      tenantId,
      action: 'CASHIER_PERMISSIONS_UPDATED',
      entityType: 'TENANT',
      entityId: tenantId,
      metadata: { permissions },
      ipAddress,
    });

    return {
      tenantId: updated.id,
      companyName: updated.name,
      enabledModules: updated.enabledModules,
      permissions: updated.cashierPermissions || {},
    };
  }
}

export const cashierService = new CashierService();
