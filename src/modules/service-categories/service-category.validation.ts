import { z } from 'zod';

// Validate maximum 100 KB image size if data URI / base64 is provided
const imageValidation = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith('data:image/')) {
        // Calculate approximate size in KB from base64 string
        const base64Data = val.split(',')[1] || '';
        const sizeInBytes = (base64Data.length * 3) / 4;
        const sizeInKB = sizeInBytes / 1024;
        return sizeInKB <= 100;
      }
      // URLs or paths are accepted
      return true;
    },
    { message: 'Category image must be under 100 KB' }
  )
  .optional()
  .nullable();

export const createServiceCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name must not exceed 100 characters'),
  parentId: z.string().uuid('Parent category ID must be a valid UUID').optional().nullable(),
  position: z.number().int().min(0, 'Position must be a positive number').optional().default(0),
  group: z.enum(['Both', 'Female', 'Male']).optional().default('Both'),
  hideFromCatalogue: z.boolean().optional().default(false),
  imageUrl: imageValidation,
  stores: z.array(z.string().trim()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateServiceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name cannot be empty')
    .max(100, 'Category name must not exceed 100 characters')
    .optional(),
  parentId: z.string().uuid('Parent category ID must be a valid UUID').optional().nullable(),
  position: z.number().int().min(0, 'Position must be a positive number').optional(),
  group: z.enum(['Both', 'Female', 'Male']).optional(),
  hideFromCatalogue: z.boolean().optional(),
  imageUrl: imageValidation,
  stores: z.array(z.string().trim()).optional(),
  isActive: z.boolean().optional(),
});

export const updateCategoryStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' }),
});

export const serviceCategoryQuerySchema = z.object({
  search: z.string().optional(),
  group: z.enum(['Both', 'Female', 'Male']).optional(),
  isActive: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  hideFromCatalogue: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  parentId: z.string().uuid().optional().nullable(),
  store: z.string().optional(),
  tree: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
});
