import { z } from 'zod';

const personalDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  displayName: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  dob: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  mobile: z.string().trim().min(5, 'Mobile number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactNumber: z.string().trim().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
});

const documentItemSchema = z.object({
  documentType: z.string().trim().min(1, 'Document type is required'),
  documentNumber: z.string().trim().optional(),
  documentUrl: z.string().trim().min(1, 'Document URL is required'),
});

const joiningDetailsSchema = z.object({
  joiningDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  designationId: z.string().uuid('Invalid designation ID'),
  employeeNumber: z.string().trim().min(1, 'Employee number is required'),
  reportingToId: z.string().uuid('Invalid reporting-to staff ID').nullable().optional(),
  workingHours: z.string().trim().min(1, 'Working hours is required'),
});

const bankDetailsSchema = z.object({
  bankName: z.string().trim().min(1, 'Bank name is required'),
  branch: z.string().trim().min(1, 'Branch name is required'),
  accountNumber: z.string().trim().min(1, 'Account number is required'),
  ifsc: z.string().trim().min(1, 'IFSC code is required'),
});

const appointmentSettingsSchema = z.object({
  enableAppointments: z.boolean().default(true),
  showAllAppointments: z.boolean().default(false),
});

const weeklyScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  shiftId: z.string().uuid('Invalid shift ID').nullable().optional(),
  isWeeklyOff: z.boolean().default(false),
});

export const createStaffSchema = z.object({
  personalDetails: personalDetailsSchema,
  documents: z.array(documentItemSchema).optional().default([]),
  joiningDetails: joiningDetailsSchema,
  bankDetails: bankDetailsSchema,
  appointmentSettings: appointmentSettingsSchema.optional().default({
    enableAppointments: true,
    showAllAppointments: false,
  }),
  weeklySchedule: z.array(weeklyScheduleItemSchema).optional().default([]),
});

export const updateStaffSchema = z.object({
  personalDetails: personalDetailsSchema.partial().optional(),
  documents: z.array(documentItemSchema).optional(),
  joiningDetails: joiningDetailsSchema.partial().optional(),
  bankDetails: bankDetailsSchema.partial().optional(),
  appointmentSettings: appointmentSettingsSchema.partial().optional(),
  weeklySchedule: z.array(weeklyScheduleItemSchema).optional(),
});

export const updateStaffStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean is required' }),
});

export const staffQuerySchema = z.object({
  search: z.string().optional(),
  designationId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  enableAppointments: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  export: z.enum(['csv', 'excel']).optional(),
});
