import { Request, Response, NextFunction } from 'express';
import { cashierService, CashierService } from './cashier.service.js';
import { sendResponse } from '../../utils/api-response.js';
import { ForbiddenError } from '../../utils/app-error.js';

export class CashierController {
  constructor(private service: CashierService = cashierService) {}

  private resolveTenantId(req: Request): string {
    let tenantId = req.effectiveTenantId || req.tenantId || req.user?.tenantId;
    if (!tenantId && req.user?.isSuperAdmin) {
      tenantId =
        (req.query?.tenantId as string) ||
        ((req as any).validatedQuery?.tenantId as string) ||
        (req.headers['x-tenant-id'] as string) ||
        (req.body?.tenantId as string);
    }
    if (!tenantId) {
      throw new ForbiddenError(
        'Company context required for Cashier management. When using a SuperAdmin token, please set Authorization to Bearer {{impersonationToken}} or append ?tenantId={{companyId}}'
      );
    }
    return tenantId;
  }

  createCashier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.service.createCashier(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Cashier created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getCashiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.getCashiers(tenantId, query as any);
      sendResponse(res, 200, true, 'Cashiers retrieved successfully', {
        items: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getCashierById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getCashierById(id, tenantId);
      sendResponse(res, 200, true, 'Cashier retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCashier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.updateCashier(id, tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Cashier updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCashierStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const { status } = req.body;
      const result = await this.service.updateCashierStatus(id, tenantId, status, req.user!, req.ip);
      sendResponse(res, 200, true, 'Cashier status updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCashierModules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const { enabledModules } = req.body;
      const result = await this.service.updateCashierModules(id, tenantId, enabledModules, req.user!, req.ip);
      sendResponse(res, 200, true, 'Cashier module access updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  approvePasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.approvePasswordReset(id, tenantId, req.user!, req.ip);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  deleteCashier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteCashier(id, tenantId, req.user!, req.ip);
      sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  };

  getCompanyPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.service.getCompanyPermissions(tenantId);
      sendResponse(res, 200, true, 'Company cashier permissions retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCompanyPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const { permissions } = req.body;
      const result = await this.service.updateCompanyPermissions(tenantId, permissions, req.user!, req.ip);
      sendResponse(res, 200, true, 'Company cashier permissions updated successfully in database', result);
    } catch (error) {
      next(error);
    }
  };
}

export const cashierController = new CashierController();
