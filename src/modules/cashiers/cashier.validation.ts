import { z } from 'zod';

export const createCashierSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  enabledModules: z.array(z.string()).optional().default(['SERVICES', 'PRODUCTS', 'DISPOSABLES']),
});

export const updateCashierSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50).optional(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const updateCashierStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

export const updateCashierModulesSchema = z.object({
  enabledModules: z.array(z.string(), {
    required_error: 'enabledModules array is required',
  }),
});

export const cashierQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  resetRequested: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  tenantId: z.string().uuid().optional(),
});
