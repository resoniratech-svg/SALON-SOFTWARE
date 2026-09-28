import { Request, Response, NextFunction } from 'express';
import { cashManagementService } from './cash-management.service.js';
import {
  startCashTransactionSchema,
  closeCounterSchema,
  updateCashTransactionSchema,
  createCashExpenseSchema,
  queryCashTransactionsSchema,
} from './cash-management.dto.js';

export class CashManagementController {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const store = (req.query.store as string) || 'kalyaninagar';
      const data = await cashManagementService.getSummary(tenantId, store);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async startTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const validated = startCashTransactionSchema.parse(req.body);
      const data = await cashManagementService.startTransaction(tenantId, validated, req.user?.id);
      res.status(201).json({
        success: true,
        message: 'Cash counter transaction started successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async closeCounter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const store = (req.query.store as string) || req.body.store || 'kalyaninagar';
      const transactionId = (req.params.id as string) || (req.body.transactionId as string) || undefined;
      const validated = closeCounterSchema.parse(req.body);
      const data = await cashManagementService.closeCounter(tenantId, validated, req.user?.id, store, transactionId);
      res.status(200).json({
        success: true,
        message: 'Counter closed successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const validated = updateCashTransactionSchema.parse(req.body);
      const data = await cashManagementService.updateTransaction(
        tenantId,
        req.params.id as string,
        validated,
        req.user?.id
      );
      res.status(200).json({
        success: true,
        message: 'Cash transaction updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const query = queryCashTransactionsSchema.parse(req.query);

      if (query.export === 'csv') {
        const csv = await cashManagementService.exportCashTransactionsCsv(tenantId, query);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="cash-transactions-export-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        res.status(200).send(csv);
        return;
      }

      const result = await cashManagementService.listTransactions(tenantId, query);
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const data = await cashManagementService.getTransactionById(tenantId, req.params.id as string);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const store = (req.query.store as string) || 'kalyaninagar';
      const transactionId = req.query.transactionId as string | undefined;
      const data = await cashManagementService.getRevenue(tenantId, store, transactionId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const store = (req.query.store as string) || 'kalyaninagar';
      const transactionId = req.query.transactionId as string | undefined;
      const data = await cashManagementService.getExpenses(tenantId, store, transactionId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const validated = createCashExpenseSchema.parse(req.body);
      const data = await cashManagementService.createExpense(tenantId, validated, req.user?.id);
      res.status(201).json({
        success: true,
        message: 'Cash expense recorded successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNextOpeningBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.effectiveTenantId || req.tenantId!;
      const store = (req.query.store as string) || 'kalyaninagar';
      const data = await cashManagementService.getNextOpeningBalance(tenantId, store);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const cashManagementController = new CashManagementController();
