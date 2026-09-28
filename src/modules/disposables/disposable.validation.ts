import { z } from 'zod';

export const createDisposableSchema = z.object({
  name: z
    .string({ required_error: 'Disposable name is required' })
    .trim()
    .min(1, 'Disposable name is required')
    .max(100, 'Disposable name must not exceed 100 characters'),
  code: z.string().trim().max(50, 'Code must not exceed 50 characters').optional().nullable(),
  category: z.string().trim().max(100, 'Category must not exceed 100 characters').optional(),
  categoryId: z.string().uuid('Valid category UUID is required').optional().nullable(),
  price: z.number().min(0, 'Price must be greater than or equal to 0').optional().default(0),
  salePrice: z.number().min(0, 'Sale price must be greater than or equal to 0').optional().nullable().default(0),
  quantity: z.number().min(0, 'Quantity must be greater than or equal to 0').optional().default(1),
  unit: z.string().trim().max(50, 'Unit must not exceed 50 characters').optional().default('pcs'),
  gender: z.enum(['Both', 'Female', 'Male']).optional().default('Both'),
  isRetail: z.boolean().optional().default(false),
  hideFromCatalogue: z.boolean().optional().default(false),
  isNonDiscountable: z.boolean().optional().default(false),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional().nullable(),
  barcode: z.string().trim().max(100, 'Barcode must not exceed 100 characters').optional().nullable(),
  position: z.number().int('Position must be an integer').min(0, 'Position must be a positive number').optional().default(0),
  hsnCode: z.string().trim().max(50, 'HSN code must not exceed 50 characters').optional().nullable(),
  productTag: z.string().trim().max(50, 'Product tag must not exceed 50 characters').optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateDisposableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Disposable name cannot be empty')
    .max(100, 'Disposable name must not exceed 100 characters')
    .optional(),
  code: z.string().trim().max(50, 'Code must not exceed 50 characters').optional().nullable(),
  category: z.string().trim().max(100, 'Category must not exceed 100 characters').optional(),
  categoryId: z.string().uuid('Valid category UUID is required').optional().nullable(),
  price: z.number().min(0, 'Price must be greater than or equal to 0').optional(),
  salePrice: z.number().min(0, 'Sale price must be greater than or equal to 0').optional().nullable(),
  quantity: z.number().min(0, 'Quantity must be greater than or equal to 0').optional(),
  unit: z.string().trim().max(50, 'Unit must not exceed 50 characters').optional(),
  gender: z.enum(['Both', 'Female', 'Male']).optional(),
  isRetail: z.boolean().optional(),
  hideFromCatalogue: z.boolean().optional(),
  isNonDiscountable: z.boolean().optional(),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional().nullable(),
  barcode: z.string().trim().max(100, 'Barcode must not exceed 100 characters').optional().nullable(),
  position: z.number().int('Position must be an integer').min(0, 'Position must be a positive number').optional(),
  hsnCode: z.string().trim().max(50, 'HSN code must not exceed 50 characters').optional().nullable(),
  productTag: z.string().trim().max(50, 'Product tag must not exceed 50 characters').optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateDisposableStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' }),
});

export const disposableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  search: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  gender: z.enum(['Both', 'Female', 'Male']).optional(),
  unit: z.string().optional(),
  isRetail: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  isActive: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  hideFromCatalogue: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  sortBy: z.enum(['name', 'position', 'price', 'createdAt']).optional().default('position'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const disposableIdParamSchema = z.object({
  id: z.string().uuid('Disposable ID must be a valid UUID'),
});
