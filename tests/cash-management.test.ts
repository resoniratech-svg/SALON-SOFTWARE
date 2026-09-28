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

export async function runCashManagementTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Cash Management Module Test Suite');
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

    // Clean up any lingering open transactions for clean testing
    await prisma.cashTransaction.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });

    // -------------------------------------------------------------
    // 2. Initial State (No Active Transaction)
    // -------------------------------------------------------------
    console.log('\n--- 2. Initial State (No Active Transaction) ---');

    const initialSummary = await request('GET', '/api/cash-management/summary', undefined, adminAToken);
    assert(initialSummary.status === 200, 'GET /summary returns 200');
    assert(initialSummary.data?.data?.isActive === false, 'isActive is false when no counter is open');
    assert(initialSummary.data?.data?.activeTransaction === null, 'activeTransaction is null');
    assert(initialSummary.data?.data?.suggestedOpeningBalance === 0, 'suggestedOpeningBalance defaults to 0');
    assert(initialSummary.data?.data?.cards?.openingBalance === 0, 'Summary cards openingBalance is 0');

    const nextOpeningBalInitial = await request('GET', '/api/cash-management/next-opening-balance', undefined, adminAToken);
    assert(nextOpeningBalInitial.status === 200, 'GET /next-opening-balance returns 200');
    assert(nextOpeningBalInitial.data?.data?.suggestedOpeningBalance === 0, 'Initial suggested opening balance is 0');

    // -------------------------------------------------------------
    // 3. Start Transaction
    // -------------------------------------------------------------
    console.log('\n--- 3. Start Transaction ---');

    const startTxRes = await request('POST', '/api/cash-management/start', {
      openingBalance: 500,
      store: 'kalyaninagar',
    }, adminAToken);

    assert(startTxRes.status === 201, 'POST /start returns 201');
    assert(startTxRes.data?.data?.status === 'OPEN', 'Started transaction has status OPEN');
    assert(startTxRes.data?.data?.openingBalance === 500, 'Opening balance set to 500');
    assert(startTxRes.data?.data?.closingBalance === 500, 'Initial closing balance equals opening balance 500');
    const firstTxId = startTxRes.data?.data?.id;

    // Prevent duplicate active transaction
    const dupStartRes = await request('POST', '/api/cash-management/start', {
      openingBalance: 200,
      store: 'kalyaninagar',
    }, adminAToken);
    assert(dupStartRes.status === 400, 'POST /start rejects duplicate active transaction with 400');
    assert(
      dupStartRes.data?.message?.includes('already open'),
      'Error message clarifies an active transaction is already open'
    );

    // -------------------------------------------------------------
    // 4. Verify Active Summary Cards
    // -------------------------------------------------------------
    console.log('\n--- 4. Active Summary Cards ---');

    const activeSummary = await request('GET', '/api/cash-management/summary', undefined, adminAToken);
    assert(activeSummary.status === 200, 'GET /summary returns 200 when active');
    assert(activeSummary.data?.data?.isActive === true, 'isActive is true');
    assert(activeSummary.data?.data?.activeTransaction?.id === firstTxId, 'Active transaction ID matches');
    assert(activeSummary.data?.data?.cards?.openingBalance === 500, 'Cards opening balance is 500');
    assert(activeSummary.data?.data?.cards?.cashRevenue === 0, 'Initial cash revenue is 0');
    assert(activeSummary.data?.data?.cards?.cashExpense === 0, 'Initial cash expense is 0');
    assert(activeSummary.data?.data?.cards?.closingBalance === 500, 'Cards closing balance is 500');

    // -------------------------------------------------------------
    // 5. Real-Time Cash Revenue Integration (POS Cash Payment)
    // -------------------------------------------------------------
    console.log('\n--- 5. Real-Time Cash Revenue Integration ---');

    // Create a Guest, Staff, Service for POS order
    const guest = (await prisma.guest.findFirst({
      where: { tenantId: tenantAId, mobile: '9876543210' },
    })) || (await prisma.guest.create({
      data: {
        tenantId: tenantAId,
        name: 'Aarav Patel',
        mobile: '9876543210',
        store: 'kalyaninagar',
      },
    }));

    const staff = (await prisma.staff.findFirst({
      where: { tenantId: tenantAId, name: 'Master Stylist Rohan' },
    })) || (await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: 'Master Stylist Rohan',
      },
    }));

    const serviceCat = (await prisma.serviceCategory.findFirst({
      where: { tenantId: tenantAId, name: 'Hair Services CM' },
    })) || (await prisma.serviceCategory.create({
      data: {
        tenantId: tenantAId,
        name: 'Hair Services CM',
      },
    }));

    const service = (await prisma.service.findFirst({
      where: { tenantId: tenantAId, name: 'Signature Haircut' },
    })) || (await prisma.service.create({
      data: {
        tenantId: tenantAId,
        categoryId: serviceCat.id,
        name: 'Signature Haircut',
        price: 1200,
      },
    }));

    // Create POS order with Cash payment of 1,200
    const orderNumber = `INV-CM-${Date.now().toString().slice(-6)}`;
    const posOrder = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber,
        guestId: guest.id,
        totalAmount: 1200,
        subtotal: 1200,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        items: {
          create: {
            tenantId: tenantAId,
            serviceId: service.id,
            staffId: staff.id,
            itemName: 'Signature Haircut',
            unitPrice: 1200,
            subtotal: 1200,
            total: 1200,
          },
        },
        payments: {
          create: {
            tenantId: tenantAId,
            method: 'CASH',
            amount: 1200,
            status: 'SUCCESS',
          },
        },
      },
    });

    // Check that Summary updated in real-time
    const summaryAfterSale = await request('GET', '/api/cash-management/summary', undefined, adminAToken);
    assert(summaryAfterSale.status === 200, 'GET /summary returns 200 after sale');
    assert(summaryAfterSale.data?.data?.cards?.cashRevenue === 1200, 'Cards cashRevenue reflects 1200');
    assert(
      summaryAfterSale.data?.data?.cards?.closingBalance === 1700,
      'Closing balance is 500 (opening) + 1200 (revenue) = 1700'
    );

    // Check Revenue Tab endpoint
    const revenueTab = await request('GET', '/api/cash-management/revenue', undefined, adminAToken);
    assert(revenueTab.status === 200, 'GET /revenue returns 200');
    assert(revenueTab.data?.data?.summary?.totalCashRevenue >= 1200, 'Total cash revenue summary matches');
    assert(revenueTab.data?.data?.rows?.length >= 1, 'Revenue rows contain POS orders');
    const saleRow = revenueTab.data?.data?.rows?.find((r: any) => r.invoiceNo === orderNumber);
    assert(!!saleRow, 'Revenue row contains invoiceNo');
    assert(saleRow?.guestName === 'Aarav Patel', 'Revenue row contains guest name');
    assert(saleRow?.staffName === 'Master Stylist Rohan', 'Revenue row contains staff name');
    assert(saleRow?.cashAmount === 1200, 'Revenue row cash amount is 1200');

    // -------------------------------------------------------------
    // 6. Real-Time Cash Expense Integration
    // -------------------------------------------------------------
    console.log('\n--- 6. Real-Time Cash Expense Integration ---');

    const expenseRes = await request('POST', '/api/cash-management/expenses', {
      amount: 200,
      categoryName: 'Refreshments & Tea',
      description: 'Evening tea and snacks for salon team',
      staffId: staff.id,
      store: 'kalyaninagar',
    }, adminAToken);

    assert(expenseRes.status === 201, 'POST /expenses returns 201');
    assert(expenseRes.data?.data?.amount === 200, 'Expense amount is 200');
    assert(expenseRes.data?.data?.categoryName === 'Refreshments & Tea', 'Category recorded properly');

    // Check Summary updated in real-time
    const summaryAfterExpense = await request('GET', '/api/cash-management/summary', undefined, adminAToken);
    assert(summaryAfterExpense.data?.data?.cards?.cashExpense === 200, 'Cards cashExpense reflects 200');
    assert(
      summaryAfterExpense.data?.data?.cards?.closingBalance === 1500,
      'Closing balance is 500 + 1200 - 200 = 1500'
    );
    assert(
      summaryAfterExpense.data?.data?.cards?.reconcileAmount === -1500,
      'Reconcile amount is 0 (instore) - 1500 = -1500'
    );

    // Check Expenses Tab endpoint
    const expensesTab = await request('GET', '/api/cash-management/expenses', undefined, adminAToken);
    assert(expensesTab.status === 200, 'GET /expenses returns 200');
    assert(expensesTab.data?.data?.summary?.totalCashExpenses >= 200, 'Total cash expenses summary matches');
    assert(expensesTab.data?.data?.rows?.length >= 1, 'Expenses rows contain recorded expense');
    const expRow = expensesTab.data?.data?.rows?.find((r: any) => r.categoryName === 'Refreshments & Tea');
    assert(!!expRow, 'Expenses row contains categoryName');
    assert(expRow?.cashAmount === 200, 'Expense row cash amount is 200');

    // -------------------------------------------------------------
    // 7. Close Counter Modal & Validation
    // -------------------------------------------------------------
    console.log('\n--- 7. Close Counter Validation & Execution ---');

    // Validation: remarks required and cannot be empty / whitespace only
    const emptyRemarkClose = await request('POST', '/api/cash-management/close', {
      instoreCash: 1550,
      remarks: '   ',
    }, adminAToken);
    assert(emptyRemarkClose.status === 400, 'POST /close rejects empty remark with 400');

    // Successful Close with surplus of 50 (in-store: 1550 vs closing: 1500)
    const closeRes = await request('POST', '/api/cash-management/close', {
      instoreCash: 1550,
      remarks: 'End of day counter close. Verified cash drawer, surplus Rs 50.',
    }, adminAToken);

    assert(closeRes.status === 200, 'POST /close returns 200');
    assert(closeRes.data?.data?.status === 'CLOSED', 'Status transitioned to CLOSED');
    assert(closeRes.data?.data?.openingBalance === 500, 'Opening balance preserved as 500');
    assert(closeRes.data?.data?.cashRevenue === 1200, 'Cash revenue saved as 1200');
    assert(closeRes.data?.data?.cashExpense === 200, 'Cash expense saved as 200');
    assert(closeRes.data?.data?.closingBalance === 1500, 'Closing balance calculated as 1500');
    assert(closeRes.data?.data?.instoreCash === 1550, 'In-store cash recorded as 1550');
    assert(closeRes.data?.data?.reconciliation === 50, 'Reconciliation (Difference) calculated as +50 (1550 - 1500)');
    assert(
      closeRes.data?.data?.closingRemark?.includes('surplus Rs 50'),
      'Closing remark saved successfully'
    );

    // Verify counter is now closed
    const summaryAfterClose = await request('GET', '/api/cash-management/summary', undefined, adminAToken);
    assert(summaryAfterClose.data?.data?.isActive === false, 'isActive is now false after close');
    assert(
      summaryAfterClose.data?.data?.suggestedOpeningBalance === 1550,
      'Suggested opening balance for next transaction equals previous in-store cash (1550)'
    );

    // -------------------------------------------------------------
    // 8. Next Opening Balance & Starting Next Transaction
    // -------------------------------------------------------------
    console.log('\n--- 8. Next Opening Balance & Consecutive Transaction ---');

    const nextOpeningRes = await request('GET', '/api/cash-management/next-opening-balance', undefined, adminAToken);
    assert(nextOpeningRes.status === 200, 'GET /next-opening-balance returns 200');
    assert(nextOpeningRes.data?.data?.suggestedOpeningBalance === 1550, 'suggestedOpeningBalance is 1550');
    assert(nextOpeningRes.data?.data?.previousTransaction?.id === firstTxId, 'Previous transaction referenced');

    // Start next transaction without supplying openingBalance -> auto uses 1550
    const startTx2Res = await request('POST', '/api/cash-management/start', {
      store: 'kalyaninagar',
    }, adminAToken);

    assert(startTx2Res.status === 201, 'POST /start returns 201 for second session');
    assert(
      startTx2Res.data?.data?.openingBalance === 1550,
      'Second session automatically uses 1550 from previous closed counter'
    );
    assert(startTx2Res.data?.data?.closingBalance === 1550, 'Closing balance initialized to 1550');
    const secondTxId = startTx2Res.data?.data?.id;

    // Close second transaction
    const closeTx2Res = await request('POST', '/api/cash-management/close', {
      instoreCash: 1550,
      remarks: 'Second counter shift closed smoothly.',
    }, adminAToken);
    assert(closeTx2Res.status === 200, 'POST /close for second session returns 200');
    assert(closeTx2Res.data?.data?.reconciliation === 0, 'Reconciliation is exactly 0 (1550 - 1550)');

    // -------------------------------------------------------------
    // 9. Transactions History Tab & Pagination
    // -------------------------------------------------------------
    console.log('\n--- 9. Transactions History Tab & Pagination ---');

    const listTxRes = await request('GET', '/api/cash-management/transactions', undefined, adminAToken, {
      store: 'kalyaninagar',
      page: '1',
      limit: '10',
    });

    assert(listTxRes.status === 200, 'GET /transactions returns 200');
    assert(listTxRes.data?.data?.length === 2, 'Lists both closed transactions');
    assert(listTxRes.data?.pagination?.total === 2, 'Pagination total is 2');
    assert(listTxRes.data?.data?.[0]?.id === secondTxId, 'Ordered newest first');

    const singleTxRes = await request('GET', `/api/cash-management/transactions/${firstTxId}`, undefined, adminAToken);
    assert(singleTxRes.status === 200, 'GET /transactions/:id returns 200');
    assert(singleTxRes.data?.data?.id === firstTxId, 'Fetched correct transaction by ID');

    // -------------------------------------------------------------
    // 10. Edit Closed Transaction (Pencil Action & Audit Trail)
    // -------------------------------------------------------------
    console.log('\n--- 10. Edit Closed Transaction & Audit Trail ---');

    // Validation: updateRemark is required
    const invalidEdit = await request('PATCH', `/api/cash-management/transactions/${firstTxId}`, {
      instoreCash: 1500,
      updateRemark: '   ',
    }, adminAToken);
    assert(invalidEdit.status === 400, 'PATCH /transactions/:id rejects empty updateRemark');

    // Valid edit: adjust instoreCash from 1550 to 1500
    const validEdit = await request('PATCH', `/api/cash-management/transactions/${firstTxId}`, {
      instoreCash: 1500,
      updateRemark: 'Re-counted physical cash: 1500 exact match.',
    }, adminAToken);

    assert(validEdit.status === 200, 'PATCH /transactions/:id returns 200');
    assert(validEdit.data?.data?.instoreCash === 1500, 'instoreCash updated to 1500');
    assert(validEdit.data?.data?.reconciliation === 0, 'reconciliation recalculated to 0 (1500 - 1500)');
    assert(
      validEdit.data?.data?.updateRemark === 'Re-counted physical cash: 1500 exact match.',
      'updateRemark audit note saved'
    );
    assert(validEdit.data?.data?.updatedBy === 'admin', 'updatedBy captures admin username');

    // -------------------------------------------------------------
    // 11. Multi-Tenant & Store Isolation
    // -------------------------------------------------------------
    console.log('\n--- 11. Multi-Tenant & Store Isolation ---');

    const tenantBList = await request('GET', '/api/cash-management/transactions', undefined, adminBToken);
    assert(tenantBList.status === 200, 'Tenant B GET /transactions returns 200');
    assert(tenantBList.data?.data?.length === 0, 'Tenant B does not see Tenant A transactions');

    const tenantBCrossEdit = await request('PATCH', `/api/cash-management/transactions/${firstTxId}`, {
      instoreCash: 2000,
      updateRemark: 'Malicious modification',
    }, adminBToken);
    assert(tenantBCrossEdit.status === 404, 'Tenant B cannot update Tenant A transaction (returns 404)');

    // -------------------------------------------------------------
    // 12. Cashier Role Access
    // -------------------------------------------------------------
    console.log('\n--- 12. Cashier Role Access ---');

    const cashierSummary = await request('GET', '/api/cash-management/summary', undefined, cashierToken);
    assert(cashierSummary.status === 200, 'Cashier can access /summary');

    const cashierTxList = await request('GET', '/api/cash-management/transactions', undefined, cashierToken);
    assert(cashierTxList.status === 200, 'Cashier can access /transactions');

    // -------------------------------------------------------------
    // 13. CSV Export
    // -------------------------------------------------------------
    console.log('\n--- 13. CSV Export ---');

    const csvExport = await request('GET', '/api/cash-management/transactions', undefined, adminAToken, {
      export: 'csv',
    });
    assert(csvExport.status === 200, 'GET /transactions?export=csv returns 200');
    assert(
      csvExport.headers.get('content-type')?.includes('text/csv') === true,
      'Content-Type is text/csv'
    );
    assert(
      csvExport.text.includes('Date') &&
      csvExport.text.includes('Opening Balance') &&
      csvExport.text.includes('Cash Revenue') &&
      csvExport.text.includes('Closing Balance'),
      'CSV contains required cash management column headers'
    );
    assert(
      csvExport.text.includes('kalyaninagar'),
      'CSV data rows contain store name'
    );

    console.log('\n================================================================');
    console.log(`   Cash Management Tests Complete: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    return { passed, failed };
  } finally {
    if (server) {
      server.close();
    }
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith('cash-management.test.ts')) {
  runCashManagementTests()
    .then(({ failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
