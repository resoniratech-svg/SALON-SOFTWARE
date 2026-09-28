import { z } from 'zod';

export const createResourceSchema = z.object({
  name: z
    .string({ required_error: 'Resource name is required' })
    .trim()
    .min(1, 'Resource name cannot be empty')
    .max(100, 'Resource name cannot exceed 100 characters'),
  capacity: z
    .number({ invalid_type_error: 'Capacity must be a number' })
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1')
    .optional()
    .default(1),
  isActive: z.boolean().optional().default(true),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .nullable()
    .optional(),
});

export const updateResourceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Resource name cannot be empty')
      .max(100, 'Resource name cannot exceed 100 characters')
      .optional(),
    capacity: z
      .number({ invalid_type_error: 'Capacity must be a number' })
      .int('Capacity must be an integer')
      .min(1, 'Capacity must be at least 1')
      .optional(),
    isActive: z.boolean().optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const updateResourceStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status is required' }),
});

export const resourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  sortBy: z.enum(['name', 'capacity', 'createdAt', 'updatedAt']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});
