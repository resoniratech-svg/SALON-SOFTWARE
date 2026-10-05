import { UserStatus } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  username: string;
  tenantId: string | null;
  roleId: string;
  role: string;
  isSuperAdmin?: boolean;
  impersonating?: boolean;
  originalActorId?: string;
  originalRole?: string;
  targetTenantId?: string;
  effectiveTenantId?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  username: string;
  email: string | null;
  status: UserStatus;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
  enabledModules?: string[];
  subscription?: {
    plan: string;
    status: string;
    expiresAt: Date | null;
    daysRemaining: number | null;
  };
  impersonating?: boolean;
  originalActorId?: string;
  originalRole?: string;
  targetTenantId?: string;
  effectiveTenantId?: string | null;
  role: {
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
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
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
      effectiveTenantId?: string | null;
    }
  }
}
