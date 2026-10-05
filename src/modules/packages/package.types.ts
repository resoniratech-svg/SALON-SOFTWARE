import { Prisma } from '@prisma/client';

export interface CreatePackageInput {
  name: string;
  price: number;
  validityDays: number;
  renewalReminderDays?: number;
  services?: any;
  products?: any;
  description?: string | null;
  header?: string | null;
  isActive?: boolean;
}

export interface UpdatePackageInput {
  name?: string;
  price?: number;
  validityDays?: number;
  renewalReminderDays?: number;
  services?: any;
  products?: any;
  description?: string | null;
  header?: string | null;
  isActive?: boolean;
}

export interface PackageQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  tenantId?: string;
}
