import { prisma } from '../../config/database.js';
import {
  StartCashTransactionDto,
  CloseCounterDto,
  UpdateCashTransactionDto,
  CreateCashExpenseDto,
  QueryCashTransactionsDto,
} from './cash-management.dto.js';
import { Prisma } from '@prisma/client';

export class CashManagementRepository {
  async getActiveTransaction(tenantId: string, store: string = 'kalyaninagar') {
    return prisma.cashTransaction.findFirst({
      where: {
        tenantId,
        store,
        status: 'OPEN',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            role: { select: { name: true } },
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLatestClosedTransaction(tenantId: string, store: string = 'kalyaninagar') {
    return prisma.cashTransaction.findFirst({
      where: {
        tenantId,
        store,
        status: 'CLOSED',
      },
      orderBy: { closedAt: 'desc' },
    });
  }

  async getTransactionById(tenantId: string, id: string) {
    return prisma.cashTransaction.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            role: { select: { name: true } },
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async startTransaction(
    tenantId: string,
    data: StartCashTransactionDto,
    userId?: string
  ) {
    const store = data.store || 'kalyaninagar';
    const date = data.date ? new Date(data.date) : new Date();

    // Suggested opening balance if not provided
    let openingBalance = data.openingBalance;
    if (openingBalance === undefined || openingBalance === null) {
      const prev = await this.getLatestClosedTransaction(tenantId, store);
      openingBalance = prev ? Number(prev.instoreCash) : 0;
    }

    return prisma.cashTransaction.create({
      data: {
        tenantId,
        store,
        date,
        status: 'OPEN',
        openingBalance: new Prisma.Decimal(openingBalance),
        cashRevenue: new Prisma.Decimal(0),
        cashExpense: new Prisma.Decimal(0),
        closingBalance: new Prisma.Decimal(openingBalance),
        instoreCash: new Prisma.Decimal(0),
        reconciliation: new Prisma.Decimal(-openingBalance),
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            role: { select: { name: true } },
          },
        },
      },
    });
  }

  async getSessionCashPayments(
    tenantId: string,
    store: string,
    fromDate: Date,
    toDate?: Date
  ) {
    return prisma.posPayment.findMany({
      where: {
        tenantId,
        method: 'CASH',
        status: { in: ['SUCCESS', 'PAID', 'COMPLETED'] },
        createdAt: {
          gte: fromDate,
          ...(toDate ? { lte: toDate } : {}),
        },
        order: {
          status: { not: 'CANCELLED' },
          ...(store ? { guest: { store } } : {}),
        },
      },
      include: {
        order: {
          include: {
            guest: true,
            items: {
              include: {
                staff: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSessionCashExpenses(
    tenantId: string,
    store: string,
    fromDate: Date,
    toDate?: Date
  ) {
    return prisma.expenseTransaction.findMany({
      where: {
        tenantId,
        paymentMethod: 'CASH',
        createdAt: {
          gte: fromDate,
          ...(toDate ? { lte: toDate } : {}),
        },
        ...(store ? { store } : {}),
      },
      include: {
        category: true,
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async closeCounter(
    tenantId: string,
    transactionId: string,
    data: CloseCounterDto,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const active = await tx.cashTransaction.findFirst({
        where: { id: transactionId, tenantId, status: 'OPEN' },
      });

      if (!active) {
        throw new Error('Transaction not found or already closed');
      }

      // Calculate real session payments and expenses from active.createdAt to now
      const payments = await tx.posPayment.findMany({
        where: {
          tenantId,
          method: 'CASH',
          status: { in: ['SUCCESS', 'PAID', 'COMPLETED'] },
          createdAt: { gte: active.createdAt },
          order: {
            status: { not: 'CANCELLED' },
            ...(active.store ? { guest: { store: active.store } } : {}),
          },
        },
      });

      const expenses = await tx.expenseTransaction.findMany({
        where: {
          tenantId,
          paymentMethod: 'CASH',
          createdAt: { gte: active.createdAt },
          ...(active.store ? { store: active.store } : {}),
        },
      });

      const cashRevenue = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const cashExpense = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
      const openingBalance = Number(active.openingBalance);
      const closingBalance = openingBalance + cashRevenue - cashExpense;
      const instoreCash = Number(data.instoreCash);
      const reconciliation = instoreCash - closingBalance;

      const updateResult = await tx.cashTransaction.updateMany({
        where: { id: transactionId, tenantId, status: 'OPEN' },
        data: {
          status: 'CLOSED',
          cashRevenue: new Prisma.Decimal(cashRevenue),
          cashExpense: new Prisma.Decimal(cashExpense),
          closingBalance: new Prisma.Decimal(closingBalance),
          instoreCash: new Prisma.Decimal(instoreCash),
          reconciliation: new Prisma.Decimal(reconciliation),
          closingRemark: data.remarks.trim(),
          updatedById: userId,
          closedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Transaction not found or already closed');
      }

      const closed = await tx.cashTransaction.findUnique({
        where: { id: transactionId },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              role: { select: { name: true } },
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return closed!;
    });
  }

  async updateTransaction(
    tenantId: string,
    transactionId: string,
    data: UpdateCashTransactionDto,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.cashTransaction.findFirst({
        where: { id: transactionId, tenantId },
      });

      if (!existing) {
        throw new Error('Transaction not found');
      }

      const openingBalance = data.openingBalance !== undefined
        ? Number(data.openingBalance)
        : Number(existing.openingBalance);

      const instoreCash = data.instoreCash !== undefined
        ? Number(data.instoreCash)
        : Number(existing.instoreCash);

      const cashRevenue = Number(existing.cashRevenue);
      const cashExpense = Number(existing.cashExpense);
      const closingBalance = openingBalance + cashRevenue - cashExpense;
      const reconciliation = instoreCash - closingBalance;

      return tx.cashTransaction.update({
        where: { id: transactionId },
        data: {
          openingBalance: new Prisma.Decimal(openingBalance),
          instoreCash: new Prisma.Decimal(instoreCash),
          closingBalance: new Prisma.Decimal(closingBalance),
          reconciliation: new Prisma.Decimal(reconciliation),
          closingRemark: data.closingRemark !== undefined ? data.closingRemark : existing.closingRemark,
          updateRemark: data.updateRemark.trim(),
          updatedById: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              role: { select: { name: true } },
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    });
  }

  async listTransactions(tenantId: string, query: QueryCashTransactionsDto) {
    const where: Prisma.CashTransactionWhereInput = {
      tenantId,
      ...(query.store ? { store: query.store } : {}),
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
    };

    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.cashTransaction.count({ where }),
      prisma.cashTransaction.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              role: { select: { name: true } },
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createExpense(
    tenantId: string,
    data: CreateCashExpenseDto,
    _userId?: string
  ) {
    let categoryId = data.categoryId;

    if (!categoryId) {
      const categoryName = data.categoryName || 'Store Cash Expense';
      const existingCategory = await prisma.pnlCategory.findFirst({
        where: { tenantId, name: categoryName },
      });

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const createdCategory = await prisma.pnlCategory.create({
          data: {
            tenantId,
            name: categoryName,
            type: 'EXPENSE',
            description: 'Cash management created expense category',
          },
        });
        categoryId = createdCategory.id;
      }
    }

    return prisma.expenseTransaction.create({
      data: {
        tenantId,
        categoryId,
        amount: new Prisma.Decimal(data.amount),
        paymentMethod: 'CASH',
        staffId: data.staffId,
        vendorName: data.vendorName,
        description: data.description,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        store: data.store || 'kalyaninagar',
      },
      include: {
        category: true,
        staff: true,
      },
    });
  }
}

export const cashManagementRepository = new CashManagementRepository();
