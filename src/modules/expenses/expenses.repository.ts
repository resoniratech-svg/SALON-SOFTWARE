import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
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
import { BadRequestError, NotFoundError } from '../../utils/app-error.js';

export class ExpensesRepository {
  // ==========================================
  // 1. EXPENSES CRUD & LISTING
  // ==========================================

  async findExpenses(tenantId: string, filters: ExpenseFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseTransactionWhereInput = {
      tenantId,
    };

    if (filters.store && filters.store.toLowerCase() !== 'all') {
      where.store = { equals: filters.store.trim(), mode: 'insensitive' };
    }

    const paymode = filters.paymode;
    if (paymode && paymode.toLowerCase() !== 'all') {
      where.paymentMethod = { equals: paymode.trim(), mode: 'insensitive' };
    }

    if (filters.accountId && filters.accountId.toLowerCase() !== 'all') {
      where.accountId = filters.accountId;
    }

    if (filters.expenseTypeId && filters.expenseTypeId.toLowerCase() !== 'all') {
      where.expenseTypeId = filters.expenseTypeId;
    }

    if (filters.givenTo && filters.givenTo.toLowerCase() !== 'all') {
      where.givenTo = { contains: filters.givenTo.trim(), mode: 'insensitive' };
    }

    const fromDateStr = filters.fromDate;
    const toDateStr = filters.toDate;
    if (fromDateStr || toDateStr) {
      where.expenseDate = {};
      if (fromDateStr) {
        where.expenseDate.gte = new Date(fromDateStr);
      }
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        if (toDateStr.length === 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        where.expenseDate.lte = toDate;
      }
    }

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { expenseTypeName: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { givenTo: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { remark: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortBy = filters.sortBy || 'expenseDate';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy: Prisma.ExpenseTransactionOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [total, data, aggregate] = await Promise.all([
      prisma.expenseTransaction.count({ where }),
      prisma.expenseTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          account: true,
          expenseType: true,
          category: true,
          staff: { select: { id: true, name: true } },
        },
      }),
      prisma.expenseTransaction.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const totalAmount = aggregate._sum.amount ? Number(aggregate._sum.amount) : 0;

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }

  async findExpenseById(tenantId: string, id: string) {
    return prisma.expenseTransaction.findFirst({
      where: { id, tenantId },
      include: {
        account: true,
        expenseType: true,
        category: true,
        staff: { select: { id: true, name: true } },
      },
    });
  }

  async createExpense(tenantId: string, input: CreateExpenseInput) {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) {
      throw new BadRequestError('Expense amount must be greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      let accountName: string | null = null;
      let expenseTypeName = input.expenseTypeName || null;

      // 1. Validate & process Account balance deduction if account provided
      if (input.accountId) {
        const account = await tx.financialAccount.findFirst({
          where: { id: input.accountId, tenantId },
        });

        if (!account) {
          throw new NotFoundError(`Account not found in this salon`);
        }

        accountName = account.accountName;

        // Atomically Update Account Balance
        const updatedAccount = await tx.financialAccount.update({
          where: { id: account.id },
          data: { balance: { decrement: amount } },
        });

        const afterBalance = updatedAccount.balance;
        const beforeBalance = afterBalance.plus(amount);

        // Record Account Transaction
        await tx.accountTransaction.create({
          data: {
            tenantId,
            accountId: account.id,
            beforeBalance,
            amount,
            afterBalance,
            type: 'EXPENSE',
            expenseTypeId: input.expenseTypeId || null,
            expenseTypeName: expenseTypeName || 'General Expense',
            paymode: input.paymode || input.paymentMethod || 'CASH',
            remark: input.remark || input.description || `Expense deduction`,
            transactionDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
          },
        });
      }

      // 2. Fetch ExpenseType details if ID provided
      if (input.expenseTypeId) {
        const expType = await tx.expenseType.findFirst({
          where: { id: input.expenseTypeId, tenantId },
        });
        if (expType) {
          expenseTypeName = expType.name;
        }
      }

      // 3. Fallback PnlCategory resolution if needed
      let categoryId = input.categoryId;
      if (!categoryId) {
        const pnl = await tx.pnlCategory.findFirst({
          where: { tenantId, type: 'EXPENSE' },
        });
        if (pnl) {
          categoryId = pnl.id;
        }
      }

      // 4. Create Expense Transaction
      const created = await tx.expenseTransaction.create({
        data: {
          tenantId,
          categoryId,
          expenseTypeId: input.expenseTypeId || null,
          expenseTypeName,
          accountId: input.accountId || null,
          accountName,
          amount,
          paymentMethod: input.paymode || input.paymentMethod || 'CASH',
          givenTo: input.givenTo || null,
          vendorName: input.vendorName || null,
          description: input.description || null,
          remark: input.remark || null,
          expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
          store: input.store || 'kalyaninagar',
          staffId: input.staffId || null,
        },
        include: {
          account: true,
          expenseType: true,
          category: true,
          staff: { select: { id: true, name: true } },
        },
      });

      return created;
    });
  }

  async updateExpense(tenantId: string, id: string, input: UpdateExpenseInput) {
    const existing = await this.findExpenseById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Expense not found');
    }

    return prisma.$transaction(async (tx) => {
      let newAmount = existing.amount;
      if (input.amount !== undefined && input.amount !== null) {
        newAmount = new Prisma.Decimal(input.amount);
      }

      // If account or amount changed, adjust balances accordingly
      if (existing.accountId && (input.amount !== undefined || input.accountId !== undefined)) {
        const targetAccountId = input.accountId || existing.accountId;
        if (targetAccountId === existing.accountId) {
          // Same account, adjust difference
          const diff = newAmount.minus(existing.amount);
          if (!diff.isZero()) {
            const acc = await tx.financialAccount.findUnique({ where: { id: existing.accountId } });
            if (acc) {
              const updatedAcc = await tx.financialAccount.update({
                where: { id: acc.id },
                data: { balance: { decrement: diff } },
              });
              const afterBalance = updatedAcc.balance;
              const beforeBalance = afterBalance.plus(diff);
              await tx.accountTransaction.create({
                data: {
                  tenantId,
                  accountId: acc.id,
                  beforeBalance,
                  amount: diff.abs(),
                  afterBalance,
                  type: 'ADJUSTMENT',
                  expenseTypeId: input.expenseTypeId || existing.expenseTypeId,
                  expenseTypeName: input.expenseTypeName || existing.expenseTypeName || 'Expense Adjustment',
                  paymode: input.paymode || existing.paymentMethod,
                  remark: `Adjustment for updated expense ${id}`,
                },
              });
            }
          }
        }
      }

      const updated = await tx.expenseTransaction.update({
        where: { id },
        data: {
          ...(input.amount !== undefined && { amount: newAmount }),
          ...(input.expenseDate && { expenseDate: new Date(input.expenseDate) }),
          ...(input.expenseTypeId !== undefined && { expenseTypeId: input.expenseTypeId }),
          ...(input.expenseTypeName !== undefined && { expenseTypeName: input.expenseTypeName }),
          ...(input.accountId !== undefined && { accountId: input.accountId }),
          ...(input.paymode && { paymentMethod: input.paymode }),
          ...(input.paymentMethod && { paymentMethod: input.paymentMethod }),
          ...(input.givenTo !== undefined && { givenTo: input.givenTo }),
          ...(input.vendorName !== undefined && { vendorName: input.vendorName }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.remark !== undefined && { remark: input.remark }),
          ...(input.store && { store: input.store }),
          ...(input.staffId !== undefined && { staffId: input.staffId }),
        },
        include: {
          account: true,
          expenseType: true,
          category: true,
          staff: { select: { id: true, name: true } },
        },
      });

      return updated;
    });
  }

