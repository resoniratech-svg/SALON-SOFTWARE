import { prisma } from '../../config/database.js';
import { BadRequestError, NotFoundError } from '../../utils/app-error.js';
import {
  CreatePurchaseOrderInput,
  CreateTransferRequestInput,
  CreateVendorInput,
  SingleReconcileInput,
  UpdatePurchaseOrderInput,
  UpdateTransferRequestInput,
  UpdateVendorInput,
} from './inventory.dto.js';
import { inventoryRepository, InventoryRepository } from './inventory.repository.js';

export class InventoryService {
  constructor(private repo: InventoryRepository = inventoryRepository) {}

  // ==========================================
  // DASHBOARD
  // ==========================================
  async getDashboard(tenantId: string) {
    return this.repo.getDashboardStats(tenantId);
  }

  // ==========================================
  // VENDORS
  // ==========================================
  async getVendors(tenantId: string, search?: string, isActive?: boolean, page = 1, limit = 50) {
    return this.repo.getVendors(tenantId, search, isActive, page, limit);
  }

  async getVendorById(tenantId: string, id: string) {
    const vendor = await this.repo.getVendorById(tenantId, id);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    return vendor;
  }

  async createVendor(tenantId: string, data: CreateVendorInput) {
    const existing = await this.repo.getVendorByFirmName(tenantId, data.firmName);
    if (existing) {
      throw new BadRequestError(`A vendor with firm name "${data.firmName}" already exists`);
    }
    if (data.mobile) {
      const existingMobile = await this.repo.getVendorByMobile(tenantId, data.mobile);
      if (existingMobile) {
        throw new BadRequestError(`A vendor with mobile number "${data.mobile}" already exists`);
      }
    }
    if (data.email) {
      const existingEmail = await this.repo.getVendorByEmail(tenantId, data.email);
      if (existingEmail) {
        throw new BadRequestError(`A vendor with email "${data.email}" already exists`);
      }
    }
    return this.repo.createVendor(tenantId, data);
  }

  async updateVendor(tenantId: string, id: string, data: UpdateVendorInput) {
    const vendor = await this.repo.getVendorById(tenantId, id);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    if (data.firmName && data.firmName.trim().toLowerCase() !== vendor.firmName.toLowerCase()) {
      const existing = await this.repo.getVendorByFirmName(tenantId, data.firmName);
      if (existing && existing.id !== id) {
        throw new BadRequestError(`A vendor with firm name "${data.firmName}" already exists`);
      }
    }
    if (data.mobile && data.mobile.trim() !== vendor.mobile) {
      const existingMobile = await this.repo.getVendorByMobile(tenantId, data.mobile);
      if (existingMobile && existingMobile.id !== id) {
        throw new BadRequestError(`A vendor with mobile number "${data.mobile}" already exists`);
      }
    }
    if (data.email && data.email.trim().toLowerCase() !== (vendor.email || '').toLowerCase()) {
      const existingEmail = await this.repo.getVendorByEmail(tenantId, data.email);
      if (existingEmail && existingEmail.id !== id) {
        throw new BadRequestError(`A vendor with email "${data.email}" already exists`);
      }
    }
    return this.repo.updateVendor(tenantId, id, data);
  }

  async deleteVendor(tenantId: string, id: string) {
    const vendor = await this.repo.getVendorById(tenantId, id);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    if (vendor.purchaseOrders && vendor.purchaseOrders.length > 0) {
      throw new BadRequestError('Cannot delete vendor with existing purchase orders. Deactivate the vendor instead.');
    }
    return this.repo.deleteVendor(tenantId, id);
  }

