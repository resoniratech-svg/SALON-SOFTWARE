import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { CashierQueryParams } from './cashier.types.js';
import { BadRequestError, NotFoundError } from '../../utils/app-error.js';

export class CashierRepository {
  /**
   * Concurrency-safe Cashier creation with PostgreSQL row-level lock on the Tenant record.
   * Serializes concurrent creation requests for the same tenant.
   */
  async createCashierWithLock(params: {
    tenantId: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    passwordHash: string;
    roleId: string;
    enabledModules: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock the Tenant row in PostgreSQL
      const lockedTenants: any[] = await tx.$queryRaw`
        SELECT id, cashier_limit, is_active, subscription_status, subscription_expires_at, enabled_modules
        FROM tenants
        WHERE id = ${params.tenantId}
        FOR UPDATE
      `;

      if (!lockedTenants || lockedTenants.length === 0) {
        throw new NotFoundError(`Tenant with ID '${params.tenantId}' not found`);
      }

      const lockedTenant = lockedTenants[0];
      const cashierLimit = lockedTenant.cashier_limit;

      // 2. Count active cashiers for this tenant
      const currentCashierCount = await tx.user.count({
        where: {
          tenantId: params.tenantId,
          role: { name: 'CASHIER' },
          status: UserStatus.ACTIVE,
        },
      });

      // 3. Concurrency check
      if (currentCashierCount >= cashierLimit) {
        throw new BadRequestError(
          `Cashier account limit reached (${currentCashierCount}/${cashierLimit}). Please contact platform admin to increase limit.`
        );
      }

      // 4. Create the new Cashier within the transaction
      const newUser = await tx.user.create({
        data: {
          tenantId: params.tenantId,
          username: params.username,
          email: params.email,
          phone: params.phone,
          passwordHash: params.passwordHash,
          roleId: params.roleId,
          status: UserStatus.ACTIVE,
          enabledModules: params.enabledModules,
          isSuperAdmin: false,
          mustChangePassword: false,
        },
        include: {
          role: { select: { id: true, name: true } },
        },
      });

      return {
        user: newUser,
        totalActiveCashiers: currentCashierCount + 1,
        cashierLimit,
      };
    });
  }

  async findCashiers(tenantId: string, params: CashierQueryParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      tenantId,
      role: { name: 'CASHIER' },
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.resetRequested !== undefined) {
      where.passwordResetRequested =
        params.resetRequested === true || String(params.resetRequested) === 'true';
    }

    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          username: true,
          email: true,
          phone: true,
          status: true,
          enabledModules: true,
          mustChangePassword: true,
          passwordResetRequested: true,
          passwordResetRequestedAt: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          role: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCashierById(id: string, tenantId: string) {
    return prisma.user.findFirst({
      where: {
        id,
        tenantId,
        role: { name: 'CASHIER' },
      },
      select: {
        id: true,
        tenantId: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        enabledModules: true,
        mustChangePassword: true,
        passwordResetRequested: true,
        passwordResetRequestedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async findUserByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, tenantId: true },
    });
  }

  async findCashierRole() {
    return prisma.role.findUnique({
      where: { name: 'CASHIER' },
    });
  }

  async updateCashier(id: string, tenantId: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        tenantId: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        enabledModules: true,
        mustChangePassword: true,
        passwordResetRequested: true,
        passwordResetRequestedAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async deleteCashier(id: string, tenantId: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async findTenantById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }

  async getTenantCashierPermissions(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, enabledModules: true, cashierPermissions: true },
    });
  }

  async updateTenantCashierPermissions(tenantId: string, permissions: any) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        cashierPermissions: permissions,
      },
      select: { id: true, name: true, enabledModules: true, cashierPermissions: true },
    });
  }

  async createAuditLog(data: {
    actorId: string;
    actorType: string;
    actorName: string;
    tenantId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        actorType: data.actorType,
        actorName: data.actorName,
        tenantId: data.tenantId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
        ipAddress: data.ipAddress,
      },
    });
  }
}

export const cashierRepository = new CashierRepository();
