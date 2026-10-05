import { Router } from 'express';
import { cashierController } from './cashier.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/authorization.middleware.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createCashierSchema,
  updateCashierSchema,
  updateCashierStatusSchema,
  updateCashierModulesSchema,
  cashierQuerySchema,
} from './cashier.validation.js';

const router = Router();

// All Cashier management endpoints require authentication
router.use(authenticateJwt);

// Company-level Cashier permissions
router.get(
  '/permissions',
  requireRoles('ADMIN', 'SUPERADMIN', 'CASHIER'),
  cashierController.getCompanyPermissions
);

router.put(
  '/permissions',
  requireRoles('ADMIN', 'SUPERADMIN'),
  cashierController.updateCompanyPermissions
);

// All other Cashier management endpoints require ADMIN or SUPERADMIN
router.use(requireRoles('ADMIN', 'SUPERADMIN'));

router.post(
  '/',
  validateRequest(createCashierSchema),
  cashierController.createCashier
);

router.get(
  '/',
  validateQuery(cashierQuerySchema),
  cashierController.getCashiers
);

router.get(
  '/:id',
  cashierController.getCashierById
);

router.put(
  '/:id',
  validateRequest(updateCashierSchema),
  cashierController.updateCashier
);

router.patch(
  '/:id/status',
  validateRequest(updateCashierStatusSchema),
  cashierController.updateCashierStatus
);

router.patch(
  '/:id/modules',
  validateRequest(updateCashierModulesSchema),
  cashierController.updateCashierModules
);

router.post(
  '/:id/approve-reset',
  cashierController.approvePasswordReset
);

router.delete(
  '/:id',
  cashierController.deleteCashier
);

export default router;
