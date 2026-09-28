export interface ServiceCategoryListQuery {
  search?: string;
  group?: string;
  isActive?: boolean;
  hideFromCatalogue?: boolean;
  parentId?: string | null;
  store?: string;
  tree?: boolean;
}

export interface CreateServiceCategoryInput {
  name: string;
  parentId?: string | null;
  position?: number;
  group?: string;
  hideFromCatalogue?: boolean;
  imageUrl?: string | null;
  stores?: string[];
  isActive?: boolean;
}

export interface UpdateServiceCategoryInput {
  name?: string;
  parentId?: string | null;
  position?: number;
  group?: string;
  hideFromCatalogue?: boolean;
  imageUrl?: string | null;
  stores?: string[];
  isActive?: boolean;
}
