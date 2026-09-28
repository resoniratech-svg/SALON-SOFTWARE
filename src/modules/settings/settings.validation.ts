import { z } from 'zod';

export const genericSettingsSchema = z.object({
  businessStatus: z.enum(['OPEN', 'CLOSED', 'Open', 'Closed']).optional(),
  open: z.boolean().optional(),
  openingTime: z.string().trim().min(1, 'Opening time is required').optional(),
  closingTime: z.string().trim().min(1, 'Closing time is required').optional(),
  genderSpecification: z.enum(['Both', 'Female', 'Male', 'BOTH', 'FEMALE', 'MALE']).optional(),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)).or(z.array(z.string())).optional(),
  onlinePaymentEnabled: z.boolean().optional(),
  homeDeliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  codEnabled: z.boolean().optional(),
  cashOnPickupEnabled: z.boolean().optional(),
  minOrderValue: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  otpValidation: z.boolean().optional(),
  deliveryDisclaimer: z.string().optional().nullable(),
  pickupDisclaimer: z.string().optional().nullable(),
  serviceListHeading: z.string().optional().nullable(),
  productListHeading: z.string().optional().nullable(),
});

export const productOrderingSettingsSchema = z.object({
  homeDeliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  codEnabled: z.boolean().optional(),
  cashOnPickupEnabled: z.boolean().optional(),
  minOrderValue: z.number().min(0, 'Minimum order value must be >= 0').optional(),
  deliveryFee: z.number().min(0, 'Delivery fee must be >= 0').optional(),
});

export const onlinePaymentSettingsSchema = z.object({
  onlinePaymentEnabled: z.boolean().optional(),
  paymentGateways: z.array(
    z.object({
      provider: z.string().trim().min(1, 'Provider is required'),
      isActive: z.boolean().default(true),
      keyId: z.string().trim().optional(),
      keySecret: z.string().trim().optional(),
      webhookSecret: z.string().trim().optional(),
      merchantId: z.string().trim().optional(),
    })
  ).optional(),
  applyToOrders: z.boolean().optional(),
  applyToAppointments: z.boolean().optional(),
});

export const notificationSettingsSchema = z.object({
  notificationsConfig: z.record(z.any()).optional(),
});

export const feedbackTypeSchema = z.object({
  name: z.string().trim().min(1, 'Feedback name is required').max(100),
  isActive: z.boolean().optional().default(true),
});

export const feedbackSettingsSchema = z.object({
  feedbackEnabled: z.boolean().optional(),
  ratingScale: z.number().int().min(1).max(10).optional(),
  sendFeedbackSms: z.boolean().optional(),
  sendFeedbackEmail: z.boolean().optional(),
  feedbackQuestions: z.array(z.record(z.any())).optional(),
});

export const referralSettingsSchema = z.object({
  referralsEnabled: z.boolean().optional(),
  maxReferLimit: z.number().int().min(0).optional(),
  referrerRewardType: z.enum(['FIXED', 'PERCENTAGE', 'POINTS']).optional(),
  referrerRewardValue: z.number().min(0).optional(),
  refereeRewardType: z.enum(['FIXED', 'PERCENTAGE', 'POINTS']).optional(),
  refereeRewardValue: z.number().min(0).optional(),
  referralMinOrder: z.number().min(0).optional(),
  referralValidityDays: z.number().int().min(1).optional(),
  referrerMaxBenefit: z.number().min(0).optional(),
  referrerFixedAmount: z.number().min(0).optional(),
  referrerPercentage: z.number().min(0).max(100).optional(),
  refereeMaxBenefit: z.number().min(0).optional(),
  refereeFixedAmount: z.number().min(0).optional(),
  refereePercentage: z.number().min(0).max(100).optional(),
});

