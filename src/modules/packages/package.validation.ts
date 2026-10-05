import { z } from 'zod';

export const createPackageSchema = z.object({
  name: z
    .string({ required_error: 'Package name is required' })
    .trim()
    .min(1, 'Package name is required')
    .max(150, 'Package name cannot exceed 150 characters'),
  price: z
    .number({ required_error: 'Price is required' })
    .min(0, 'Price must be greater than or equal to 0'),
  validityDays: z
    .number({ required_error: 'Validity days is required' })
    .int('Validity days must be an integer')
    .min(1, 'Validity days must be at least 1'),
  renewalReminderDays: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(15),
  services: z.any().optional().default([]),
  products: z.any().optional().default([]),
  description: z.string().trim().max(1000).optional().nullable(),
  header: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePackageSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  price: z.number().min(0).optional(),
  validityDays: z.number().int().min(1).optional(),
  renewalReminderDays: z.number().int().min(0).optional(),
  services: z.any().optional(),
  products: z.any().optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  header: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const packageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  search: z.string().trim().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') return val === 'true';
      return val;
    }),
  tenantId: z.string().optional(),
});
