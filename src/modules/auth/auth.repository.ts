import { prisma } from '../../config/database.js';
import { User, Role, Tenant, UserStatus } from '@prisma/client';

export interface UserWithRoleAndPermissions extends User {
  tenant: Tenant | null;
  role: Role & {
    rolePermissions: {
      permission: {
        code: string;
      };
    }[];
  };
}

export class AuthRepository {
  async findByUsername(usernameOrEmail: string): Promise<UserWithRoleAndPermissions | null> {
    return prisma.user.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: usernameOrEmail,
              mode: 'insensitive',
            },
          },
          {
            email: {
              equals: usernameOrEmail,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        tenant: true,
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async findByEmail(email: string): Promise<UserWithRoleAndPermissions | null> {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      include: {
        tenant: true,
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string): Promise<UserWithRoleAndPermissions | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async findByResetToken(token: string): Promise<UserWithRoleAndPermissions | null> {
    return prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: {
          gt: new Date(),
        },
      },
      include: {
        tenant: true,
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async setResetPasswordToken(id: string, token: string, expiresAt: Date): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: expiresAt,
      },
    });
  }

  async findByIdentifier(identifier: string): Promise<UserWithRoleAndPermissions | null> {
    const trimmed = identifier.trim();
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          { username: { equals: trimmed, mode: 'insensitive' } },
          { phone: { equals: trimmed } },
        ],
      },
      include: {
        tenant: true,
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async setTemporaryPassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordResetRequested: false,
        passwordResetRequestedAt: null,
      },
    });
  }

  async setPasswordResetRequested(userId: string, requested = true): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetRequested: requested,
        passwordResetRequestedAt: requested ? new Date() : null,
      },
    });
  }

  async updatePassword(id: string, passwordHash: string, mustChangePassword = false): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword,
        passwordResetRequested: false,
        passwordResetRequestedAt: null,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });
  }

  async findRoleByName(roleName: string) {
    return prisma.role.findUnique({
      where: { name: roleName },
    });
  }
}

export const authRepository = new AuthRepository();
