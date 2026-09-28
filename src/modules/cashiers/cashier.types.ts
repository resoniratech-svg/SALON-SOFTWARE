import { UserStatus } from '@prisma/client';

export interface CreateCashierInput {
  username: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  enabledModules?: string[];
}

export interface UpdateCashierInput {
  email?: string | null;
  phone?: string | null;
  username?: string;
}

export interface UpdateCashierModulesInput {
  enabledModules: string[];
}

export interface CashierQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  resetRequested?: boolean;
}