export const loyaltySettingsSchema = z.object({
  loyaltyEnabled: z.boolean().optional(),
  pointsPerCurrency: z.number().min(0).optional(),
  currencyPerPoint: z.number().min(0).optional(),
  minRedeemPoints: z.number().int().min(1).optional(),
  maxRedeemPointsPerOrder: z.number().int().min(1).optional().nullable(),
  loyaltyExpiryDays: z.number().int().min(1).optional().nullable(),
  earnIndividually: z.boolean().optional(),
  earnLoyaltyIndividually: z.boolean().optional(),
  skipOnRedemption: z.boolean().optional(),
  skipEarningOnRedemption: z.boolean().optional(),
  earnOnMembership: z.boolean().optional(),
  earnOnPercentageMembership: z.boolean().optional(),
  earnAmount: z.number().min(0).optional(),
  earnSpent: z.number().min(0).optional(),
  earnPoints: z.number().min(0).optional(),
  redeemIndividually: z.boolean().optional(),
  redeemLoyaltyIndividually: z.boolean().optional(),
  redeemPoints: z.number().min(0).optional(),
  redeemAmount: z.number().min(0).optional(),
  redeemValue: z.number().min(0).optional(),
  maxRedeemPercentage: z.number().min(0).max(100).optional().nullable(),
  percentageRedeemableOnOrder: z.number().min(0).max(100).optional().nullable(),
});

export const incentiveSettingsSchema = z.object({
  incentiveEnabled: z.boolean().optional(),
  incentiveCalculationType: z.string().optional(),
  calculateIncentiveOn: z.array(z.string()).optional(),
  staffWiseIncentive: z.boolean().optional(),
  slabBasedIncentive: z.boolean().optional(),
  targets: z.array(z.record(z.any())).optional(),
  incentiveRules: z.array(z.record(z.any())).optional(),
});

export const footerContentSchema = z.object({
  footerText: z.string().trim().optional().nullable(),
  footerLinks: z.array(
    z.object({
      title: z.string().trim().min(1),
      url: z.string().trim().min(1),
    })
  ).optional(),
  contactInfo: z.record(z.any()).optional(),
});

export const privacyPolicySchema = z.object({
  privacyPolicy: z.string().optional().nullable(),
});

export const termsConditionsSchema = z.object({
  termsAndConditions: z.string().optional().nullable(),
});

// Entity Validation Schemas
export const createTaxMappingSchema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      ...input,
      name: input.name || input.taxName,
      rate: input.rate !== undefined ? Number(input.rate) : (input.taxValue !== undefined ? Number(input.taxValue) : undefined),
    };
  }
  return input;
}, z.object({
  name: z.string().trim().min(1, 'Tax name is required').max(100),
  rate: z.number().min(0, 'Tax rate must be at least 0%').max(100, 'Tax rate cannot exceed 100%'),
  taxName: z.string().optional(),
  taxValue: z.number().optional(),
  isInclusive: z.boolean().optional().default(false),
  applicableFor: z.array(z.enum(['SERVICE', 'PRODUCT', 'MEMBERSHIP', 'PACKAGES', 'Service', 'Product', 'Membership', 'Packages'])).optional().default(['SERVICE', 'PRODUCT']),
  isActive: z.boolean().optional().default(true),
  description: z.string().trim().optional().nullable(),
}));

export const updateTaxMappingSchema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      ...input,
      name: input.name || input.taxName,
      rate: input.rate !== undefined ? Number(input.rate) : (input.taxValue !== undefined ? Number(input.taxValue) : undefined),
    };
  }
  return input;
}, z.object({
  name: z.string().trim().min(1).max(100).optional(),
  rate: z.number().min(0).max(100).optional(),
  taxName: z.string().optional(),
  taxValue: z.number().optional(),
  isInclusive: z.boolean().optional(),
  applicableFor: z.array(z.enum(['SERVICE', 'PRODUCT', 'MEMBERSHIP', 'PACKAGES', 'Service', 'Product', 'Membership', 'Packages'])).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().optional().nullable(),
}));

