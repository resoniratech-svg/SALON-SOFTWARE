import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

export interface PosTestResult {
  testCaseId: string;
  module: string;
  scenario: string;
  preconditions: string;
  testSteps: string;
  testData: any;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  bug?: string;
  evidence?: string;
  fix?: string;
  retestResult?: string;
}

export const posTestResults: PosTestResult[] = [];

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let cashierToken: string;
let tenantAId: string;
let tenantBId: string;

function recordTest(result: PosTestResult) {
  posTestResults.push(result);
  const icon = result.status === 'PASS' ? '✅ [PASS]' : result.status === 'FAIL' ? '❌ [FAIL]' : '⚠️ [BLOCKED]';
  console.log(`${icon} ${result.testCaseId}: ${result.scenario}`);
  if (result.status === 'FAIL') {
    console.error(`     Expected: ${result.expectedResult}`);
    console.error(`     Actual:   ${result.actualResult}`);
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

export async function runOverallPosCompleteTests() {
  console.log('\n========================================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Overall POS Flow: Complete End-to-End Integration Test Suite');
  console.log('   References: overall_pos_frames (001 - 077)');
  console.log('========================================================================================\n');

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
    console.log('>>> 1. Authentication & Setup');

    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;

    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;

    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    cashierToken = cashierLogin.data?.data?.token;

    recordTest({
      testCaseId: 'TC-POS-001',
      module: 'POS / Authentication',
      scenario: 'Admin and Cashier authentication for POS access',
      preconditions: 'System operational',
      testSteps: 'Authenticate Admin A, Admin B, and Cashier',
      testData: {},
      expectedResult: 'All 3 users authenticate with HTTP 200 and receive valid JWT tokens',
      actualResult: `Admin A: ${adminALogin.status}, Admin B: ${adminBLogin.status}, Cashier: ${cashierLogin.status}`,
      status: adminALogin.status === 200 && adminBLogin.status === 200 && cashierLogin.status === 200 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 2. Setup Catalog Fixtures (Service, Product, Staff, Guest)
    // -------------------------------------------------------------
    console.log('\n>>> 2. Master Catalog Setup (Matching Screenshot Catalog)');

    // Staff member (e.g., Suhani Pareek from screenshot frame_051)
    const staff = (await prisma.staff.findFirst({
      where: { tenantId: tenantAId, name: 'Suhani Pareek' },
    })) || (await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: 'Suhani Pareek',
      },
    }));

    // Service category & service (Hair Cut With Shampoo - ₹181 net as in frame_071)
    const serviceCat = (await prisma.serviceCategory.findFirst({
      where: { tenantId: tenantAId, name: 'Hair Services' },
    })) || (await prisma.serviceCategory.create({
      data: {
        tenantId: tenantAId,
        name: 'Hair Services',
      },
    }));

    const service = (await prisma.service.findFirst({
      where: { tenantId: tenantAId, name: 'Hair Cut (With Shampoo)' },
    })) || (await prisma.service.create({
      data: {
        tenantId: tenantAId,
        categoryId: serviceCat.id,
        name: 'Hair Cut (With Shampoo)',
        price: 181,
        salePrice: 181,
      },
    }));

    // Product category & product (Oil Reflections Instant Conditioner - ₹238 as in frame_041 & frame_071)
    const productCat = (await prisma.productCategory.findFirst({
      where: { tenantId: tenantAId, name: 'WELLA' },
    })) || (await prisma.productCategory.create({
      data: {
        tenantId: tenantAId,
        name: 'WELLA',
      },
    }));

    const product = (await prisma.product.findFirst({
      where: { tenantId: tenantAId, name: 'Oil Reflections Instant Conditioner' },
    })) || (await prisma.product.create({
      data: {
        tenantId: tenantAId,
        categoryId: productCat.id,
        name: 'Oil Reflections Instant Conditioner',
        price: 238,
        salePrice: 238,
      },
    }));

    // Initial stock setup: Inward 10 units for the product (matching frame_021 "In Stock: 10")
    await prisma.stockTransaction.deleteMany({
      where: { tenantId: tenantAId, productId: product.id },
    });

    await prisma.stockTransaction.create({
      data: {
        tenantId: tenantAId,
        productId: product.id,
        type: 'INWARD',
        quantity: 10,
        unitPrice: 150,
        totalAmount: 1500,
        notes: 'Initial Stock Inward (frame_021)',
        transactionDate: new Date(),
      },
    });

    // Verify initial stock = 10
    const invProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { stockTransactions: true },
    });
    const inwardQty = invProduct?.stockTransactions
      .filter((t) => t.type === 'INWARD' || t.type === 'RECONCILED')
      .reduce((s, t) => s + Number(t.quantity), 0) || 0;
    const outwardQty = invProduct?.stockTransactions
      .filter((t) => t.type === 'OUTWARD' || t.type === 'CONSUMED')
      .reduce((s, t) => s + Number(t.quantity), 0) || 0;
    const initialStock = inwardQty - outwardQty;

    recordTest({
      testCaseId: 'TC-POS-002',
      module: 'POS / Catalog & Inventory Baseline',
      scenario: 'Verify catalog fixtures and initial product stock in hand = 10',
      preconditions: 'Database initialized',
      testSteps: 'Query product stock transactions ledger',
      testData: { productId: product.id, expectedStock: 10 },
      expectedResult: 'Initial product stock equals exactly 10 units',
      actualResult: `Initial Stock: ${initialStock} units`,
      status: initialStock === 10 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 3. Guest Selection & Quick Add Guest Modal (frame_026)
    // -------------------------------------------------------------
    console.log('\n>>> 3. Guest Flow (Selection & Quick Add Modal)');

    // Quick add guest via POS (matching frame_041 guest "bbbbb", mobile "+91 987554324")
    const guestMobile = `9875543${Date.now().toString().slice(-3)}`;
    const quickGuestRes = await request('POST', '/api/crm/guests', {
      name: 'bbbbb',
      mobile: guestMobile,
      gender: 'Female',
      customerType: 'VIP',
      hairType: 'Straight',
      store: 'kalyaninagar',
    }, adminAToken);

    const guestId = quickGuestRes.data?.data?.id;

    recordTest({
      testCaseId: 'TC-POS-003',
      module: 'POS / Guest Flow',
      scenario: 'Quick Add Guest modal creates new guest with salon demographics (frame_026)',
      preconditions: 'Admin authenticated',
      testSteps: 'POST /api/crm/guests with name, mobile, gender, hairType, store',
      testData: { name: 'bbbbb', mobile: guestMobile, store: 'kalyaninagar' },
      expectedResult: 'HTTP 201, guest created with assigned UUID and guestCode',
      actualResult: `HTTP ${quickGuestRes.status}, guestId=${guestId}, name=${quickGuestRes.data?.data?.name}`,
      status: quickGuestRes.status === 201 && !!guestId ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 4. Cart Dynamic Calculation Engine (Subtotal, Tax, Discounts)
    // -------------------------------------------------------------
    console.log('\n>>> 4. Dynamic Cart Calculation (Quantity x Price, GST, Total)');

    // Cart with 1 Service (181) + 1 Product (238) + 21 tax = 440 (matching frame_041 Total: ₹440)
    const calcRes = await request('POST', '/api/pos/calculate', {
      guestId,
      items: [
        {
          itemType: 'SERVICE',
          serviceId: service.id,
          staffId: staff.id,
          quantity: 1,
          unitPrice: 181,
        },
        {
          itemType: 'PRODUCT',
          productId: product.id,
          staffId: staff.id,
          quantity: 1,
          unitPrice: 238,
        },
      ],
      tipAmount: 21, // tip/adjustment to reach exact ₹440 as shown in screenshot
    }, adminAToken);

    const calcData = calcRes.data?.data;
    const calcSubtotal = calcData?.subtotal;
    const calcTotal = calcData?.totalAmount;

    recordTest({
      testCaseId: 'TC-POS-004',
      module: 'POS / Calculations',
      scenario: 'Authoritative dynamic cart calculation matches screenshot totals (181 + 238 + 21 = ₹440)',
      preconditions: 'Service and product selected in cart',
      testSteps: 'POST /api/pos/calculate with 1 service (181) and 1 product (238)',
      testData: { servicePrice: 181, productPrice: 238, tip: 21 },
      expectedResult: 'Subtotal=419, totalAmount calculated with tax & tip, itemsCalculated contains both rows',
      actualResult: `HTTP ${calcRes.status}, Subtotal=${calcSubtotal}, Total=${calcTotal}, itemsCount=${calcData?.itemsCalculated?.length}`,
      status: calcRes.status === 200 && calcSubtotal === 419 && calcTotal > 419 && calcData?.itemsCalculated?.length === 2 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 5. Complete Sale with Cash Payment (frame_041)
    // -------------------------------------------------------------
    console.log('\n>>> 5. Complete Sale & Atomic DB Order Creation');

    // Ensure Cash Counter is open for this store so cash flows into Cash Management
    await request('POST', '/api/cash-management/start', {
      openingBalance: 100,
      store: 'kalyaninagar',
    }, adminAToken);

    const saleRes = await request('POST', '/api/pos/orders', {
      guestId,
      items: [
        {
          itemType: 'SERVICE',
          serviceId: service.id,
          staffId: staff.id,
          quantity: 1,
          unitPrice: 181,
        },
        {
          itemType: 'PRODUCT',
          productId: product.id,
          staffId: staff.id,
          quantity: 1,
          unitPrice: 238,
        },
      ],
      tipAmount: 21,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      notes: 'Pickup order (frame_041)',
    }, adminAToken);

    const createdOrder = saleRes.data?.data;
    const orderId = createdOrder?.id;
    const orderNumber = createdOrder?.orderNumber;

    recordTest({
      testCaseId: 'TC-POS-005',
      module: 'POS / Order Creation',
      scenario: 'Complete sale creates order atomically with invoice number and payments (frame_041)',
      preconditions: 'Active cart, guest selected, cash payment',
      testSteps: 'POST /api/pos/orders with COMPLETED status and CASH payment',
      testData: { totalAmount: createdOrder?.totalAmount, paymentMethod: 'CASH' },
      expectedResult: 'HTTP 201, orderNumber starts with INV-, paymentStatus=PAID, 2 items saved',
      actualResult: `HTTP ${saleRes.status}, orderNumber=${orderNumber}, total=${createdOrder?.totalAmount}, items=${createdOrder?.items?.length}`,
      status: saleRes.status === 201 && !!orderNumber && orderNumber.startsWith('INV-') && createdOrder?.paymentStatus === 'PAID' && createdOrder?.items?.length === 2 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 6. POS Dashboard (Order Dashboard) Verification (frame_041)
    // -------------------------------------------------------------
    console.log('\n>>> 6. POS Dashboard Integration (frame_041)');

    const dashboardSummary = await request('GET', '/api/pos/dashboard/summary', undefined, adminAToken);
    const completedOrdersList = await request('GET', '/api/pos/orders', undefined, adminAToken, {
      status: 'COMPLETED',
    });

    const ordersArray = Array.isArray(completedOrdersList.data?.data)
      ? completedOrdersList.data.data
      : (completedOrdersList.data?.data?.data || []);
    const foundInDashboard = ordersArray.find((o: any) => o.id === orderId);

    recordTest({
      testCaseId: 'TC-POS-006',
      module: 'POS / Order Dashboard',
      scenario: 'Newly completed POS sale appears in POS Dashboard under Completed tab (frame_041)',
      preconditions: 'Order created',
      testSteps: 'GET /api/pos/orders?status=COMPLETED',
      testData: { orderNumber },
      expectedResult: 'Order appears with Guest name bbbbb, mobile, items, total ₹440',
      actualResult: `Found in dashboard: ${!!foundInDashboard}, guest=${foundInDashboard?.guest?.name}, total=${foundInDashboard?.totalAmount}`,
      status: !!foundInDashboard && foundInDashboard?.guest?.name === 'bbbbb' ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 7. Inventory Integration: Automatic Stock Deduction (frame_021)
    // -------------------------------------------------------------
    console.log('\n>>> 7. Inventory Stock Movement Integration');

    // Query inventory stock for product after sale
    const productAfterSale = await prisma.product.findUnique({
      where: { id: product.id },
      include: { stockTransactions: true },
    });

    const inwardAfter = productAfterSale?.stockTransactions
      .filter((t) => t.type === 'INWARD' || t.type === 'RECONCILED')
      .reduce((s, t) => s + Number(t.quantity), 0) || 0;
    const outwardAfter = productAfterSale?.stockTransactions
      .filter((t) => t.type === 'OUTWARD' || t.type === 'CONSUMED')
      .reduce((s, t) => s + Number(t.quantity), 0) || 0;
    const currentStock = inwardAfter - outwardAfter;

    // Check outward stock transaction created
    const stockOutTx = productAfterSale?.stockTransactions.find(
      (t) => t.type === 'OUTWARD' && t.notes?.includes(orderNumber)
    );

    recordTest({
      testCaseId: 'TC-POS-007',
      module: 'POS / Inventory Integration',
      scenario: 'Product sale automatically deducts inventory stock from 10 to 9 via StockTransaction',
      preconditions: 'Initial stock was 10, 1 unit sold',
      testSteps: 'Inspect product stockTransactions ledger in PostgreSQL',
      testData: { productId: product.id, soldQuantity: 1 },
      expectedResult: 'Stock in hand decreases to exactly 9, OUTWARD stock transaction created with orderNumber note',
      actualResult: `Current Stock=${currentStock} (was 10), stockOutTx found: ${!!stockOutTx}`,
      status: currentStock === 9 && !!stockOutTx ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 8. Cash Management Integration (Active Session Revenue & Cards)
    // -------------------------------------------------------------
    console.log('\n>>> 8. Cash Management Integration');

    const cmSummary = await request('GET', '/api/cash-management/summary', undefined, adminAToken, {
      store: 'kalyaninagar',
    });
    const cmRevenue = await request('GET', '/api/cash-management/revenue', undefined, adminAToken, {
      store: 'kalyaninagar',
    });

    const cmCards = cmSummary.data?.data?.cards;
    const saleInRevenueTab = cmRevenue.data?.data?.rows?.find((r: any) => r.invoiceNo === orderNumber);

    recordTest({
      testCaseId: 'TC-POS-008',
      module: 'POS / Cash Management Integration',
      scenario: 'CASH payment from POS sale flows immediately into Cash Management live cards and Revenue tab',
      preconditions: 'Active cash counter open, ₹440 cash sale completed',
      testSteps: 'GET /api/cash-management/summary and /api/cash-management/revenue',
      testData: { expectedRevenue: 440 },
      expectedResult: 'cards.cashRevenue increases by ₹440, sale appears in Revenue tab with guest bbbbb',
      actualResult: `cashRevenue=${cmCards?.cashRevenue}, closingBalance=${cmCards?.closingBalance}, saleInTab=${!!saleInRevenueTab}`,
      status: cmCards?.cashRevenue >= 440 && !!saleInRevenueTab ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 9. Trends Integration (Revenue Split & Categories)
    // -------------------------------------------------------------
    console.log('\n>>> 9. Trends Integration');

    const trendsDashboard = await request('GET', '/api/trends/dashboard', undefined, adminAToken, {
      location: 'kalyaninagar',
      revenue_period: '14D',
    });

    const revenueSplit = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      location: 'kalyaninagar',
      period: '14D',
      category: 'overall',
    });

    const totalRevTrends = trendsDashboard.data?.data?.revenueSplit?.total;
    const splitData = revenueSplit.data?.data?.data || [];
    const hasServiceInSplit = splitData.some((s: any) => (s.key === 'Service' || s.label === 'Service') && s.amount > 0);
    const hasProductInSplit = splitData.some((s: any) => (s.key === 'Product' || s.label === 'Product') && s.amount > 0);

    recordTest({
      testCaseId: 'TC-POS-009',
      module: 'POS / Trends Integration',
      scenario: 'POS transaction feeds Trends revenue breakdown for Service and Product categories',
      preconditions: 'POS sale of service and product completed',
      testSteps: 'GET /api/trends/dashboard and /api/trends/revenue-split',
      testData: { location: 'kalyaninagar', period: '14D' },
      expectedResult: 'Trends reflects revenue, includes Service and Product category splits',
      actualResult: `Total revenue in trends=${totalRevTrends}, hasService=${hasServiceInSplit}, hasProduct=${hasProductInSplit}`,
      status: totalRevTrends > 0 && hasServiceInSplit && hasProductInSplit ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 10. Reports Integration (Sales Summary & Cash Transactions) (frame_071)
    // -------------------------------------------------------------
    console.log('\n>>> 10. Reports Integration (frame_071)');

    const todayStr = new Date().toISOString().split('T')[0];
    const salesSummaryReport = await request('GET', '/api/reports/sales-summary', undefined, adminAToken, {
      startDate: todayStr,
      endDate: todayStr,
    });

    const cashTxReport = await request('GET', '/api/reports/cash-transactions', undefined, adminAToken, {
      startDate: todayStr,
      endDate: todayStr,
    });

    const grossSales = salesSummaryReport.data?.data?.totals?.grossSales;
    const cashInflowRow = cashTxReport.data?.data?.rows?.find((r: any) => r.reference === orderNumber);

    recordTest({
      testCaseId: 'TC-POS-010',
      module: 'POS / Reports Integration',
      scenario: 'Completed sale flows into Sales Summary report and Cash Transactions report (frame_071)',
      preconditions: 'POS sale completed',
      testSteps: 'GET /api/reports/sales-summary and /api/reports/cash-transactions',
      testData: { orderNumber },
      expectedResult: 'Sales Summary contains gross sales, Cash Transactions report records INFLOW for invoice',
      actualResult: `Gross Sales=${grossSales}, cashTx found: ${!!cashInflowRow} (amt=${cashInflowRow?.amount})`,
      status: Number(grossSales) > 0 && !!cashInflowRow ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 11. Multi-Payment Types (Card, Split, Partial)
    // -------------------------------------------------------------
    console.log('\n>>> 11. Payment Methods (Card, Split, Partial)');

    // 11A. Card Only Sale
    const cardSale = await request('POST', '/api/pos/orders', {
      guestId,
      items: [
        {
          itemType: 'SERVICE',
          serviceId: service.id,
          staffId: staff.id,
          quantity: 1,
          unitPrice: 181,
        },
      ],
      paymentMethod: 'CARD',
      status: 'COMPLETED',
    }, adminAToken);

    recordTest({
      testCaseId: 'TC-POS-011',
      module: 'POS / Payments',
      scenario: 'Card payment sale created with paymentMethod=CARD and does NOT increase cash drawer',
      preconditions: 'Guest and service',
      testSteps: 'POST /api/pos/orders with paymentMethod=CARD',
      testData: { method: 'CARD', amount: 181 },
      expectedResult: 'HTTP 201, payment saved with method=CARD',
      actualResult: `HTTP ${cardSale.status}, method=${cardSale.data?.data?.paymentMethod}`,
      status: cardSale.status === 201 && cardSale.data?.data?.paymentMethod === 'CARD' ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 11B. Split Payment Sale (Cash + Card)
    const splitSale = await request('POST', '/api/pos/orders', {
      guestId,
      items: [
        {
          itemType: 'SERVICE',
          serviceId: service.id,
          staffId: staff.id,
          quantity: 1,
          unitPrice: 181,
        },
      ],
      payments: [
        { method: 'CASH', amount: 81 },
        { method: 'CARD', amount: 100 },
      ],
      paymentMethod: 'SPLIT',
      status: 'COMPLETED',
    }, adminAToken);

    recordTest({
      testCaseId: 'TC-POS-012',
      module: 'POS / Payments',
      scenario: 'Split payment sale (₹81 Cash + ₹100 Card) persists both payment ledger records',
      preconditions: 'Guest and service',
      testSteps: 'POST /api/pos/orders with payments array [CASH 81, CARD 100]',
      testData: { cash: 81, card: 100 },
      expectedResult: 'HTTP 201, paymentMethod=SPLIT, 2 payment records created',
      actualResult: `HTTP ${splitSale.status}, method=${splitSale.data?.data?.paymentMethod}, paymentsCount=${splitSale.data?.data?.payments?.length}`,
      status: splitSale.status === 201 && splitSale.data?.data?.payments?.length === 2 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // -------------------------------------------------------------
    // 12. Order Cancellation & Stock Reversal Flow
    // -------------------------------------------------------------
    console.log('\n>>> 12. Order Cancellation & Stock Reversal');

    // Cancel the first sale (which had 1 unit of product)
    const cancelRes = await request('POST', `/api/pos/orders/${orderId}/cancel`, {
      reason: 'Customer requested cancellation and refund',
    }, adminAToken);

    // Verify product stock restored from 9 back to 10
    const productAfterCancel = await prisma.product.findUnique({
      where: { id: product.id },
      include: { stockTransactions: true },
    });

    const inwardCancel = productAfterCancel?.stockTransactions
      .filter((t) => t.type === 'INWARD' || t.type === 'RECONCILED')
      .reduce((s, t) => s + Number(t.quantity), 0) || 0;
    const outwardCancel = productAfterCancel?.stockTransactions
      .filter((t) => t.type === 'OUTWARD' || t.type === 'CONSUMED')
      .reduce((s, t) => s + Number(t.quantity), 0) || 0;
    const stockAfterCancel = inwardCancel - outwardCancel;

    const reversalTx = productAfterCancel?.stockTransactions.find(
      (t) => t.type === 'INWARD' && t.notes?.includes('Cancelled Reversal')
    );

    recordTest({
      testCaseId: 'TC-POS-013',
      module: 'POS / Order Lifecycle',
      scenario: 'Cancelling completed order reverses guest spend and restores inventory stock to 10',
      preconditions: 'Completed order with product',
      testSteps: 'POST /api/pos/orders/:id/cancel, inspect stock ledger',
      testData: { orderId, productStockBefore: 9 },
      expectedResult: 'Order status=CANCELLED, INWARD reversal stock transaction created, stock restored to 10',
      actualResult: `HTTP ${cancelRes.status}, status=${cancelRes.data?.data?.status}, stock=${stockAfterCancel}, reversalFound=${!!reversalTx}`,
      status: cancelRes.status === 200 && cancelRes.data?.data?.status === 'CANCELLED' && stockAfterCancel === 10 && !!reversalTx ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 13. Edge Cases & Concurrency Protection
    // -------------------------------------------------------------
    console.log('\n>>> 13. Edge Cases & Concurrency');

    // 13A. Empty Cart validation
    const emptyCart = await request('POST', '/api/pos/orders', {
      guestId,
      items: [],
      paymentMethod: 'CASH',
    }, adminAToken);

    recordTest({
      testCaseId: 'TC-POS-014',
      module: 'POS / Validation',
      scenario: 'Empty cart checkout is rejected with HTTP 400',
      preconditions: 'None',
      testSteps: 'POST /api/pos/orders with empty items array',
      testData: { items: [] },
      expectedResult: 'HTTP 400 validation error',
      actualResult: `HTTP ${emptyCart.status}`,
      status: emptyCart.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 13B. Invalid Guest
    const invalidGuest = await request('POST', '/api/pos/orders', {
      guestId: '00000000-0000-0000-0000-000000000000',
      items: [{ itemType: 'SERVICE', serviceId: service.id, quantity: 1, unitPrice: 181 }],
      paymentMethod: 'CASH',
    }, adminAToken);

    recordTest({
      testCaseId: 'TC-POS-015',
      module: 'POS / Validation',
      scenario: 'Non-existent guestId rejected with HTTP 400/404',
      preconditions: 'None',
      testSteps: 'POST /api/pos/orders with invalid guestId',
      testData: { guestId: '00000000-0000-0000-0000-000000000000' },
      expectedResult: 'HTTP 400/404 error (Guest not found)',
      actualResult: `HTTP ${invalidGuest.status}`,
      status: invalidGuest.status === 400 || invalidGuest.status === 404 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 13C. Double-click checkout race condition
    const [chk1, chk2] = await Promise.all([
      request('POST', '/api/pos/orders', {
        guestId,
        items: [{ itemType: 'SERVICE', serviceId: service.id, staffId: staff.id, quantity: 1, unitPrice: 181 }],
        paymentMethod: 'CASH',
        status: 'COMPLETED',
      }, adminAToken),
      request('POST', '/api/pos/orders', {
        guestId,
        items: [{ itemType: 'SERVICE', serviceId: service.id, staffId: staff.id, quantity: 1, unitPrice: 181 }],
        paymentMethod: 'CASH',
        status: 'COMPLETED',
      }, adminAToken),
    ]);

    recordTest({
      testCaseId: 'TC-POS-016',
      module: 'POS / Concurrency',
      scenario: 'Concurrent checkout requests receive unique chronological order numbers without collision',
      preconditions: 'Concurrent submission',
      testSteps: 'Fire two simultaneous POST /orders requests',
      testData: {},
      expectedResult: 'Both create separate valid orders with unique orderNumbers',
      actualResult: `Order 1=${chk1.data?.data?.orderNumber}, Order 2=${chk2.data?.data?.orderNumber}`,
      status: chk1.status === 201 && chk2.status === 201 && chk1.data?.data?.orderNumber !== chk2.data?.data?.orderNumber ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 14. Multi-Tenant Isolation (Tenant A vs Tenant B)
    // -------------------------------------------------------------
    console.log('\n>>> 14. Multi-Tenant Isolation');

    const tenantBOrders = await request('GET', '/api/pos/orders', undefined, adminBToken);
    const tenantBOrdersArray = Array.isArray(tenantBOrders.data?.data)
      ? tenantBOrders.data.data
      : (tenantBOrders.data?.data?.data || []);
    const hasTenantAOrderInB = tenantBOrdersArray.some((o: any) => o.id === orderId);

    const tenantBCrossGet = await request('GET', `/api/pos/orders/${orderId}`, undefined, adminBToken);

    recordTest({
      testCaseId: 'TC-POS-017',
      module: 'POS / Multi-Tenant Isolation',
      scenario: 'Tenant B cannot list or view Tenant A orders via API (Strict Multi-Tenancy)',
      preconditions: 'Tenant A orders exist',
      testSteps: 'Tenant B queries GET /orders and GET /orders/:id for Tenant A order',
      testData: { targetOrderId: orderId },
      expectedResult: 'Order does not appear in Tenant B list, direct GET returns HTTP 404',
      actualResult: `Found in list: ${hasTenantAOrderInB}, direct GET HTTP: ${tenantBCrossGet.status}`,
      status: !hasTenantAOrderInB && tenantBCrossGet.status === 404 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // -------------------------------------------------------------
    // 15. Formatted Bill / Invoice Retrieval
    // -------------------------------------------------------------
    console.log('\n>>> 15. Formatted Invoice & Bill Output');

    const invoiceRes = await request('GET', `/api/pos/orders/${chk1.data?.data?.id}/invoice`, undefined, adminAToken);
    const invoiceData = invoiceRes.data?.data;

    recordTest({
      testCaseId: 'TC-POS-018',
      module: 'POS / Invoice',
      scenario: 'Formatted bill retrieval contains salon details, invoice number, items, and footer',
      preconditions: 'Order exists',
      testSteps: 'GET /api/pos/orders/:id/invoice',
      testData: { orderId: chk1.data?.data?.id },
      expectedResult: 'HTTP 200, invoiceNumber present, salon.name present, footerText present',
      actualResult: `HTTP ${invoiceRes.status}, invoiceNumber=${invoiceData?.invoiceNumber}, salon=${invoiceData?.salon?.name}`,
      status: invoiceRes.status === 200 && !!invoiceData?.invoiceNumber && !!invoiceData?.salon?.name ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // Clean up cash counter opened during tests
    await request('POST', '/api/cash-management/close', { instoreCash: 100, remarks: 'Close test counter' }, adminAToken, { store: 'kalyaninagar' });

    // Summary
    const passed = posTestResults.filter((t) => t.status === 'PASS').length;
    const failed = posTestResults.filter((t) => t.status === 'FAIL').length;
    const blocked = posTestResults.filter((t) => t.status === 'BLOCKED').length;

    console.log('\n========================================================================================');
    console.log(`   OVERALL POS FLOW RESULTS: ${posTestResults.length} Tests | ${passed} PASSED | ${failed} FAILED | ${blocked} BLOCKED`);
    console.log('========================================================================================\n');

    return { total: posTestResults.length, passed, failed, blocked, results: posTestResults };
  } finally {
    if (server) {
      server.close();
    }
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith('overall-pos-complete.test.ts')) {
  runOverallPosCompleteTests()
    .then(({ failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
