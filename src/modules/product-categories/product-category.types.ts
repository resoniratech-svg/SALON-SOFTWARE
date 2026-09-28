export interface CreateProductCategoryDTO {
  name: string;
  parentId?: string | null;
  position?: number;
  group?: 'Both' | 'Female' | 'Male';
  hideFromCatalogue?: boolean;
  imageUrl?: string | null;
  stores?: string[];
  isActive?: boolean;
}

export interface UpdateProductCategoryDTO {
  name?: string;
  parentId?: string | null;
  position?: number;
  group?: 'Both' | 'Female' | 'Male';
  hideFromCatalogue?: boolean;
  imageUrl?: string | null;
  stores?: string[];
  isActive?: boolean;
}

export interface ProductCategoryQueryParams {
  search?: string;
  group?: 'Both' | 'Female' | 'Male';
  isActive?: boolean;
  hideFromCatalogue?: boolean;
  parentId?: string | null;
  store?: string;
  tree?: boolean;
}
