import { Router } from 'express';
import { packageController } from './package.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createPackageSchema,
  updatePackageSchema,
  packageQuerySchema,
} from './package.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// Authentication and Module access check
router.use(authenticateJwt);
router.use(requireModule('PACKAGES'));

router.get('/', validateQuery(packageQuerySchema), packageController.list);
router.post('/', validateRequest(createPackageSchema), packageController.create);
router.get('/:id', packageController.getById);
router.put('/:id', validateRequest(updatePackageSchema), packageController.update);
router.patch('/:id/status', packageController.updateStatus);
router.delete('/:id', packageController.delete);

export default router;
