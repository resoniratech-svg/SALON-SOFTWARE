import { z } from 'zod';

const phoneRegex = /^\+?[0-9\s-]{7,20}$/;

export const sendMessageSchema = z.object({
  recipientNumber: z.string().trim().min(7, 'Recipient number is required').max(20).regex(phoneRegex, 'Invalid phone number format'),
  recipientName: z.string().trim().optional().nullable(),
  messageContent: z.string().trim().optional(),
  templateName: z.string().trim().optional().nullable(),
  templateVariables: z.record(z.any()).optional(),
  templateParams: z.record(z.any()).optional(),
  status: z.string().optional(),
  errorDetails: z.string().optional().nullable(),
  conversationId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => (data.messageContent && data.messageContent.length > 0) || (data.templateName && data.templateName.length > 0),
  { message: 'Either messageContent or templateName must be provided' }
);

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  recipientNumber: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  templateName: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const conversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
