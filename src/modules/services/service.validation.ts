import { z } from 'zod';

// Validate image: base64 data-URIs must be under 100 KB; URLs/paths validated as strings up to 1000 chars
const imageValidation = z
  .string()
  .trim()
  .max(1000, 'Image URL must not exceed 1000 characters')
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith('data:image/')) {
        const base64Data = val.split(',')[1] || '';
        const sizeInBytes = (base64Data.length * 3) / 4;
        const sizeInKB = sizeInBytes / 1024;
        return sizeInKB <= 100;
      }
      return true;
    },
    { message: 'Service image must be under 100 KB' }
  )
  .optional()
  .nullable();

const staffMappingItemSchema = z.object({
  staffId: z.string().uuid('Staff ID must be a valid UUID'),
  isRecommended: z.boolean().optional().default(false),
});

const consumableItemSchema = z.object({
  name: z.string().trim().min(1, 'Consumable name is required'),
  quantity: z.number().min(0, 'Consumable quantity must be non-negative'),
  unit: z.string().trim().optional(),
});

export const createServiceSchema = z.object({
  name: z
    .string({ required_error: 'Service name is required' })
    .trim()
    .min(1, 'Service name is required')
    .max(100, 'Service name must not exceed 100 characters'),
  categoryId: z
    .string({ required_error: 'Category ID is required' })
    .uuid('Category ID must be a valid UUID'),
  subcategoryId: z.string().uuid('Subcategory ID must be a valid UUID').optional().nullable(),
  position: z.number().int().min(0, 'Position must be a positive number').optional().default(0),
  isActive: z.boolean().optional().default(true),
  hour: z.number().int().min(0, 'Hour must be non-negative').max(24, 'Hour must be at most 24').optional().default(0),
  minute: z.number().int().min(0, 'Minute must be non-negative').max(59, 'Minute must be at most 59').optional().default(0),
  durationMinutes: z.number().int().min(0, 'Duration must be non-negative').optional(),
  serviceReminderDays: z.number().int().min(0, 'Service reminder days must be non-negative').optional().default(0),
  sacCode: z.string().trim().max(50, 'SAC code must not exceed 50 characters').optional().nullable(),
  serviceTag: z.string().trim().max(50, 'Service tag must not exceed 50 characters').optional().nullable(),
  group: z.enum(['Both', 'Female', 'Male']).optional().nullable(),
  hideFromCatalogue: z.boolean().optional().default(false),
  price: z
    .number({ required_error: 'Price is required' })
    .min(0, 'Price must be a positive number'),
  salePrice: z.number().min(0, 'Sale price must be a positive number').optional().default(0),
  isNonDiscountable: z.boolean().optional().default(false),
  description: z.string().trim().max(1000, 'Description must not exceed 1000 characters').optional().nullable(),
  imageUrl: imageValidation,
  staffIds: z
    .array(z.string().uuid('Staff ID must be a valid UUID'))
    .refine((items) => new Set(items).size === items.length, {
      message: 'Duplicate staff mapping not allowed',
    })
    .optional(),
  staff: z
    .array(staffMappingItemSchema)
    .refine((items) => new Set(items.map((i) => i.staffId)).size === items.length, {
      message: 'Duplicate staff mapping not allowed',
    })
    .optional(),
  resourceIds: z.array(z.string()).optional().default([]),
  consumables: z.array(consumableItemSchema).optional().default([]),
});

export const updateServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Service name cannot be empty')
    .max(100, 'Service name must not exceed 100 characters')
    .optional(),
  categoryId: z.string().uuid('Category ID must be a valid UUID').optional(),
  subcategoryId: z.string().uuid('Subcategory ID must be a valid UUID').optional().nullable(),
  position: z.number().int().min(0, 'Position must be a positive number').optional(),
  isActive: z.boolean().optional(),
  hour: z.number().int().min(0, 'Hour must be non-negative').max(24, 'Hour must be at most 24').optional(),
  minute: z.number().int().min(0, 'Minute must be non-negative').max(59, 'Minute must be at most 59').optional(),
  durationMinutes: z.number().int().min(0, 'Duration must be non-negative').optional(),
  serviceReminderDays: z.number().int().min(0, 'Service reminder days must be non-negative').optional(),
  sacCode: z.string().trim().max(50, 'SAC code must not exceed 50 characters').optional().nullable(),
  serviceTag: z.string().trim().max(50, 'Service tag must not exceed 50 characters').optional().nullable(),
  group: z.enum(['Both', 'Female', 'Male']).optional().nullable(),
  hideFromCatalogue: z.boolean().optional(),
  price: z.number().min(0, 'Price must be a positive number').optional(),
  salePrice: z.number().min(0, 'Sale price must be a positive number').optional(),
  isNonDiscountable: z.boolean().optional(),
  description: z.string().trim().max(1000, 'Description must not exceed 1000 characters').optional().nullable(),
  imageUrl: imageValidation,
  staffIds: z
    .array(z.string().uuid('Staff ID must be a valid UUID'))
    .refine((items) => new Set(items).size === items.length, {
      message: 'Duplicate staff mapping not allowed',
    })
    .optional(),
  staff: z
    .array(staffMappingItemSchema)
    .refine((items) => new Set(items.map((i) => i.staffId)).size === items.length, {
      message: 'Duplicate staff mapping not allowed',
    })
    .optional(),
  resourceIds: z.array(z.string()).optional(),
  consumables: z.array(consumableItemSchema).optional(),
});

export const updateServiceStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' }),
});

export const serviceQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  group: z.enum(['Both', 'Female', 'Male']).optional(),
  isActive: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  hideFromCatalogue: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  store: z.string().optional(),
});
