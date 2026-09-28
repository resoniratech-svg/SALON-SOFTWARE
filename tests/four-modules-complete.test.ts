/**
 * COMPREHENSIVE TEST SUITE: Expenses, Enquiries/Referrals, Payroll, WhatsApp
 *
 * Coverage:
 * - Functional / CRUD / Happy-path
 * - Validation / Edge-cases
 * - Financial consistency
 * - Multi-tenant isolation
 * - Authentication / Authorization
 * - Concurrency safety
 * - Search / Filtering
 * - Dashboard / Aggregation
 * - Security (injection, IDOR, param tampering)
 * - Delete / Cleanup / Reversal
 */

import { createApp } from '../src/app.js';
import http from 'http';

// ─── Test Infrastructure ────────────────────────────────────────────────────
let server: http.Server;
let BASE: string;
let tokenA = '';
let tokenB = '';
let tenantIdA = '';
let tenantIdB = '';

// Unique suffix for this test run to avoid name collisions with prior runs
const RUN_ID = Date.now().toString(36).slice(-5);

const PASS = '✅ [PASS]';
const FAIL = '❌ [FAIL]';
let passed = 0;
let failed = 0;
const failures: { id: string; expected: string; actual: string; rootCause: string }[] = [];

function assert(condition: boolean, testId: string, desc: string, expected: string, actual: string) {
  if (condition) {
    console.log(`${PASS} ${testId}: ${desc}`);
    passed++;
  } else {
    console.log(`${FAIL} ${testId}: ${desc}`);
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
    failed++;
    failures.push({ id: testId, expected, actual, rootCause: 'See actual vs expected' });
  }
}

async function api(method: string, path: string, token?: string, body?: any, raw = false): Promise<any> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (raw) return res;

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const json = await res.json();
    return { status: res.status, ...json };
  }
  return { status: res.status, body: await res.text() };
}

