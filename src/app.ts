import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './modules/auth/auth.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import serviceCategoryRoutes from './modules/service-categories/service-category.routes.js';
import serviceRoutes from './modules/services/service.routes.js';
import productCategoryRoutes from './modules/product-categories/product-category.routes.js';
import productRoutes from './modules/products/product.routes.js';
import disposableRoutes from './modules/disposables/disposable.routes.js';
import packageRoutes from './modules/packages/package.routes.js';
import platformRoutes from './modules/platform/platform.routes.js';
import cashierRoutes from './modules/cashiers/cashier.routes.js';
import resourceRoutes from './modules/resources/resource.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import guestRoutes from './modules/guests/guest.routes.js';
import posRoutes from './modules/pos/pos.routes.js';
import appointmentRoutes from './modules/appointments/appointment.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import trendsRoutes from './modules/trends/trends.routes.js';
import cashManagementRoutes from './modules/cash-management/cash-management.routes.js';
import { expenseRouter, expenseTypeRouter, accountRouter } from './modules/expenses/expenses.routes.js';
import { enquiryRouter, referralRouter } from './modules/enquiries/enquiries.routes.js';
import { payrollRouter } from './modules/payroll/payroll.routes.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

export const createApp = (): Express => {
  const app = express();

  // Standard Security & Body Parsing Middlewares
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'QUBEXE SALOON SOFTWARE Backend API' });
  });

  // Module 01: Authentication
  app.use('/api/auth', authRoutes);

  // Module 02: Staff Agent / Staff Management
  app.use('/api/staff', staffRoutes);

  // Module 03: Service Categories
  app.use('/api/service-categories', serviceCategoryRoutes);

  // Module 04: Services
  app.use('/api/services', serviceRoutes);

  // Module 05: Product Categories
  app.use('/api/product-categories', productCategoryRoutes);

  // Module 06: Products
  app.use('/api/products', productRoutes);

  // Module 07: Disposables
  app.use('/api/disposables', disposableRoutes);

  // Packages Module
  app.use('/api/packages', packageRoutes);

  // Platform / SuperAdmin Management
  app.use('/api/platform', platformRoutes);

  // Cashier Management (Admin)
  app.use('/api/cashiers', cashierRoutes);

  // Resources Module
  app.use('/api/resources', resourceRoutes);

  // Settings Module
  app.use('/api/settings', settingsRoutes);

  // CRM Module: Guests
  app.use('/api/crm/guests', guestRoutes);
  app.use('/api/crm', guestRoutes);
  app.use('/api/guests', guestRoutes);

  // Module 08: POS (Point of Sale)
  app.use('/api/pos', posRoutes);
  app.use('/api/orders', posRoutes);

  // Module 12: Appointments & Scheduling (Calendar)
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/appointment', appointmentRoutes);

  // Module 13: Reports & Analytics (All 41 Reports)
  app.use('/api/reports', reportsRoutes);

  // Module 14: Inventory & Stock Management
  app.use('/api/inventory', inventoryRoutes);

  // Module 15: Trends & Performance Analytics
  app.use('/api/trends', trendsRoutes);
  app.use('/api/trend', trendsRoutes);

  // Module 16: Cash Management
  app.use('/api/cash-management', cashManagementRoutes);
  app.use('/api/cash-mgmt', cashManagementRoutes);

  // Module 17: Expenses, Types & Financial Accounts
  app.use('/api/expenses', expenseRouter);
  app.use('/api/expense-types', expenseTypeRouter);
  app.use('/api/accounts', accountRouter);

  // Module 18: Enquiries & Referral Dashboard
  app.use('/api/enquiries', enquiryRouter);
  app.use('/api/enquiry', enquiryRouter);
  app.use('/api/referrals', referralRouter);
  app.use('/api/referral', referralRouter);

  // Module 19: Payroll Management & Payslips
  app.use('/api/payroll', payrollRouter);

  // Module 20: WhatsApp Chat & Message History
  app.use('/api/whatsapp', whatsappRouter);

  // Centralized Error Handling Middleware (must be registered last)
  app.use(errorHandler);

  return app;
};
