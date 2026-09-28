import { Request, Response, NextFunction } from 'express';
import { expensesService, ExpensesService } from './expenses.service.js';
import {
  accountTransactionQuerySchema,
  addBalanceSchema,
  createAccountSchema,
  createExpenseSchema,
  createExpenseTypeSchema,
  expenseQuerySchema,
  updateAccountSchema,
  updateExpenseSchema,
  updateExpenseTypeSchema,
} from './expenses.dto.js';
import { BadRequestError } from '../../utils/app-error.js';

export class ExpensesController {
  constructor(private service: ExpensesService = expensesService) {}

  private getTenantId(req: Request): string {
    const tenantId = (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.user?.isSuperAdmin
        ? (req.headers['x-tenant-id'] || req.headers['x-impersonate-tenant-id'])
        : undefined)
    ) as string;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }
    return tenantId;
  }

  // -------------------------------------------------------------
  // Expenses Endpoints
  // -------------------------------------------------------------

  getExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = expenseQuerySchema.parse({
        ...req.query,
        ...(req.query.startDate && { fromDate: req.query.startDate }),
        ...(req.query.endDate && { toDate: req.query.endDate }),
      });

      if (query.export === 'csv') {
        const csv = await this.service.exportExpensesCsv(tenantId, query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="expenses-export-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        res.status(200).send(csv);
        return;
      }

      const result = await this.service.getExpenses(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'Expenses retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getDashboardSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const store = req.query.store as string | undefined;
      const fromDate = (req.query.fromDate || req.query.startDate) as string | undefined;
      const toDate = (req.query.toDate || req.query.endDate) as string | undefined;
      const result = await this.service.getDashboardSummary(tenantId, store, fromDate, toDate);
      res.status(200).json({
        success: true,
        message: 'Expenses dashboard summary retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getExpenseById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getExpenseById(tenantId, id);
      if (!result) {
        res.status(404).json({ success: false, message: 'Expense not found' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Expense retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = createExpenseSchema.parse(req.body);
      const result = await this.service.createExpense(tenantId, input);
      res.status(201).json({
        success: true,
        message: 'Expense created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateExpenseSchema.parse(req.body);
      const result = await this.service.updateExpense(tenantId, id, input);
      res.status(200).json({
        success: true,
        message: 'Expense updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteExpense(tenantId, id);
      res.status(200).json({
        success: true,
        message: 'Expense deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // -------------------------------------------------------------
  // Expense Types Endpoints
  // -------------------------------------------------------------

  getExpenseTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const includeInactive = req.query.includeInactive === 'true';
      const result = await this.service.getExpenseTypes(tenantId, includeInactive);
      res.status(200).json({
        success: true,
        message: 'Expense types retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getExpenseTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getExpenseTypeById(tenantId, id);
      if (!result) {
        res.status(404).json({ success: false, message: 'Expense type not found' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Expense type retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createExpenseType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = createExpenseTypeSchema.parse(req.body);
      const result = await this.service.createExpenseType(tenantId, input);
      res.status(201).json({
        success: true,
        message: 'Expense type created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateExpenseType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateExpenseTypeSchema.parse(req.body);
      const result = await this.service.updateExpenseType(tenantId, id, input);
      res.status(200).json({
        success: true,
        message: 'Expense type updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteExpenseType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteExpenseType(tenantId, id);
      res.status(200).json({
        success: true,
        message: 'Expense type deactivated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // -------------------------------------------------------------
  // Financial Accounts & Transactions Endpoints
  // -------------------------------------------------------------

  getAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const includeInactive = req.query.includeInactive === 'true';
      const result = await this.service.getAccounts(tenantId, includeInactive);
      res.status(200).json({
        success: true,
        message: 'Accounts retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getAccountById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getAccountById(tenantId, id);
      if (!result) {
        res.status(404).json({ success: false, message: 'Account not found' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Account retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = createAccountSchema.parse(req.body);
      const result = await this.service.createAccount(tenantId, input);
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateAccountSchema.parse(req.body);
      const result = await this.service.updateAccount(tenantId, id, input);
      res.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  addBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = addBalanceSchema.parse(req.body);
      const result = await this.service.addBalanceOrTransfer(tenantId, input);
      res.status(200).json({
        success: true,
        message: input.transferToAccountId ? 'Internal transfer completed successfully' : 'Balance added successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getAccountTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = accountTransactionQuerySchema.parse({
        ...req.query,
        ...(req.query.startDate && { fromDate: req.query.startDate }),
        ...(req.query.endDate && { toDate: req.query.endDate }),
        ...(req.params.id && { accountId: req.params.id }),
      });
      const result = await this.service.getAccountTransactions(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'Account transactions retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const expensesController = new ExpensesController();
