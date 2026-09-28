import { ExpensesRepository } from './expenses.repository.js';
import {
  AccountTransactionFilterQuery,
  AddBalanceInput,
  CreateAccountInput,
  CreateExpenseInput,
  CreateExpenseTypeInput,
  ExpenseFilterQuery,
  UpdateAccountInput,
  UpdateExpenseInput,
  UpdateExpenseTypeInput,
} from './expenses.types.js';

export class ExpensesService {
  constructor(private repository: ExpensesRepository = new ExpensesRepository()) {}

  // Expenses
  async getExpenses(tenantId: string, filters: ExpenseFilterQuery) {
    return this.repository.findExpenses(tenantId, filters);
  }

  async exportExpensesCsv(tenantId: string, filters: ExpenseFilterQuery): Promise<string> {
    const result = await this.repository.findExpenses(tenantId, {
      ...filters,
      page: 1,
      limit: 10000,
    });

    const headers = [
      'Date',
      'Store',
      'Expense Type',
      'Account',
      'Amount',
      'Paymode',
      'Given To',
      'Vendor',
      'Description',
      'Remark',
      'Created At',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = (result.data || []).map((item: any) => [
      escapeCsv(item.expenseDate ? new Date(item.expenseDate).toISOString().slice(0, 10) : ''),
      escapeCsv(item.store || ''),
      escapeCsv(item.expenseTypeName || item.expenseType?.name || ''),
      escapeCsv(item.accountName || item.account?.accountName || ''),
      escapeCsv(Number(item.amount || 0).toFixed(2)),
      escapeCsv(item.paymentMethod || item.paymode || 'CASH'),
      escapeCsv(item.givenTo || ''),
      escapeCsv(item.vendorName || ''),
      escapeCsv(item.description || ''),
      escapeCsv(item.remark || ''),
      escapeCsv(item.createdAt ? new Date(item.createdAt).toISOString() : ''),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  async getExpenseById(tenantId: string, id: string) {
    return this.repository.findExpenseById(tenantId, id);
  }

  async createExpense(tenantId: string, input: CreateExpenseInput) {
    return this.repository.createExpense(tenantId, input);
  }

  async updateExpense(tenantId: string, id: string, input: UpdateExpenseInput) {
    return this.repository.updateExpense(tenantId, id, input);
  }

  async deleteExpense(tenantId: string, id: string) {
    return this.repository.deleteExpense(tenantId, id);
  }

  async getDashboardSummary(tenantId: string, store?: string, fromDate?: string, toDate?: string) {
    return this.repository.getDashboardSummary(tenantId, store, fromDate, toDate);
  }

  // Expense Types
  async getExpenseTypes(tenantId: string, includeInactive = false) {
    return this.repository.findExpenseTypes(tenantId, includeInactive);
  }

  async getExpenseTypeById(tenantId: string, id: string) {
    return this.repository.findExpenseTypeById(tenantId, id);
  }

  async createExpenseType(tenantId: string, input: CreateExpenseTypeInput) {
    return this.repository.createExpenseType(tenantId, input);
  }

  async updateExpenseType(tenantId: string, id: string, input: UpdateExpenseTypeInput) {
    return this.repository.updateExpenseType(tenantId, id, input);
  }

  async deleteExpenseType(tenantId: string, id: string) {
    return this.repository.deleteExpenseType(tenantId, id);
  }

  // Accounts & Balances
  async getAccounts(tenantId: string, includeInactive = false) {
    return this.repository.findAccounts(tenantId, includeInactive);
  }

  async getAccountById(tenantId: string, id: string) {
    return this.repository.findAccountById(tenantId, id);
  }

  async createAccount(tenantId: string, input: CreateAccountInput) {
    return this.repository.createAccount(tenantId, input);
  }

  async updateAccount(tenantId: string, id: string, input: UpdateAccountInput) {
    return this.repository.updateAccount(tenantId, id, input);
  }

  async addBalanceOrTransfer(tenantId: string, input: AddBalanceInput) {
    return this.repository.addBalanceOrTransfer(tenantId, input);
  }

  async getAccountTransactions(tenantId: string, filters: AccountTransactionFilterQuery) {
    return this.repository.findAccountTransactions(tenantId, filters);
  }
}

export const expensesService = new ExpensesService();
