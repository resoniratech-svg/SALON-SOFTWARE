export interface VariationItem {
  id?: string;
  name: string;
  sku?: string;
  price?: number;
  salePrice?: number;
  barcode?: string;
  options?: string[];
  [key: string]: any;
}

export interface TaxItem {
  id?: string;
  taxId?: string;
  name: string;
  rate: number;
  type?: 'percentage' | 'fixed' | string;
  [key: string]: any;
}

export type DisplayImageItem = string | { url: string; position?: number; isPrimary?: boolean; [key: string]: any };

export interface CreateProductInput {
  name: string;
  categoryId: string;
  subcategoryId?: string | null;
  position?: number;
  hsnCode?: string | null;
  productTag?: string | null;
  storeSku?: string | null;
  isRetail?: boolean;
  group?: 'Both' | 'Female' | 'Male';
  hideFromCatalogue?: boolean;
  price: number;
  salePrice?: number | null;
  purchasePrice?: number | null;
  isNonDiscountable?: boolean;
  description?: string | null;
  barcode?: string | null;
  supplierId?: string | null;
  initialStock?: number;
  location?: string | null;
  variations?: VariationItem[];
  taxes?: TaxItem[];
  videoLink?: string | null;
  benefits?: string | null;
  ingredients?: string | null;
  usageInstructions?: string | null;
  displayImages?: DisplayImageItem[];
  isActive?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  categoryId?: string;
  subcategoryId?: string | null;
  position?: number;
  hsnCode?: string | null;
  productTag?: string | null;
  storeSku?: string | null;
  isRetail?: boolean;
  group?: 'Both' | 'Female' | 'Male';
  hideFromCatalogue?: boolean;
  price?: number;
  salePrice?: number | null;
  purchasePrice?: number | null;
  isNonDiscountable?: boolean;
  description?: string | null;
  barcode?: string | null;
  supplierId?: string | null;
  variations?: VariationItem[];
  taxes?: TaxItem[];
  videoLink?: string | null;
  benefits?: string | null;
  ingredients?: string | null;
  usageInstructions?: string | null;
  displayImages?: DisplayImageItem[];
  isActive?: boolean;
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
  supplierId?: string;
  store?: string;
  group?: 'Both' | 'Female' | 'Male';
  isRetail?: boolean;
  isActive?: boolean;
  hideFromCatalogue?: boolean;
  sortBy?: 'name' | 'position' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