  async deleteExpense(tenantId: string, id: string) {
    const existing = await this.findExpenseById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Expense not found');
    }

    return prisma.$transaction(async (tx) => {
      // Revert account deduction if linked
      if (existing.accountId) {
        const acc = await tx.financialAccount.findUnique({ where: { id: existing.accountId } });
        if (acc) {
          const updatedAcc = await tx.financialAccount.update({
            where: { id: acc.id },
            data: { balance: { increment: existing.amount } },
          });
          const afterBalance = updatedAcc.balance;
          const beforeBalance = afterBalance.minus(existing.amount);

          await tx.accountTransaction.create({
            data: {
              tenantId,
              accountId: acc.id,
              beforeBalance,
              amount: existing.amount,
              afterBalance,
              type: 'ADJUSTMENT',
              remark: `Reversal of deleted expense ${id}`,
              paymode: existing.paymentMethod,
            },
          });
        }
      }

      await tx.expenseTransaction.delete({ where: { id } });
      return { success: true, message: 'Expense deleted successfully' };
    });
  }

  async getDashboardSummary(tenantId: string, store?: string, fromDate?: string, toDate?: string) {
    const where: Prisma.ExpenseTransactionWhereInput = {
      tenantId,
    };

    if (store && store.toLowerCase() !== 'all') {
      where.store = { equals: store.trim(), mode: 'insensitive' };
    }

    if (fromDate || toDate) {
      where.expenseDate = {};
      if (fromDate) where.expenseDate.gte = new Date(fromDate);
      if (toDate) {
        const toDateObj = new Date(toDate);
        if (toDate.length === 10) toDateObj.setHours(23, 59, 59, 999);
        where.expenseDate.lte = toDateObj;
      }
    }

    const [totalCount, aggregate, allExpenses, recentExpenses] = await Promise.all([
      prisma.expenseTransaction.count({ where }),
      prisma.expenseTransaction.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.expenseTransaction.findMany({
        where,
        select: {
          amount: true,
          paymentMethod: true,
          expenseTypeName: true,
        },
      }),
      prisma.expenseTransaction.findMany({
        where,
        take: 5,
        orderBy: { expenseDate: 'desc' },
      }),
    ]);

    const totalAmount = Number(aggregate._sum.amount || 0);

    // Group by category (expenseTypeName)
    const categoryMap: Record<string, { category: string; amount: number; count: number }> = {};
    for (const exp of allExpenses) {
      const cat = exp.expenseTypeName || 'Uncategorized';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, amount: 0, count: 0 };
      }
      categoryMap[cat].amount += Number(exp.amount);
      categoryMap[cat].count += 1;
    }

    // Group by paymode (paymentMethod)
    const paymodeMap: Record<string, { paymode: string; amount: number; count: number }> = {};
    for (const exp of allExpenses) {
      const pm = exp.paymentMethod || 'OTHER';
      if (!paymodeMap[pm]) {
        paymodeMap[pm] = { paymode: pm, amount: 0, count: 0 };
      }
      paymodeMap[pm].amount += Number(exp.amount);
      paymodeMap[pm].count += 1;
    }

    return {
      totalAmount,
      totalCount,
      byCategory: Object.values(categoryMap),
      byPaymode: Object.values(paymodeMap),
      recentExpenses: recentExpenses.map((e) => ({
        ...e,
        amount: Number(e.amount),
      })),
    };
  }

  // ==========================================
  // 2. EXPENSE TYPES CRUD
  // ==========================================

  async findExpenseTypes(tenantId: string, includeInactive = false) {
    return prisma.expenseType.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findExpenseTypeById(tenantId: string, id: string) {
    return prisma.expenseType.findFirst({
      where: { id, tenantId },
    });
  }

  async createExpenseType(tenantId: string, input: CreateExpenseTypeInput) {
    const existing = await prisma.expenseType.findFirst({
      where: {
        tenantId,
        name: { equals: input.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new BadRequestError(`Expense type "${input.name}" already exists`);
    }

    return prisma.expenseType.create({
      data: {
        tenantId,
        name: input.name.trim(),
        pnlCategory: input.pnlCategory || 'General And Administrative Expenses',
        isActive: input.isActive != null ? input.isActive : true,
      },
    });
  }

  async updateExpenseType(tenantId: string, id: string, input: UpdateExpenseTypeInput) {
    const existing = await this.findExpenseTypeById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Expense type not found');
    }

    if (input.name && input.name.trim() !== existing.name) {
      const duplicate = await prisma.expenseType.findFirst({
        where: {
          tenantId,
          name: { equals: input.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestError(`Expense type "${input.name}" already exists`);
      }
    }

    return prisma.expenseType.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.pnlCategory && { pnlCategory: input.pnlCategory }),
        ...(input.isActive != null && { isActive: input.isActive }),
      },
    });
  }

  async deleteExpenseType(tenantId: string, id: string) {
    const existing = await this.findExpenseTypeById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Expense type not found');
    }

    // Soft delete / deactivate
    return prisma.expenseType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==========================================
  // 3. FINANCIAL ACCOUNTS & TRANSACTIONS
  // ==========================================

  async findAccounts(tenantId: string, includeInactive = false) {
    const accounts = await prisma.financialAccount.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { accountName: 'asc' },
    });

    return accounts.map((acc) => ({
      ...acc,
      balance: Number(acc.balance),
    }));
  }

  async findAccountById(tenantId: string, id: string) {
    const account = await prisma.financialAccount.findFirst({
      where: { id, tenantId },
    });
    if (!account) return null;
    return {
      ...account,
      balance: Number(account.balance),
    };
  }

  async createAccount(tenantId: string, input: CreateAccountInput) {
    const existing = await prisma.financialAccount.findFirst({
      where: {
        tenantId,
        accountName: { equals: input.accountName.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new BadRequestError(`Account "${input.accountName}" already exists`);
    }

    const created = await prisma.financialAccount.create({
      data: {
        tenantId,
        accountName: input.accountName.trim(),
        accountType: input.accountType || 'Current',
        balance: new Prisma.Decimal(input.balance || 0),
        bankName: input.bankName || null,
        accountNumber: input.accountNumber || null,
        isActive: input.isActive != null ? input.isActive : true,
      },
    });

    // If initial balance > 0, log initial deposit transaction
    if (input.balance && input.balance > 0) {
      await prisma.accountTransaction.create({
        data: {
          tenantId,
          accountId: created.id,
          beforeBalance: new Prisma.Decimal(0),
          amount: new Prisma.Decimal(input.balance),
          afterBalance: new Prisma.Decimal(input.balance),
          type: 'TOP_UP',
          paymode: 'INITIAL_BALANCE',
          remark: 'Initial account opening balance',
        },
      });
    }

    return {
      ...created,
      balance: Number(created.balance),
    };
  }

  async updateAccount(tenantId: string, id: string, input: UpdateAccountInput) {
    const existing = await prisma.financialAccount.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Account not found');
    }

    const updated = await prisma.financialAccount.update({
      where: { id },
      data: {
        ...(input.accountName && { accountName: input.accountName.trim() }),
        ...(input.accountType && { accountType: input.accountType }),
        ...(input.bankName !== undefined && { bankName: input.bankName }),
        ...(input.accountNumber !== undefined && { accountNumber: input.accountNumber }),
        ...(input.isActive != null && { isActive: input.isActive }),
      },
    });

    return {
      ...updated,
      balance: Number(updated.balance),
    };
  }

  async addBalanceOrTransfer(tenantId: string, input: AddBalanceInput) {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) {
      throw new BadRequestError('Amount must be greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      const sourceAccount = await tx.financialAccount.findFirst({
        where: { id: input.accountId, tenantId },
      });

      if (!sourceAccount) {
        throw new NotFoundError('Source account not found');
      }

      const txDate = input.date ? new Date(input.date) : new Date();

      // Case A: Internal Transfer between two accounts
      if (input.transferToAccountId && input.transferToAccountId.trim() !== '') {
        if (input.transferToAccountId === input.accountId) {
          throw new BadRequestError('Source and destination accounts must be different');
        }

        const destAccount = await tx.financialAccount.findFirst({
          where: { id: input.transferToAccountId, tenantId },
        });

        if (!destAccount) {
          throw new NotFoundError('Destination transfer account not found');
        }

        // Atomically update balances
        const updatedSource = await tx.financialAccount.update({
          where: { id: sourceAccount.id },
          data: { balance: { decrement: amount } },
        });

        const updatedDest = await tx.financialAccount.update({
          where: { id: destAccount.id },
          data: { balance: { increment: amount } },
        });

        const sourceAfter = updatedSource.balance;
        const sourceBefore = sourceAfter.plus(amount);

        const destAfter = updatedDest.balance;
        const destBefore = destAfter.minus(amount);

        // Record Debit on Source
        const sourceTx = await tx.accountTransaction.create({
          data: {
            tenantId,
            accountId: sourceAccount.id,
            beforeBalance: sourceBefore,
            amount,
            afterBalance: sourceAfter,
            type: 'TRANSFER_OUT',
            transferToAccountId: destAccount.id,
            transferToName: destAccount.accountName,
            paymode: input.paymode || 'INTERNAL_TRANSFER',
            remark: input.remark || `Transfer to ${destAccount.accountName}`,
            transactionDate: txDate,
          },
        });

        // Record Credit on Destination
        await tx.accountTransaction.create({
          data: {
            tenantId,
            accountId: destAccount.id,
            beforeBalance: destBefore,
            amount,
            afterBalance: destAfter,
            type: 'TRANSFER_IN',
            transferToAccountId: sourceAccount.id,
            transferToName: sourceAccount.accountName,
            paymode: input.paymode || 'INTERNAL_TRANSFER',
            remark: input.remark || `Transfer from ${sourceAccount.accountName}`,
            transactionDate: txDate,
          },
        });

        return {
          type: 'TRANSFER',
          sourceAccount: { id: sourceAccount.id, name: sourceAccount.accountName, beforeBalance: Number(sourceBefore), afterBalance: Number(sourceAfter) },
          destinationAccount: { id: destAccount.id, name: destAccount.accountName, beforeBalance: Number(destBefore), afterBalance: Number(destAfter) },
          transaction: sourceTx,
        };
      }

      // Case B: Direct Top-Up / Deposit
      const updated = await tx.financialAccount.update({
        where: { id: sourceAccount.id },
        data: { balance: { increment: amount } },
      });

      const afterBalance = updated.balance;
      const beforeBalance = afterBalance.minus(amount);

      const topUpTx = await tx.accountTransaction.create({
        data: {
          tenantId,
          accountId: sourceAccount.id,
          beforeBalance,
          amount,
          afterBalance,
          type: 'TOP_UP',
          paymode: input.paymode || 'CASH',
          remark: input.remark || 'Add balance / deposit',
          transactionDate: txDate,
        },
      });

      return {
        type: 'TOP_UP',
        account: { id: sourceAccount.id, name: sourceAccount.accountName, beforeBalance: Number(beforeBalance), afterBalance: Number(afterBalance) },
        transaction: topUpTx,
      };
    });
  }

  async findAccountTransactions(tenantId: string, filters: AccountTransactionFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountTransactionWhereInput = {
      tenantId,
    };

    if (filters.accountId && filters.accountId.toLowerCase() !== 'all') {
      where.accountId = filters.accountId;
    }

    if (filters.type && filters.type.toLowerCase() !== 'all') {
      where.type = filters.type;
    }

    if (filters.paymode && filters.paymode.toLowerCase() !== 'all') {
      where.paymode = { equals: filters.paymode.trim(), mode: 'insensitive' };
    }

    const fromDateStr = filters.fromDate;
    const toDateStr = filters.toDate;
    if (fromDateStr || toDateStr) {
      where.transactionDate = {};
      if (fromDateStr) where.transactionDate.gte = new Date(fromDateStr);
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        if (toDateStr.length === 10) toDate.setHours(23, 59, 59, 999);
        where.transactionDate.lte = toDate;
      }
    }

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { transferToName: { contains: search, mode: 'insensitive' } },
        { expenseTypeName: { contains: search, mode: 'insensitive' } },
        { remark: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.accountTransaction.count({ where }),
      prisma.accountTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          account: true,
        },
      }),
    ]);

    return {
      data: data.map((d) => ({
        ...d,
        beforeBalance: Number(d.beforeBalance),
        amount: Number(d.amount),
        afterBalance: Number(d.afterBalance),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
