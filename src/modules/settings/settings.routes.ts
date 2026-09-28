import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { resourceController } from '../resources/resource.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import {
  requirePermissions,
  requireRoles,
  requireModule,
} from '../../middleware/authorization.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import {
  genericSettingsSchema,
  productOrderingSettingsSchema,
  onlinePaymentSettingsSchema,
  notificationSettingsSchema,
  feedbackSettingsSchema,
  feedbackTypeSchema,
  referralSettingsSchema,
  loyaltySettingsSchema,
  incentiveSettingsSchema,
  footerContentSchema,
  privacyPolicySchema,
  termsConditionsSchema,
  createTaxMappingSchema,
  updateTaxMappingSchema,
  createMembershipSchema,
  updateMembershipSchema,
  createPackageSchema,
  updatePackageSchema,
  createGiftCardSchema,
  updateGiftCardSchema,
  createCouponSchema,
  updateCouponSchema,
  createPnlCategorySchema,
  updatePnlCategorySchema,
  createPnlIncomeTaxSchema,
  updatePnlIncomeTaxSchema,
  createCrmSegmentSchema,
  updateCrmSegmentSchema,
  createCustomFormSchema,
  updateCustomFormSchema,
  createSalutationSchema,
  updateSalutationSchema,
  updateStaffRosterSchema,
  createShiftSchema,
  updateShiftSchema,
  applyShiftRosterSchema,
  addShiftBreakSchema,
} from './settings.validation.js';

const router = Router();

// Base middleware: Authentication & SETTINGS module check
router.use(authenticateJwt);
router.use(requireModule('SETTINGS'));

// ==========================================
// 1. GENERIC SETTINGS
// ==========================================
router.get(
  '/generic',
  requirePermissions('SETTINGS:READ'),
  settingsController.getGenericSettings
);
router.put(
  '/generic',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(genericSettingsSchema),
  settingsController.updateGenericSettings
);

// ==========================================
// 2. PRODUCT ORDERING SETTINGS
// ==========================================
router.get(
  '/product-ordering',
  requirePermissions('SETTINGS:READ'),
  settingsController.getProductOrderingSettings
);
router.put(
  '/product-ordering',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(productOrderingSettingsSchema),
  settingsController.updateProductOrderingSettings
);

// ==========================================
// 3. ONLINE PAYMENT SETTINGS
// ==========================================
router.get(
  '/payments',
  requirePermissions('SETTINGS:READ'),
  settingsController.getOnlinePaymentSettings
);
router.put(
  '/payments',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(onlinePaymentSettingsSchema),
  settingsController.updateOnlinePaymentSettings
);

// ==========================================
// 4. NOTIFICATION SETTINGS
// ==========================================
router.get(
  '/notifications',
  requireRoles('ADMIN', 'SUPERADMIN'),
  requirePermissions('SETTINGS:READ'),
  settingsController.getNotificationSettings
);
router.put(
  '/notifications',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(notificationSettingsSchema),
  settingsController.updateNotificationSettings
);

// ==========================================
// 5. FEEDBACK SETTINGS
// ==========================================
router.get(
  '/feedback',
  requirePermissions('SETTINGS:READ'),
  settingsController.getFeedbackSettings
);
router.put(
  '/feedback',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(feedbackSettingsSchema),
  settingsController.updateFeedbackSettings
);
router.get(
  '/feedback/types',
  requirePermissions('SETTINGS:READ'),
  settingsController.listFeedbackTypes
);
router.post(
  '/feedback/types',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(feedbackTypeSchema),
  settingsController.createFeedbackType
);
router.put(
  '/feedback/types/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.updateFeedbackType
);
router.delete(
  '/feedback/types/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteFeedbackType
);

// ==========================================
// 6. REFERRAL SETTINGS
// ==========================================
router.get(
  '/referrals',
  requirePermissions('SETTINGS:READ'),
  settingsController.getReferralSettings
);
router.put(
  '/referrals',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(referralSettingsSchema),
  settingsController.updateReferralSettings
);

// ==========================================
// 7. LOYALTY SETTINGS
// ==========================================
router.get(
  '/loyalty',
  requirePermissions('SETTINGS:READ'),
  settingsController.getLoyaltySettings
);
router.put(
  '/loyalty',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(loyaltySettingsSchema),
  settingsController.updateLoyaltySettings
);

// ==========================================
// 8. INCENTIVE SETTINGS
// ==========================================
router.get(
  '/incentives',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.getIncentiveSettings
);
router.put(
  '/incentives',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(incentiveSettingsSchema),
  settingsController.updateIncentiveSettings
);

