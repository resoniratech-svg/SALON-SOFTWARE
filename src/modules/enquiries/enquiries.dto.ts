import { z } from 'zod';

const phoneRegex = /^\+?[0-9\s-]{7,20}$/;

const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
const validStatuses = ['NEW', 'FOLLOWING_UP', 'IN_PROGRESS', 'CONVERTED', 'CANCELLED', 'DUPLICATE', 'LOST', 'CONTACTED'];

export function normalizePriority(val?: string | null): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!val) return 'LOW';
  const upper = val.trim().toUpperCase();
  if (validPriorities.includes(upper)) return upper as 'LOW' | 'MEDIUM' | 'HIGH';
  return 'LOW';
}

export function normalizeStatus(val?: string | null): string {
  if (!val) return 'NEW';
  const clean = val.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (validStatuses.includes(clean)) return clean;
  return clean;
}

export const prioritySchema = z.string().trim().transform((val, ctx) => {
  const upper = val.toUpperCase();
  if (!validPriorities.includes(upper)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid priority: ${val}. Must be one of: LOW, MEDIUM, HIGH`,
    });
    return z.NEVER;
  }
  return upper as 'LOW' | 'MEDIUM' | 'HIGH';
});

export const statusSchema = z.string().trim().transform((val, ctx) => {
  const clean = val.toUpperCase().replace(/[\s-]+/g, '_');
  if (!validStatuses.includes(clean)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid status: ${val}. Must be one of: ${validStatuses.join(', ')}`,
    });
    return z.NEVER;
  }
  return clean;
});

export const createEnquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  mobile: z.string().trim().min(7, 'Mobile number is required').max(20).regex(phoneRegex, 'Invalid mobile number format'),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  priority: prioritySchema.optional().nullable().default('LOW'),
  status: statusSchema.optional().nullable().default('NEW'),
  service: z.string().trim().optional().nullable(),
  serviceId: z.string().trim().optional().nullable(),
  assignedStaffId: z.string().trim().optional().nullable(),
  referralSource: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  store: z.string().trim().optional().default('kalyaninagar'),
  guestId: z.string().trim().optional().nullable(),
});

export const updateEnquirySchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
  mobile: z.string().trim().min(7).max(20).regex(phoneRegex, 'Invalid mobile number format').optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  priority: prioritySchema.optional().nullable(),
  status: statusSchema.optional().nullable(),
  service: z.string().trim().optional().nullable(),
  serviceId: z.string().trim().optional().nullable(),
  assignedStaffId: z.string().trim().optional().nullable(),
  referralSource: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  store: z.string().trim().optional(),
  guestId: z.string().trim().optional().nullable(),
});

export const createFollowUpSchema = z.object({
  followUpDate: z.string().min(1, 'Follow-up date is required'),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).default('PENDING'),
});

export const updateFollowUpSchema = z.object({
  followUpDate: z.string().optional(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
});

export const enquiryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  store: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  service: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'followUpDate', 'name', 'status', 'priority']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createReferralSchema = z.object({
  referralName: z.string().trim().min(1, 'Referral name is required'),
  mobileNumber: z.string().trim().min(7).max(20).regex(phoneRegex, 'Invalid mobile number'),
  referredDate: z.string().optional(),
  referrerGuestId: z.string().uuid().optional().nullable(),
  referrerName: z.string().trim().optional().nullable(),
  referralCode: z.string().trim().optional(),
  status: z.enum(['PENDING', 'USED', 'EXPIRED']).default('PENDING'),
  benefitToReferral: z.string().trim().optional().nullable(),
  benefitToReferrer: z.string().trim().optional().nullable(),
  store: z.string().trim().optional().default('kalyaninagar'),
});

export const referralQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  store: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

export const updateReferralSchema = z.object({
  referralName: z.string().trim().min(1).optional(),
  mobileNumber: z.string().trim().min(7).max(20).regex(phoneRegex, 'Invalid mobile number').optional(),
  referredDate: z.string().optional(),
  referrerGuestId: z.string().uuid().optional().nullable(),
  referrerName: z.string().trim().optional().nullable(),
  referralCode: z.string().trim().optional(),
  status: z.enum(['PENDING', 'USED', 'EXPIRED']).optional(),
  benefitToReferral: z.string().trim().optional().nullable(),
  benefitToReferrer: z.string().trim().optional().nullable(),
  store: z.string().trim().optional(),
});
