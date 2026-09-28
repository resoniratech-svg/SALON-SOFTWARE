import { Request, Response, NextFunction } from 'express';
import { platformService, PlatformService } from './platform.service.js';
import { sendResponse } from '../../utils/api-response.js';

export class PlatformController {
  constructor(private service: PlatformService = platformService) {}

  createCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createCompany(req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Company created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  listCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.listCompanies(query as any);
      sendResponse(res, 200, true, 'Companies retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getCompanyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.getCompanyById(id);
      sendResponse(res, 200, true, 'Company details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.updateCompany(id, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Company updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCompanyStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const { isActive, reason } = req.body;
      const result = await this.service.updateCompanyStatus(id, isActive, reason, req.user!, req.ip);
      const message = isActive ? 'Company activated successfully' : 'Company suspended successfully';
      sendResponse(res, 200, true, message, result);
    } catch (error) {
      next(error);
    }
  };

  updateSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.updateSubscription(id, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Company subscription updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateModules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.updateModules(id, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Company modules updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  renewSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.renewSubscription(id, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Subscription renewed successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateCashierLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const { cashierLimit } = req.body;
      const result = await this.service.updateCashierLimit(id, Number(cashierLimit), req.user!, req.ip);
      sendResponse(res, 200, true, 'Cashier limit updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  createAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.createAdmin(id, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Company admin created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  resetAdminPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const userId = req.body?.userId || (req.params.userId ? String(req.params.userId) : undefined);
      const { temporaryPassword } = req.body;
      const result = await this.service.resetAdminPassword(id, userId, temporaryPassword, req.user!, req.ip);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  getAdminResetRequests = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAdminResetRequests();
      sendResponse(res, 200, true, 'Pending admin reset requests retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  approveAdminReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.params.userId || req.params.id);
      const result = await this.service.approveAdminResetRequest(userId, req.user!, req.ip);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  createSuperAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createSuperAdmin(req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Backup SuperAdmin created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  listSuperAdmins = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listSuperAdmins();
      sendResponse(res, 200, true, 'SuperAdmins retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  startImpersonation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.startImpersonation(id, req.user!, req.ip);
      sendResponse(res, 200, true, 'Impersonation session established', result);
    } catch (error) {
      next(error);
    }
  };

  exitImpersonation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.exitImpersonation(req.user!, req.body?.targetTenantId, req.ip);
      sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  };

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.getAuditLogs(query as any);
      sendResponse(res, 200, true, 'Audit logs retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getMetricsOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getMetricsOverview();
      sendResponse(res, 200, true, 'Platform metrics retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  listAdmins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.params.id ? String(req.params.id) : undefined;
      const result = await this.service.listAdmins(tenantId);
      sendResponse(res, 200, true, 'Admins retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getAdminById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.params.userId);
      const tenantId = req.params.id ? String(req.params.id) : undefined;
      const result = await this.service.getAdminById(userId, tenantId);
      sendResponse(res, 200, true, 'Admin retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.params.userId);
      const tenantId = req.params.id ? String(req.params.id) : undefined;
      const result = await this.service.updateAdmin(userId, req.body, req.user!, tenantId, req.ip);
      sendResponse(res, 200, true, 'Admin updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateAdminStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.params.userId);
      const tenantId = req.params.id ? String(req.params.id) : undefined;
      const result = await this.service.updateAdminStatus(userId, req.body.status, req.user!, tenantId, req.ip);
      const message = req.body.status === 'ACTIVE' ? 'Admin activated successfully' : 'Admin deactivated successfully';
      sendResponse(res, 200, true, message, result);
    } catch (error) {
      next(error);
    }
  };

  listCompanyCashiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.listCompanyCashiers(id);
      sendResponse(res, 200, true, 'Cashiers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getModules = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = this.service.getAvailableModules();
      sendResponse(res, 200, true, 'Available modules retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getSubscriptionHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.service.getCompanySubscriptionHistory(id);
      sendResponse(res, 200, true, 'Subscription history retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getPlans = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = this.service.getSubscriptionPlans();
      sendResponse(res, 200, true, 'Subscription plans retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const platformController = new PlatformController();
