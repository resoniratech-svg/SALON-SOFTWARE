import { z } from 'zod';

export const startCashTransactionSchema = z.object({
  openingBalance: z.number().min(0, 'Opening balance must be non-negative').optional(),
  store: z.string().optional().default('kalyaninagar'),
  date: z.string().optional(),
});

export type StartCashTransactionDto = z.infer<typeof startCashTransactionSchema>;

export const closeCounterSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw === 'object' && raw !== null) {
      return {
        ...raw,
        instoreCash: raw.instoreCash !== undefined ? raw.instoreCash : (raw.closingBalance !== undefined ? raw.closingBalance : raw.cash),
        remarks: raw.remarks || raw.comment || raw.remark,
      };
    }
    return raw;
  },
  z.object({
    instoreCash: z.number().min(0, 'In-store cash must be non-negative'),
    remarks: z.string().trim().min(1, 'Please Enter remark'),
  })
);

export type CloseCounterDto = z.infer<typeof closeCounterSchema>;

export const updateCashTransactionSchema = z.object({
  openingBalance: z.number().min(0, 'Opening balance must be non-negative').optional(),
  instoreCash: z.number().min(0, 'In-store cash must be non-negative').optional(),
  closingRemark: z.string().optional(),
  updateRemark: z.string().trim().min(1, 'Please enter update remark'),
});

export type UpdateCashTransactionDto = z.infer<typeof updateCashTransactionSchema>;

export const createCashExpenseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  staffId: z.string().optional(),
  vendorName: z.string().optional(),
  description: z.string().optional(),
  expenseDate: z.string().optional(),
  store: z.string().optional().default('kalyaninagar'),
});

export type CreateCashExpenseDto = z.infer<typeof createCashExpenseSchema>;

export const queryCashTransactionsSchema = z.object({
  store: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'ALL']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(20),
  export: z.enum(['csv', 'excel']).optional(),
});

export type QueryCashTransactionsDto = z.infer<typeof queryCashTransactionsSchema>;
