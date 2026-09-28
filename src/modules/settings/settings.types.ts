export type BusinessStatus = 'OPEN' | 'CLOSED';
export type ApplicableGender = 'Both' | 'Female' | 'Male';

export interface GenericSettingsInput {
  businessStatus?: BusinessStatus;
  openingTime?: string;
  closingTime?: string;
  genderSpecification?: ApplicableGender;
  weeklyOffDays?: number[]; // [0, 6] etc.
}

export interface ProductOrderingSettingsInput {
  homeDeliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  codEnabled?: boolean;
  cashOnPickupEnabled?: boolean;
  minOrderValue?: number;
  deliveryFee?: number;
}

export interface OnlinePaymentSettingsInput {
  onlinePaymentEnabled?: boolean;
  paymentGateways?: Array<{
    provider: string; // "Razorpay" | "Stripe" | "Paytm" | "UPI"
    isActive: boolean;
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
    merchantId?: string;
  }>;
  applyToOrders?: boolean;
  applyToAppointments?: boolean;
}

export interface NotificationSettingsInput {
  notificationsConfig?: {
    smsEnabled?: boolean;
    emailEnabled?: boolean;
    whatsappEnabled?: boolean;
    events?: {
      appointmentBooked?: boolean;
      appointmentCancelled?: boolean;
      appointmentReminder?: boolean;
      invoiceGenerated?: boolean;
      feedbackRequest?: boolean;
      membershipWelcome?: boolean;
    };
    smsProvider?: {
      provider?: string;
      senderId?: string;
      apiKey?: string;
    };
    emailProvider?: {
      provider?: string;
      fromEmail?: string;
      fromName?: string;
      apiKey?: string;
    };
  };
}

export interface FeedbackSettingsInput {
  feedbackEnabled?: boolean;
  ratingScale?: number;
  sendFeedbackSms?: boolean;
  sendFeedbackEmail?: boolean;
  feedbackQuestions?: Array<{
    id: string;
    question: string;
    type: 'RATING' | 'TEXT' | 'BOOLEAN';
    required?: boolean;
  }>;
}

export interface ReferralSettingsInput {
  referralsEnabled?: boolean;
  referrerRewardType?: 'FIXED' | 'PERCENTAGE' | 'POINTS';
  referrerRewardValue?: number;
  refereeRewardType?: 'FIXED' | 'PERCENTAGE' | 'POINTS';
  refereeRewardValue?: number;
  referralMinOrder?: number;
  referralValidityDays?: number;
}

export interface LoyaltySettingsInput {
  loyaltyEnabled?: boolean;
  pointsPerCurrency?: number; // e.g., 1 pt per ₹20
  currencyPerPoint?: number;  // e.g., ₹1 per pt
  minRedeemPoints?: number;
  maxRedeemPointsPerOrder?: number;
  loyaltyExpiryDays?: number;
  earnIndividually?: boolean;
  earnLoyaltyIndividually?: boolean;
  skipOnRedemption?: boolean;
  skipEarningOnRedemption?: boolean;
  earnOnMembership?: boolean;
  earnOnPercentageMembership?: boolean;
  earnAmount?: number;
  earnSpent?: number;
  earnPoints?: number;
  redeemIndividually?: boolean;
  redeemLoyaltyIndividually?: boolean;
  redeemPoints?: number;
  redeemAmount?: number;
  redeemValue?: number;
  maxRedeemPercentage?: number;
  percentageRedeemableOnOrder?: number;
}

export interface IncentiveSettingsInput {
  incentiveEnabled?: boolean;
  incentiveCalculationType?: 'SLAB' | 'PERCENTAGE' | 'FLAT';
  incentiveRules?: Array<{
    targetType: 'SERVICE' | 'PRODUCT' | 'OVERALL';
    minAmount: number;
    maxAmount?: number;
    percentage?: number;
    flatBonus?: number;
  }>;
}

export interface FooterContentInput {
  footerText?: string;
  footerLinks?: Array<{
    title: string;
    url: string;
  }>;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
    socialMedia?: Record<string, string>;
  };
}

export interface LegalContentInput {
  privacyPolicy?: string;
  termsAndConditions?: string;
}

// Entity Master Types
export interface CreateTaxMappingInput {
  name: string;
  rate: number;
  isInclusive?: boolean;
  applicableFor?: Array<'SERVICE' | 'PRODUCT' | 'MEMBERSHIP' | 'PACKAGES'>;
  isActive?: boolean;
  description?: string;
}

export interface UpdateTaxMappingInput extends Partial<CreateTaxMappingInput> {}

export interface CreateMembershipInput {
  name: string;
  price: number;
  validityDays: number;
  renewalReminderDays?: number;
  discountPercentage?: number;
  benefits?: string;
  applicableServices?: string[];
  applicableProducts?: string[];
  isActive?: boolean;
}

export interface UpdateMembershipInput extends Partial<CreateMembershipInput> {}

export interface CreatePackageInput {
  name: string;
  price: number;
  validityDays: number;
  renewalReminderDays?: number;
  services?: Array<{ serviceId: string; quantity: number }>;
  products?: Array<{ productId: string; quantity: number }>;
  description?: string;
  isActive?: boolean;
}

export interface UpdatePackageInput extends Partial<CreatePackageInput> {}

export interface CreateGiftCardInput {
  name: string;
  code: string;
  amount: number;
  validityDays: number;
  terms?: string;
  isActive?: boolean;
}

export interface UpdateGiftCardInput extends Partial<CreateGiftCardInput> {}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
  startDate?: string;
  endDate?: string;
  usageLimit?: number;
  applicableServices?: string[];
  applicableProducts?: string[];
  isActive?: boolean;
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {}

export interface CreatePnlCategoryInput {
  name: string;
  type: 'EXPENSE' | 'INCOME';
  description?: string;
  isActive?: boolean;
}

export interface UpdatePnlCategoryInput extends Partial<CreatePnlCategoryInput> {}

export interface CreatePnlIncomeTaxInput {
  fromAmount: number;
  toAmount: number;
  taxRate: number;
  description?: string;
  isActive?: boolean;
}

export interface UpdatePnlIncomeTaxInput extends Partial<CreatePnlIncomeTaxInput> {}

export interface CreateCrmSegmentInput {
  name: string;
  description?: string;
  criteria?: Record<string, any>;
  isActive?: boolean;
}

export interface UpdateCrmSegmentInput extends Partial<CreateCrmSegmentInput> {}

export interface CustomFormField {
  id: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'CHECKBOX' | 'DATE' | 'TEXTAREA';
  required: boolean;
  options?: string[];
}

export interface CreateCustomFormInput {
  name: string;
  description?: string;
  fields: CustomFormField[];
  isActive?: boolean;
}

export interface UpdateCustomFormInput extends Partial<CreateCustomFormInput> {}

export interface CreateSalutationInput {
  title: string;
  isActive?: boolean;
}

export interface UpdateSalutationInput extends Partial<CreateSalutationInput> {}

export interface UpdateRosterStaffDayInput {
  dayOfWeek: number; // 0 to 6
  shiftId?: string | null;
  isWeeklyOff: boolean;
}

export interface UpdateStaffRosterInput {
  schedules: UpdateRosterStaffDayInput[];
}
