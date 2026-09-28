export interface StaffMappingItem {
  staffId: string;
  isRecommended?: boolean;
}

export interface ConsumableItem {
  name: string;
  quantity: number;
  unit?: string;
}

export interface CreateServiceInput {
  name: string;
  categoryId: string;
  subcategoryId?: string | null;
  position?: number;
  isActive?: boolean;
  hour?: number;
  minute?: number;
  durationMinutes?: number;
  serviceReminderDays?: number;
  sacCode?: string | null;
  serviceTag?: string | null;
  group?: string | null;
  hideFromCatalogue?: boolean;
  price: number;
  salePrice?: number;
  isNonDiscountable?: boolean;
  description?: string | null;
  imageUrl?: string | null;
  consumables?: ConsumableItem[];
  resourceIds?: string[];
  staff?: StaffMappingItem[];
  staffIds?: string[];
}

export interface UpdateServiceInput {
  name?: string;
  categoryId?: string;
  subcategoryId?: string | null;
  position?: number;
  isActive?: boolean;
  hour?: number;
  minute?: number;
  durationMinutes?: number;
  serviceReminderDays?: number;
  sacCode?: string | null;
  serviceTag?: string | null;
  group?: string | null;
  hideFromCatalogue?: boolean;
  price?: number;
  salePrice?: number;
  isNonDiscountable?: boolean;
  description?: string | null;
  imageUrl?: string | null;
  consumables?: ConsumableItem[];
  resourceIds?: string[];
  staff?: StaffMappingItem[];
  staffIds?: string[];
}

export interface ServiceListQuery {
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
  group?: string;
  isActive?: boolean;
  hideFromCatalogue?: boolean;
  store?: string;
}