// ==========================================
// 9. FOOTER CONTENT
// ==========================================
router.get(
  '/footer',
  requirePermissions('SETTINGS:READ'),
  settingsController.getFooterContent
);
router.put(
  '/footer',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(footerContentSchema),
  settingsController.updateFooterContent
);

// ==========================================
// 10. PRIVACY POLICY & TERMS
// ==========================================
router.get(
  '/privacy-policy',
  requirePermissions('SETTINGS:READ'),
  settingsController.getPrivacyPolicy
);
router.put(
  '/privacy-policy',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(privacyPolicySchema),
  settingsController.updatePrivacyPolicy
);

router.get(
  '/terms-conditions',
  requirePermissions('SETTINGS:READ'),
  settingsController.getTermsConditions
);
router.put(
  '/terms-conditions',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(termsConditionsSchema),
  settingsController.updateTermsConditions
);

// ==========================================
// 11. TAX MAPPINGS
// ==========================================
router.get(
  '/tax-mappings',
  requirePermissions('SETTINGS:READ'),
  settingsController.listTaxMappings
);
router.post(
  '/tax-mappings',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createTaxMappingSchema),
  settingsController.createTaxMapping
);
router.get(
  '/tax-mappings/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getTaxMappingById
);
router.put(
  '/tax-mappings/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateTaxMappingSchema),
  settingsController.updateTaxMapping
);
router.delete(
  '/tax-mappings/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteTaxMapping
);

// ==========================================
// 12. MEMBERSHIPS
// ==========================================
router.get(
  '/memberships',
  requirePermissions('SETTINGS:READ'),
  settingsController.listMemberships
);
router.post(
  '/memberships',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createMembershipSchema),
  settingsController.createMembership
);
router.get(
  '/memberships/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getMembershipById
);
router.put(
  '/memberships/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateMembershipSchema),
  settingsController.updateMembership
);
router.delete(
  '/memberships/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteMembership
);

// ==========================================
// 13. PACKAGES
// ==========================================
router.get(
  '/packages',
  requirePermissions('SETTINGS:READ'),
  settingsController.listPackages
);
router.post(
  '/packages',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createPackageSchema),
  settingsController.createPackage
);
router.get(
  '/packages/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getPackageById
);
router.put(
  '/packages/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updatePackageSchema),
  settingsController.updatePackage
);
router.delete(
  '/packages/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deletePackage
);

// ==========================================
// 14. GIFT CARDS
// ==========================================
router.get(
  '/gift-cards',
  requirePermissions('SETTINGS:READ'),
  settingsController.listGiftCards
);
router.post(
  '/gift-cards',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createGiftCardSchema),
  settingsController.createGiftCard
);
router.get(
  '/gift-cards/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getGiftCardById
);
router.put(
  '/gift-cards/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateGiftCardSchema),
  settingsController.updateGiftCard
);
router.delete(
  '/gift-cards/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteGiftCard
);

// ==========================================
// 15. COUPONS
// ==========================================
router.get(
  '/coupons',
  requirePermissions('SETTINGS:READ'),
  settingsController.listCoupons
);
router.post(
  '/coupons',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createCouponSchema),
  settingsController.createCoupon
);
router.get(
  '/coupons/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getCouponById
);
router.put(
  '/coupons/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateCouponSchema),
  settingsController.updateCoupon
);
router.delete(
  '/coupons/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteCoupon
);

// ==========================================
// 16. PNL CATEGORIES
// ==========================================
router.get(
  '/pnl-categories',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.listPnlCategories
);
router.post(
  '/pnl-categories',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createPnlCategorySchema),
  settingsController.createPnlCategory
);
router.get(
  '/pnl-categories/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.getPnlCategoryById
);
router.put(
  '/pnl-categories/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updatePnlCategorySchema),
  settingsController.updatePnlCategory
);
router.delete(
  '/pnl-categories/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deletePnlCategory
);

// ==========================================
// 17. PNL INCOME TAXES
// ==========================================
router.get(
  '/pnl-income-taxes',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.listPnlIncomeTaxes
);
router.post(
  '/pnl-income-taxes',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createPnlIncomeTaxSchema),
  settingsController.createPnlIncomeTax
);
router.get(
  '/pnl-income-taxes/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.getPnlIncomeTaxById
);
router.put(
  '/pnl-income-taxes/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updatePnlIncomeTaxSchema),
  settingsController.updatePnlIncomeTax
);
router.delete(
  '/pnl-income-taxes/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deletePnlIncomeTax
);

