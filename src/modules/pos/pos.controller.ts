import { Request, Response, NextFunction } from 'express';
import { posService, PosService } from './pos.service.js';
import { sendResponse } from '../../utils/api-response.js';
import { BadRequestError } from '../../utils/app-error.js';

export class PosController {
  constructor(private service: PosService = posService) {}

  private getTenantId(req: Request): string {
    const tenantId = (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-impersonate-tenant-id'] as string) ||
      (req.query?.tenantId as string) ||
      ((req as any).validatedQuery?.tenantId as string) ||
      req.body?.tenantId ||
      'fea51c8e-0fd1-4b33-9134-074b90a84534'
    ) as string;
    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }
    return tenantId;
  }

  calculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.calculateOrder(tenantId, req.body);
      sendResponse(res, 200, true, 'Order calculated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.create(tenantId, req.body, req.user);
      sendResponse(res, 201, true, 'POS Order created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = (req as any).validatedQuery || req.query;

      if (query.export === 'csv') {
        const csv = await this.service.exportOrdersCsv(tenantId, query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="pos-orders-export-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        res.status(200).send(csv);
        return;
      }

      const result = await this.service.list(tenantId, query);
      sendResponse(res, 200, true, 'POS Orders retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getById(tenantId, id);
      sendResponse(res, 200, true, 'POS Order retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getByOrderNumber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const orderNumber = String(req.params.orderNumber);
      const result = await this.service.getByOrderNumber(tenantId, orderNumber);
      sendResponse(res, 200, true, 'POS Order retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.updateStatus(tenantId, id, req.body);
      sendResponse(res, 200, true, 'POS Order status updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.update(tenantId, id, req.body, req.user);
      sendResponse(res, 200, true, 'POS Order updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.acceptOrder(tenantId, id);
      sendResponse(res, 200, true, 'Order accepted successfully', result);
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const reason = req.body?.reason || req.body?.notes;
      const result = await this.service.rejectOrder(tenantId, id, reason);
      sendResponse(res, 200, true, 'Order rejected successfully', result);
    } catch (error) {
      next(error);
    }
  };

  complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.complete(tenantId, id);
      sendResponse(res, 200, true, 'Order confirmed and completed successfully', result);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const reason = req.body?.reason || req.body?.notes;
      const result = await this.service.cancel(tenantId, id, reason);
      sendResponse(res, 200, true, 'Order cancelled successfully', result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.delete(tenantId, id);
      sendResponse(res, 200, true, result.message, null);
    } catch (error) {
      next(error);
    }
  };

  getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getInvoice(tenantId, id);

      if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
        const html = this.service.generateInvoiceHtml(result);
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
        return;
      }

      sendResponse(res, 200, true, 'Invoice retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  printInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getInvoice(tenantId, id);
      const html = this.service.generateInvoiceHtml(result);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error) {
      next(error);
    }
  };

  resendInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.resendInvoice(tenantId, id);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  sendWhatsApp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.sendWhatsAppInvoice(tenantId, id);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.getStats(tenantId, query);
      sendResponse(res, 200, true, 'POS Dashboard stats retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getDashboardSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.getDashboardSummary(tenantId, query);
      sendResponse(res, 200, true, 'POS Dashboard summary retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const posController = new PosController();
