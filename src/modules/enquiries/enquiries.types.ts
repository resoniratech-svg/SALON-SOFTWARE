export type EnquiryPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type EnquiryStatus = 
  | 'NEW' 
  | 'FOLLOWING_UP' 
  | 'IN_PROGRESS' 
  | 'CONVERTED' 
  | 'CANCELLED' 
  | 'DUPLICATE' 
  | 'LOST';

export interface EnquiryFilterQuery {
  page?: number;
  limit?: number;
  store?: string;
  status?: string;
  priority?: string;
  service?: string;
  fromDate?: string;
  toDate?: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'createdAt' | 'followUpDate' | 'name' | 'status' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateEnquiryInput {
  name: string;
  mobile: string;
  email?: string | null;
  priority?: EnquiryPriority | string | null;
  status?: EnquiryStatus | string | null;
  service?: string | null;
  serviceId?: string | null;
  assignedStaffId?: string | null;
  referralSource?: string | null;
  description?: string | null;
  followUpDate?: string | Date | null;
  store?: string | null;
  guestId?: string | null;
}

export interface UpdateEnquiryInput {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  priority?: EnquiryPriority | string | null;
  status?: EnquiryStatus | string | null;
  service?: string | null;
  serviceId?: string | null;
  assignedStaffId?: string | null;
  referralSource?: string | null;
  description?: string | null;
  followUpDate?: string | Date | null;
  store?: string | null;
  guestId?: string | null;
}

export interface CreateFollowUpInput {
  followUpDate: string | Date;
  notes?: string | null;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

export interface UpdateFollowUpInput {
  followUpDate?: string | Date;
  notes?: string | null;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

export interface ReferralFilterQuery {
  page?: number;
  limit?: number;
  store?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface CreateReferralInput {
  referralName: string;
  mobileNumber: string;
  referredDate?: string | Date | null;
  referrerGuestId?: string | null;
  referrerName?: string | null;
  referralCode?: string | null;
  status?: 'PENDING' | 'USED' | 'EXPIRED' | null;
  benefitToReferral?: string | null;
  benefitToReferrer?: string | null;
  store?: string | null;
}

export interface UpdateReferralInput {
  referralName?: string | null;
  mobileNumber?: string | null;
  referredDate?: string | Date | null;
  referrerGuestId?: string | null;
  referrerName?: string | null;
  referralCode?: string | null;
  status?: 'PENDING' | 'USED' | 'EXPIRED' | null;
  benefitToReferral?: string | null;
  benefitToReferrer?: string | null;
  store?: string | null;
}

export interface ReferralDashboardMetrics {
  totalReferrals: number;
  usedReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
  enquiries: number;
  referrals: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
