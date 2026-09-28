import { Request, Response, NextFunction } from 'express';
import { reportQuerySchema } from './reports.dto.js';
import { reportsService } from './reports.service.js';
import { BadRequestError } from '../../utils/app-error.js';

export class ReportsController {
  getCatalog = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const catalog = reportsService.getCatalog();
      res.status(200).json({
        success: true,
        data: catalog,
      });
    } catch (error) {
      next(error);
    }
  };

  getReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramType = req.params.reportType;
      const queryType = req.query.reportType;
      const reportType = (typeof paramType === 'string' ? paramType : (typeof queryType === 'string' ? queryType : '')) || '';
      if (!reportType) {
        throw new BadRequestError('Report type is required');
      }

      const tenantId = req.effectiveTenantId || req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        throw new BadRequestError('Tenant context required');
      }

      const validatedQuery = reportQuerySchema.parse(req.query);
      const result = await reportsService.runReport(reportType, tenantId, validatedQuery);

      if (validatedQuery.format === 'csv' || req.query.export === 'csv' || req.headers.accept === 'text/csv') {
        const csvContent = reportsService.convertToCsv(result);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${result.filters.startDate}.csv"`);
        res.status(200).send(csvContent);
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Specific Named Handlers for direct routing:
  getSalesSummary = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'sales-summary';
    return this.getReport(req, res, next);
  };

  getProductRevenue = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'product-revenue';
    return this.getReport(req, res, next);
  };

  getServiceRevenue = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'service-revenue';
    return this.getReport(req, res, next);
  };

  getServiceReminder = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'service-reminder';
    return this.getReport(req, res, next);
  };

  getGuestCollection = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'guest-collection';
    return this.getReport(req, res, next);
  };

  getFeedback = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'feedback';
    return this.getReport(req, res, next);
  };

  getStaffRevenue = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'staff-revenue';
    return this.getReport(req, res, next);
  };

  getIncentiveReport = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'incentive-report';
    return this.getReport(req, res, next);
  };

  getMonthlySale = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'monthly-sale';
    return this.getReport(req, res, next);
  };

  getStaffAttendance = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'staff-attendance';
    return this.getReport(req, res, next);
  };

  getMembershipSold = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'membership-sold';
    return this.getReport(req, res, next);
  };

  getMembershipRedemption = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'membership-redemption';
    return this.getReport(req, res, next);
  };

  getInterStoreMembership = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'inter-store-membership';
    return this.getReport(req, res, next);
  };

  getPackagesSold = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'packages-sold';
    return this.getReport(req, res, next);
  };

  getPackageRedemption = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'package-redemption';
    return this.getReport(req, res, next);
  };

  getGiftCardSold = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'gift-card-sold';
    return this.getReport(req, res, next);
  };

  getGiftCardRedemption = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'gift-card-redemption';
    return this.getReport(req, res, next);
  };

  getAdvanceReceived = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'advance-received';
    return this.getReport(req, res, next);
  };

  getBalanceReceived = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'balance-received';
    return this.getReport(req, res, next);
  };

  getCouponRedemption = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'coupon-redemption';
    return this.getReport(req, res, next);
  };

  getLoyaltyPoints = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'loyalty-points';
    return this.getReport(req, res, next);
  };

  getDayWise = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'day-wise';
    return this.getReport(req, res, next);
  };

  getTipReport = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'tip-report';
    return this.getReport(req, res, next);
  };

  getComplimentaryReport = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'complimentary-report';
    return this.getReport(req, res, next);
  };

  getCancelledOrders = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'cancelled-orders';
    return this.getReport(req, res, next);
  };

  getAppointmentReport = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'appointment-report';
    return this.getReport(req, res, next);
  };

  getGstReturns = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'gst-returns';
    return this.getReport(req, res, next);
  };

  getGuestFollowups = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'guest-followups';
    return this.getReport(req, res, next);
  };

  getCashTransactions = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'cash-transactions';
    return this.getReport(req, res, next);
  };

  getFormHistory = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'form-history';
    return this.getReport(req, res, next);
  };

  getDailyStock = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'daily-stock';
    return this.getReport(req, res, next);
  };

  getStockTransaction = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'stock-transaction';
    return this.getReport(req, res, next);
  };

  getMaterialReceived = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'material-received';
    return this.getReport(req, res, next);
  };

  getMinimumStock = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'minimum-stock';
    return this.getReport(req, res, next);
  };

  getReconcileStock = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'reconcile-stock';
    return this.getReport(req, res, next);
  };

  getConsumableTracking = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'consumable-tracking';
    return this.getReport(req, res, next);
  };

  getStockTransfer = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'stock-transfer';
    return this.getReport(req, res, next);
  };

  getTotalConsumed = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'total-consumed';
    return this.getReport(req, res, next);
  };

  getPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'purchase-order';
    return this.getReport(req, res, next);
  };

  getGstOutwards = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'gst-outwards';
    return this.getReport(req, res, next);
  };

  getInventoryTransaction = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'inventory-transaction';
    return this.getReport(req, res, next);
  };

  getPnlReport = async (req: Request, res: Response, next: NextFunction) => {
    req.params.reportType = 'pnl-report';
    return this.getReport(req, res, next);
  };
}

export const reportsController = new ReportsController();