export const createMembershipSchema = z.object({
  name: z.string().trim().min(1, 'Membership name is required').max(100),
  price: z.number().min(0, 'Price must be >= 0').optional(),
  fees: z.number().min(0).optional(),
  validityDays: z.number().int().min(1, 'Validity days must be at least 1').optional(),
  validity: z.number().int().min(1).optional(),
  renewalReminderDays: z.number().int().min(0).optional().default(15),
  renewalReminder: z.number().int().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  membershipType: z.enum(['Hourly', 'Hybrid', 'Fixed', 'Percentage', 'HOURLY', 'HYBRID', 'FIXED', 'PERCENTAGE']).optional(),
  membershipSharable: z.boolean().optional(),
  benefitAmount: z.number().min(0).optional(),
  benefits: z.string().trim().optional().nullable(),
  applicableServices: z.array(z.string()).optional().default([]),
  applicableProducts: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateMembershipSchema = createMembershipSchema.partial();

export const createPackageSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required').max(100),
  price: z.number().min(0, 'Price must be >= 0').optional(),
  packagePrice: z.number().min(0).optional(),
  validityDays: z.number().int().min(1, 'Validity days must be at least 1').optional(),
  planValidity: z.number().int().min(1).optional(),
  renewalReminderDays: z.number().int().min(0).optional().default(15),
  renewalReminder: z.number().int().min(0).optional(),
  includesServices: z.boolean().optional(),
  includesProducts: z.boolean().optional(),
  services: z.array(z.any()).optional().default([]),
  products: z.array(z.any()).optional().default([]),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePackageSchema = createPackageSchema.partial();

export const createGiftCardSchema = z.object({
  name: z.string().trim().min(1, 'Gift card name is required').max(100),
  code: z.string().trim().max(50).optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  validityDays: z.number().int().min(1, 'Validity days must be at least 1').optional(),
  validity: z.number().int().min(1).optional(),
  renewalReminderDays: z.number().int().min(0).optional(),
  renewalReminder: z.number().int().min(0).optional(),
  description: z.string().trim().optional().nullable(),
  terms: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateGiftCardSchema = createGiftCardSchema.partial();

export const createCouponSchema = z.object({
  code: z.string().trim().min(1, 'Coupon code is required').max(50),
  description: z.string().trim().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.number().min(0.01, 'Discount value must be greater than 0'),
  minOrderValue: z.number().min(0).optional().default(0),
  maxDiscount: z.number().min(0).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  applicableServices: z.array(z.string()).optional().default([]),
  applicableProducts: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
}).refine((data) => {
  if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
    return false;
  }
  return true;
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue'],
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate'],
});

export const updateCouponSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.number().min(0.01).optional(),
  minOrderValue: z.number().min(0).optional().nullable(),
  maxDiscount: z.number().min(0).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  applicableServices: z.array(z.string()).optional(),
  applicableProducts: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const createPnlCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  type: z.enum(['EXPENSE', 'INCOME']).default('EXPENSE'),
  description: z.string().trim().optional().nullable(),
  sequence: z.number().optional().nullable(),
  categorySequence: z.number().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePnlCategorySchema = createPnlCategorySchema.partial();

export const createPnlIncomeTaxSchema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      ...input,
      fromAmount: input.fromAmount !== undefined ? input.fromAmount : (input.slabFrom !== undefined ? Number(input.slabFrom) : undefined),
      toAmount: input.toAmount !== undefined ? input.toAmount : (input.slabTo !== undefined ? Number(input.slabTo) : undefined),
      taxRate: input.taxRate !== undefined ? input.taxRate : (input.taxValue !== undefined ? Number(input.taxValue) : undefined),
    };
  }
  return input;
}, z.object({
  fromAmount: z.number().min(0, 'From amount must be >= 0'),
  toAmount: z.number().min(0, 'To amount must be >= 0'),
  taxRate: z.number().min(0, 'Tax rate must be >= 0%').max(100, 'Tax rate cannot exceed 100%'),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).refine((data) => data.fromAmount < data.toAmount, {
  message: 'From amount must be strictly less than To amount',
  path: ['toAmount'],
}));

