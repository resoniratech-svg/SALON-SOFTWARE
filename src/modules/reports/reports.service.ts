import { reportsRepository } from './reports.repository.js';
import { DateRange, ReportQueryParams, resolveDateRange } from './reports.dto.js';
import { BadRequestError } from '../../utils/app-error.js';
import { prisma } from '../../config/database.js';

export interface ReportDefinition {
  id: string;
  name: string;
  category: 'SALES_REVENUE' | 'INVENTORY_PNL';
  description: string;
  filters: string[];
}

export const REPORT_CATALOG: ReportDefinition[] = [
  // Sales / Revenue Reports (29)
  { id: 'sales-summary', name: 'Sales Summary', category: 'SALES_REVENUE', description: 'Overall sales, discounts, taxes, and payment method collections', filters: ['store', 'dates'] },
  { id: 'product-revenue', name: 'Product Revenue', category: 'SALES_REVENUE', description: 'Revenue generated per retail product and sales by staff', filters: ['store', 'staff', 'product', 'group', 'dates'] },
  { id: 'service-revenue', name: 'Service Revenue', category: 'SALES_REVENUE', description: 'Revenue breakdown by service and category', filters: ['store', 'staff', 'category', 'service', 'group', 'dates'] },
  { id: 'service-reminder', name: 'Service Reminder', category: 'SALES_REVENUE', description: 'Due and upcoming service reminders for repeat clients', filters: ['store', 'category', 'service', 'dates'] },
  { id: 'guest-collection', name: 'Guest Collection', category: 'SALES_REVENUE', description: 'Lifetime and period collections per guest', filters: ['store', 'guest', 'dates'] },
  { id: 'feedback', name: 'Feedback', category: 'SALES_REVENUE', description: 'Customer reviews, ratings, and comments per stylist/store', filters: ['store', 'staff', 'dates'] },
  { id: 'staff-revenue', name: 'Staff Revenue', category: 'SALES_REVENUE', description: 'Service and product sales contribution per staff member', filters: ['store', 'staff', 'dates'] },
  { id: 'incentive-report', name: 'Incentive Report', category: 'SALES_REVENUE', description: 'Staff commission and performance incentive calculations', filters: ['store', 'staff', 'dates'] },
  { id: 'monthly-sale', name: 'Monthly Sale', category: 'SALES_REVENUE', description: 'Month-over-month sales trends and totals', filters: ['store', 'dates'] },
  { id: 'staff-attendance', name: 'Staff Attendance', category: 'SALES_REVENUE', description: 'Staff working hours, shifts, and attendance record', filters: ['store', 'staff', 'dates'] },
  { id: 'membership-sold', name: 'Membership Sold', category: 'SALES_REVENUE', description: 'VIP and loyalty memberships sold during period', filters: ['store', 'dates'] },
  { id: 'membership-redemption', name: 'Membership Redemption', category: 'SALES_REVENUE', description: 'Membership discounts and benefit redemptions', filters: ['store', 'dates'] },
  { id: 'inter-store-membership', name: 'Inter-Store Membership', category: 'SALES_REVENUE', description: 'Cross-branch membership usage and settlements', filters: ['store', 'dates'] },
  { id: 'packages-sold', name: 'Packages Sold', category: 'SALES_REVENUE', description: 'Bundled service packages sold to clients', filters: ['store', 'dates'] },
  { id: 'package-redemption', name: 'Package Redemption', category: 'SALES_REVENUE', description: 'Package sessions redeemed and remaining balances', filters: ['store', 'dates'] },
  { id: 'gift-card-sold', name: 'Gift Card Sold Report', category: 'SALES_REVENUE', description: 'Prepaid gift cards issued and revenue collected', filters: ['store', 'dates'] },
  { id: 'gift-card-redemption', name: 'Gift Card Redemption', category: 'SALES_REVENUE', description: 'Gift card redemptions against orders', filters: ['store', 'dates'] },
  { id: 'advance-received', name: 'Advance Received', category: 'SALES_REVENUE', description: 'Advance booking deposits received from guests', filters: ['store', 'dates'] },
  { id: 'balance-received', name: 'Balance Received', category: 'SALES_REVENUE', description: 'Outstanding ledger balances cleared by guests', filters: ['store', 'dates'] },
  { id: 'coupon-redemption', name: 'Coupon Redemption', category: 'SALES_REVENUE', description: 'Promotional discount coupons applied in orders', filters: ['store', 'dates'] },
  { id: 'loyalty-points', name: 'Loyalty Points Report', category: 'SALES_REVENUE', description: 'Loyalty points earned, redeemed, and net balance liabilities', filters: ['store', 'dates'] },
  { id: 'day-wise', name: 'Day Wise Report', category: 'SALES_REVENUE', description: 'Daily breakdown of sales, tax, and tender payments', filters: ['store', 'dates'] },
  { id: 'tip-report', name: 'Tip Report', category: 'SALES_REVENUE', description: 'Gratuity and tips collected per order and staff', filters: ['store', 'staff', 'dates'] },
  { id: 'complimentary-report', name: 'Complimentary Report', category: 'SALES_REVENUE', description: 'Complimentary services or products issued at zero charge', filters: ['store', 'staff', 'dates'] },
  { id: 'cancelled-orders', name: 'Cancelled Orders', category: 'SALES_REVENUE', description: 'Voided and cancelled invoices with reasons', filters: ['store', 'dates'] },
  { id: 'appointment-report', name: 'Appointment Report', category: 'SALES_REVENUE', description: 'Appointment bookings status, source, and scheduling history', filters: ['store', 'staff', 'status', 'dates'] },
  { id: 'gst-returns', name: 'GST Returns Report', category: 'SALES_REVENUE', description: 'GSTR-1 compliant sales invoice tax ledger', filters: ['store', 'dates'] },
  { id: 'guest-followups', name: 'Guest Followups', category: 'SALES_REVENUE', description: 'CRM retention and pending follow-ups for guests', filters: ['store', 'dates'] },
  { id: 'cash-transactions', name: 'Cash Transactions', category: 'SALES_REVENUE', description: 'Cash register drawer inflow and outflow movements', filters: ['store', 'dates'] },
  { id: 'form-history', name: 'Form History', category: 'SALES_REVENUE', description: 'Consultation and custom form intake histories', filters: ['store', 'dates'] },

  // Inventory / PNL Reports (12)
  { id: 'daily-stock', name: 'Daily Stock', category: 'INVENTORY_PNL', description: 'Current product stock balance and inventory valuation', filters: ['store', 'dates'] },
  { id: 'stock-transaction', name: 'Stock Transaction', category: 'INVENTORY_PNL', description: 'Inward, outward, and transfer movements audit ledger', filters: ['store', 'type', 'dates'] },
  { id: 'material-received', name: 'Material Received', category: 'INVENTORY_PNL', description: 'Goods received notes (GRN) from vendor purchase orders', filters: ['store', 'dates'] },
  { id: 'minimum-stock', name: 'Minimum Stock', category: 'INVENTORY_PNL', description: 'Low stock alerts and items requiring re-order', filters: ['store'] },
  { id: 'reconcile-stock', name: 'Reconcile Stock', category: 'INVENTORY_PNL', description: 'Physical audit count adjustments and discrepancies', filters: ['store', 'dates'] },
  { id: 'consumable-tracking', name: 'Consumable Tracking', category: 'INVENTORY_PNL', description: 'Backbar consumables and disposables consumed in treatments', filters: ['store', 'dates'] },
  { id: 'stock-transfer', name: 'Stock Transfer', category: 'INVENTORY_PNL', description: 'Stock transferred between branches or stores', filters: ['store', 'dates'] },
  { id: 'total-consumed', name: 'Total Consumed', category: 'INVENTORY_PNL', description: 'Aggregated product and material consumption', filters: ['store', 'dates'] },
  { id: 'purchase-order', name: 'Purchase Order Report', category: 'INVENTORY_PNL', description: 'Purchase orders issued and delivery statuses', filters: ['store', 'dates'] },
  { id: 'gst-outwards', name: 'GST Outwards Report', category: 'INVENTORY_PNL', description: 'Tax breakdown on outward supplies by tax rate slab', filters: ['store', 'dates'] },
  { id: 'inventory-transaction', name: 'Inventory Transaction Report', category: 'INVENTORY_PNL', description: 'High-level inward vs outward inventory values summary', filters: ['store', 'dates'] },
  { id: 'pnl-report', name: 'PNL Report', category: 'INVENTORY_PNL', description: 'Salon Profit & Loss statement: Revenue, COGS, and Expenses', filters: ['store', 'dates'] },
];

