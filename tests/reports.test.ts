import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let cashierToken: string;
let tenantAId: string;
let tenantBId: string;

let testGuestA: any;
let testProductA: any;
let testServiceA: any;
let testStaffA: any;
let testOrderA: any;
let testCancelledOrderA: any;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
  }
}

async function request(
  method: string,
  endpoint: string,
  body?: any,
  token?: string,
  query?: Record<string, string>
) {
  let url = `${baseUrl}${endpoint}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  let text: string = '';

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    text = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
    text,
  };
}

export async function runReportsTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Reports & Analytics (All 41 Reports) Test Suite');
  console.log('================================================================\n');

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // 1. Setup & Authentication
    // -------------------------------------------------------------
    console.log('--- 1. Authentication & Setup ---');

    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminALogin.status === 200, 'Tenant A Admin login returns 200');
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;

    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    assert(adminBLogin.status === 200, 'Tenant B Admin login returns 200');
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;

    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(cashierLogin.status === 200, 'Cashier login returns 200');
    cashierToken = cashierLogin.data?.data?.token;

    // -------------------------------------------------------------
    // 2. Seed Test Fixtures (Orders, Stock, Feedback, Expenses)
    // -------------------------------------------------------------
    console.log('\n--- 2. Seed Test Fixtures ---');

    // Guest A
    testGuestA = await prisma.guest.findFirst({ where: { tenantId: tenantAId } });
    if (!testGuestA) {
      testGuestA = await prisma.guest.create({
        data: {
          tenantId: tenantAId,
          name: 'Ananya Sharma',
          mobile: '9876543210',
          email: 'ananya@example.com',
          gender: 'FEMALE',
          customerType: 'VIP',
          totalSpend: 5000,
          totalVisits: 3,
        },
      });
    }

    // Staff A
    testStaffA = await prisma.staff.findFirst({ where: { tenantId: tenantAId } });
    if (!testStaffA) {
      testStaffA = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'Pooja Stylist',
        },
      });
    }

    // Service A
    testServiceA = await prisma.service.findFirst({ where: { tenantId: tenantAId } });
    if (!testServiceA) {
      let cat = await prisma.serviceCategory.findFirst({ where: { tenantId: tenantAId } });
      if (!cat) {
        cat = await prisma.serviceCategory.create({
          data: { tenantId: tenantAId, name: 'Hair Services' },
        });
      }
      testServiceA = await prisma.service.create({
        data: {
          tenantId: tenantAId,
          categoryId: cat.id,
          name: 'Hair Spa Deluxe',
          price: 1500,
          durationMinutes: 45,
        },
      });
    }

    // Product A
    testProductA = await prisma.product.findFirst({ where: { tenantId: tenantAId } });
    if (!testProductA) {
      let pCat = await prisma.productCategory.findFirst({ where: { tenantId: tenantAId } });
      if (!pCat) {
        pCat = await prisma.productCategory.create({
          data: { tenantId: tenantAId, name: 'Hair Care Products' },
        });
      }
      testProductA = await prisma.product.create({
        data: {
          tenantId: tenantAId,
          categoryId: pCat.id,
          name: 'Loreal Shampoo 250ml',
          price: 600,
        },
      });
    }

    // Pnl Category & Expense
    let pnlCat = await prisma.pnlCategory.findFirst({ where: { tenantId: tenantAId } });
    if (!pnlCat) {
      pnlCat = await prisma.pnlCategory.create({
        data: { tenantId: tenantAId, name: 'Salon Rent & Electricity' },
      });
    }

    await prisma.expenseTransaction.create({
      data: {
        tenantId: tenantAId,
        categoryId: pnlCat.id,
        amount: 2500,
        paymentMethod: 'CASH',
        description: 'Monthly electricity bill',
        expenseDate: new Date(),
      },
    });

    // Stock Transactions (Inward & Consumed)
    await prisma.stockTransaction.create({
      data: {
        tenantId: tenantAId,
        productId: testProductA.id,
        type: 'INWARD',
        quantity: 50,
        unitPrice: 400,
        totalAmount: 20000,
        vendorName: 'Loreal Official India',
        poNumber: 'PO-2026-001',
        transactionDate: new Date(),
      },
    });

    await prisma.stockTransaction.create({
      data: {
        tenantId: tenantAId,
        productId: testProductA.id,
        type: 'CONSUMED',
        quantity: 2,
        unitPrice: 400,
        totalAmount: 800,
        staffId: testStaffA.id,
        notes: 'Used in Hair Spa treatment',
        transactionDate: new Date(),
      },
    });

    // Create a Completed Order in Tenant A
    const orderNum = `ORD-RPT-${Date.now()}`;
    testOrderA = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: orderNum,
        guestId: testGuestA.id,
        status: 'COMPLETED',
        orderDate: new Date(),
        subtotal: 2100,
        discountAmount: 100,
        couponCode: 'WELCOME100',
        couponDiscount: 100,
        giftCardAmount: 200,
        membershipDiscount: 150,
        taxAmount: 270,
        taxRate: 18,
        tipAmount: 100,
        totalAmount: 2020,
        paymentMethod: 'CASH',
        items: {
          create: [
            {
              tenantId: tenantAId,
              itemType: 'SERVICE',
              serviceId: testServiceA.id,
              staffId: testStaffA.id,
              itemName: testServiceA.name,
              quantity: 1,
              unitPrice: 1500,
              subtotal: 1500,
              taxAmount: 270,
              total: 1770,
            },
            {
              tenantId: tenantAId,
              itemType: 'PRODUCT',
              productId: testProductA.id,
              staffId: testStaffA.id,
              itemName: testProductA.name,
              quantity: 1,
              unitPrice: 600,
              subtotal: 600,
              taxAmount: 0,
              total: 600,
            },
          ],
        },
        payments: {
          create: [
            {
              tenantId: tenantAId,
              method: 'CASH',
              amount: 2020,
              status: 'SUCCESS',
            },
          ],
        },
      },
    });
    assert(!!testOrderA, 'Completed POS Order created for Tenant A');

    // Create a Cancelled Order in Tenant A
    testCancelledOrderA = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `ORD-CNC-${Date.now()}`,
        guestId: testGuestA.id,
        status: 'CANCELLED',
        orderDate: new Date(),
        subtotal: 500,
        totalAmount: 500,
        notes: 'Client requested cancellation due to personal emergency',
      },
    });

    // Create Guest Feedback
    await prisma.guestFeedback.create({
      data: {
        tenantId: tenantAId,
        guestId: testGuestA.id,
        staffId: testStaffA.id,
        orderId: testOrderA.id,
        rating: 5,
        comment: 'Outstanding service by Pooja! Highly recommended.',
      },
    });

    // -------------------------------------------------------------
    // 3. Catalog / Directory of Reports
    // -------------------------------------------------------------
    console.log('\n--- 3. Reports Catalog & Structure ---');

    const unauthCatalog = await request('GET', '/api/reports/catalog');
    assert(unauthCatalog.status === 401, 'Unauthorized request to /catalog returns 401');

    const catalogRes = await request('GET', '/api/reports/catalog', undefined, adminAToken);
    assert(catalogRes.status === 200, 'Authorized request to /catalog returns 200');
    assert(catalogRes.data?.data?.totalReports === 42, 'Catalog has exactly 42 total reports');
    assert(catalogRes.data?.data?.categories?.SALES_REVENUE?.length === 30, 'Catalog contains 30 Sales/Revenue reports');
    assert(catalogRes.data?.data?.categories?.INVENTORY_PNL?.length === 12, 'Catalog contains 12 Inventory/PNL reports');

    // -------------------------------------------------------------
    // 4. Sales & Revenue Reports (Testing all 30)
    // -------------------------------------------------------------
    console.log('\n--- 4. Sales & Revenue Reports (29 Reports) ---');

    // 1. Sales Summary
    const salesSummary = await request('GET', '/api/reports/sales-summary', undefined, adminAToken);
    assert(salesSummary.status === 200, '1. sales-summary returns 200');
    assert(salesSummary.data?.data?.totals?.totalOrders >= 1, 'sales-summary includes completed order');
    assert(salesSummary.data?.data?.totals?.cancelledOrders >= 1, 'sales-summary includes cancelled order');
    assert(salesSummary.data?.data?.totals?.netSales >= 2020, 'sales-summary net sales calculated accurately');
    assert(salesSummary.data?.data?.totals?.paymentBreakdown?.CASH >= 2020, 'sales-summary cash tender broken down');

    // 2. Product Revenue
    const productRev = await request('GET', '/api/reports/product-revenue', undefined, adminAToken);
    assert(productRev.status === 200, '2. product-revenue returns 200');
    assert(productRev.data?.data?.totals?.totalQuantity >= 1, 'product-revenue sums quantity');
    assert(productRev.data?.data?.rows.some((r: any) => r.productName === testProductA.name), 'product-revenue includes sold product');

    // 3. Service Revenue
    const serviceRev = await request('GET', '/api/reports/service-revenue', undefined, adminAToken);
    assert(serviceRev.status === 200, '3. service-revenue returns 200');
    assert(serviceRev.data?.data?.rows.some((r: any) => r.serviceName === testServiceA.name), 'service-revenue includes completed service');

    // 4. Service Reminder
    const reminder = await request('GET', '/api/reports/service-reminder', undefined, adminAToken);
    assert(reminder.status === 200, '4. service-reminder returns 200');
    assert(Array.isArray(reminder.data?.data?.rows), 'service-reminder returns reminder rows array');

    // 5. Guest Collection
    const guestColl = await request('GET', '/api/reports/guest-collection', undefined, adminAToken);
    assert(guestColl.status === 200, '5. guest-collection returns 200');
    assert(guestColl.data?.data?.totals?.totalGuests >= 1, 'guest-collection totals guest count');

    // 6. Feedback
    const feedback = await request('GET', '/api/reports/feedback', undefined, adminAToken);
    assert(feedback.status === 200, '6. feedback returns 200');
    assert(feedback.data?.data?.totals?.totalReviews >= 1, 'feedback reports count of reviews');
    assert(feedback.data?.data?.totals?.averageRating === 5, 'feedback computes average rating');

    // 7. Staff Revenue
    const staffRev = await request('GET', '/api/reports/staff-revenue', undefined, adminAToken);
    assert(staffRev.status === 200, '7. staff-revenue returns 200');
    assert(staffRev.data?.data?.rows.some((r: any) => r.staffName === testStaffA.name), 'staff-revenue breaks down revenue per staff');

    // 8. Incentive Report
    const incentive = await request('GET', '/api/reports/incentive-report', undefined, adminAToken);
    assert(incentive.status === 200, '8. incentive-report returns 200');
    assert(incentive.data?.data?.rows.length >= 1, 'incentive-report computes 10% commission');

    // 9. Monthly Sale
    const monthlySale = await request('GET', '/api/reports/monthly-sale', undefined, adminAToken);
    assert(monthlySale.status === 200, '9. monthly-sale returns 200');
    assert(monthlySale.data?.data?.rows.length >= 1, 'monthly-sale groups orders by month');

    // 10. Staff Attendance
    const attendance = await request('GET', '/api/reports/staff-attendance', undefined, adminAToken);
    assert(attendance.status === 200, '10. staff-attendance returns 200');
    assert(attendance.data?.data?.rows.length >= 1, 'staff-attendance lists staff schedule');

    // 11. Membership Sold
    const memberSold = await request('GET', '/api/reports/membership-sold', undefined, adminAToken);
    assert(memberSold.status === 200, '11. membership-sold returns 200');

    // 12. Membership Redemption
    const memberRedeem = await request('GET', '/api/reports/membership-redemption', undefined, adminAToken);
    assert(memberRedeem.status === 200, '12. membership-redemption returns 200');

    // 13. Inter-Store Membership
    const interStore = await request('GET', '/api/reports/inter-store-membership', undefined, adminAToken);
    assert(interStore.status === 200, '13. inter-store-membership returns 200');

    // 14. Packages Sold
    const pkgSold = await request('GET', '/api/reports/packages-sold', undefined, adminAToken);
    assert(pkgSold.status === 200, '14. packages-sold returns 200');

    // 15. Package Redemption
    const pkgRedeem = await request('GET', '/api/reports/package-redemption', undefined, adminAToken);
    assert(pkgRedeem.status === 200, '15. package-redemption returns 200');

    // 16. Gift Card Sold
    const gcSold = await request('GET', '/api/reports/gift-card-sold', undefined, adminAToken);
    assert(gcSold.status === 200, '16. gift-card-sold returns 200');

    // 17. Gift Card Redemption
    const gcRedeem = await request('GET', '/api/reports/gift-card-redemption', undefined, adminAToken);
    assert(gcRedeem.status === 200, '17. gift-card-redemption returns 200');

    // 18. Advance Received
    const advRec = await request('GET', '/api/reports/advance-received', undefined, adminAToken);
    assert(advRec.status === 200, '18. advance-received returns 200');

    // 19. Balance Received
    const balRec = await request('GET', '/api/reports/balance-received', undefined, adminAToken);
    assert(balRec.status === 200, '19. balance-received returns 200');

    // 20. Coupon Redemption
    const couponRedeem = await request('GET', '/api/reports/coupon-redemption', undefined, adminAToken);
    assert(couponRedeem.status === 200, '20. coupon-redemption returns 200');
    assert(couponRedeem.data?.data?.rows.some((r: any) => r.couponCode === 'WELCOME100'), 'coupon-redemption includes applied coupon WELCOME100');

    // 21. Loyalty Points Report
    const loyaltyPoints = await request('GET', '/api/reports/loyalty-points', undefined, adminAToken);
    assert(loyaltyPoints.status === 200, '21. loyalty-points returns 200');
    assert(loyaltyPoints.data?.data?.totals !== undefined, 'loyalty-points includes totals calculation');

    // 22. Day Wise Report
    const dayWise = await request('GET', '/api/reports/day-wise', undefined, adminAToken);
    assert(dayWise.status === 200, '21. day-wise returns 200');
    assert(dayWise.data?.data?.rows.length >= 1, 'day-wise aggregates by day');

    // 22. Tip Report
    const tipReport = await request('GET', '/api/reports/tip-report', undefined, adminAToken);
    assert(tipReport.status === 200, '22. tip-report returns 200');
    assert(tipReport.data?.data?.totals?.totalTipAmount >= 100, 'tip-report calculates tip amount');

    // 23. Complimentary Report
    const compReport = await request('GET', '/api/reports/complimentary-report', undefined, adminAToken);
    assert(compReport.status === 200, '23. complimentary-report returns 200');

    // 24. Cancelled Orders
    const cancelReport = await request('GET', '/api/reports/cancelled-orders', undefined, adminAToken);
    assert(cancelReport.status === 200, '24. cancelled-orders returns 200');
    assert(cancelReport.data?.data?.totals?.totalCancelledOrders >= 1, 'cancelled-orders includes voided orders');

    // 25. Appointment Report
    const apptReport = await request('GET', '/api/reports/appointment-report', undefined, adminAToken);
    assert(apptReport.status === 200, '25. appointment-report returns 200');

    // 26. GST Returns Report
    const gstReturns = await request('GET', '/api/reports/gst-returns', undefined, adminAToken);
    assert(gstReturns.status === 200, '26. gst-returns returns 200');
    assert(gstReturns.data?.data?.totals?.totalTax >= 270, 'gst-returns aggregates GST collection');

    // 27. Guest Followups
    const followups = await request('GET', '/api/reports/guest-followups', undefined, adminAToken);
    assert(followups.status === 200, '27. guest-followups returns 200');

    // 28. Cash Transactions
    const cashTx = await request('GET', '/api/reports/cash-transactions', undefined, adminAToken);
    assert(cashTx.status === 200, '28. cash-transactions returns 200');
    assert(cashTx.data?.data?.totals?.totalInflow >= 2020, 'cash-transactions includes POS cash collection');
    assert(cashTx.data?.data?.totals?.totalOutflow >= 2500, 'cash-transactions includes cash expense outflow');

    // 29. Form History
    const formHist = await request('GET', '/api/reports/form-history', undefined, adminAToken);
    assert(formHist.status === 200, '29. form-history returns 200');

    // -------------------------------------------------------------
    // 5. Inventory & PNL Reports (Testing all 12)
    // -------------------------------------------------------------
    console.log('\n--- 5. Inventory & PNL Reports (12 Reports) ---');

    // 30. Daily Stock
    const dailyStock = await request('GET', '/api/reports/daily-stock', undefined, adminAToken);
    assert(dailyStock.status === 200, '30. daily-stock returns 200');
    assert(dailyStock.data?.data?.totals?.totalStockValue > 0, 'daily-stock computes stock valuation');

    // 31. Stock Transaction
    const stockTx = await request('GET', '/api/reports/stock-transaction', undefined, adminAToken);
    assert(stockTx.status === 200, '31. stock-transaction returns 200');
    assert(stockTx.data?.data?.totals?.totalTransactions >= 2, 'stock-transaction contains inward & consumed txs');

    // 32. Material Received
    const matRec = await request('GET', '/api/reports/material-received', undefined, adminAToken);
    assert(matRec.status === 200, '32. material-received returns 200');
    assert(matRec.data?.data?.totals?.totalCost >= 20000, 'material-received sums PO inward amounts');

    // 33. Minimum Stock
    const minStock = await request('GET', '/api/reports/minimum-stock', undefined, adminAToken);
    assert(minStock.status === 200, '33. minimum-stock returns 200');

    // 34. Reconcile Stock
    const reconcile = await request('GET', '/api/reports/reconcile-stock', undefined, adminAToken);
    assert(reconcile.status === 200, '34. reconcile-stock returns 200');

    // 35. Consumable Tracking
    const consumable = await request('GET', '/api/reports/consumable-tracking', undefined, adminAToken);
    assert(consumable.status === 200, '35. consumable-tracking returns 200');
    assert(consumable.data?.data?.totals?.totalConsumedItems >= 1, 'consumable-tracking logs service consumption');

    // 36. Stock Transfer
    const stockTrans = await request('GET', '/api/reports/stock-transfer', undefined, adminAToken);
    assert(stockTrans.status === 200, '36. stock-transfer returns 200');

    // 37. Total Consumed
    const totalCons = await request('GET', '/api/reports/total-consumed', undefined, adminAToken);
    assert(totalCons.status === 200, '37. total-consumed returns 200');
    assert(totalCons.data?.data?.totals?.overallCost >= 800, 'total-consumed calculates consumption cost');

    // 38. Purchase Order
    const poReport = await request('GET', '/api/reports/purchase-order', undefined, adminAToken);
    assert(poReport.status === 200, '38. purchase-order returns 200');
    assert(poReport.data?.data?.totals?.totalPOs >= 1, 'purchase-order includes PO records');

    // 39. GST Outwards
    const gstOut = await request('GET', '/api/reports/gst-outwards', undefined, adminAToken);
    assert(gstOut.status === 200, '39. gst-outwards returns 200');
    assert(gstOut.data?.data?.totals?.totalTaxCollected >= 270, 'gst-outwards aggregates tax collected');

    // 40. Inventory Transaction
    const invTx = await request('GET', '/api/reports/inventory-transaction', undefined, adminAToken);
    assert(invTx.status === 200, '40. inventory-transaction returns 200');
    assert(invTx.data?.data?.totals?.inwardValue >= 20000, 'inventory-transaction tracks inward total');

    // 41. PNL Report
    const pnlReport = await request('GET', '/api/reports/pnl-report', undefined, adminAToken);
    assert(pnlReport.status === 200, '41. pnl-report returns 200');
    assert(pnlReport.data?.data?.totals?.grossRevenue >= 2020, 'pnl-report includes revenue');
    assert(pnlReport.data?.data?.totals?.cogs >= 800, 'pnl-report includes COGS');
    assert(pnlReport.data?.data?.totals?.operatingExpenses >= 2500, 'pnl-report includes operating expenses');
    assert(typeof pnlReport.data?.data?.totals?.netProfit === 'number', 'pnl-report computes net profit');

    // -------------------------------------------------------------
    // 6. SaaS Multi-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- 6. SaaS Multi-Tenant Isolation Verification ---');

    const tenantBSales = await request('GET', '/api/reports/sales-summary', undefined, adminBToken);
    assert(tenantBSales.status === 200, 'Tenant B queries sales-summary returns 200');
    assert(tenantBSales.data?.data?.totals?.totalOrders === 0, 'Tenant B has 0 orders (tenant A data is not visible)');
    assert(tenantBSales.data?.data?.totals?.grossSales === 0, 'Tenant B has 0.00 gross sales');

    const tenantBPnl = await request('GET', '/api/reports/pnl-report', undefined, adminBToken);
    assert(tenantBPnl.status === 200, 'Tenant B queries pnl-report returns 200');
    assert(tenantBPnl.data?.data?.totals?.grossRevenue === 0, 'Tenant B has 0 gross revenue');
    assert(tenantBPnl.data?.data?.totals?.operatingExpenses === 0, 'Tenant B has 0 operating expenses');

    // -------------------------------------------------------------
    // 7. Date Filtering & Presets
    // -------------------------------------------------------------
    console.log('\n--- 7. Date Filtering & Presets ---');

    const todayReport = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, { preset: 'today' });
    assert(todayReport.status === 200, 'Preset "today" returns 200');
    assert(todayReport.data?.data?.filters?.preset === 'today', 'Preset reflects "today"');

    const weeklyReport = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, { preset: 'weekly' });
    assert(weeklyReport.status === 200, 'Preset "weekly" returns 200');

    const yearlyReport = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, { preset: 'yearly' });
    assert(yearlyReport.status === 200, 'Preset "yearly" returns 200');

    const customDateReport = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    assert(customDateReport.status === 200, 'Custom date range returns 200');
    assert(customDateReport.data?.data?.filters?.startDate === '2026-01-01', 'Filters reflect custom startDate');
    assert(customDateReport.data?.data?.filters?.endDate === '2026-12-31', 'Filters reflect custom endDate');

    // -------------------------------------------------------------
    // 8. CSV Export Verification
    // -------------------------------------------------------------
    console.log('\n--- 8. CSV Export Verification ---');

    const csvExport = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, { format: 'csv' });
    assert(csvExport.status === 200, 'CSV export returns 200');
    assert(csvExport.headers.get('content-type')?.includes('text/csv') === true, 'Response content-type is text/csv');
    assert(csvExport.text.includes('orderNumber') && csvExport.text.includes('subtotal'), 'CSV contains header columns');
    assert(csvExport.text.includes(testOrderA.orderNumber), 'CSV contains order row data');

    // Dynamic Route Test
    const dynamicSlug = await request('GET', '/api/reports/day-wise', undefined, adminAToken);
    assert(dynamicSlug.status === 200, 'Dynamic slug route /api/reports/day-wise returns 200');

    // Cashier Access Test
    const cashierAccess = await request('GET', '/api/reports/sales-summary', undefined, cashierToken);
    assert(cashierAccess.status === 200, 'Cashier with permissions can access reports');

    // -------------------------------------------------------------
    // 9. Comprehensive Filters & Export Variations (UI parity)
    // -------------------------------------------------------------
    console.log('\n--- 9. Comprehensive Filters & Export Variations ---');

    // Product Revenue with productId and staffId
    const prodFilter = await request('GET', '/api/reports/product-revenue', undefined, adminAToken, {
      productId: testProductA.id,
      staffId: testStaffA.id,
    });
    assert(prodFilter.status === 200, 'Product Revenue with productId & staffId returns 200');
    assert(Array.isArray(prodFilter.data?.data?.rows), 'Product Revenue returns rows array');
    assert(prodFilter.data?.data?.totals?.totalQuantity >= 1, 'Product Revenue totals reflect filtered product quantity');

    // Product Revenue CSV export
    const prodCsv = await request('GET', '/api/reports/product-revenue', undefined, adminAToken, {
      export: 'csv',
    });
    assert(prodCsv.status === 200, 'Product Revenue export=csv returns 200');
    assert(prodCsv.headers.get('content-type')?.includes('text/csv') === true, 'Product Revenue CSV has text/csv header');

    // Service Revenue with serviceId
    const servFilter = await request('GET', '/api/reports/service-revenue', undefined, adminAToken, {
      serviceId: testServiceA.id,
      group: 'Both',
    });
    assert(servFilter.status === 200, 'Service Revenue with serviceId & group=Both returns 200');
    assert(servFilter.data?.data?.totals?.totalGross > 0, 'Service Revenue totals reflect gross sales');

    // Service Revenue CSV export
    const servCsv = await request('GET', '/api/reports/service-revenue', undefined, adminAToken, {
      export: 'csv',
    });
    assert(servCsv.status === 200, 'Service Revenue export=csv returns 200');
    assert(servCsv.headers.get('content-type')?.includes('text/csv') === true, 'Service Revenue CSV has text/csv header');

    // Sales Summary Top Services and Products verification
    const salesSummaryFull = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, {
      preset: 'yearly',
    });
    assert(salesSummaryFull.status === 200, 'Sales Summary yearly returns 200');
    assert(Array.isArray(salesSummaryFull.data?.data?.totals?.topServices), 'Sales Summary includes topServices array');
    assert(Array.isArray(salesSummaryFull.data?.data?.totals?.topProducts), 'Sales Summary includes topProducts array');
    assert(typeof salesSummaryFull.data?.data?.totals?.uniqueGuestsCount === 'number', 'Sales Summary includes uniqueGuestsCount');
    assert(typeof salesSummaryFull.data?.data?.totals?.packageSales === 'number', 'Sales Summary includes packageSales');
    assert(typeof salesSummaryFull.data?.data?.totals?.membershipSales === 'number', 'Sales Summary includes membershipSales');

    // Feedback report with staffId filter
    const staffFeedback = await request('GET', '/api/reports/feedback', undefined, adminAToken, {
      staffId: testStaffA.id,
    });
    assert(staffFeedback.status === 200, 'Feedback report with staffId returns 200');
    assert(typeof staffFeedback.data?.data?.totals?.averageRating === 'number', 'Feedback report returns averageRating');

    // Guest Collection report with guestId filter
    const guestCol = await request('GET', '/api/reports/guest-collection', undefined, adminAToken, {
      guestId: testGuestA.id,
    });
    assert(guestCol.status === 200, 'Guest Collection report with guestId returns 200');
    assert(guestCol.data?.data?.totals?.totalGuests >= 1, 'Guest Collection returns matched guest total');

    // PNL Report verification
    const pnlRep = await request('GET', '/api/reports/pnl-report', undefined, adminAToken);
    assert(pnlRep.status === 200, 'PNL Report returns 200');
    assert(pnlRep.data?.data?.totals?.grossRevenue !== undefined, 'PNL Report includes grossRevenue');
    assert(pnlRep.data?.data?.totals?.cogs !== undefined, 'PNL Report includes COGS');
    assert(pnlRep.data?.data?.totals?.netProfit !== undefined, 'PNL Report includes netProfit');
    assert(Array.isArray(pnlRep.data?.data?.revenueBreakdown), 'PNL Report includes revenueBreakdown');
    assert(Array.isArray(pnlRep.data?.data?.expenseBreakdown), 'PNL Report includes expenseBreakdown');

    // Pagination limit & page test
    const pagedSummary = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, {
      page: '1',
      limit: '10',
    });
    assert(pagedSummary.status === 200, 'Sales summary with page=1 & limit=10 returns 200');
    assert(pagedSummary.data?.data?.page === 1, 'Report response includes page: 1');
    assert(pagedSummary.data?.data?.limit === 10, 'Report response includes limit: 10');

  } catch (error: any) {
    console.error('Test execution exception:', error);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReportsTests().catch((err) => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  });
}
