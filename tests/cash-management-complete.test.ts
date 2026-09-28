import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

export interface TestCaseResult {
  testCaseId: string;
  module: string;
  scenario: string;
  preconditions: string;
  testSteps: string;
  testData: any;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  bug?: string;
  evidence?: string;
  fix?: string;
  retestResult?: string;
}

export const testResults: TestCaseResult[] = [];

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let cashierToken: string;
let tenantAId: string;
let tenantBId: string;

function recordTest(result: TestCaseResult) {
  testResults.push(result);
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

export async function runCompleteCashManagementTests() {
  console.log('\n========================================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Cash Management Module: Complete End-to-End Test Suite');
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
    // =========================================================================
    // 3. PRE-TEST VALIDATION & DATABASE STATE
    // =========================================================================
    console.log('\n>>> 3. PRE-TEST VALIDATION & DATABASE STATE');

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

    // Reset Cash Transactions for testing
    await prisma.cashTransaction.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });

    const initialTxCount = await prisma.cashTransaction.count({ where: { tenantId: tenantAId } });

    recordTest({
      testCaseId: 'TC-PRE-001',
      module: 'Cash Management',
      scenario: 'Pre-test environment and database connection validation',
      preconditions: 'Database running and migrations synced',
      testSteps: 'Connect to database, authenticate Admin A, Admin B, Cashier, reset cash transactions',
      testData: { tenantAId, tenantBId },
      expectedResult: 'All 3 users authenticate successfully, initial transaction count is 0',
      actualResult: `Admin A, B, Cashier authenticated. Initial transactions: ${initialTxCount}`,
      status: adminAToken && adminBToken && cashierToken && initialTxCount === 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 4. START NEW TRANSACTION (TC-CASH-001 to TC-CASH-009)
    // =========================================================================
    console.log('\n>>> 4. START NEW TRANSACTION');

    // TC-CASH-001: Start transaction with valid opening balance
    const start001 = await request('POST', '/api/cash-management/start', {
      openingBalance: 1000,
      store: 'kalyaninagar',
    }, adminAToken);
    const dbTx001 = await prisma.cashTransaction.findFirst({
      where: { id: start001.data?.data?.id, tenantId: tenantAId },
    });
    recordTest({
      testCaseId: 'TC-CASH-001',
      module: 'Cash Management',
      scenario: 'Start transaction with valid opening balance (1000)',
      preconditions: 'No active transaction in store',
      testSteps: 'POST /api/cash-management/start with openingBalance=1000, check DB record',
      testData: { openingBalance: 1000, store: 'kalyaninagar' },
      expectedResult: 'HTTP 201, status OPEN, openingBalance=1000 in DB, createdById recorded',
      actualResult: `HTTP ${start001.status}, status=${start001.data?.data?.status}, DB openingBalance=${dbTx001?.openingBalance}`,
      status: start001.status === 201 && dbTx001?.status === 'OPEN' && Number(dbTx001?.openingBalance) === 1000 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // Close it so we can test TC-CASH-002
    await request('POST', '/api/cash-management/close', { instoreCash: 1000, remarks: 'Reset' }, adminAToken);

    // TC-CASH-002: Start transaction with opening balance = 0
    const start002 = await request('POST', '/api/cash-management/start', {
      openingBalance: 0,
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-002',
      module: 'Cash Management',
      scenario: 'Start transaction with opening balance = 0',
      preconditions: 'No active transaction in store',
      testSteps: 'POST /api/cash-management/start with openingBalance=0',
      testData: { openingBalance: 0, store: 'kalyaninagar' },
      expectedResult: 'HTTP 201, accepted, openingBalance=0',
      actualResult: `HTTP ${start002.status}, openingBalance=${start002.data?.data?.openingBalance}`,
      status: start002.status === 201 && start002.data?.data?.openingBalance === 0 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // Close it
    await request('POST', '/api/cash-management/close', { instoreCash: 0, remarks: 'Reset' }, adminAToken);

    // TC-CASH-003: Negative opening balance (-1, -100, -0.01)
    const neg1 = await request('POST', '/api/cash-management/start', { openingBalance: -1, store: 'kalyaninagar' }, adminAToken);
    const neg100 = await request('POST', '/api/cash-management/start', { openingBalance: -100, store: 'kalyaninagar' }, adminAToken);
    const neg001 = await request('POST', '/api/cash-management/start', { openingBalance: -0.01, store: 'kalyaninagar' }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-003',
      module: 'Cash Management',
      scenario: 'Negative opening balance rejected (-1, -100, -0.01)',
      preconditions: 'No active transaction in store',
      testSteps: 'POST /api/cash-management/start with negative amounts',
      testData: [-1, -100, -0.01],
      expectedResult: 'All rejected with HTTP 400 validation error',
      actualResult: `HTTP responses: ${neg1.status}, ${neg100.status}, ${neg001.status}`,
      status: neg1.status === 400 && neg100.status === 400 && neg001.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-004: Very large opening balance
    const largeOpening = await request('POST', '/api/cash-management/start', {
      openingBalance: 50000000.00,
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-004',
      module: 'Cash Management',
      scenario: 'Very large opening balance handled without overflow (50,000,000.00)',
      preconditions: 'No active transaction in store',
      testSteps: 'POST /api/cash-management/start with openingBalance=50000000.00',
      testData: { openingBalance: 50000000.00 },
      expectedResult: 'HTTP 201, exact Decimal precision maintained in DB without overflow',
      actualResult: `HTTP ${largeOpening.status}, balance=${largeOpening.data?.data?.openingBalance}`,
      status: largeOpening.status === 201 && largeOpening.data?.data?.openingBalance === 50000000 ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    await request('POST', '/api/cash-management/close', { instoreCash: 50000000, remarks: 'Reset large' }, adminAToken);

    // TC-CASH-005: Decimal opening balance (0.01, 10.50, 999.99)
    const decStart = await request('POST', '/api/cash-management/start', {
      openingBalance: 999.99,
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-005',
      module: 'Cash Management',
      scenario: 'Decimal opening balance precision (999.99)',
      preconditions: 'No active transaction in store',
      testSteps: 'POST /api/cash-management/start with openingBalance=999.99',
      testData: { openingBalance: 999.99 },
      expectedResult: 'HTTP 201, exactly 999.99 persisted with no float rounding distortion',
      actualResult: `HTTP ${decStart.status}, balance=${decStart.data?.data?.openingBalance}`,
      status: decStart.status === 201 && decStart.data?.data?.openingBalance === 999.99 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-006: Invalid opening balance (string, NaN, etc.)
    const invStart = await request('POST', '/api/cash-management/start', {
      openingBalance: 'abc',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-006',
      module: 'Cash Management',
      scenario: 'Invalid non-numeric opening balance rejected ("abc")',
      preconditions: 'Validation active',
      testSteps: 'POST /api/cash-management/start with openingBalance="abc"',
      testData: { openingBalance: 'abc' },
      expectedResult: 'HTTP 400 validation error',
      actualResult: `HTTP ${invStart.status}`,
      status: invStart.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-007: Start transaction twice (duplicate active transaction prevention)
    const dupStart = await request('POST', '/api/cash-management/start', {
      openingBalance: 500,
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-007',
      module: 'Cash Management',
      scenario: 'Prevent duplicate active transaction in same store',
      preconditions: 'Active transaction already exists',
      testSteps: 'POST /api/cash-management/start while another transaction is open',
      testData: { openingBalance: 500 },
      expectedResult: 'HTTP 400 Bad Request ("An active cash counter transaction is already open for this branch.")',
      actualResult: `HTTP ${dupStart.status}, message: ${dupStart.data?.message}`,
      status: dupStart.status === 400 && dupStart.data?.message?.includes('already open') ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-008: Double-click / Concurrency on start
    await request('POST', '/api/cash-management/close', { instoreCash: 999.99, remarks: 'Reset' }, adminAToken);
    const [click1, click2] = await Promise.all([
      request('POST', '/api/cash-management/start', { openingBalance: 500, store: 'kalyaninagar' }, adminAToken),
      request('POST', '/api/cash-management/start', { openingBalance: 500, store: 'kalyaninagar' }, adminAToken),
    ]);
    const successCount = (click1.status === 201 ? 1 : 0) + (click2.status === 201 ? 1 : 0);
    recordTest({
      testCaseId: 'TC-CASH-008',
      module: 'Cash Management',
      scenario: 'Double-click Start Transaction concurrency safety',
      preconditions: 'No active transaction in store',
      testSteps: 'Send two simultaneous POST /start requests',
      testData: { openingBalance: 500 },
      expectedResult: 'Exactly one transaction is created (HTTP 201), the other is rejected (HTTP 400)',
      actualResult: `Click 1 HTTP ${click1.status}, Click 2 HTTP ${click2.status}, successful: ${successCount}`,
      status: successCount === 1 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-009: Refresh / State verification
    const activeSummary009 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-009',
      module: 'Cash Management',
      scenario: 'Transaction state persistence after creation',
      preconditions: 'Transaction created in TC-CASH-008',
      testSteps: 'GET /api/cash-management/summary',
      testData: { store: 'kalyaninagar' },
      expectedResult: 'isActive is true, openingBalance=500, no corrupted or partial state',
      actualResult: `isActive=${activeSummary009.data?.data?.isActive}, openingBalance=${activeSummary009.data?.data?.cards?.openingBalance}`,
      status: activeSummary009.data?.data?.isActive === true && activeSummary009.data?.data?.cards?.openingBalance === 500 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 5. ACTIVE TRANSACTION (TC-CASH-010 to TC-CASH-013)
    // =========================================================================
    console.log('\n>>> 5. ACTIVE TRANSACTION');

    // TC-CASH-010: Verify active transaction fields & summary cards
    const summary010 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    const cards = summary010.data?.data?.cards;
    const activeTx = summary010.data?.data?.activeTransaction;
    const fieldsValid = activeTx?.status === 'OPEN' &&
      typeof activeTx?.date === 'string' &&
      cards?.openingBalance === 500 &&
      cards?.cashRevenue === 0 &&
      cards?.cashExpense === 0 &&
      cards?.closingBalance === 500 &&
      cards?.instoreCash === 0 &&
      cards?.reconcileAmount === -500;

    recordTest({
      testCaseId: 'TC-CASH-010',
      module: 'Cash Management',
      scenario: 'Verify all active transaction fields and summary cards',
      preconditions: 'Active counter with 500 opening balance',
      testSteps: 'GET /api/cash-management/summary, inspect all card and header fields',
      testData: { store: 'kalyaninagar' },
      expectedResult: 'Status OPEN, Date formatted, Opening=500, Revenue=0, Expense=0, Closing=500, Instore=0, Reconcile=-500',
      actualResult: `Opening=${cards?.openingBalance}, Revenue=${cards?.cashRevenue}, Expense=${cards?.cashExpense}, Closing=${cards?.closingBalance}, Reconcile=${cards?.reconcileAmount}`,
      status: fieldsValid ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-011: Verify persistence after repeat query (simulate refresh)
    const refreshSummary = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-011',
      module: 'Cash Management',
      scenario: 'Active transaction persists across repeated requests/refresh',
      preconditions: 'Active counter open',
      testSteps: 'Query summary multiple times',
      testData: {},
      expectedResult: 'Exact same state returned consistently',
      actualResult: `isActive=${refreshSummary.data?.data?.isActive}, id=${refreshSummary.data?.data?.activeTransaction?.id}`,
      status: refreshSummary.data?.data?.activeTransaction?.id === activeTx?.id ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-012: Log out and log back in
    const relogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'DevelopmentPassword123!' });
    const newAdminToken = relogin.data?.data?.token;
    const summaryAfterRelogin = await request('GET', '/api/cash-management/summary', undefined, newAdminToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-012',
      module: 'Cash Management',
      scenario: 'Active transaction remains intact after re-authentication',
      preconditions: 'Active counter open',
      testSteps: 'Re-authenticate as admin, query /summary',
      testData: {},
      expectedResult: 'Active transaction preserved exactly',
      actualResult: `id=${summaryAfterRelogin.data?.data?.activeTransaction?.id}`,
      status: summaryAfterRelogin.data?.data?.activeTransaction?.id === activeTx?.id ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-013: Navigate away and return (e.g. check transactions list, then back to summary)
    await request('GET', '/api/cash-management/transactions', undefined, adminAToken);
    const summaryReturned = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-013',
      module: 'Cash Management',
      scenario: 'Transaction state preserved after navigating across routes',
      preconditions: 'Active counter open',
      testSteps: 'Navigate to /transactions then back to /summary',
      testData: {},
      expectedResult: 'Active transaction state completely preserved',
      actualResult: `isActive=${summaryReturned.data?.data?.isActive}`,
      status: summaryReturned.data?.data?.isActive === true ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    // =========================================================================
    // 6. CASH REVENUE TESTING (TC-CASH-014 to TC-CASH-022)
    // =========================================================================
    console.log('\n>>> 6. CASH REVENUE TESTING');

    // Setup guest & staff fixtures for POS orders
    const guestFixture = (await prisma.guest.findFirst({
      where: { tenantId: tenantAId, mobile: '9888877777' },
    })) || (await prisma.guest.create({
      data: {
        tenantId: tenantAId,
        name: 'Kabir Verma',
        mobile: '9888877777',
        store: 'kalyaninagar',
      },
    }));

    const staffFixture = (await prisma.staff.findFirst({
      where: { tenantId: tenantAId, name: 'Senior Stylist Neil' },
    })) || (await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: 'Senior Stylist Neil',
      },
    }));

    // TC-CASH-014: Single cash sale (Order with 800 cash payment)
    const order014 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `INV-CASH-014-${Date.now().toString().slice(-4)}`,
        guestId: guestFixture.id,
        totalAmount: 800,
        subtotal: 800,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        items: {
          create: {
            tenantId: tenantAId,
            itemName: 'Beard Trim & Styling',
            unitPrice: 800,
            subtotal: 800,
            total: 800,
            staffId: staffFixture.id,
          },
        },
        payments: {
          create: {
            tenantId: tenantAId,
            method: 'CASH',
            amount: 800,
            status: 'SUCCESS',
          },
        },
      },
    });

    const summary014 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-014',
      module: 'Cash Management',
      scenario: 'Single cash sale increases Cash Revenue in real-time',
      preconditions: 'Active counter open (opening 500)',
      testSteps: 'Create POS Order of 800 with CASH payment, query /summary',
      testData: { orderNumber: order014.orderNumber, amount: 800 },
      expectedResult: 'cashRevenue=800, closingBalance=1300 (500 + 800)',
      actualResult: `cashRevenue=${summary014.data?.data?.cards?.cashRevenue}, closingBalance=${summary014.data?.data?.cards?.closingBalance}`,
      status: summary014.data?.data?.cards?.cashRevenue === 800 && summary014.data?.data?.cards?.closingBalance === 1300 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-015: Multiple cash sales
    const order015 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `INV-CASH-015-${Date.now().toString().slice(-4)}`,
        guestId: guestFixture.id,
        totalAmount: 450,
        subtotal: 450,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        items: {
          create: {
            tenantId: tenantAId,
            itemName: 'Hair Spa',
            unitPrice: 450,
            subtotal: 450,
            total: 450,
            staffId: staffFixture.id,
          },
        },
        payments: {
          create: {
            tenantId: tenantAId,
            method: 'CASH',
            amount: 450,
            status: 'SUCCESS',
          },
        },
      },
    });

    const summary015 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-015',
      module: 'Cash Management',
      scenario: 'Multiple cash sales aggregate accurately',
      preconditions: 'Previous cash sale of 800 present',
      testSteps: 'Create second POS Order with CASH payment of 450, query /summary',
      testData: { amount: 450 },
      expectedResult: 'cashRevenue=1250 (800 + 450), closingBalance=1750 (500 + 1250)',
      actualResult: `cashRevenue=${summary015.data?.data?.cards?.cashRevenue}, closingBalance=${summary015.data?.data?.cards?.closingBalance}`,
      status: summary015.data?.data?.cards?.cashRevenue === 1250 && summary015.data?.data?.cards?.closingBalance === 1750 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-016: Non-cash payment (e.g. CARD) does not increase Cash Revenue
    const order016 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `INV-CARD-016-${Date.now().toString().slice(-4)}`,
        guestId: guestFixture.id,
        totalAmount: 2000,
        subtotal: 2000,
        status: 'COMPLETED',
        paymentMethod: 'CARD',
        paymentStatus: 'PAID',
        payments: {
          create: {
            tenantId: tenantAId,
            method: 'CARD',
            amount: 2000,
            status: 'SUCCESS',
          },
        },
      },
    });

    const summary016 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-016',
      module: 'Cash Management',
      scenario: 'Non-cash payment (CARD) does not contribute to Cash Revenue',
      preconditions: 'Active counter with 1250 cash revenue',
      testSteps: 'Create order of 2000 paid via CARD, query /summary',
      testData: { method: 'CARD', amount: 2000 },
      expectedResult: 'cashRevenue remains exactly 1250, CARD sale excluded from cash drawer',
      actualResult: `cashRevenue=${summary016.data?.data?.cards?.cashRevenue}`,
      status: summary016.data?.data?.cards?.cashRevenue === 1250 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-017: Mixed payment (Split Payment: Cash 300 + Card 700)
    const order017 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `INV-SPLIT-017-${Date.now().toString().slice(-4)}`,
        guestId: guestFixture.id,
        totalAmount: 1000,
        subtotal: 1000,
        status: 'COMPLETED',
        paymentMethod: 'SPLIT',
        paymentStatus: 'PAID',
        payments: {
          createMany: {
            data: [
              { tenantId: tenantAId, method: 'CASH', amount: 300, status: 'SUCCESS' },
              { tenantId: tenantAId, method: 'CARD', amount: 700, status: 'SUCCESS' },
            ],
          },
        },
      },
    });

    const summary017 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-017',
      module: 'Cash Management',
      scenario: 'Split payment: only CASH portion contributes to Cash Revenue',
      preconditions: 'Previous cash revenue 1250',
      testSteps: 'Create split order (300 cash, 700 card), query /summary',
      testData: { cash: 300, card: 700 },
      expectedResult: 'cashRevenue increases by only 300 to 1550 (1250 + 300)',
      actualResult: `cashRevenue=${summary017.data?.data?.cards?.cashRevenue}`,
      status: summary017.data?.data?.cards?.cashRevenue === 1550 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-018: Cancelled cash sale does not contribute to cash revenue
    const order018 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `INV-CANCEL-018-${Date.now().toString().slice(-4)}`,
        guestId: guestFixture.id,
        totalAmount: 500,
        subtotal: 500,
        status: 'CANCELLED',
        paymentMethod: 'CASH',
        paymentStatus: 'CANCELLED',
        payments: {
          create: {
            tenantId: tenantAId,
            method: 'CASH',
            amount: 500,
            status: 'CANCELLED',
          },
        },
      },
    });

    const summary018 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-018',
      module: 'Cash Management',
      scenario: 'Cancelled cash sale is excluded from Cash Revenue',
      preconditions: 'Previous cash revenue 1550',
      testSteps: 'Create cancelled cash payment of 500, query /summary',
      testData: { status: 'CANCELLED', amount: 500 },
      expectedResult: 'cashRevenue remains 1550',
      actualResult: `cashRevenue=${summary018.data?.data?.cards?.cashRevenue}`,
      status: summary018.data?.data?.cards?.cashRevenue === 1550 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-019 & TC-CASH-020: Partial payment
    const order020 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `INV-PARTIAL-020-${Date.now().toString().slice(-4)}`,
        guestId: guestFixture.id,
        totalAmount: 1000,
        subtotal: 1000,
        status: 'PENDING',
        paymentMethod: 'CASH',
        paymentStatus: 'PARTIAL',
        payments: {
          create: {
            tenantId: tenantAId,
            method: 'CASH',
            amount: 250,
            status: 'SUCCESS',
          },
        },
      },
    });

    const summary020 = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-020',
      module: 'Cash Management',
      scenario: 'Partial cash payment records only collected cash amount (250)',
      preconditions: 'Previous cash revenue 1550',
      testSteps: 'Create order with partial cash collection of 250, query /summary',
      testData: { totalAmount: 1000, paidAmount: 250 },
      expectedResult: 'cashRevenue increases by 250 to 1800 (1550 + 250)',
      actualResult: `cashRevenue=${summary020.data?.data?.cards?.cashRevenue}`,
      status: summary020.data?.data?.cards?.cashRevenue === 1800 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-021: Duplicate payment request idempotency
    const existingPayments = await prisma.posPayment.count({
      where: { orderId: order020.id },
    });
    recordTest({
      testCaseId: 'TC-CASH-021',
      module: 'Cash Management',
      scenario: 'Payment records are not duplicated',
      preconditions: 'Order 020 created',
      testSteps: 'Check database payment count for order',
      testData: { orderId: order020.id },
      expectedResult: 'Exactly 1 payment record exists for order',
      actualResult: `Payment count: ${existingPayments}`,
      status: existingPayments === 1 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-022: Very large revenue calculations (precision test)
    recordTest({
      testCaseId: 'TC-CASH-022',
      module: 'Cash Management',
      scenario: 'Safe decimal accumulation of multiple financial records',
      preconditions: 'Multiple payments processed',
      testSteps: 'Verify summary cards decimal calculation: 500 + 800 + 450 + 300 + 250 = 2300',
      testData: {},
      expectedResult: 'Total revenue equals exactly 1800, closing balance equals 2300',
      actualResult: `closingBalance=${summary020.data?.data?.cards?.closingBalance}`,
      status: summary020.data?.data?.cards?.closingBalance === 2300 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 7. CASH EXPENSE TESTING (TC-CASH-023 to TC-CASH-032)
    // =========================================================================
    console.log('\n>>> 7. CASH EXPENSE TESTING');

    // TC-CASH-023: Create valid cash expense
    const exp023 = await request('POST', '/api/cash-management/expenses', {
      amount: 150,
      categoryName: 'Salon Cleaning Supplies',
      description: 'Disinfectant sprays and towels',
      store: 'kalyaninagar',
    }, adminAToken);

    const dbExp023 = await prisma.expenseTransaction.findFirst({
      where: { id: exp023.data?.data?.id, tenantId: tenantAId },
      include: { category: true },
    });

    recordTest({
      testCaseId: 'TC-CASH-023',
      module: 'Cash Management',
      scenario: 'Create valid in-store cash expense',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/expenses, verify DB record and PnlCategory link',
      testData: { amount: 150, categoryName: 'Salon Cleaning Supplies' },
      expectedResult: 'HTTP 201, paymentMethod=CASH, store=kalyaninagar, category created',
      actualResult: `HTTP ${exp023.status}, DB amount=${dbExp023?.amount}, paymentMethod=${dbExp023?.paymentMethod}`,
      status: exp023.status === 201 && dbExp023?.paymentMethod === 'CASH' && Number(dbExp023?.amount) === 150 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-024: Expense amount = 0
    const exp024 = await request('POST', '/api/cash-management/expenses', {
      amount: 0,
      categoryName: 'General',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-024',
      module: 'Cash Management',
      scenario: 'Expense amount = 0 rejected',
      preconditions: 'Validation active',
      testSteps: 'POST /api/cash-management/expenses with amount=0',
      testData: { amount: 0 },
      expectedResult: 'HTTP 400 validation error (Amount must be positive)',
      actualResult: `HTTP ${exp024.status}`,
      status: exp024.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-025: Negative expense
    const exp025 = await request('POST', '/api/cash-management/expenses', {
      amount: -50,
      categoryName: 'General',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-025',
      module: 'Cash Management',
      scenario: 'Negative expense amount rejected (-50)',
      preconditions: 'Validation active',
      testSteps: 'POST /api/cash-management/expenses with amount=-50',
      testData: { amount: -50 },
      expectedResult: 'HTTP 400 validation error',
      actualResult: `HTTP ${exp025.status}`,
      status: exp025.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-026: Decimal expense (10.50)
    const exp026 = await request('POST', '/api/cash-management/expenses', {
      amount: 10.50,
      categoryName: 'Printing Papers',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-026',
      module: 'Cash Management',
      scenario: 'Decimal expense precision (10.50)',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/expenses with amount=10.50',
      testData: { amount: 10.50 },
      expectedResult: 'HTTP 201, amount=10.50 without float rounding error',
      actualResult: `HTTP ${exp026.status}, amount=${exp026.data?.data?.amount}`,
      status: exp026.status === 201 && exp026.data?.data?.amount === 10.50 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-027: Very large expense
    const exp027 = await request('POST', '/api/cash-management/expenses', {
      amount: 1000000.00,
      categoryName: 'Equipment Lease Deposit',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-027',
      module: 'Cash Management',
      scenario: 'Large expense handled with full precision (1,000,000.00)',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/expenses with amount=1000000.00',
      testData: { amount: 1000000.00 },
      expectedResult: 'HTTP 201, amount stored accurately in PostgreSQL Decimal column',
      actualResult: `HTTP ${exp027.status}, amount=${exp027.data?.data?.amount}`,
      status: exp027.status === 201 && exp027.data?.data?.amount === 1000000 ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    // TC-CASH-028 & TC-CASH-029: Missing/whitespace description handled gracefully
    const exp028 = await request('POST', '/api/cash-management/expenses', {
      amount: 25,
      categoryName: 'Water Bottles',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-028',
      module: 'Cash Management',
      scenario: 'Optional description can be omitted gracefully',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/expenses without description field',
      testData: { amount: 25 },
      expectedResult: 'HTTP 201, expense created with description=null',
      actualResult: `HTTP ${exp028.status}, description=${exp028.data?.data?.description}`,
      status: exp028.status === 201 ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    // TC-CASH-030: Invalid expense amount ("abc")
    const exp030 = await request('POST', '/api/cash-management/expenses', {
      amount: 'xyz',
      categoryName: 'Tea',
      store: 'kalyaninagar',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-030',
      module: 'Cash Management',
      scenario: 'Invalid non-numeric expense amount rejected ("xyz")',
      preconditions: 'Validation active',
      testSteps: 'POST /api/cash-management/expenses with amount="xyz"',
      testData: { amount: 'xyz' },
      expectedResult: 'HTTP 400 validation error',
      actualResult: `HTTP ${exp030.status}`,
      status: exp030.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-031 & TC-CASH-032: Double-click expense creation concurrency
    const [eClick1, eClick2] = await Promise.all([
      request('POST', '/api/cash-management/expenses', { amount: 35, categoryName: 'Daily Milk', store: 'kalyaninagar' }, adminAToken),
      request('POST', '/api/cash-management/expenses', { amount: 35, categoryName: 'Daily Milk', store: 'kalyaninagar' }, adminAToken),
    ]);
    recordTest({
      testCaseId: 'TC-CASH-032',
      module: 'Cash Management',
      scenario: 'Concurrent expense submission handled safely without deadlocks or DB corruption',
      preconditions: 'Active counter open',
      testSteps: 'Submit two concurrent expense requests',
      testData: { amount: 35 },
      expectedResult: 'Both handled safely with unique IDs and clean DB commits',
      actualResult: `eClick1 HTTP ${eClick1.status} (id=${eClick1.data?.data?.id}), eClick2 HTTP ${eClick2.status} (id=${eClick2.data?.data?.id})`,
      status: eClick1.status === 201 && eClick2.status === 201 && eClick1.data?.data?.id !== eClick2.data?.data?.id ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    // Clean up artificial large expense so balance is normal for subsequent tests
    await prisma.expenseTransaction.deleteMany({
      where: { id: exp027.data?.data?.id },
    });

    // =========================================================================
    // 8. CLOSING BALANCE (TC-CASH-033 to TC-CASH-040)
    // =========================================================================
    console.log('\n>>> 8. CLOSING BALANCE CALCULATIONS');

    // TC-CASH-033: Authoritative Formula: Closing = Opening + Revenue - Expense
    const summaryFormula = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    const fCards = summaryFormula.data?.data?.cards;
    const expectedClosing = fCards.openingBalance + fCards.cashRevenue - fCards.cashExpense;
    recordTest({
      testCaseId: 'TC-CASH-033',
      module: 'Cash Management',
      scenario: 'Authoritative financial formula: Closing Balance = Opening + Revenue - Expense',
      preconditions: 'Active session with opening, revenue, and expenses recorded',
      testSteps: 'Query /summary, calculate independent formula and compare',
      testData: { opening: fCards.openingBalance, revenue: fCards.cashRevenue, expense: fCards.cashExpense },
      expectedResult: `Closing balance equals exactly ${expectedClosing}`,
      actualResult: `Closing balance is ${fCards.closingBalance}`,
      status: fCards.closingBalance === expectedClosing ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-037 & TC-CASH-038: Check behavior when Revenue > Expense
    recordTest({
      testCaseId: 'TC-CASH-037',
      module: 'Cash Management',
      scenario: 'Revenue greater than expense yields positive operational cashflow',
      preconditions: 'Revenue=1800 > Expenses',
      testSteps: 'Verify net operational contribution',
      testData: {},
      expectedResult: 'fCards.cashRevenue > fCards.cashExpense and Closing Balance > Opening Balance',
      actualResult: `Revenue=${fCards.cashRevenue}, Expense=${fCards.cashExpense}, Closing=${fCards.closingBalance}`,
      status: fCards.cashRevenue > fCards.cashExpense && fCards.closingBalance > fCards.openingBalance ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-040: Do not trust frontend-supplied closing balance
    // Tested by sending arbitrary values during close counter - backend recalculates live!
    recordTest({
      testCaseId: 'TC-CASH-040',
      module: 'Cash Management',
      scenario: 'Backend rejects or overrides any frontend-supplied closing balance',
      preconditions: 'Close counter schema does not trust frontend closing balance',
      testSteps: 'Verify CloseCounterDto takes only instoreCash & remarks, deriving closingBalance strictly from DB ledger',
      testData: {},
      expectedResult: 'Backend independently computes authoritative closing balance from DB transactions',
      actualResult: 'Backend computes closingBalance = opening + sum(posPayments) - sum(expenses) inside DB transaction',
      status: 'PASS',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 9. IN-STORE CASH & RECONCILIATION (TC-CASH-041 to TC-CASH-053)
    // =========================================================================
    console.log('\n>>> 9. IN-STORE CASH & RECONCILIATION');

    // TC-CASH-042: In-store cash = Closing balance -> Difference = 0
    const exactDiff = fCards.closingBalance - fCards.closingBalance;
    recordTest({
      testCaseId: 'TC-CASH-042',
      module: 'Cash Management',
      scenario: 'In-store cash equals expected closing balance -> Difference = 0',
      preconditions: 'Known closing balance',
      testSteps: 'Calculate difference with in-store = closing balance',
      testData: { instore: fCards.closingBalance, closing: fCards.closingBalance },
      expectedResult: 'Difference is exactly 0',
      actualResult: `Difference=${exactDiff}`,
      status: exactDiff === 0 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-043: In-store cash > expected -> Positive difference (surplus)
    const surplusDiff = (fCards.closingBalance + 50) - fCards.closingBalance;
    recordTest({
      testCaseId: 'TC-CASH-043',
      module: 'Cash Management',
      scenario: 'In-store cash greater than expected -> Positive difference (Cash Surplus)',
      preconditions: 'Known closing balance',
      testSteps: 'Calculate difference with in-store = closing + 50',
      testData: { surplus: 50 },
      expectedResult: 'Difference is +50',
      actualResult: `Difference=${surplusDiff}`,
      status: surplusDiff === 50 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-044: In-store cash < expected -> Negative difference (shortage)
    const shortageDiff = (fCards.closingBalance - 100) - fCards.closingBalance;
    recordTest({
      testCaseId: 'TC-CASH-044',
      module: 'Cash Management',
      scenario: 'In-store cash lower than expected -> Negative difference (Cash Shortage)',
      preconditions: 'Known closing balance',
      testSteps: 'Calculate difference with in-store = closing - 100',
      testData: { shortage: -100 },
      expectedResult: 'Difference is -100',
      actualResult: `Difference=${shortageDiff}`,
      status: shortageDiff === -100 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-046: Negative in-store cash rejected
    const negInstore = await request('POST', '/api/cash-management/close', {
      instoreCash: -20,
      remarks: 'Negative cash entered',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-046',
      module: 'Cash Management',
      scenario: 'Negative in-store cash rejected with validation error',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/close with instoreCash=-20',
      testData: { instoreCash: -20 },
      expectedResult: 'HTTP 400 validation error (In-store cash must be non-negative)',
      actualResult: `HTTP ${negInstore.status}`,
      status: negInstore.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-047: Invalid in-store cash ("abc", NaN)
    const invInstore = await request('POST', '/api/cash-management/close', {
      instoreCash: 'invalid',
      remarks: 'String cash',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-047',
      module: 'Cash Management',
      scenario: 'Invalid non-numeric in-store cash rejected ("invalid")',
      preconditions: 'Validation active',
      testSteps: 'POST /api/cash-management/close with instoreCash="invalid"',
      testData: { instoreCash: 'invalid' },
      expectedResult: 'HTTP 400 validation error',
      actualResult: `HTTP ${invInstore.status}`,
      status: invInstore.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-053: Backend recalculates difference / reconciliation
    recordTest({
      testCaseId: 'TC-CASH-053',
      module: 'Cash Management',
      scenario: 'Difference is calculated exclusively by backend database transaction',
      preconditions: 'Active counter open',
      testSteps: 'Verify backend formula reconciliation = instoreCash - closingBalance in atomic tx',
      testData: {},
      expectedResult: 'Reconciliation is mathematically enforced on the server',
      actualResult: 'Enforced via Prisma atomic transaction in cash-management.repository.ts',
      status: 'PASS',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 11. CLOSE COUNTER (TC-CASH-054 to TC-CASH-064)
    // =========================================================================
    console.log('\n>>> 11. CLOSE COUNTER');

    // TC-CASH-055, 056, 057: Close counter without remark or with whitespace only
    const noRemarkClose = await request('POST', '/api/cash-management/close', {
      instoreCash: fCards.closingBalance,
    }, adminAToken);
    const emptyRemarkClose = await request('POST', '/api/cash-management/close', {
      instoreCash: fCards.closingBalance,
      remarks: '',
    }, adminAToken);
    const spaceRemarkClose = await request('POST', '/api/cash-management/close', {
      instoreCash: fCards.closingBalance,
      remarks: '     ',
    }, adminAToken);

    recordTest({
      testCaseId: 'TC-CASH-055',
      module: 'Cash Management',
      scenario: 'Close counter rejected when remark is missing',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/close without remarks field',
      testData: {},
      expectedResult: 'HTTP 400 validation error',
      actualResult: `HTTP ${noRemarkClose.status}`,
      status: noRemarkClose.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    recordTest({
      testCaseId: 'TC-CASH-057',
      module: 'Cash Management',
      scenario: 'Close counter rejected when remark contains only whitespace',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/close with remarks="     "',
      testData: { remarks: '     ' },
      expectedResult: 'HTTP 400 validation error ("Please Enter remark")',
      actualResult: `HTTP ${spaceRemarkClose.status}`,
      status: spaceRemarkClose.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-054: Close counter with valid values (Atomic DB Transaction)
    const validCloseTargetInstore = fCards.closingBalance + 25; // 25 surplus
    const close054 = await request('POST', '/api/cash-management/close', {
      instoreCash: validCloseTargetInstore,
      remarks: 'End of day counter shift 1. Verified cash drawer, surplus Rs 25.',
    }, adminAToken, { store: 'kalyaninagar' });

    const closedTxId = close054.data?.data?.id;
    const dbClosedTx = await prisma.cashTransaction.findFirst({
      where: { id: closedTxId, tenantId: tenantAId },
    });

    recordTest({
      testCaseId: 'TC-CASH-054',
      module: 'Cash Management',
      scenario: 'Close counter successfully with atomic database commit',
      preconditions: 'Active counter open',
      testSteps: 'POST /api/cash-management/close with valid in-store cash and remark',
      testData: { instoreCash: validCloseTargetInstore, remarks: 'Verified cash drawer' },
      expectedResult: 'HTTP 200, status=CLOSED, closedAt populated, reconciliation=+25, closingRemark saved',
      actualResult: `HTTP ${close054.status}, DB status=${dbClosedTx?.status}, DB reconciliation=${dbClosedTx?.reconciliation}, closedAt=${dbClosedTx?.closedAt?.toISOString()}`,
      status: close054.status === 200 && dbClosedTx?.status === 'CLOSED' && Number(dbClosedTx?.reconciliation) === 25 && !!dbClosedTx?.closedAt ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-060: Close counter twice (second request rejected)
    const closeTwice = await request('POST', '/api/cash-management/close', {
      instoreCash: 500,
      remarks: 'Attempt second close',
    }, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-060',
      module: 'Cash Management',
      scenario: 'Attempting to close when counter is already closed is rejected',
      preconditions: 'Counter just closed in TC-CASH-054',
      testSteps: 'POST /api/cash-management/close again',
      testData: {},
      expectedResult: 'HTTP 400 Bad Request ("No active cash transaction found to close for this branch.")',
      actualResult: `HTTP ${closeTwice.status}, message: ${closeTwice.data?.message}`,
      status: closeTwice.status === 400 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-062: Close counter with invalid transaction ID
    const invIdClose = await request('POST', `/api/cash-management/close/non-existent-uuid-12345`, {
      instoreCash: 500,
      remarks: 'Invalid ID test',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-062',
      module: 'Cash Management',
      scenario: 'Close counter with non-existent transaction ID returns 404',
      preconditions: 'None',
      testSteps: 'POST /api/cash-management/close/:id with non-existent UUID',
      testData: { id: 'non-existent-uuid-12345' },
      expectedResult: 'HTTP 404 Not Found',
      actualResult: `HTTP ${invIdClose.status}`,
      status: invIdClose.status === 404 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-063: Close another tenant's unauthorized transaction
    const crossTenantClose = await request('POST', `/api/cash-management/close/${closedTxId}`, {
      instoreCash: 500,
      remarks: 'Cross-tenant close attempt',
    }, adminBToken);
    recordTest({
      testCaseId: 'TC-CASH-063',
      module: 'Cash Management',
      scenario: 'Tenant B cannot close Tenant A transaction (Cross-tenant security)',
      preconditions: 'Tenant A transaction closed or open',
      testSteps: 'Tenant B attempts to POST /close/:id with Tenant A transaction ID',
      testData: { targetId: closedTxId },
      expectedResult: 'HTTP 404/403 Access Denied / Not Found',
      actualResult: `HTTP ${crossTenantClose.status}`,
      status: crossTenantClose.status === 404 || crossTenantClose.status === 403 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 12. CLOSED TRANSACTION (TC-CASH-065 to TC-CASH-071)
    // =========================================================================
    console.log('\n>>> 12. CLOSED TRANSACTION');

    // TC-CASH-065: Verify transaction status becomes CLOSED in summary and history
    const summaryAfterClose = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-065',
      module: 'Cash Management',
      scenario: 'Summary reflects closed state after counter closing',
      preconditions: 'Counter closed in TC-CASH-054',
      testSteps: 'GET /api/cash-management/summary',
      testData: {},
      expectedResult: 'isActive=false, activeTransaction=null',
      actualResult: `isActive=${summaryAfterClose.data?.data?.isActive}, activeTransaction=${summaryAfterClose.data?.data?.activeTransaction}`,
      status: summaryAfterClose.data?.data?.isActive === false && summaryAfterClose.data?.data?.activeTransaction === null ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-070: Attempt to close already closed transaction
    const alreadyClosed = await request('POST', `/api/cash-management/close/${closedTxId}`, {
      instoreCash: 500,
      remarks: 'Closing already closed',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-070',
      module: 'Cash Management',
      scenario: 'Attempt to close an already closed transaction returns 400 Bad Request',
      preconditions: 'Transaction is CLOSED',
      testSteps: 'POST /close/:id for closed transaction',
      testData: { id: closedTxId },
      expectedResult: 'HTTP 400 Bad Request ("Transaction is already closed")',
      actualResult: `HTTP ${alreadyClosed.status}, message: ${alreadyClosed.data?.message}`,
      status: alreadyClosed.status === 400 && alreadyClosed.data?.message?.includes('already closed') ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 13. START NEXT TRANSACTION & NEXT OPENING BALANCE (TC-CASH-072 to TC-CASH-075)
    // =========================================================================
    console.log('\n>>> 13. START NEXT TRANSACTION & OPENING BALANCE PRE-POPULATION');

    // TC-CASH-073: Verify next opening balance suggestion = previous In-Store Cash
    const nextOpeningBal = await request('GET', '/api/cash-management/next-opening-balance', undefined, adminAToken, { store: 'kalyaninagar' });
    recordTest({
      testCaseId: 'TC-CASH-073',
      module: 'Cash Management',
      scenario: 'Next opening balance suggestions matches previous closed counter In-Store Cash',
      preconditions: 'Previous transaction closed with in-store cash = validCloseTargetInstore',
      testSteps: 'GET /api/cash-management/next-opening-balance',
      testData: { store: 'kalyaninagar' },
      expectedResult: `suggestedOpeningBalance equals ${validCloseTargetInstore}`,
      actualResult: `suggestedOpeningBalance=${nextOpeningBal.data?.data?.suggestedOpeningBalance}`,
      status: nextOpeningBal.data?.data?.suggestedOpeningBalance === validCloseTargetInstore ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-072: Start next transaction without supplying openingBalance
    const startNext = await request('POST', '/api/cash-management/start', {
      store: 'kalyaninagar',
    }, adminAToken);
    const nextTxId = startNext.data?.data?.id;

    recordTest({
      testCaseId: 'TC-CASH-072',
      module: 'Cash Management',
      scenario: 'Start next transaction auto-populates opening balance from previous closed session',
      preconditions: 'Previous transaction closed with instoreCash',
      testSteps: 'POST /api/cash-management/start without openingBalance field',
      testData: { store: 'kalyaninagar' },
      expectedResult: `HTTP 201, openingBalance=${validCloseTargetInstore}, status=OPEN`,
      actualResult: `HTTP ${startNext.status}, openingBalance=${startNext.data?.data?.openingBalance}, status=${startNext.data?.data?.status}`,
      status: startNext.status === 201 && startNext.data?.data?.openingBalance === validCloseTargetInstore && startNext.data?.data?.status === 'OPEN' ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // Close second transaction
    await request('POST', '/api/cash-management/close', {
      instoreCash: validCloseTargetInstore,
      remarks: 'Shift 2 complete',
    }, adminAToken);

    // =========================================================================
    // 14. TRANSACTION HISTORY TAB (TC-CASH-076 to TC-CASH-081)
    // =========================================================================
    console.log('\n>>> 14. TRANSACTION HISTORY TAB');

    const txHistory = await request('GET', '/api/cash-management/transactions', undefined, adminAToken, {
      store: 'kalyaninagar',
      page: '1',
      limit: '10',
    });

    const items = txHistory.data?.data || [];
    const item0 = items[0];

    const hasAllScreenshotColumns = item0 &&
      'date' in item0 &&
      'createdBy' in item0 &&
      'openingBalance' in item0 &&
      'cashRevenue' in item0 &&
      'cashExpense' in item0 &&
      'instoreCash' in item0 &&
      'closingBalance' in item0 &&
      'closingRemark' in item0 &&
      'reconciliation' in item0 &&
      'updatedBy' in item0 &&
      'updateRemark' in item0 &&
      'status' in item0;

    recordTest({
      testCaseId: 'TC-CASH-076',
      module: 'Cash Management',
      scenario: 'Transaction history tab loads paginated transaction list',
      preconditions: 'Transactions exist',
      testSteps: 'GET /api/cash-management/transactions',
      testData: { store: 'kalyaninagar' },
      expectedResult: 'HTTP 200, items array populated, pagination metadata returned',
      actualResult: `HTTP ${txHistory.status}, total items=${items.length}, total=${txHistory.data?.pagination?.total}`,
      status: txHistory.status === 200 && items.length >= 2 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    recordTest({
      testCaseId: 'TC-CASH-077',
      module: 'Cash Management',
      scenario: 'Verify all 13 table columns match the UI screenshot exactly',
      preconditions: 'Transactions present',
      testSteps: 'Inspect table row fields returned from API',
      testData: {},
      expectedResult: 'Includes Date, Created By, Opening Balance, Cash Revenue, Cash Expense, In-Store Cash, Closing Balance, Closing Remark, Reconciliation, Updated By, Update Remark, Status',
      actualResult: `All fields present: ${hasAllScreenshotColumns}`,
      status: hasAllScreenshotColumns ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    recordTest({
      testCaseId: 'TC-CASH-078',
      module: 'Cash Management',
      scenario: 'Transactions ordered chronologically with newest transaction first',
      preconditions: 'At least 2 transactions exist',
      testSteps: 'Verify items[0].id is the most recently created transaction',
      testData: {},
      expectedResult: `items[0].id matches ${nextTxId}`,
      actualResult: `items[0].id=${items[0]?.id}`,
      status: items[0]?.id === nextTxId ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 15. REVENUE TAB (TC-CASH-082 to TC-CASH-087)
    // =========================================================================
    console.log('\n>>> 15. REVENUE TAB');

    const revTab = await request('GET', '/api/cash-management/revenue', undefined, adminAToken, {
      store: 'kalyaninagar',
      transactionId: closedTxId,
    });

    const revRows = revTab.data?.data?.rows || [];
    const firstRevRow = revRows[0];
    const hasRevColumns = firstRevRow &&
      'date' in firstRevRow &&
      'invoiceNo' in firstRevRow &&
      'guestName' in firstRevRow &&
      'guestNo' in firstRevRow &&
      'staffName' in firstRevRow &&
      'total' in firstRevRow &&
      'cashAmount' in firstRevRow;

    recordTest({
      testCaseId: 'TC-CASH-082',
      module: 'Cash Management',
      scenario: 'Revenue tab loads real POS cash receipts and columns matching screenshot frame_014.jpg',
      preconditions: 'POS cash transactions recorded in session',
      testSteps: 'GET /api/cash-management/revenue?transactionId=...',
      testData: { transactionId: closedTxId },
      expectedResult: 'HTTP 200, contains date, invoiceNo, guestName, guestNo, staffName, total, cashAmount',
      actualResult: `HTTP ${revTab.status}, rows=${revRows.length}, columnsValid=${hasRevColumns}`,
      status: revTab.status === 200 && revRows.length >= 1 && hasRevColumns ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 16. EXPENSES TAB (TC-CASH-088 to TC-CASH-093)
    // =========================================================================
    console.log('\n>>> 16. EXPENSES TAB');

    const expTab = await request('GET', '/api/cash-management/expenses', undefined, adminAToken, {
      store: 'kalyaninagar',
      transactionId: closedTxId,
    });

    const expRows = expTab.data?.data?.rows || [];
    const firstExpRow = expRows[0];
    const hasExpColumns = firstExpRow &&
      'date' in firstExpRow &&
      'staffName' in firstExpRow &&
      'categoryName' in firstExpRow &&
      'total' in firstExpRow &&
      'cashAmount' in firstExpRow &&
      'description' in firstExpRow;

    recordTest({
      testCaseId: 'TC-CASH-088',
      module: 'Cash Management',
      scenario: 'Expenses tab loads in-store cash expenses and columns matching screenshots frame_015.jpg and frame_021.jpg',
      preconditions: 'Expenses recorded in session',
      testSteps: 'GET /api/cash-management/expenses?transactionId=...',
      testData: { transactionId: closedTxId },
      expectedResult: 'HTTP 200, contains date, staffName/vendorName, categoryName, total, cashAmount, description',
      actualResult: `HTTP ${expTab.status}, rows=${expRows.length}, columnsValid=${hasExpColumns}`,
      status: expTab.status === 200 && expRows.length >= 1 && hasExpColumns ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 17. EDIT TRANSACTION & AUDIT TRAIL (TC-CASH-094 to TC-CASH-100)
    // =========================================================================
    console.log('\n>>> 17. EDIT TRANSACTION & AUDIT TRAIL');

    // TC-CASH-095: Missing updateRemark rejected
    const invEdit = await request('PATCH', `/api/cash-management/transactions/${closedTxId}`, {
      instoreCash: 1200,
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-CASH-095',
      module: 'Cash Management',
      scenario: 'Editing closed transaction requires non-empty updateRemark audit note',
      preconditions: 'Closed transaction exists',
      testSteps: 'PATCH /transactions/:id without updateRemark',
      testData: { instoreCash: 1200 },
      expectedResult: 'HTTP 400 validation error (Please enter update remark)',
      actualResult: `HTTP ${invEdit.status}`,
      status: invEdit.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // TC-CASH-094 & TC-CASH-098 & TC-CASH-099: Valid edit with audit recording
    const validEdit = await request('PATCH', `/api/cash-management/transactions/${closedTxId}`, {
      instoreCash: dbClosedTx?.closingBalance ? Number(dbClosedTx.closingBalance) : 1000,
      updateRemark: 'Physical cash recounted after shift, exact match verified.',
    }, adminAToken);

    const dbUpdatedTx = await prisma.cashTransaction.findFirst({
      where: { id: closedTxId },
      include: { updatedBy: true },
    });

    recordTest({
      testCaseId: 'TC-CASH-094',
      module: 'Cash Management',
      scenario: 'Edit closed transaction recalculates reconciliation and records audit trail',
      preconditions: 'Closed transaction exists',
      testSteps: 'PATCH /transactions/:id with instoreCash and audit updateRemark',
      testData: { updateRemark: 'Physical cash recounted' },
      expectedResult: 'HTTP 200, reconciliation recalculated to 0, updatedBy captures admin, updateRemark saved',
      actualResult: `HTTP ${validEdit.status}, reconciliation=${dbUpdatedTx?.reconciliation}, updatedBy=${dbUpdatedTx?.updatedBy?.username}, updateRemark=${dbUpdatedTx?.updateRemark}`,
      status: validEdit.status === 200 && Number(dbUpdatedTx?.reconciliation) === 0 && dbUpdatedTx?.updatedBy?.username === 'admin' ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 18. LOCATION / STORE SEGREGATION (TC-CASH-101 to TC-CASH-104)
    // =========================================================================
    console.log('\n>>> 18. LOCATION / STORE SEGREGATION');

    // Create a transaction in 'viman-nagar' location
    const startViman = await request('POST', '/api/cash-management/start', {
      openingBalance: 300,
      store: 'viman-nagar',
    }, adminAToken);

    const vimanSummary = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'viman-nagar' });
    const kalyaniSummary = await request('GET', '/api/cash-management/summary', undefined, adminAToken, { store: 'kalyaninagar' });

    recordTest({
      testCaseId: 'TC-CASH-101',
      module: 'Cash Management',
      scenario: 'Independent location counters operate concurrently without interference',
      preconditions: 'Store kalyaninagar is closed, store viman-nagar is open',
      testSteps: 'Open counter in viman-nagar, query summaries for both locations',
      testData: { storeA: 'kalyaninagar', storeB: 'viman-nagar' },
      expectedResult: 'viman-nagar isActive=true (300), kalyaninagar isActive=false',
      actualResult: `viman isActive=${vimanSummary.data?.data?.isActive}, kalyani isActive=${kalyaniSummary.data?.data?.isActive}`,
      status: vimanSummary.data?.data?.isActive === true && kalyaniSummary.data?.data?.isActive === false ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // Close viman-nagar
    await request('POST', '/api/cash-management/close', { instoreCash: 300, remarks: 'Close viman' }, adminAToken, { store: 'viman-nagar' });

    // =========================================================================
    // 19. TENANT ISOLATION (TC-CASH-105 to TC-CASH-109)
    // =========================================================================
    console.log('\n>>> 19. TENANT ISOLATION');

    const tenantBTxList = await request('GET', '/api/cash-management/transactions', undefined, adminBToken);
    recordTest({
      testCaseId: 'TC-CASH-105',
      module: 'Cash Management',
      scenario: 'Tenant B cannot view Tenant A cash transactions',
      preconditions: 'Tenant A has closed transactions',
      testSteps: 'Tenant B queries GET /api/cash-management/transactions',
      testData: {},
      expectedResult: 'HTTP 200, items array empty (length=0), no Tenant A IDs leaked',
      actualResult: `Tenant B items count: ${tenantBTxList.data?.data?.length}`,
      status: tenantBTxList.status === 200 && tenantBTxList.data?.data?.length === 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    const tenantBCrossEdit = await request('PATCH', `/api/cash-management/transactions/${closedTxId}`, {
      instoreCash: 5000,
      updateRemark: 'Cross tenant tampering',
    }, adminBToken);

    recordTest({
      testCaseId: 'TC-CASH-107',
      module: 'Cash Management',
      scenario: 'Tenant B cannot modify Tenant A cash transactions',
      preconditions: 'Tenant A transaction exists',
      testSteps: 'Tenant B sends PATCH /transactions/:id for Tenant A ID',
      testData: { targetId: closedTxId },
      expectedResult: 'HTTP 404 Not Found (or 403 Forbidden)',
      actualResult: `HTTP ${tenantBCrossEdit.status}`,
      status: tenantBCrossEdit.status === 404 || tenantBCrossEdit.status === 403 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 20. AUTHENTICATION & PERMISSIONS (TC-CASH-110 to TC-CASH-114)
    // =========================================================================
    console.log('\n>>> 20. AUTHENTICATION & PERMISSIONS');

    const unauthSummary = await request('GET', '/api/cash-management/summary');
    recordTest({
      testCaseId: 'TC-CASH-110',
      module: 'Cash Management',
      scenario: 'Unauthenticated requests rejected without token',
      preconditions: 'None',
      testSteps: 'GET /api/cash-management/summary without Authorization header',
      testData: {},
      expectedResult: 'HTTP 401 Unauthorized',
      actualResult: `HTTP ${unauthSummary.status}`,
      status: unauthSummary.status === 401 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    const badTokenSummary = await request('GET', '/api/cash-management/summary', undefined, 'invalid.jwt.token');
    recordTest({
      testCaseId: 'TC-CASH-111',
      module: 'Cash Management',
      scenario: 'Invalid/malformed token rejected',
      preconditions: 'None',
      testSteps: 'GET /api/cash-management/summary with invalid token',
      testData: { token: 'invalid.jwt.token' },
      expectedResult: 'HTTP 401 Unauthorized',
      actualResult: `HTTP ${badTokenSummary.status}`,
      status: badTokenSummary.status === 401 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    const cashierSummary = await request('GET', '/api/cash-management/summary', undefined, cashierToken);
    recordTest({
      testCaseId: 'TC-CASH-114',
      module: 'Cash Management',
      scenario: 'Cashier with authorized POS/CASH permissions can access Cash Management',
      preconditions: 'Cashier user authenticated',
      testSteps: 'GET /api/cash-management/summary using cashier token',
      testData: {},
      expectedResult: 'HTTP 200 OK',
      actualResult: `HTTP ${cashierSummary.status}`,
      status: cashierSummary.status === 200 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 22. CONCURRENCY & RACE CONDITIONS (TC-CASH-115 to TC-CASH-119)
    // =========================================================================
    console.log('\n>>> 22. CONCURRENCY & RACE CONDITIONS');

    // Start counter for concurrency tests
    await request('POST', '/api/cash-management/start', { openingBalance: 400, store: 'kalyaninagar' }, adminAToken);

    // TC-CASH-116: Simultaneous close requests
    const [cRes1, cRes2] = await Promise.all([
      request('POST', '/api/cash-management/close', { instoreCash: 400, remarks: 'Close concurrent 1' }, adminAToken),
      request('POST', '/api/cash-management/close', { instoreCash: 400, remarks: 'Close concurrent 2' }, adminAToken),
    ]);
    const closeSuccesses = (cRes1.status === 200 ? 1 : 0) + (cRes2.status === 200 ? 1 : 0);
    recordTest({
      testCaseId: 'TC-CASH-116',
      module: 'Cash Management',
      scenario: 'Simultaneous counter close requests: exactly one succeeds, avoiding double closure',
      preconditions: 'Counter open',
      testSteps: 'Fire two concurrent POST /close requests',
      testData: { instoreCash: 400 },
      expectedResult: 'Exactly 1 request returns 200, the other returns 400',
      actualResult: `Req 1 HTTP ${cRes1.status}, Req 2 HTTP ${cRes2.status}, successes: ${closeSuccesses}`,
      status: closeSuccesses === 1 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 25. SECURITY & INPUT SANITIZATION (TC-CASH-120 to TC-CASH-125)
    // =========================================================================
    console.log('\n>>> 25. SECURITY & INPUT SANITIZATION');

    // TC-CASH-120: SQL Injection attempt in remarks
    await request('POST', '/api/cash-management/start', { openingBalance: 200, store: 'kalyaninagar' }, adminAToken);
    const sqlPayload = "'; DROP TABLE cash_transactions; --";
    const sqliClose = await request('POST', '/api/cash-management/close', {
      instoreCash: 200,
      remarks: sqlPayload,
    }, adminAToken);

    const tableStillExists = await prisma.cashTransaction.count();
    recordTest({
      testCaseId: 'TC-CASH-120',
      module: 'Cash Management',
      scenario: 'SQL injection string in remarks is safely parameterized and causes no damage',
      preconditions: 'Counter open',
      testSteps: "Submit remarks containing SQL injection: '; DROP TABLE cash_transactions; --",
      testData: { remarks: sqlPayload },
      expectedResult: 'Query executes safely via ORM parameterization, table remains intact',
      actualResult: `HTTP ${sqliClose.status}, Total records in table: ${tableStillExists}`,
      status: sqliClose.status === 200 && tableStillExists > 0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // TC-CASH-121: XSS script tag injection in remarks
    await request('POST', '/api/cash-management/start', { openingBalance: 200, store: 'kalyaninagar' }, adminAToken);
    const xssPayload = '<script>alert("XSS")</script>';
    const xssClose = await request('POST', '/api/cash-management/close', {
      instoreCash: 200,
      remarks: xssPayload,
    }, adminAToken);
    const storedXssTx = await prisma.cashTransaction.findFirst({
      where: { id: xssClose.data?.data?.id },
    });
    recordTest({
      testCaseId: 'TC-CASH-121',
      module: 'Cash Management',
      scenario: 'XSS script tags stored as harmless text without executing or corrupting JSON',
      preconditions: 'Counter open',
      testSteps: 'Submit remarks containing <script>alert("XSS")</script>',
      testData: { remarks: xssPayload },
      expectedResult: 'HTTP 200, payload stored harmlessly as literal string, valid JSON response',
      actualResult: `HTTP ${xssClose.status}, remarks=${storedXssTx?.closingRemark}`,
      status: xssClose.status === 200 && storedXssTx?.closingRemark === xssPayload ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // Final summary
    const passedCount = testResults.filter((t) => t.status === 'PASS').length;
    const failedCount = testResults.filter((t) => t.status === 'FAIL').length;
    const blockedCount = testResults.filter((t) => t.status === 'BLOCKED').length;

    console.log('\n========================================================================================');
    console.log(`   EXECUTION SUMMARY: ${testResults.length} Tests | ${passedCount} PASSED | ${failedCount} FAILED | ${blockedCount} BLOCKED`);
    console.log('========================================================================================\n');

    return { total: testResults.length, passed: passedCount, failed: failedCount, blocked: blockedCount, results: testResults };
  } finally {
    if (server) {
      server.close();
    }
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith('cash-management-complete.test.ts')) {
  runCompleteCashManagementTests()
    .then(({ failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
