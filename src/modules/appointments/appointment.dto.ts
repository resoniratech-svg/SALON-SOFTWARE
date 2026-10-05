import { z } from 'zod';

export const AppointmentStatusEnum = z.enum([
  'CONFIRMED',
  'ONLINE',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

export const BookingSourceEnum = z.enum(['WALK_IN', 'ONLINE', 'PHONE']);

export const AppointmentItemInputSchema = z.object({
  serviceId: z.string().uuid('Invalid service UUID'),
  staffId: z.string().uuid('Invalid staff UUID').optional().nullable(),
  resourceId: z.string().uuid('Invalid resource UUID').optional().nullable(),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:mm (24-hour format)'),
  endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:mm (24-hour format)').optional(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  isRecommendedStaff: z.boolean().default(false),
});

export const QuickGuestInputSchema = z.object({
  name: z.string().min(1, 'Guest name is required'),
  mobile: z.string().min(10, 'Valid 10-digit mobile number is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
});

export const CreateAppointmentSchema = z.object({
  guestId: z.string().uuid('Invalid guest UUID').optional(),
  guest: QuickGuestInputSchema.optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'appointmentDate must be YYYY-MM-DD'),
  status: AppointmentStatusEnum.default('CONFIRMED'),
  bookingSource: BookingSourceEnum.default('WALK_IN'),
  instruction: z.string().max(1000).optional().nullable(),
  confirmationSms: z.boolean().default(true),
  smsToOwner: z.boolean().default(true),
  items: z.array(AppointmentItemInputSchema).min(1, 'At least one service is required'),
}).refine(data => data.guestId || data.guest, {
  message: 'Either guestId or guest details must be provided',
  path: ['guestId'],
});

export const UpdateAppointmentSchema = z.object({
  guestId: z.string().uuid('Invalid guest UUID').optional(),
  staffId: z.string().uuid('Invalid staff UUID').optional().nullable(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'appointmentDate must be YYYY-MM-DD').optional(),
  status: AppointmentStatusEnum.optional(),
  bookingSource: BookingSourceEnum.optional(),
  instruction: z.string().max(1000).optional().nullable(),
  confirmationSms: z.boolean().optional(),
  smsToOwner: z.boolean().optional(),
  items: z.array(AppointmentItemInputSchema).min(1, 'At least one service is required').optional(),
});

export const UpdateAppointmentStatusSchema = z.object({
  status: AppointmentStatusEnum,
  cancelledReason: z.string().max(500).optional().nullable(),
});

export const RescheduleAppointmentSchema = z.object({
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'appointmentDate must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:mm').optional(),
  staffId: z.string().uuid().optional().nullable(),
  resourceId: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    serviceId: z.string().uuid(),
    staffId: z.string().uuid().optional().nullable(),
    resourceId: z.string().uuid().optional().nullable(),
    startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  })).optional(),
});

export const CalendarQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  view: z.enum(['staff', 'resource']).default('staff'),
  status: AppointmentStatusEnum.optional(),
  staffId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
});

export const ListAppointmentsQuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform(v => (v ? parseInt(v, 10) : 20)),
  search: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: AppointmentStatusEnum.optional(),
  staffId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  sortBy: z.enum(['appointmentDate', 'createdAt', 'appointmentNumber', 'totalAmount']).default('appointmentDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  export: z.enum(['csv', 'excel']).optional(),
});

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;
export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>;
export type RescheduleAppointmentDto = z.infer<typeof RescheduleAppointmentSchema>;
export type CalendarQueryDto = z.infer<typeof CalendarQuerySchema>;
export type ListAppointmentsQueryDto = z.infer<typeof ListAppointmentsQuerySchema>;
