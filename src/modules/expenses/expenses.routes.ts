import { Router } from 'express';
import { expensesController } from './expenses.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

// Router 1: Expenses
export const expenseRouter = Router();
expenseRouter.use(authenticateJwt);

expenseRouter.get('/', expensesController.getExpenses);
expenseRouter.get('/dashboard', expensesController.getDashboardSummary);
expenseRouter.get('/dashboard/summary', expensesController.getDashboardSummary);
expenseRouter.post('/', expensesController.createExpense);
expenseRouter.get('/:id', expensesController.getExpenseById);
expenseRouter.put('/:id', expensesController.updateExpense);
expenseRouter.delete('/:id', expensesController.deleteExpense);

// Router 2: Expense Types
export const expenseTypeRouter = Router();
expenseTypeRouter.use(authenticateJwt);

expenseTypeRouter.get('/', expensesController.getExpenseTypes);
expenseTypeRouter.post('/', expensesController.createExpenseType);
expenseTypeRouter.get('/:id', expensesController.getExpenseTypeById);
expenseTypeRouter.put('/:id', expensesController.updateExpenseType);
expenseTypeRouter.delete('/:id', expensesController.deleteExpenseType);

// Router 3: Accounts
export const accountRouter = Router();
accountRouter.use(authenticateJwt);

accountRouter.get('/', expensesController.getAccounts);
accountRouter.post('/', expensesController.createAccount);
accountRouter.post('/balance', expensesController.addBalance);
accountRouter.post('/add-balance', expensesController.addBalance);
accountRouter.get('/transactions', expensesController.getAccountTransactions);
accountRouter.get('/:id', expensesController.getAccountById);
accountRouter.put('/:id', expensesController.updateAccount);
accountRouter.get('/:id/transactions', expensesController.getAccountTransactions);
