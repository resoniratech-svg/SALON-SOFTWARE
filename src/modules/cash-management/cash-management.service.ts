import { cashManagementRepository } from './cash-management.repository.js';
import {
  StartCashTransactionDto,
  CloseCounterDto,
  UpdateCashTransactionDto,
  CreateCashExpenseDto,
  QueryCashTransactionsDto,
} from './cash-management.dto.js';
import { BadRequestError, NotFoundError } from '../../utils/app-error.js';

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export class CashManagementService {
  async getSummary(tenantId: string, store: string = 'kalyaninagar') {
    const active = await cashManagementRepository.getActiveTransaction(tenantId, store);

    if (!active) {
      const prev = await cashManagementRepository.getLatestClosedTransaction(tenantId, store);
      const suggestedOpeningBalance = prev ? Number(prev.instoreCash) : 0;

      return {
        isActive: false,
        date: formatDate(new Date()),
        suggestedOpeningBalance,
        activeTransaction: null,
        cards: {
          openingBalance: 0,
          cashRevenue: 0,
          cashExpense: 0,
          closingBalance: 0,
          instoreCash: 0,
          reconcileAmount: 0,
        },
      };
    }

    // Active session live calculations
    const [payments, expenses] = await Promise.all([
      cashManagementRepository.getSessionCashPayments(tenantId, store, active.createdAt),
      cashManagementRepository.getSessionCashExpenses(tenantId, store, active.createdAt),
    ]);

    const cashRevenue = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const cashExpense = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const openingBalance = Number(active.openingBalance);
    const closingBalance = openingBalance + cashRevenue - cashExpense;
    const instoreCash = Number(active.instoreCash);
    const reconcileAmount = instoreCash - closingBalance;

    return {
      isActive: true,
      date: formatDate(active.date),
      activeTransaction: {
        id: active.id,
        store: active.store,
        date: formatDate(active.date),
        rawDate: active.date,
        status: active.status,
        openingBalance,
        cashRevenue,
        cashExpense,
        closingBalance,
        instoreCash,
        reconciliation: reconcileAmount,
        createdBy: active.createdBy?.username || 'Admin',
        createdAt: active.createdAt,
      },
      cards: {
        openingBalance,
        cashRevenue,
        cashExpense,
        closingBalance,
        instoreCash,
        reconcileAmount,
      },
    };
  }

  async startTransaction(
    tenantId: string,
    data: StartCashTransactionDto,
    userId?: string
  ) {
    const store = data.store || 'kalyaninagar';
    const existing = await cashManagementRepository.getActiveTransaction(tenantId, store);

    if (existing) {
      throw new BadRequestError(
        'An active cash counter transaction is already open for this branch. Please close it first.'
      );
    }

    const created = await cashManagementRepository.startTransaction(tenantId, data, userId);

    return {
      id: created.id,
      store: created.store,
      date: formatDate(created.date),
      status: created.status,
      openingBalance: Number(created.openingBalance),
      cashRevenue: Number(created.cashRevenue),
      cashExpense: Number(created.cashExpense),
      closingBalance: Number(created.closingBalance),
      instoreCash: Number(created.instoreCash),
      reconciliation: Number(created.reconciliation),
      createdBy: created.createdBy?.username || 'Admin',
      createdAt: created.createdAt,
    };
  }

  async closeCounter(
    tenantId: string,
    data: CloseCounterDto,
    userId?: string,
    store: string = 'kalyaninagar',
    transactionId?: string
  ) {
    let targetId: string;
    if (transactionId) {
      const tx = await cashManagementRepository.getTransactionById(tenantId, transactionId);
      if (!tx) {
        throw new NotFoundError('Transaction not found');
      }
      if (tx.status === 'CLOSED') {
        throw new BadRequestError('Transaction is already closed');
      }
      targetId = tx.id;
    } else {
      const active = await cashManagementRepository.getActiveTransaction(tenantId, store);
      if (!active) {
        throw new BadRequestError('No active cash transaction found to close for this branch.');
      }
      targetId = active.id;
    }

    let closed;
    try {
      closed = await cashManagementRepository.closeCounter(tenantId, targetId, data, userId);
    } catch (err: any) {
      if (err instanceof BadRequestError || err instanceof NotFoundError) {
        throw err;
      }
      throw new BadRequestError(err.message || 'Transaction not found or already closed');
    }

    return {
      id: closed.id,
      store: closed.store,
      date: formatDate(closed.date),
      status: closed.status,
      openingBalance: Number(closed.openingBalance),
      cashRevenue: Number(closed.cashRevenue),
      cashExpense: Number(closed.cashExpense),
      closingBalance: Number(closed.closingBalance),
      instoreCash: Number(closed.instoreCash),
      reconciliation: Number(closed.reconciliation),
      closingRemark: closed.closingRemark,
      createdBy: closed.createdBy?.username || 'Admin',
      updatedBy: closed.updatedBy?.username || null,
      closedAt: closed.closedAt,
    };
  }

  async updateTransaction(
    tenantId: string,
    transactionId: string,
    data: UpdateCashTransactionDto,
    userId?: string
  ) {
    const existing = await cashManagementRepository.getTransactionById(tenantId, transactionId);
    if (!existing) {
      throw new NotFoundError('Cash transaction not found');
    }

    const updated = await cashManagementRepository.updateTransaction(
      tenantId,
      transactionId,
      data,
      userId
    );

    return {
      id: updated.id,
      store: updated.store,
      date: formatDate(updated.date),
      status: updated.status,
      openingBalance: Number(updated.openingBalance),
      cashRevenue: Number(updated.cashRevenue),
      cashExpense: Number(updated.cashExpense),
      closingBalance: Number(updated.closingBalance),
      instoreCash: Number(updated.instoreCash),
      reconciliation: Number(updated.reconciliation),
      closingRemark: updated.closingRemark,
      updateRemark: updated.updateRemark,
      createdBy: updated.createdBy?.username || 'Admin',
      updatedBy: updated.updatedBy?.username || null,
      updatedAt: updated.updatedAt,
    };
  }

  async listTransactions(tenantId: string, query: QueryCashTransactionsDto) {
    const { items, pagination } = await cashManagementRepository.listTransactions(tenantId, query);

    const formattedItems = items.map((item) => ({
      id: item.id,
      store: item.store,
      date: formatDate(item.date),
      rawDate: item.date,
      status: item.status,
      openingBalance: Number(item.openingBalance),
      cashRevenue: Number(item.cashRevenue),
      cashExpense: Number(item.cashExpense),
      closingBalance: Number(item.closingBalance),
      instoreCash: Number(item.instoreCash),
      reconciliation: Number(item.reconciliation),
      closingRemark: item.closingRemark,
      createdBy: item.createdBy?.username || 'Admin',
      updatedBy: item.updatedBy?.username || null,
      updateRemark: item.updateRemark,
      closedAt: item.closedAt,
      createdAt: item.createdAt,
    }));

    return {
      items: formattedItems,
      pagination,
    };
  }

  async exportCashTransactionsCsv(tenantId: string, query: QueryCashTransactionsDto): Promise<string> {
    const { items } = await this.listTransactions(tenantId, { ...query, limit: 10000, page: 1 });

    const headers = [
      'Date',
      'Store',
      'Created By',
      'Opening Balance',
      'Cash Revenue',
      'Cash Expense',
      'Closing Balance',
      'In-Store Cash',
      'Reconciliation',
      'Closing Remark',
      'Updated By',
      'Update Remark',
      'Status',
      'Closed At',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = items.map((item) => [
      escapeCsv(item.date),
      escapeCsv(item.store),
      escapeCsv(item.createdBy),
      escapeCsv(item.openingBalance),
      escapeCsv(item.cashRevenue),
      escapeCsv(item.cashExpense),
      escapeCsv(item.closingBalance),
      escapeCsv(item.instoreCash),
      escapeCsv(item.reconciliation),
      escapeCsv(item.closingRemark || ''),
      escapeCsv(item.updatedBy || ''),
      escapeCsv(item.updateRemark || ''),
      escapeCsv(item.status),
      escapeCsv(item.closedAt ? new Date(item.closedAt).toISOString() : ''),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  async getTransactionById(tenantId: string, id: string) {
    const item = await cashManagementRepository.getTransactionById(tenantId, id);
    if (!item) {
      throw new NotFoundError('Cash transaction not found');
    }

    return {
      id: item.id,
      store: item.store,
      date: formatDate(item.date),
      status: item.status,
      openingBalance: Number(item.openingBalance),
      cashRevenue: Number(item.cashRevenue),
      cashExpense: Number(item.cashExpense),
      closingBalance: Number(item.closingBalance),
      instoreCash: Number(item.instoreCash),
      reconciliation: Number(item.reconciliation),
      closingRemark: item.closingRemark,
      updateRemark: item.updateRemark,
      createdBy: item.createdBy?.username || 'Admin',
      updatedBy: item.updatedBy?.username || null,
      createdAt: item.createdAt,
      closedAt: item.closedAt,
    };
  }

  async getRevenue(tenantId: string, store: string = 'kalyaninagar', transactionId?: string) {
    let fromDate: Date;
    let toDate: Date | undefined;

    if (transactionId) {
      const tx = await cashManagementRepository.getTransactionById(tenantId, transactionId);
      if (tx) {
        fromDate = tx.createdAt;
        toDate = tx.closedAt || undefined;
      } else {
        fromDate = new Date(new Date().setHours(0, 0, 0, 0));
      }
    } else {
      const active = await cashManagementRepository.getActiveTransaction(tenantId, store);
      if (active) {
        fromDate = active.createdAt;
      } else {
        fromDate = new Date(new Date().setHours(0, 0, 0, 0));
      }
    }

    const payments = await cashManagementRepository.getSessionCashPayments(
      tenantId,
      store,
      fromDate,
      toDate
    );

    const rows = payments.map((p) => {
      const staffName = p.order?.items?.[0]?.staff?.name || 'Unassigned';
      return {
        id: p.id,
        date: formatDate(p.createdAt),
        invoiceNo: p.order?.orderNumber || p.id.slice(0, 8),
        guestName: p.order?.guest?.name || 'Walk-in',
        guestNo: p.order?.guest?.mobile || 'N/A',
        staffName,
        total: Number(p.order?.totalAmount || p.amount),
        cashAmount: Number(p.amount),
      };
    });

    const totalCashRevenue = rows.reduce((acc, r) => acc + r.cashAmount, 0);

    return {
      rows,
      summary: {
        totalCashRevenue,
        totalInvoices: rows.length,
      },
    };
  }

  async getExpenses(tenantId: string, store: string = 'kalyaninagar', transactionId?: string) {
    let fromDate: Date;
    let toDate: Date | undefined;

    if (transactionId) {
      const tx = await cashManagementRepository.getTransactionById(tenantId, transactionId);
      if (tx) {
        fromDate = tx.createdAt;
        toDate = tx.closedAt || undefined;
      } else {
        fromDate = new Date(new Date().setHours(0, 0, 0, 0));
      }
    } else {
      const active = await cashManagementRepository.getActiveTransaction(tenantId, store);
      if (active) {
        fromDate = active.createdAt;
      } else {
        fromDate = new Date(new Date().setHours(0, 0, 0, 0));
      }
    }

    const expenses = await cashManagementRepository.getSessionCashExpenses(
      tenantId,
      store,
      fromDate,
      toDate
    );

    const rows = expenses.map((e) => ({
      id: e.id,
      date: formatDate(e.expenseDate),
      staffName: e.staff?.name || e.vendorName || 'General',
      categoryName: e.category?.name || 'Cash Expense',
      total: Number(e.amount),
      cashAmount: Number(e.amount),
      description: e.description || '',
    }));

    const totalCashExpenses = rows.reduce((acc, r) => acc + r.cashAmount, 0);

    return {
      rows,
      summary: {
        totalCashExpenses,
        totalRecords: rows.length,
      },
    };
  }

  async createExpense(tenantId: string, data: CreateCashExpenseDto, userId?: string) {
    const expense = await cashManagementRepository.createExpense(tenantId, data, userId);

    return {
      id: expense.id,
      date: formatDate(expense.expenseDate),
      amount: Number(expense.amount),
      categoryName: expense.category?.name || expense.expenseTypeName || 'General Expense',
      staffName: expense.staff?.name || expense.vendorName || null,
      description: expense.description,
      store: expense.store,
    };
  }

  async getNextOpeningBalance(tenantId: string, store: string = 'kalyaninagar') {
    const prev = await cashManagementRepository.getLatestClosedTransaction(tenantId, store);

    return {
      suggestedOpeningBalance: prev ? Number(prev.instoreCash) : 0,
      previousTransaction: prev
        ? {
            id: prev.id,
            date: formatDate(prev.date),
            instoreCash: Number(prev.instoreCash),
            closingBalance: Number(prev.closingBalance),
            closedAt: prev.closedAt,
          }
        : null,
    };
  }
}

export const cashManagementService = new CashManagementService();
