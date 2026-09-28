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
}

export const testResults: TestCaseResult[] = [];

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let tenantAId: string;
let tenantBId: string;

function recordTest(result: TestCaseResult) {
  testResults.push(result);
  const icon = result.status === 'PASS' ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} ${result.testCaseId}: [${result.module}] ${result.scenario}`);
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

export async function runFourModulesTest() {
  console.log('\n========================================================================================');
  console.log('   QUBEXE SALOON SOFTWARE: Expenses, Enquiries/Referrals, Payroll, WhatsApp Test Suite');
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
    // AUTHENTICATION SETUP
    // -------------------------------------------------------------
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

    if (!adminAToken || !adminBToken) {
      throw new Error('Failed to authenticate admin test accounts');
    }

    // =========================================================================
    // MODULE 1: EXPENSES
    // =========================================================================
    console.log('\n>>> TESTING MODULE 1: EXPENSES');

    // TC-EXP-01: Create Expense Type
    let expenseTypeId: string = '';
    const createTypeRes = await request('POST', '/api/expense-types', {
      name: `Electricity & Utilities ${Date.now()}`,
      pnlCategory: 'General And Administrative Expenses',
      isActive: true,
    }, adminAToken);

    if (createTypeRes.status === 201 && createTypeRes.data?.success && createTypeRes.data?.data?.id) {
      expenseTypeId = createTypeRes.data.data.id;
      recordTest({
        testCaseId: 'TC-EXP-01',
        module: 'Expenses',
        scenario: 'Create new expense type with P&L category',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/expense-types',
        testData: createTypeRes.data.data,
        expectedResult: 'HTTP 201 with created expense type ID',
        actualResult: `HTTP ${createTypeRes.status}, id=${expenseTypeId}`,
        status: 'PASS',
      });
    } else {
      recordTest({
        testCaseId: 'TC-EXP-01',
        module: 'Expenses',
        scenario: 'Create new expense type with P&L category',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/expense-types',
        testData: null,
        expectedResult: 'HTTP 201 with created expense type ID',
        actualResult: `HTTP ${createTypeRes.status}, body=${JSON.stringify(createTypeRes.data)}`,
        status: 'FAIL',
      });
    }

    // TC-EXP-02: Duplicate Expense Type Prevention
    const duplicateTypeRes = await request('POST', '/api/expense-types', {
      name: createTypeRes.data?.data?.name,
      pnlCategory: 'General And Administrative Expenses',
    }, adminAToken);
    recordTest({
      testCaseId: 'TC-EXP-02',
      module: 'Expenses',
      scenario: 'Prevent duplicate expense type name within tenant',
      preconditions: 'Expense type exists',
      testSteps: 'POST /api/expense-types with same name',
      testData: duplicateTypeRes.data,
      expectedResult: 'HTTP 400 Bad Request with error message',
      actualResult: `HTTP ${duplicateTypeRes.status}, message=${duplicateTypeRes.data?.message}`,
      status: duplicateTypeRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // TC-EXP-03: Create Financial Accounts
    let accountAId: string = '';
    let accountBId: string = '';

    const createAccARes = await request('POST', '/api/accounts', {
      accountName: `Main Operating Account ${Date.now()}`,
      accountType: 'Current',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      balance: 10000,
      isActive: true,
    }, adminAToken);

    const createAccBRes = await request('POST', '/api/accounts', {
      accountName: `Petty Cash Safe ${Date.now()}`,
      accountType: 'Petty Cash',
      balance: 2000,
      isActive: true,
    }, adminAToken);

    if (createAccARes.status === 201 && createAccBRes.status === 201) {
      accountAId = createAccARes.data?.data?.id;
      accountBId = createAccBRes.data?.data?.id;
      recordTest({
        testCaseId: 'TC-EXP-03',
        module: 'Expenses',
        scenario: 'Create financial accounts with initial opening balance',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/accounts',
        testData: { accA: createAccARes.data?.data, accB: createAccBRes.data?.data },
        expectedResult: 'HTTP 201 for both accounts with balances initialized',
        actualResult: `HTTP 201, accA=${accountAId} (bal=10000), accB=${accountBId} (bal=2000)`,
        status: 'PASS',
      });
    } else {
      recordTest({
        testCaseId: 'TC-EXP-03',
        module: 'Expenses',
        scenario: 'Create financial accounts with initial opening balance',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/accounts',
        testData: null,
        expectedResult: 'HTTP 201 for both accounts',
        actualResult: `accA: ${createAccARes.status}, accB: ${createAccBRes.status}`,
        status: 'FAIL',
      });
    }

    // TC-EXP-04: Account Balance Top-Up
    const topUpRes = await request('POST', '/api/accounts/add-balance', {
      accountId: accountAId,
      amount: 5000,
      paymode: 'NEFT',
      remark: 'Owner capital addition',
    }, adminAToken);

    const accACheckAfterTopUp = await request('GET', `/api/accounts/${accountAId}`, undefined, adminAToken);
    const balanceAfterTopUp = accACheckAfterTopUp.data?.data?.balance;

    recordTest({
      testCaseId: 'TC-EXP-04',
      module: 'Expenses',
      scenario: 'Add balance / direct top-up to account',
      preconditions: 'Account exists with 10000',
      testSteps: 'POST /api/accounts/add-balance +5000',
      testData: topUpRes.data,
      expectedResult: 'HTTP 200, balance becomes 15000',
      actualResult: `HTTP ${topUpRes.status}, balance=${balanceAfterTopUp}`,
      status: topUpRes.status === 200 && Number(balanceAfterTopUp) === 15000 ? 'PASS' : 'FAIL',
    });

    // TC-EXP-05: Internal Transfer between Accounts
    const transferRes = await request('POST', '/api/accounts/add-balance', {
      accountId: accountAId, // Source
      transferToAccountId: accountBId, // Destination
      amount: 3000,
      paymode: 'Cash Withdrawal',
      remark: 'Replenish petty cash counter',
    }, adminAToken);

    const accACheckAfterTransfer = await request('GET', `/api/accounts/${accountAId}`, undefined, adminAToken);
    const accBCheckAfterTransfer = await request('GET', `/api/accounts/${accountBId}`, undefined, adminAToken);
    const balAAfterTransfer = accACheckAfterTransfer.data?.data?.balance;
    const balBAfterTransfer = accBCheckAfterTransfer.data?.data?.balance;

    const transferSuccess =
      transferRes.status === 200 &&
      Number(balAAfterTransfer) === 12000 &&
      Number(balBAfterTransfer) === 5000;

    recordTest({
      testCaseId: 'TC-EXP-05',
      module: 'Expenses',
      scenario: 'Internal transfer between accounts with atomic balance updates',
      preconditions: 'Acc A has 15000, Acc B has 2000',
      testSteps: 'POST /api/accounts/add-balance (transfer 3000 from A to B)',
      testData: transferRes.data,
      expectedResult: 'HTTP 200, Acc A becomes 12000, Acc B becomes 5000',
      actualResult: `HTTP ${transferRes.status}, Acc A=${balAAfterTransfer}, Acc B=${balBAfterTransfer}`,
      status: transferSuccess ? 'PASS' : 'FAIL',
    });

    // TC-EXP-06: Create Expense and verify Account balance deduction
    let expenseId: string = '';
    const createExpenseRes = await request('POST', '/api/expenses', {
      expenseDate: new Date().toISOString(),
      expenseTypeId,
      accountId: accountBId,
      amount: 500,
      paymode: 'CASH',
      givenTo: 'Cleaning Vendor Ravi',
      vendorName: 'CleanCorp Services',
      description: 'Monthly salon deep cleaning supplies',
      store: 'kalyaninagar',
    }, adminAToken);

    const accBCheckAfterExpense = await request('GET', `/api/accounts/${accountBId}`, undefined, adminAToken);
    const balBAfterExpense = accBCheckAfterExpense.data?.data?.balance;

    if (createExpenseRes.status === 201 && createExpenseRes.data?.data?.id) {
      expenseId = createExpenseRes.data.data.id;
      const expenseDeductedAccurately = Number(balBAfterExpense) === 4500;
      recordTest({
        testCaseId: 'TC-EXP-06',
        module: 'Expenses',
        scenario: 'Create expense with account link and deduct account balance automatically',
        preconditions: 'Acc B has 5000',
        testSteps: 'POST /api/expenses for 500 from Acc B',
        testData: createExpenseRes.data.data,
        expectedResult: 'HTTP 201, Acc B balance reduced from 5000 to 4500',
        actualResult: `HTTP 201, Acc B balance=${balBAfterExpense}, expenseId=${expenseId}`,
        status: expenseDeductedAccurately ? 'PASS' : 'FAIL',
      });
    } else {
      recordTest({
        testCaseId: 'TC-EXP-06',
        module: 'Expenses',
        scenario: 'Create expense with account link',
        preconditions: 'Acc B exists',
        testSteps: 'POST /api/expenses',
        testData: null,
        expectedResult: 'HTTP 201',
        actualResult: `HTTP ${createExpenseRes.status}, body=${JSON.stringify(createExpenseRes.data)}`,
        status: 'FAIL',
      });
    }

    // TC-EXP-07: Expenses Dashboard Summary
    const dashboardRes = await request('GET', '/api/expenses/dashboard/summary', undefined, adminAToken, {
      store: 'kalyaninagar',
    });
    const dashData = dashboardRes.data?.data;
    const dashSuccess =
      dashboardRes.status === 200 &&
      dashData &&
      Number(dashData.totalAmount) >= 500 &&
      dashData.totalCount >= 1 &&
      Array.isArray(dashData.byCategory);

    recordTest({
      testCaseId: 'TC-EXP-07',
      module: 'Expenses',
      scenario: 'Expenses dashboard metrics and aggregation',
      preconditions: 'Expenses created in kalyaninagar store',
      testSteps: 'GET /api/expenses/dashboard/summary?store=kalyaninagar',
      testData: dashData,
      expectedResult: 'HTTP 200 with totalAmount, totalCount, byCategory, byPaymode, recentExpenses',
      actualResult: `HTTP ${dashboardRes.status}, total=${dashData?.totalAmount}, count=${dashData?.totalCount}`,
      status: dashSuccess ? 'PASS' : 'FAIL',
    });

    // TC-EXP-08: Expense Multi-Tenant Isolation
    const tenantBExpenseRes = await request('GET', `/api/expenses/${expenseId}`, undefined, adminBToken);
    recordTest({
      testCaseId: 'TC-EXP-08',
      module: 'Expenses',
      scenario: 'Strict multi-tenant isolation on expenses',
      preconditions: 'Expense belongs to Tenant A',
      testSteps: 'GET /api/expenses/:id using Tenant B token',
      testData: tenantBExpenseRes.data,
      expectedResult: 'HTTP 404 Not Found',
      actualResult: `HTTP ${tenantBExpenseRes.status}`,
      status: tenantBExpenseRes.status === 404 ? 'PASS' : 'FAIL',
    });

    // =========================================================================
    // MODULE 2: ENQUIRIES & REFERRAL DASHBOARD
    // =========================================================================
    console.log('\n>>> TESTING MODULE 2: ENQUIRIES & REFERRALS');

    // TC-ENQ-01: Create Enquiry
    let enquiryId: string = '';
    const createEnquiryRes = await request('POST', '/api/enquiries', {
      name: 'Aditi Sharma',
      mobile: '9822012345',
      email: 'aditi.sharma@example.com',
      priority: 'HIGH',
      status: 'NEW',
      service: 'Bridal Makeover Package',
      description: 'Enquired about wedding package for December',
      followUpDate: new Date(Date.now() + 86400000).toISOString(),
      store: 'kalyaninagar',
    }, adminAToken);

    if (createEnquiryRes.status === 201 && createEnquiryRes.data?.data?.id) {
      enquiryId = createEnquiryRes.data.data.id;
      recordTest({
        testCaseId: 'TC-ENQ-01',
        module: 'Enquiries',
        scenario: 'Create guest enquiry with priority and follow-up date',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/enquiries',
        testData: createEnquiryRes.data.data,
        expectedResult: 'HTTP 201 with enquiry ID',
        actualResult: `HTTP ${createEnquiryRes.status}, id=${enquiryId}`,
        status: 'PASS',
      });
    } else {
      recordTest({
        testCaseId: 'TC-ENQ-01',
        module: 'Enquiries',
        scenario: 'Create guest enquiry',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/enquiries',
        testData: null,
        expectedResult: 'HTTP 201',
        actualResult: `HTTP ${createEnquiryRes.status}, body=${JSON.stringify(createEnquiryRes.data)}`,
        status: 'FAIL',
      });
    }

    // TC-ENQ-02: Update Enquiry Status Transition (NEW -> CONTACTED -> CONVERTED)
    const updateEnquiryRes = await request('PUT', `/api/enquiries/${enquiryId}`, {
      status: 'CONTACTED',
      description: 'Spoke with guest, agreed to visit on weekend',
    }, adminAToken);

    const enqAfterUpdate = await request('GET', `/api/enquiries/${enquiryId}`, undefined, adminAToken);
    const enqStatusUpdated =
      updateEnquiryRes.status === 200 &&
      enqAfterUpdate.data?.data?.status === 'CONTACTED';

    recordTest({
      testCaseId: 'TC-ENQ-02',
      module: 'Enquiries',
      scenario: 'Update enquiry status and notes',
      preconditions: 'Enquiry exists in status NEW',
      testSteps: 'PUT /api/enquiries/:id status=CONTACTED',
      testData: updateEnquiryRes.data,
      expectedResult: 'HTTP 200, status becomes CONTACTED',
      actualResult: `HTTP ${updateEnquiryRes.status}, status=${enqAfterUpdate.data?.data?.status}`,
      status: enqStatusUpdated ? 'PASS' : 'FAIL',
    });

    // TC-REF-01: Create Referral
    let referralId: string = '';
    const createRefRes = await request('POST', '/api/referrals', {
      referralName: 'Pooja Patil',
      mobileNumber: '9822055555',
      referrerName: 'Aditi Sharma',
      referralCode: 'ADITI20',
      benefitToReferral: '20% Off on First Hair Spa',
      benefitToReferrer: '₹200 Loyalty Cash',
      status: 'PENDING',
      store: 'kalyaninagar',
    }, adminAToken);

    if (createRefRes.status === 201 && createRefRes.data?.data?.id) {
      referralId = createRefRes.data.data.id;
      recordTest({
        testCaseId: 'TC-REF-01',
        module: 'Referrals',
        scenario: 'Create guest referral record',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/referrals',
        testData: createRefRes.data.data,
        expectedResult: 'HTTP 201 with referral ID',
        actualResult: `HTTP ${createRefRes.status}, id=${referralId}`,
        status: 'PASS',
      });
    } else {
      recordTest({
        testCaseId: 'TC-REF-01',
        module: 'Referrals',
        scenario: 'Create guest referral record',
        preconditions: 'Admin authenticated',
        testSteps: 'POST /api/referrals',
        testData: null,
        expectedResult: 'HTTP 201',
        actualResult: `HTTP ${createRefRes.status}, body=${JSON.stringify(createRefRes.data)}`,
        status: 'FAIL',
      });
    }

    // TC-REF-02: Mark Referral Used & Check Conversion Metrics
    const updateRefRes = await request('PUT', `/api/referrals/${referralId}`, {
      status: 'USED',
    }, adminAToken);

    const refDashboardRes = await request('GET', '/api/referrals/dashboard', undefined, adminAToken, {
      store: 'kalyaninagar',
    });

    const metrics = refDashboardRes.data?.data;
    const refMetricsValid =
      refDashboardRes.status === 200 &&
      metrics &&
      metrics.totalReferrals >= 1 &&
      metrics.usedReferrals >= 1 &&
      metrics.conversionRate > 0;

    recordTest({
      testCaseId: 'TC-REF-02',
      module: 'Referrals',
      scenario: 'Mark referral used and verify conversion rate in referral dashboard',
      preconditions: 'Referral created',
      testSteps: 'PUT /api/referrals/:id status=USED, GET /api/referrals/dashboard',
      testData: metrics,
      expectedResult: 'HTTP 200 with accurate totalReferrals, usedReferrals, conversionRate',
      actualResult: `HTTP ${refDashboardRes.status}, total=${metrics?.totalReferrals}, used=${metrics?.usedReferrals}, convRate=${metrics?.conversionRate}%`,
      status: refMetricsValid ? 'PASS' : 'FAIL',
    });

    // TC-REF-03: Multi-Tenant Isolation on Enquiries
    const tenantBEnqRes = await request('GET', `/api/enquiries/${enquiryId}`, undefined, adminBToken);
    recordTest({
      testCaseId: 'TC-REF-03',
      module: 'Enquiries',
      scenario: 'Strict multi-tenant isolation on enquiries',
      preconditions: 'Enquiry belongs to Tenant A',
      testSteps: 'GET /api/enquiries/:id using Tenant B token',
      testData: tenantBEnqRes.data,
      expectedResult: 'HTTP 404 Not Found',
      actualResult: `HTTP ${tenantBEnqRes.status}`,
      status: tenantBEnqRes.status === 404 ? 'PASS' : 'FAIL',
    });

    // =========================================================================
    // MODULE 3: PAYROLL
    // =========================================================================
    console.log('\n>>> TESTING MODULE 3: PAYROLL');

    // Get an existing staff member in Tenant A
    const staffList = await prisma.staff.findMany({
      where: { tenantId: tenantAId, isActive: true },
      take: 1,
    });

    if (staffList.length === 0) {
      throw new Error('No active staff found in Tenant A for payroll tests');
    }
    const testStaff = staffList[0];

    // Clean up any existing payroll config and salary records for this staff to test unconfigured state
    await prisma.staffSalary.deleteMany({
      where: { tenantId: tenantAId, staffId: testStaff.id },
    });
    await prisma.payrollConfig.deleteMany({
      where: { tenantId: tenantAId, staffId: testStaff.id },
    });
    await prisma.payrollConfig.deleteMany({
      where: { tenantId: tenantAId, staffId: null },
    });

    // TC-PAY-01: Unconfigured State Handled Accurately
    const unconfiguredRes = await request('GET', '/api/payroll/payslip', undefined, adminAToken, {
      staffId: testStaff.id,
      month: '9',
      year: '2026',
    });

    const isUnconfiguredCorrect =
      unconfiguredRes.status === 200 &&
      unconfiguredRes.data?.configured === false &&
      unconfiguredRes.data?.message === 'Payroll config not found';

    recordTest({
      testCaseId: 'TC-PAY-01',
      module: 'Payroll',
      scenario: 'Return clean unconfigured state when payroll config is missing (matching UI frame 96)',
      preconditions: 'No payroll config exists for tenant/staff',
      testSteps: 'GET /api/payroll/payslip?staffId=...&month=9&year=2026',
      testData: unconfiguredRes.data,
      expectedResult: 'HTTP 200, configured=false, message="Payroll config not found"',
      actualResult: `HTTP ${unconfiguredRes.status}, configured=${unconfiguredRes.data?.configured}, message="${unconfiguredRes.data?.message}"`,
      status: isUnconfiguredCorrect ? 'PASS' : 'FAIL',
    });

    // TC-PAY-02: Configure Payroll Rules
    const setConfigRes = await request('POST', '/api/payroll/config', {
      staffId: testStaff.id,
      basicSalary: 30000,
      hra: 10000,
      conveyance: 2000,
      medicalAllowance: 1500,
      specialAllowance: 1500,
      pfPercentage: 12, // 12% of basic = 3600
      esiPercentage: 0.75, // 0.75% of gross
      professionalTax: 200,
      tdsPercentage: 0,
      isActive: true,
    }, adminAToken);

    recordTest({
      testCaseId: 'TC-PAY-02',
      module: 'Payroll',
      scenario: 'Save staff payroll structure configuration',
      preconditions: 'Staff exists in tenant',
      testSteps: 'POST /api/payroll/config',
      testData: setConfigRes.data,
      expectedResult: 'HTTP 200 with saved payroll config',
      actualResult: `HTTP ${setConfigRes.status}, basicSalary=${setConfigRes.data?.data?.basicSalary}`,
      status: setConfigRes.status === 200 && Number(setConfigRes.data?.data?.basicSalary) === 30000 ? 'PASS' : 'FAIL',
    });

    // TC-PAY-03: Generate Salary & Verify Mathematical Calculations
    const generateSalaryRes = await request('POST', '/api/payroll/generate', {
      month: 9,
      year: 2026,
      staffId: testStaff.id,
      workingDays: 30,
      presentDays: 30, // Full attendance
      forceRegenerate: true,
      notes: 'September 2026 Salary',
    }, adminAToken);

    const generatedSalary = generateSalaryRes.data?.data?.salaries?.[0];
    let generatedSalaryId = generatedSalary?.id;

    // Mathematical verification:
    // Earnings:
    // Basic: 30000
    // HRA: 10000
    // Conveyance: 2000
    // Medical: 1500
    // Special: 1500
    // Gross: 45000
    // Deductions:
    // PF: 30000 * 12% = 3600
    // ESI: 45000 * 0.75% = 337.5
    // PT: 200
    // Total Deductions: 3600 + 337.5 + 200 = 4137.5
    // Net Salary: 45000 - 4137.5 = 40862.5
    const mathValid =
      generateSalaryRes.status === 200 &&
      generatedSalary &&
      Number(generatedSalary.basicSalary) === 30000 &&
      Number(generatedSalary.grossSalary) === 45000 &&
      Number(generatedSalary.deductions) === 4137.5 &&
      Math.abs(Number(generatedSalary.netSalary) - 40862.5) < 0.1;

    recordTest({
      testCaseId: 'TC-PAY-03',
      module: 'Payroll',
      scenario: 'Generate salary and verify authoritative financial calculations (Gross, PF, ESI, PT, Net)',
      preconditions: 'Payroll config created with basic=30000, allowances=15000',
      testSteps: 'POST /api/payroll/generate (30/30 days)',
      testData: generatedSalary,
      expectedResult: 'Gross = 45000, Total Deductions = 4137.5, Net = 40862.5',
      actualResult: `Gross=${generatedSalary?.grossSalary}, Deductions=${generatedSalary?.deductions}, Net=${generatedSalary?.netSalary}`,
      status: mathValid ? 'PASS' : 'FAIL',
    });

    // TC-PAY-04: Payslip Breakdown Retrieval
    const payslipRes = await request('GET', '/api/payroll/payslip', undefined, adminAToken, {
      staffId: testStaff.id,
      month: '9',
      year: '2026',
    });

    const payslipData = payslipRes.data?.data;
    const payslipValid =
      payslipRes.status === 200 &&
      payslipRes.data?.configured === true &&
      payslipData &&
      payslipData.staff.id === testStaff.id &&
      Number(payslipData.summary.netSalary) === Number(generatedSalary?.netSalary) &&
      Array.isArray(payslipData.earnings) &&
      Array.isArray(payslipData.deductions);

    recordTest({
      testCaseId: 'TC-PAY-04',
      module: 'Payroll',
      scenario: 'Retrieve itemized payslip breakdown for staff period',
      preconditions: 'Salary generated',
      testSteps: 'GET /api/payroll/payslip?staffId=...&month=9&year=2026',
      testData: payslipData,
      expectedResult: 'HTTP 200 with itemized earnings, deductions, staff details, period',
      actualResult: `HTTP ${payslipRes.status}, netSalary=${payslipData?.summary?.netSalary}, earningsCount=${payslipData?.earnings?.length}, deductionsCount=${payslipData?.deductions?.length}`,
      status: payslipValid ? 'PASS' : 'FAIL',
    });

    // TC-PAY-05: Multi-Tenant Isolation on Payroll
    const tenantBSalaryRes = await request('GET', `/api/payroll/salaries/${generatedSalaryId}`, undefined, adminBToken);
    recordTest({
      testCaseId: 'TC-PAY-05',
      module: 'Payroll',
      scenario: 'Strict multi-tenant isolation on payroll records',
      preconditions: 'Salary record belongs to Tenant A',
      testSteps: 'GET /api/payroll/salaries/:id using Tenant B token',
      testData: tenantBSalaryRes.data,
      expectedResult: 'HTTP 404 Not Found',
      actualResult: `HTTP ${tenantBSalaryRes.status}`,
      status: tenantBSalaryRes.status === 404 ? 'PASS' : 'FAIL',
    });

    // =========================================================================
    // MODULE 4: WHATSAPP
    // =========================================================================
    console.log('\n>>> TESTING MODULE 4: WHATSAPP');

    const testRecipientNumber = '919822099999';

    // TC-WA-01: Send WhatsApp Message (Direct & Template)
    const sendMsgRes = await request('POST', '/api/whatsapp/messages', {
      recipientNumber: testRecipientNumber,
      recipientName: 'Kavita Deshmukh',
      templateName: 'referral_reward_percentage',
      templateVariables: {
        guest_name: 'Kavita',
        discount_percentage: '20',
        referral_code: 'KAVITA20',
      },
    }, adminAToken);

    const sentMsg = sendMsgRes.data?.data?.message;
    const conversationId = sendMsgRes.data?.data?.conversation?.id;

    const msgSentSuccess =
      sendMsgRes.status === 201 &&
      sentMsg &&
      conversationId &&
      sentMsg.status === 'SENT' &&
      sentMsg.messageContent.includes('KAVITA20');

    recordTest({
      testCaseId: 'TC-WA-01',
      module: 'WhatsApp',
      scenario: 'Send template message and verify conversation auto-creation',
      preconditions: 'Admin authenticated',
      testSteps: 'POST /api/whatsapp/messages with template referral_reward_percentage',
      testData: sendMsgRes.data,
      expectedResult: 'HTTP 201, message sent with resolved placeholders, conversation created',
      actualResult: `HTTP ${sendMsgRes.status}, convId=${conversationId}, content="${sentMsg?.messageContent}"`,
      status: msgSentSuccess ? 'PASS' : 'FAIL',
    });

    // TC-WA-02: Message Failure Tracking ("Message Undeliverable." matching frame 130)
    const sendUndeliverableRes = await request('POST', '/api/whatsapp/messages', {
      recipientNumber: '910000000000', // Invalid / unreachable number
      recipientName: 'Invalid Recipient',
      messageContent: 'Test undeliverable failure path',
      status: 'UNDELIVERABLE',
      errorDetails: 'Message Undeliverable.',
    }, adminAToken);

    const undeliverableMsg = sendUndeliverableRes.data?.data?.message;
    const failureTracked =
      sendUndeliverableRes.status === 201 &&
      undeliverableMsg &&
      (undeliverableMsg.status === 'UNDELIVERABLE' || undeliverableMsg.status === 'FAILED') &&
      undeliverableMsg.errorDetails === 'Message Undeliverable.';

    recordTest({
      testCaseId: 'TC-WA-02',
      module: 'WhatsApp',
      scenario: 'Record undeliverable message failure details (matching UI frame 130)',
      preconditions: 'Admin authenticated',
      testSteps: 'POST /api/whatsapp/messages with status=UNDELIVERABLE, errorDetails="Message Undeliverable."',
      testData: undeliverableMsg,
      expectedResult: 'HTTP 201, status="UNDELIVERABLE" or "FAILED", errorDetails="Message Undeliverable."',
      actualResult: `HTTP ${sendUndeliverableRes.status}, status=${undeliverableMsg?.status}, error="${undeliverableMsg?.errorDetails}"`,
      status: failureTracked ? 'PASS' : 'FAIL',
    });

    // TC-WA-03: Retrieve Chronological Messages in Conversation
    const convMessagesRes = await request('GET', `/api/whatsapp/conversations/${conversationId}/messages`, undefined, adminAToken);
    const messages = convMessagesRes.data?.data;
    const chronValid =
      convMessagesRes.status === 200 &&
      Array.isArray(messages) &&
      messages.length >= 1 &&
      messages[0].recipientNumber === testRecipientNumber;

    recordTest({
      testCaseId: 'TC-WA-03',
      module: 'WhatsApp',
      scenario: 'Retrieve chronological message history within conversation',
      preconditions: 'Conversation exists with messages',
      testSteps: 'GET /api/whatsapp/conversations/:id/messages',
      testData: messages,
      expectedResult: 'HTTP 200 with chronological message array',
      actualResult: `HTTP ${convMessagesRes.status}, count=${messages?.length}`,
      status: chronValid ? 'PASS' : 'FAIL',
    });

    // TC-WA-04: WhatsApp History Listing with Filters
    const historyRes = await request('GET', '/api/whatsapp/history', undefined, adminAToken, {
      templateName: 'referral_reward_percentage',
    });
    const historyItems = historyRes.data?.data?.data;
    const historyValid =
      historyRes.status === 200 &&
      Array.isArray(historyItems) &&
      historyItems.length >= 1 &&
      historyItems[0].templateName === 'referral_reward_percentage';

    recordTest({
      testCaseId: 'TC-WA-04',
      module: 'WhatsApp',
      scenario: 'Filter WhatsApp message history by template name',
      preconditions: 'Messages logged in history',
      testSteps: 'GET /api/whatsapp/history?templateName=referral_reward_percentage',
      testData: historyItems,
      expectedResult: 'HTTP 200 with filtered message history',
      actualResult: `HTTP ${historyRes.status}, count=${historyItems?.length}`,
      status: historyValid ? 'PASS' : 'FAIL',
    });

    // TC-WA-05: Multi-Tenant Isolation on WhatsApp Conversations
    const tenantBConvRes = await request('GET', `/api/whatsapp/conversations/${conversationId}/messages`, undefined, adminBToken);
    const convIsolated =
      tenantBConvRes.status === 200 &&
      Array.isArray(tenantBConvRes.data?.data) &&
      tenantBConvRes.data?.data.length === 0;

    recordTest({
      testCaseId: 'TC-WA-05',
      module: 'WhatsApp',
      scenario: 'Strict multi-tenant isolation on WhatsApp messages and conversations',
      preconditions: 'Conversation belongs to Tenant A',
      testSteps: 'GET /api/whatsapp/conversations/:id/messages using Tenant B token',
      testData: tenantBConvRes.data,
      expectedResult: 'Empty list / no access to Tenant A messages',
      actualResult: `HTTP ${tenantBConvRes.status}, items=${tenantBConvRes.data?.data?.length}`,
      status: convIsolated ? 'PASS' : 'FAIL',
    });

    // =========================================================================
    // SUMMARY
    // =========================================================================
    const passCount = testResults.filter(t => t.status === 'PASS').length;
    const failCount = testResults.filter(t => t.status === 'FAIL').length;
    console.log('\n========================================================================================');
    console.log(`   TEST EXECUTION COMPLETE: Total ${testResults.length} | Passed: ${passCount} | Failed: ${failCount}`);
    console.log('========================================================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (server) {
      server.close();
    }
  }
}

if (import.meta.url.endsWith(process.argv[1])) {
  runFourModulesTest()
    .then(() => {
      console.log('Test run finished.');
      process.exit(process.exitCode || 0);
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}
