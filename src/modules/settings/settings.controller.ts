import { Request, Response, NextFunction } from 'express';
import { settingsService, SettingsService } from './settings.service.js';
import { sendResponse } from '../../utils/api-response.js';
import { BadRequestError } from '../../utils/app-error.js';

export class SettingsController {
  constructor(private service: SettingsService = settingsService) {}

  private getTenantId(req: Request): string {
    const tenantId = (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.user?.role.name === 'SUPERADMIN'
        ? (req.headers['x-tenant-id'] || req.headers['x-impersonate-tenant-id'])
        : undefined)
    ) as string;
    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }
    return tenantId;
  }

  // ==========================================
  // 1. GENERIC SETTINGS
  // ==========================================
  getGenericSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getGenericSettings(tenantId);
      sendResponse(res, 200, true, 'Generic settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateGenericSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateGenericSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Generic settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 2. PRODUCT ORDERING SETTINGS
  // ==========================================
  getProductOrderingSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getProductOrderingSettings(tenantId);
      sendResponse(res, 200, true, 'Product ordering settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateProductOrderingSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateProductOrderingSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Product ordering settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 3. ONLINE PAYMENT SETTINGS
  // ==========================================
  getOnlinePaymentSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isCashier = req.user?.role.name === 'CASHIER';
      const data = await this.service.getOnlinePaymentSettings(tenantId, isCashier);
      sendResponse(res, 200, true, 'Online payment settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateOnlinePaymentSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateOnlinePaymentSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Online payment settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 4. NOTIFICATION SETTINGS
  // ==========================================
  getNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getNotificationSettings(tenantId);
      sendResponse(res, 200, true, 'Notification settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateNotificationSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Notification settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 5. FEEDBACK SETTINGS
  // ==========================================
  getFeedbackSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getFeedbackSettings(tenantId);
      sendResponse(res, 200, true, 'Feedback settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateFeedbackSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateFeedbackSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Feedback settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listFeedbackTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.listFeedbackTypes(tenantId);
      sendResponse(res, 200, true, 'Feedback types retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  createFeedbackType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createFeedbackType(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Feedback type created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateFeedbackType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateFeedbackType(tenantId, req.params.id as string, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Feedback type updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteFeedbackType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteFeedbackType(tenantId, req.params.id as string, req.user!, req.ip);
      sendResponse(res, 200, true, data.message, data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 6. REFERRAL SETTINGS
  // ==========================================
  getReferralSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getReferralSettings(tenantId);
      sendResponse(res, 200, true, 'Referral settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateReferralSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateReferralSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Referral settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 7. LOYALTY SETTINGS
  // ==========================================
  getLoyaltySettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getLoyaltySettings(tenantId);
      sendResponse(res, 200, true, 'Loyalty settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateLoyaltySettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateLoyaltySettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Loyalty settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 8. INCENTIVE SETTINGS
  // ==========================================
  getIncentiveSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getIncentiveSettings(tenantId);
      sendResponse(res, 200, true, 'Incentive settings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateIncentiveSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateIncentiveSettings(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Incentive settings updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 9. FOOTER CONTENT
  // ==========================================
  getFooterContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getFooterContent(tenantId);
      sendResponse(res, 200, true, 'Footer content retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateFooterContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateFooterContent(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Footer content updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 10. PRIVACY POLICY & TERMS
  // ==========================================
  getPrivacyPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getPrivacyPolicy(tenantId);
      sendResponse(res, 200, true, 'Privacy policy retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updatePrivacyPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updatePrivacyPolicy(tenantId, req.body.privacyPolicy, req.user!, req.ip);
      sendResponse(res, 200, true, 'Privacy policy updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getTermsConditions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getTermsConditions(tenantId);
      sendResponse(res, 200, true, 'Terms & conditions retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateTermsConditions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateTermsConditions(tenantId, req.body.termsAndConditions, req.user!, req.ip);
      sendResponse(res, 200, true, 'Terms & conditions updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 11. TAX MAPPINGS
  // ==========================================
  createTaxMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createTaxMapping(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Tax mapping created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listTaxMappings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listTaxMappings(tenantId, isActive);
      sendResponse(res, 200, true, 'Tax mappings retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getTaxMappingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getTaxMappingById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Tax mapping retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateTaxMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateTaxMapping(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Tax mapping updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteTaxMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteTaxMapping(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 12. MEMBERSHIPS
  // ==========================================
  createMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createMembership(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Membership plan created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listMemberships = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listMemberships(tenantId, isActive);
      sendResponse(res, 200, true, 'Membership plans retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getMembershipById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getMembershipById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Membership plan retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateMembership(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Membership plan updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteMembership(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 13. PACKAGES
  // ==========================================
  createPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createPackage(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Package created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listPackages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listPackages(tenantId, isActive);
      sendResponse(res, 200, true, 'Packages retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getPackageById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getPackageById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Package retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updatePackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updatePackage(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Package updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deletePackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deletePackage(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 14. GIFT CARDS
  // ==========================================
  createGiftCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createGiftCard(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Gift card created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listGiftCards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listGiftCards(tenantId, isActive);
      sendResponse(res, 200, true, 'Gift cards retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getGiftCardById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getGiftCardById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Gift card retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateGiftCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateGiftCard(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Gift card updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteGiftCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteGiftCard(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 15. COUPONS
  // ==========================================
  createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createCoupon(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Coupon created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listCoupons(tenantId, isActive);
      sendResponse(res, 200, true, 'Coupons retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getCouponById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getCouponById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Coupon retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateCoupon(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Coupon updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteCoupon(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 16. PNL CATEGORIES
  // ==========================================
  createPnlCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createPnlCategory(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'P&L category created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listPnlCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const type = req.query.type as string | undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listPnlCategories(tenantId, type, isActive);
      sendResponse(res, 200, true, 'P&L categories retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getPnlCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getPnlCategoryById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'P&L category retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updatePnlCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updatePnlCategory(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'P&L category updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deletePnlCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deletePnlCategory(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 17. PNL INCOME TAXES
  // ==========================================
  createPnlIncomeTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createPnlIncomeTax(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'P&L income tax slab created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listPnlIncomeTaxes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listPnlIncomeTaxes(tenantId, isActive);
      sendResponse(res, 200, true, 'P&L income tax slabs retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getPnlIncomeTaxById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getPnlIncomeTaxById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'P&L income tax slab retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updatePnlIncomeTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updatePnlIncomeTax(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'P&L income tax slab updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deletePnlIncomeTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deletePnlIncomeTax(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 18. CRM SEGMENTS
  // ==========================================
  createCrmSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createCrmSegment(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'CRM segment created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listCrmSegments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listCrmSegments(tenantId, isActive);
      sendResponse(res, 200, true, 'CRM segments retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getCrmSegmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getCrmSegmentById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'CRM segment retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateCrmSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateCrmSegment(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'CRM segment updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteCrmSegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteCrmSegment(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 19. CUSTOM FORMS
  // ==========================================
  createCustomForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createCustomForm(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Custom form created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listCustomForms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listCustomForms(tenantId, isActive);
      sendResponse(res, 200, true, 'Custom forms retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getCustomFormById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getCustomFormById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Custom form retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateCustomForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateCustomForm(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Custom form updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteCustomForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteCustomForm(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 20. SALUTATIONS
  // ==========================================
  createSalutation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createSalutation(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Salutation created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listSalutations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const data = await this.service.listSalutations(tenantId, isActive);
      sendResponse(res, 200, true, 'Salutations retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getSalutationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getSalutationById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Salutation retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateSalutation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateSalutation(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Salutation updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteSalutation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteSalutation(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 21. DESIGNATIONS (REUSED)
  // ==========================================
  createDesignation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const { name, description } = req.body;
      const data = await this.service.createDesignation(tenantId, name, description, req.user!, req.ip);
      sendResponse(res, 201, true, 'Designation created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listDesignations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.listDesignations(tenantId);
      sendResponse(res, 200, true, 'Designations retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getDesignationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getDesignationById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Designation retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateDesignation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateDesignation(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Designation updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteDesignation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteDesignation(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 22. SHIFTS (REUSED)
  // ==========================================
  createShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.createShift(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Shift created successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listShifts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const data = await this.service.listShifts(tenantId, { isActive, search });
      sendResponse(res, 200, true, 'Shifts retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  getShiftById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getShiftById(tenantId, String(req.params.id));
      sendResponse(res, 200, true, 'Shift retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateShift(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Shift updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  toggleShiftStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : (req.body?.active !== undefined ? Boolean(req.body.active) : undefined);
      const data = await this.service.toggleShiftStatus(tenantId, String(req.params.id), isActive, req.user!, req.ip);
      sendResponse(res, 200, true, 'Shift status updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  addShiftBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.addShiftBreak(tenantId, String(req.params.id), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Shift break added successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteShiftBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteShiftBreak(tenantId, String(req.params.id), Number(req.params.breakIndex), req.user!, req.ip);
      sendResponse(res, 200, true, 'Shift break deleted successfully', data);
    } catch (error) {
      next(error);
    }
  };

  deleteShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.deleteShift(tenantId, String(req.params.id), req.user!, req.ip);
      sendResponse(res, 200, true, data.message, null);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 23. ROSTER (REUSED)
  // ==========================================
  getRoster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.getRoster(tenantId);
      sendResponse(res, 200, true, 'Staff roster retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  updateStaffRoster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.updateStaffRoster(tenantId, String(req.params.staffId), req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Staff roster updated successfully', data);
    } catch (error) {
      next(error);
    }
  };

  applyShiftToStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.applyShiftToStaffRoster(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Shift applied to staff roster successfully', data);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 24. ACCESS CONTROL (RBAC)
  // ==========================================
  listRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listRoles();
      sendResponse(res, 200, true, 'Roles retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listPermissions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listPermissions();
      sendResponse(res, 200, true, 'Permissions retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };

  listTenantUsersWithRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const data = await this.service.listTenantUsersWithRoles(tenantId);
      sendResponse(res, 200, true, 'Company users retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  };
}

export const settingsController = new SettingsController();