export class ReportsService {
  getCatalog() {
    return {
      totalReports: REPORT_CATALOG.length,
      categories: {
        SALES_REVENUE: REPORT_CATALOG.filter((r) => r.category === 'SALES_REVENUE'),
        INVENTORY_PNL: REPORT_CATALOG.filter((r) => r.category === 'INVENTORY_PNL'),
      },
      reports: REPORT_CATALOG,
    };
  }

  async runReport(reportType: string, tenantId: string, query: ReportQueryParams) {
    const normalizedType = reportType.toLowerCase().trim();
    const range = resolveDateRange(query);

    const definition = REPORT_CATALOG.find((r) => r.id === normalizedType);
    if (!definition) {
      throw new BadRequestError(`Unknown report type: '${reportType}'. Total supported: ${REPORT_CATALOG.length}`);
    }

    let reportData: any;

    switch (normalizedType) {
      case 'sales-summary':
        reportData = await reportsRepository.getSalesSummary(tenantId, range, query);
        break;
      case 'product-revenue':
        reportData = await reportsRepository.getProductRevenue(tenantId, range, query);
        break;
      case 'service-revenue':
        reportData = await reportsRepository.getServiceRevenue(tenantId, range, query);
        break;
      case 'service-reminder':
        reportData = await reportsRepository.getServiceReminder(tenantId, range, query);
        break;
      case 'guest-collection':
        reportData = await reportsRepository.getGuestCollection(tenantId, range, query);
        break;
      case 'feedback':
        reportData = await reportsRepository.getFeedback(tenantId, range, query);
        break;
      case 'staff-revenue':
        reportData = await reportsRepository.getStaffRevenue(tenantId, range, query);
        break;
      case 'incentive-report':
        reportData = await reportsRepository.getIncentiveReport(tenantId, range, query);
        break;
      case 'monthly-sale':
        reportData = await reportsRepository.getMonthlySale(tenantId, range, query);
        break;
      case 'staff-attendance':
        reportData = await reportsRepository.getStaffAttendance(tenantId, range, query);
        break;
      case 'membership-sold':
        reportData = await reportsRepository.getMembershipSold(tenantId, range, query);
        break;
      case 'membership-redemption':
        reportData = await reportsRepository.getMembershipRedemption(tenantId, range, query);
        break;
      case 'inter-store-membership':
        reportData = await reportsRepository.getInterStoreMembership(tenantId, range, query);
        break;
      case 'packages-sold':
        reportData = await reportsRepository.getPackagesSold(tenantId, range, query);
        break;
      case 'package-redemption':
        reportData = await reportsRepository.getPackageRedemption(tenantId, range, query);
        break;
      case 'gift-card-sold':
        reportData = await reportsRepository.getGiftCardSold(tenantId, range, query);
        break;
      case 'gift-card-redemption':
        reportData = await reportsRepository.getGiftCardRedemption(tenantId, range, query);
        break;
      case 'advance-received':
        reportData = await reportsRepository.getAdvanceReceived(tenantId, range, query);
        break;
      case 'balance-received':
        reportData = await reportsRepository.getBalanceReceived(tenantId, range, query);
        break;
      case 'coupon-redemption':
        reportData = await reportsRepository.getCouponRedemption(tenantId, range, query);
        break;
      case 'loyalty-points':
        reportData = await reportsRepository.getLoyaltyPoints(tenantId, range, query);
        break;
      case 'day-wise':
        reportData = await reportsRepository.getDayWiseReport(tenantId, range, query);
        break;
      case 'tip-report':
        reportData = await reportsRepository.getTipReport(tenantId, range, query);
        break;
      case 'complimentary-report':
        reportData = await reportsRepository.getComplimentaryReport(tenantId, range, query);
        break;
      case 'cancelled-orders':
        reportData = await reportsRepository.getCancelledOrders(tenantId, range, query);
        break;
      case 'appointment-report':
        reportData = await reportsRepository.getAppointmentReport(tenantId, range, query);
        break;
      case 'gst-returns':
        reportData = await reportsRepository.getGstReturns(tenantId, range, query);
        break;
      case 'guest-followups':
        reportData = await reportsRepository.getGuestFollowups(tenantId, range, query);
        break;
      case 'cash-transactions':
        reportData = await reportsRepository.getCashTransactions(tenantId, range, query);
        break;
      case 'form-history':
        reportData = await reportsRepository.getFormHistory(tenantId, range, query);
        break;
      case 'daily-stock':
        reportData = await reportsRepository.getDailyStock(tenantId, range, query);
        break;
      case 'stock-transaction':
        reportData = await reportsRepository.getStockTransaction(tenantId, range, query);
        break;
      case 'material-received':
        reportData = await reportsRepository.getMaterialReceived(tenantId, range, query);
        break;
      case 'minimum-stock':
        reportData = await reportsRepository.getMinimumStock(tenantId, range, query);
        break;
      case 'reconcile-stock':
        reportData = await reportsRepository.getReconcileStock(tenantId, range, query);
        break;
      case 'consumable-tracking':
        reportData = await reportsRepository.getConsumableTracking(tenantId, range, query);
        break;
      case 'stock-transfer':
        reportData = await reportsRepository.getStockTransfer(tenantId, range, query);
        break;
      case 'total-consumed':
        reportData = await reportsRepository.getTotalConsumed(tenantId, range, query);
        break;
      case 'purchase-order':
        reportData = await reportsRepository.getPurchaseOrder(tenantId, range, query);
        break;
      case 'gst-outwards':
        reportData = await reportsRepository.getGstOutwards(tenantId, range, query);
        break;
      case 'inventory-transaction':
        reportData = await reportsRepository.getInventoryTransaction(tenantId, range, query);
        break;
      case 'pnl-report':
        reportData = await reportsRepository.getPnlReport(tenantId, range, query);
        break;
      default:
        throw new BadRequestError(`Unhandled report type: ${reportType}`);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, code: true },
    });

    return {
      reportType: definition.id,
      title: definition.name,
      category: definition.category,
      company: {
        id: tenant?.id || tenantId,
        name: tenant?.name?.trim() ? tenant.name : (tenant?.code || 'Salon'),
        code: tenant?.code || null,
      },
      filters: {
        store: query.store || 'All Stores Selected',
        preset: range.preset || 'custom',
        startDate: range.startDateStr,
        endDate: range.endDateStr,
      },
      totals: reportData.totals || {},
      rows: reportData.rows || [],
      totalRows: reportData.totalRows || 0,
      page: query.page,
      limit: query.limit,
      ...(reportData.revenueBreakdown && { revenueBreakdown: reportData.revenueBreakdown }),
      ...(reportData.cogsBreakdown && { cogsBreakdown: reportData.cogsBreakdown }),
      ...(reportData.expenseBreakdown && { expenseBreakdown: reportData.expenseBreakdown }),
      ...(reportData.topLoyaltyGuests && { topLoyaltyGuests: reportData.topLoyaltyGuests }),
    };
  }

  convertToCsv(reportResult: any): string {
    const rows = reportResult.rows || [];
    const companyName = reportResult.company?.name;
    if (rows.length === 0) {
      return `${companyName ? `Company: ${companyName}\n` : ''}No data available for ${reportResult.title}\n`;
    }

    const headers = Object.keys(rows[0]);
    const csvLines: string[] = [];
    if (companyName) {
      csvLines.push(`"Company:","${companyName}"`);
      csvLines.push(`"Report:","${reportResult.title}"`);
      csvLines.push('');
    }
    csvLines.push(headers.join(','));

    for (const row of rows) {
      const line = headers.map((h) => {
        let val = row[h];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvLines.push(line.join(','));
    }

    // Add totals summary at bottom if available
    if (reportResult.totals && Object.keys(reportResult.totals).length > 0) {
      csvLines.push('');
      csvLines.push('--- TOTALS & SUMMARY ---');
      for (const [k, v] of Object.entries(reportResult.totals)) {
        if (typeof v !== 'object') {
          csvLines.push(`"${k}","${v}"`);
        }
      }
    }

    return csvLines.join('\n');
  }
}

export const reportsService = new ReportsService();
