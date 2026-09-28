import { Request, Response, NextFunction } from 'express';
import { TrendsService } from './trends.service.js';
import {
  trendsQuerySchema,
  revenueSplitQuerySchema,
  timeSeriesQuerySchema,
  seriesQuerySchema,
} from './trends.dto.js';
import { AppError } from '../../utils/app-error.js';

export class TrendsController {
  constructor(private service: TrendsService = new TrendsService()) {}

  // 1. GET /api/trends/dashboard
  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId;
      if (!tenantId) throw new AppError('Tenant context required', 400);

      const parsedQuery = trendsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid trends query parameters',
          errors: parsedQuery.error.format(),
        });
      }

      const result = await this.service.getDashboard(tenantId, parsedQuery.data);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  // 2. GET /api/trends/locations
  getLocations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId;
      if (!tenantId) throw new AppError('Tenant context required', 400);

      const locations = await this.service.getLocations(tenantId);
      res.status(200).json({ status: 'success', data: locations });
    } catch (err) {
      next(err);
    }
  };

  // 3. GET /api/trends/categories
  getCategories = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = this.service.getCategories();
      res.status(200).json({ status: 'success', data: categories });
    } catch (err) {
      next(err);
    }
  };

  // 4. GET /api/trends/series
  getSeries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId;
      if (!tenantId) throw new AppError('Tenant context required', 400);

      const parsedQuery = seriesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid series query parameters',
          errors: parsedQuery.error.format(),
        });
      }

      const series = await this.service.getSeries(tenantId, parsedQuery.data);
      res.status(200).json({ status: 'success', data: series });
    } catch (err) {
      next(err);
    }
  };

  // 5. GET /api/trends/revenue-split
  getRevenueSplit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId;
      if (!tenantId) throw new AppError('Tenant context required', 400);

      const parsedQuery = revenueSplitQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid revenue split query parameters',
          errors: parsedQuery.error.format(),
        });
      }

      if (parsedQuery.data.export === 'csv') {
        const csv = await this.service.exportRevenueSplitCsv(tenantId, parsedQuery.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="revenue-split-${parsedQuery.data.category}-${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.status(200).send(csv);
      }

      const result = await this.service.getRevenueSplit(tenantId, parsedQuery.data);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  // 6. GET /api/trends/time-series
  getTimeSeries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId;
      if (!tenantId) throw new AppError('Tenant context required', 400);

      const parsedQuery = timeSeriesQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid time series query parameters',
          errors: parsedQuery.error.format(),
        });
      }

      if (parsedQuery.data.export === 'csv') {
        const csv = await this.service.exportTimeSeriesCsv(tenantId, parsedQuery.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="trends-time-series-${parsedQuery.data.category}-${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.status(200).send(csv);
      }

      const result = await this.service.getTimeSeries(tenantId, parsedQuery.data);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };
}