  async setVendorItems(tenantId: string, vendorId: string, items: Array<{ productId?: string | null; disposableId?: string | null; price: number }>) {
    const vendor = await this.repo.getVendorById(tenantId, vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    return this.repo.setVendorItems(tenantId, vendorId, items);
  }

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================
  async getPurchaseOrders(
    tenantId: string,
    filters: {
      from?: string;
      to?: string;
      status?: string;
      search?: string;
      vendorId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    return this.repo.getPurchaseOrders(tenantId, filters);
  }

  async getPurchaseOrderById(tenantId: string, id: string) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    return po;
  }

  async createPurchaseOrder(tenantId: string, data: CreatePurchaseOrderInput) {
    const vendor = await this.repo.getVendorById(tenantId, data.vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    if (!vendor.isActive) {
      throw new BadRequestError('Cannot create purchase order for an inactive vendor');
    }
    if (!data.items || data.items.length === 0) {
      throw new BadRequestError('Purchase order must contain at least one item');
    }
    const productIds = data.items.map((it) => it.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestError('Duplicate item selection in purchase order is not allowed');
    }
    return this.repo.createPurchaseOrder(tenantId, data);
  }

  async updatePurchaseOrder(tenantId: string, id: string, data: UpdatePurchaseOrderInput) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'PLACED') {
      throw new BadRequestError(`Cannot edit a purchase order in ${po.status} status`);
    }
    if (data.vendorId) {
      const vendor = await this.repo.getVendorById(tenantId, data.vendorId);
      if (!vendor) {
        throw new NotFoundError('Vendor not found');
      }
    }
    if (data.items && data.items.length > 0) {
      const productIds = data.items.map((it) => it.productId);
      if (new Set(productIds).size !== productIds.length) {
        throw new BadRequestError('Duplicate item selection in purchase order is not allowed');
      }
    }
    return this.repo.updatePurchaseOrder(tenantId, id, data);
  }

