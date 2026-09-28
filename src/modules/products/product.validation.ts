import { z } from 'zod';

const variationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variation name is required'),
  sku: z.string().optional(),
  price: z.number().min(0, 'Variation price must be non-negative').optional(),
  salePrice: z.number().min(0, 'Variation sale price must be non-negative').optional(),
  barcode: z.string().optional(),
  options: z.array(z.string()).optional(),
}).passthrough();

const taxSchema = z.object({
  id: z.string().optional(),
  taxId: z.string().optional(),
  name: z.string().min(1, 'Tax name is required'),
  rate: z.number().min(0, 'Tax rate must be non-negative'),
  type: z.string().optional(),
}).passthrough();

const displayImageSchema = z.union([
  z.string().max(1000, 'Image URL/path must not exceed 1000 characters'),
  z.object({
    url: z.string().max(1000, 'Image URL/path must not exceed 1000 characters'),
    position: z.number().int().min(0).optional(),
    isPrimary: z.boolean().optional(),
  }).passthrough()
]);

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(1, 'Product name is required')
    .max(100, 'Product name must not exceed 100 characters'),
  categoryId: z
    .string({ required_error: 'Product category is required' })
    .uuid('Valid category UUID is required'),
  subcategoryId: z.string().uuid('Valid subcategory UUID is required').optional().nullable(),
  position: z.number().int('Position must be an integer').min(0, 'Position must be a positive number').optional().default(0),
  hsnCode: z.string().trim().max(50, 'HSN code must not exceed 50 characters').optional().nullable(),
  productTag: z.string().trim().max(50, 'Product tag must not exceed 50 characters').optional().nullable(),
  storeSku: z.string().trim().max(50, 'Store SKU must not exceed 50 characters').optional().nullable(),
  isRetail: z.boolean().optional().default(true),
  group: z.enum(['Both', 'Female', 'Male']).optional().default('Both'),
  hideFromCatalogue: z.boolean().optional().default(false),
  price: z.number({ required_error: 'Price is required' }).min(0, 'Price must be greater than or equal to 0'),
  salePrice: z.number().min(0, 'Sale price must be greater than or equal to 0').optional().nullable().default(0),
  purchasePrice: z.number().min(0, 'Purchase price must be greater than or equal to 0').optional().nullable().default(0),
  isNonDiscountable: z.boolean().optional().default(false),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional().nullable(),
  barcode: z.string().trim().max(100, 'Barcode must not exceed 100 characters').optional().nullable(),
  supplierId: z.string().uuid('Supplier ID must be a valid UUID').optional().nullable(),
  initialStock: z.number().min(0, 'Initial stock must be greater than or equal to 0').optional(),
  location: z.string().trim().max(100).optional().nullable(),
  variations: z.array(variationSchema).optional().default([]),
  taxes: z.array(taxSchema).optional().default([]),
  videoLink: z.string().trim().max(1000, 'Video link must not exceed 1000 characters').optional().nullable(),
  benefits: z.string().trim().max(2000, 'Benefits must not exceed 2000 characters').optional().nullable(),
  ingredients: z.string().trim().max(2000, 'Ingredients must not exceed 2000 characters').optional().nullable(),
  usageInstructions: z.string().trim().max(2000, 'Usage instructions must not exceed 2000 characters').optional().nullable(),
  displayImages: z.array(displayImageSchema).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name cannot be empty')
    .max(100, 'Product name must not exceed 100 characters')
    .optional(),
  categoryId: z.string().uuid('Valid category UUID is required').optional(),
  subcategoryId: z.string().uuid('Valid subcategory UUID is required').optional().nullable(),
  position: z.number().int('Position must be an integer').min(0, 'Position must be a positive number').optional(),
  hsnCode: z.string().trim().max(50, 'HSN code must not exceed 50 characters').optional().nullable(),
  productTag: z.string().trim().max(50, 'Product tag must not exceed 50 characters').optional().nullable(),
  storeSku: z.string().trim().max(50, 'Store SKU must not exceed 50 characters').optional().nullable(),
  isRetail: z.boolean().optional(),
  group: z.enum(['Both', 'Female', 'Male']).optional(),
  hideFromCatalogue: z.boolean().optional(),
  price: z.number().min(0, 'Price must be greater than or equal to 0').optional(),
  salePrice: z.number().min(0, 'Sale price must be greater than or equal to 0').optional().nullable(),
  purchasePrice: z.number().min(0, 'Purchase price must be greater than or equal to 0').optional().nullable(),
  isNonDiscountable: z.boolean().optional(),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional().nullable(),
  barcode: z.string().trim().max(100, 'Barcode must not exceed 100 characters').optional().nullable(),
  supplierId: z.string().uuid('Supplier ID must be a valid UUID').optional().nullable(),
  variations: z.array(variationSchema).optional(),
  taxes: z.array(taxSchema).optional(),
  videoLink: z.string().trim().max(1000, 'Video link must not exceed 1000 characters').optional().nullable(),
  benefits: z.string().trim().max(2000, 'Benefits must not exceed 2000 characters').optional().nullable(),
  ingredients: z.string().trim().max(2000, 'Ingredients must not exceed 2000 characters').optional().nullable(),
  usageInstructions: z.string().trim().max(2000, 'Usage instructions must not exceed 2000 characters').optional().nullable(),
  displayImages: z.array(displayImageSchema).optional(),
  isActive: z.boolean().optional(),
});

export const updateProductStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' }),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  store: z.string().optional(),
  group: z.enum(['Both', 'Female', 'Male']).optional(),
  isRetail: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  isActive: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  hideFromCatalogue: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  sortBy: z.enum(['name', 'position', 'price', 'createdAt']).optional().default('position'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid('Product ID must be a valid UUID'),
});
