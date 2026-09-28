import { Router } from 'express';
import { serviceController } from './service.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
  serviceQuerySchema,
} from './service.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All service operations require authentication and active SERVICES module
router.use(authenticateJwt);
router.use(requireModule('SERVICES'));

router.get(
  '/',
  requirePermissions('SERVICE:READ'),
  validateQuery(serviceQuerySchema),
  serviceController.list
);

router.post(
  '/',
  requirePermissions('SERVICE:CREATE'),
  validateRequest(createServiceSchema),
  serviceController.create
);

router.get(
  '/:id',
  requirePermissions('SERVICE:READ'),
  serviceController.getById
);

router.put(
  '/:id',
  requirePermissions('SERVICE:UPDATE'),
  validateRequest(updateServiceSchema),
  serviceController.update
);

router.patch(
  '/:id/status',
  requirePermissions('SERVICE:STATUS'),
  validateRequest(updateServiceStatusSchema),
  serviceController.updateStatus
);

router.delete(
  '/:id',
  requirePermissions('SERVICE:MANAGE'),
  serviceController.delete
);

export default router;
