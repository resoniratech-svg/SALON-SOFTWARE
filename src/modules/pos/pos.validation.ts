import { z } from 'zod';

const phoneRegex = /^\+?[0-9\s-]{7,20}$/;

export const orderItemSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw === 'object' && raw !== null) {
      return {
        ...raw,
        itemType: raw.itemType || raw.type || 'SERVICE',
        itemName: raw.itemName || raw.name,
        unitPrice: raw.unitPrice ?? raw.price,
      };
    }
    return raw;
  },
  z
    .object({
      itemType: z.enum(['SERVICE', 'PRODUCT']).default('SERVICE'),
      serviceId: z.string().uuid('Invalid service ID').optional().nullable(),
      productId: z.string().uuid('Invalid product ID').optional().nullable(),
      staffId: z.string().uuid('Invalid staff ID').optional().nullable(),
      itemName: z.string().trim().min(1, 'Item name cannot be empty').optional(),
      itemCategory: z.string().trim().optional().nullable(),
      quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').default(1),
      unitPrice: z.number().min(0, 'Unit price must be non-negative').optional(),
      discountAmount: z.number().min(0, 'Discount amount must be non-negative').optional().default(0),
      notes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional().nullable(),
    })
  .superRefine((data, ctx) => {
    if (data.itemType === 'SERVICE') {
      if (!data.staffId || data.staffId.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select Staff: Staff is required for service items',
          path: ['staffId'],
        });
      }
      if (!data.serviceId && !data.itemName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Service ID or Item Name is required for service items',
          path: ['serviceId'],
        });
      }
    } else if (data.itemType === 'PRODUCT') {
      if (!data.productId && !data.itemName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Product ID or Item Name is required for product items',
          path: ['productId'],
        });
      }
    }
  }));

export const paymentItemSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw === 'object' && raw !== null) {
      const methodVal = raw.method || raw.paymentMethod;
      return {
        ...raw,
        method: methodVal,
      };
    }
    return raw;
  },
  z.object({
    method: z.preprocess((val) => {
      if (typeof val === 'string') {
        const upper = val.toUpperCase().trim();
        if (upper === 'UPI') return 'GPAY';
        return upper;
      }
      return val;
    }, z.enum(['CASH', 'CARD', 'HDFC', 'GPAY', 'PHONEPE', 'BALANCE', 'OTHER', 'UPI'])),
    amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
    referenceNumber: z.string().trim().max(100).optional().nullable(),
  })
);

export const quickGuestSchema = z.object({
  name: z.string().trim().min(1, 'Guest name is required').max(100),
  mobile: z.string().trim().min(7).max(20).regex(phoneRegex, 'Invalid mobile number format'),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  gender: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']))
    .optional()
    .nullable(),
  dob: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  anniversary: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  anniversaryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  gstNumber: z.string().trim().max(30).optional().nullable(),
  hairType: z.string().trim().max(50).optional().nullable(),
  alternateMobile: z.string().trim().max(20).regex(phoneRegex).optional().nullable(),
  salutationId: z.string().uuid().optional().nullable(),
});

const posStatusEnum = z.enum(['NEW', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'PENDING']);

export const createPosOrderSchema = z
  .object({
    guestId: z.string().uuid('Invalid guest ID').optional().nullable(),
    guest: quickGuestSchema.optional().nullable(),
    cashierId: z.string().uuid('Invalid cashier ID').optional().nullable(),
    orderDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
    status: z
      .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), posStatusEnum)
      .optional()
      .default('COMPLETED'),
    items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
    discountType: z
      .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['PERCENTAGE', 'FIXED']))
      .optional()
      .nullable(),
    discountValue: z.number().min(0, 'Discount value must be non-negative').optional().nullable(),
    discountAmount: z.number().min(0, 'Discount amount must be non-negative').optional().default(0),
    couponCode: z.string().trim().optional().nullable(),
    giftCardCode: z.string().trim().optional().nullable(),
    referralCode: z.string().trim().optional().nullable(),
    redeemLoyaltyPoints: z.number().int().min(0, 'Redeem loyalty points must be non-negative').optional().default(0),
    tipAmount: z.number().min(0, 'Tip amount must be non-negative').optional().default(0),
    paymentMethod: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          const upper = val.toUpperCase().trim();
          if (upper === 'UPI') return 'GPAY';
          return upper;
        }
        return val;
      }, z.enum(['CASH', 'CARD', 'HDFC', 'GPAY', 'PHONEPE', 'BALANCE', 'SPLIT', 'UPI']))
      .optional()
      .default('CASH'),
    payments: z.array(paymentItemSchema).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    instruction: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.guestId && !data.guest) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either guestId or guest (new guest details) must be provided',
        path: ['guestId'],
      });
    }
  });

export const calculateOrderSchema = z.object({
  guestId: z.string().uuid('Invalid guest ID').optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  discountType: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['PERCENTAGE', 'FIXED']))
    .optional()
    .nullable(),
  discountValue: z.number().min(0, 'Discount value must be non-negative').optional().nullable(),
  discountAmount: z.number().min(0, 'Discount amount must be non-negative').optional().default(0),
  couponCode: z.string().trim().optional().nullable(),
  giftCardCode: z.string().trim().optional().nullable(),
  referralCode: z.string().trim().optional().nullable(),
  redeemLoyaltyPoints: z.number().int().min(0).optional().default(0),
  tipAmount: z.number().min(0, 'Tip amount must be non-negative').optional().default(0),
});

export const posOrderQuerySchema = z.object({
  page: z.preprocess((val) => (val !== undefined && val !== '' ? Number(val) : 1), z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => (val !== undefined && val !== '' ? Number(val) : 20), z.number().int().min(1).max(100).default(20)),
  search: z.string().trim().optional(),
  status: z
    .preprocess((val) => (typeof val === 'string' && val.trim() !== '' ? val.toUpperCase() : undefined), posStatusEnum)
    .optional(),
  guestId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['orderDate', 'totalAmount', 'createdAt', 'orderNumber']).optional().default('orderDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  export: z.enum(['csv', 'excel']).optional(),
});

export const updatePosOrderStatusSchema = z.object({
  status: z.preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), posStatusEnum),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const updatePosOrderSchema = z.object({
  guestId: z.string().uuid('Invalid guest ID').optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item').optional(),
  status: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), posStatusEnum)
    .optional(),
  discountType: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['PERCENTAGE', 'FIXED']))
    .optional()
    .nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  discountAmount: z.number().min(0).optional(),
  couponCode: z.string().trim().optional().nullable(),
  giftCardCode: z.string().trim().optional().nullable(),
  referralCode: z.string().trim().optional().nullable(),
  tipAmount: z.number().min(0).optional(),
  paymentMethod: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['CASH', 'CARD', 'HDFC', 'GPAY', 'PHONEPE', 'BALANCE', 'SPLIT']))
    .optional(),
  payments: z.array(paymentItemSchema).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  instruction: z.string().trim().max(1000).optional().nullable(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const rejectOrderSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const posStatsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const posDashboardSummaryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
