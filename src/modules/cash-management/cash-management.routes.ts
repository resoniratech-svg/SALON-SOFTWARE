import { Router } from 'express';
import { cashManagementController } from './cash-management.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// Module access protection
router.use(authenticateJwt);
router.use(requireModule('CASH_MGMT'));

// 1. Counter Summary & Active Transaction
router.get('/summary', (req, res, next) => cashManagementController.getSummary(req, res, next));

// 2. Next Opening Balance (Suggested from previous closed transaction)
router.get('/next-opening-balance', (req, res, next) => cashManagementController.getNextOpeningBalance(req, res, next));

// 3. Start New Transaction
router.post('/start', (req, res, next) => cashManagementController.startTransaction(req, res, next));

// 4. Close Counter Modal & Action
router.post('/close', (req, res, next) => cashManagementController.closeCounter(req, res, next));
router.post('/close/:id', (req, res, next) => cashManagementController.closeCounter(req, res, next));
router.post('/transactions/:id/close', (req, res, next) => cashManagementController.closeCounter(req, res, next));

// 5. Transactions History (Transactions Tab)
router.get('/transactions', (req, res, next) => cashManagementController.listTransactions(req, res, next));
router.get('/transactions/:id', (req, res, next) => cashManagementController.getTransactionById(req, res, next));
router.patch('/transactions/:id', (req, res, next) => cashManagementController.updateTransaction(req, res, next));
router.put('/transactions/:id', (req, res, next) => cashManagementController.updateTransaction(req, res, next));

// 6. Revenue Tab (POS cash payments in active session)
router.get('/revenue', (req, res, next) => cashManagementController.getRevenue(req, res, next));

// 7. Expenses Tab (Cash expenses in active session)
router.get('/expenses', (req, res, next) => cashManagementController.getExpenses(req, res, next));
router.post('/expenses', (req, res, next) => cashManagementController.createExpense(req, res, next));

export default router;
