import { Router } from 'express';
import { serviceCategoryController } from './service-category.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  updateCategoryStatusSchema,
  serviceCategoryQuerySchema,
} from './service-category.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All service-category operations require authentication and active SERVICES module
router.use(authenticateJwt);
router.use(requireModule('SERVICES'));

router.get(
  '/',
  requirePermissions('SERVICE_CATEGORY:READ'),
  validateQuery(serviceCategoryQuerySchema),
  serviceCategoryController.list
);

router.post(
  '/',
  requirePermissions('SERVICE_CATEGORY:CREATE'),
  validateRequest(createServiceCategorySchema),
  serviceCategoryController.create
);

router.get(
  '/:id',
  requirePermissions('SERVICE_CATEGORY:READ'),
  serviceCategoryController.getById
);

router.put(
  '/:id',
  requirePermissions('SERVICE_CATEGORY:UPDATE'),
  validateRequest(updateServiceCategorySchema),
  serviceCategoryController.update
);

router.patch(
  '/:id/status',
  requirePermissions('SERVICE_CATEGORY:STATUS'),
  validateRequest(updateCategoryStatusSchema),
  serviceCategoryController.updateStatus
);

router.delete(
  '/:id',
  requirePermissions('SERVICE_CATEGORY:DELETE'),
  serviceCategoryController.delete
);

export default router;
