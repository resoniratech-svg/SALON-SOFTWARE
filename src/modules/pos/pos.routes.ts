import { Router } from 'express';
import { posController } from './pos.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createPosOrderSchema,
  calculateOrderSchema,
  posOrderQuerySchema,
  updatePosOrderStatusSchema,
  updatePosOrderSchema,
  cancelOrderSchema,
  rejectOrderSchema,
  posStatsQuerySchema,
  posDashboardSummaryQuerySchema,
} from './pos.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All POS endpoints require authentication and POS module enabled
router.use(authenticateJwt);
router.use(requireModule('POS'));

// 1. Calculate Order Checkout (Dynamic Cart Calculation - Admin & Cashier)
router.post(
  '/calculate',
  requirePermissions('POS:READ', 'POS:CREATE'),
  validateRequest(calculateOrderSchema),
  posController.calculate
);
router.post(
  '/orders/calculate',
  requirePermissions('POS:READ', 'POS:CREATE'),
  validateRequest(calculateOrderSchema),
  posController.calculate
);

// 2. POS Dashboard Summary / Status Counts (New, Accepted, Rejected, Completed, Total)
router.get(
  '/dashboard/summary',
  requirePermissions('POS:READ'),
  validateQuery(posDashboardSummaryQuerySchema),
  posController.getDashboardSummary
);
router.get(
  '/orders/summary',
  requirePermissions('POS:READ'),
  validateQuery(posDashboardSummaryQuerySchema),
  posController.getDashboardSummary
);

// 3. POS Dashboard Stats (Admin & Cashier)
router.get(
  '/stats',
  requirePermissions('POS:READ'),
  validateQuery(posStatsQuerySchema),
  posController.getStats
);

// 3. Create POS Order / Quick Sale Checkout (Admin & Cashier)
router.post(
  '/',
  requirePermissions('POS:CREATE'),
  validateRequest(createPosOrderSchema),
  posController.create
);
router.post(
  '/orders',
  requirePermissions('POS:CREATE'),
  validateRequest(createPosOrderSchema),
  posController.create
);

// 4. List / Search / Filter POS Orders (Admin & Cashier)
router.get(
  '/',
  requirePermissions('POS:READ'),
  validateQuery(posOrderQuerySchema),
  posController.list
);
router.get(
  '/orders',
  requirePermissions('POS:READ'),
  validateQuery(posOrderQuerySchema),
  posController.list
);

// 5. Get Order by Order Number (Admin & Cashier)
router.get(
  '/orders/number/:orderNumber',
  requirePermissions('POS:READ'),
  posController.getByOrderNumber
);

// 6. Get Order Details by ID (Admin & Cashier)
router.get(
  '/orders/:id',
  requirePermissions('POS:READ'),
  posController.getById
);
router.get(
  '/:id',
  requirePermissions('POS:READ'),
  posController.getById
);

// 7. Get Formatted Invoice / Bill (Admin & Cashier)
router.get(
  '/orders/:id/invoice',
  requirePermissions('POS:READ'),
  posController.getInvoice
);
router.get(
  '/:id/invoice',
  requirePermissions('POS:READ'),
  posController.getInvoice
);
router.get(
  '/orders/:id/print',
  requirePermissions('POS:READ'),
  posController.printInvoice
);
router.get(
  '/:id/print',
  requirePermissions('POS:READ'),
  posController.printInvoice
);
router.get(
  '/orders/:id/invoice/print',
  requirePermissions('POS:READ'),
  posController.printInvoice
);

// 8. Resend Invoice (Admin & Cashier)
router.post(
  '/orders/:id/resend',
  requirePermissions('POS:CREATE'),
  posController.resendInvoice
);
router.post(
  '/:id/resend',
  requirePermissions('POS:CREATE'),
  posController.resendInvoice
);

// 9. Send WhatsApp Invoice (Admin & Cashier)
router.post(
  '/orders/:id/whatsapp',
  requirePermissions('POS:CREATE'),
  posController.sendWhatsApp
);
router.post(
  '/:id/whatsapp',
  requirePermissions('POS:CREATE'),
  posController.sendWhatsApp
);

// 10. Update Order Status (Admin & Cashier)
router.patch(
  '/orders/:id/status',
  requirePermissions('POS:UPDATE'),
  validateRequest(updatePosOrderStatusSchema),
  posController.updateStatus
);
router.patch(
  '/:id/status',
  requirePermissions('POS:UPDATE'),
  validateRequest(updatePosOrderStatusSchema),
  posController.updateStatus
);

// 11. Full Edit / Update POS Order (Admin & Cashier)
router.put(
  '/orders/:id',
  requirePermissions('POS:UPDATE'),
  validateRequest(updatePosOrderSchema),
  posController.update
);
router.put(
  '/:id',
  requirePermissions('POS:UPDATE'),
  validateRequest(updatePosOrderSchema),
  posController.update
);

// 12. Accept Order (Admin & Cashier)
router.post(
  '/orders/:id/accept',
  requirePermissions('POS:UPDATE'),
  posController.accept
);
router.post(
  '/:id/accept',
  requirePermissions('POS:UPDATE'),
  posController.accept
);

// 13. Reject Order (Admin & Cashier)
router.post(
  '/orders/:id/reject',
  requirePermissions('POS:UPDATE'),
  validateRequest(rejectOrderSchema),
  posController.reject
);
router.post(
  '/:id/reject',
  requirePermissions('POS:UPDATE'),
  validateRequest(rejectOrderSchema),
  posController.reject
);

// 14. Complete Order (Admin & Cashier)
router.post(
  '/orders/:id/complete',
  requirePermissions('POS:UPDATE'),
  posController.complete
);
router.post(
  '/:id/complete',
  requirePermissions('POS:UPDATE'),
  posController.complete
);

// 13. Cancel Order (Admin & Cashier)
router.post(
  '/orders/:id/cancel',
  requirePermissions('POS:UPDATE'),
  validateRequest(cancelOrderSchema),
  posController.cancel
);
router.post(
  '/:id/cancel',
  requirePermissions('POS:UPDATE'),
  validateRequest(cancelOrderSchema),
  posController.cancel
);

// 14. Delete / Void POS Order (Admin Only)
router.delete(
  '/orders/:id',
  requirePermissions('POS:DELETE'),
  posController.delete
);
router.delete(
  '/:id',
  requirePermissions('POS:DELETE'),
  posController.delete
);

export default router;
