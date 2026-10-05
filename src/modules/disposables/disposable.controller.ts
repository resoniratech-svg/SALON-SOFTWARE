import { Request, Response, NextFunction } from 'express';
import { disposableService, DisposableService } from './disposable.service.js';
import { sendResponse } from '../../utils/api-response.js';

export class DisposableController {
  constructor(private service: DisposableService = disposableService) {}

  private resolveTenantId(req: Request): string {
    return (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.query?.tenantId as string) ||
      ((req as any).validatedQuery?.tenantId as string) ||
      req.body?.tenantId
    ) as string;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.service.create(tenantId, req.body);
      sendResponse(res, 201, true, 'Disposable created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.list(tenantId, query);
      sendResponse(res, 200, true, 'Disposables retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getById(tenantId, id);
      sendResponse(res, 200, true, 'Disposable retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.update(tenantId, id, req.body);
      sendResponse(res, 200, true, 'Disposable updated successfully', result);
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
      sendResponse(
        res,
        200,
        true,
        `Disposable marked as ${isActive ? 'active' : 'inactive'}`,
        result
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = String(req.params.id);
      await this.service.delete(tenantId, id);
      sendResponse(res, 200, true, 'Disposable deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  generateBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.resolveTenantId(req);
      const barcode = await this.service.generateBarcode(tenantId);
      sendResponse(res, 200, true, 'Barcode generated successfully', { barcode });
    } catch (error) {
      next(error);
    }
  };
}

export const disposableController = new DisposableController();
