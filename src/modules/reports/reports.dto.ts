import { z } from 'zod';

export const reportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  preset: z.enum(['today', 'weekly', 'monthly', 'yearly']).optional(),
  store: z.string().optional(),
  storeId: z.string().optional(),
  staffId: z.string().optional(),
  guestId: z.string().optional(),
  categoryId: z.string().optional(),
  serviceId: z.string().optional(),
  productId: z.string().optional(),
  group: z.enum(['Both', 'Female', 'Male', 'BOTH', 'FEMALE', 'MALE']).optional(),
  groupData: z.string().optional(),
  redemption: z.string().optional(),
  status: z.string().optional(),
  vendor: z.string().optional(),
  type: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  search: z.string().optional(),
});

export type ReportQueryParams = z.infer<typeof reportQuerySchema>;

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset?: string;
  startDateStr: string;
  endDateStr: string;
}

export function resolveDateRange(query: Partial<ReportQueryParams>): DateRange {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (query.preset) {
    const p = query.preset.toLowerCase();
    if (p === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (p === 'weekly') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (p === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (p === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }
  }

  if (query.startDate) {
    const parsed = new Date(query.startDate);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      start = parsed;
    }
  }

  if (query.endDate) {
    const parsed = new Date(query.endDate);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      end = parsed;
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const startDateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endDateStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

  return {
    startDate: start,
    endDate: end,
    preset: query.preset,
    startDateStr,
    endDateStr,
  };
}
