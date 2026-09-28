import { settingsRepository } from './settings.repository.js';
import { prisma } from '../../config/database.js';
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../utils/app-error.js';
import {
  GenericSettingsInput,
  ProductOrderingSettingsInput,
  OnlinePaymentSettingsInput,
  NotificationSettingsInput,
  FeedbackSettingsInput,
  ReferralSettingsInput,
  LoyaltySettingsInput,
  IncentiveSettingsInput,
  FooterContentInput,
  LegalContentInput,
  CreateTaxMappingInput,
  UpdateTaxMappingInput,
  CreateMembershipInput,
  UpdateMembershipInput,
  CreatePackageInput,
  UpdatePackageInput,
  CreateGiftCardInput,
  UpdateGiftCardInput,
  CreateCouponInput,
  UpdateCouponInput,
  CreatePnlCategoryInput,
  UpdatePnlCategoryInput,
  CreatePnlIncomeTaxInput,
  UpdatePnlIncomeTaxInput,
  CreateCrmSegmentInput,
  UpdateCrmSegmentInput,
  CreateCustomFormInput,
  UpdateCustomFormInput,
  CreateSalutationInput,
  UpdateSalutationInput,
  UpdateStaffRosterInput,
} from './settings.types.js';

interface Actor {
  id: string;
  role: { name: string };
  username: string;
}

