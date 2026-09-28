import { z } from 'zod';

const phoneRegex = /^\+?[0-9\s-]{7,20}$/;

export const createGuestSchema = z.object({
  guestCode: z.string().trim().max(50, 'Guest code must not exceed 50 characters').optional().nullable(),
  salutation: z.string().trim().max(20, 'Salutation must not exceed 20 characters').optional().nullable(),
  salutationId: z.string().uuid('Invalid salutation ID').optional().nullable(),
  firstName: z.string().trim().max(50, 'First name must not exceed 50 characters').optional().nullable(),
  lastName: z.string().trim().max(50, 'Last name must not exceed 50 characters').optional().nullable(),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters'),
  displayName: z.string().trim().max(100, 'Display name must not exceed 100 characters').optional().nullable(),
  gender: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']))
    .optional()
    .nullable(),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  dob: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  mobile: z.string().trim().min(7, 'Mobile must be at least 7 digits').max(20, 'Mobile must not exceed 20 digits').regex(phoneRegex, 'Invalid mobile number format'),
  alternateMobile: z.string().trim().max(20, 'Alternate mobile must not exceed 20 digits').regex(phoneRegex, 'Invalid alternate mobile number format').optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').max(150, 'Email must not exceed 150 characters').optional().nullable().or(z.literal('')),
  address: z.string().trim().max(500, 'Address must not exceed 500 characters').optional().nullable(),
  city: z.string().trim().max(100, 'City must not exceed 100 characters').optional().nullable(),
  state: z.string().trim().max(100, 'State must not exceed 100 characters').optional().nullable(),
  country: z.string().trim().max(100, 'Country must not exceed 100 characters').optional().default('India'),
  postalCode: z.string().trim().max(20, 'Postal code must not exceed 20 characters').optional().nullable(),
  anniversary: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  gstNumber: z.string().trim().max(30, 'GST number must not exceed 30 characters').optional().nullable().or(z.literal('')),
  hairType: z.string().trim().max(50, 'Hair type must not exceed 50 characters').optional().nullable().or(z.literal('')),
  preferences: z.string().trim().max(1000, 'Preferences must not exceed 1000 characters').optional().nullable(),
  notes: z.string().trim().max(1000, 'Notes must not exceed 1000 characters').optional().nullable(),
  tags: z.array(z.string().trim()).optional().default([]),
  customerType: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['REGULAR', 'VIP', 'CORPORATE', 'WALK_IN']))
    .optional()
    .default('REGULAR'),
  source: z.string().trim().max(50, 'Source must not exceed 50 characters').optional().nullable(),
  referralCode: z.string().trim().max(50, 'Referral code must not exceed 50 characters').optional().nullable(),
  referredByGuestId: z.string().uuid('Invalid referrer guest ID').optional().nullable(),
  crmSegmentId: z.string().uuid('Invalid CRM segment ID').optional().nullable(),
  membershipId: z.string().uuid('Invalid membership ID').optional().nullable(),
  membershipExpiry: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  loyaltyPoints: z.number().int().min(0, 'Loyalty points cannot be negative').optional().default(0),
  isActive: z.boolean().optional().default(true),
  isBlocked: z.boolean().optional().default(false),
  blockReason: z.string().trim().max(500, 'Block reason must not exceed 500 characters').optional().nullable(),
});

export const bulkDeleteGuestsSchema = z.object({
  ids: z.array(z.string().uuid('Invalid guest ID')).min(1, 'At least one guest ID is required'),
});

export const updateGuestSchema = z.object({
  guestCode: z.string().trim().max(50).optional().nullable(),
  salutation: z.string().trim().max(20).optional().nullable(),
  salutationId: z.string().uuid().optional().nullable(),
  firstName: z.string().trim().max(50).optional().nullable(),
  lastName: z.string().trim().max(50).optional().nullable(),
  name: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().max(100).optional().nullable(),
  gender: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']))
    .optional()
    .nullable(),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  dob: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  mobile: z.string().trim().min(7).max(20).regex(phoneRegex, 'Invalid mobile number format').optional(),
  alternateMobile: z.string().trim().max(20).regex(phoneRegex, 'Invalid alternate mobile number format').optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').max(150).optional().nullable().or(z.literal('')),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  anniversary: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  gstNumber: z.string().trim().max(30).optional().nullable().or(z.literal('')),
  hairType: z.string().trim().max(50).optional().nullable().or(z.literal('')),
  preferences: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim()).optional(),
  customerType: z
    .preprocess((val) => (typeof val === 'string' ? val.toUpperCase() : val), z.enum(['REGULAR', 'VIP', 'CORPORATE', 'WALK_IN']))
    .optional(),
  source: z.string().trim().max(50).optional().nullable(),
  referralCode: z.string().trim().max(50).optional().nullable(),
  referredByGuestId: z.string().uuid().optional().nullable(),
  crmSegmentId: z.string().uuid().optional().nullable(),
  membershipId: z.string().uuid().optional().nullable(),
  membershipExpiry: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable().or(z.literal('')),
  loyaltyPoints: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  blockReason: z.string().trim().max(500).optional().nullable(),
});

export const updateGuestStatusSchema = z.object({
  isActive: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  blockReason: z.string().trim().max(500).optional().nullable(),
}).refine(
  (data) => data.isActive !== undefined || data.isBlocked !== undefined,
  { message: 'At least one of isActive or isBlocked must be provided' }
);

