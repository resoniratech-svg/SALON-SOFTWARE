import { Router } from 'express';
import { resourceController } from './resource.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createResourceSchema,
  updateResourceSchema,
  updateResourceStatusSchema,
  resourceQuerySchema,
} from './resource.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All resource endpoints require valid authentication and active RESOURCES module
router.use(authenticateJwt);
router.use(requireModule('RESOURCES'));

router.get(
  '/',
  requirePermissions('RESOURCE:READ'),
  validateQuery(resourceQuerySchema),
  resourceController.list
);

router.post(
  '/',
  requirePermissions('RESOURCE:CREATE'),
  validateRequest(createResourceSchema),
  resourceController.create
);

router.get(
  '/:id',
  requirePermissions('RESOURCE:READ'),
  resourceController.getById
);

router.put(
  '/:id',
  requirePermissions('RESOURCE:UPDATE'),
  validateRequest(updateResourceSchema),
  resourceController.update
);

router.patch(
  '/:id/status',
  requirePermissions('RESOURCE:STATUS'),
  validateRequest(updateResourceStatusSchema),
  resourceController.updateStatus
);

router.delete(
  '/:id',
  requirePermissions('RESOURCE:DELETE'),
  resourceController.delete
);

export default router;
