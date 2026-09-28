import { Router } from 'express';
import { productCategoryController } from './product-category.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createProductCategorySchema,
  updateProductCategorySchema,
  updateProductCategoryStatusSchema,
  productCategoryQuerySchema,
} from './product-category.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All product-category operations require authentication and active PRODUCTS module
router.use(authenticateJwt);
router.use(requireModule('PRODUCTS'));

router.get(
  '/',
  requirePermissions('PRODUCT_CATEGORY:READ'),
  validateQuery(productCategoryQuerySchema),
  productCategoryController.list
);

router.post(
  '/',
  requirePermissions('PRODUCT_CATEGORY:CREATE'),
  validateRequest(createProductCategorySchema),
  productCategoryController.create
);

router.get(
  '/:id',
  requirePermissions('PRODUCT_CATEGORY:READ'),
  productCategoryController.getById
);

router.put(
  '/:id',
  requirePermissions('PRODUCT_CATEGORY:UPDATE'),
  validateRequest(updateProductCategorySchema),
  productCategoryController.update
);

router.patch(
  '/:id/status',
  requirePermissions('PRODUCT_CATEGORY:STATUS'),
  validateRequest(updateProductCategoryStatusSchema),
  productCategoryController.updateStatus
);

router.delete(
  '/:id',
  requirePermissions('PRODUCT_CATEGORY:DELETE'),
  productCategoryController.delete
);

export default router;
