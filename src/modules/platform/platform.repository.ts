import { prisma } from '../../config/database.js';
import { CompanyQueryParams, AuditLogQueryParams } from './platform.types.js';
import { Prisma, UserStatus } from '@prisma/client';

export class PlatformRepository {
  async findCompanyById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            status: true,
            role: { select: { name: true } },
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findCompanyByCode(code: string) {
    return prisma.tenant.findUnique({
      where: { code },
    });
  }

  async findCompanies(params: CompanyQueryParams) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const { search, isActive, subscriptionStatus, plan, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = typeof isActive === 'string' ? isActive === 'true' : Boolean(isActive);
    }

    if (subscriptionStatus) {
      where.subscriptionStatus = { equals: subscriptionStatus, mode: 'insensitive' };
    }

    if (plan) {
      where.plan = { equals: plan, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [totalItems, items] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              users: true,
              staff: true,
              services: true,
              products: true,
              disposables: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((t) => ({
        ...t,
        stats: {
          totalUsers: t._count.users,
          totalStaff: t._count.staff,
          totalServices: t._count.services,
          totalProducts: t._count.products,
          totalDisposables: t._count.disposables,
        },
      })),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async createCompany(data: Prisma.TenantCreateInput) {
    return prisma.tenant.create({ data });
  }

  async updateCompany(id: string, data: Prisma.TenantUpdateInput) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async getCompanyStats(tenantId: string) {
    const [usersCount, staffCount, servicesCount, productsCount, disposablesCount] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.staff.count({ where: { tenantId } }),
      prisma.service.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.disposable.count({ where: { tenantId } }),
    ]);

    return {
      totalUsers: usersCount,
      totalStaff: staffCount,
      totalServices: servicesCount,
      totalProducts: productsCount,
      totalDisposables: disposablesCount,
    };
  }

  async findRoleByName(name: string) {
    return prisma.role.findUnique({
      where: { name },
    });
  }

  async findUserByUsername(username: string) {
    return prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
  }

