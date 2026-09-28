import {
  RevenuePeriod,
  RevenueSplitQueryParams,
  SeriesQueryParams,
  TimeSeriesQueryParams,
  TREND_CATEGORIES,
  TrendCategory,
  TrendPeriod,
  TrendsQueryParams,
  resolveRevenueDateRange,
  resolveTrendDateRange,
} from './trends.dto.js';
import { TrendsRepository } from './trends.repository.js';

export class TrendsService {
  constructor(private repo: TrendsRepository = new TrendsRepository()) {}

  // 1. Get Available Locations
  async getLocations(tenantId: string) {
    return this.repo.getLocations(tenantId);
  }

  // 2. Get Available Category Tabs
  getCategories() {
    return [...TREND_CATEGORIES];
  }

  // 3. Get Series Options for Category
  async getSeries(tenantId: string, query: SeriesQueryParams) {
    const loc = query.location || query.store;
    return this.repo.getSeriesOptions(tenantId, query.category, loc);
  }

  // 4. Revenue Split Chart Data
  async getRevenueSplit(tenantId: string, query: RevenueSplitQueryParams) {
    const range = resolveRevenueDateRange(query.period, query.startDate, query.endDate);
    const loc = query.location || query.store;
    return this.repo.getRevenueSplit(tenantId, query.category, range, loc);
  }

  // 5. Time-Series Trends Data
  async getTimeSeries(tenantId: string, query: TimeSeriesQueryParams) {
    const range = resolveTrendDateRange(query.period, query.startDate, query.endDate);
    const loc = query.location || query.store;

    let selectedSeriesArr: string[] | undefined;
    if (typeof query.selected_series === 'string') {
      selectedSeriesArr = query.selected_series.split(',').map((s) => s.trim());
    } else if (Array.isArray(query.selected_series)) {
      selectedSeriesArr = query.selected_series;
    }

    return this.repo.getTimeSeries(tenantId, query.category, query.period, range, loc, selectedSeriesArr);
  }

  // 6. Unified Dashboard
  async getDashboard(tenantId: string, query: TrendsQueryParams) {
    const loc = query.location || query.store || query.locationId;
    const category: TrendCategory = query.category || 'overall';
    const revPeriod: RevenuePeriod = query.revenue_period || '14D';
    const trendPeriod: TrendPeriod = query.trend_period || 'Month';

    const [locations, seriesOptions, revenueSplit, trends] = await Promise.all([
      this.repo.getLocations(tenantId),
      this.repo.getSeriesOptions(tenantId, category, loc),
      this.getRevenueSplit(tenantId, {
        category,
        period: revPeriod,
        location: loc,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
      this.getTimeSeries(tenantId, {
        category,
        period: trendPeriod,
        location: loc,
        selected_series: query.selected_series,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
    ]);

    const activeLocation = loc || (locations.length > 0 ? locations[0].id : 'all');

    return {
      location: activeLocation,
      locations,
      category,
      categories: this.getCategories(),
      seriesOptions,
      revenueSplit,
      trends,
    };
  }

  // 7. CSV Export for Revenue Split
  async exportRevenueSplitCsv(tenantId: string, query: RevenueSplitQueryParams): Promise<string> {
    const result = await this.getRevenueSplit(tenantId, query);
    const headers = ['Category', 'Location', 'Period', 'Start Date', 'End Date', 'Item Key', 'Item Label', 'Amount (INR)', 'Percentage (%)'];

    const escapeCsv = (str: any) => {
      const stringValue = str === null || str === undefined ? '' : String(str);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const total = result.total || 0;
    const rows = result.data.map((item: any) => {
      const pct = total > 0 ? ((item.amount / total) * 100).toFixed(2) : '0.00';
      return [
        escapeCsv(result.category),
        escapeCsv(result.location),
        escapeCsv(query.period),
        escapeCsv(result.dateRange.startDate),
        escapeCsv(result.dateRange.endDate),
        escapeCsv(item.key),
        escapeCsv(item.label),
        escapeCsv(Number(item.amount).toFixed(2)),
        escapeCsv(pct),
      ];
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // 8. CSV Export for Time-Series Trends
  async exportTimeSeriesCsv(tenantId: string, query: TimeSeriesQueryParams): Promise<string> {
    const result = await this.getTimeSeries(tenantId, query);
    const seriesList = result.selectedSeries && result.selectedSeries.length > 0 ? result.selectedSeries : result.series;
    const headers = ['Interval Period', 'Interval Date', ...seriesList];

    const escapeCsv = (str: any) => {
      const stringValue = str === null || str === undefined ? '' : String(str);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = result.intervals.map((interval: any) => {
      const row = [escapeCsv(interval.period), escapeCsv(interval.date)];
      for (const s of seriesList) {
        row.push(escapeCsv(Number(interval.values[s] || 0).toFixed(2)));
      }
      return row;
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
