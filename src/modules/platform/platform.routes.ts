import { Router } from 'express';
import { platformController } from './platform.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireSuperAdmin } from '../../middleware/authorization.middleware.js';
import { validateRequest, validateQuery } from '../../middleware/validate.middleware.js';
import {
  createCompanySchema,
  updateCompanySchema,
  updateCompanyStatusSchema,
  updateSubscriptionSchema,
  renewSubscriptionSchema,
  updateModulesSchema,
  createAdminSchema,
  updateAdminSchema,
  updateAdminStatusSchema,
  resetAdminPasswordSchema,
  createSuperAdminSchema,
  createPlanSchema,
  updatePlanSchema,
  companyQuerySchema,
  auditLogQuerySchema,
} from './platform.validation.js';

const router = Router();

// All platform endpoints require authentication
router.use(authenticateJwt);

// Exit impersonation can be called with an active impersonation token
router.post('/impersonate/exit', platformController.exitImpersonation);

// All other platform operations strictly require SuperAdmin in Platform context
router.use(requireSuperAdmin);

// Platform overview & metrics
router.get('/metrics/overview', platformController.getMetricsOverview);
router.get('/plans', platformController.getPlans);
router.post('/plans', validateRequest(createPlanSchema), platformController.createPlan);
router.put('/plans/:id', validateRequest(updatePlanSchema), platformController.updatePlan);
router.delete('/plans/:id', platformController.deletePlan);
router.get('/modules', platformController.getModules);

// Company management (/companies and /tenants aliases)
router.post('/companies', validateRequest(createCompanySchema), platformController.createCompany);
router.get('/companies', validateQuery(companyQuerySchema), platformController.listCompanies);
router.get('/companies/:id', platformController.getCompanyById);
router.put('/companies/:id', validateRequest(updateCompanySchema), platformController.updateCompany);
router.patch('/companies/:id/status', validateRequest(updateCompanyStatusSchema), platformController.updateCompanyStatus);
router.patch('/companies/:id/subscription', validateRequest(updateSubscriptionSchema), platformController.updateSubscription);
router.post('/companies/:id/renew-subscription', validateRequest(renewSubscriptionSchema), platformController.renewSubscription);
router.patch('/companies/:id/cashier-limit', platformController.updateCashierLimit);
router.patch('/companies/:id/modules', validateRequest(updateModulesSchema), platformController.updateModules);
router.get('/companies/:id/cashiers', platformController.listCompanyCashiers);
router.get('/companies/:id/subscription-history', platformController.getSubscriptionHistory);
router.delete('/companies/:id', platformController.deleteCompany);

router.post('/tenants', validateRequest(createCompanySchema), platformController.createCompany);
router.get('/tenants', validateQuery(companyQuerySchema), platformController.listCompanies);
router.get('/tenants/:id', platformController.getCompanyById);
router.put('/tenants/:id', validateRequest(updateCompanySchema), platformController.updateCompany);
router.patch('/tenants/:id/status', validateRequest(updateCompanyStatusSchema), platformController.updateCompanyStatus);
router.patch('/tenants/:id/subscription', validateRequest(updateSubscriptionSchema), platformController.updateSubscription);
router.post('/tenants/:id/renew-subscription', validateRequest(renewSubscriptionSchema), platformController.renewSubscription);
router.patch('/tenants/:id/cashier-limit', platformController.updateCashierLimit);
router.patch('/tenants/:id/modules', validateRequest(updateModulesSchema), platformController.updateModules);
router.get('/tenants/:id/cashiers', platformController.listCompanyCashiers);
router.get('/tenants/:id/subscription-history', platformController.getSubscriptionHistory);
router.delete('/tenants/:id', platformController.deleteCompany);

// Global admin management
router.get('/admins', platformController.listAdmins);
router.get('/admins/:userId', platformController.getAdminById);
router.put('/admins/:userId', validateRequest(updateAdminSchema), platformController.updateAdmin);
router.patch('/admins/:userId/status', validateRequest(updateAdminStatusSchema), platformController.updateAdminStatus);

// Company-scoped admin management
router.post('/companies/:id/admin', validateRequest(createAdminSchema), platformController.createAdmin);
router.get('/companies/:id/admins', platformController.listAdmins);
router.get('/companies/:id/admins/:userId', platformController.getAdminById);
router.put('/companies/:id/admins/:userId', validateRequest(updateAdminSchema), platformController.updateAdmin);
router.patch('/companies/:id/admins/:userId/status', validateRequest(updateAdminStatusSchema), platformController.updateAdminStatus);
router.post('/companies/:id/reset-admin-password', validateRequest(resetAdminPasswordSchema), platformController.resetAdminPassword);
router.post('/companies/:id/users/:userId/reset-password', validateRequest(resetAdminPasswordSchema), platformController.resetAdminPassword);

router.post('/tenants/:id/admin', validateRequest(createAdminSchema), platformController.createAdmin);
router.get('/tenants/:id/admins', platformController.listAdmins);
router.get('/tenants/:id/admins/:userId', platformController.getAdminById);
router.put('/tenants/:id/admins/:userId', validateRequest(updateAdminSchema), platformController.updateAdmin);
router.patch('/tenants/:id/admins/:userId/status', validateRequest(updateAdminStatusSchema), platformController.updateAdminStatus);
router.post('/tenants/:id/reset-admin-password', validateRequest(resetAdminPasswordSchema), platformController.resetAdminPassword);
router.post('/tenants/:id/users/:userId/reset-password', validateRequest(resetAdminPasswordSchema), platformController.resetAdminPassword);

// SuperAdmin Admin-Reset Requests Portal
router.get('/admin-reset-requests', platformController.getAdminResetRequests);
router.post('/admin-reset-requests/:userId/approve', platformController.approveAdminReset);
router.post('/admin-reset-requests/:id/approve', platformController.approveAdminReset);

// Impersonation
router.post('/companies/:id/impersonate', platformController.startImpersonation);
router.post('/tenants/:id/impersonate', platformController.startImpersonation);

// SuperAdmin accounts
router.post('/superadmins', validateRequest(createSuperAdminSchema), platformController.createSuperAdmin);
router.get('/superadmins', platformController.listSuperAdmins);

// Audit logs
router.get('/audit-logs', validateQuery(auditLogQuerySchema), platformController.getAuditLogs);

export default router;
