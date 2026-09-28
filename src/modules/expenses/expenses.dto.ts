import { z } from 'zod';

export const createExpenseSchema = z.object({
  expenseDate: z.string().optional(),
  expenseTypeId: z.string().uuid().optional().nullable(),
  expenseTypeName: z.string().trim().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Expense amount must be greater than zero'),
  paymentMethod: z.string().trim().optional(),
  paymode: z.string().trim().optional(),
  givenTo: z.string().trim().optional().nullable(),
  vendorName: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  remark: z.string().trim().optional().nullable(),
  store: z.string().trim().optional().default('kalyaninagar'),
  staffId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
});

export const updateExpenseSchema = z.object({
  expenseDate: z.string().optional(),
  expenseTypeId: z.string().uuid().optional().nullable(),
  expenseTypeName: z.string().trim().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive('Expense amount must be greater than zero').optional(),
  paymentMethod: z.string().trim().optional(),
  paymode: z.string().trim().optional(),
  givenTo: z.string().trim().optional().nullable(),
  vendorName: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  remark: z.string().trim().optional().nullable(),
  store: z.string().trim().optional(),
  staffId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
});

export const expenseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  store: z.string().optional(),
  paymode: z.string().optional(),
  accountId: z.string().optional(),
  expenseTypeId: z.string().optional(),
  givenTo: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['expenseDate', 'amount', 'createdAt']).default('expenseDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  export: z.enum(['csv', 'excel']).optional(),
});

export const createExpenseTypeSchema = z.object({
  name: z.string().trim().min(1, 'Type name is required').max(100),
  pnlCategory: z.string().trim().optional().default('General And Administrative Expenses'),
  isActive: z.boolean().optional().default(true),
});

export const updateExpenseTypeSchema = z.object({
  name: z.string().trim().min(1, 'Type name is required').max(100).optional(),
  pnlCategory: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const createAccountSchema = z.object({
  accountName: z.string().trim().min(1, 'Account name is required').max(100),
  accountType: z.string().trim().optional().default('Current'),
  balance: z.coerce.number().min(0, 'Initial balance cannot be negative').default(0),
  bankName: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateAccountSchema = z.object({
  accountName: z.string().trim().min(1, 'Account name is required').max(100).optional(),
  accountType: z.string().trim().optional(),
  bankName: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const addBalanceSchema = z.object({
  accountId: z.string().uuid('Valid account ID is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  date: z.string().optional(),
  transferToAccountId: z.string().uuid().optional().nullable(),
  paymode: z.string().trim().optional().default('CASH'),
  remark: z.string().trim().optional().nullable(),
});

export const accountTransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  accountId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.string().optional(),
  paymode: z.string().optional(),
  search: z.string().optional(),
});
