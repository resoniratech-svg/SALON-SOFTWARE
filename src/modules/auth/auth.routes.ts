import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from './auth.validation.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireRoles, requirePermissions } from '../../middleware/authorization.middleware.js';

const router = Router();

// Public routes
router.post('/login', validateRequest(loginSchema), authController.login);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);
router.get('/tenant/:id', authController.getTenantPublicProfile);
router.get('/tenant-profile', authController.getTenantPublicProfile);

// Authenticated user routes
router.get('/me', authenticateJwt, authController.getCurrentUser);
router.post('/change-password', authenticateJwt, validateRequest(changePasswordSchema), authController.changePassword);
router.post('/cashier/forgot-password', authenticateJwt, authController.requestCashierPasswordReset);

// Verification and RBAC protected test endpoints
router.get('/test-protected', authenticateJwt, authController.testProtected);

router.get(
  '/test-admin-only',
  authenticateJwt,
  requireRoles('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'),
  authController.testProtected
);

router.get(
  '/test-access-control-permission',
  authenticateJwt,
  requirePermissions('SETTINGS:ACCESS_CONTROL:MANAGE'),
  authController.testProtected
);

export default router;