  async approvePurchaseOrder(tenantId: string, id: string) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'PLACED') {
      throw new BadRequestError(`Only PLACED purchase orders can be approved (current: ${po.status})`);
    }
    return this.repo.updatePoStatus(tenantId, id, 'APPROVED');
  }

  async rejectPurchaseOrder(tenantId: string, id: string, reason: string) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'PLACED') {
      throw new BadRequestError(`Only PLACED purchase orders can be rejected (current: ${po.status})`);
    }
    return this.repo.updatePoStatus(tenantId, id, 'REJECTED', reason);
  }

  async cancelPurchaseOrder(tenantId: string, id: string, reason?: string) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status === 'SETTLED' || po.status === 'PARTIAL_SETTLED') {
      throw new BadRequestError('Cannot cancel a received/settled purchase order');
    }
    return this.repo.updatePoStatus(tenantId, id, 'CANCELLED', reason);
  }

  async receivePurchaseOrder(tenantId: string, id: string, receivedItems?: Array<{ itemId: string; receivedQty: number }>, comment?: string) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status !== 'APPROVED' && po.status !== 'PARTIAL_SETTLED') {
      throw new BadRequestError(`Purchase order must be APPROVED or PARTIAL_SETTLED before receiving stock (current: ${po.status})`);
    }
    return this.repo.receivePurchaseOrder(tenantId, id, receivedItems, comment);
  }

  // ==========================================
  // TRANSFER REQUESTS
  // ==========================================
  async getTransferRequests(
    tenantId: string,
    filters: {
      from?: string;
      to?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    return this.repo.getTransferRequests(tenantId, filters);
  }

  async getTransferRequestById(tenantId: string, id: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    return tr;
  }

  async createTransferRequest(tenantId: string, data: CreateTransferRequestInput, requestor = 'kalyaninagar') {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestError('Transfer request must contain at least one item');
    }
    const targetRequestor = (data.requestor || requestor).trim().toLowerCase();
    if (data.sender.trim().toLowerCase() === targetRequestor) {
      throw new BadRequestError('Source (sender) and destination (requestor) locations cannot be the same');
    }
    const productIds = data.items.map((it) => it.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestError('Duplicate item selection in transfer request is not allowed');
    }
    // Verify stock availability
    for (const it of data.items) {
      const product = await prisma.product.findFirst({
        where: { tenantId, id: it.productId },
        include: { stockTransactions: true },
      });
      if (!product) {
        throw new NotFoundError(`Product not found: ${it.productId}`);
      }
      let inward = 0;
      let outward = 0;
      for (const t of product.stockTransactions) {
        if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += Number(t.quantity);
        else outward += Number(t.quantity);
      }
      const inStock = Math.max(0, inward - outward);
      if (it.requestedQty > inStock) {
        throw new BadRequestError(
          `Requested quantity (${it.requestedQty}) exceeds available stock (${inStock}) for "${product.name}"`
        );
      }
    }
    return this.repo.createTransferRequest(tenantId, data, requestor);
  }

  async updateTransferRequest(tenantId: string, id: string, data: UpdateTransferRequestInput) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status !== 'REQUESTED') {
      throw new BadRequestError(`Cannot edit a transfer request in ${tr.status} status`);
    }
    if (data.sender && data.sender.trim().toLowerCase() === tr.requestor.toLowerCase()) {
      throw new BadRequestError('Source (sender) and destination (requestor) locations cannot be the same');
    }
    if (data.items && data.items.length > 0) {
      const productIds = data.items.map((it) => it.productId);
      if (new Set(productIds).size !== productIds.length) {
        throw new BadRequestError('Duplicate item selection in transfer request is not allowed');
      }
      for (const it of data.items) {
        const product = await prisma.product.findFirst({
          where: { tenantId, id: it.productId },
          include: { stockTransactions: true },
        });
        if (!product) {
          throw new NotFoundError(`Product not found: ${it.productId}`);
        }
        let inward = 0;
        let outward = 0;
        for (const t of product.stockTransactions) {
          if (t.type === 'INWARD' || t.type === 'RECONCILED') inward += Number(t.quantity);
          else outward += Number(t.quantity);
        }
        const inStock = Math.max(0, inward - outward);
        if (it.requestedQty > inStock) {
          throw new BadRequestError(
            `Requested quantity (${it.requestedQty}) exceeds available stock (${inStock}) for "${product.name}"`
          );
        }
      }
    }
    return this.repo.updateTransferRequest(tenantId, id, data);
  }

  async approveTransferRequest(tenantId: string, id: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status !== 'REQUESTED') {
      throw new BadRequestError(`Only REQUESTED transfer requests can be approved (current: ${tr.status})`);
    }
    return this.repo.updateTrStatus(tenantId, id, 'APPROVED');
  }

  async rejectTransferRequest(tenantId: string, id: string, reason: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status !== 'REQUESTED') {
      throw new BadRequestError(`Only REQUESTED transfer requests can be rejected (current: ${tr.status})`);
    }
    return this.repo.updateTrStatus(tenantId, id, 'REJECTED', reason);
  }

  async dispatchTransferRequest(tenantId: string, id: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status !== 'APPROVED') {
      throw new BadRequestError(`Only APPROVED transfer requests can be dispatched (current: ${tr.status})`);
    }
    return this.repo.updateTrStatus(tenantId, id, 'DISPATCHED');
  }

  async receiveTransferRequest(tenantId: string, id: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status !== 'DISPATCHED') {
      throw new BadRequestError(`Only DISPATCHED transfer requests can be received (current: ${tr.status})`);
    }
    return this.repo.receiveTransferRequest(tenantId, id);
  }

  async cancelTransferRequest(tenantId: string, id: string, reason?: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status === 'RECEIVED') {
      throw new BadRequestError('Cannot cancel an already received transfer request');
    }
    return this.repo.updateTrStatus(tenantId, id, 'CANCELLED', reason);
  }

  // ==========================================
  // APPROVALS (CENTRALIZED INBOX)
  // ==========================================
  async getPendingApprovals(tenantId: string) {
    return this.repo.getPendingApprovals(tenantId);
  }

  // ==========================================
  // STOCK RECONCILIATION
  // ==========================================
  async getReconciliationItems(tenantId: string, search?: string, categoryId?: string, type = 'ALL') {
    return this.repo.getReconciliationItems(tenantId, search, categoryId, type);
  }

  async adjustItemStock(tenantId: string, input: SingleReconcileInput, staffId?: string) {
    if (!input.remark || !input.remark.trim()) {
      throw new BadRequestError('A remark is required for stock reconciliation adjustment');
    }
    return this.repo.adjustItemStock(tenantId, input, staffId);
  }

  async bulkAdjustStock(tenantId: string, items: SingleReconcileInput[], staffId?: string) {
    for (const item of items) {
      if (!item.remark || !item.remark.trim()) {
        throw new BadRequestError('A remark is required for all items in bulk reconciliation');
      }
    }
    return this.repo.bulkAdjustStock(tenantId, items, staffId);
  }

  async exportReconciliationCsv(tenantId: string, search?: string, categoryId?: string, type = 'ALL'): Promise<string> {
    const items = await this.repo.getReconciliationItems(tenantId, search, categoryId, type);

    const headers = [
      'Category Name',
      'Item Name',
      'Type',
      'Actual Stock',
      'Adjust Stock',
      'Stock Difference',
      'Stock Value',
      'Actual Consumable',
      'Adjust Consumable',
      'Unit',
      'Consumable Difference',
      'Remark',
    ];

    const escapeCsv = (str: any) => {
      const stringValue = str === null || str === undefined ? '' : String(str);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = items.map((it) => [
      escapeCsv(it.categoryName),
      escapeCsv(it.itemName),
      escapeCsv(it.type),
      escapeCsv(it.actualStock),
      escapeCsv(it.adjustStock),
      escapeCsv(it.stockDifference),
      escapeCsv(it.stockValue),
      escapeCsv(it.actualConsumable),
      escapeCsv(it.adjustConsumable),
      escapeCsv(it.unit),
      escapeCsv(it.consumableDifference),
      escapeCsv(it.remark),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ==========================================
  // VENDOR ITEMS
  // ==========================================
  async getVendorItems(tenantId: string, vendorId: string) {
    const vendor = await this.repo.getVendorById(tenantId, vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    return this.repo.getVendorItems(tenantId, vendorId);
  }

  // ==========================================
  // DELETIONS
  // ==========================================
  async deletePurchaseOrder(tenantId: string, id: string) {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    if (po.status === 'SETTLED' || po.status === 'PARTIAL_SETTLED') {
      throw new BadRequestError('Cannot delete a settled or partially settled purchase order as stock has already been received');
    }
    return this.repo.deletePurchaseOrder(tenantId, id);
  }

  async deleteTransferRequest(tenantId: string, id: string) {
    const tr = await this.repo.getTransferRequestById(tenantId, id);
    if (!tr) {
      throw new NotFoundError('Transfer request not found');
    }
    if (tr.status === 'RECEIVED' || tr.status === 'DISPATCHED') {
      throw new BadRequestError('Cannot delete a dispatched or received transfer request as stock movement has already occurred');
    }
    return this.repo.deleteTransferRequest(tenantId, id);
  }

  // ==========================================
  // CSV EXPORTS (PO & TR)
  // ==========================================
  async exportPurchaseOrdersCsv(tenantId: string, filters: any): Promise<string> {
    const result = await this.repo.getPurchaseOrders(tenantId, { ...filters, limit: 10000 });
    const headers = [
      'PO Number',
      'Vendor Firm',
      'Vendor Contact',
      'PO Date',
      'Expected Date',
      'Status',
      'Total Items',
      'Total Value',
      'Comment',
    ];

    const escapeCsv = (str: any) => {
      const stringValue = str === null || str === undefined ? '' : String(str);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = result.orders.map((po: any) => [
      escapeCsv(po.poNumber),
      escapeCsv(po.vendor?.firmName),
      escapeCsv(po.vendor?.mobile),
      escapeCsv(po.poDate ? new Date(po.poDate).toISOString().slice(0, 10) : ''),
      escapeCsv(po.expectedDate ? new Date(po.expectedDate).toISOString().slice(0, 10) : ''),
      escapeCsv(po.status),
      escapeCsv(po.totalItems),
      escapeCsv(Number(po.totalValue).toFixed(2)),
      escapeCsv(po.comment || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async exportTransferRequestsCsv(tenantId: string, filters: any): Promise<string> {
    const result = await this.repo.getTransferRequests(tenantId, { ...filters, limit: 10000 });
    const headers = [
      'TR Number',
      'Sender Store',
      'Requestor Store',
      'Request Date',
      'Expected Date',
      'Status',
      'Total Items',
      'Total Value',
      'Comment',
    ];

    const escapeCsv = (str: any) => {
      const stringValue = str === null || str === undefined ? '' : String(str);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = result.requests.map((tr: any) => [
      escapeCsv(tr.trNumber),
      escapeCsv(tr.sender),
      escapeCsv(tr.requestor),
      escapeCsv(tr.createdAt ? new Date(tr.createdAt).toISOString().slice(0, 10) : ''),
      escapeCsv(tr.expectedDate ? new Date(tr.expectedDate).toISOString().slice(0, 10) : ''),
      escapeCsv(tr.status),
      escapeCsv(tr.totalItems),
      escapeCsv(Number(tr.totalValue).toFixed(2)),
      escapeCsv(tr.comment || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ==========================================
  // PRINTABLE PURCHASE ORDER HTML
  // ==========================================
  async generatePoHtml(tenantId: string, id: string): Promise<string> {
    const po = await this.repo.getPurchaseOrderById(tenantId, id);
    if (!po) {
      throw new NotFoundError('Purchase order not found');
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    const poDateStr = po.poDate ? new Date(po.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const expDateStr = po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

    const itemRows = po.items
      .map(
        (it: any, idx: number) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${it.itemName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.inStock}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${it.requiredQty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${Number(it.price).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.servicesPercent || 0}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${Number(it.servicesAmount || 0).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${Number(it.totalValue).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order - ${po.poNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px; color: #1e293b; background: #fff; }
    .po-box { max-width: 850px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header-table { width: 100%; margin-bottom: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 16px; }
    .title { font-size: 24px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 1px; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: #e0e7ff; color: #4338ca; }
    .section-grid { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px; }
    .info-card { flex: 1; background: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .info-card h4 { margin: 0 0 10px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-card p { margin: 4px 0; font-size: 13px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table.data-table th { background: #f1f5f9; padding: 10px; font-size: 12px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    .total-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .total-table { width: 300px; border-collapse: collapse; }
    .total-table td { padding: 8px 12px; }
    .total-row { font-size: 16px; font-weight: 800; color: #4338ca; border-top: 2px solid #cbd5e1; }
    .signatures { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 16px; }
    .sig-line { width: 200px; border-top: 1px solid #94a3b8; text-align: center; font-size: 12px; color: #64748b; padding-top: 6px; }
    @media print {
      body { padding: 0; }
      .po-box { border: none; box-shadow: none; padding: 0; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="po-box">
    <table class="header-table">
      <tr>
        <td>
          <div class="title">${tenant?.name?.trim() ? tenant.name : (tenant?.code || 'Salon Procurement')}</div>
          ${tenant?.address ? `<div class="subtitle">${tenant.address}</div>` : ''}
          ${tenant?.contactEmail || tenant?.contactPhone ? `<div class="subtitle">Contact: ${tenant?.contactEmail || 'N/A'} | Phone: ${tenant?.contactPhone || 'N/A'}</div>` : ''}
        </td>
        <td style="text-align: right; vertical-align: top;">
          <span class="badge">${po.status}</span>
          <div style="font-size: 18px; font-weight: 800; color: #1e293b; margin-top: 8px;">${po.poNumber}</div>
        </td>
      </tr>
    </table>

    <div class="section-grid">
      <div class="info-card">
        <h4>Vendor Details</h4>
        <p><strong>Firm:</strong> ${po.vendor.firmName}</p>
        <p><strong>Contact Person:</strong> ${po.vendor.vendorName}</p>
        <p><strong>Mobile:</strong> ${po.vendor.mobile}</p>
        ${po.vendor.email ? `<p><strong>Email:</strong> ${po.vendor.email}</p>` : ''}
        ${po.vendor.gstNumber ? `<p><strong>GSTIN:</strong> ${po.vendor.gstNumber}</p>` : ''}
        <p><strong>City:</strong> ${po.vendor.city}</p>
      </div>
      <div class="info-card">
        <h4>Order Summary</h4>
        <p><strong>PO Date:</strong> ${poDateStr}</p>
        <p><strong>Expected Delivery:</strong> ${expDateStr}</p>
        <p><strong>Total Items:</strong> ${po.totalItems} Units</p>
        ${po.comment ? `<p><strong>Notes:</strong> ${po.comment}</p>` : ''}
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th style="text-align: left;">Item Description</th>
          <th>In Stock</th>
          <th>Req Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th>Srv %</th>
          <th style="text-align: right;">Srv Amt</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="total-section">
      <table class="total-table">
        <tr>
          <td>Total Quantity:</td>
          <td style="text-align: right; font-weight: 600;">${po.totalItems}</td>
        </tr>
        <tr class="total-row">
          <td>Grand Total:</td>
          <td style="text-align: right;">₹${Number(po.totalValue).toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div class="signatures">
      <div class="sig-line">Prepared By (Store Manager)</div>
      <div class="sig-line">Authorized Signatory</div>
      <div class="sig-line">Vendor Acceptance</div>
    </div>
  </div>
</body>
</html>`;
  }
}

export const inventoryService = new InventoryService();