export const guestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  customerType: z.string().trim().optional(),
  crmSegmentId: z.string().uuid().optional(),
  membershipId: z.string().uuid().optional(),
  hairType: z.string().trim().optional(),
  source: z.string().trim().optional(),
  isActive: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  isBlocked: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  hasMembership: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  minSpend: z.coerce.number().min(0).optional(),
  maxSpend: z.coerce.number().min(0).optional(),
  minVisits: z.coerce.number().int().min(0).optional(),
  maxVisits: z.coerce.number().int().min(0).optional(),
  tags: z.string().trim().optional(),
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
  anniversaryMonth: z.coerce.number().int().min(1).max(12).optional(),
  hasAnniversaryToday: z
    .preprocess((val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val), z.boolean())
    .optional(),
  hasBirthdayToday: z
    .preprocess((val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val), z.boolean())
    .optional(),
  specialDay: z.enum(['BIRTHDAY', 'ANNIVERSARY']).optional(),
  startingDate: z.string().optional(),
  endingDate: z.string().optional(),
  lastVisited: z.string().optional(),
  visitType: z.enum(['ALL', 'NEW_GUEST', 'REPETITIVE_GUEST']).optional(),
  hasAdvance: z
    .preprocess((val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val), z.boolean())
    .optional(),
  hasBalance: z
    .preprocess((val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val), z.boolean())
    .optional(),
  clientRetention: z
    .preprocess((val) => (val === 'true' || val === true ? true : val === 'false' || val === false ? false : val), z.boolean())
    .optional(),
  minPurchaseAmount: z.coerce.number().min(0).optional(),
  maxPurchaseAmount: z.coerce.number().min(0).optional(),
  minAvgPurchaseAmount: z.coerce.number().min(0).optional(),
  maxAvgPurchaseAmount: z.coerce.number().min(0).optional(),
  store: z.string().trim().optional(),
  sortBy: z
    .enum(['name', 'createdAt', 'totalSpend', 'totalVisits', 'loyaltyPoints', 'lastVisitDate', 'mobile', 'totalOrders', 'advanceBalance', 'dueBalance'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ==========================================
// CRM 360 SUB-RESOURCE SCHEMAS
// ==========================================

export const addGuestMembershipSchema = z.object({
  membershipId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, 'Membership name is required'),
  planFee: z.number().min(0, 'Plan fee cannot be negative'),
  totalCredit: z.number().min(0, 'Total credit cannot be negative'),
  validityDays: z.number().int().min(1, 'Validity days must be at least 1'),
  membershipType: z.enum(['Fixed', 'Value', 'Percentage']).default('Fixed'),
  staffId: z.string().uuid().optional().nullable(),
  payWith: z.object({
    balance: z.number().min(0).default(0),
    advance: z.number().min(0).default(0),
    cash: z.number().min(0).default(0),
    card: z.number().min(0).default(0),
    hdfc: z.number().min(0).default(0),
    gpay: z.number().min(0).default(0),
    phonepe: z.number().min(0).default(0),
  }).default({}),
  notes: z.string().trim().optional().nullable(),
});

export const addGuestPackageSchema = z.object({
  packageId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, 'Package name is required'),
  price: z.number().min(0, 'Price cannot be negative'),
  validityDays: z.number().int().min(1, 'Validity days must be at least 1').default(365),
  totalSessions: z.number().int().min(1, 'Total sessions must be at least 1').default(1),
  services: z.array(
    z.object({
      serviceId: z.string().optional(),
      name: z.string(),
      count: z.number().int().min(1).default(1),
    })
  ).default([]),
});

export const guestWalletTxSchema = z.object({
  type: z.enum(['ADVANCE_DEPOSIT', 'ADVANCE_REDEMPTION', 'DUE_BALANCE_PAID', 'DUE_BALANCE_ADDED', 'LOYALTY_CREDIT', 'LOYALTY_DEBIT']),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  paymentMethod: z.string().trim().default('Cash'),
  notes: z.string().trim().optional().nullable(),
});

export const guestFollowUpSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional().nullable(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  staffId: z.string().uuid().optional().nullable(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).default('PENDING'),
});

export const guestNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note content is required'),
  tag: z.enum(['HAIR_PREFERENCE', 'SKIN_PREFERENCE', 'ALLERGY', 'GENERAL']).default('GENERAL'),
});

export const guestFamilyMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']),
  mobile: z.string().trim().optional().nullable(),
  gender: z.string().trim().optional().nullable(),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
});

export const guestFormSubmissionSchema = z.object({
  formId: z.string().uuid().optional().nullable(),
  formName: z.string().trim().min(1, 'Form name is required'),
  responses: z.record(z.any()).default({}),
});

export type AddGuestMembershipInput = z.infer<typeof addGuestMembershipSchema>;
export type AddGuestPackageInput = z.infer<typeof addGuestPackageSchema>;
export type GuestWalletTxInput = z.infer<typeof guestWalletTxSchema>;
export type GuestFollowUpInput = z.infer<typeof guestFollowUpSchema>;
export type GuestNoteInput = z.infer<typeof guestNoteSchema>;
export type GuestFamilyMemberInput = z.infer<typeof guestFamilyMemberSchema>;
export type GuestFormSubmissionInput = z.infer<typeof guestFormSubmissionSchema>;
