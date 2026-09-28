import { Router } from 'express';
import { disposableController } from './disposable.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createDisposableSchema,
  updateDisposableSchema,
  updateDisposableStatusSchema,
  disposableQuerySchema,
} from './disposable.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All disposable operations require authentication and active DISPOSABLES module
router.use(authenticateJwt);
router.use(requireModule('DISPOSABLES'));

router.get(
  '/',
  requirePermissions('DISPOSABLE:READ'),
  validateQuery(disposableQuerySchema),
  disposableController.list
);

router.post(
  '/',
  requirePermissions('DISPOSABLE:CREATE'),
  validateRequest(createDisposableSchema),
  disposableController.create
);

router.get(
  '/generate-barcode',
  requirePermissions('DISPOSABLE:READ'),
  disposableController.generateBarcode
);

router.get(
  '/:id',
  requirePermissions('DISPOSABLE:READ'),
  disposableController.getById
);

router.put(
  '/:id',
  requirePermissions('DISPOSABLE:UPDATE'),
  validateRequest(updateDisposableSchema),
  disposableController.update
);

router.patch(
  '/:id/status',
  requirePermissions('DISPOSABLE:STATUS'),
  validateRequest(updateDisposableStatusSchema),
  disposableController.updateStatus
);

router.delete(
  '/:id',
  requirePermissions('DISPOSABLE:DELETE'),
  disposableController.delete
);

export default router;
