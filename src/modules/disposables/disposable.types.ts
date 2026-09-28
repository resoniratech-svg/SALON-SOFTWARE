export interface CreateDisposableInput {
  name: string;
  code?: string | null;
  category?: string;
  categoryId?: string | null;
  price?: number;
  salePrice?: number | null;
  quantity?: number;
  unit?: string;
  gender?: 'Both' | 'Female' | 'Male';
  isRetail?: boolean;
  hideFromCatalogue?: boolean;
  isNonDiscountable?: boolean;
  description?: string | null;
  barcode?: string | null;
  position?: number;
  hsnCode?: string | null;
  productTag?: string | null;
  isActive?: boolean;
}

export interface UpdateDisposableInput {
  name?: string;
  code?: string | null;
  category?: string;
  categoryId?: string | null;
  price?: number;
  salePrice?: number | null;
  quantity?: number;
  unit?: string;
  gender?: 'Both' | 'Female' | 'Male';
  isRetail?: boolean;
  hideFromCatalogue?: boolean;
  isNonDiscountable?: boolean;
  description?: string | null;
  barcode?: string | null;
  position?: number;
  hsnCode?: string | null;
  productTag?: string | null;
  isActive?: boolean;
}

export interface DisposableListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  categoryId?: string;
  gender?: 'Both' | 'Female' | 'Male';
  unit?: string;
  isRetail?: boolean;
  isActive?: boolean;
  hideFromCatalogue?: boolean;
  sortBy?: 'name' | 'position' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
