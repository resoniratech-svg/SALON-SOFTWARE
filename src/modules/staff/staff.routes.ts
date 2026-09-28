import { Router } from 'express';
import { staffController } from './staff.controller.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createStaffSchema,
  updateStaffSchema,
  updateStaffStatusSchema,
  staffQuerySchema,
} from './staff.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requirePermissions, requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All staff endpoints require authentication and active STAFF module
router.use(authenticateJwt);
router.use(requireModule('STAFF'));

// Metadata lookups (for front-end dropdowns)
router.get('/meta/designations', requirePermissions('STAFF:READ'), staffController.getDesignations);
router.get('/meta/shifts', requirePermissions('STAFF:READ'), staffController.getShifts);

// Staff list & creation
router.get('/', requirePermissions('STAFF:READ'), validateQuery(staffQuerySchema), staffController.getStaffList);
router.post('/', requirePermissions('STAFF:CREATE'), validateRequest(createStaffSchema), staffController.createStaff);

// Staff profile by ID
router.get('/:id', requirePermissions('STAFF:READ'), staffController.getStaffProfile);
router.put('/:id', requirePermissions('STAFF:UPDATE'), validateRequest(updateStaffSchema), staffController.updateStaff);
router.patch('/:id/status', requirePermissions('STAFF:STATUS'), validateRequest(updateStaffStatusSchema), staffController.updateStatus);

export default router;
