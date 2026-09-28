export type GenderType = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export type CustomerType = 'REGULAR' | 'VIP' | 'CORPORATE' | 'WALK_IN';

export interface CreateGuestInput {
  guestCode?: string | null;
  salutation?: string | null;
  salutationId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  displayName?: string | null;
  gender?: GenderType | string | null;
  dateOfBirth?: string | Date | null;
  dob?: string | Date | null; // POS / UI alias
  mobile: string;
  alternateMobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  anniversary?: string | Date | null;
  gstNumber?: string | null;
  hairType?: string | null;
  preferences?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  customerType?: CustomerType | string | null;
  source?: string | null;
  referralCode?: string | null;
  referredByGuestId?: string | null;
  crmSegmentId?: string | null;
  membershipId?: string | null;
  membershipExpiry?: string | Date | null;
  loyaltyPoints?: number | null;
  isActive?: boolean;
  isBlocked?: boolean;
  blockReason?: string | null;
}

export type UpdateGuestInput = Partial<CreateGuestInput>;

export interface UpdateGuestStatusInput {
  isActive?: boolean;
  isBlocked?: boolean;
  blockReason?: string | null;
}

export interface GuestQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
  customerType?: string;
  crmSegmentId?: string;
  membershipId?: string;
  hairType?: string;
  source?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  hasMembership?: boolean;
  minSpend?: number;
  maxSpend?: number;
  minVisits?: number;
  maxVisits?: number;
  tags?: string | string[];
  birthdayMonth?: number;
  anniversaryMonth?: number;
  hasAnniversaryToday?: boolean;
  hasBirthdayToday?: boolean;
  sortBy?: 'name' | 'createdAt' | 'totalSpend' | 'totalVisits' | 'loyaltyPoints' | 'lastVisitDate' | 'mobile';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
