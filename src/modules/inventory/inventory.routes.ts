import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// Authentication and Inventory module RBAC check
router.use(authenticateJwt);
router.use(requireModule('INVENTORY'));

// ==========================================
// DASHBOARD
// ==========================================
router.get('/dashboard', inventoryController.getDashboard);

// ==========================================
// VENDORS
// ==========================================
router.get('/vendors', inventoryController.getVendors);
router.post('/vendors', inventoryController.createVendor);
router.get('/vendors/:id', inventoryController.getVendorById);
router.put('/vendors/:id', inventoryController.updateVendor);
router.delete('/vendors/:id', inventoryController.deleteVendor);
router.get('/vendors/:id/items', inventoryController.getVendorItems);
router.post('/vendors/:id/items', inventoryController.setVendorItems);

// ==========================================
// PURCHASE ORDERS
// ==========================================
router.get('/purchase-orders', inventoryController.getPurchaseOrders);
router.post('/purchase-orders', inventoryController.createPurchaseOrder);
router.get('/purchase-orders/:id', inventoryController.getPurchaseOrderById);
router.get('/purchase-orders/:id/print', inventoryController.printPurchaseOrder);
router.put('/purchase-orders/:id', inventoryController.updatePurchaseOrder);
router.delete('/purchase-orders/:id', inventoryController.deletePurchaseOrder);
router.post('/purchase-orders/:id/approve', inventoryController.approvePurchaseOrder);
router.post('/purchase-orders/:id/reject', inventoryController.rejectPurchaseOrder);
router.post('/purchase-orders/:id/cancel', inventoryController.cancelPurchaseOrder);
router.post('/purchase-orders/:id/receive', inventoryController.receivePurchaseOrder);

// ==========================================
// TRANSFER REQUESTS
// ==========================================
router.get('/transfer-requests', inventoryController.getTransferRequests);
router.post('/transfer-requests', inventoryController.createTransferRequest);
router.get('/transfer-requests/:id', inventoryController.getTransferRequestById);
router.put('/transfer-requests/:id', inventoryController.updateTransferRequest);
router.delete('/transfer-requests/:id', inventoryController.deleteTransferRequest);
router.post('/transfer-requests/:id/approve', inventoryController.approveTransferRequest);
router.post('/transfer-requests/:id/reject', inventoryController.rejectTransferRequest);
router.post('/transfer-requests/:id/dispatch', inventoryController.dispatchTransferRequest);
router.post('/transfer-requests/:id/receive', inventoryController.receiveTransferRequest);
router.post('/transfer-requests/:id/cancel', inventoryController.cancelTransferRequest);

// ==========================================
// APPROVALS (CENTRALIZED INBOX)
// ==========================================
router.get('/approvals', inventoryController.getPendingApprovals);

// ==========================================
// STOCK RECONCILIATION
// ==========================================
router.get('/reconciliation/export', inventoryController.exportReconciliation);
router.get('/reconciliation', inventoryController.getReconciliation);
router.post('/reconciliation/adjust', inventoryController.adjustStock);
router.post('/reconciliation/bulk-adjust', inventoryController.bulkAdjustStock);

export default router;
