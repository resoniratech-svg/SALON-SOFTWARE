import { Request, Response, NextFunction } from 'express';
import { staffService, StaffService } from './staff.service.js';
import { sendResponse } from '../../utils/api-response.js';

export class StaffController {
  constructor(private service: StaffService = staffService) {}

  private resolveTenantId(req: Request): string {
    return (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-impersonate-tenant-id'] as string) ||
      (req.query?.tenantId as string) ||
      ((req as any).validatedQuery?.tenantId as string) ||
      req.body?.tenantId
    ) as string;
  }

  createStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.service.createStaff(tenantId, req.body);
      sendResponse(res, 201, true, 'Staff member created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getStaffList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const query = (req as any).validatedQuery || req.query;

      if (query.export === 'csv') {
        const csv = await this.service.exportStaffCsv(tenantId, query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="staff-export-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        res.status(200).send(csv);
        return;
      }

      const result = await this.service.getStaffList(tenantId, query);
      sendResponse(res, 200, true, 'Staff list retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getStaffProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getStaffById(tenantId, id);
      sendResponse(res, 200, true, 'Staff profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.updateStaff(tenantId, id, req.body);
      sendResponse(res, 200, true, 'Staff profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const { isActive } = req.body;
      const result = await this.service.updateStatus(tenantId, id, isActive);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  deleteStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteStaff(tenantId, id);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  getDesignations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.service.getDesignations(tenantId);
      sendResponse(res, 200, true, 'Designations retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getShifts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.service.getShifts(tenantId);
      sendResponse(res, 200, true, 'Shifts retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const staffController = new StaffController();
