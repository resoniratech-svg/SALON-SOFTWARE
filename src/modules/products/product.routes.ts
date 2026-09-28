import { Router } from 'express';
import { productController } from './product.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  productQuerySchema,
} from './product.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All product operations require authentication and active PRODUCTS module
router.use(authenticateJwt);
router.use(requireModule('PRODUCTS'));

router.get(
  '/',
  requirePermissions('PRODUCT:READ'),
  validateQuery(productQuerySchema),
  productController.list
);

router.post(
  '/',
  requirePermissions('PRODUCT:CREATE'),
  validateRequest(createProductSchema),
  productController.create
);

router.get(
  '/generate-barcode',
  requirePermissions('PRODUCT:READ'),
  productController.generateBarcode
);

router.get(
  '/:id',
  requirePermissions('PRODUCT:READ'),
  productController.getById
);

router.put(
  '/:id',
  requirePermissions('PRODUCT:UPDATE'),
  validateRequest(updateProductSchema),
  productController.update
);

router.patch(
  '/:id/status',
  requirePermissions('PRODUCT:STATUS'),
  validateRequest(updateProductStatusSchema),
  productController.updateStatus
);

router.delete(
  '/:id',
  requirePermissions('PRODUCT:DELETE'),
  productController.delete
);

export default router;
