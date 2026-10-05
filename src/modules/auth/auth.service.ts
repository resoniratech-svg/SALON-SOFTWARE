import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { authRepository, AuthRepository } from './auth.repository.js';
import { LoginInput } from './auth.validation.js';
import { config } from '../../config/environment.js';
import { UnauthorizedError, AppError, BadRequestError, NotFoundError } from '../../utils/app-error.js';
import { JwtPayload, AuthenticatedUser } from './auth.types.js';
import { UserStatus } from '@prisma/client';
import { emailService } from '../../services/email.service.js';

import { prisma } from '../../config/database.js';

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  async login(credentials: LoginInput): Promise<{
    token: string;
    expiresIn: string;
    user: {
      id: string;
      tenantId: string | null;
      username: string;
      email: string | null;
      status: UserStatus;
      isSuperAdmin: boolean;
      mustChangePassword: boolean;
      enabledModules?: string[];
      role: {
        id: string;
        name: string;
        permissions: string[];
      };
      subscription?: {
        plan: string;
        status: string;
        expiresAt: Date | null;
        daysRemaining: number | null;
      };
      company?: {
        id: string;
        name: string;
        code: string;
        address: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        logoUrl?: string | null;
      } | null;
    };
  }> {
    const identifier = (credentials.username || credentials.email || '').trim();
    const user = await this.repo.findByUsername(identifier);

    // Constant-time security check or generic error to prevent account enumeration
    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid username or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User account is inactive or suspended');
    }

    const roleName = user.role.name;

    // Enforce ONLY SUPERADMIN, ADMIN, and CASHIER can authenticate
    if (roleName !== 'SUPERADMIN' && roleName !== 'ADMIN' && roleName !== 'CASHIER') {
      throw new UnauthorizedError(
        'Staff and non-administrative personnel do not have application login accounts.'
      );
    }

    // Tenant and subscription enforcement for Company Admin & Cashier
    if (roleName === 'ADMIN' || roleName === 'CASHIER') {
      if (!user.tenant || !user.tenant.isActive) {
        throw new UnauthorizedError('Tenant organization is inactive or suspended');
      }

      const isExpired =
        user.tenant.subscriptionStatus === 'EXPIRED' ||
        (user.tenant.subscriptionExpiresAt && new Date(user.tenant.subscriptionExpiresAt) <= new Date());

      if (isExpired) {
        throw new UnauthorizedError(
          'Your company subscription has expired. Please contact the Super Admin to renew the subscription.'
        );
      }
    }

    // Update last login timestamp asynchronously
    await this.repo.updateLastLogin(user.id);

    const permissions = user.role.rolePermissions.map((rp) => rp.permission.code);
    const isSuperAdmin = user.isSuperAdmin || roleName === 'SUPERADMIN';
    const userModules = Array.isArray(user.enabledModules)
      ? (user.enabledModules as string[])
      : [];

    const tokenPayload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      roleId: user.role.id,
      role: user.role.name,
      isSuperAdmin,
      impersonating: false,
      effectiveTenantId: user.tenantId,
    };

    const token = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);

    const daysRemaining = user.tenant?.subscriptionExpiresAt
      ? Math.max(0, Math.ceil((new Date(user.tenant.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      token,
      expiresIn: config.jwt.expiresIn,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        email: user.email,
        status: user.status,
        isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
        enabledModules: userModules,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions,
        },
        subscription: user.tenant
          ? {
              plan: user.tenant.plan,
              status: user.tenant.subscriptionStatus,
              expiresAt: user.tenant.subscriptionExpiresAt,
              daysRemaining,
            }
          : undefined,
        company: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              code: user.tenant.code,
              address: user.tenant.address,
              contactEmail: user.tenant.contactEmail,
              contactPhone: user.tenant.contactPhone,
              logoUrl: user.tenant.logoUrl,
            }
          : null,
      },
    };
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.repo.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const isSuperAdmin = user.isSuperAdmin || user.role.name === 'SUPERADMIN';

    if (!isSuperAdmin) {
      if (!user.tenant || !user.tenant.isActive) {
        throw new UnauthorizedError('Tenant organization is inactive or suspended');
      }

      const isExpired =
        user.tenant.subscriptionStatus === 'EXPIRED' ||
        (user.tenant.subscriptionExpiresAt && new Date(user.tenant.subscriptionExpiresAt) <= new Date());

      if (isExpired) {
        throw new UnauthorizedError(
          'Your company subscription has expired. Please contact the Super Admin to renew the subscription.'
        );
      }
    }

    const permissions = user.role.rolePermissions.map((rp) => rp.permission.code);
    const userModules = Array.isArray(user.enabledModules)
      ? (user.enabledModules as string[])
      : [];

    const daysRemaining = user.tenant?.subscriptionExpiresAt
      ? Math.max(0, Math.ceil((new Date(user.tenant.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email,
      status: user.status,
      isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
      enabledModules: userModules,
      subscription: user.tenant
        ? {
            plan: user.tenant.plan,
            status: user.tenant.subscriptionStatus,
            expiresAt: user.tenant.subscriptionExpiresAt,
            daysRemaining,
          }
        : undefined,
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
            logoUrl: user.tenant.logoUrl,
          }
        : null,
    };
  }

  async requestCashierPasswordReset(userId: string): Promise<{ message: string }> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.role.name !== 'CASHIER') {
      throw new BadRequestError('Only Cashier accounts can use this password reset request flow');
    }

    if (user.passwordResetRequested) {
      throw new BadRequestError('A password reset request is already pending approval by your company Administrator');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetRequested: true,
        passwordResetRequestedAt: new Date(),
      },
    });

    return {
      message: 'Password reset request submitted successfully. Please contact your company Administrator for approval.',
    };
  }

  // Unified Role-Based Password Recovery Flow
  async forgotPassword(
    input: { identifier?: string; email?: string; username?: string; phone?: string; mobile?: string },
    ipAddress?: string
  ): Promise<{
    message: string;
    role?: string;
    status?: string;
    delivery?: any;
    temporaryPassword?: string;
    resetToken?: string;
    mustChangePassword?: boolean;
  }> {
    const rawIdentifier = (input.identifier || input.email || input.username || input.phone || input.mobile || '').trim();
    if (!rawIdentifier) {
      throw new BadRequestError('Identifier is required');
    }

    const isExplicitUnifiedCall = Boolean(input.identifier || input.phone || input.mobile);
    const user = await this.repo.findByIdentifier(rawIdentifier);

    if (!user) {
      if (isExplicitUnifiedCall) {
        throw new NotFoundError('Account not found or invalid details.');
      }
      return { message: 'If the account exists, a secure password reset link has been dispatched.' };
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User account is inactive or suspended');
    }

    const roleName = user.role.name;
    if (roleName !== 'SUPERADMIN' && roleName !== 'ADMIN' && roleName !== 'CASHIER') {
      throw new BadRequestError('Password recovery is only supported for SuperAdmin, Admin, and Cashier accounts.');
    }

    // Role 1: SUPERADMIN Direct Recovery (Self-Service)
    if (roleName === 'SUPERADMIN') {
      const tempPassword = `Temp#${crypto.randomBytes(4).toString('hex')}!1A`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await this.repo.setTemporaryPassword(user.id, passwordHash);

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: 'SUPERADMIN',
          actorName: user.username,
          tenantId: null,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'USER',
          entityId: user.id,
          metadata: { username: user.username, email: user.email, role: 'SUPERADMIN' },
          ipAddress,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: 'SUPERADMIN',
          actorName: user.username,
          tenantId: null,
          action: 'PASSWORD_RESET_APPROVED',
          entityType: 'USER',
          entityId: user.id,
          metadata: { username: user.username, email: user.email, role: 'SUPERADMIN', selfService: true },
          ipAddress,
        },
      });

      let resetToken: string | undefined;
      if (!isExplicitUnifiedCall) {
        resetToken = crypto.randomBytes(32).toString('hex');
        await this.repo.setResetPasswordToken(user.id, resetToken, new Date(Date.now() + 60 * 60 * 1000));
      }

      const delivery = await emailService.sendTemporaryPassword(
        user.email || 'superadmin@qubexe.io',
        user.username,
        tempPassword
      );

      const response: any = {
        message: delivery.sent
          ? 'If the account exists, a secure temporary password has been sent to your registered email.'
          : 'Temporary password generated. Email service is not configured (SMTP integration missing); temporary credential provided for testing/delivery.',
        role: 'SUPERADMIN',
        mustChangePassword: true,
        delivery,
      };

      if (!delivery.sent) {
        response.temporaryPassword = tempPassword;
      }
      if (resetToken) {
        response.resetToken = resetToken;
      }

      return response;
    }

    // Role 2: ADMIN (Company Admin) Approval Chain
    if (roleName === 'ADMIN') {
      if (!isExplicitUnifiedCall) {
        return { message: 'If the account exists, a secure password reset link has been dispatched.' };
      }

      if (user.passwordResetRequested) {
        throw new BadRequestError('A password reset request is already pending approval by the SuperAdmin.');
      }

      await this.repo.setPasswordResetRequested(user.id, true);

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: 'ADMIN',
          actorName: user.username,
          tenantId: user.tenantId,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'USER',
          entityId: user.id,
          metadata: {
            username: user.username,
            email: user.email,
            phone: user.phone,
            companyId: user.tenantId,
            role: 'ADMIN',
          },
          ipAddress,
        },
      });

      return {
        message: 'Password reset request submitted. Please contact the SuperAdmin for approval.',
        role: 'ADMIN',
        status: 'PENDING_APPROVAL',
      };
    }

    // Role 3: CASHIER Approval Chain
    if (roleName === 'CASHIER') {
      if (!isExplicitUnifiedCall) {
        return { message: 'If the account exists, a secure password reset link has been dispatched.' };
      }

      if (user.passwordResetRequested) {
        throw new BadRequestError('A password reset request is already pending approval by your company Administrator.');
      }

      await this.repo.setPasswordResetRequested(user.id, true);

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: 'CASHIER',
          actorName: user.username,
          tenantId: user.tenantId,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'USER',
          entityId: user.id,
          metadata: {
            username: user.username,
            email: user.email,
            phone: user.phone,
            companyId: user.tenantId,
            role: 'CASHIER',
          },
          ipAddress,
        },
      });

      return {
        message: 'Password reset request submitted. Please contact your company Administrator for approval.',
        role: 'CASHIER',
        status: 'PENDING_APPROVAL',
      };
    }

    throw new BadRequestError('Unsupported user role for password recovery');
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<{ message: string }> {
    if (!token || !newPassword || newPassword.length < 8) {
      throw new BadRequestError('Valid reset token and password of at least 8 characters are required');
    }

    const user = await this.repo.findByResetToken(token);
    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repo.updatePassword(user.id, passwordHash, false);

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: 'SUPERADMIN',
        actorName: user.username,
        action: 'SUPERADMIN_PASSWORD_RESET_COMPLETED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { username: user.username },
        ipAddress,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: 'SUPERADMIN',
        actorName: user.username,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { username: user.username },
        ipAddress,
      },
    });

    return { message: 'Password has been reset successfully. You may now log in with your new password.' };
  }

  async changePassword(userId: string, currentPass: string, newPass: string, ipAddress?: string): Promise<{ message: string }> {
    if (!newPass || newPass.length < 8) {
      throw new BadRequestError('New password must be at least 8 characters long');
    }

    const user = await this.repo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    const matches = await bcrypt.compare(currentPass, user.passwordHash);
    if (!matches) {
      throw new BadRequestError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.repo.updatePassword(user.id, passwordHash, false);

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: user.role.name,
        actorName: user.username,
        tenantId: user.tenantId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { username: user.username, role: user.role.name },
        ipAddress,
      },
    });

    return { message: 'Password updated successfully. You may now log in with your new password.' };
  }
}

export const authService = new AuthService();
