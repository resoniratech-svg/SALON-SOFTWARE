import { Decimal } from '@prisma/client/runtime/library';

export interface ExpenseFilterQuery {
  page?: number;
  limit?: number;
  store?: string;
  paymode?: string;
  accountId?: string;
  expenseTypeId?: string;
  givenTo?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  sortBy?: 'expenseDate' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  export?: 'csv' | 'excel';
}

export interface CreateExpenseInput {
  expenseDate?: string | Date | null;
  expenseTypeId?: string | null;
  expenseTypeName?: string | null;
  accountId?: string | null;
  amount: number;
  paymentMethod?: string | null;
  paymode?: string | null;
  givenTo?: string | null;
  vendorName?: string | null;
  description?: string | null;
  remark?: string | null;
  store?: string | null;
  staffId?: string | null;
  categoryId?: string | null;
}

export interface UpdateExpenseInput {
  expenseDate?: string | Date | null;
  expenseTypeId?: string | null;
  expenseTypeName?: string | null;
  accountId?: string | null;
  amount?: number | null;
  paymentMethod?: string | null;
  paymode?: string | null;
  givenTo?: string | null;
  vendorName?: string | null;
  description?: string | null;
  remark?: string | null;
  store?: string | null;
  staffId?: string | null;
  categoryId?: string | null;
}

export interface CreateExpenseTypeInput {
  name: string;
  pnlCategory?: string | null;
  isActive?: boolean | null;
}

export interface UpdateExpenseTypeInput {
  name?: string | null;
  pnlCategory?: string | null;
  isActive?: boolean | null;
}

export interface CreateAccountInput {
  accountName: string;
  accountType?: string | null; // "Current" | "Savings" | "Petty Cash"
  balance?: number | null;
  bankName?: string | null;
  accountNumber?: string | null;
  isActive?: boolean | null;
}

export interface UpdateAccountInput {
  accountName?: string | null;
  accountType?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  isActive?: boolean | null;
}

export interface AddBalanceInput {
  accountId: string;
  amount: number;
  date?: string | Date | null;
  transferToAccountId?: string | null;
  paymode?: string | null;
  remark?: string | null;
}

export interface AccountTransactionFilterQuery {
  page?: number;
  limit?: number;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  type?: string;
  paymode?: string;
  search?: string;
}