// ==========================================
// 18. CRM SEGMENTS
// ==========================================
router.get(
  '/crm-segments',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.listCrmSegments
);
router.post(
  '/crm-segments',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createCrmSegmentSchema),
  settingsController.createCrmSegment
);
router.get(
  '/crm-segments/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.getCrmSegmentById
);
router.put(
  '/crm-segments/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateCrmSegmentSchema),
  settingsController.updateCrmSegment
);
router.delete(
  '/crm-segments/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteCrmSegment
);

// ==========================================
// 19. CUSTOM FORMS
// ==========================================
router.get(
  '/custom-forms',
  requirePermissions('SETTINGS:READ'),
  settingsController.listCustomForms
);
router.post(
  '/custom-forms',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createCustomFormSchema),
  settingsController.createCustomForm
);
router.get(
  '/custom-forms/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getCustomFormById
);
router.put(
  '/custom-forms/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateCustomFormSchema),
  settingsController.updateCustomForm
);
router.delete(
  '/custom-forms/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteCustomForm
);

// ==========================================
// 20. SALUTATIONS
// ==========================================
router.get(
  '/salutations',
  requirePermissions('SETTINGS:READ'),
  settingsController.listSalutations
);
router.post(
  '/salutations',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createSalutationSchema),
  settingsController.createSalutation
);
router.get(
  '/salutations/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getSalutationById
);
router.put(
  '/salutations/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateSalutationSchema),
  settingsController.updateSalutation
);
router.delete(
  '/salutations/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteSalutation
);

// ==========================================
// 21. DESIGNATIONS (REUSED)
// ==========================================
router.get(
  '/designations',
  requirePermissions('SETTINGS:READ'),
  settingsController.listDesignations
);
router.post(
  '/designations',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.createDesignation
);
router.get(
  '/designations/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getDesignationById
);
router.put(
  '/designations/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.updateDesignation
);
router.delete(
  '/designations/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteDesignation
);

// ==========================================
// 22. SHIFTS (REUSED)
// ==========================================
router.get(
  '/shifts',
  requirePermissions('SETTINGS:READ'),
  settingsController.listShifts
);
router.post(
  '/shifts',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(createShiftSchema),
  settingsController.createShift
);
router.get(
  '/shifts/:id',
  requirePermissions('SETTINGS:READ'),
  settingsController.getShiftById
);
router.put(
  '/shifts/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateShiftSchema),
  settingsController.updateShift
);
router.patch(
  '/shifts/:id/status',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.toggleShiftStatus
);
router.post(
  '/shifts/:id/breaks',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(addShiftBreakSchema),
  settingsController.addShiftBreak
);
router.delete(
  '/shifts/:id/breaks/:breakIndex',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteShiftBreak
);
router.delete(
  '/shifts/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.deleteShift
);

// ==========================================
// 23. ROSTER (REUSED)
// ==========================================
router.get(
  '/roster',
  requirePermissions('SETTINGS:READ'),
  settingsController.getRoster
);
router.put(
  '/roster/:staffId',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(updateStaffRosterSchema),
  settingsController.updateStaffRoster
);
router.post(
  '/roster/apply-shift',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(applyShiftRosterSchema),
  settingsController.applyShiftToStaff
);
router.post(
  '/roster/apply',
  requireRoles('ADMIN', 'SUPERADMIN'),
  validateRequest(applyShiftRosterSchema),
  settingsController.applyShiftToStaff
);

// ==========================================
// 24. ACCESS CONTROL (REUSED)
// ==========================================
router.get(
  '/access-control/roles',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.listRoles
);
router.get(
  '/access-control/permissions',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.listPermissions
);
router.get(
  '/access-control/users',
  requireRoles('ADMIN', 'SUPERADMIN'),
  settingsController.listTenantUsersWithRoles
);

// ==========================================
// 25. RESOURCES (ALIASED TO EXISTING RESOURCES)
// ==========================================
router.get(
  '/resources',
  requirePermissions('SETTINGS:READ'),
  resourceController.list
);
router.post(
  '/resources',
  requireRoles('ADMIN', 'SUPERADMIN'),
  resourceController.create
);
router.get(
  '/resources/:id',
  requirePermissions('SETTINGS:READ'),
  resourceController.getById
);
router.put(
  '/resources/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  resourceController.update
);
router.delete(
  '/resources/:id',
  requireRoles('ADMIN', 'SUPERADMIN'),
  resourceController.delete
);

export default router;