export class SettingsService {
  private async logAudit(
    actor: Actor | undefined,
    tenantId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: Record<string, any> = {},
    ip?: string
  ) {
    if (!actor) return;
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorType: actor.role.name === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN',
          actorName: actor.username,
          tenantId,
          action,
          entityType,
          entityId,
          metadata,
          ipAddress: ip || '127.0.0.1',
        },
      });
    } catch {
      // Audit log failures should not fail the main request
    }
  }

  // ==========================================
  // 1. GENERIC SETTINGS
  // ==========================================
  async getGenericSettings(tenantId: string) {
    const [settings, tenant] = await Promise.all([
      settingsRepository.getOrCreateTenantSettings(tenantId),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, code: true, address: true, contactEmail: true, contactPhone: true },
      }),
    ]);
    return {
      companyName: tenant?.name?.trim() ? tenant.name : (tenant?.code || ''),
      companyCode: tenant?.code || '',
      address: tenant?.address || null,
      contactEmail: tenant?.contactEmail || null,
      contactPhone: tenant?.contactPhone || null,
      businessStatus: settings.businessStatus,
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
      genderSpecification: settings.genderSpecification,
      weeklyOffDays: settings.weeklyOffDays,
    };
  }

  async updateGenericSettings(tenantId: string, input: GenericSettingsInput, actor?: Actor, ip?: string) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, input);
    await this.logAudit(actor, tenantId, 'GENERIC_SETTINGS_UPDATED', 'TenantSettings', updated.id, input, ip);
    return {
      businessStatus: updated.businessStatus,
      openingTime: updated.openingTime,
      closingTime: updated.closingTime,
      genderSpecification: updated.genderSpecification,
      weeklyOffDays: updated.weeklyOffDays,
    };
  }

  // ==========================================
  // 2. PRODUCT ORDERING SETTINGS
  // ==========================================
  async getProductOrderingSettings(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return {
      homeDeliveryEnabled: settings.homeDeliveryEnabled,
      pickupEnabled: settings.pickupEnabled,
      codEnabled: settings.codEnabled,
      cashOnPickupEnabled: settings.cashOnPickupEnabled,
      minOrderValue: Number(settings.minOrderValue),
      deliveryFee: Number(settings.deliveryFee),
    };
  }

  async updateProductOrderingSettings(
    tenantId: string,
    input: ProductOrderingSettingsInput,
    actor?: Actor,
    ip?: string
  ) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, input);
    await this.logAudit(actor, tenantId, 'PRODUCT_ORDERING_SETTINGS_UPDATED', 'TenantSettings', updated.id, input, ip);
    return {
      homeDeliveryEnabled: updated.homeDeliveryEnabled,
      pickupEnabled: updated.pickupEnabled,
      codEnabled: updated.codEnabled,
      cashOnPickupEnabled: updated.cashOnPickupEnabled,
      minOrderValue: Number(updated.minOrderValue),
      deliveryFee: Number(updated.deliveryFee),
    };
  }

  // ==========================================
  // 3. ONLINE PAYMENT SETTINGS (WITH SENSITIVE DATA PROTECTION)
  // ==========================================
  async getOnlinePaymentSettings(tenantId: string, isCashier = false) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    const gateways = Array.isArray(settings.paymentGateways)
      ? (settings.paymentGateways as any[])
      : [];

    // Mask credentials for Admin, completely strip secrets for Cashier
    const sanitizedGateways = gateways.map((g) => {
      if (isCashier) {
        return {
          provider: g.provider,
          isActive: Boolean(g.isActive),
        };
      }
      return {
        provider: g.provider,
        isActive: Boolean(g.isActive),
        keyId: g.keyId ? `${g.keyId.substring(0, 4)}***${g.keyId.slice(-4)}` : undefined,
        secretConfigured: Boolean(g.keySecret || g.webhookSecret),
        merchantId: g.merchantId,
      };
    });

    return {
      onlinePaymentEnabled: settings.onlinePaymentEnabled,
      paymentGateways: sanitizedGateways,
      applyToOrders: settings.applyToOrders,
      applyToAppointments: settings.applyToAppointments,
    };
  }

  async updateOnlinePaymentSettings(
    tenantId: string,
    input: OnlinePaymentSettingsInput,
    actor?: Actor,
    ip?: string
  ) {
    const current = await settingsRepository.getOrCreateTenantSettings(tenantId);
    let newGateways = input.paymentGateways;

    // Merge sensitive keys if not explicitly overwritten
    if (newGateways && Array.isArray(current.paymentGateways)) {
      const oldGateways = current.paymentGateways as any[];
      newGateways = newGateways.map((ng) => {
        const oldG = oldGateways.find((og) => og.provider === ng.provider);
        return {
          ...ng,
          keySecret: ng.keySecret || oldG?.keySecret,
          webhookSecret: ng.webhookSecret || oldG?.webhookSecret,
        };
      });
    }

    const updated = await settingsRepository.updateTenantSettings(tenantId, {
      onlinePaymentEnabled: input.onlinePaymentEnabled,
      paymentGateways: newGateways,
      applyToOrders: input.applyToOrders,
      applyToAppointments: input.applyToAppointments,
    });

    // Redact secrets in audit log
    const sanitizedLog = {
      onlinePaymentEnabled: input.onlinePaymentEnabled,
      applyToOrders: input.applyToOrders,
      applyToAppointments: input.applyToAppointments,
      gatewayCount: newGateways?.length,
    };
    await this.logAudit(actor, tenantId, 'ONLINE_PAYMENT_SETTINGS_UPDATED', 'TenantSettings', updated.id, sanitizedLog, ip);

    return this.getOnlinePaymentSettings(tenantId, false);
  }

  // ==========================================
  // 4. NOTIFICATION SETTINGS (CONSOLIDATED)
  // ==========================================
  async getNotificationSettings(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    const config = (settings.notificationsConfig as any) || {};

    // Mask any provider API keys
    const maskedConfig = { ...config };
    if (maskedConfig.smsProvider?.apiKey) {
      maskedConfig.smsProvider = {
        ...maskedConfig.smsProvider,
        apiKey: '***CONFIGURED***',
      };
    }
    if (maskedConfig.emailProvider?.apiKey) {
      maskedConfig.emailProvider = {
        ...maskedConfig.emailProvider,
        apiKey: '***CONFIGURED***',
      };
    }

    return { notificationsConfig: maskedConfig };
  }

  async updateNotificationSettings(
    tenantId: string,
    input: NotificationSettingsInput,
    actor?: Actor,
    ip?: string
  ) {
    const current = await settingsRepository.getOrCreateTenantSettings(tenantId);
    const currentConfig = (current.notificationsConfig as any) || {};
    const newConfig = { ...input.notificationsConfig };

    // Preserve existing API keys if placeholder sent
    if (newConfig.smsProvider && newConfig.smsProvider.apiKey === '***CONFIGURED***') {
      newConfig.smsProvider.apiKey = currentConfig.smsProvider?.apiKey;
    }
    if (newConfig.emailProvider && newConfig.emailProvider.apiKey === '***CONFIGURED***') {
      newConfig.emailProvider.apiKey = currentConfig.emailProvider?.apiKey;
    }

    const updated = await settingsRepository.updateTenantSettings(tenantId, {
      notificationsConfig: newConfig,
    });

    await this.logAudit(actor, tenantId, 'NOTIFICATION_SETTINGS_UPDATED', 'TenantSettings', updated.id, { channelsUpdated: true }, ip);
    return this.getNotificationSettings(tenantId);
  }

  // ==========================================
  // 5. FEEDBACK SETTINGS
  // ==========================================
  async getFeedbackSettings(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return {
      feedbackEnabled: settings.feedbackEnabled,
      ratingScale: settings.ratingScale,
      sendFeedbackSms: settings.sendFeedbackSms,
      sendFeedbackEmail: settings.sendFeedbackEmail,
      feedbackQuestions: settings.feedbackQuestions,
    };
  }

  async updateFeedbackSettings(tenantId: string, input: FeedbackSettingsInput, actor?: Actor, ip?: string) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, input);
    await this.logAudit(actor, tenantId, 'FEEDBACK_SETTINGS_UPDATED', 'TenantSettings', updated.id, input, ip);
    return {
      feedbackEnabled: updated.feedbackEnabled,
      ratingScale: updated.ratingScale,
      sendFeedbackSms: updated.sendFeedbackSms,
      sendFeedbackEmail: updated.sendFeedbackEmail,
      feedbackQuestions: updated.feedbackQuestions,
    };
  }

  async listFeedbackTypes(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    let questions = (settings.feedbackQuestions as any[]) || [];
    if (!questions || questions.length === 0) {
      questions = [
        { id: '1', name: 'Service Quality', question: 'Service Quality', ratingType: 'STARS', isActive: true, required: true },
        { id: '2', name: 'Social Etiquette', question: 'Social Etiquette', ratingType: 'STARS', isActive: true, required: true },
        { id: '3', name: 'Personal Hygiene', question: 'Personal Hygiene', ratingType: 'STARS', isActive: true, required: true },
        { id: '4', name: 'Remark', question: 'Remark', ratingType: 'TEXT', isActive: true, required: false },
      ];
      await settingsRepository.updateTenantSettings(tenantId, { feedbackQuestions: questions as any });
    }
    return questions;
  }

  async createFeedbackType(tenantId: string, input: { name: string; question?: string; ratingType?: string; isActive?: boolean; required?: boolean }, actor?: Actor, ip?: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    let questions = (settings.feedbackQuestions as any[]) || [];
    if (questions.length === 0) {
      questions = [
        { id: '1', name: 'Service Quality', question: 'Service Quality', ratingType: 'STARS', isActive: true, required: true },
        { id: '2', name: 'Social Etiquette', question: 'Social Etiquette', ratingType: 'STARS', isActive: true, required: true },
        { id: '3', name: 'Personal Hygiene', question: 'Personal Hygiene', ratingType: 'STARS', isActive: true, required: true },
        { id: '4', name: 'Remark', question: 'Remark', ratingType: 'TEXT', isActive: true, required: false },
      ];
    }
    const newId = `ft-${Date.now()}`;
    const newType = {
      id: newId,
      name: input.name,
      question: input.question || input.name,
      ratingType: input.ratingType || 'STARS',
      isActive: input.isActive ?? true,
      required: input.required ?? false,
    };
    questions.push(newType);
    await settingsRepository.updateTenantSettings(tenantId, { feedbackQuestions: questions as any });
    await this.logAudit(actor, tenantId, 'FEEDBACK_TYPE_CREATED', 'FeedbackType', newId, newType, ip);
    return newType;
  }

  async updateFeedbackType(tenantId: string, id: string, input: Partial<{ name: string; question?: string; ratingType?: string; isActive?: boolean; required?: boolean }>, actor?: Actor, ip?: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    let questions = (settings.feedbackQuestions as any[]) || [];
    const index = questions.findIndex((q: any) => q.id === id);
    if (index === -1) {
      throw new NotFoundError('Feedback type not found');
    }
    questions[index] = { ...questions[index], ...input };
    if (input.name && !input.question) {
      questions[index].question = input.name;
    }
    await settingsRepository.updateTenantSettings(tenantId, { feedbackQuestions: questions as any });
    await this.logAudit(actor, tenantId, 'FEEDBACK_TYPE_UPDATED', 'FeedbackType', id, input, ip);
    return questions[index];
  }

  async deleteFeedbackType(tenantId: string, id: string, actor?: Actor, ip?: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    let questions = (settings.feedbackQuestions as any[]) || [];
    const filtered = questions.filter((q: any) => q.id !== id);
    if (filtered.length === questions.length) {
      throw new NotFoundError('Feedback type not found');
    }
    await settingsRepository.updateTenantSettings(tenantId, { feedbackQuestions: filtered as any });
    await this.logAudit(actor, tenantId, 'FEEDBACK_TYPE_DELETED', 'FeedbackType', id, { id }, ip);
    return { success: true, message: 'Feedback type deleted successfully' };
  }

  // ==========================================
  // 6. REFERRAL SETTINGS
  // ==========================================
  async getReferralSettings(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return {
      referralsEnabled: settings.referralsEnabled,
      referrerRewardType: settings.referrerRewardType,
      referrerRewardValue: settings.referrerRewardValue ? Number(settings.referrerRewardValue) : null,
      refereeRewardType: settings.refereeRewardType,
      refereeRewardValue: settings.refereeRewardValue ? Number(settings.refereeRewardValue) : null,
      referralMinOrder: settings.referralMinOrder ? Number(settings.referralMinOrder) : null,
      referralValidityDays: settings.referralValidityDays,
    };
  }

  async updateReferralSettings(tenantId: string, input: ReferralSettingsInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const payload: any = {};
    if (raw.referralsEnabled !== undefined) payload.referralsEnabled = raw.referralsEnabled;

    if (raw.referrerRewardType !== undefined) payload.referrerRewardType = raw.referrerRewardType;
    else if (raw.referrerPercentage !== undefined) payload.referrerRewardType = 'PERCENTAGE';
    else if (raw.referrerFixedAmount !== undefined) payload.referrerRewardType = 'FIXED';

    if (raw.referrerRewardValue !== undefined) payload.referrerRewardValue = raw.referrerRewardValue;
    else if (raw.referrerPercentage !== undefined) payload.referrerRewardValue = raw.referrerPercentage;
    else if (raw.referrerFixedAmount !== undefined) payload.referrerRewardValue = raw.referrerFixedAmount;

    if (raw.refereeRewardType !== undefined) payload.refereeRewardType = raw.refereeRewardType;
    else if (raw.refereePercentage !== undefined) payload.refereeRewardType = 'PERCENTAGE';
    else if (raw.refereeFixedAmount !== undefined) payload.refereeRewardType = 'FIXED';

    if (raw.refereeRewardValue !== undefined) payload.refereeRewardValue = raw.refereeRewardValue;
    else if (raw.refereePercentage !== undefined) payload.refereeRewardValue = raw.refereePercentage;
    else if (raw.refereeFixedAmount !== undefined) payload.refereeRewardValue = raw.refereeFixedAmount;

    if (raw.referralMinOrder !== undefined) payload.referralMinOrder = raw.referralMinOrder;
    if (raw.referralValidityDays !== undefined) payload.referralValidityDays = raw.referralValidityDays;
    else if (raw.maxReferLimit !== undefined) payload.referralValidityDays = raw.maxReferLimit;

    const updated = await settingsRepository.updateTenantSettings(tenantId, payload);
    await this.logAudit(actor, tenantId, 'REFERRAL_SETTINGS_UPDATED', 'TenantSettings', updated.id, input, ip);
    return this.getReferralSettings(tenantId);
  }

  // ==========================================
  // 7. LOYALTY SETTINGS
  // ==========================================
  async getLoyaltySettings(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    const rules = (settings.loyaltyRules as Record<string, any>) || {};

    const earnAmount = rules.earnAmount ?? 20;
    const earnPoints = rules.earnPoints ?? 1;
    const redeemAmount = rules.redeemAmount ?? 1;
    const redeemPoints = rules.redeemPoints ?? 1;

    return {
      loyaltyEnabled: settings.loyaltyEnabled,
      pointsPerCurrency: settings.pointsPerCurrency ? Number(settings.pointsPerCurrency) : 1,
      currencyPerPoint: settings.currencyPerPoint ? Number(settings.currencyPerPoint) : 1,
      minRedeemPoints: settings.minRedeemPoints ?? 100,
      maxRedeemPointsPerOrder: settings.maxRedeemPointsPerOrder,
      loyaltyExpiryDays: settings.loyaltyExpiryDays,
      earnIndividually: rules.earnIndividually ?? false,
      skipOnRedemption: rules.skipOnRedemption ?? false,
      earnOnMembership: rules.earnOnMembership ?? false,
      earnAmount,
      earnPoints,
      redeemIndividually: rules.redeemIndividually ?? false,
      redeemPoints,
      redeemAmount,
      maxRedeemPercentage: rules.maxRedeemPercentage ?? null,
      earnSummary: `Earn ${earnPoints} Points on Every ₹${earnAmount} Spent`,
      redeemSummary: `Redeem ₹${redeemAmount} on Every ${redeemPoints} Point${redeemPoints > 1 ? 's' : ''}`,
    };
  }

  async updateLoyaltySettings(tenantId: string, input: LoyaltySettingsInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const current = await settingsRepository.getOrCreateTenantSettings(tenantId);
    const rules = ((current.loyaltyRules as Record<string, any>) || {});

    const payload: any = {};
    if (raw.loyaltyEnabled !== undefined) payload.loyaltyEnabled = raw.loyaltyEnabled;

    // Direct rates or aliases
    if (raw.pointsPerCurrency !== undefined) payload.pointsPerCurrency = raw.pointsPerCurrency;
    else if (raw.earnPointsPerRupee !== undefined) payload.pointsPerCurrency = raw.earnPointsPerRupee;

    if (raw.currencyPerPoint !== undefined) payload.currencyPerPoint = raw.currencyPerPoint;
    else if (raw.rupeePerRedeemPoint !== undefined) payload.currencyPerPoint = raw.rupeePerRedeemPoint;

    if (raw.minRedeemPoints !== undefined) payload.minRedeemPoints = raw.minRedeemPoints;
    if (raw.maxRedeemPointsPerOrder !== undefined) payload.maxRedeemPointsPerOrder = raw.maxRedeemPointsPerOrder;
    if (raw.loyaltyExpiryDays !== undefined) payload.loyaltyExpiryDays = raw.loyaltyExpiryDays;

    // Granular UI rules from frame 068/069
    if (raw.earnIndividually !== undefined || raw.earnLoyaltyIndividually !== undefined) {
      rules.earnIndividually = raw.earnIndividually ?? raw.earnLoyaltyIndividually;
    }
    if (raw.skipOnRedemption !== undefined || raw.skipEarningOnRedemption !== undefined) {
      rules.skipOnRedemption = raw.skipOnRedemption ?? raw.skipEarningOnRedemption;
    }
    if (raw.earnOnMembership !== undefined || raw.earnOnPercentageMembership !== undefined) {
      rules.earnOnMembership = raw.earnOnMembership ?? raw.earnOnPercentageMembership;
    }
    if (raw.earnAmount !== undefined || raw.earnSpent !== undefined) {
      rules.earnAmount = raw.earnAmount ?? raw.earnSpent;
    }
    if (raw.earnPoints !== undefined) {
      rules.earnPoints = raw.earnPoints;
    }
    if (raw.redeemIndividually !== undefined || raw.redeemLoyaltyIndividually !== undefined) {
      rules.redeemIndividually = raw.redeemIndividually ?? raw.redeemLoyaltyIndividually;
    }
    if (raw.redeemPoints !== undefined) {
      rules.redeemPoints = raw.redeemPoints;
    }
    if (raw.redeemAmount !== undefined || raw.redeemValue !== undefined) {
      rules.redeemAmount = raw.redeemAmount ?? raw.redeemValue;
    }
    if (raw.maxRedeemPercentage !== undefined || raw.percentageRedeemableOnOrder !== undefined) {
      rules.maxRedeemPercentage = raw.maxRedeemPercentage ?? raw.percentageRedeemableOnOrder;
    }

    // Auto-calculate pointsPerCurrency / currencyPerPoint if ratios provided
    if (rules.earnAmount && rules.earnPoints && payload.pointsPerCurrency === undefined) {
      payload.pointsPerCurrency = rules.earnPoints / rules.earnAmount;
    }
    if (rules.redeemAmount && rules.redeemPoints && payload.currencyPerPoint === undefined) {
      payload.currencyPerPoint = rules.redeemAmount / rules.redeemPoints;
    }

    payload.loyaltyRules = rules;

    const updated = await settingsRepository.updateTenantSettings(tenantId, payload);
    await this.logAudit(actor, tenantId, 'LOYALTY_SETTINGS_UPDATED', 'TenantSettings', updated.id, input, ip);
    return this.getLoyaltySettings(tenantId);
  }

  // ==========================================
  // 8. INCENTIVE SETTINGS
  // ==========================================
  async getIncentiveSettings(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return {
      incentiveEnabled: settings.incentiveEnabled,
      incentiveCalculationType: settings.incentiveCalculationType,
      incentiveRules: settings.incentiveRules,
    };
  }

  async updateIncentiveSettings(tenantId: string, input: IncentiveSettingsInput, actor?: Actor, ip?: string) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, input);
    await this.logAudit(actor, tenantId, 'INCENTIVE_SETTINGS_UPDATED', 'TenantSettings', updated.id, input, ip);
    return {
      incentiveEnabled: updated.incentiveEnabled,
      incentiveCalculationType: updated.incentiveCalculationType,
      incentiveRules: updated.incentiveRules,
    };
  }

  // ==========================================
  // 9. FOOTER CONTENT
  // ==========================================
  async getFooterContent(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return {
      footerText: settings.footerText,
      footerLinks: settings.footerLinks,
      contactInfo: settings.contactInfo,
    };
  }

  async updateFooterContent(tenantId: string, input: FooterContentInput, actor?: Actor, ip?: string) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, input);
    await this.logAudit(actor, tenantId, 'FOOTER_CONTENT_UPDATED', 'TenantSettings', updated.id, input, ip);
    return {
      footerText: updated.footerText,
      footerLinks: updated.footerLinks,
      contactInfo: updated.contactInfo,
    };
  }

  // ==========================================
  // 10. PRIVACY POLICY & TERMS
  // ==========================================
  async getPrivacyPolicy(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return { privacyPolicy: settings.privacyPolicy };
  }

  async updatePrivacyPolicy(tenantId: string, privacyPolicy?: string | null, actor?: Actor, ip?: string) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, { privacyPolicy });
    await this.logAudit(actor, tenantId, 'PRIVACY_POLICY_UPDATED', 'TenantSettings', updated.id, {}, ip);
    return { privacyPolicy: updated.privacyPolicy };
  }

  async getTermsConditions(tenantId: string) {
    const settings = await settingsRepository.getOrCreateTenantSettings(tenantId);
    return { termsAndConditions: settings.termsAndConditions };
  }

  async updateTermsConditions(tenantId: string, termsAndConditions?: string | null, actor?: Actor, ip?: string) {
    const updated = await settingsRepository.updateTenantSettings(tenantId, { termsAndConditions });
    await this.logAudit(actor, tenantId, 'TERMS_CONDITIONS_UPDATED', 'TenantSettings', updated.id, {}, ip);
    return { termsAndConditions: updated.termsAndConditions };
  }

  // ==========================================
  // 11. TAX MAPPINGS
  // ==========================================
  async createTaxMapping(tenantId: string, input: CreateTaxMappingInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const name = raw.name || raw.taxName;
    const rate = raw.rate !== undefined ? raw.rate : raw.taxValue;
    const isInclusive = raw.isInclusive ?? false;
    const applicableFor = raw.applicableFor || ['SERVICE', 'PRODUCT'];
    const description = raw.description;
    const isActive = raw.isActive ?? true;

    const existing = await settingsRepository.findTaxMappingByName(tenantId, name);
    if (existing) {
      throw new ConflictError(`Tax mapping '${name}' already exists in this company`);
    }

    const payload = {
      name,
      rate,
      isInclusive,
      applicableFor,
      description,
      isActive,
    };

    const record = await settingsRepository.createTaxMapping(tenantId, payload as any);
    await this.logAudit(actor, tenantId, 'TAX_MAPPING_CREATED', 'TaxMapping', record.id, { name: record.name, rate: record.rate }, ip);
    return record;
  }

  async listTaxMappings(tenantId: string, isActive?: boolean) {
    return settingsRepository.listTaxMappings(tenantId, isActive);
  }

  async getTaxMappingById(tenantId: string, id: string) {
    const record = await settingsRepository.getTaxMappingById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Tax mapping not found');
    }
    return record;
  }

  async updateTaxMapping(tenantId: string, id: string, input: UpdateTaxMappingInput, actor?: Actor, ip?: string) {
    await this.getTaxMappingById(tenantId, id);
    const raw = input as any;
    const name = raw.name || raw.taxName;

    if (name) {
      const existing = await settingsRepository.findTaxMappingByName(tenantId, name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Tax mapping '${name}' already exists in this company`);
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (raw.rate !== undefined) data.rate = raw.rate;
    else if (raw.taxValue !== undefined) data.rate = raw.taxValue;
    if (raw.isInclusive !== undefined) data.isInclusive = raw.isInclusive;
    if (raw.applicableFor !== undefined) data.applicableFor = raw.applicableFor;
    if (raw.description !== undefined) data.description = raw.description;
    if (raw.isActive !== undefined) data.isActive = raw.isActive;

    const updated = await settingsRepository.updateTaxMapping(tenantId, id, data);
    await this.logAudit(actor, tenantId, 'TAX_MAPPING_UPDATED', 'TaxMapping', id, input, ip);
    return updated;
  }

  async deleteTaxMapping(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getTaxMappingById(tenantId, id);
    const deleted = await settingsRepository.deleteTaxMapping(tenantId, id);
    await this.logAudit(actor, tenantId, 'TAX_MAPPING_DELETED', 'TaxMapping', id, { name: deleted.name }, ip);
    return { success: true, message: 'Tax mapping deleted successfully' };
  }

  // ==========================================
  // 12. MEMBERSHIPS
  // ==========================================
  async createMembership(tenantId: string, input: CreateMembershipInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const existing = await settingsRepository.findMembershipByName(tenantId, raw.name);
    if (existing) {
      throw new ConflictError(`Membership plan '${raw.name}' already exists in this company`);
    }

    const {
      name,
      price = raw.fees,
      validityDays = raw.validity,
      renewalReminderDays = raw.renewalReminder ?? 15,
      discountPercentage = 0,
      benefits,
      applicableServices = [],
      applicableProducts = [],
      isActive = true,
      membershipType,
      membershipSharable,
      benefitAmount,
    } = raw;

    let computedBenefits = benefits;
    if (!computedBenefits && (membershipType || benefitAmount !== undefined || membershipSharable !== undefined)) {
      computedBenefits = JSON.stringify({
        type: membershipType || 'FIXED',
        benefitAmount: benefitAmount || 0,
        sharable: membershipSharable ?? false,
      });
    }

    const payload: any = {
      name,
      price,
      validityDays,
      renewalReminderDays,
      discountPercentage,
      benefits: computedBenefits,
      applicableServices,
      applicableProducts,
      isActive,
    };

    const record = await settingsRepository.createMembership(tenantId, payload);
    await this.logAudit(actor, tenantId, 'MEMBERSHIP_CREATED', 'Membership', record.id, { name: record.name, price: record.price }, ip);
    return record;
  }

  async listMemberships(tenantId: string, isActive?: boolean) {
    return settingsRepository.listMemberships(tenantId, isActive);
  }

  async getMembershipById(tenantId: string, id: string) {
    const record = await settingsRepository.getMembershipById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Membership plan not found');
    }
    return record;
  }

  async updateMembership(tenantId: string, id: string, input: UpdateMembershipInput, actor?: Actor, ip?: string) {
    await this.getMembershipById(tenantId, id);
    const raw = input as any;

    if (raw.name) {
      const existing = await settingsRepository.findMembershipByName(tenantId, raw.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Membership plan '${raw.name}' already exists in this company`);
      }
    }

    const data: any = {};
    if (raw.name !== undefined) data.name = raw.name;
    if (raw.price !== undefined) data.price = raw.price;
    else if (raw.fees !== undefined) data.price = raw.fees;
    if (raw.validityDays !== undefined) data.validityDays = raw.validityDays;
    else if (raw.validity !== undefined) data.validityDays = raw.validity;
    if (raw.renewalReminderDays !== undefined) data.renewalReminderDays = raw.renewalReminderDays;
    else if (raw.renewalReminder !== undefined) data.renewalReminderDays = raw.renewalReminder;
    if (raw.discountPercentage !== undefined) data.discountPercentage = raw.discountPercentage;
    if (raw.applicableServices !== undefined) data.applicableServices = raw.applicableServices;
    if (raw.applicableProducts !== undefined) data.applicableProducts = raw.applicableProducts;
    if (raw.isActive !== undefined) data.isActive = raw.isActive;
    if (raw.benefits !== undefined) data.benefits = raw.benefits;

    const updated = await settingsRepository.updateMembership(tenantId, id, data);
    await this.logAudit(actor, tenantId, 'MEMBERSHIP_UPDATED', 'Membership', id, input, ip);
    return updated;
  }

  async deleteMembership(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getMembershipById(tenantId, id);
    const deleted = await settingsRepository.deleteMembership(tenantId, id);
    await this.logAudit(actor, tenantId, 'MEMBERSHIP_DELETED', 'Membership', id, { name: deleted.name }, ip);
    return { success: true, message: 'Membership plan deleted successfully' };
  }

  // ==========================================
  // 13. PACKAGES
  // ==========================================
  async createPackage(tenantId: string, input: CreatePackageInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const existing = await settingsRepository.findPackageByName(tenantId, raw.name);
    if (existing) {
      throw new ConflictError(`Package '${raw.name}' already exists in this company`);
    }

    const {
      name,
      price = raw.packagePrice,
      validityDays = raw.planValidity,
      renewalReminderDays = raw.renewalReminder ?? 15,
      services = raw.selectedServices || [],
      products = raw.selectedProducts || [],
      description,
      isActive = true,
    } = raw;

    const payload: any = {
      name,
      price,
      validityDays,
      renewalReminderDays,
      services,
      products,
      description,
      isActive,
    };

    const record = await settingsRepository.createPackage(tenantId, payload);
    await this.logAudit(actor, tenantId, 'PACKAGE_CREATED', 'Package', record.id, { name: record.name, price: record.price }, ip);
    return record;
  }

  async listPackages(tenantId: string, isActive?: boolean) {
    return settingsRepository.listPackages(tenantId, isActive);
  }

  async getPackageById(tenantId: string, id: string) {
    const record = await settingsRepository.getPackageById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Package not found');
    }
    return record;
  }

  async updatePackage(tenantId: string, id: string, input: UpdatePackageInput, actor?: Actor, ip?: string) {
    await this.getPackageById(tenantId, id);
    const raw = input as any;

    if (raw.name) {
      const existing = await settingsRepository.findPackageByName(tenantId, raw.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Package '${raw.name}' already exists in this company`);
      }
    }

    const data: any = {};
    if (raw.name !== undefined) data.name = raw.name;
    if (raw.price !== undefined) data.price = raw.price;
    if (raw.validityDays !== undefined) data.validityDays = raw.validityDays;
    else if (raw.planValidity !== undefined) data.validityDays = raw.planValidity;
    if (raw.renewalReminderDays !== undefined) data.renewalReminderDays = raw.renewalReminderDays;
    else if (raw.renewalReminder !== undefined) data.renewalReminderDays = raw.renewalReminder;
    if (raw.services !== undefined) data.services = raw.services;
    else if (raw.selectedServices !== undefined) data.services = raw.selectedServices;
    if (raw.products !== undefined) data.products = raw.products;
    else if (raw.selectedProducts !== undefined) data.products = raw.selectedProducts;
    if (raw.description !== undefined) data.description = raw.description;
    if (raw.isActive !== undefined) data.isActive = raw.isActive;

    const updated = await settingsRepository.updatePackage(tenantId, id, data);
    await this.logAudit(actor, tenantId, 'PACKAGE_UPDATED', 'Package', id, input, ip);
    return updated;
  }

  async deletePackage(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getPackageById(tenantId, id);
    const deleted = await settingsRepository.deletePackage(tenantId, id);
    await this.logAudit(actor, tenantId, 'PACKAGE_DELETED', 'Package', id, { name: deleted.name }, ip);
    return { success: true, message: 'Package deleted successfully' };
  }

  // ==========================================
  // 14. GIFT CARDS
  // ==========================================
  async createGiftCard(tenantId: string, input: CreateGiftCardInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    let code = raw.code;
    if (!code) {
      code = `GC-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    }
    const existing = await settingsRepository.findGiftCardByCode(tenantId, code);
    if (existing) {
      throw new ConflictError(`Gift card code '${code}' already exists in this company`);
    }

    const {
      name,
      amount = raw.price,
      validityDays = raw.validity,
      terms = raw.description,
      isActive = true,
    } = raw;

    const payload: any = {
      name,
      code,
      amount,
      validityDays,
      terms,
      isActive,
    };

    const record = await settingsRepository.createGiftCard(tenantId, payload);
    await this.logAudit(actor, tenantId, 'GIFT_CARD_CREATED', 'GiftCard', record.id, { code: record.code, amount: record.amount }, ip);
    return record;
  }

  async listGiftCards(tenantId: string, isActive?: boolean) {
    return settingsRepository.listGiftCards(tenantId, isActive);
  }

  async getGiftCardById(tenantId: string, id: string) {
    const record = await settingsRepository.getGiftCardById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Gift card not found');
    }
    return record;
  }

  async updateGiftCard(tenantId: string, id: string, input: UpdateGiftCardInput, actor?: Actor, ip?: string) {
    await this.getGiftCardById(tenantId, id);
    const raw = input as any;

    if (raw.code) {
      const existing = await settingsRepository.findGiftCardByCode(tenantId, raw.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Gift card code '${raw.code}' already exists in this company`);
      }
    }

    const data: any = {};
    if (raw.name !== undefined) data.name = raw.name;
    if (raw.code !== undefined) data.code = raw.code;
    if (raw.amount !== undefined) data.amount = raw.amount;
    else if (raw.price !== undefined) data.amount = raw.price;
    if (raw.validityDays !== undefined) data.validityDays = raw.validityDays;
    else if (raw.validity !== undefined) data.validityDays = raw.validity;
    if (raw.terms !== undefined) data.terms = raw.terms;
    else if (raw.description !== undefined) data.terms = raw.description;
    if (raw.isActive !== undefined) data.isActive = raw.isActive;

    const updated = await settingsRepository.updateGiftCard(tenantId, id, data);
    await this.logAudit(actor, tenantId, 'GIFT_CARD_UPDATED', 'GiftCard', id, input, ip);
    return updated;
  }

  async deleteGiftCard(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getGiftCardById(tenantId, id);
    const deleted = await settingsRepository.deleteGiftCard(tenantId, id);
    await this.logAudit(actor, tenantId, 'GIFT_CARD_DELETED', 'GiftCard', id, { code: deleted.code }, ip);
    return { success: true, message: 'Gift card deleted successfully' };
  }

  // ==========================================
  // 15. COUPONS
  // ==========================================
  async createCoupon(tenantId: string, input: CreateCouponInput, actor?: Actor, ip?: string) {
    const existing = await settingsRepository.findCouponByCode(tenantId, input.code);
    if (existing) {
      throw new ConflictError(`Coupon code '${input.code}' already exists in this company`);
    }

    const record = await settingsRepository.createCoupon(tenantId, input as any);
    await this.logAudit(actor, tenantId, 'COUPON_CREATED', 'Coupon', record.id, { code: record.code, discount: record.discountValue }, ip);
    return record;
  }

  async listCoupons(tenantId: string, isActive?: boolean) {
    return settingsRepository.listCoupons(tenantId, isActive);
  }

  async getCouponById(tenantId: string, id: string) {
    const record = await settingsRepository.getCouponById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Coupon not found');
    }
    return record;
  }

  async updateCoupon(tenantId: string, id: string, input: UpdateCouponInput, actor?: Actor, ip?: string) {
    await this.getCouponById(tenantId, id);

    if (input.code) {
      const existing = await settingsRepository.findCouponByCode(tenantId, input.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Coupon code '${input.code}' already exists in this company`);
      }
    }

    const updated = await settingsRepository.updateCoupon(tenantId, id, input as any);
    await this.logAudit(actor, tenantId, 'COUPON_UPDATED', 'Coupon', id, input, ip);
    return updated;
  }

  async deleteCoupon(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getCouponById(tenantId, id);
    const deleted = await settingsRepository.deleteCoupon(tenantId, id);
    await this.logAudit(actor, tenantId, 'COUPON_DELETED', 'Coupon', id, { code: deleted.code }, ip);
    return { success: true, message: 'Coupon deleted successfully' };
  }

  // ==========================================
  // 16. PNL CATEGORIES
  // ==========================================
  async createPnlCategory(tenantId: string, input: CreatePnlCategoryInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const name = raw.name;
    const type = raw.type || 'EXPENSE';
    const description = raw.description;
    const isActive = raw.isActive ?? true;

    const existing = await settingsRepository.findPnlCategoryByName(tenantId, name);
    if (existing) {
      throw new ConflictError(`P&L category '${name}' already exists in this company`);
    }

    const payload = { name, type, description, isActive };
    const record = await settingsRepository.createPnlCategory(tenantId, payload as any);
    await this.logAudit(actor, tenantId, 'PNL_CATEGORY_CREATED', 'PnlCategory', record.id, { name: record.name, type: record.type }, ip);
    return record;
  }

  async listPnlCategories(tenantId: string, type?: string, isActive?: boolean) {
    return settingsRepository.listPnlCategories(tenantId, type, isActive);
  }

  async getPnlCategoryById(tenantId: string, id: string) {
    const record = await settingsRepository.getPnlCategoryById(tenantId, id);
    if (!record) {
      throw new NotFoundError('P&L category not found');
    }
    return record;
  }

  async updatePnlCategory(tenantId: string, id: string, input: UpdatePnlCategoryInput, actor?: Actor, ip?: string) {
    await this.getPnlCategoryById(tenantId, id);

    if (input.name) {
      const existing = await settingsRepository.findPnlCategoryByName(tenantId, input.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`P&L category '${input.name}' already exists in this company`);
      }
    }

    const updated = await settingsRepository.updatePnlCategory(tenantId, id, input as any);
    await this.logAudit(actor, tenantId, 'PNL_CATEGORY_UPDATED', 'PnlCategory', id, input, ip);
    return updated;
  }

  async deletePnlCategory(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getPnlCategoryById(tenantId, id);
    const deleted = await settingsRepository.deletePnlCategory(tenantId, id);
    await this.logAudit(actor, tenantId, 'PNL_CATEGORY_DELETED', 'PnlCategory', id, { name: deleted.name }, ip);
    return { success: true, message: 'P&L category deleted successfully' };
  }

  // ==========================================
  // 17. PNL INCOME TAXES
  // ==========================================
  async createPnlIncomeTax(tenantId: string, input: CreatePnlIncomeTaxInput, actor?: Actor, ip?: string) {
    const raw = input as any;
    const fromAmount = raw.fromAmount !== undefined ? raw.fromAmount : raw.slabFrom;
    const toAmount = raw.toAmount !== undefined ? raw.toAmount : raw.slabTo;
    const taxRate = raw.taxRate !== undefined ? raw.taxRate : raw.taxValue;
    const description = raw.description;
    const isActive = raw.isActive ?? true;

    if (fromAmount >= toAmount) {
      throw new BadRequestError('From amount must be strictly less than To amount');
    }

    const overlap = await settingsRepository.findOverlappingIncomeTax(
      tenantId,
      fromAmount,
      toAmount
    );
    if (overlap) {
      throw new ConflictError(
        `Income tax slab [${fromAmount} - ${toAmount}] overlaps with existing slab [${Number(overlap.fromAmount)} - ${Number(overlap.toAmount)}]`
      );
    }

    const payload = { fromAmount, toAmount, taxRate, description, isActive };
    const record = await settingsRepository.createPnlIncomeTax(tenantId, payload as any);
    await this.logAudit(actor, tenantId, 'PNL_INCOME_TAX_CREATED', 'PnlIncomeTax', record.id, payload, ip);
    return record;
  }

  async listPnlIncomeTaxes(tenantId: string, isActive?: boolean) {
    return settingsRepository.listPnlIncomeTaxes(tenantId, isActive);
  }

  async getPnlIncomeTaxById(tenantId: string, id: string) {
    const record = await settingsRepository.getPnlIncomeTaxById(tenantId, id);
    if (!record) {
      throw new NotFoundError('P&L income tax slab not found');
    }
    return record;
  }

  async updatePnlIncomeTax(tenantId: string, id: string, input: UpdatePnlIncomeTaxInput, actor?: Actor, ip?: string) {
    const current = await this.getPnlIncomeTaxById(tenantId, id);
    const raw = input as any;

    const fromAmount = raw.fromAmount !== undefined ? raw.fromAmount : (raw.slabFrom !== undefined ? raw.slabFrom : Number(current.fromAmount));
    const toAmount = raw.toAmount !== undefined ? raw.toAmount : (raw.slabTo !== undefined ? raw.slabTo : Number(current.toAmount));
    const taxRate = raw.taxRate !== undefined ? raw.taxRate : (raw.taxValue !== undefined ? raw.taxValue : Number(current.taxRate));

    if (fromAmount >= toAmount) {
      throw new BadRequestError('From amount must be strictly less than To amount');
    }

    if (raw.isActive !== false) {
      const overlap = await settingsRepository.findOverlappingIncomeTax(
        tenantId,
        fromAmount,
        toAmount,
        id
      );
      if (overlap) {
        throw new ConflictError(
          `Income tax slab [${fromAmount} - ${toAmount}] overlaps with existing slab [${Number(overlap.fromAmount)} - ${Number(overlap.toAmount)}]`
        );
      }
    }

    const data: any = { fromAmount, toAmount, taxRate };
    if (raw.description !== undefined) data.description = raw.description;
    if (raw.isActive !== undefined) data.isActive = raw.isActive;

    const updated = await settingsRepository.updatePnlIncomeTax(tenantId, id, data);
    await this.logAudit(actor, tenantId, 'PNL_INCOME_TAX_UPDATED', 'PnlIncomeTax', id, input, ip);
    return updated;
  }

  async deletePnlIncomeTax(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getPnlIncomeTaxById(tenantId, id);
    await settingsRepository.deletePnlIncomeTax(tenantId, id);
    await this.logAudit(actor, tenantId, 'PNL_INCOME_TAX_DELETED', 'PnlIncomeTax', id, {}, ip);
    return { success: true, message: 'P&L income tax slab deleted successfully' };
  }

  // ==========================================
  // 18. CRM SEGMENTS
  // ==========================================
  async createCrmSegment(tenantId: string, input: CreateCrmSegmentInput, actor?: Actor, ip?: string) {
    const existing = await settingsRepository.findCrmSegmentByName(tenantId, input.name);
    if (existing) {
      throw new ConflictError(`CRM segment '${input.name}' already exists in this company`);
    }

    const record = await settingsRepository.createCrmSegment(tenantId, input as any);
    await this.logAudit(actor, tenantId, 'CRM_SEGMENT_CREATED', 'CrmSegment', record.id, { name: record.name }, ip);
    return record;
  }

  async listCrmSegments(tenantId: string, isActive?: boolean) {
    return settingsRepository.listCrmSegments(tenantId, isActive);
  }

  async getCrmSegmentById(tenantId: string, id: string) {
    const record = await settingsRepository.getCrmSegmentById(tenantId, id);
    if (!record) {
      throw new NotFoundError('CRM segment not found');
    }
    return record;
  }

  async updateCrmSegment(tenantId: string, id: string, input: UpdateCrmSegmentInput, actor?: Actor, ip?: string) {
    await this.getCrmSegmentById(tenantId, id);

    if (input.name) {
      const existing = await settingsRepository.findCrmSegmentByName(tenantId, input.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`CRM segment '${input.name}' already exists in this company`);
      }
    }

    const updated = await settingsRepository.updateCrmSegment(tenantId, id, input as any);
    await this.logAudit(actor, tenantId, 'CRM_SEGMENT_UPDATED', 'CrmSegment', id, input, ip);
    return updated;
  }

  async deleteCrmSegment(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getCrmSegmentById(tenantId, id);
    const deleted = await settingsRepository.deleteCrmSegment(tenantId, id);
    await this.logAudit(actor, tenantId, 'CRM_SEGMENT_DELETED', 'CrmSegment', id, { name: deleted.name }, ip);
    return { success: true, message: 'CRM segment deleted successfully' };
  }

  // ==========================================
  // 19. CUSTOM FORMS
  // ==========================================
  async createCustomForm(tenantId: string, input: CreateCustomFormInput, actor?: Actor, ip?: string) {
    const existing = await settingsRepository.findCustomFormByName(tenantId, input.name);
    if (existing) {
      throw new ConflictError(`Custom form '${input.name}' already exists in this company`);
    }

    const record = await settingsRepository.createCustomForm(tenantId, input as any);
    await this.logAudit(actor, tenantId, 'CUSTOM_FORM_CREATED', 'CustomForm', record.id, { name: record.name }, ip);
    return record;
  }

  async listCustomForms(tenantId: string, isActive?: boolean) {
    return settingsRepository.listCustomForms(tenantId, isActive);
  }

  async getCustomFormById(tenantId: string, id: string) {
    const record = await settingsRepository.getCustomFormById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Custom form not found');
    }
    return record;
  }

  async updateCustomForm(tenantId: string, id: string, input: UpdateCustomFormInput, actor?: Actor, ip?: string) {
    await this.getCustomFormById(tenantId, id);

    if (input.name) {
      const existing = await settingsRepository.findCustomFormByName(tenantId, input.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Custom form '${input.name}' already exists in this company`);
      }
    }

    const updated = await settingsRepository.updateCustomForm(tenantId, id, input as any);
    await this.logAudit(actor, tenantId, 'CUSTOM_FORM_UPDATED', 'CustomForm', id, input, ip);
    return updated;
  }

  async deleteCustomForm(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getCustomFormById(tenantId, id);
    const deleted = await settingsRepository.deleteCustomForm(tenantId, id);
    await this.logAudit(actor, tenantId, 'CUSTOM_FORM_DELETED', 'CustomForm', id, { name: deleted.name }, ip);
    return { success: true, message: 'Custom form deleted successfully' };
  }

  // ==========================================
  // 20. SALUTATIONS
  // ==========================================
  async createSalutation(tenantId: string, input: CreateSalutationInput, actor?: Actor, ip?: string) {
    const existing = await settingsRepository.findSalutationByTitle(tenantId, input.title);
    if (existing) {
      throw new ConflictError(`Salutation '${input.title}' already exists in this company`);
    }

    const record = await settingsRepository.createSalutation(tenantId, input as any);
    await this.logAudit(actor, tenantId, 'SALUTATION_CREATED', 'Salutation', record.id, { title: record.title }, ip);
    return record;
  }

  async listSalutations(tenantId: string, isActive?: boolean) {
    return settingsRepository.listSalutations(tenantId, isActive);
  }

  async getSalutationById(tenantId: string, id: string) {
    const record = await settingsRepository.getSalutationById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Salutation not found');
    }
    return record;
  }

  async updateSalutation(tenantId: string, id: string, input: UpdateSalutationInput, actor?: Actor, ip?: string) {
    await this.getSalutationById(tenantId, id);

    if (input.title) {
      const existing = await settingsRepository.findSalutationByTitle(tenantId, input.title);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Salutation '${input.title}' already exists in this company`);
      }
    }

    const updated = await settingsRepository.updateSalutation(tenantId, id, input as any);
    await this.logAudit(actor, tenantId, 'SALUTATION_UPDATED', 'Salutation', id, input, ip);
    return updated;
  }

  async deleteSalutation(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getSalutationById(tenantId, id);
    const deleted = await settingsRepository.deleteSalutation(tenantId, id);
    await this.logAudit(actor, tenantId, 'SALUTATION_DELETED', 'Salutation', id, { title: deleted.title }, ip);
    return { success: true, message: 'Salutation deleted successfully' };
  }

  // ==========================================
  // 21. DESIGNATIONS (REUSED)
  // ==========================================
  async createDesignation(tenantId: string, name: string, description?: string, actor?: Actor, ip?: string) {
    const existing = await settingsRepository.findDesignationByName(tenantId, name);
    if (existing) {
      throw new ConflictError(`Designation '${name}' already exists in this company`);
    }

    const record = await settingsRepository.createDesignation(tenantId, name, description);
    await this.logAudit(actor, tenantId, 'DESIGNATION_CREATED', 'Designation', record.id, { name }, ip);
    return record;
  }

  async listDesignations(tenantId: string) {
    return settingsRepository.listDesignations(tenantId);
  }

  async getDesignationById(tenantId: string, id: string) {
    const record = await settingsRepository.getDesignationById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Designation not found');
    }
    return record;
  }

  async updateDesignation(
    tenantId: string,
    id: string,
    data: { name?: string; description?: string },
    actor?: Actor,
    ip?: string
  ) {
    await this.getDesignationById(tenantId, id);

    if (data.name) {
      const existing = await settingsRepository.findDesignationByName(tenantId, data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Designation '${data.name}' already exists in this company`);
      }
    }

    const updated = await settingsRepository.updateDesignation(tenantId, id, data);
    await this.logAudit(actor, tenantId, 'DESIGNATION_UPDATED', 'Designation', id, data, ip);
    return updated;
  }

  async deleteDesignation(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getDesignationById(tenantId, id);

    const inUse = await settingsRepository.checkDesignationInUse(tenantId, id);
    if (inUse) {
      throw new ConflictError('Cannot delete designation assigned to active staff members');
    }

    const deleted = await settingsRepository.deleteDesignation(tenantId, id);
    await this.logAudit(actor, tenantId, 'DESIGNATION_DELETED', 'Designation', id, { name: deleted.name }, ip);
    return { success: true, message: 'Designation deleted successfully' };
  }

  // ==========================================
  // 22. SHIFTS (REUSED)
  // ==========================================
  private normalizeDayTimings(
    rawTimings?: any[],
    defaultStartTime = '09:00 AM',
    defaultEndTime = '06:00 PM',
    allDaysUniform = false
  ) {
    const daysList = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };

    if (allDaysUniform || !rawTimings || rawTimings.length === 0) {
      return daysList.map((day, idx) => ({
        day,
        dayOfWeek: idx,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        isOff: false,
      }));
    }

    const timingsByDay: Record<number, any> = {};
    for (const t of rawTimings) {
      let dayOfWeek: number | undefined = t.dayOfWeek;
      if (dayOfWeek === undefined && t.day) {
        dayOfWeek = dayMap[String(t.day).toUpperCase().trim()];
      }
      if (dayOfWeek !== undefined && dayOfWeek >= 0 && dayOfWeek <= 6) {
        timingsByDay[dayOfWeek] = {
          day: daysList[dayOfWeek],
          dayOfWeek,
          startTime: t.startTime || defaultStartTime,
          endTime: t.endTime || defaultEndTime,
          isOff: Boolean(t.isOff),
        };
      }
    }

    return daysList.map((day, idx) => {
      if (timingsByDay[idx]) return timingsByDay[idx];
      return {
        day,
        dayOfWeek: idx,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        isOff: false,
      };
    });
  }

  private normalizeBreaks(rawBreaks?: any[]) {
    if (!Array.isArray(rawBreaks)) return [];
    return rawBreaks.map((b) => ({
      name: b.name || b.breakName || 'Break',
      from: b.from || b.startTime || '13:00',
      to: b.to || b.endTime || '14:00',
      isActive: b.isActive !== undefined ? Boolean(b.isActive) : (b.active !== undefined ? Boolean(b.active) : true),
    }));
  }

  async createShift(
    tenantId: string,
    input: any,
    actor?: Actor,
    ip?: string
  ) {
    const name = (input.name || input.shiftName || '').trim();
    if (!name) {
      throw new BadRequestError('Shift name is required');
    }

    const existing = await settingsRepository.findShiftByName(tenantId, name);
    if (existing) {
      throw new ConflictError(`Shift '${name}' already exists in this company`);
    }

    const isActive = input.isActive !== undefined ? Boolean(input.isActive) : (input.active !== undefined ? Boolean(input.active) : true);
    const rawTimings = input.timings || input.shiftTiming;
    const allDays = Boolean(input.allDays);
    const startTime = input.startTime || (rawTimings && rawTimings[0]?.startTime) || '09:00 AM';
    const endTime = input.endTime || (rawTimings && rawTimings[0]?.endTime) || '06:00 PM';
    const timings = this.normalizeDayTimings(rawTimings, startTime, endTime, allDays);
    const breaks = this.normalizeBreaks(input.breaks || input.shiftBreaks);

    const record = await settingsRepository.createShift(tenantId, {
      name,
      isActive,
      startTime,
      endTime,
      timings,
      breaks,
    });
    await this.logAudit(actor, tenantId, 'SHIFT_CREATED', 'Shift', record.id, { name, startTime, endTime, isActive }, ip);
    return record;
  }

  async listShifts(tenantId: string, filters?: { isActive?: boolean; search?: string }) {
    return settingsRepository.listShifts(tenantId, filters);
  }

  async getShiftById(tenantId: string, id: string) {
    const record = await settingsRepository.getShiftById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Shift not found');
    }
    return record;
  }

  async updateShift(
    tenantId: string,
    id: string,
    input: any,
    actor?: Actor,
    ip?: string
  ) {
    const existingShift = await this.getShiftById(tenantId, id);

    const name = (input.name || input.shiftName || '').trim();
    if (name && name !== existingShift.name) {
      const existing = await settingsRepository.findShiftByName(tenantId, name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Shift '${name}' already exists in this company`);
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (input.isActive !== undefined) updateData.isActive = Boolean(input.isActive);
    if (input.active !== undefined) updateData.isActive = Boolean(input.active);
    if (input.startTime !== undefined) updateData.startTime = input.startTime;
    if (input.endTime !== undefined) updateData.endTime = input.endTime;

    if (input.timings !== undefined || input.shiftTiming !== undefined || input.allDays !== undefined) {
      const baseStart = updateData.startTime || existingShift.startTime || '09:00 AM';
      const baseEnd = updateData.endTime || existingShift.endTime || '06:00 PM';
      updateData.timings = this.normalizeDayTimings(
        input.timings || input.shiftTiming,
        baseStart,
        baseEnd,
        Boolean(input.allDays)
      );
    }

    if (input.breaks !== undefined || input.shiftBreaks !== undefined) {
      updateData.breaks = this.normalizeBreaks(input.breaks || input.shiftBreaks);
    }

    const updated = await settingsRepository.updateShift(tenantId, id, updateData);
    await this.logAudit(actor, tenantId, 'SHIFT_UPDATED', 'Shift', id, updateData, ip);
    return updated;
  }

  async toggleShiftStatus(tenantId: string, id: string, isActive?: boolean, actor?: Actor, ip?: string) {
    const shift = await this.getShiftById(tenantId, id);
    const newStatus = isActive !== undefined ? Boolean(isActive) : !shift.isActive;
    const updated = await settingsRepository.updateShift(tenantId, id, { isActive: newStatus });
    await this.logAudit(actor, tenantId, 'SHIFT_STATUS_TOGGLED', 'Shift', id, { isActive: newStatus }, ip);
    return updated;
  }

  async addShiftBreak(tenantId: string, id: string, breakItem: any, actor?: Actor, ip?: string) {
    const shift = await this.getShiftById(tenantId, id);
    const normalized = this.normalizeBreaks([breakItem])[0];
    const currentBreaks = Array.isArray(shift.breaks) ? (shift.breaks as any[]) : [];
    const updatedBreaks = [...currentBreaks, normalized];
    const updated = await settingsRepository.updateShift(tenantId, id, { breaks: updatedBreaks });
    await this.logAudit(actor, tenantId, 'SHIFT_BREAK_ADDED', 'Shift', id, { break: normalized }, ip);
    return updated;
  }

  async deleteShiftBreak(tenantId: string, id: string, breakIndex: number, actor?: Actor, ip?: string) {
    const shift = await this.getShiftById(tenantId, id);
    const currentBreaks = Array.isArray(shift.breaks) ? (shift.breaks as any[]) : [];
    if (breakIndex < 0 || breakIndex >= currentBreaks.length) {
      throw new BadRequestError(`Invalid break index: ${breakIndex}`);
    }
    const removedBreak = currentBreaks[breakIndex];
    const updatedBreaks = currentBreaks.filter((_, idx) => idx !== breakIndex);
    const updated = await settingsRepository.updateShift(tenantId, id, { breaks: updatedBreaks });
    await this.logAudit(actor, tenantId, 'SHIFT_BREAK_DELETED', 'Shift', id, { removedBreak }, ip);
    return updated;
  }

  async deleteShift(tenantId: string, id: string, actor?: Actor, ip?: string) {
    await this.getShiftById(tenantId, id);

    const inUse = await settingsRepository.checkShiftInUse(tenantId, id);
    if (inUse) {
      throw new ConflictError('Cannot delete shift assigned to staff schedules');
    }

    const deleted = await settingsRepository.deleteShift(tenantId, id);
    await this.logAudit(actor, tenantId, 'SHIFT_DELETED', 'Shift', id, { name: deleted.name }, ip);
    return { success: true, message: 'Shift deleted successfully' };
  }

  async applyShiftToStaffRoster(
    tenantId: string,
    input: { shiftId: string; staffIds: string[]; daysOfWeek?: number[] },
    actor?: Actor,
    ip?: string
  ) {
    const shift = await this.getShiftById(tenantId, input.shiftId);
    if (!shift.isActive) {
      throw new BadRequestError(`Cannot assign inactive shift '${shift.name}'`);
    }

    const result = await settingsRepository.applyShiftToStaff(
      tenantId,
      input.shiftId,
      input.staffIds,
      input.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]
    );

    await this.logAudit(
      actor,
      tenantId,
      'ROSTER_SHIFT_APPLIED',
      'StaffWeeklySchedule',
      input.shiftId,
      { staffCount: input.staffIds.length, days: input.daysOfWeek },
      ip
    );
    return result;
  }

  // ==========================================
  // 23. ROSTER (REUSED)
  // ==========================================
  async getRoster(tenantId: string) {
    return settingsRepository.getRoster(tenantId);
  }

  async updateStaffRoster(
    tenantId: string,
    staffId: string,
    input: UpdateStaffRosterInput,
    actor?: Actor,
    ip?: string
  ) {
    const updated = await settingsRepository.updateStaffRoster(tenantId, staffId, input.schedules);
    if (!updated) {
      throw new NotFoundError('Staff member not found in this company');
    }
    await this.logAudit(actor, tenantId, 'ROSTER_UPDATED', 'StaffWeeklySchedule', staffId, { dayCount: input.schedules.length }, ip);
    return updated;
  }

  // ==========================================
  // 24. ACCESS CONTROL (RBAC)
  // ==========================================
  async listRoles() {
    return settingsRepository.listRoles();
  }

  async listPermissions() {
    return settingsRepository.listPermissions();
  }

  async listTenantUsersWithRoles(tenantId: string) {
    return settingsRepository.listTenantUsersWithRoles(tenantId);
  }
}

export const settingsService = new SettingsService();
