import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Company code must be at least 2 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Company code must be alphanumeric with hyphens/underscores')
    .transform((val) => val.toLowerCase()),
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE']).optional().default('TRIAL'),
  subscriptionExpiresAt: z.string().datetime().optional().nullable(),
  trialEndsAt: z.string().datetime().optional().nullable(),
  contactEmail: z.string().email('Invalid email address').optional().nullable(),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  cashierLimit: z.number().int().min(0, 'Cashier limit must be non-negative').optional(),
  enabledModules: z.array(z.string()).optional().default(['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF']),
  admin: z
    .object({
      username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
      email: z.string().email('Invalid email address').optional().nullable(),
      password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    })
    .optional(),
  adminUser: z
    .object({
      username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
      email: z.string().email('Invalid email address').optional().nullable(),
      password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    })
    .optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Company code must be alphanumeric with hyphens/underscores')
    .transform((val) => val.toLowerCase())
    .optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  cashierLimit: z.number().int().min(0, 'Cashier limit must be non-negative').optional(),
});

export const updateCompanyStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const renewSubscriptionSchema = z.object({
  durationDays: z.number().int().min(1, 'Renewal duration must be at least 1 day').max(3650, 'Renewal duration cannot exceed 10 years'),
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
});

export const updateSubscriptionSchema = z.object({
  plan: z.enum(['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED']).optional(),
  subscriptionExpiresAt: z.string().datetime().optional().nullable(),
  trialEndsAt: z.string().datetime().optional().nullable(),
  expiryAlertDays: z.number().int().min(1).max(90).optional(),
});

export const updateModulesSchema = z.object({
  enabledModules: z.array(z.string()).min(1, 'At least one module must be specified'),
});

export const createAdminSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(8).optional(),
});

export const updateAdminSchema = z.object({
  username: z.string().trim().min(3).max(50).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
});

export const updateAdminStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

export const resetAdminPasswordSchema = z.object({
  userId: z.string().uuid().optional(),
  temporaryPassword: z.string().min(8).optional(),
});

export const createSuperAdminSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().email(),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(8),
});

export const companyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true').optional(),
  subscriptionStatus: z.string().trim().optional(),
  plan: z.string().trim().optional(),
  sortBy: z.string().trim().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tenantId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
