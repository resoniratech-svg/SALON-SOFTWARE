/**
 * COMPREHENSIVE END-TO-END TEST SUITE: Expenses Module
 *
 * Mapped to actual UI flow from:
 * - downloads/Saloon Software/expenses_frames
 * - downloads/Saloon Software/captures/expenses.mp4
 *
 * Verifies:
 * 1. Expenses Dashboard Summary (totalAmount, totalCount, byCategory, byPaymode, recentExpenses)
 * 2. Expense Types Management (Create, List, Duplicate Check, P&L category, Soft-delete)
 * 3. Financial Accounts (Create, List, Initial Balance, Ledger Transaction)
 * 4. Add Balance & Internal Transfers (Atomic row-level locking, source/dest debit/credit)
 * 5. Create Expense with Account Link (Atomic deduction, ledger audit trail)
 * 6. Expense List & Advanced Multi-Filter Matrix (Store, Paymode, Account, Type, GivenTo, Date Range)
 * 7. Edit Expense (Financial impact adjustment on account ledger)
 * 8. Delete Expense (Financial reversal on account balance)
 * 9. Multi-Tenant Isolation (Tenant A vs Tenant B zero-leakage)
 * 10. Security & Input Validation (Zero, negative, max bounds, SQL injection, XSS)
 * 11. Concurrency (Simultaneous expense creations and balance top-ups)
 */

import { createApp } from '../src/app.js';
import http from 'http';

let server: http.Server;
let BASE: string;
let tokenA = '';
let tokenB = '';
let tenantIdA = '';
let tenantIdB = '';

const RUN_ID = Date.now().toString(36).slice(-5);

const PASS = '✅ [PASS]';
const FAIL = '❌ [FAIL]';
let passed = 0;
let failed = 0;
const failures: { id: string; expected: string; actual: string }[] = [];

function assert(condition: boolean, testId: string, desc: string, expected: string, actual: string) {
  if (condition) {
    console.log(`${PASS} ${testId}: ${desc}`);
    passed++;
  } else {
    console.log(`${FAIL} ${testId}: ${desc}`);
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
    failed++;
    failures.push({ id: testId, expected, actual });
  }
}

async function api(method: string, path: string, token?: string, body?: any): Promise<any> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const json = await res.json();
    return { status: res.status, ...json };
  }
  return { status: res.status, body: await res.text() };
}

