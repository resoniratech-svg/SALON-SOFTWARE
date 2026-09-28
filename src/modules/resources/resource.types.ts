export interface CreateResourceInput {
  name: string;
  capacity?: number;
  isActive?: boolean;
  description?: string | null;
}

export interface UpdateResourceInput {
  name?: string;
  capacity?: number;
  isActive?: boolean;
  description?: string | null;
}

export interface UpdateResourceStatusInput {
  isActive: boolean;
}

export interface ResourceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  q?: string;
  isActive?: boolean | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
