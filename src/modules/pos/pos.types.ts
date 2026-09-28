export type PosOrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PENDING';

export type PosPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'HDFC'
  | 'GPAY'
  | 'PHONEPE'
  | 'BALANCE'
  | 'SPLIT';

export type PosItemType = 'SERVICE' | 'PRODUCT';

export type PosDiscountType = 'PERCENTAGE' | 'FIXED';

export interface PosPaymentInput {
  method: string;
  amount: number;
  referenceNumber?: string;
}

export interface CreateOrderItemInput {
  itemType: PosItemType;
  serviceId?: string | null;
  productId?: string | null;
  staffId?: string | null;
  itemName?: string;
  itemCategory?: string | null;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  notes?: string | null;
}

export interface QuickGuestInput {
  name: string;
  mobile: string;
  email?: string | null;
  gender?: string | null;
  dob?: string | Date | null;
  dateOfBirth?: string | Date | null;
  anniversary?: string | Date | null;
  anniversaryDate?: string | Date | null;
  gstNumber?: string | null;
  hairType?: string | null;
  alternateMobile?: string | null;
  salutationId?: string | null;
}

export interface CreatePosOrderInput {
  guestId?: string;
  guest?: QuickGuestInput;
  cashierId?: string | null;
  orderDate?: string | Date;
  status?: PosOrderStatus;
  items: CreateOrderItemInput[];
  discountType?: PosDiscountType;
  discountValue?: number;
  discountAmount?: number;
  couponCode?: string | null;
  giftCardCode?: string | null;
  referralCode?: string | null;
  redeemLoyaltyPoints?: number;
  tipAmount?: number;
  paymentMethod?: string;
  payments?: PosPaymentInput[];
  notes?: string | null;
  instruction?: string | null;
}

export interface UpdatePosOrderInput {
  guestId?: string;
  items?: CreateOrderItemInput[];
  status?: PosOrderStatus;
  discountType?: PosDiscountType;
  discountValue?: number;
  discountAmount?: number;
  couponCode?: string | null;
  giftCardCode?: string | null;
  referralCode?: string | null;
  tipAmount?: number;
  paymentMethod?: string;
  payments?: PosPaymentInput[];
  notes?: string | null;
  instruction?: string | null;
}

export interface CalculateOrderInput {
  guestId?: string;
  items: CreateOrderItemInput[];
  discountType?: PosDiscountType;
  discountValue?: number;
  discountAmount?: number;
  couponCode?: string | null;
  giftCardCode?: string | null;
  referralCode?: string | null;
  redeemLoyaltyPoints?: number;
  tipAmount?: number;
}

export interface TaxDetailItem {
  name: string;
  rate: number;
  amount: number;
  isInclusive: boolean;
}

export interface CalculatedOrderItem {
  itemType: PosItemType;
  serviceId?: string | null;
  productId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  itemName: string;
  itemCategory?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  discountAmount: number;
  taxRate?: number;
  taxAmount: number;
  subtotal: number;
  taxExclusiveSubtotal?: number;
  total: number;
}

export interface CalculateOrderResult {
  subtotal: number;
  itemDiscountTotal: number;
  orderDiscountAmount: number;
  couponDiscount: number;
  giftCardAmount: number;
  referralDiscount: number;
  membershipDiscount: number;
  loyaltyDiscount?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyPointsEstimatedEarn?: number;
  totalDiscount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  taxDetails: TaxDetailItem[];
  tipAmount: number;
  totalAmount: number;
  itemsCalculated: CalculatedOrderItem[];
}

export interface PosOrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  guestId?: string;
  cashierId?: string;
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  export?: 'csv' | 'excel';
}

export interface UpdatePosOrderStatusInput {
  status: PosOrderStatus;
  notes?: string;
}

export interface RejectOrderInput {
  reason?: string;
}

export interface PosDashboardSummary {
  new: number;
  accepted: number;
  rejected: number;
  completed: number;
  total: number;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface PosStatsQuery {
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
}
