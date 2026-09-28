import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../../utils/app-error.js';
import {
  bulkReconcileSchema,
  createPurchaseOrderSchema,
  createTransferRequestSchema,
  createVendorSchema,
  poQuerySchema,
  receivePoSchema,
  reconciliationQuerySchema,
  rejectionSchema,
  setVendorItemsSchema,
  singleReconcileSchema,
  trQuerySchema,
  updatePurchaseOrderSchema,
  updateTransferRequestSchema,
  updateVendorSchema,
  vendorQuerySchema,
} from './inventory.dto.js';
import { inventoryService, InventoryService } from './inventory.service.js';

export class InventoryController {
  constructor(private service: InventoryService = inventoryService) {}

  private getTenantId(req: Request): string {
    const tenantId = req.effectiveTenantId || req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestError('Tenant context required');
    }
    return tenantId;
  }

  // ==========================================
  // DASHBOARD
  // ==========================================
  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getDashboard(tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // VENDORS
  // ==========================================
  getVendors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = vendorQuerySchema.parse(req.query);
      const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;
      const data = await this.service.getVendors(tenantId, query.search, isActive, query.page, query.limit);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  getVendorById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.getVendorById(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const body = createVendorSchema.parse(req.body);
      const data = await this.service.createVendor(tenantId, body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = updateVendorSchema.parse(req.body);
      const data = await this.service.updateVendor(tenantId, id, body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      await this.service.deleteVendor(tenantId, id);
      res.status(200).json({ success: true, message: 'Vendor deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  getVendorItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.getVendorItems(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  setVendorItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = setVendorItemsSchema.parse(req.body);
      const data = await this.service.setVendorItems(tenantId, id, body.items);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================
  getPurchaseOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = poQuerySchema.parse(req.query);

      if (query.export === 'csv') {
        const csv = await this.service.exportPurchaseOrdersCsv(tenantId, query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="purchase-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.status(200).send(csv);
        return;
      }

      const data = await this.service.getPurchaseOrders(tenantId, query);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.getPurchaseOrderById(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  printPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const html = await this.service.generatePoHtml(tenantId, id);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error) {
      next(error);
    }
  };

  createPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const body = createPurchaseOrderSchema.parse(req.body);
      const data = await this.service.createPurchaseOrder(tenantId, body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updatePurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = updatePurchaseOrderSchema.parse(req.body);
      const data = await this.service.updatePurchaseOrder(tenantId, id, body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deletePurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      await this.service.deletePurchaseOrder(tenantId, id);
      res.status(200).json({ success: true, message: 'Purchase order deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  approvePurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.approvePurchaseOrder(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  rejectPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = rejectionSchema.parse(req.body);
      const data = await this.service.rejectPurchaseOrder(tenantId, id, body.reason);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  cancelPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const reason = req.body.reason ? String(req.body.reason) : undefined;
      const data = await this.service.cancelPurchaseOrder(tenantId, id, reason);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  receivePurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = receivePoSchema.parse(req.body);
      const data = await this.service.receivePurchaseOrder(tenantId, id, body.items, body.comment);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // TRANSFER REQUESTS
  // ==========================================
  getTransferRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = trQuerySchema.parse(req.query);

      if (query.export === 'csv') {
        const csv = await this.service.exportTransferRequestsCsv(tenantId, query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="transfer-requests-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.status(200).send(csv);
        return;
      }

      const data = await this.service.getTransferRequests(tenantId, query);
      res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  getTransferRequestById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.getTransferRequestById(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      await this.service.deleteTransferRequest(tenantId, id);
      res.status(200).json({ success: true, message: 'Transfer request deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  createTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const body = createTransferRequestSchema.parse(req.body);
      const data = await this.service.createTransferRequest(tenantId, body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = updateTransferRequestSchema.parse(req.body);
      const data = await this.service.updateTransferRequest(tenantId, id, body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  approveTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.approveTransferRequest(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  rejectTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const body = rejectionSchema.parse(req.body);
      const data = await this.service.rejectTransferRequest(tenantId, id, body.reason);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  dispatchTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.dispatchTransferRequest(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  receiveTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const data = await this.service.receiveTransferRequest(tenantId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  cancelTransferRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const reason = req.body.reason ? String(req.body.reason) : undefined;
      const data = await this.service.cancelTransferRequest(tenantId, id, reason);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // APPROVALS (CENTRALIZED INBOX)
  // ==========================================
  getPendingApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getPendingApprovals(tenantId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // STOCK RECONCILIATION
  // ==========================================
  getReconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = reconciliationQuerySchema.parse(req.query);
      const data = await this.service.getReconciliationItems(tenantId, query.search, query.categoryId, query.type);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const body = singleReconcileSchema.parse(req.body);
      const staffId = req.user?.id;
      const data = await this.service.adjustItemStock(tenantId, body, staffId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  bulkAdjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const body = bulkReconcileSchema.parse(req.body);
      const staffId = req.user?.id;
      const data = await this.service.bulkAdjustStock(tenantId, body.items, staffId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  exportReconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = reconciliationQuerySchema.parse(req.query);
      const csv = await this.service.exportReconciliationCsv(tenantId, query.search, query.categoryId, query.type);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="stock-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };
}

export const inventoryController = new InventoryController();
