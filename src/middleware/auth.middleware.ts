import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { UnauthorizedError } from '../utils/app-error.js';
import { JwtPayload, AuthenticatedUser } from '../modules/auth/auth.types.js';
import { authRepository } from '../modules/auth/auth.repository.js';
import { prisma } from '../config/database.js';
import { UserStatus } from '@prisma/client';

export const authenticateJwt = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Authorization header missing');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Malformed Authorization header. Format must be: Bearer <token>');
    }

    const token = parts[1];
    let payload: JwtPayload;

    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Authorization token has expired');
      }
      throw new UnauthorizedError('Invalid authorization token');
    }

    if (!payload.userId) {
      throw new UnauthorizedError('Invalid token payload');
    }

    // Verify user still exists, has active status, and load latest role/permissions from DB
    const user = await authRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User account is inactive or suspended');
    }

    const roleName = user.role.name;

    // Enforce ONLY SUPERADMIN, ADMIN, and CASHIER can authenticate
    if (roleName !== 'SUPERADMIN' && roleName !== 'ADMIN' && roleName !== 'CASHIER') {
      throw new UnauthorizedError(
        'Application access is strictly restricted to SuperAdmin, Company Admin, and Cashier accounts.'
      );
    }

    const permissions = user.role.rolePermissions.map((rp) => rp.permission.code);

    // CONTEXT 3: SUPERADMIN IMPERSONATION CONTEXT
    if (roleName === 'SUPERADMIN' && payload.impersonating) {
      const targetTenantId = payload.targetTenantId || payload.effectiveTenantId;
      if (!targetTenantId) {
        throw new UnauthorizedError('Invalid impersonation context: targetTenantId missing');
      }

      // Real-time revalidation of company status on EVERY request
      const targetTenant = await prisma.tenant.findUnique({
        where: { id: targetTenantId },
      });

      if (!targetTenant) {
        throw new UnauthorizedError('Target company organization not found');
      }

      if (!targetTenant.isActive) {
        throw new UnauthorizedError('Target company organization is inactive or suspended');
      }

      const isTargetExpired =
        targetTenant.subscriptionStatus === 'EXPIRED' ||
        (targetTenant.subscriptionExpiresAt && new Date(targetTenant.subscriptionExpiresAt) <= new Date());

      if (isTargetExpired) {
        throw new UnauthorizedError('Target company subscription has expired');
      }

      // Preserve original actor identity while scoping effective tenant
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        tenantId: targetTenantId,
        username: user.username,
        email: user.email,
        status: user.status,
        isSuperAdmin: true,
        mustChangePassword: user.mustChangePassword,
        impersonating: true,
        originalActorId: payload.originalActorId || user.id,
        originalRole: 'SUPERADMIN',
        targetTenantId,
        effectiveTenantId: targetTenantId,
        role: {
          id: user.role.id,
          name: 'SUPERADMIN',
          description: user.role.description,
          permissions,
        },
        company: {
          id: targetTenant.id,
          name: targetTenant.name,
          code: targetTenant.code,
          address: targetTenant.address,
          contactEmail: targetTenant.contactEmail,
          contactPhone: targetTenant.contactPhone,
        },
      };

      req.user = authenticatedUser;
      req.tenantId = targetTenantId;
      req.effectiveTenantId = targetTenantId;
      return next();
    }

    // CONTEXT 1: SUPERADMIN PLATFORM CONTEXT
    if (roleName === 'SUPERADMIN') {
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        tenantId: null,
        username: user.username,
        email: user.email,
        status: user.status,
        isSuperAdmin: true,
        mustChangePassword: user.mustChangePassword,
        impersonating: false,
        effectiveTenantId: null,
        role: {
          id: user.role.id,
          name: 'SUPERADMIN',
          description: user.role.description,
          permissions,
        },
        company: null,
      };

      req.user = authenticatedUser;
      req.tenantId = undefined;
      req.effectiveTenantId = null;
      return next();
    }

    // CONTEXT 2: COMPANY CONTEXT (ADMIN OR CASHIER)
    if (!user.tenant || !user.tenant.isActive) {
      throw new UnauthorizedError('Tenant organization is inactive or suspended');
    }

    const isCompanyExpired =
      user.tenant.subscriptionStatus === 'EXPIRED' ||
      (user.tenant.subscriptionExpiresAt && new Date(user.tenant.subscriptionExpiresAt) <= new Date());

    if (isCompanyExpired) {
      throw new UnauthorizedError(
        'Your company subscription has expired. Please contact the Super Admin to renew the subscription.'
      );
    }

    const userModules = Array.isArray(user.enabledModules)
      ? (user.enabledModules as string[])
      : [];

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email,
      status: user.status,
      isSuperAdmin: false,
      mustChangePassword: user.mustChangePassword,
      enabledModules: userModules,
      impersonating: false,
      effectiveTenantId: user.tenantId,
      role: {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description,
        permissions,
      },
      company: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            code: user.tenant.code,
            address: user.tenant.address,
            contactEmail: user.tenant.contactEmail,
            contactPhone: user.tenant.contactPhone,
          }
        : null,
    };

    req.user = authenticatedUser;
    req.tenantId = user.tenantId || undefined;
    req.effectiveTenantId = user.tenantId;
    next();
  } catch (error) {
    next(error);
  }
};
