import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { requireModule } from '../../middleware/authorization.middleware.js';

const router = Router();

// All reports require authentication and module check
router.use(authenticateJwt);
router.use(requireModule('REPORTS'));

// Catalog / Directory of Reports
router.get('/catalog', reportsController.getCatalog);
router.get('/list', reportsController.getCatalog);

// Sales & Revenue Reports (29)
router.get('/sales-summary', reportsController.getSalesSummary);
router.get('/product-revenue', reportsController.getProductRevenue);
router.get('/service-revenue', reportsController.getServiceRevenue);
router.get('/service-reminder', reportsController.getServiceReminder);
router.get('/guest-collection', reportsController.getGuestCollection);
router.get('/feedback', reportsController.getFeedback);
router.get('/staff-revenue', reportsController.getStaffRevenue);
router.get('/incentive-report', reportsController.getIncentiveReport);
router.get('/monthly-sale', reportsController.getMonthlySale);
router.get('/staff-attendance', reportsController.getStaffAttendance);
router.get('/membership-sold', reportsController.getMembershipSold);
router.get('/membership-redemption', reportsController.getMembershipRedemption);
router.get('/inter-store-membership', reportsController.getInterStoreMembership);
router.get('/packages-sold', reportsController.getPackagesSold);
router.get('/package-redemption', reportsController.getPackageRedemption);
router.get('/gift-card-sold', reportsController.getGiftCardSold);
router.get('/gift-card-redemption', reportsController.getGiftCardRedemption);
router.get('/advance-received', reportsController.getAdvanceReceived);
router.get('/balance-received', reportsController.getBalanceReceived);
router.get('/coupon-redemption', reportsController.getCouponRedemption);
router.get('/loyalty-points', reportsController.getLoyaltyPoints);
router.get('/day-wise', reportsController.getDayWise);
router.get('/tip-report', reportsController.getTipReport);
router.get('/complimentary-report', reportsController.getComplimentaryReport);
router.get('/cancelled-orders', reportsController.getCancelledOrders);
router.get('/appointment-report', reportsController.getAppointmentReport);
router.get('/gst-returns', reportsController.getGstReturns);
router.get('/guest-followups', reportsController.getGuestFollowups);
router.get('/cash-transactions', reportsController.getCashTransactions);
router.get('/form-history', reportsController.getFormHistory);

// Inventory & PNL Reports (12)
router.get('/daily-stock', reportsController.getDailyStock);
router.get('/stock-transaction', reportsController.getStockTransaction);
router.get('/material-received', reportsController.getMaterialReceived);
router.get('/minimum-stock', reportsController.getMinimumStock);
router.get('/reconcile-stock', reportsController.getReconcileStock);
router.get('/consumable-tracking', reportsController.getConsumableTracking);
router.get('/stock-transfer', reportsController.getStockTransfer);
router.get('/total-consumed', reportsController.getTotalConsumed);
router.get('/purchase-order', reportsController.getPurchaseOrder);
router.get('/gst-outwards', reportsController.getGstOutwards);
router.get('/inventory-transaction', reportsController.getInventoryTransaction);
router.get('/pnl-report', reportsController.getPnlReport);

// Dynamic Fallback Route for any report by slug
router.get('/:reportType', reportsController.getReport);

export default router;