export const updatePnlIncomeTaxSchema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      ...input,
      fromAmount: input.fromAmount !== undefined ? input.fromAmount : (input.slabFrom !== undefined ? Number(input.slabFrom) : undefined),
      toAmount: input.toAmount !== undefined ? input.toAmount : (input.slabTo !== undefined ? Number(input.slabTo) : undefined),
      taxRate: input.taxRate !== undefined ? input.taxRate : (input.taxValue !== undefined ? Number(input.taxValue) : undefined),
    };
  }
  return input;
}, z.object({
  fromAmount: z.number().min(0).optional(),
  toAmount: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.fromAmount !== undefined && data.toAmount !== undefined) {
    return data.fromAmount < data.toAmount;
  }
  return true;
}, {
  message: 'From amount must be strictly less than To amount',
  path: ['toAmount'],
}));

export const createCrmSegmentSchema = z.object({
  name: z.string().trim().min(1, 'Segment name is required').max(100),
  description: z.string().trim().optional().nullable(),
  criteria: z.record(z.any()).optional().default({}),
  isActive: z.boolean().optional().default(true),
});

export const updateCrmSegmentSchema = createCrmSegmentSchema.partial();

export const createCustomFormSchema = z.object({
  name: z.string().trim().min(1, 'Form name is required').max(100),
  description: z.string().trim().optional().nullable(),
  fields: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      type: z.enum(['TEXT', 'NUMBER', 'SELECT', 'CHECKBOX', 'DATE', 'TEXTAREA']),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
    })
  ).min(1, 'At least one field is required in custom form'),
  isActive: z.boolean().optional().default(true),
});

export const updateCustomFormSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().optional().nullable(),
  fields: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      type: z.enum(['TEXT', 'NUMBER', 'SELECT', 'CHECKBOX', 'DATE', 'TEXTAREA']),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
    })
  ).optional(),
  isActive: z.boolean().optional(),
});

export const createSalutationSchema = z.object({
  title: z.string().trim().min(1, 'Salutation title is required').max(20),
  isActive: z.boolean().optional().default(true),
});

export const updateSalutationSchema = createSalutationSchema.partial();

export const updateStaffRosterSchema = z.object({
  schedules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      shiftId: z.string().uuid().optional().nullable(),
      isWeeklyOff: z.boolean().default(false),
    })
  ).min(1, 'At least one day schedule is required'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export const shiftBreakSchema = z.object({
  name: z.string().optional(),
  breakName: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isActive: z.boolean().default(true).optional(),
  active: z.boolean().optional(),
});

export const shiftDayTimingSchema = z.object({
  day: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isOff: z.boolean().default(false).optional(),
});

export const createShiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required').optional(),
  shiftName: z.string().min(1).optional(),
  isActive: z.boolean().default(true).optional(),
  active: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timings: z.array(shiftDayTimingSchema).optional(),
  shiftTiming: z.array(shiftDayTimingSchema).optional(),
  breaks: z.array(shiftBreakSchema).optional(),
  shiftBreaks: z.array(shiftBreakSchema).optional(),
  allDays: z.boolean().optional(),
}).refine((data) => !!(data.name || data.shiftName), {
  message: 'Shift name is required',
  path: ['name'],
});

export const updateShiftSchema = z.object({
  name: z.string().min(1).optional(),
  shiftName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timings: z.array(shiftDayTimingSchema).optional(),
  shiftTiming: z.array(shiftDayTimingSchema).optional(),
  breaks: z.array(shiftBreakSchema).optional(),
  shiftBreaks: z.array(shiftBreakSchema).optional(),
  allDays: z.boolean().optional(),
});

export const applyShiftRosterSchema = z.object({
  shiftId: z.string().uuid('Valid shiftId is required'),
  staffIds: z.array(z.string().uuid()).min(1, 'At least one staff member required'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

export const addShiftBreakSchema = z.object({
  name: z.string().min(1, 'Break name is required').optional(),
  breakName: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isActive: z.boolean().default(true).optional(),
  active: z.boolean().optional(),
}).refine((data) => !!(data.name || data.breakName), {
  message: 'Break name is required',
  path: ['name'],
});