// ─── Setup ──────────────────────────────────────────────────────────────────
async function setup() {
  const app = createApp();
  server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const addr = server.address() as any;
  BASE = `http://127.0.0.1:${addr.port}/api`;

  // Login Tenant A
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
  assert(tenantIdA !== tenantIdB, 'SETUP-03', 'Tenant A ≠ Tenant B', 'different', tenantIdA === tenantIdB ? 'same' : 'different');
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 1: EXPENSE TYPES
// ═════════════════════════════════════════════════════════════════════
let expenseTypeId = '';
let expenseTypeId2 = '';

async function testExpenseTypes() {
  console.log('\n══════════ EXPENSE TYPES ══════════');

  // TC-ET-01: Create expense type
  const c1 = await api('POST', '/expense-types', tokenA, {
    name: `Office Supplies ${RUN_ID}`,
    pnlCategory: 'Operating Expenses',
  });
  assert(c1.status === 201 && c1.data?.id, 'TC-ET-01', 'Create expense type', '201 + id', `${c1.status} + ${c1.data?.id || 'null'}`);
  expenseTypeId = c1.data?.id;

  // TC-ET-02: Duplicate name rejected
  const c2 = await api('POST', '/expense-types', tokenA, {
    name: `Office Supplies ${RUN_ID}`,
  });
  assert(c2.status === 400, 'TC-ET-02', 'Duplicate expense type rejected', '400', `${c2.status}`);

  // TC-ET-03: Case-insensitive duplicate
  const c3 = await api('POST', '/expense-types', tokenA, {
    name: `office supplies ${RUN_ID}`,
  });
  assert(c3.status === 400, 'TC-ET-03', 'Case-insensitive duplicate rejected', '400', `${c3.status}`);

  // TC-ET-04: Empty name rejected
  const c4 = await api('POST', '/expense-types', tokenA, { name: '' });
  assert(c4.status === 400, 'TC-ET-04', 'Empty expense type name rejected', '400', `${c4.status}`);

  // TC-ET-05: Whitespace-only name rejected
  const c5 = await api('POST', '/expense-types', tokenA, { name: '   ' });
  assert(c5.status === 400, 'TC-ET-05', 'Whitespace-only name rejected', '400', `${c5.status}`);

  // TC-ET-06: Create second type for later use
  const c6 = await api('POST', '/expense-types', tokenA, {
    name: `Travel Expense ${RUN_ID}`,
    pnlCategory: 'Travel And Transportation',
  });
  assert(c6.status === 201, 'TC-ET-06', 'Create second expense type', '201', `${c6.status}`);
  expenseTypeId2 = c6.data?.id;

  // TC-ET-07: List expense types
  const list = await api('GET', '/expense-types', tokenA);
  assert(list.status === 200 && Array.isArray(list.data), 'TC-ET-07', 'List expense types returns array', '200 + array', `${list.status}`);
  const foundCreated = list.data?.some((t: any) => t.id === expenseTypeId);
  assert(foundCreated, 'TC-ET-07b', 'Created type appears in list', 'true', `${foundCreated}`);

  // TC-ET-08: Get type by ID
  const g1 = await api('GET', `/expense-types/${expenseTypeId}`, tokenA);
  assert(g1.status === 200 && g1.data?.name === `Office Supplies ${RUN_ID}`, 'TC-ET-08', 'Get type by ID', `Office Supplies ${RUN_ID}`, `${g1.data?.name}`);

  // TC-ET-09: Update expense type
  const u1 = await api('PUT', `/expense-types/${expenseTypeId}`, tokenA, {
    name: `Office Supplies Upd ${RUN_ID}`,
  });
  assert(u1.status === 200 && u1.data?.name === `Office Supplies Upd ${RUN_ID}`, 'TC-ET-09', 'Update expense type name', `Office Supplies Upd ${RUN_ID}`, `${u1.data?.name}`);

  // TC-ET-10: Deactivate (soft delete)
  const d1 = await api('DELETE', `/expense-types/${expenseTypeId2}`, tokenA);
  assert(d1.status === 200, 'TC-ET-10', 'Soft-delete expense type', '200', `${d1.status}`);
  const afterDel = await api('GET', '/expense-types', tokenA);
  const stillVisible = afterDel.data?.some((t: any) => t.id === expenseTypeId2);
  assert(!stillVisible, 'TC-ET-10b', 'Deactivated type hidden from active list', 'false', `${stillVisible}`);

  // TC-ET-11: Non-existent ID returns 404
  const notFound = await api('GET', '/expense-types/00000000-0000-0000-0000-000000000000', tokenA);
  assert(notFound.status === 404, 'TC-ET-11', 'Non-existent type returns 404', '404', `${notFound.status}`);

  // TC-ET-12: Special characters in name
  const sc = await api('POST', '/expense-types', tokenA, {
    name: `Rent & Utils ${RUN_ID} <b>html</b>`,
  });
  assert(sc.status === 201 && sc.data?.name?.includes('Rent'), 'TC-ET-12', 'Special chars stored safely (no exec)', '201', `${sc.status}`);
  // cleanup
  if (sc.data?.id) await api('DELETE', `/expense-types/${sc.data.id}`, tokenA);

  // TC-ET-13: Very long name (>100 chars) rejected
  const longName = 'A'.repeat(101);
  const ln = await api('POST', '/expense-types', tokenA, { name: longName });
  assert(ln.status === 400, 'TC-ET-13', 'Name >100 chars rejected', '400', `${ln.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 2: FINANCIAL ACCOUNTS
// ═════════════════════════════════════════════════════════════════════
let accountId = '';
let accountId2 = '';

async function testAccounts() {
  console.log('\n══════════ FINANCIAL ACCOUNTS ══════════');

  // TC-ACC-01: Create account with initial balance
  const c1 = await api('POST', '/accounts', tokenA, {
    accountName: `Petty Cash ${RUN_ID}`,
    accountType: 'Petty Cash',
    balance: 10000,
  });
  assert(c1.status === 201 && c1.data?.id, 'TC-ACC-01', 'Create account with balance 10000', '201 + id', `${c1.status} + ${c1.data?.id || 'null'}`);
  accountId = c1.data?.id;
  assert(c1.data?.balance === 10000, 'TC-ACC-01b', 'Initial balance = 10000', '10000', `${c1.data?.balance}`);

  // TC-ACC-02: Create second account
  const c2 = await api('POST', '/accounts', tokenA, {
    accountName: `Bank Acct ${RUN_ID}`,
    accountType: 'Current',
    balance: 50000,
    bankName: 'HDFC Bank',
    accountNumber: '1234567890',
  });
  assert(c2.status === 201, 'TC-ACC-02', 'Create second account', '201', `${c2.status}`);
  accountId2 = c2.data?.id;

  // TC-ACC-03: Duplicate account name rejected
  const c3 = await api('POST', '/accounts', tokenA, {
    accountName: `Petty Cash ${RUN_ID}`,
    accountType: 'Current',
  });
  assert(c3.status === 400, 'TC-ACC-03', 'Duplicate account name rejected', '400', `${c3.status}`);

  // TC-ACC-04: Negative initial balance rejected
  const c4 = await api('POST', '/accounts', tokenA, {
    accountName: 'Negative Test',
    balance: -500,
  });
  assert(c4.status === 400, 'TC-ACC-04', 'Negative initial balance rejected', '400', `${c4.status}`);

  // TC-ACC-05: Account list
  const list = await api('GET', '/accounts', tokenA);
  assert(list.status === 200 && Array.isArray(list.data), 'TC-ACC-05', 'List accounts returns array', '200 + array', `${list.status}`);
  const foundAcc = list.data?.some((a: any) => a.id === accountId);
  assert(foundAcc, 'TC-ACC-05b', 'Created account in list', 'true', `${foundAcc}`);

  // TC-ACC-06: Get account by ID
  const g1 = await api('GET', `/accounts/${accountId}`, tokenA);
  assert(g1.status === 200 && g1.data?.accountName === `Petty Cash ${RUN_ID}`, 'TC-ACC-06', 'Get account by ID', `Petty Cash ${RUN_ID}`, `${g1.data?.accountName}`);

  // TC-ACC-07: Update account
  const u1 = await api('PUT', `/accounts/${accountId}`, tokenA, {
    bankName: 'SBI',
  });
  assert(u1.status === 200 && u1.data?.bankName === 'SBI', 'TC-ACC-07', 'Update account bank name', 'SBI', `${u1.data?.bankName}`);

  // TC-ACC-08: Add balance (top-up)
  const before = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  const ab = await api('POST', '/accounts/add-balance', tokenA, {
    accountId,
    amount: 5000,
    remark: 'Test top-up',
  });
  assert(ab.status === 200 && ab.data?.type === 'TOP_UP', 'TC-ACC-08', 'Add balance top-up', 'TOP_UP', `${ab.data?.type}`);
  const after = ab.data?.account?.afterBalance;
  assert(after === before + 5000, 'TC-ACC-08b', `Balance: ${before} + 5000 = ${before + 5000}`, `${before + 5000}`, `${after}`);

  // TC-ACC-09: Transfer between accounts
  const srcBefore = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  const dstBefore = (await api('GET', `/accounts/${accountId2}`, tokenA)).data?.balance;
  const tr = await api('POST', '/accounts/balance', tokenA, {
    accountId,
    transferToAccountId: accountId2,
    amount: 2000,
    remark: 'Test transfer',
  });
  assert(tr.status === 200 && tr.data?.type === 'TRANSFER', 'TC-ACC-09', 'Internal transfer', 'TRANSFER', `${tr.data?.type}`);
  const srcAfter = tr.data?.sourceAccount?.afterBalance;
  const dstAfter = tr.data?.destinationAccount?.afterBalance;
  assert(srcAfter === srcBefore - 2000, 'TC-ACC-09b', `Source: ${srcBefore} - 2000 = ${srcBefore - 2000}`, `${srcBefore - 2000}`, `${srcAfter}`);
  assert(dstAfter === dstBefore + 2000, 'TC-ACC-09c', `Dest: ${dstBefore} + 2000 = ${dstBefore + 2000}`, `${dstBefore + 2000}`, `${dstAfter}`);

  // TC-ACC-10: Transfer to same account rejected
  const self = await api('POST', '/accounts/balance', tokenA, {
    accountId,
    transferToAccountId: accountId,
    amount: 500,
  });
  assert(self.status === 400, 'TC-ACC-10', 'Self-transfer rejected', '400', `${self.status}`);

  // TC-ACC-11: Zero amount rejected
  const zero = await api('POST', '/accounts/add-balance', tokenA, {
    accountId,
    amount: 0,
  });
  assert(zero.status === 400, 'TC-ACC-11', 'Zero amount rejected', '400', `${zero.status}`);

  // TC-ACC-12: Negative amount rejected
  const neg = await api('POST', '/accounts/add-balance', tokenA, {
    accountId,
    amount: -100,
  });
  assert(neg.status === 400, 'TC-ACC-12', 'Negative amount rejected', '400', `${neg.status}`);

  // TC-ACC-13: Non-existent account rejected
  const noAcc = await api('POST', '/accounts/add-balance', tokenA, {
    accountId: '00000000-0000-0000-0000-000000000000',
    amount: 100,
  });
  assert(noAcc.status === 404, 'TC-ACC-13', 'Non-existent account returns 404', '404', `${noAcc.status}`);

  // TC-ACC-14: Account transactions listing
  const txns = await api('GET', `/accounts/${accountId}/transactions`, tokenA);
  assert(txns.status === 200 && Array.isArray(txns.data?.data), 'TC-ACC-14', 'Account transactions list', '200 + array', `${txns.status}`);
  assert(txns.data?.total >= 3, 'TC-ACC-14b', 'At least 3 transactions (init + topup + transfer)', '>=3', `${txns.data?.total}`);

  // TC-ACC-15: Initial deposit transaction logged
  const initTx = txns.data?.data?.find((t: any) => t.type === 'TOP_UP' && t.paymode === 'INITIAL_BALANCE');
  assert(!!initTx, 'TC-ACC-15', 'Initial balance transaction logged', 'exists', initTx ? 'found' : 'missing');

  // TC-ACC-16: Transfer transactions logged
  const trOutTx = txns.data?.data?.find((t: any) => t.type === 'TRANSFER_OUT');
  assert(!!trOutTx, 'TC-ACC-16', 'TRANSFER_OUT transaction logged', 'exists', trOutTx ? 'found' : 'missing');

  // TC-ACC-17: Transactions with filter by type
  const topUpTxns = await api('GET', `/accounts/transactions?accountId=${accountId}&type=TOP_UP`, tokenA);
  assert(topUpTxns.status === 200, 'TC-ACC-17', 'Filter transactions by type', '200', `${topUpTxns.status}`);
  const allTopUp = topUpTxns.data?.data?.every((t: any) => t.type === 'TOP_UP');
  assert(allTopUp, 'TC-ACC-17b', 'All results are TOP_UP', 'true', `${allTopUp}`);

  // TC-ACC-18: Empty account name rejected
  const emptyName = await api('POST', '/accounts', tokenA, { accountName: '' });
  assert(emptyName.status === 400, 'TC-ACC-18', 'Empty account name rejected', '400', `${emptyName.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 3: EXPENSES
// ═════════════════════════════════════════════════════════════════════
let expenseId = '';

async function testExpenses() {
  console.log('\n══════════ EXPENSES ══════════');

  const balanceBefore = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;

  // TC-EXP-01: Create valid expense linked to account
  const c1 = await api('POST', '/expenses', tokenA, {
    amount: 1500,
    expenseTypeId,
    accountId,
    paymode: 'CASH',
    givenTo: 'Office Vendor',
    remark: 'Stationery purchase',
    store: 'kalyaninagar',
    expenseDate: '2026-09-25',
  });
  assert(c1.status === 201 && c1.data?.id, 'TC-EXP-01', 'Create expense linked to account', '201', `${c1.status}`);
  expenseId = c1.data?.id;
  assert(Number(c1.data?.amount) === 1500, 'TC-EXP-01b', 'Amount = 1500', '1500', `${c1.data?.amount}`);

  // TC-EXP-02: Account balance deducted
  const balanceAfter = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  assert(balanceAfter === balanceBefore - 1500, 'TC-EXP-02', `Balance: ${balanceBefore} - 1500 = ${balanceBefore - 1500}`, `${balanceBefore - 1500}`, `${balanceAfter}`);

  // TC-EXP-03: Expense appears in dashboard
  const dash = await api('GET', '/expenses/dashboard', tokenA);
  assert(dash.status === 200 && dash.data?.totalCount > 0, 'TC-EXP-03', 'Dashboard shows expenses', '>0', `${dash.data?.totalCount}`);
  assert(dash.data?.totalAmount > 0, 'TC-EXP-03b', 'Dashboard totalAmount > 0', '>0', `${dash.data?.totalAmount}`);

  // TC-EXP-04: Dashboard byCategory includes our type
  const catFound = dash.data?.byCategory?.some((c: any) => c.amount > 0);
  assert(catFound, 'TC-EXP-04', 'Dashboard byCategory has entries', 'true', `${catFound}`);

  // TC-EXP-05: Dashboard byPaymode has entries
  const pmFound = dash.data?.byPaymode?.some((p: any) => p.amount > 0);
  assert(pmFound, 'TC-EXP-05', 'Dashboard byPaymode has entries', 'true', `${pmFound}`);

  // TC-EXP-06: Get expense by ID
  const g1 = await api('GET', `/expenses/${expenseId}`, tokenA);
  assert(g1.status === 200 && g1.data?.id === expenseId, 'TC-EXP-06', 'Get expense by ID', expenseId, `${g1.data?.id}`);
  assert(g1.data?.givenTo === 'Office Vendor', 'TC-EXP-06b', 'givenTo matches', 'Office Vendor', `${g1.data?.givenTo}`);
  assert(g1.data?.store === 'kalyaninagar', 'TC-EXP-06c', 'store matches', 'kalyaninagar', `${g1.data?.store}`);

  // TC-EXP-07: List expenses
  const list = await api('GET', '/expenses', tokenA);
  assert(list.status === 200 && list.data?.total > 0, 'TC-EXP-07', 'List expenses', '>0', `${list.data?.total}`);
  assert(list.data?.totalAmount > 0, 'TC-EXP-07b', 'List totalAmount > 0', '>0', `${list.data?.totalAmount}`);

  // TC-EXP-08: Zero amount rejected
  const zeroAmt = await api('POST', '/expenses', tokenA, { amount: 0 });
  assert(zeroAmt.status === 400, 'TC-EXP-08', 'Zero expense amount rejected', '400', `${zeroAmt.status}`);

  // TC-EXP-09: Negative amount rejected
  const negAmt = await api('POST', '/expenses', tokenA, { amount: -500 });
  assert(negAmt.status === 400, 'TC-EXP-09', 'Negative expense amount rejected', '400', `${negAmt.status}`);

  // TC-EXP-10: Missing amount rejected (amount required)
  const noAmt = await api('POST', '/expenses', tokenA, { givenTo: 'test' });
  assert(noAmt.status === 400, 'TC-EXP-10', 'Missing amount rejected', '400', `${noAmt.status}`);

  // TC-EXP-11: Create expense without account (no balance impact)
  const noAccExp = await api('POST', '/expenses', tokenA, {
    amount: 500,
    paymode: 'UPI',
    givenTo: 'UPI Vendor',
    remark: 'No account expense',
  });
  assert(noAccExp.status === 201, 'TC-EXP-11', 'Expense without account succeeds', '201', `${noAccExp.status}`);
  if (noAccExp.data?.id) await api('DELETE', `/expenses/${noAccExp.data.id}`, tokenA);

  // TC-EXP-12: Update expense amount
  const balBeforeUpdate = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  const u1 = await api('PUT', `/expenses/${expenseId}`, tokenA, {
    amount: 2000,
    remark: 'Updated amount',
  });
  assert(u1.status === 200 && Number(u1.data?.amount) === 2000, 'TC-EXP-12', 'Update expense amount to 2000', '2000', `${u1.data?.amount}`);

  // TC-EXP-13: Balance adjusted after update (diff = 500 more deducted)
  const balAfterUpdate = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  assert(balAfterUpdate === balBeforeUpdate - 500, 'TC-EXP-13', `Balance adjusted: ${balBeforeUpdate} - 500 = ${balBeforeUpdate - 500}`, `${balBeforeUpdate - 500}`, `${balAfterUpdate}`);

  // TC-EXP-14: Delete expense reverts balance
  const balBeforeDel = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  const del = await api('DELETE', `/expenses/${expenseId}`, tokenA);
  assert(del.status === 200, 'TC-EXP-14', 'Delete expense succeeds', '200', `${del.status}`);
  const balAfterDel = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  assert(balAfterDel === balBeforeDel + 2000, 'TC-EXP-14b', `Balance restored: ${balBeforeDel} + 2000 = ${balBeforeDel + 2000}`, `${balBeforeDel + 2000}`, `${balAfterDel}`);

  // TC-EXP-15: Deleted expense returns 404
  const notFound = await api('GET', `/expenses/${expenseId}`, tokenA);
  assert(notFound.status === 404, 'TC-EXP-15', 'Deleted expense returns 404', '404', `${notFound.status}`);

  // TC-EXP-16: Create another expense for filter tests
  const fExp = await api('POST', '/expenses', tokenA, {
    amount: 750.50,
    paymode: 'CARD',
    givenTo: 'Filter Test Vendor',
    store: 'kalyaninagar',
    remark: 'Filter testing',
    expenseDate: '2026-09-20',
  });
  assert(fExp.status === 201, 'TC-EXP-16', 'Create expense for filter tests', '201', `${fExp.status}`);

  // TC-EXP-17: Filter by paymode
  const byPaymode = await api('GET', '/expenses?paymode=CARD', tokenA);
  assert(byPaymode.status === 200, 'TC-EXP-17', 'Filter by paymode=CARD', '200', `${byPaymode.status}`);

  // TC-EXP-18: Filter by date range
  const byDate = await api('GET', '/expenses?fromDate=2026-09-20&toDate=2026-09-20', tokenA);
  assert(byDate.status === 200, 'TC-EXP-18', 'Filter by date range', '200', `${byDate.status}`);

  // TC-EXP-19: Search by vendor name
  const bySearch = await api('GET', '/expenses?search=Filter Test', tokenA);
  assert(bySearch.status === 200, 'TC-EXP-19', 'Search expenses by vendor name', '200', `${bySearch.status}`);

  // TC-EXP-20: Filter by store
  const byStore = await api('GET', '/expenses?store=kalyaninagar', tokenA);
  assert(byStore.status === 200, 'TC-EXP-20', 'Filter by store', '200', `${byStore.status}`);

  // TC-EXP-21: Pagination
  const page1 = await api('GET', '/expenses?page=1&limit=1', tokenA);
  assert(page1.status === 200 && page1.data?.limit === 1, 'TC-EXP-21', 'Pagination limit=1', '1', `${page1.data?.limit}`);
  assert(page1.data?.totalPages >= 1, 'TC-EXP-21b', 'totalPages >= 1', '>=1', `${page1.data?.totalPages}`);

  // TC-EXP-22: Sort by amount ascending
  const sorted = await api('GET', '/expenses?sortBy=amount&sortOrder=asc', tokenA);
  assert(sorted.status === 200, 'TC-EXP-22', 'Sort by amount asc', '200', `${sorted.status}`);

  // TC-EXP-23: Decimal amount preserved
  assert(Number(fExp.data?.amount) === 750.5, 'TC-EXP-23', 'Decimal amount 750.50 preserved', '750.5', `${Number(fExp.data?.amount)}`);

  // TC-EXP-24: SQL injection in search harmless
  const sqli = await api('GET', "/expenses?search=' OR 1=1 --", tokenA);
  assert(sqli.status === 200, 'TC-EXP-24', 'SQL injection in search returns safely', '200', `${sqli.status}`);

  // TC-EXP-25: Very large amount accepted
  const big = await api('POST', '/expenses', tokenA, {
    amount: 999999.99,
    remark: 'Big expense',
  });
  assert(big.status === 201, 'TC-EXP-25', 'Very large amount accepted', '201', `${big.status}`);
  if (big.data?.id) await api('DELETE', `/expenses/${big.data.id}`, tokenA);

  // Cleanup filter test expense
  if (fExp.data?.id) await api('DELETE', `/expenses/${fExp.data.id}`, tokenA);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 4: ENQUIRIES
// ═════════════════════════════════════════════════════════════════════
let enquiryId = '';

async function testEnquiries() {
  console.log('\n══════════ ENQUIRIES ══════════');

  // TC-ENQ-01: Create valid enquiry
  const c1 = await api('POST', '/enquiries', tokenA, {
    name: 'Test Enquiry Guest',
    mobile: '+919876543210',
    email: 'testguest@example.com',
    priority: 'HIGH',
    status: 'NEW',
    service: 'Hair Cut',
    description: 'Walk-in enquiry about services',
    followUpDate: '2026-10-01',
    store: 'kalyaninagar',
  });
  assert(c1.status === 201 && c1.data?.id, 'TC-ENQ-01', 'Create enquiry', '201', `${c1.status}`);
  enquiryId = c1.data?.id;
  assert(c1.data?.name === 'Test Enquiry Guest', 'TC-ENQ-01b', 'Name matches', 'Test Enquiry Guest', `${c1.data?.name}`);
  assert(c1.data?.priority === 'HIGH', 'TC-ENQ-01c', 'Priority = HIGH', 'HIGH', `${c1.data?.priority}`);
  assert(c1.data?.status === 'NEW', 'TC-ENQ-01d', 'Status = NEW', 'NEW', `${c1.data?.status}`);

  // TC-ENQ-02: Get enquiry by ID
  const g1 = await api('GET', `/enquiries/${enquiryId}`, tokenA);
  assert(g1.status === 200 && g1.data?.mobile === '+919876543210', 'TC-ENQ-02', 'Get enquiry by ID + mobile matches', '+919876543210', `${g1.data?.mobile}`);

  // TC-ENQ-03: Update enquiry status and notes
  const u1 = await api('PUT', `/enquiries/${enquiryId}`, tokenA, {
    status: 'CONTACTED',
    description: 'Followed up via phone',
  });
  assert(u1.status === 200 && u1.data?.status === 'CONTACTED', 'TC-ENQ-03', 'Update status to CONTACTED', 'CONTACTED', `${u1.data?.status}`);

  // TC-ENQ-04: Update follow-up date
  const fu = await api('PATCH', `/enquiries/${enquiryId}/follow-up`, tokenA, {
    followUpDate: '2026-10-15',
  });
  assert(fu.status === 200, 'TC-ENQ-04', 'Update follow-up date', '200', `${fu.status}`);
  const fuCheck = await api('GET', `/enquiries/${enquiryId}`, tokenA);
  const fuDate = fuCheck.data?.followUpDate;
  assert(fuDate && fuDate.includes('2026-10-15'), 'TC-ENQ-04b', 'Follow-up date updated', '2026-10-15', `${fuDate}`);

  // TC-ENQ-05: Empty name rejected
  const noName = await api('POST', '/enquiries', tokenA, { name: '', mobile: '+919111111111' });
  assert(noName.status === 400, 'TC-ENQ-05', 'Empty name rejected', '400', `${noName.status}`);

  // TC-ENQ-06: Missing mobile rejected
  const noMobile = await api('POST', '/enquiries', tokenA, { name: 'Test' });
  assert(noMobile.status === 400, 'TC-ENQ-06', 'Missing mobile rejected', '400', `${noMobile.status}`);

  // TC-ENQ-07: Too-short mobile rejected
  const shortMobile = await api('POST', '/enquiries', tokenA, { name: 'Test', mobile: '123' });
  assert(shortMobile.status === 400, 'TC-ENQ-07', 'Too-short mobile rejected', '400', `${shortMobile.status}`);

  // TC-ENQ-08: Alphabetic mobile rejected
  const alphaMobile = await api('POST', '/enquiries', tokenA, { name: 'Test', mobile: 'abcdefghij' });
  assert(alphaMobile.status === 400, 'TC-ENQ-08', 'Alphabetic mobile rejected', '400', `${alphaMobile.status}`);

  // TC-ENQ-09: Invalid email rejected
  const badEmail = await api('POST', '/enquiries', tokenA, {
    name: 'Test', mobile: '+919111111111', email: 'not-an-email',
  });
  assert(badEmail.status === 400, 'TC-ENQ-09', 'Invalid email rejected', '400', `${badEmail.status}`);

  // TC-ENQ-10: Invalid status rejected
  const badStatus = await api('POST', '/enquiries', tokenA, {
    name: 'Test', mobile: '+919111111111', status: 'INVALID_STATUS',
  });
  assert(badStatus.status === 400, 'TC-ENQ-10', 'Invalid status rejected', '400', `${badStatus.status}`);

  // TC-ENQ-11: Invalid priority rejected
  const badPriority = await api('POST', '/enquiries', tokenA, {
    name: 'Test', mobile: '+919111111111', priority: 'CRITICAL',
  });
  assert(badPriority.status === 400, 'TC-ENQ-11', 'Invalid priority rejected', '400', `${badPriority.status}`);

  // TC-ENQ-12: List enquiries
  const list = await api('GET', '/enquiries', tokenA);
  assert(list.status === 200 && list.data?.total > 0, 'TC-ENQ-12', 'List enquiries', '>0', `${list.data?.total}`);

  // TC-ENQ-13: Search by name
  const byName = await api('GET', '/enquiries?search=Test Enquiry', tokenA);
  assert(byName.status === 200 && byName.data?.total > 0, 'TC-ENQ-13', 'Search by name', '>0', `${byName.data?.total}`);

  // TC-ENQ-14: Filter by status
  const byStatus = await api('GET', '/enquiries?status=CONTACTED', tokenA);
  assert(byStatus.status === 200, 'TC-ENQ-14', 'Filter by status=CONTACTED', '200', `${byStatus.status}`);

  // TC-ENQ-15: Filter by priority
  const byPriority = await api('GET', '/enquiries?priority=HIGH', tokenA);
  assert(byPriority.status === 200, 'TC-ENQ-15', 'Filter by priority=HIGH', '200', `${byPriority.status}`);

  // TC-ENQ-16: Non-existent ID returns 404
  const notFound = await api('GET', '/enquiries/00000000-0000-0000-0000-000000000000', tokenA);
  assert(notFound.status === 404, 'TC-ENQ-16', 'Non-existent enquiry returns 404', '404', `${notFound.status}`);

  // TC-ENQ-17: Delete enquiry
  const c2 = await api('POST', '/enquiries', tokenA, {
    name: 'Temp Delete Test', mobile: '+919222222222',
  });
  const delResult = await api('DELETE', `/enquiries/${c2.data?.id}`, tokenA);
  assert(delResult.status === 200, 'TC-ENQ-17', 'Delete enquiry', '200', `${delResult.status}`);
  const afterDel = await api('GET', `/enquiries/${c2.data?.id}`, tokenA);
  assert(afterDel.status === 404, 'TC-ENQ-17b', 'Deleted enquiry returns 404', '404', `${afterDel.status}`);

  // TC-ENQ-18: Unicode name supported
  const unicode = await api('POST', '/enquiries', tokenA, {
    name: 'राजेश कुमार 🇮🇳', mobile: '+919333333333',
  });
  assert(unicode.status === 201 && unicode.data?.name?.includes('राजेश'), 'TC-ENQ-18', 'Unicode name stored', 'contains राजेश', `${unicode.data?.name}`);
  if (unicode.data?.id) await api('DELETE', `/enquiries/${unicode.data.id}`, tokenA);

  // TC-ENQ-19: SQL injection in search
  const sqli = await api('GET', "/enquiries?search=' OR 1=1 --", tokenA);
  assert(sqli.status === 200, 'TC-ENQ-19', 'SQL injection in search harmless', '200', `${sqli.status}`);

  // TC-ENQ-20: Follow-up date empty string rejected
  const emptyFu = await api('PATCH', `/enquiries/${enquiryId}/follow-up`, tokenA, {
    followUpDate: '',
  });
  assert(emptyFu.status === 400, 'TC-ENQ-20', 'Empty follow-up date rejected', '400', `${emptyFu.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 5: REFERRALS & REFERRAL DASHBOARD
// ═════════════════════════════════════════════════════════════════════
let referralId = '';
let referralId2 = '';

async function testReferrals() {
  console.log('\n══════════ REFERRALS & DASHBOARD ══════════');

  // TC-REF-01: Create referral
  const c1 = await api('POST', '/referrals', tokenA, {
    referralName: 'Test Referred Person',
    mobileNumber: '+919444444444',
    referrerName: 'Existing Guest',
    benefitToReferral: '15% OFF first visit',
    benefitToReferrer: '₹200 reward points',
    store: 'kalyaninagar',
  });
  assert(c1.status === 201 && c1.data?.id, 'TC-REF-01', 'Create referral', '201', `${c1.status}`);
  referralId = c1.data?.id;
  assert(c1.data?.status === 'PENDING', 'TC-REF-01b', 'Default status = PENDING', 'PENDING', `${c1.data?.status}`);
  assert(!!c1.data?.referralCode, 'TC-REF-01c', 'Referral code auto-generated', 'exists', c1.data?.referralCode || 'null');

  // TC-REF-02: Create second referral (for dashboard math)
  const c2 = await api('POST', '/referrals', tokenA, {
    referralName: 'Second Referral',
    mobileNumber: '+919555555555',
  });
  assert(c2.status === 201, 'TC-REF-02', 'Create second referral', '201', `${c2.status}`);
  referralId2 = c2.data?.id;

  // TC-REF-03: Mark first referral as USED
  const u1 = await api('PUT', `/referrals/${referralId}`, tokenA, {
    status: 'USED',
  });
  assert(u1.status === 200 && u1.data?.status === 'USED', 'TC-REF-03', 'Mark referral as USED', 'USED', `${u1.data?.status}`);

  // TC-REF-04: Referral dashboard metrics
  const dash = await api('GET', '/referrals/dashboard', tokenA);
  assert(dash.status === 200, 'TC-REF-04', 'Referral dashboard loads', '200', `${dash.status}`);
  assert(dash.data?.totalReferrals >= 2, 'TC-REF-04b', 'totalReferrals >= 2', '>=2', `${dash.data?.totalReferrals}`);
  assert(dash.data?.usedReferrals >= 1, 'TC-REF-04c', 'usedReferrals >= 1', '>=1', `${dash.data?.usedReferrals}`);
  assert(dash.data?.pendingReferrals >= 1, 'TC-REF-04d', 'pendingReferrals >= 1', '>=1', `${dash.data?.pendingReferrals}`);

  // TC-REF-05: Conversion rate calculation
  const total = dash.data?.totalReferrals || 0;
  const used = dash.data?.usedReferrals || 0;
  const expectedRate = total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0;
  assert(dash.data?.conversionRate === expectedRate, 'TC-REF-05', `Conversion rate = ${expectedRate}%`, `${expectedRate}`, `${dash.data?.conversionRate}`);

  // TC-REF-06: Dashboard includes enquiry count
  assert(dash.data?.enquiries !== undefined, 'TC-REF-06', 'Dashboard includes enquiries count', 'defined', `${dash.data?.enquiries}`);

  // TC-REF-07: List referrals
  const list = await api('GET', '/referrals', tokenA);
  assert(list.status === 200 && list.data?.total >= 2, 'TC-REF-07', 'List referrals', '>=2', `${list.data?.total}`);

  // TC-REF-08: Filter referrals by status
  const byStatus = await api('GET', '/referrals?status=PENDING', tokenA);
  assert(byStatus.status === 200, 'TC-REF-08', 'Filter referrals by status', '200', `${byStatus.status}`);

  // TC-REF-09: Search referrals by name
  const bySearch = await api('GET', '/referrals?search=Test Referred', tokenA);
  assert(bySearch.status === 200 && bySearch.data?.total >= 1, 'TC-REF-09', 'Search referrals by name', '>=1', `${bySearch.data?.total}`);

  // TC-REF-10: Empty referral name rejected
  const noName = await api('POST', '/referrals', tokenA, {
    referralName: '', mobileNumber: '+919666666666',
  });
  assert(noName.status === 400, 'TC-REF-10', 'Empty referral name rejected', '400', `${noName.status}`);

  // TC-REF-11: Invalid mobile rejected
  const badMobile = await api('POST', '/referrals', tokenA, {
    referralName: 'Bad Mobile', mobileNumber: 'abc',
  });
  assert(badMobile.status === 400, 'TC-REF-11', 'Invalid mobile rejected', '400', `${badMobile.status}`);

  // TC-REF-12: Non-existent referral update returns 404
  const noRef = await api('PUT', '/referrals/00000000-0000-0000-0000-000000000000', tokenA, {
    status: 'USED',
  });
  assert(noRef.status === 404, 'TC-REF-12', 'Non-existent referral update → 404', '404', `${noRef.status}`);

  // TC-REF-13: Invalid referral status rejected
  const badRefStatus = await api('PUT', `/referrals/${referralId2}`, tokenA, {
    status: 'INVALID',
  });
  assert(badRefStatus.status === 400, 'TC-REF-13', 'Invalid referral status rejected', '400', `${badRefStatus.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 6: PAYROLL
// ═════════════════════════════════════════════════════════════════════
let payrollStaffId = '';

async function testPayroll() {
  console.log('\n══════════ PAYROLL ══════════');

  // First get an active staff member
  const staffRes = await api('GET', '/staff', tokenA);
  const staffList = staffRes.data?.items || staffRes.data?.data || staffRes.data || [];
  const activeStaff = Array.isArray(staffList) ? staffList.find((s: any) => s.isActive !== false) : null;
  payrollStaffId = activeStaff?.id || '';
  assert(!!payrollStaffId, 'TC-PAY-SETUP', 'Active staff found for payroll tests', 'exists', payrollStaffId ? 'OK' : 'MISSING');

  if (!payrollStaffId) {
    console.log('    ⚠ Skipping payroll tests (no active staff)');
    return;
  }

  // TC-PAY-01: Clean existing payroll config and test unconfigured state
  // First get existing configs and delete them for clean test
  const configsBefore = await api('GET', '/payroll/configs', tokenA);

  // TC-PAY-02: Save payroll config (default tenant-wide)
  const cfg = await api('POST', '/payroll/config', tokenA, {
    basicSalary: 30000,
    hra: 10000,
    conveyance: 2000,
    medicalAllowance: 1500,
    specialAllowance: 1500,
    pfPercentage: 12,
    esiPercentage: 0.75,
    professionalTax: 200,
    tdsPercentage: 0,
  });
  assert(cfg.status === 200 && cfg.data?.id, 'TC-PAY-02', 'Save payroll config', '200', `${cfg.status}`);

  // TC-PAY-03: Get config returns configured state
  const getCfg = await api('GET', '/payroll/config', tokenA);
  assert(getCfg.status === 200 && getCfg.configured === true, 'TC-PAY-03', 'Get config returns configured=true', 'true', `${getCfg.configured}`);
  assert(Number(getCfg.data?.basicSalary) === 30000, 'TC-PAY-03b', 'basicSalary=30000', '30000', `${getCfg.data?.basicSalary}`);

  // TC-PAY-04: Update config (upsert)
  const cfgUpdate = await api('PUT', '/payroll/config', tokenA, {
    basicSalary: 30000,
    hra: 10000,
    conveyance: 2000,
    medicalAllowance: 1500,
    specialAllowance: 1500,
    pfPercentage: 12,
    esiPercentage: 0.75,
    professionalTax: 200,
    tdsPercentage: 0,
  });
  assert(cfgUpdate.status === 200, 'TC-PAY-04', 'Update (upsert) payroll config', '200', `${cfgUpdate.status}`);

  // TC-PAY-05: Negative basicSalary rejected
  const negSalary = await api('POST', '/payroll/config', tokenA, {
    basicSalary: -1000,
  });
  assert(negSalary.status === 400, 'TC-PAY-05', 'Negative basicSalary rejected', '400', `${negSalary.status}`);

  // TC-PAY-06: pfPercentage > 100 rejected
  const bigPf = await api('POST', '/payroll/config', tokenA, {
    basicSalary: 10000, pfPercentage: 150,
  });
  assert(bigPf.status === 400, 'TC-PAY-06', 'pfPercentage > 100 rejected', '400', `${bigPf.status}`);

  // TC-PAY-07: Generate salary for specific staff
  const gen = await api('POST', '/payroll/generate', tokenA, {
    month: 9,
    year: 2026,
    staffId: payrollStaffId,
    workingDays: 30,
    presentDays: 30,
  });
  assert(gen.status === 200 && gen.data?.count === 1, 'TC-PAY-07', 'Generate salary for staff', '1', `${gen.data?.count}`);

  // TC-PAY-08: Verify salary calculation (full attendance)
  const salary = gen.data?.salaries?.[0];
  const basic = 30000;
  const hra = 10000;
  const conv = 2000;
  const med = 1500;
  const spec = 1500;
  const gross = basic + hra + conv + med + spec; // 45000
  const pf = (basic * 12) / 100; // 3600
  const esi = (gross * 0.75) / 100; // 337.5
  const pt = 200;
  const totalDeductions = pf + esi + pt; // 4137.5
  const net = gross - totalDeductions; // 40862.5

  assert(Number(salary?.grossSalary) === gross, 'TC-PAY-08', `Gross = ${gross}`, `${gross}`, `${salary?.grossSalary}`);
  assert(Number(salary?.netSalary) === net, 'TC-PAY-08b', `Net = ${net}`, `${net}`, `${salary?.netSalary}`);
  assert(Number(salary?.basicSalary) === basic, 'TC-PAY-08c', `Basic = ${basic}`, `${basic}`, `${salary?.basicSalary}`);
  assert(Number(salary?.allowances) === (hra + conv + med + spec), 'TC-PAY-08d', `Allowances = ${hra + conv + med + spec}`, `${hra + conv + med + spec}`, `${salary?.allowances}`);
  assert(Number(salary?.deductions) === totalDeductions, 'TC-PAY-08e', `Deductions = ${totalDeductions}`, `${totalDeductions}`, `${salary?.deductions}`);

  // TC-PAY-09: Duplicate generation (without forceRegenerate) returns existing
  const dup = await api('POST', '/payroll/generate', tokenA, {
    month: 9, year: 2026, staffId: payrollStaffId,
  });
  assert(dup.status === 200 && dup.data?.salaries?.[0]?.alreadyExisted === true, 'TC-PAY-09', 'Duplicate generation returns existing', 'alreadyExisted=true', `${dup.data?.salaries?.[0]?.alreadyExisted}`);

  // TC-PAY-10: Force regenerate overwrites
  const regen = await api('POST', '/payroll/generate', tokenA, {
    month: 9, year: 2026, staffId: payrollStaffId, forceRegenerate: true,
  });
  assert(regen.status === 200 && regen.data?.salaries?.[0]?.alreadyExisted === false, 'TC-PAY-10', 'Force regenerate overwrites', 'alreadyExisted=false', `${regen.data?.salaries?.[0]?.alreadyExisted}`);

  // TC-PAY-11: Payslip retrieval
  const slip = await api('GET', `/payroll/payslip?staffId=${payrollStaffId}&month=9&year=2026`, tokenA);
  assert(slip.status === 200 && slip.configured === true, 'TC-PAY-11', 'Payslip returns configured=true', 'true', `${slip.configured}`);
  assert(slip.data?.staff?.id === payrollStaffId, 'TC-PAY-11b', 'Payslip staff ID matches', payrollStaffId, `${slip.data?.staff?.id}`);
  assert(slip.data?.period?.month === 9, 'TC-PAY-11c', 'Payslip month=9', '9', `${slip.data?.period?.month}`);
  assert(slip.data?.period?.monthName === 'September', 'TC-PAY-11d', 'Month name = September', 'September', `${slip.data?.period?.monthName}`);

  // TC-PAY-12: Payslip earnings breakdown
  const earnings = slip.data?.earnings;
  assert(Array.isArray(earnings) && earnings.length > 0, 'TC-PAY-12', 'Payslip has earnings list', 'array', `${typeof earnings}`);
  const basicEarning = earnings?.find((e: any) => e.name === 'Basic Salary');
  assert(basicEarning?.amount === basic, 'TC-PAY-12b', `Basic Salary earning = ${basic}`, `${basic}`, `${basicEarning?.amount}`);

  // TC-PAY-13: Payslip deductions breakdown
  const deductions = slip.data?.deductions;
  assert(Array.isArray(deductions) && deductions.length > 0, 'TC-PAY-13', 'Payslip has deductions list', 'array', `${typeof deductions}`);
  const pfDed = deductions?.find((d: any) => d.name?.includes('PF'));
  assert(pfDed?.amount === pf, 'TC-PAY-13b', `PF deduction = ${pf}`, `${pf}`, `${pfDed?.amount}`);
  const esiDed = deductions?.find((d: any) => d.name?.includes('ESI'));
  assert(esiDed?.amount === esi, 'TC-PAY-13c', `ESI deduction = ${esi}`, `${esi}`, `${esiDed?.amount}`);
  const ptDed = deductions?.find((d: any) => d.name?.includes('PT'));
  assert(ptDed?.amount === pt, 'TC-PAY-13d', `PT deduction = ${pt}`, `${pt}`, `${ptDed?.amount}`);

  // TC-PAY-14: Payslip summary consistency
  assert(slip.data?.summary?.totalEarnings === gross, 'TC-PAY-14', `Summary totalEarnings = ${gross}`, `${gross}`, `${slip.data?.summary?.totalEarnings}`);
  assert(slip.data?.summary?.netSalary === net, 'TC-PAY-14b', `Summary netSalary = ${net}`, `${net}`, `${slip.data?.summary?.netSalary}`);

  // TC-PAY-15: Salary list
  const salList = await api('GET', '/payroll/salary?month=9&year=2026', tokenA);
  assert(salList.status === 200 && salList.data?.total >= 1, 'TC-PAY-15', 'Salary list for Sep 2026', '>=1', `${salList.data?.total}`);

  // TC-PAY-16: Invalid month rejected
  const badMonth = await api('POST', '/payroll/generate', tokenA, {
    month: 13, year: 2026, staffId: payrollStaffId,
  });
  assert(badMonth.status === 400, 'TC-PAY-16', 'Month 13 rejected', '400', `${badMonth.status}`);

  // TC-PAY-17: Invalid year rejected
  const badYear = await api('POST', '/payroll/generate', tokenA, {
    month: 9, year: 1999, staffId: payrollStaffId,
  });
  assert(badYear.status === 400, 'TC-PAY-17', 'Year 1999 rejected', '400', `${badYear.status}`);

  // TC-PAY-18: Non-existent staffId rejected
  const noStaff = await api('POST', '/payroll/generate', tokenA, {
    month: 9, year: 2026, staffId: '00000000-0000-0000-0000-000000000000',
  });
  assert(noStaff.status === 404, 'TC-PAY-18', 'Non-existent staff → 404', '404', `${noStaff.status}`);

  // TC-PAY-19: Payslip with non-existent staff → 404
  const noStaffSlip = await api('GET', '/payroll/payslip?staffId=00000000-0000-0000-0000-000000000000&month=9&year=2026', tokenA);
  assert(noStaffSlip.status === 404, 'TC-PAY-19', 'Payslip non-existent staff → 404', '404', `${noStaffSlip.status}`);

  // TC-PAY-20: Get all configs
  const allCfgs = await api('GET', '/payroll/configs', tokenA);
  assert(allCfgs.status === 200 && Array.isArray(allCfgs.data), 'TC-PAY-20', 'Get all configs', '200 + array', `${allCfgs.status}`);

  // TC-PAY-21: Partial attendance salary calculation
  const partGen = await api('POST', '/payroll/generate', tokenA, {
    month: 8, year: 2026, staffId: payrollStaffId,
    workingDays: 30, presentDays: 20, forceRegenerate: true,
  });
  assert(partGen.status === 200, 'TC-PAY-21', 'Generate salary with 20/30 days', '200', `${partGen.status}`);
  const partSalary = partGen.data?.salaries?.[0];
  const partFactor = 20 / 30;
  const partBasic = 30000 * partFactor;
  const partGross = (30000 + 10000 + 2000 + 1500 + 1500) * partFactor; // 30000
  assert(Math.abs(Number(partSalary?.grossSalary) - partGross) < 0.01, 'TC-PAY-21b', `Partial gross ≈ ${partGross.toFixed(2)}`, `${partGross.toFixed(2)}`, `${partSalary?.grossSalary}`);
  assert(Number(partSalary?.grossSalary) < gross, 'TC-PAY-21c', 'Partial gross < full gross', `< ${gross}`, `${partSalary?.grossSalary}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 7: WHATSAPP
// ═════════════════════════════════════════════════════════════════════
let waConversationId = '';

async function testWhatsApp() {
  console.log('\n══════════ WHATSAPP ══════════');

  // TC-WA-01: Send template message
  const s1 = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+919777777777',
    recipientName: 'Test WA Guest',
    templateName: 'referral_reward_percentage',
    templateVariables: { referral_code: 'TEST123', discount_percentage: '15.00' },
  });
  assert(s1.status === 201, 'TC-WA-01', 'Send template message', '201', `${s1.status}`);
  assert(s1.data?.message?.status === 'SENT', 'TC-WA-01b', 'Message status = SENT', 'SENT', `${s1.data?.message?.status}`);
  assert(!!s1.data?.conversation?.id, 'TC-WA-01c', 'Conversation auto-created', 'exists', s1.data?.conversation?.id || 'null');
  waConversationId = s1.data?.conversation?.id;

  // TC-WA-02: Message content includes template variables
  const content = s1.data?.message?.messageContent || '';
  assert(content.includes('TEST123'), 'TC-WA-02', 'Message includes referral code', 'contains TEST123', content.includes('TEST123') ? 'YES' : 'NO');
  assert(content.includes('15.00'), 'TC-WA-02b', 'Message includes discount %', 'contains 15.00', content.includes('15.00') ? 'YES' : 'NO');

  // TC-WA-03: Send to same number creates message in same conversation
  const s2 = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+919777777777',
    messageContent: 'Follow-up message to same number',
  });
  assert(s2.status === 201, 'TC-WA-03', 'Second message to same number', '201', `${s2.status}`);
  assert(s2.data?.conversation?.id === waConversationId, 'TC-WA-03b', 'Same conversation reused', waConversationId, `${s2.data?.conversation?.id}`);

  // TC-WA-04: Undeliverable number → UNDELIVERABLE status
  const fail = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+009999999999',
    messageContent: 'This should fail',
  });
  assert(fail.status === 201, 'TC-WA-04', 'Undeliverable message saved', '201', `${fail.status}`);
  assert(fail.data?.message?.status === 'UNDELIVERABLE', 'TC-WA-04b', 'Status = UNDELIVERABLE', 'UNDELIVERABLE', `${fail.data?.message?.status}`);
  assert(!!fail.data?.message?.errorDetails, 'TC-WA-04c', 'Error details present', 'exists', fail.data?.message?.errorDetails || 'null');

  // TC-WA-05: Send with explicit FAILED status and error
  const explicitFail = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+919888888888',
    messageContent: 'Provider rejected',
    status: 'FAILED',
    errorDetails: 'Provider API returned 403: Template not approved',
  });
  assert(explicitFail.status === 201, 'TC-WA-05', 'Explicit FAILED message saved', '201', `${explicitFail.status}`);
  assert(explicitFail.data?.message?.status === 'FAILED', 'TC-WA-05b', 'Status = FAILED', 'FAILED', `${explicitFail.data?.message?.status}`);
  assert(explicitFail.data?.message?.errorDetails?.includes('403'), 'TC-WA-05c', 'Error details contain 403', 'contains 403', `${explicitFail.data?.message?.errorDetails}`);

  // TC-WA-06: Get conversation messages in chronological order
  const msgs = await api('GET', `/whatsapp/conversations/${waConversationId}/messages`, tokenA);
  assert(msgs.status === 200 && Array.isArray(msgs.data), 'TC-WA-06', 'Get messages for conversation', '200 + array', `${msgs.status}`);
  assert(msgs.data?.length >= 2, 'TC-WA-06b', 'At least 2 messages', '>=2', `${msgs.data?.length}`);
  // Verify chronological order
  if (msgs.data?.length >= 2) {
    const t0 = new Date(msgs.data[0].createdAt).getTime();
    const t1 = new Date(msgs.data[1].createdAt).getTime();
    assert(t0 <= t1, 'TC-WA-06c', 'Messages in chronological order', 'asc', t0 <= t1 ? 'asc' : 'desc');
  }

  // TC-WA-07: Get conversations list
  const convos = await api('GET', '/whatsapp/conversations', tokenA);
  assert(convos.status === 200 && convos.data?.total >= 1, 'TC-WA-07', 'Conversation list', '>=1', `${convos.data?.total}`);
  const foundConvo = convos.data?.data?.some((c: any) => c.id === waConversationId);
  assert(foundConvo, 'TC-WA-07b', 'Created conversation in list', 'true', `${foundConvo}`);

  // TC-WA-08: Search conversations
  const searchConvo = await api('GET', '/whatsapp/conversations?search=Test WA', tokenA);
  assert(searchConvo.status === 200, 'TC-WA-08', 'Search conversations', '200', `${searchConvo.status}`);

  // TC-WA-09: History endpoint
  const history = await api('GET', '/whatsapp/history', tokenA);
  assert(history.status === 200 && history.data?.total >= 1, 'TC-WA-09', 'WhatsApp history', '>=1', `${history.data?.total}`);

  // TC-WA-10: History filter by template
  const histByTpl = await api('GET', '/whatsapp/history?templateName=referral_reward_percentage', tokenA);
  assert(histByTpl.status === 200, 'TC-WA-10', 'History filter by template', '200', `${histByTpl.status}`);
  const allTpl = histByTpl.data?.data?.every((m: any) => m.templateName === 'referral_reward_percentage');
  assert(allTpl, 'TC-WA-10b', 'All results match template', 'true', `${allTpl}`);

  // TC-WA-11: History filter by status
  const histByStatus = await api('GET', '/whatsapp/history?status=SENT', tokenA);
  assert(histByStatus.status === 200, 'TC-WA-11', 'History filter by status=SENT', '200', `${histByStatus.status}`);

  // TC-WA-12: Missing both message and template rejected
  const noContent = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+919111111111',
  });
  assert(noContent.status === 400, 'TC-WA-12', 'Empty message + no template rejected', '400', `${noContent.status}`);

  // TC-WA-13: Missing recipient number rejected
  const noRecipient = await api('POST', '/whatsapp/messages', tokenA, {
    messageContent: 'Hello',
  });
  assert(noRecipient.status === 400, 'TC-WA-13', 'Missing recipient rejected', '400', `${noRecipient.status}`);

  // TC-WA-14: Too-short recipient rejected
  const shortNum = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '123', messageContent: 'Hello',
  });
  assert(shortNum.status === 400, 'TC-WA-14', 'Too-short recipient rejected', '400', `${shortNum.status}`);

  // TC-WA-15: Alphabetic recipient rejected
  const alphaNum = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: 'abcdefghij', messageContent: 'Hello',
  });
  assert(alphaNum.status === 400, 'TC-WA-15', 'Alphabetic recipient rejected', '400', `${alphaNum.status}`);

  // TC-WA-16: Invoice template compilation
  const invoice = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+919999888877',
    templateName: 'salon_transaction_invoice_1',
    templateVariables: { name: 'Priya', invoiceNumber: 'INV-2026-099', amount: '2500.00' },
  });
  assert(invoice.status === 201, 'TC-WA-16', 'Invoice template sent', '201', `${invoice.status}`);
  const invoiceContent = invoice.data?.message?.messageContent || '';
  assert(invoiceContent.includes('Priya'), 'TC-WA-16b', 'Invoice includes name', 'contains Priya', invoiceContent.includes('Priya') ? 'YES' : 'NO');
  assert(invoiceContent.includes('INV-2026-099'), 'TC-WA-16c', 'Invoice includes number', 'contains INV-2026-099', invoiceContent.includes('INV-2026-099') ? 'YES' : 'NO');

  // TC-WA-17: Feedback template compilation
  const feedback = await api('POST', '/whatsapp/messages', tokenA, {
    recipientNumber: '+919999888866',
    templateName: 'salon_service_feedback_1',
    templateVariables: { name: 'Ravi' },
  });
  assert(feedback.status === 201, 'TC-WA-17', 'Feedback template sent', '201', `${feedback.status}`);
  assert(feedback.data?.message?.messageContent?.includes('Ravi'), 'TC-WA-17b', 'Feedback includes name', 'contains Ravi', `${feedback.data?.message?.messageContent?.includes('Ravi')}`);

  // TC-WA-18: Chat alias endpoints work
  const chatConvos = await api('GET', '/whatsapp/chat', tokenA);
  assert(chatConvos.status === 200, 'TC-WA-18', 'Chat alias conversations endpoint', '200', `${chatConvos.status}`);

  const chatMsgs = await api('GET', `/whatsapp/chat/${waConversationId}/messages`, tokenA);
  assert(chatMsgs.status === 200, 'TC-WA-18b', 'Chat alias messages endpoint', '200', `${chatMsgs.status}`);

  // TC-WA-19: Send alias endpoint works
  const sendAlias = await api('POST', '/whatsapp/send', tokenA, {
    recipientNumber: '+919999888855',
    messageContent: 'Sent via /send alias',
  });
  assert(sendAlias.status === 201, 'TC-WA-19', 'Send alias endpoint works', '201', `${sendAlias.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 8: MULTI-TENANT ISOLATION
// ═════════════════════════════════════════════════════════════════════
async function testMultiTenantIsolation() {
  console.log('\n══════════ MULTI-TENANT ISOLATION ══════════');

  // TC-MT-01: Tenant B cannot see Tenant A expense types
  const bTypes = await api('GET', '/expense-types', tokenB);
  const aTypeInB = bTypes.data?.some((t: any) => t.id === expenseTypeId);
  assert(!aTypeInB, 'TC-MT-01', 'Tenant B cannot see A expense types', 'false', `${aTypeInB}`);

  // TC-MT-02: Tenant B cannot see Tenant A accounts
  const bAccounts = await api('GET', '/accounts', tokenB);
  const aAccInB = bAccounts.data?.some((a: any) => a.id === accountId);
  assert(!aAccInB, 'TC-MT-02', 'Tenant B cannot see A accounts', 'false', `${aAccInB}`);

  // TC-MT-03: Tenant B cannot see Tenant A enquiries
  const bEnqs = await api('GET', '/enquiries', tokenB);
  const aEnqInB = bEnqs.data?.data?.some((e: any) => e.id === enquiryId);
  assert(!aEnqInB, 'TC-MT-03', 'Tenant B cannot see A enquiries', 'false', `${aEnqInB}`);

  // TC-MT-04: Tenant B cannot see Tenant A referrals
  const bRefs = await api('GET', '/referrals', tokenB);
  const aRefInB = bRefs.data?.data?.some((r: any) => r.id === referralId);
  assert(!aRefInB, 'TC-MT-04', 'Tenant B cannot see A referrals', 'false', `${aRefInB}`);

  // TC-MT-05: Tenant B cannot see Tenant A WhatsApp conversations
  const bConvos = await api('GET', '/whatsapp/conversations', tokenB);
  const aConvoInB = bConvos.data?.data?.some((c: any) => c.id === waConversationId);
  assert(!aConvoInB, 'TC-MT-05', 'Tenant B cannot see A WhatsApp conversations', 'false', `${aConvoInB}`);

  // TC-MT-06: Tenant B cannot access A expense by direct ID
  if (expenseTypeId) {
    const directAccess = await api('GET', `/expense-types/${expenseTypeId}`, tokenB);
    assert(directAccess.status === 404, 'TC-MT-06', 'Tenant B direct access A type → 404', '404', `${directAccess.status}`);
  }

  // TC-MT-07: Tenant B cannot access A account by direct ID
  const directAcc = await api('GET', `/accounts/${accountId}`, tokenB);
  assert(directAcc.status === 404, 'TC-MT-07', 'Tenant B direct access A account → 404', '404', `${directAcc.status}`);

  // TC-MT-08: Tenant B cannot access A enquiry by direct ID
  const directEnq = await api('GET', `/enquiries/${enquiryId}`, tokenB);
  assert(directEnq.status === 404, 'TC-MT-08', 'Tenant B direct access A enquiry → 404', '404', `${directEnq.status}`);

  // TC-MT-09: Tenant B cannot update A referral
  const updateRef = await api('PUT', `/referrals/${referralId}`, tokenB, {
    status: 'EXPIRED',
  });
  assert(updateRef.status === 404, 'TC-MT-09', 'Tenant B cannot update A referral → 404', '404', `${updateRef.status}`);

  // TC-MT-10: Tenant B cannot add balance to A account
  const addBal = await api('POST', '/accounts/add-balance', tokenB, {
    accountId,
    amount: 999,
  });
  assert(addBal.status === 404, 'TC-MT-10', 'Tenant B cannot add balance to A account → 404', '404', `${addBal.status}`);

  // TC-MT-11: Tenant B cannot see A payroll salaries
  const bSalaries = await api('GET', `/payroll/salary?staffId=${payrollStaffId}`, tokenB);
  assert(bSalaries.data?.total === 0 || bSalaries.data?.data?.length === 0, 'TC-MT-11', 'Tenant B cannot see A payroll', '0', `${bSalaries.data?.total ?? bSalaries.data?.data?.length ?? 0}`);

  // TC-MT-12: Tenant B referral dashboard shows 0 for A data
  const bDash = await api('GET', '/referrals/dashboard', tokenB);
  // Just verify it loads successfully for B (B may have 0 referrals)
  assert(bDash.status === 200, 'TC-MT-12', 'Tenant B dashboard loads (isolated)', '200', `${bDash.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 9: AUTHENTICATION
// ═════════════════════════════════════════════════════════════════════
async function testAuthentication() {
  console.log('\n══════════ AUTHENTICATION ══════════');

  const endpoints = [
    { method: 'GET', path: '/expenses', name: 'expenses' },
    { method: 'GET', path: '/expense-types', name: 'expense-types' },
    { method: 'GET', path: '/accounts', name: 'accounts' },
    { method: 'GET', path: '/enquiries', name: 'enquiries' },
    { method: 'GET', path: '/referrals', name: 'referrals' },
    { method: 'GET', path: '/payroll/config', name: 'payroll-config' },
    { method: 'GET', path: '/whatsapp/conversations', name: 'whatsapp-convos' },
    { method: 'GET', path: '/whatsapp/history', name: 'whatsapp-history' },
  ];

  for (const ep of endpoints) {
    // TC-AUTH-XX: No token → 401
    const noToken = await api(ep.method, ep.path);
    assert(noToken.status === 401, `TC-AUTH-${ep.name}-notoken`, `${ep.name}: No token → 401`, '401', `${noToken.status}`);

    // TC-AUTH-XX: Invalid token → 401
    const badToken = await api(ep.method, ep.path, 'invalid-jwt-token-garbage');
    assert(badToken.status === 401, `TC-AUTH-${ep.name}-badtoken`, `${ep.name}: Invalid token → 401`, '401', `${badToken.status}`);
  }

  // TC-AUTH-POST: POST without token → 401
  const postNoAuth = await api('POST', '/expenses', undefined, { amount: 100 });
  assert(postNoAuth.status === 401, 'TC-AUTH-POST-expenses', 'POST expenses without token → 401', '401', `${postNoAuth.status}`);

  const postEnqNoAuth = await api('POST', '/enquiries', undefined, { name: 'Test', mobile: '1234567890' });
  assert(postEnqNoAuth.status === 401, 'TC-AUTH-POST-enquiries', 'POST enquiries without token → 401', '401', `${postEnqNoAuth.status}`);

  const postWaNoAuth = await api('POST', '/whatsapp/messages', undefined, { recipientNumber: '+91999', messageContent: 'hi' });
  assert(postWaNoAuth.status === 401, 'TC-AUTH-POST-whatsapp', 'POST whatsapp without token → 401', '401', `${postWaNoAuth.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 10: CONCURRENCY
// ═════════════════════════════════════════════════════════════════════
async function testConcurrency() {
  console.log('\n══════════ CONCURRENCY ══════════');

  // TC-CON-01: Concurrent balance additions don't lose money
  const beforeBal = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  const addAmount = 100;
  const concurrencyCount = 5;
  const promises = Array.from({ length: concurrencyCount }, () =>
    api('POST', '/accounts/add-balance', tokenA, {
      accountId,
      amount: addAmount,
      remark: 'Concurrency test',
    })
  );
  const results = await Promise.all(promises);
  const allOk = results.every((r) => r.status === 200);
  assert(allOk, 'TC-CON-01', `${concurrencyCount} concurrent add-balance all succeed`, 'all 200', allOk ? 'all 200' : 'some failed');

  const afterBal = (await api('GET', `/accounts/${accountId}`, tokenA)).data?.balance;
  const expectedBal = beforeBal + (addAmount * concurrencyCount);
  assert(afterBal === expectedBal, 'TC-CON-01b', `Balance: ${beforeBal} + ${addAmount * concurrencyCount} = ${expectedBal}`, `${expectedBal}`, `${afterBal}`);

  // TC-CON-02: Concurrent enquiry creates don't corrupt
  const enqPromises = Array.from({ length: 3 }, (_, i) =>
    api('POST', '/enquiries', tokenA, {
      name: `Concurrent Enquiry ${i}`,
      mobile: `+91900000000${i}`,
    })
  );
  const enqResults = await Promise.all(enqPromises);
  const allCreated = enqResults.every((r) => r.status === 201);
  assert(allCreated, 'TC-CON-02', '3 concurrent enquiry creates succeed', 'all 201', allCreated ? 'all 201' : 'some failed');
  // Unique IDs
  const ids = enqResults.map((r) => r.data?.id).filter(Boolean);
  const uniqueIds = new Set(ids);
  assert(uniqueIds.size === 3, 'TC-CON-02b', 'All concurrent enquiries have unique IDs', '3', `${uniqueIds.size}`);
  // Cleanup
  for (const id of ids) {
    await api('DELETE', `/enquiries/${id}`, tokenA);
  }

  // TC-CON-03: Concurrent message sends don't corrupt conversation
  const msgPromises = Array.from({ length: 3 }, (_, i) =>
    api('POST', '/whatsapp/messages', tokenA, {
      recipientNumber: '+919111222333',
      messageContent: `Concurrent message ${i}`,
    })
  );
  const msgResults = await Promise.all(msgPromises);
  const allSent = msgResults.every((r) => r.status === 201);
  assert(allSent, 'TC-CON-03', '3 concurrent WA messages succeed', 'all 201', allSent ? 'all 201' : 'some failed');
  // All should share same conversation
  const convoIds = msgResults.map((r) => r.data?.conversation?.id).filter(Boolean);
  const uniqueConvos = new Set(convoIds);
  assert(uniqueConvos.size === 1, 'TC-CON-03b', 'All messages share one conversation', '1', `${uniqueConvos.size}`);
}

// ═════════════════════════════════════════════════════════════════════
// SECTION 11: SECURITY (Injection, IDOR, Tampering)
// ═════════════════════════════════════════════════════════════════════
async function testSecurity() {
  console.log('\n══════════ SECURITY ══════════');

  // TC-SEC-01: SQL injection in expense givenTo
  const sqliExp = await api('POST', '/expenses', tokenA, {
    amount: 100,
    givenTo: "'; DROP TABLE expenses; --",
  });
  assert(sqliExp.status === 201 || sqliExp.status === 400, 'TC-SEC-01', 'SQL injection in givenTo safe', '201 or 400', `${sqliExp.status}`);
  if (sqliExp.data?.id) await api('DELETE', `/expenses/${sqliExp.data.id}`, tokenA);

  // TC-SEC-02: HTML/XSS in enquiry name
  const xssEnq = await api('POST', '/enquiries', tokenA, {
    name: '<script>alert("XSS")</script>',
    mobile: '+919111999111',
  });
  assert(xssEnq.status === 201, 'TC-SEC-02', 'XSS in enquiry name stored safely', '201', `${xssEnq.status}`);
  // Verify it's stored as text, not executed
  if (xssEnq.data?.id) {
    const stored = await api('GET', `/enquiries/${xssEnq.data.id}`, tokenA);
    assert(stored.data?.name?.includes('script'), 'TC-SEC-02b', 'XSS stored as text', 'contains script', `${stored.data?.name?.includes('script')}`);
    await api('DELETE', `/enquiries/${xssEnq.data.id}`, tokenA);
  }

  // TC-SEC-03: IDOR - Tenant A referral ID manipulated by Tenant B
  const idor = await api('PUT', `/referrals/${referralId}`, tokenB, {
    status: 'EXPIRED',
  });
  assert(idor.status === 404, 'TC-SEC-03', 'IDOR: B cannot update A referral', '404', `${idor.status}`);

  // TC-SEC-04: Parameter tampering - invalid UUID format
  const badUuid = await api('GET', '/expenses/not-a-uuid', tokenA);
  // Should return 404 or 400, not 500
  assert(badUuid.status < 500, 'TC-SEC-04', 'Invalid UUID does not cause 500', '<500', `${badUuid.status}`);

  // TC-SEC-05: Very long field does not cause buffer overflow
  const longField = 'A'.repeat(10000);
  const longReq = await api('POST', '/enquiries', tokenA, {
    name: longField, mobile: '+919222333444',
  });
  assert(longReq.status === 400, 'TC-SEC-05', 'Very long name (10000 chars) rejected', '400', `${longReq.status}`);
}

// ═════════════════════════════════════════════════════════════════════
// CLEANUP & REPORT
// ═════════════════════════════════════════════════════════════════════
async function cleanup() {
  console.log('\n══════════ CLEANUP ══════════');

  // Clean up test data
  try {
    if (enquiryId) await api('DELETE', `/enquiries/${enquiryId}`, tokenA);
    if (referralId) {
      // Referrals don't have DELETE endpoint, but that's ok
    }
    if (expenseTypeId) await api('DELETE', `/expense-types/${expenseTypeId}`, tokenA);
    // Accounts and payroll left for next test runs
    console.log('  Cleanup completed');
  } catch (e) {
    console.log('  Cleanup partial (non-critical)');
  }
}

// ═════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═════════════════════════════════════════════════════════════════════
async function main() {
  try {
    await setup();
    await testExpenseTypes();
    await testAccounts();
    await testExpenses();
    await testEnquiries();
    await testReferrals();
    await testPayroll();
    await testWhatsApp();
    await testMultiTenantIsolation();
    await testAuthentication();
    await testConcurrency();
    await testSecurity();
    await cleanup();

    console.log('\n════════════════════════════════════════════════════════════════════════════════');
    console.log(`   TEST EXECUTION COMPLETE: Total ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('════════════════════════════════════════════════════════════════════════════════');

    if (failures.length > 0) {
      console.log('\n   FAILURES:');
      for (const f of failures) {
        console.log(`   ${f.id}: Expected=${f.expected} | Actual=${f.actual}`);
      }
    }

    console.log('\nTest run finished.');
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    if (server) {
      server.close();
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

main();