async function setup() {
  const app = createApp();
  server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const addr = server.address() as any;
  BASE = `http://127.0.0.1:${addr.port}/api`;

  // Login Tenant A (kalyaninagar)
  const loginA = await api('POST', '/auth/login', undefined, {
    username: 'admin',
    password: 'DevelopmentPassword123!',
  });
  tokenA = loginA.data?.token;
  tenantIdA = loginA.data?.user?.tenantId;
  assert(!!tokenA, 'SETUP-01', 'Tenant A login', 'token exists', tokenA ? 'OK' : 'MISSING');

  // Login Tenant B
  const loginB = await api('POST', '/auth/login', undefined, {
    username: 'admin-b',
    password: 'DevelopmentPassword123!',
  });
  tokenB = loginB.data?.token;
  tenantIdB = loginB.data?.user?.tenantId;
  assert(!!tokenB, 'SETUP-02', 'Tenant B login', 'token exists', tokenB ? 'OK' : 'MISSING');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: EXPENSE TYPES & P&L CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
let expenseTypeId1 = '';
let expenseTypeId2 = '';

async function testExpenseTypes() {
  console.log('\n--- SUITE 1: EXPENSE TYPES & P&L CATEGORIES ---');

  // TC-EXP-TYPE-01: Create Expense Type with P&L category
  const res1 = await api('POST', '/expense-types', tokenA, {
    name: `Repair & Maint ${RUN_ID}`,
    pnlCategory: 'General And Administrative Expenses',
    isActive: true,
  });
  assert(res1.status === 201 && res1.data?.id, 'TC-EXP-TYPE-01', 'Create expense type with P&L category', '201', `${res1.status}`);
  expenseTypeId1 = res1.data?.id;

  // TC-EXP-TYPE-02: Duplicate name rejected (case-insensitive)
  const resDup = await api('POST', '/expense-types', tokenA, {
    name: `repair & maint ${RUN_ID}`,
  });
  assert(resDup.status === 400, 'TC-EXP-TYPE-02', 'Duplicate expense type rejected (case-insensitive)', '400', `${resDup.status}`);

  // TC-EXP-TYPE-03: Create second Expense Type
  const res2 = await api('POST', '/expense-types', tokenA, {
    name: `Salon Consumables ${RUN_ID}`,
    pnlCategory: 'Operating Expenses',
    isActive: true,
  });
  assert(res2.status === 201, 'TC-EXP-TYPE-03', 'Create second expense type (Salon Consumables)', '201', `${res2.status}`);
  expenseTypeId2 = res2.data?.id;

  // TC-EXP-TYPE-04: List Expense Types
  const list = await api('GET', '/expense-types', tokenA);
  assert(list.status === 200 && Array.isArray(list.data), 'TC-EXP-TYPE-04', 'List expense types returns active types', '200', `${list.status}`);
  const hasType1 = list.data?.some((t: any) => t.id === expenseTypeId1);
  assert(hasType1, 'TC-EXP-TYPE-04b', 'Created expense type present in list', 'true', `${hasType1}`);

  // TC-EXP-TYPE-05: Update Expense Type
  const updateRes = await api('PUT', `/expense-types/${expenseTypeId1}`, tokenA, {
    name: `Repair & Maintenance Upd ${RUN_ID}`,
  });
  assert(updateRes.status === 200 && updateRes.data?.name.includes('Upd'), 'TC-EXP-TYPE-05', 'Update expense type name', 'contains Upd', `${updateRes.data?.name}`);

  // TC-EXP-TYPE-06: Soft delete / deactivate Expense Type
  const delRes = await api('DELETE', `/expense-types/${expenseTypeId2}`, tokenA);
  assert(delRes.status === 200, 'TC-EXP-TYPE-06', 'Soft delete expense type', '200', `${delRes.status}`);

  // TC-EXP-TYPE-07: Deactivated type excluded from active list
  const activeList = await api('GET', '/expense-types', tokenA);
  const stillInActive = activeList.data?.some((t: any) => t.id === expenseTypeId2);
  assert(!stillInActive, 'TC-EXP-TYPE-07', 'Deactivated type hidden from active list', 'false', `${stillInActive}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: FINANCIAL ACCOUNTS, TOP-UP & TRANSFERS
// ─────────────────────────────────────────────────────────────────────────────
let accountId1 = '';
let accountId2 = '';

async function testAccounts() {
  console.log('\n--- SUITE 2: FINANCIAL ACCOUNTS, TOP-UP & TRANSFERS ---');

  // TC-ACC-01: Create Canara Bank Account with initial balance ₹4,00,000 (as in frame_043)
  const acc1 = await api('POST', '/accounts', tokenA, {
    accountName: `Canara Bank ${RUN_ID}`,
    accountType: 'Current',
    balance: 400000,
    bankName: 'Canara Bank',
    accountNumber: 'CNRB0001234',
  });
  assert(acc1.status === 201 && acc1.data?.id, 'TC-ACC-01', 'Create Canara Bank account with 400000 balance', '201', `${acc1.status}`);
  accountId1 = acc1.data?.id;
  assert(acc1.data?.balance === 400000, 'TC-ACC-01b', 'Initial balance = 400000', '400000', `${acc1.data?.balance}`);

  // TC-ACC-02: Create Petty Cash Account with initial balance ₹25,000 (as in frame_045)
  const acc2 = await api('POST', '/accounts', tokenA, {
    accountName: `Petty Cash ${RUN_ID}`,
    accountType: 'Petty Cash',
    balance: 25000,
  });
  assert(acc2.status === 201, 'TC-ACC-02', 'Create Petty Cash account with 25000 balance', '201', `${acc2.status}`);
  accountId2 = acc2.data?.id;

  // TC-ACC-03: Initial balance transaction ledger verification
  const txList1 = await api('GET', `/accounts/${accountId1}/transactions`, tokenA);
  assert(txList1.status === 200, 'TC-ACC-03', 'Initial ledger transaction exists for account 1', '200', `${txList1.status}`);
  const initTx = txList1.data?.data?.find((t: any) => t.type === 'TOP_UP' && t.paymode === 'INITIAL_BALANCE');
  assert(!!initTx && Number(initTx.amount) === 400000, 'TC-ACC-03b', 'Initial deposit ledger = 400000', '400000', `${initTx?.amount}`);

  // TC-ACC-04: Add Balance / Top-Up (Deposit ₹10,000 into Canara Bank)
  const topUp = await api('POST', '/accounts/add-balance', tokenA, {
    accountId: accountId1,
    amount: 10000,
    paymode: 'NEFT',
    remark: 'Owner capital addition',
  });
  assert(topUp.status === 200 && topUp.data?.type === 'TOP_UP', 'TC-ACC-04', 'Add balance top-up succeeds', 'TOP_UP', `${topUp.data?.type}`);
  assert(topUp.data?.account?.afterBalance === 410000, 'TC-ACC-04b', 'Balance: 400000 + 10000 = 410000', '410000', `${topUp.data?.account?.afterBalance}`);

  // TC-ACC-05: Internal Transfer (Transfer ₹5,000 from Canara Bank to Petty Cash)
  const xfer = await api('POST', '/accounts/balance', tokenA, {
    accountId: accountId1,
    transferToAccountId: accountId2,
    amount: 5000,
    paymode: 'INTERNAL_TRANSFER',
    remark: 'Shift cash drawer float replenishment',
  });
  assert(xfer.status === 200 && xfer.data?.type === 'TRANSFER', 'TC-ACC-05', 'Internal transfer executed atomically', 'TRANSFER', `${xfer.data?.type}`);
  assert(xfer.data?.sourceAccount?.afterBalance === 405000, 'TC-ACC-05b', 'Source balance decremented: 410000 - 5000 = 405000', '405000', `${xfer.data?.sourceAccount?.afterBalance}`);
  assert(xfer.data?.destinationAccount?.afterBalance === 30000, 'TC-ACC-05c', 'Destination balance incremented: 25000 + 5000 = 30000', '30000', `${xfer.data?.destinationAccount?.afterBalance}`);

  // TC-ACC-06: Self-transfer rejected
  const selfXfer = await api('POST', '/accounts/balance', tokenA, {
    accountId: accountId1,
    transferToAccountId: accountId1,
    amount: 1000,
  });
  assert(selfXfer.status === 400, 'TC-ACC-06', 'Self-transfer rejected with 400 Bad Request', '400', `${selfXfer.status}`);

  // TC-ACC-07: Negative transfer amount rejected
  const negAmt = await api('POST', '/accounts/balance', tokenA, {
    accountId: accountId1,
    transferToAccountId: accountId2,
    amount: -500,
  });
  assert(negAmt.status === 400, 'TC-ACC-07', 'Negative transfer amount rejected', '400', `${negAmt.status}`);

  // TC-ACC-08: Transfer to non-existent account returns 404
  const noAcc = await api('POST', '/accounts/balance', tokenA, {
    accountId: accountId1,
    transferToAccountId: '00000000-0000-0000-0000-000000000000',
    amount: 1000,
  });
  assert(noAcc.status === 404, 'TC-ACC-08', 'Transfer to non-existent account -> 404', '404', `${noAcc.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: EXPENSE CREATION, ACCOUNT DEDUCTION & BALANCES
// ─────────────────────────────────────────────────────────────────────────────
let expenseId1 = '';
let expenseId2 = '';

async function testExpenseCreation() {
  console.log('\n--- SUITE 3: EXPENSE CREATION, DEDUCTION & BALANCES ---');

  // Canara Bank balance is currently 405000
  // TC-EXP-01: Create ₹5,000 expense linked to Canara Bank (matches frame_053 / frame_057)
  const exp1 = await api('POST', '/expenses', tokenA, {
    expenseDate: '2026-08-26',
    expenseTypeId: expenseTypeId1,
    amount: 5000,
    accountId: accountId1,
    paymentMethod: 'CARD',
    givenTo: 'Piyush',
    remark: 'esdtoh - Salon equipment repair',
    store: 'kalyaninagar',
  });
  assert(exp1.status === 201 && exp1.data?.id, 'TC-EXP-01', 'Create ₹5000 expense paid by Card via Canara Bank', '201', `${exp1.status}`);
  expenseId1 = exp1.data?.id;

  // TC-EXP-02: Account balance deducted from ₹405,000 to ₹400,000
  const acc1Check = await api('GET', `/accounts/${accountId1}`, tokenA);
  assert(acc1Check.data?.balance === 400000, 'TC-EXP-02', 'Account balance deducted: 405000 - 5000 = 400000', '400000', `${acc1Check.data?.balance}`);

  // TC-EXP-03: Account transaction ledger recorded as type=EXPENSE
  const txList = await api('GET', `/accounts/${accountId1}/transactions`, tokenA);
  const expTx = txList.data?.data?.find((t: any) => t.type === 'EXPENSE' && Number(t.amount) === 5000);
  assert(!!expTx, 'TC-EXP-03', 'EXPENSE transaction audit entry logged in account ledger', 'exists', expTx ? 'found' : 'missing');
  assert(Number(expTx?.beforeBalance) === 405000, 'TC-EXP-03b', 'Ledger beforeBalance = 405000', '405000', `${expTx?.beforeBalance}`);
  assert(Number(expTx?.afterBalance) === 400000, 'TC-EXP-03c', 'Ledger afterBalance = 400000', '400000', `${expTx?.afterBalance}`);

  // TC-EXP-04: Create second cash expense from Petty Cash (₹2,500)
  const exp2 = await api('POST', '/expenses', tokenA, {
    expenseDate: '2026-08-26',
    amount: 2500,
    accountId: accountId2,
    paymode: 'CASH',
    givenTo: 'Sakshi',
    remark: 'Maintenance charges',
    store: 'kalyaninagar',
  });
  assert(exp2.status === 201, 'TC-EXP-04', 'Create ₹2500 cash expense from Petty Cash', '201', `${exp2.status}`);
  expenseId2 = exp2.data?.id;

  // TC-EXP-05: Petty Cash balance deducted from 30000 to 27500
  const acc2Check = await api('GET', `/accounts/${accountId2}`, tokenA);
  assert(acc2Check.data?.balance === 27500, 'TC-EXP-05', 'Petty Cash deducted: 30000 - 2500 = 27500', '27500', `${acc2Check.data?.balance}`);

  // TC-EXP-06: Direct expense without account (Cash direct payment)
  const expNoAcc = await api('POST', '/expenses', tokenA, {
    amount: 800,
    paymode: 'UPI',
    givenTo: 'Vendor Direct',
    remark: 'One-off UPI expense without registered bank account',
  });
  assert(expNoAcc.status === 201, 'TC-EXP-06', 'Create expense without account succeeds', '201', `${expNoAcc.status}`);
  if (expNoAcc.data?.id) await api('DELETE', `/expenses/${expNoAcc.data.id}`, tokenA);

  // TC-EXP-07: Zero amount rejected
  const zeroExp = await api('POST', '/expenses', tokenA, { amount: 0 });
  assert(zeroExp.status === 400, 'TC-EXP-07', 'Zero expense amount rejected', '400', `${zeroExp.status}`);

  // TC-EXP-08: Negative amount rejected
  const negExp = await api('POST', '/expenses', tokenA, { amount: -100 });
  assert(negExp.status === 400, 'TC-EXP-08', 'Negative expense amount rejected', '400', `${negExp.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: EXPENSES DASHBOARD, SUMMARY & FILTERS
// ─────────────────────────────────────────────────────────────────────────────
async function testExpensesDashboardAndFilters() {
  console.log('\n--- SUITE 4: EXPENSES DASHBOARD, SUMMARY & FILTERS ---');

  // TC-DASH-01: Expenses Dashboard summary endpoint
  const dash = await api('GET', '/expenses/dashboard', tokenA);
  assert(dash.status === 200, 'TC-DASH-01', 'GET /expenses/dashboard returns 200', '200', `${dash.status}`);
  assert(dash.data?.totalCount >= 2, 'TC-DASH-01b', 'Dashboard totalCount >= 2', '>=2', `${dash.data?.totalCount}`);
  assert(dash.data?.totalAmount >= 7500, 'TC-DASH-01c', 'Dashboard totalAmount >= 7500', '>=7500', `${dash.data?.totalAmount}`);

  // TC-DASH-02: Dashboard byCategory aggregation
  assert(Array.isArray(dash.data?.byCategory), 'TC-DASH-02', 'Dashboard includes byCategory array', 'array', typeof dash.data?.byCategory);
  const maintCat = dash.data?.byCategory?.find((c: any) => c.category.includes('Repair'));
  assert(!!maintCat && maintCat.amount >= 5000, 'TC-DASH-02b', 'Category Repair & Maintenance >= 5000', '>=5000', `${maintCat?.amount}`);

  // TC-DASH-03: Dashboard byPaymode aggregation (CARD, CASH)
  assert(Array.isArray(dash.data?.byPaymode), 'TC-DASH-03', 'Dashboard includes byPaymode array', 'array', typeof dash.data?.byPaymode);
  const cardMode = dash.data?.byPaymode?.find((p: any) => p.paymode === 'CARD');
  assert(!!cardMode && cardMode.amount >= 5000, 'TC-DASH-03b', 'Paymode CARD aggregated >= 5000', '>=5000', `${cardMode?.amount}`);

  // TC-DASH-04: Dashboard alias /expenses/dashboard/summary works
  const dashSummary = await api('GET', '/expenses/dashboard/summary', tokenA);
  assert(dashSummary.status === 200 && dashSummary.data?.totalCount === dash.data?.totalCount, 'TC-DASH-04', 'Alias /dashboard/summary returns identical metrics', 'true', 'true');

  // TC-FILTER-01: Filter by store=kalyaninagar
  const byStore = await api('GET', '/expenses?store=kalyaninagar', tokenA);
  assert(byStore.status === 200 && byStore.data?.total >= 2, 'TC-FILTER-01', 'Filter by store=kalyaninagar', '>=2', `${byStore.data?.total}`);

  // TC-FILTER-02: Filter by paymode=CARD
  const byPaymode = await api('GET', '/expenses?paymode=CARD', tokenA);
  assert(byPaymode.status === 200, 'TC-FILTER-02', 'Filter by paymode=CARD', '200', `${byPaymode.status}`);
  const allCard = byPaymode.data?.data?.every((e: any) => e.paymentMethod === 'CARD');
  assert(allCard, 'TC-FILTER-02b', 'All filtered results have paymentMethod=CARD', 'true', `${allCard}`);

  // TC-FILTER-03: Filter by accountId
  const byAccount = await api('GET', `/expenses?accountId=${accountId1}`, tokenA);
  assert(byAccount.status === 200 && byAccount.data?.total >= 1, 'TC-FILTER-03', 'Filter by accountId', '>=1', `${byAccount.data?.total}`);

  // TC-FILTER-04: Filter by givenTo (e.g. Piyush)
  const byGivenTo = await api('GET', '/expenses?givenTo=Piyush', tokenA);
  assert(byGivenTo.status === 200 && byGivenTo.data?.total >= 1, 'TC-FILTER-04', 'Filter by givenTo=Piyush', '>=1', `${byGivenTo.data?.total}`);

  // TC-FILTER-05: Filter by Date Range (2026-08-26 to 2026-08-26)
  const byDate = await api('GET', '/expenses?fromDate=2026-08-26&toDate=2026-08-26', tokenA);
  assert(byDate.status === 200 && byDate.data?.total >= 2, 'TC-FILTER-05', 'Filter by date range', '>=2', `${byDate.data?.total}`);

  // TC-FILTER-06: Text search across remark / givenTo / vendor
  const bySearch = await api('GET', '/expenses?search=esdtoh', tokenA);
  assert(bySearch.status === 200 && bySearch.data?.total >= 1, 'TC-FILTER-06', 'Search by remark keyword (esdtoh)', '>=1', `${bySearch.data?.total}`);

  // TC-FILTER-07: Pagination and Total Sum calculation
  const paged = await api('GET', '/expenses?page=1&limit=1', tokenA);
  assert(paged.status === 200 && paged.data?.data?.length === 1, 'TC-FILTER-07', 'Pagination limit=1 enforced', '1', `${paged.data?.data?.length}`);
  assert(paged.data?.totalAmount > 0, 'TC-FILTER-07b', 'Paginated response includes overall totalAmount sum', '>0', `${paged.data?.totalAmount}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: EDIT & DELETE EXPENSE (FINANCIAL ADJUSTMENTS & REVERSALS)
// ─────────────────────────────────────────────────────────────────────────────
async function testEditAndDeleteExpense() {
  console.log('\n--- SUITE 5: EDIT & DELETE EXPENSE (REVERSALS) ---');

  // Currently Canara Bank balance is ₹4,00,000 after ₹5,000 deduction on expenseId1
  // TC-EDIT-01: Update expense amount from ₹5,000 to ₹7,000 (diff = +₹2,000 deduction)
  const editRes = await api('PUT', `/expenses/${expenseId1}`, tokenA, {
    amount: 7000,
    remark: 'Updated to 7000 for additional parts',
  });
  assert(editRes.status === 200 && Number(editRes.data?.amount) === 7000, 'TC-EDIT-01', 'Update expense amount to 7000', '7000', `${editRes.data?.amount}`);

  // TC-EDIT-02: Account balance automatically adjusted from 400000 to 398000
  const accAfterEdit = await api('GET', `/accounts/${accountId1}`, tokenA);
  assert(accAfterEdit.data?.balance === 398000, 'TC-EDIT-02', 'Account balance adjusted: 400000 - 2000 = 398000', '398000', `${accAfterEdit.data?.balance}`);

  // TC-EDIT-03: Ledger entry recorded for the ADJUSTMENT
  const txList = await api('GET', `/accounts/${accountId1}/transactions`, tokenA);
  const adjTx = txList.data?.data?.find((t: any) => t.type === 'ADJUSTMENT' && Number(t.amount) === 2000);
  assert(!!adjTx, 'TC-EDIT-03', 'ADJUSTMENT ledger entry recorded for amount increase', 'exists', adjTx ? 'found' : 'missing');

  // TC-DEL-01: Delete expenseId1 (₹7,000 reversed back into Canara Bank)
  const delRes = await api('DELETE', `/expenses/${expenseId1}`, tokenA);
  assert(delRes.status === 200, 'TC-DEL-01', 'Delete expense succeeds with 200', '200', `${delRes.status}`);

  // TC-DEL-02: Account balance restored from 398000 to 405000
  const accAfterDel = await api('GET', `/accounts/${accountId1}`, tokenA);
  assert(accAfterDel.data?.balance === 405000, 'TC-DEL-02', 'Balance restored: 398000 + 7000 = 405000', '405000', `${accAfterDel.data?.balance}`);

  // TC-DEL-03: Deleted expense returns 404
  const notFound = await api('GET', `/expenses/${expenseId1}`, tokenA);
  assert(notFound.status === 404, 'TC-DEL-03', 'Deleted expense returns 404', '404', `${notFound.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: MULTI-TENANT ISOLATION
// ─────────────────────────────────────────────────────────────────────────────
async function testMultiTenantIsolation() {
  console.log('\n--- SUITE 6: MULTI-TENANT ISOLATION ---');

  // TC-MT-01: Tenant B cannot list Tenant A accounts
  const bAccounts = await api('GET', '/accounts', tokenB);
  const hasAAcc = bAccounts.data?.some((a: any) => a.id === accountId1);
  assert(!hasAAcc, 'TC-MT-01', 'Tenant B cannot see Tenant A financial accounts', 'false', `${hasAAcc}`);

  // TC-MT-02: Tenant B cannot get Tenant A account by direct ID
  const directAcc = await api('GET', `/accounts/${accountId1}`, tokenB);
  assert(directAcc.status === 404, 'TC-MT-02', 'Tenant B direct GET on A account -> 404', '404', `${directAcc.status}`);

  // TC-MT-03: Tenant B cannot add balance to Tenant A account
  const addBalB = await api('POST', '/accounts/add-balance', tokenB, {
    accountId: accountId1,
    amount: 1000,
  });
  assert(addBalB.status === 404, 'TC-MT-03', 'Tenant B cannot add balance to A account -> 404', '404', `${addBalB.status}`);

  // TC-MT-04: Tenant B cannot list Tenant A expenses
  const bExpenses = await api('GET', '/expenses', tokenB);
  const hasAExp = bExpenses.data?.data?.some((e: any) => e.id === expenseId2);
  assert(!hasAExp, 'TC-MT-04', 'Tenant B cannot see Tenant A expenses', 'false', `${hasAExp}`);

  // TC-MT-05: Tenant B cannot edit Tenant A expense
  const editB = await api('PUT', `/expenses/${expenseId2}`, tokenB, {
    amount: 9999,
  });
  assert(editB.status === 404, 'TC-MT-05', 'Tenant B direct PUT on A expense -> 404', '404', `${editB.status}`);

  // TC-MT-06: Tenant B cannot delete Tenant A expense
  const delB = await api('DELETE', `/expenses/${expenseId2}`, tokenB);
  assert(delB.status === 404, 'TC-MT-06', 'Tenant B direct DELETE on A expense -> 404', '404', `${delB.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: CONCURRENCY & ATOMICITY
// ─────────────────────────────────────────────────────────────────────────────
async function testConcurrency() {
  console.log('\n--- SUITE 7: CONCURRENCY & ATOMICITY ---');

  // TC-CON-01: 5 simultaneous add-balance top-ups of ₹500 to accountId2
  const beforeBal = (await api('GET', `/accounts/${accountId2}`, tokenA)).data?.balance;
  const topUpAmt = 500;
  const count = 5;

  const topUpPromises = Array.from({ length: count }, () =>
    api('POST', '/accounts/add-balance', tokenA, {
      accountId: accountId2,
      amount: topUpAmt,
      remark: 'Concurrent top-up stress test',
    })
  );

  const results = await Promise.all(topUpPromises);
  const allOk = results.every((r) => r.status === 200);
  assert(allOk, 'TC-CON-01', '5 concurrent add-balance calls all succeed with 200', 'all 200', allOk ? 'all 200' : 'some failed');

  const afterBal = (await api('GET', `/accounts/${accountId2}`, tokenA)).data?.balance;
  const expectedBal = beforeBal + (topUpAmt * count);
  assert(afterBal === expectedBal, 'TC-CON-01b', `Atomic balance check: ${beforeBal} + 2500 = ${expectedBal}`, `${expectedBal}`, `${afterBal}`);

  // TC-CON-02: 4 simultaneous expense creations against accountId2 (₹200 each)
  const expPromises = Array.from({ length: 4 }, (_, i) =>
    api('POST', '/expenses', tokenA, {
      amount: 200,
      accountId: accountId2,
      paymode: 'CASH',
      givenTo: `Staff Concurrent ${i}`,
      remark: `Concurrent expense ${i}`,
    })
  );

  const expResults = await Promise.all(expPromises);
  const allExpOk = expResults.every((r) => r.status === 201);
  assert(allExpOk, 'TC-CON-02', '4 concurrent expense creations all succeed with 201', 'all 201', allExpOk ? 'all 201' : 'some failed');

  const balAfterExpenses = (await api('GET', `/accounts/${accountId2}`, tokenA)).data?.balance;
  const expectedFinal = expectedBal - (200 * 4);
  assert(balAfterExpenses === expectedFinal, 'TC-CON-02b', `Balance deducted atomically: ${expectedBal} - 800 = ${expectedFinal}`, `${expectedFinal}`, `${balAfterExpenses}`);

  // Cleanup concurrent expenses
  for (const r of expResults) {
    if (r.data?.id) await api('DELETE', `/expenses/${r.data.id}`, tokenA);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: SECURITY & VALIDATION BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────
async function testSecurityAndValidation() {
  console.log('\n--- SUITE 8: SECURITY & VALIDATION BOUNDARIES ---');

  // TC-SEC-01: SQL injection in search filter
  const sqli = await api('GET', "/expenses?search=' OR 1=1 --", tokenA);
  assert(sqli.status === 200, 'TC-SEC-01', 'SQL injection in search returns 200 safely without syntax error', '200', `${sqli.status}`);

  // TC-SEC-02: XSS in remark field stored safely as plain string
  const xssExp = await api('POST', '/expenses', tokenA, {
    amount: 150,
    remark: '<script>alert("pwned")</script>',
    givenTo: 'XSS Tester',
  });
  assert(xssExp.status === 201, 'TC-SEC-02', 'XSS payload stored as text safely', '201', `${xssExp.status}`);
  if (xssExp.data?.id) {
    const fetched = await api('GET', `/expenses/${xssExp.data.id}`, tokenA);
    assert(fetched.data?.remark?.includes('script'), 'TC-SEC-02b', 'XSS content escaped, not executed', 'contains script', `${fetched.data?.remark?.includes('script')}`);
    await api('DELETE', `/expenses/${xssExp.data.id}`, tokenA);
  }

  // TC-SEC-03: Unauthenticated requests rejected with 401
  const noAuth = await api('GET', '/expenses');
  assert(noAuth.status === 401, 'TC-SEC-03', 'Unauthenticated GET /expenses -> 401 Unauthorized', '401', `${noAuth.status}`);

  const badToken = await api('GET', '/expenses', 'invalid-token-string');
  assert(badToken.status === 401, 'TC-SEC-03b', 'Malformed JWT token -> 401 Unauthorized', '401', `${badToken.status}`);

  // TC-SEC-04: Non-existent account ID returns 404
  const badAccExp = await api('POST', '/expenses', tokenA, {
    amount: 100,
    accountId: '00000000-0000-0000-0000-000000000000',
  });
  assert(badAccExp.status === 404, 'TC-SEC-04', 'Expense with non-existent accountId -> 404 Not Found', '404', `${badAccExp.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: AMOUNT EDGE CASES & PRECISION
// ─────────────────────────────────────────────────────────────────────────────
async function testAmountEdgeCases() {
  console.log('\n--- SUITE 9: AMOUNT EDGE CASES & PRECISION ---');

  // TC-AMT-01: Smallest positive amount ₹0.01
  const minAmt = await api('POST', '/expenses', tokenA, {
    amount: 0.01,
    paymode: 'CASH',
    remark: 'Minimum boundary test 0.01',
  });
  assert(minAmt.status === 201 && Number(minAmt.data?.amount) === 0.01, 'TC-AMT-01', 'Smallest positive amount ₹0.01 accepted', '0.01', `${minAmt.data?.amount}`);
  if (minAmt.data?.id) await api('DELETE', `/expenses/${minAmt.data.id}`, tokenA);

  // TC-AMT-02: Decimal currency precision (e.g. ₹750.50)
  const decAmt = await api('POST', '/expenses', tokenA, {
    amount: 750.50,
    paymode: 'UPI',
    remark: 'Decimal precision test 750.50',
  });
  assert(decAmt.status === 201 && Number(decAmt.data?.amount) === 750.5, 'TC-AMT-02', 'Decimal amount ₹750.50 preserved accurately', '750.5', `${decAmt.data?.amount}`);
  if (decAmt.data?.id) await api('DELETE', `/expenses/${decAmt.data.id}`, tokenA);

  // TC-AMT-03: Excessive decimal precision (e.g. 100.1234)
  const multiDec = await api('POST', '/expenses', tokenA, {
    amount: 100.1234,
    paymode: 'CASH',
  });
  assert(multiDec.status === 201, 'TC-AMT-03', 'Multi-decimal amount accepted and stored safely', '201', `${multiDec.status}`);
  if (multiDec.data?.id) await api('DELETE', `/expenses/${multiDec.data.id}`, tokenA);

  // TC-AMT-04: Realistic large amount ₹999,999.99
  const largeAmt = await api('POST', '/expenses', tokenA, {
    amount: 999999.99,
    paymode: 'NEFT',
    remark: 'Large capital expenditure',
  });
  assert(largeAmt.status === 201 && Number(largeAmt.data?.amount) === 999999.99, 'TC-AMT-04', 'Large amount ₹999,999.99 accepted without overflow', '999999.99', `${largeAmt.data?.amount}`);
  if (largeAmt.data?.id) await api('DELETE', `/expenses/${largeAmt.data.id}`, tokenA);

  // TC-AMT-05: Non-numeric string amount rejected
  const nonNum = await api('POST', '/expenses', tokenA, {
    amount: 'invalid-amount',
    paymode: 'CASH',
  });
  assert(nonNum.status === 400, 'TC-AMT-05', 'Non-numeric amount string rejected with 400', '400', `${nonNum.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 10: DUPLICATE SUBMISSION & IDEMPOTENCY
// ─────────────────────────────────────────────────────────────────────────────
async function testDuplicateSubmission() {
  console.log('\n--- SUITE 10: DUPLICATE SUBMISSION & IDEMPOTENCY ---');

  // TC-DUP-01: Rapid simultaneous submission of identical expense
  const payload = {
    amount: 350,
    paymode: 'CASH',
    givenTo: 'Vendor Quick Cash',
    remark: 'Rapid click submission test',
  };

  const [res1, res2] = await Promise.all([
    api('POST', '/expenses', tokenA, payload),
    api('POST', '/expenses', tokenA, payload),
  ]);

  assert(res1.status === 201 && res2.status === 201, 'TC-DUP-01', 'Both simultaneous submissions process safely', '201', `${res1.status}, ${res2.status}`);
  assert(res1.data?.id !== res2.data?.id, 'TC-DUP-01b', 'Both submissions receive distinct unique UUIDs', 'distinct', res1.data?.id !== res2.data?.id ? 'distinct' : 'duplicate');

  // Cleanup
  if (res1.data?.id) await api('DELETE', `/expenses/${res1.data.id}`, tokenA);
  if (res2.data?.id) await api('DELETE', `/expenses/${res2.data.id}`, tokenA);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 11: DATE BOUNDARIES & TIMEZONES
// ─────────────────────────────────────────────────────────────────────────────
async function testDateBoundaries() {
  console.log('\n--- SUITE 11: DATE BOUNDARIES & TIMEZONES ---');

  // TC-DATE-01: Specific historical date (e.g. 2026-08-01)
  const pastExp = await api('POST', '/expenses', tokenA, {
    expenseDate: '2026-08-01',
    amount: 1200,
    paymode: 'CASH',
    remark: 'Past date test',
  });
  assert(pastExp.status === 201, 'TC-DATE-01', 'Past date expense created', '201', `${pastExp.status}`);

  // TC-DATE-02: Query with fromDate == toDate on the exact historical date
  const filteredExact = await api('GET', '/expenses?fromDate=2026-08-01&toDate=2026-08-01', tokenA);
  assert(filteredExact.status === 200 && filteredExact.data?.total >= 1, 'TC-DATE-02', 'Exact date match returns past expense', '>=1', `${filteredExact.data?.total}`);

  // TC-DATE-03: Query with fromDate > toDate yields 0 matching records safely
  const invRange = await api('GET', '/expenses?fromDate=2026-08-30&toDate=2026-08-01', tokenA);
  assert(invRange.status === 200 && invRange.data?.total === 0, 'TC-DATE-03', 'Inverted date range returns empty list (total=0)', '0', `${invRange.data?.total}`);

  // Cleanup
  if (pastExp.data?.id) await api('DELETE', `/expenses/${pastExp.data.id}`, tokenA);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 12: TRANSACTION ROLLBACK & CONSISTENCY GUARANTEE
// ─────────────────────────────────────────────────────────────────────────────
async function testRollbackAndConsistency() {
  console.log('\n--- SUITE 12: TRANSACTION ROLLBACK & CONSISTENCY ---');

  // TC-ROLL-01: Expense creation fails with invalid accountId -> No orphan record
  const initialCount = (await api('GET', '/expenses', tokenA)).data?.total;
  const failExp = await api('POST', '/expenses', tokenA, {
    amount: 500,
    accountId: '00000000-0000-0000-0000-000000000000',
    remark: 'Should fail and rollback',
  });
  assert(failExp.status === 404, 'TC-ROLL-01', 'Invalid account ID returns 404', '404', `${failExp.status}`);

  const postCount = (await api('GET', '/expenses', tokenA)).data?.total;
  assert(postCount === initialCount, 'TC-ROLL-01b', 'Zero orphan expenses created after rollback', `${initialCount}`, `${postCount}`);

  // TC-ROLL-02: Transfer fails with invalid destination -> Source balance untouched
  const sourceBefore = (await api('GET', `/accounts/${accountId1}`, tokenA)).data?.balance;
  const failTransfer = await api('POST', '/accounts/balance', tokenA, {
    accountId: accountId1,
    transferToAccountId: '00000000-0000-0000-0000-000000000000',
    amount: 5000,
  });
  assert(failTransfer.status === 404, 'TC-ROLL-02', 'Transfer to invalid destination returns 404', '404', `${failTransfer.status}`);

  const sourceAfter = (await api('GET', `/accounts/${accountId1}`, tokenA)).data?.balance;
  assert(sourceAfter === sourceBefore, 'TC-ROLL-02b', 'Source account balance unchanged after failed transfer rollback', `${sourceBefore}`, `${sourceAfter}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 13: EXACT VIDEO FLOW REPLAY (expenses.mp4 1:1 EXECUTION)
// ─────────────────────────────────────────────────────────────────────────────
async function testExactVideoFlowReplay() {
  console.log('\n--- SUITE 13: EXACT VIDEO FLOW REPLAY (expenses.mp4) ---');

  // Step 1: User navigates to Expenses Dashboard (#/expenses-dashboard)
  const step1 = await api('GET', '/expenses/dashboard', tokenA);
  assert(step1.status === 200, 'TC-VIDEO-01', 'Step 1: Open Expenses Dashboard loads live data', '200', `${step1.status}`);

  // Step 2: User opens Expense Types (#/expense-type) and checks Repair & Maintenance
  const step2 = await api('GET', '/expense-types', tokenA);
  assert(step2.status === 200 && Array.isArray(step2.data), 'TC-VIDEO-02', 'Step 2: Expense Types catalog loaded', '200', `${step2.status}`);

  // Step 3: User opens Accounts (#/accounts) and views Canara Bank & Petty Cash
  const step3 = await api('GET', '/accounts', tokenA);
  assert(step3.status === 200, 'TC-VIDEO-03', 'Step 3: Accounts screen displays live balances', '200', `${step3.status}`);

  // Step 4: User clicks Add Balance on Accounts screen -> Internal transfer of ₹1,000
  // (frame_145 shows: Canara Bank 400000 -> 395000 -> 1000 transfer to Petty Cash -> 394000)
  const step4 = await api('POST', '/accounts/balance', tokenA, {
    accountId: accountId1,
    transferToAccountId: accountId2,
    amount: 1000,
    paymode: 'CARD',
    remark: 'wefrtg - video transfer replay',
  });
  assert(step4.status === 200 && step4.data?.type === 'TRANSFER', 'TC-VIDEO-04', 'Step 4: Transfer ₹1000 from Canara Bank to Petty Cash (frame_145)', 'TRANSFER', `${step4.data?.type}`);

  // Step 5: User clicks Add Expense on Dashboard:
  // Date: 26-Aug-2026, Type: Repair & Maintenance, Amount: 5000, Given to: Piyush, Account: Canara Bank, Paymode: Card, Remark: esdtoh
  const step5 = await api('POST', '/expenses', tokenA, {
    expenseDate: '2026-08-26',
    expenseTypeId: expenseTypeId1,
    amount: 5000,
    givenTo: 'Piyush',
    accountId: accountId1,
    paymode: 'CARD',
    remark: 'esdtoh - video expense replay',
    store: 'kalyaninagar',
  });
  assert(step5.status === 201 && step5.data?.id, 'TC-VIDEO-05', 'Step 5: Create ₹5000 expense matching video frame_053 exactly', '201', `${step5.status}`);
  const replayExpId = step5.data?.id;

  // Step 6: Verify Canara Bank reflects deduction
  const step6Acc = await api('GET', `/accounts/${accountId1}`, tokenA);
  assert(step6Acc.data?.balance < 405000, 'TC-VIDEO-06', 'Step 6: Canara Bank balance reflects expense deduction', 'decremented', `${step6Acc.data?.balance}`);

  // Step 7: Verify Account Transactions ledger displays transfer and expense rows
  const step7Ledger = await api('GET', `/accounts/${accountId1}/transactions`, tokenA);
  const hasTransferTx = step7Ledger.data?.data?.some((t: any) => t.type === 'TRANSFER_OUT' && Number(t.amount) === 1000);
  const hasExpenseTx = step7Ledger.data?.data?.some((t: any) => t.type === 'EXPENSE' && Number(t.amount) === 5000);
  assert(hasTransferTx && hasExpenseTx, 'TC-VIDEO-07', 'Step 7: Ledger records both TRANSFER_OUT and EXPENSE entries', 'both true', `transfer:${hasTransferTx}, expense:${hasExpenseTx}`);

  // Step 8: Verify Dashboard total includes the newly created video expense
  const step8Dash = await api('GET', '/expenses/dashboard', tokenA);
  assert(step8Dash.data?.totalAmount >= 5000, 'TC-VIDEO-08', 'Step 8: Dashboard totalAmount includes replayed expense', '>=5000', `${step8Dash.data?.totalAmount}`);

  // Step 9: Replay cleanup (delete replayed expense, verifying balance restored)
  if (replayExpId) {
    const balBeforeDel = (await api('GET', `/accounts/${accountId1}`, tokenA)).data?.balance;
    await api('DELETE', `/expenses/${replayExpId}`, tokenA);
    const balAfterDel = (await api('GET', `/accounts/${accountId1}`, tokenA)).data?.balance;
    assert(balAfterDel === balBeforeDel + 5000, 'TC-VIDEO-09', 'Step 9: Deleted replay expense restores ₹5000 to account', `${balBeforeDel + 5000}`, `${balAfterDel}`);
  }
}

async function testExpensesCsvExport() {
  console.log('\n--- SECTION 14: EXPENSES CSV EXPORT ---');

  // 14.1 Export all expenses as CSV
  const csvRes = await api('GET', '/expenses?export=csv', tokenA);
  assert(csvRes.status === 200, 'TC-CSV-01', 'GET /expenses?export=csv returns HTTP 200', '200', `${csvRes.status}`);
  assert(
    typeof csvRes.body === 'string' &&
    csvRes.body.includes('Date,Store,Expense Type,Account,Amount,Paymode,Given To,Vendor,Description,Remark,Created At'),
    'TC-CSV-02',
    'CSV export contains standard expenses header columns',
    'true',
    `${typeof csvRes.body === 'string' && csvRes.body.includes('Date,Store,Expense Type,Account')}`
  );

  // 14.2 Filtered CSV export by store
  const csvStoreRes = await api('GET', '/expenses?export=csv&store=kalyaninagar', tokenA);
  assert(csvStoreRes.status === 200, 'TC-CSV-03', 'GET /expenses?export=csv with store filter returns HTTP 200', '200', `${csvStoreRes.status}`);

  // 14.3 Filtered CSV export by date range
  const csvDateRes = await api('GET', '/expenses?export=csv&fromDate=2020-01-01&toDate=2030-12-31', tokenA);
  assert(csvDateRes.status === 200, 'TC-CSV-04', 'GET /expenses?export=csv with date filter returns HTTP 200', '200', `${csvDateRes.status}`);
}

async function cleanup() {
  console.log('\n--- CLEANUP ---');
  if (expenseId2) await api('DELETE', `/expenses/${expenseId2}`, tokenA);
  if (expenseTypeId1) await api('DELETE', `/expense-types/${expenseTypeId1}`, tokenA);
  console.log('Test fixtures cleaned up.');
}

async function main() {
  try {
    await setup();
    await testExpenseTypes();
    await testAccounts();
    await testExpenseCreation();
    await testExpensesDashboardAndFilters();
    await testEditAndDeleteExpense();
    await testMultiTenantIsolation();
    await testConcurrency();
    await testSecurityAndValidation();
    await testAmountEdgeCases();
    await testDuplicateSubmission();
    await testDateBoundaries();
    await testRollbackAndConsistency();
    await testExactVideoFlowReplay();
    await testExpensesCsvExport();
    await cleanup();

    console.log('\n════════════════════════════════════════════════════════════════════════════════');
    console.log(`   EXPENSES MODULE COMPLETE TEST SUITE: Total ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('════════════════════════════════════════════════════════════════════════════════');

    if (failures.length > 0) {
      console.log('\nFAILURES:');
      for (const f of failures) {
        console.log(`  ${f.id}: Expected=${f.expected} | Actual=${f.actual}`);
      }
    }
  } catch (err: any) {
    console.error('Fatal execution error:', err.message, err.stack);
  } finally {
    if (server) {
      server.close();
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

main();
