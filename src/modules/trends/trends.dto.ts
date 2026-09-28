import { z } from 'zod';

export const TREND_CATEGORIES = ['overall', 'service', 'product', 'staff'] as const;
export type TrendCategory = (typeof TREND_CATEGORIES)[number];

export const REVENUE_PERIODS = ['1D', '7D', '14D', '1M', '2M', 'YTD', '1Y'] as const;
export type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

export const TREND_PERIODS = ['Week', 'Month', '3M', '6M', '1Y', '5Y'] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

export const trendsQuerySchema = z.object({
  location: z.string().optional(),
  store: z.string().optional(),
  locationId: z.string().optional(),
  category: z.enum(TREND_CATEGORIES).default('overall'),
  revenue_period: z.enum(REVENUE_PERIODS).default('14D'),
  trend_period: z.enum(TREND_PERIODS).default('Month'),
  selected_series: z.union([z.string(), z.array(z.string())]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type TrendsQueryParams = z.infer<typeof trendsQuerySchema>;

export const revenueSplitQuerySchema = z.object({
  location: z.string().optional(),
  store: z.string().optional(),
  category: z.enum(TREND_CATEGORIES).default('overall'),
  period: z.enum(REVENUE_PERIODS).default('14D'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  export: z.enum(['csv', 'json']).optional(),
});

export type RevenueSplitQueryParams = z.infer<typeof revenueSplitQuerySchema>;

export const timeSeriesQuerySchema = z.object({
  location: z.string().optional(),
  store: z.string().optional(),
  category: z.enum(TREND_CATEGORIES).default('overall'),
  period: z.enum(TREND_PERIODS).default('Month'),
  selected_series: z.union([z.string(), z.array(z.string())]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  export: z.enum(['csv', 'json']).optional(),
});

export type TimeSeriesQueryParams = z.infer<typeof timeSeriesQuerySchema>;

export const seriesQuerySchema = z.object({
  category: z.enum(TREND_CATEGORIES).default('overall'),
  location: z.string().optional(),
  store: z.string().optional(),
});

export type SeriesQueryParams = z.infer<typeof seriesQuerySchema>;

export interface DateRange {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
}

export function resolveRevenueDateRange(period: RevenuePeriod, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const end = customEnd ? new Date(customEnd) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start = new Date(end);

  if (customStart) {
    start = new Date(customStart);
  } else {
    switch (period) {
      case '1D':
        start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
        break;
      case '7D':
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case '14D':
        start.setDate(end.getDate() - 13);
        start.setHours(0, 0, 0, 0);
        break;
      case '1M':
        start.setDate(end.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      case '2M':
        start.setDate(end.getDate() - 59);
        start.setHours(0, 0, 0, 0);
        break;
      case 'YTD':
        start = new Date(end.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      case '1Y':
        start.setFullYear(end.getFullYear() - 1);
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setDate(end.getDate() - 13);
        start.setHours(0, 0, 0, 0);
    }
  }

  return {
    startDate: start,
    endDate: end,
    startDateStr: start.toISOString().split('T')[0],
    endDateStr: end.toISOString().split('T')[0],
  };
}

export function resolveTrendDateRange(period: TrendPeriod, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const end = customEnd ? new Date(customEnd) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start = new Date(end);

  if (customStart) {
    start = new Date(customStart);
  } else {
    switch (period) {
      case 'Week':
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case 'Month':
        start.setDate(end.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      case '3M':
        start.setDate(end.getDate() - 89);
        start.setHours(0, 0, 0, 0);
        break;
      case '6M':
        start.setDate(end.getDate() - 179);
        start.setHours(0, 0, 0, 0);
        break;
      case '1Y':
        start.setFullYear(end.getFullYear() - 1);
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        break;
      case '5Y':
        start.setFullYear(end.getFullYear() - 5);
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setDate(end.getDate() - 29);
        start.setHours(0, 0, 0, 0);
    }
  }

  return {
    startDate: start,
    endDate: end,
    startDateStr: start.toISOString().split('T')[0],
    endDateStr: end.toISOString().split('T')[0],
  };
}