  async createAdminUser(data: {
    username: string;
    email?: string | null;
    phone?: string | null;
    passwordHash: string;
    roleId: string;
    tenantId: string;
    mustChangePassword?: boolean;
  }) {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        tenantId: data.tenantId,
        mustChangePassword: data.mustChangePassword ?? false,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        tenant: true,
      },
    });
  }

  async findPendingAdminResetRequests() {
    return prisma.user.findMany({
      where: {
        role: { name: 'ADMIN' },
        passwordResetRequested: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        passwordResetRequested: true,
        passwordResetRequestedAt: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            plan: true,
            subscriptionStatus: true,
          },
        },
      },
      orderBy: {
        passwordResetRequestedAt: 'desc',
      },
    });
  }

  async approveAdminReset(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordResetRequested: false,
        passwordResetRequestedAt: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        tenantId: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async updateAdminPassword(userId: string, passwordHash: string, mustChangePassword = true) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword,
      },
    });
  }

  async createSuperAdmin(data: {
    username: string;
    email: string;
    phone?: string | null;
    passwordHash: string;
    roleId: string;
  }) {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        tenantId: null,
        isSuperAdmin: true,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async findSuperAdmins() {
    return prisma.user.findMany({
      where: {
        OR: [
          { isSuperAdmin: true },
          { role: { name: 'SUPERADMIN' } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async createAuditLog(data: {
    actorId: string;
    actorType: string;
    actorName: string;
    tenantId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        actorType: data.actorType,
        actorName: data.actorName,
        tenantId: data.tenantId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
        ipAddress: data.ipAddress,
      },
    });
  }

  async findAuditLogs(params: AuditLogQueryParams) {
    const { page = 1, limit = 20, tenantId, actorId, action, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (tenantId) where.tenantId = tenantId;
    if (actorId) where.actorId = actorId;
    if (action) where.action = { equals: action, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalItems, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findAdmins(tenantId?: string) {
    return prisma.user.findMany({
      where: {
        role: { name: 'ADMIN' },
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        mustChangePassword: true,
        passwordResetRequested: true,
        passwordResetRequestedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            subscriptionStatus: true,
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminById(userId: string, tenantId?: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        role: { name: 'ADMIN' },
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        mustChangePassword: true,
        passwordResetRequested: true,
        passwordResetRequestedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            subscriptionStatus: true,
            plan: true,
          },
        },
      },
    });
  }

  async updateAdmin(userId: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        mustChangePassword: true,
        tenantId: true,
        updatedAt: true,
      },
    });
  }

  async findCashiers(tenantId: string) {
    return prisma.user.findMany({
      where: {
        tenantId,
        role: { name: 'CASHIER' },
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        mustChangePassword: true,
        passwordResetRequested: true,
        passwordResetRequestedAt: true,
        lastLoginAt: true,
        createdAt: true,
        tenantId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSubscriptionHistory(tenantId: string) {
    return prisma.auditLog.findMany({
      where: {
        tenantId,
        action: {
          in: [
            'SUBSCRIPTION_UPDATED',
            'SUBSCRIPTION_RENEWED',
            'COMPANY_CREATED',
            'TENANT_CREATED',
            'CASHIER_LIMIT_UPDATED',
            'MODULES_UPDATED',
            'COMPANY_STATUS_UPDATED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlatformMetrics() {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      expiredTenants,
      totalUsers,
      totalStaff,
      totalAdmins,
      totalCashiers,
      activeSubscriptions,
      expiringSoonSubscriptions,
      pendingAdminResetRequests,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.tenant.count({ where: { isActive: false } }),
      prisma.tenant.count({
        where: {
          OR: [
            { subscriptionStatus: 'EXPIRED' },
            { subscriptionExpiresAt: { lte: now } },
          ],
        },
      }),
      prisma.user.count(),
      prisma.staff.count(),
      prisma.user.count({ where: { role: { name: 'ADMIN' } } }),
      prisma.user.count({ where: { role: { name: 'CASHIER' } } }),
      prisma.tenant.count({
        where: {
          subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
          OR: [
            { subscriptionExpiresAt: null },
            { subscriptionExpiresAt: { gt: now } },
          ],
        },
      }),
      prisma.tenant.count({
        where: {
          subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
          subscriptionExpiresAt: { gt: now, lte: soon },
        },
      }),
      prisma.user.count({
        where: {
          role: { name: 'ADMIN' },
          passwordResetRequested: true,
        },
      }),
    ]);

    const alerts = [];
    if (pendingAdminResetRequests > 0) {
      alerts.push({
        type: 'WARNING',
        code: 'PENDING_ADMIN_RESETS',
        message: `${pendingAdminResetRequests} company admin password reset request(s) awaiting approval`,
        count: pendingAdminResetRequests,
      });
    }
    if (expiringSoonSubscriptions > 0) {
      alerts.push({
        type: 'INFO',
        code: 'SUBSCRIPTIONS_EXPIRING_SOON',
        message: `${expiringSoonSubscriptions} company subscription(s) expiring within 30 days`,
        count: expiringSoonSubscriptions,
      });
    }
    if (expiredTenants > 0) {
      alerts.push({
        type: 'ALERT',
        code: 'EXPIRED_COMPANIES',
        message: `${expiredTenants} company account(s) have expired subscriptions`,
        count: expiredTenants,
      });
    }

    return {
      totalTenants,
      totalCompanies: totalTenants,
      activeTenants,
      activeCompanies: activeTenants,
      suspendedTenants,
      inactiveCompanies: suspendedTenants,
      expiredTenants,
      expiredCompanies: expiredTenants,
      totalUsers,
      totalStaff,
      totalAdmins,
      totalCashiers,
      activeSubscriptions,
      expiringSoonSubscriptions,
      pendingAdminResetRequests,
      alerts,
      status: 'HEALTHY',
    };
  }
}

export const platformRepository = new PlatformRepository();
