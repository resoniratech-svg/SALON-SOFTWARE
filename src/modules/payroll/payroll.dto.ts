import { z } from 'zod';

export const payrollConfigSchema = z.object({
  staffId: z.string().uuid().optional().nullable(),
  basicSalary: z.coerce.number().min(0, 'Basic salary must be non-negative'),
  hra: z.coerce.number().min(0).default(0),
  conveyance: z.coerce.number().min(0).default(0),
  medicalAllowance: z.coerce.number().min(0).default(0),
  specialAllowance: z.coerce.number().min(0).default(0),
  pfPercentage: z.coerce.number().min(0).max(100).default(0),
  esiPercentage: z.coerce.number().min(0).max(100).default(0),
  professionalTax: z.coerce.number().min(0).default(0),
  tdsPercentage: z.coerce.number().min(0).max(100).default(0),
  isActive: z.boolean().optional().default(true),
});

export const generateSalarySchema = z.object({
  month: z.coerce.number().int().min(1, 'Month must be between 1 and 12').max(12),
  year: z.coerce.number().int().min(2000, 'Year must be valid').max(2100),
  staffId: z.string().uuid().optional().nullable(),
  workingDays: z.coerce.number().int().min(1).max(31).default(30),
  presentDays: z.coerce.number().int().min(0).max(31).default(30),
  incentives: z.coerce.number().min(0).optional(),
  bonuses: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().trim().optional(),
  notes: z.string().trim().optional().nullable(),
  forceRegenerate: z.boolean().optional().default(false),
});

export const salaryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  staffId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID']).optional(),
});

export const payslipQuerySchema = z.object({
  staffId: z.string().uuid('Valid staff ID is required'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const updateSalarySchema = z.object({
  basicSalary: z.coerce.number().min(0).optional(),
  allowances: z.coerce.number().min(0).optional(),
  deductions: z.coerce.number().min(0).optional(),
  incentives: z.coerce.number().min(0).optional(),
  bonuses: z.coerce.number().min(0).optional(),
  workingDays: z.coerce.number().int().min(1).max(31).optional(),
  presentDays: z.coerce.number().int().min(0).max(31).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID']).optional(),
  paymentMethod: z.string().trim().optional(),
  paidAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateSalaryStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'PAID']),
  paymentMethod: z.string().trim().optional(),
  paidAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

