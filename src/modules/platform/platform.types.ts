export interface CreateCompanyInput {
  name: string;
  code: string;
  plan?: string;
  subscriptionExpiresAt?: string | null;
  trialEndsAt?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  cashierLimit?: number;
  enabledModules?: string[];
  admin?: {
    username: string;
    email?: string | null;
    phone?: string | null;
    password?: string;
  };
  adminUser?: {
    username: string;
    email?: string | null;
    phone?: string | null;
    password?: string;
  };
}

export interface UpdateCompanyInput {
  name?: string;
  code?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  cashierLimit?: number;
}

export interface RenewSubscriptionInput {
  durationDays: number;
  plan?: string;
}

export interface UpdateSubscriptionInput {
  plan?: string;
  subscriptionStatus?: string; // "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED"
  subscriptionExpiresAt?: string | null;
  trialEndsAt?: string | null;
  expiryAlertDays?: number;
}

export interface UpdateModulesInput {
  enabledModules: string[];
}

export interface CreateAdminInput {
  username: string;
  email?: string;
  phone?: string | null;
  password?: string;
}

export interface CreateSuperAdminInput {
  username: string;
  email: string;
  phone?: string | null;
  password?: string;
}

export interface CompanyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  subscriptionStatus?: string;
  plan?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  tenantId?: string;
  actorId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateAdminInput {
  username?: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  mustChangePassword?: boolean;
}

export interface UpdateAdminStatusInput {
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

