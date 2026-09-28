import { z } from 'zod';

// ==========================================
// VENDOR DTOs
// ==========================================
export const createVendorSchema = z.object({
  vendorName: z.string().trim().min(1, 'Vendor Name is required').max(100, 'Vendor Name cannot exceed 100 characters'),
  firmName: z.string().trim().min(1, 'Firm Name is required').max(150, 'Firm Name cannot exceed 150 characters'),
  mobile: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Mobile must contain only digits and be between 7 and 15 digits'),
  alternateMobile: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Alternate mobile must contain only digits and be between 7 and 15 digits').optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  gstNumber: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format').optional().nullable().or(z.literal('')),
  address: z.string().trim().min(1, 'Address is required').max(300, 'Address cannot exceed 300 characters'),
  area: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  landmark: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(100, 'City cannot exceed 100 characters'),
  pincode: z.string().trim().regex(/^[0-9]{5,10}$/, 'Pincode must be between 5 and 10 digits').optional().nullable().or(z.literal('')),
  isActive: z.boolean().default(true),
});

export const updateVendorSchema = createVendorSchema.partial();

export const vendorQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const setVendorItemsSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().optional().nullable(),
      disposableId: z.string().optional().nullable(),
      price: z.number().min(0, 'Price must be non-negative'),
    })
  ).min(1, 'At least one vendor item must be specified'),
});

// ==========================================
// PURCHASE ORDER DTOs
// ==========================================
export const poItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  requiredQty: z.number().int().min(1, 'Required quantity must be at least 1'),
  price: z.number().min(0, 'Price must be non-negative'),
  servicesPercent: z.number().min(0).max(100).default(0),
  servicesAmount: z.number().min(0).default(0).optional(),
});

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  expectedDate: z.string().optional().nullable(),
  poDate: z.string().optional().nullable(),
  comment: z.string().trim().optional().nullable(),
  items: z.array(poItemSchema).min(1, 'At least one item must be included in the purchase order'),
});

export const updatePurchaseOrderSchema = z.object({
  vendorId: z.string().optional(),
  expectedDate: z.string().optional().nullable(),
  poDate: z.string().optional().nullable(),
  comment: z.string().trim().optional().nullable(),
  items: z.array(poItemSchema).optional(),
});

export const poQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['PLACED', 'APPROVED', 'REJECTED', 'PARTIAL_SETTLED', 'SETTLED', 'CANCELLED', 'TOTAL', 'ALL']).optional(),
  search: z.string().optional(),
  vendorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  export: z.enum(['csv', 'json']).optional(),
});

export const receivePoSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().min(1, 'PO Item ID is required'),
      receivedQty: z.number().int().min(1, 'Received quantity must be at least 1'),
    })
  ).optional(),
  comment: z.string().optional(),
});

export const rejectionSchema = z.object({
  reason: z.string().trim().min(1, 'Rejection reason is required'),
});

// ==========================================
// TRANSFER REQUEST DTOs
// ==========================================
export const trItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  requestedQty: z.number().int().min(1, 'Requested quantity must be at least 1'),
  price: z.number().min(0, 'Price must be non-negative'),
});

export const createTransferRequestSchema = z.object({
  sender: z.string().trim().min(1, 'Sender location is required'),
  requestor: z.string().trim().optional(),
  expectedDate: z.string().optional().nullable(),
  comment: z.string().trim().optional().nullable(),
  items: z.array(trItemSchema).min(1, 'At least one item must be included in the transfer request'),
});

export const updateTransferRequestSchema = z.object({
  sender: z.string().trim().optional(),
  expectedDate: z.string().optional().nullable(),
  comment: z.string().trim().optional().nullable(),
  items: z.array(trItemSchema).optional(),
});

export const trQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['REQUESTED', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'REJECTED', 'CANCELLED', 'TRANSFER_IN', 'TRANSFER_OUT', 'ALL']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  export: z.enum(['csv', 'json']).optional(),
});

// ==========================================
// STOCK RECONCILIATION DTOs
// ==========================================
export const reconciliationQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.enum(['PRODUCT', 'DISPOSABLE', 'ALL']).default('ALL'),
});

export const singleReconcileSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  itemType: z.enum(['PRODUCT', 'DISPOSABLE']).default('PRODUCT'),
  actualStock: z.number().default(0),
  adjustStock: z.number().min(0, 'Adjusted stock cannot be negative'),
  actualConsumable: z.number().default(0).optional(),
  adjustConsumable: z.number().min(0).default(0).optional(),
  remark: z.string().trim().min(1, 'Remark is required for stock reconciliation'),
});

export const bulkReconcileSchema = z.object({
  items: z.array(singleReconcileSchema).min(1, 'At least one item must be provided for reconciliation'),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type CreateTransferRequestInput = z.infer<typeof createTransferRequestSchema>;
export type UpdateTransferRequestInput = z.infer<typeof updateTransferRequestSchema>;
export type SingleReconcileInput = z.infer<typeof singleReconcileSchema>;
export type BulkReconcileInput = z.infer<typeof bulkReconcileSchema>;

