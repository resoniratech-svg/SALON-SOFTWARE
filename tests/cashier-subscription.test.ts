import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;

async function request(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
) {
  const url = `${baseUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Cashier Management, Two-Tier Modules & Subscription');
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

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SETUP: Authenticate SuperAdmin and create two test companies (Company A and B)
    // -------------------------------------------------------------------------
    console.log('\n--- Setup: SuperAdmin & Test Companies ---');

    const superLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(superLogin.status === 200, 'SuperAdmin platform login (HTTP 200)');
    const superToken = superLogin.data?.data?.token;

    // Company A: cashierLimit = 2, enabledModules = ['SERVICES', 'PRODUCTS']
    const codeA = `test-co-a-${Date.now()}`;
    const compARes = await request('POST', '/api/platform/companies', {
      name: 'Company A Salons',
      code: codeA,
      plan: 'PRO',
      cashierLimit: 2,
      enabledModules: ['SERVICES', 'PRODUCTS'],
      admin: {
        username: `admin_a_${Date.now()}`,
        email: `admin_a_${Date.now()}@companya.com`,
        password: 'AdminPassword123!',
      },
    }, { Authorization: `Bearer ${superToken}` });
    assert(compARes.status === 201, 'Company A created with cashierLimit = 2');
    const compAId = compARes.data?.data?.id || compARes.data?.data?.company?.id;
    const adminAUser = compARes.data?.data?.adminUser?.username;

    // Login as Admin A
    const adminALogin = await request('POST', '/api/auth/login', {
      username: adminAUser,
      password: 'AdminPassword123!',
    });
    assert(adminALogin.status === 200, 'Company A Admin logs in (HTTP 200)');
    const adminAToken = adminALogin.data?.data?.token;

    // Company B: cashierLimit = 2, enabledModules = ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF']
    const codeB = `test-co-b-${Date.now()}`;
    const compBRes = await request('POST', '/api/platform/companies', {
      name: 'Company B Salons',
      code: codeB,
      plan: 'PRO',
      cashierLimit: 2,
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF'],
      admin: {
        username: `admin_b_${Date.now()}`,
        email: `admin_b_${Date.now()}@companyb.com`,
        password: 'AdminPassword123!',
      },
    }, { Authorization: `Bearer ${superToken}` });
    assert(compBRes.status === 201, 'Company B created with cashierLimit = 2');
    const compBId = compBRes.data?.data?.id || compBRes.data?.data?.company?.id;
    const adminBUser = compBRes.data?.data?.adminUser?.username;

    const adminBLogin = await request('POST', '/api/auth/login', {
      username: adminBUser,
      password: 'AdminPassword123!',
    });
    assert(adminBLogin.status === 200, 'Company B Admin logs in (HTTP 200)');
    const adminBToken = adminBLogin.data?.data?.token;

    // -------------------------------------------------------------------------
    // SECTION 1: CASHIER LIMITS & CONCURRENCY ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Cashier Limits & Concurrency Enforcement ---');

    // 1.1 Company A creates Cashier 1 (Allowed)
    const cashier1Username = `cashier1_${Date.now()}`;
    const c1Res = await request('POST', '/api/cashiers', {
      username: cashier1Username,
      email: `${cashier1Username}@companya.com`,
      password: 'CashierPassword123!',
      enabledModules: ['SERVICES'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(c1Res.status === 201, 'Company A creates Cashier 1 (HTTP 201)');
    const cashier1Id = c1Res.data?.data?.id;

    // 1.2 Concurrency test: Company A currently has 1 Cashier (Limit = 2).
    // Send two concurrent creation requests simultaneously!
    console.log('  Executing concurrent creation test (1 slot remaining)...');
    const cashier2AUsername = `cashier2a_${Date.now()}`;
    const cashier2BUsername = `cashier2b_${Date.now()}`;

    const [concurrentResA, concurrentResB] = await Promise.all([
      request('POST', '/api/cashiers', {
        username: cashier2AUsername,
        password: 'CashierPassword123!',
        enabledModules: ['SERVICES'],
      }, { Authorization: `Bearer ${adminAToken}` }),
      request('POST', '/api/cashiers', {
        username: cashier2BUsername,
        password: 'CashierPassword123!',
        enabledModules: ['SERVICES'],
      }, { Authorization: `Bearer ${adminAToken}` }),
    ]);

    const statuses = [concurrentResA.status, concurrentResB.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 400,
      'Concurrent test: Exactly 1 request succeeds (201) and 1 is rejected (400)',
      `Got statuses: ${statuses.join(', ')}`
    );

    // Verify exact count in DB = 2
    const dbCountA = await prisma.user.count({
      where: { tenantId: compAId, role: { name: 'CASHIER' }, status: 'ACTIVE' },
    });
    assert(dbCountA === 2, `Database has exactly 2 cashiers for Company A (Got: ${dbCountA})`);

    // 1.3 Subsequent creation attempt when limit reached is rejected
    const c3Res = await request('POST', '/api/cashiers', {
      username: `cashier3_${Date.now()}`,
      password: 'CashierPassword123!',
      enabledModules: ['SERVICES'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(c3Res.status === 400, 'Company A creating 3rd cashier is rejected (400 limit reached)');
    assert(c3Res.data?.message?.includes('limit reached'), 'Error message clearly indicates limit reached');

    // 1.4 Tenant Scoping of Limits: Company A reaching limit has ZERO impact on Company B
    const bCashier1Username = `b_cashier1_${Date.now()}`;
    const bC1Res = await request('POST', '/api/cashiers', {
      username: bCashier1Username,
      password: 'CashierPassword123!',
      enabledModules: ['SERVICES', 'PRODUCTS'],
    }, { Authorization: `Bearer ${adminBToken}` });
    assert(bC1Res.status === 201, 'Company B can create Cashier 1 even though Company A reached limit');
    const bCashier1Id = bC1Res.data?.data?.id;

    // 1.5 SuperAdmin changes Cashier Limit: Increase limit to 3
    const incLimitRes = await request('PATCH', `/api/platform/companies/${compAId}/cashier-limit`, {
      cashierLimit: 3,
    }, { Authorization: `Bearer ${superToken}` });
    assert(incLimitRes.status === 200, 'SuperAdmin increases Company A cashier limit to 3');

    // Now Company A can create the 3rd Cashier
    const cashier3Username = `cashier3_${Date.now()}`;
    const c3AllowedRes = await request('POST', '/api/cashiers', {
      username: cashier3Username,
      password: 'CashierPassword123!',
      enabledModules: ['SERVICES'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(c3AllowedRes.status === 201, 'Company A creates 3rd cashier after SuperAdmin increased limit');
    const cashier3Id = c3AllowedRes.data?.data?.id;

    // 1.6 Cashier Limit Reduction: SuperAdmin reduces limit to 2
    // Existing 3 cashiers remain; new creation is blocked
    const redLimitRes = await request('PATCH', `/api/platform/companies/${compAId}/cashier-limit`, {
      cashierLimit: 2,
    }, { Authorization: `Bearer ${superToken}` });
    assert(redLimitRes.status === 200, 'SuperAdmin reduces Company A cashier limit to 2');

    const c4Res = await request('POST', '/api/cashiers', {
      username: `cashier4_${Date.now()}`,
      password: 'CashierPassword123!',
      enabledModules: ['SERVICES'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(c4Res.status === 400, 'New Cashier creation blocked when count (3) >= reduced limit (2)');

    // Verify existing 3 cashiers in DB remain untouched
    const dbCountAfterReduction = await prisma.user.count({
      where: { tenantId: compAId, role: { name: 'CASHIER' }, status: 'ACTIVE' },
    });
    assert(dbCountAfterReduction === 3, 'Existing 3 cashiers remain active after limit reduction');

    // -------------------------------------------------------------------------
    // SECTION 2: TWO-TIER MODULE ACCESS ENFORCEMENT & COMPANY-LEVEL VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Two-Tier Module Access & Validation ---');

    // Company A has modules: ['SERVICES', 'PRODUCTS']
    // Company A does NOT have: 'DISPOSABLES'

    // 2.1 Admin attempts to assign disabled company module to Cashier -> REJECTED (400)
    const invalidAssignRes = await request('PATCH', `/api/cashiers/${cashier1Id}/modules`, {
      enabledModules: ['SERVICES', 'DISPOSABLES'], // DISPOSABLES is not enabled for Company A
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(invalidAssignRes.status === 400, 'Admin assigning disabled company module (DISPOSABLES) is rejected (400)');
    assert(invalidAssignRes.data?.message?.includes('not enabled for the company'), 'Error explains module not enabled for company');

    // 2.2 Admin assigns ['SERVICES'] to Cashier 1 (PRODUCTS is disabled for Cashier 1)
    const validAssignRes = await request('PATCH', `/api/cashiers/${cashier1Id}/modules`, {
      enabledModules: ['SERVICES'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(validAssignRes.status === 200, 'Admin assigns enabled module (SERVICES) to Cashier 1');

    // Login as Cashier 1
    const c1Login = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: 'CashierPassword123!',
    });
    assert(c1Login.status === 200, 'Cashier 1 logs in successfully (HTTP 200)');
    const cashier1Token = c1Login.data?.data?.token;

    // 2.3 Tier 1 ON, Tier 2 ON: Company has SERVICES, Cashier has SERVICES -> ALLOWED (200)
    const accessServices = await request('GET', '/api/services', undefined, {
      Authorization: `Bearer ${cashier1Token}`,
    });
    assert(accessServices.status === 200, 'Company ON + Cashier ON: Cashier 1 accesses /api/services (200 ALLOWED)');

    // 2.4 Tier 1 ON, Tier 2 OFF: Company has PRODUCTS, but Cashier 1 has PRODUCTS = OFF -> BLOCKED (403)
    const accessProducts = await request('GET', '/api/products', undefined, {
      Authorization: `Bearer ${cashier1Token}`,
    });
    assert(accessProducts.status === 403, 'Company ON + Cashier OFF: Cashier 1 calling /api/products returns 403 Forbidden');
    assert(accessProducts.data?.message?.includes('not assigned to this cashier'), 'Error specifies module not assigned to cashier');

    // 2.5 Tier 1 OFF, Tier 2 OFF: Company doesn't have DISPOSABLES -> BLOCKED (403)
    const accessDisposables = await request('GET', '/api/disposables', undefined, {
      Authorization: `Bearer ${cashier1Token}`,
    });
    assert(accessDisposables.status === 403, 'Company OFF: Cashier 1 calling /api/disposables returns 403 Forbidden');

    // 2.6 Dynamic Module Update: Admin enables PRODUCTS for Cashier 1 -> Cashier 1 can now access PRODUCTS!
    const enableProductsRes = await request('PATCH', `/api/cashiers/${cashier1Id}/modules`, {
      enabledModules: ['SERVICES', 'PRODUCTS'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(enableProductsRes.status === 200, 'Admin dynamically updates Cashier 1 enabledModules to include PRODUCTS');

    // Cashier 1 fetches new token or uses existing re-validated on request
    const accessProductsAfterUpdate = await request('GET', '/api/products', undefined, {
      Authorization: `Bearer ${cashier1Token}`,
    });
    assert(accessProductsAfterUpdate.status === 200, 'Cashier 1 now accesses /api/products (200 ALLOWED)');

    // 2.7 Cashier cannot change their own module access
    const cashierSelfModuleAttempt = await request('PATCH', `/api/cashiers/${cashier1Id}/modules`, {
      enabledModules: ['SERVICES', 'PRODUCTS', 'STAFF'],
    }, { Authorization: `Bearer ${cashier1Token}` });
    assert(cashierSelfModuleAttempt.status === 403, 'Cashier cannot update their own module access (403 Forbidden)');

    // -------------------------------------------------------------------------
    // SECTION 3: CASHIER PASSWORD RECOVERY (STRICT ADMIN APPROVAL FLOW)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cashier Password Recovery Workflow ---');

    // 3.1 Cashier requests password reset via authenticated endpoint
    const resetReq1 = await request('POST', '/api/auth/cashier/forgot-password', undefined, {
      Authorization: `Bearer ${cashier1Token}`,
    });
    assert(resetReq1.status === 200, 'Cashier 1 requests password reset (HTTP 200)');
    assert(resetReq1.data?.message?.includes('Administrator for approval'), 'Message confirms submission for Admin approval');

    // Verify in DB that passwordResetRequested is set to true
    const dbCashier1 = await prisma.user.findUnique({ where: { id: cashier1Id } });
    assert(dbCashier1?.passwordResetRequested === true, 'Database has passwordResetRequested = true');

    // 3.2 Duplicate reset request while one is already pending -> REJECTED (400)
    const duplicateResetReq = await request('POST', '/api/auth/cashier/forgot-password', undefined, {
      Authorization: `Bearer ${cashier1Token}`,
    });
    assert(duplicateResetReq.status === 400, 'Duplicate reset request rejected because one is already pending');

    // 3.3 Admin views Cashier list and sees reset requested
    const listWithReset = await request('GET', '/api/cashiers?resetRequested=true', undefined, {
      Authorization: `Bearer ${adminAToken}`
    });
    assert(listWithReset.status === 200, 'Admin queries pending password resets');
    assert(listWithReset.data?.data?.items?.some((u: any) => u.id === cashier1Id), 'Cashier 1 appears in pending reset list');

    // 3.4 Cross-Tenant Security: Company B Admin attempts to approve Company A Cashier reset -> REJECTED (404)
    const crossResetAttempt = await request('POST', `/api/cashiers/${cashier1Id}/approve-reset`, undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(crossResetAttempt.status === 404, 'Cross-tenant: Company B Admin cannot approve Company A Cashier reset (404 Not Found)');

    // 3.5 Company A Admin approves reset
    const approveResetRes = await request('POST', `/api/cashiers/${cashier1Id}/approve-reset`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(approveResetRes.status === 200, 'Company A Admin approves Cashier 1 reset (HTTP 200)');
    const temporaryPassword = approveResetRes.data?.data?.temporaryPassword;
    assert(Boolean(temporaryPassword), 'Temporary password returned to Admin');
    assert(temporaryPassword.startsWith('TempPass#'), 'Temporary password matches secure prefix');

    // Verify DB state: passwordResetRequested is now false, mustChangePassword is true
    const dbCashier1AfterApproval = await prisma.user.findUnique({ where: { id: cashier1Id } });
    assert(dbCashier1AfterApproval?.passwordResetRequested === false, 'passwordResetRequested reset to false');
    assert(dbCashier1AfterApproval?.mustChangePassword === true, 'mustChangePassword set to true');

    // 3.6 Old password no longer works
    const oldPassLogin = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: 'CashierPassword123!',
    });
    assert(oldPassLogin.status === 401, 'Old password rejected after reset (HTTP 401)');

    // 3.7 Login with temporary password works and indicates mustChangePassword = true
    const tempPassLogin = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: temporaryPassword,
    });
    assert(tempPassLogin.status === 200, 'Cashier 1 logs in with temporary password (HTTP 200)');
    assert(tempPassLogin.data?.data?.user?.mustChangePassword === true, 'Login response flags mustChangePassword = true');
    const tempToken = tempPassLogin.data?.data?.token;

    // 3.8 Cashier changes password to a new permanent password
    const newPermanentPassword = 'MyNewPermanentPassword123!';
    const changePassRes = await request('POST', '/api/auth/change-password', {
      currentPassword: temporaryPassword,
      newPassword: newPermanentPassword,
    }, { Authorization: `Bearer ${tempToken}` });
    assert(changePassRes.status === 200, 'Cashier changes password to permanent password (HTTP 200)');

    // Verify DB state: mustChangePassword is now false
    const dbCashier1Final = await prisma.user.findUnique({ where: { id: cashier1Id } });
    assert(dbCashier1Final?.mustChangePassword === false, 'mustChangePassword reset to false in DB');

    // 3.9 Temporary password no longer works
    const tempPassReuse = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: temporaryPassword,
    });
    assert(tempPassReuse.status === 401, 'Temporary password invalidated after permanent password change (HTTP 401)');

    // 3.10 New permanent password works
    const newPassLogin = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: newPermanentPassword,
    });
    assert(newPassLogin.status === 200, 'New permanent password works for authentication (HTTP 200)');

    // -------------------------------------------------------------------------
    // SECTION 4: TENANT ISOLATION & CROSS-TENANT DEFENSE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Cross-Tenant Cashier Isolation ---');

    // Company A Admin attempts to GET Company B Cashier -> 404
    const crossGet = await request('GET', `/api/cashiers/${bCashier1Id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(crossGet.status === 404, 'Company A Admin cannot GET Company B Cashier (404 Not Found)');

    // Company A Admin attempts to UPDATE Company B Cashier -> 404
    const crossUpdate = await request('PUT', `/api/cashiers/${bCashier1Id}`, {
      email: 'hacked@companya.com',
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(crossUpdate.status === 404, 'Company A Admin cannot UPDATE Company B Cashier (404 Not Found)');

    // Company A Admin attempts to UPDATE MODULES of Company B Cashier -> 404
    const crossModules = await request('PATCH', `/api/cashiers/${bCashier1Id}/modules`, {
      enabledModules: ['SERVICES'],
    }, { Authorization: `Bearer ${adminAToken}` });
    assert(crossModules.status === 404, 'Company A Admin cannot update modules of Company B Cashier (404 Not Found)');

    // Company A Admin attempts to DELETE Company B Cashier -> 404
    const crossDelete = await request('DELETE', `/api/cashiers/${bCashier1Id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(crossDelete.status === 404, 'Company A Admin cannot DELETE Company B Cashier (404 Not Found)');

    // Cashier A attempts to access platform APIs -> 403
    const cashierPlatformAttempt = await request('GET', '/api/platform/companies', undefined, {
      Authorization: `Bearer ${newPassLogin.data?.data?.token}`,
    });
    assert(cashierPlatformAttempt.status === 403, 'Cashier cannot access platform APIs (403 Forbidden)');

    // -------------------------------------------------------------------------
    // SECTION 5: SUBSCRIPTION EXPIRY, RENEWAL DATE ARITHMETIC & DASHBOARD
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Subscription Lifecycle, Exact Renewal Arithmetic & Dashboard ---');

    // 5.1 Set Company A expiry to a fixed known future date: exactly 5 days from now
    const now = Date.now();
    const fiveDaysFromNow = new Date(now + 5 * 24 * 60 * 60 * 1000);
    await prisma.tenant.update({
      where: { id: compAId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: fiveDaysFromNow,
      },
    });

    // 5.2 Dashboard Check: Admin and Cashier profiles expose subscription and daysRemaining
    const adminMe = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(adminMe.status === 200, 'Admin /api/auth/me returns 200');
    assert(adminMe.data?.data?.subscription?.plan === 'PRO', 'Admin profile displays plan PRO');
    assert(adminMe.data?.data?.subscription?.daysRemaining === 5, 'Admin profile displays 5 days remaining');

    const cashierMe = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${newPassLogin.data?.data?.token}`,
    });
    assert(cashierMe.status === 200, 'Cashier /api/auth/me returns 200');
    assert(cashierMe.data?.data?.subscription?.plan === 'PRO', 'Cashier profile displays plan PRO');
    assert(cashierMe.data?.data?.subscription?.daysRemaining === 5, 'Cashier profile displays 5 days remaining');

    // 5.3 Active Renewal: Renew for 30 days while 5 days remain!
    // Exact Date Math: newExpiry must be fiveDaysFromNow + 30 days = 35 days from now!
    // Remaining 5 days MUST BE PRESERVED!
    const renewActiveRes = await request('POST', `/api/platform/companies/${compAId}/renew-subscription`, {
      durationDays: 30,
    }, { Authorization: `Bearer ${superToken}` });
    assert(renewActiveRes.status === 200, 'SuperAdmin renews active company subscription for 30 days');

    const expectedActiveExpiry = new Date(fiveDaysFromNow.getTime() + 30 * 24 * 60 * 60 * 1000);
    const updatedTenantA = await prisma.tenant.findUnique({ where: { id: compAId } });
    const actualNewExpiry = updatedTenantA?.subscriptionExpiresAt?.getTime() || 0;

    // Tolerance within 2 seconds
    const diffMs = Math.abs(actualNewExpiry - expectedActiveExpiry.getTime());
    assert(diffMs < 2000, `Active renewal extends from current expiry date: preserved remaining 5 days (Difference: ${diffMs}ms)`);

    // Verify dashboard reflects preserved time (~35 days remaining)
    const adminMeAfterRenew = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(adminMeAfterRenew.data?.data?.subscription?.daysRemaining === 35, 'Dashboard reflects 35 days remaining after 30-day renewal');

    // 5.4 Expired Subscription: Set Company A subscription to EXPIRED in the past
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    await prisma.tenant.update({
      where: { id: compAId },
      data: {
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiresAt: pastExpiry,
      },
    });

    // 5.5 Expired Lockout: Admin login is blocked with explicit message
    const expiredAdminLogin = await request('POST', '/api/auth/login', {
      username: adminAUser,
      password: 'AdminPassword123!',
    });
    assert(expiredAdminLogin.status === 401, 'Expired Company Admin login blocked (401)');
    assert(
      expiredAdminLogin.data?.message?.includes('Your company subscription has expired'),
      'Expired login response returns explicit subscription-expired message'
    );

    // 5.6 Expired Lockout: Cashier login is also blocked with explicit message
    const expiredCashierLogin = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: newPermanentPassword,
    });
    assert(expiredCashierLogin.status === 401, 'Expired Cashier login blocked (401)');
    assert(
      expiredCashierLogin.data?.message?.includes('Your company subscription has expired'),
      'Cashier expired login returns explicit subscription-expired message'
    );

    // 5.7 SuperAdmin platform context remains fully functional for the expired company
    const superPlatformView = await request('GET', `/api/platform/companies/${compAId}`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(superPlatformView.status === 200, 'SuperAdmin platform context can still manage expired company');

    // 5.8 Expired Renewal: SuperAdmin renews expired subscription for 30 days
    // Rule: Starts from now + 30 days
    const renewExpiredStartTime = Date.now();
    const renewExpiredRes = await request('POST', `/api/platform/companies/${compAId}/renew-subscription`, {
      durationDays: 30,
      plan: 'ENTERPRISE',
    }, { Authorization: `Bearer ${superToken}` });
    assert(renewExpiredRes.status === 200, 'SuperAdmin renews expired company subscription');

    const expectedExpiredExpiry = new Date(renewExpiredStartTime + 30 * 24 * 60 * 60 * 1000);
    const tenantAAfterExpiredRenew = await prisma.tenant.findUnique({ where: { id: compAId } });
    assert(tenantAAfterExpiredRenew?.subscriptionStatus === 'ACTIVE', 'Subscription status restored to ACTIVE');
    const diffExpiredMs = Math.abs((tenantAAfterExpiredRenew?.subscriptionExpiresAt?.getTime() || 0) - expectedExpiredExpiry.getTime());
    assert(diffExpiredMs < 5000, `Expired renewal starts from current time (now + 30 days) (Difference: ${diffExpiredMs}ms)`);

    // 5.9 Login unblocked for Admin and Cashier after renewal!
    const unblockedAdminLogin = await request('POST', '/api/auth/login', {
      username: adminAUser,
      password: 'AdminPassword123!',
    });
    assert(unblockedAdminLogin.status === 200, 'Admin can log in again after renewal');

    const unblockedCashierLogin = await request('POST', '/api/auth/login', {
      username: cashier1Username,
      password: newPermanentPassword,
    });
    assert(unblockedCashierLogin.status === 200, 'Cashier can log in again after renewal');

    // -------------------------------------------------------------------------
    // SECTION 6: SUPERADMIN IMPERSONATION & CASHIERS
    // -------------------------------------------------------------------------
    console.log('\n--- 6. SuperAdmin Impersonation & Cashier Scoping ---');

    // 6.1 SuperAdmin starts impersonation of Company A
    const impRes = await request('POST', `/api/platform/companies/${compAId}/impersonate`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(impRes.status === 200, 'SuperAdmin starts impersonation of Company A');
    const impToken = impRes.data?.data?.token;

    // 6.2 Cashier list under impersonation returns Company A Cashiers ONLY
    const impCashierList = await request('GET', '/api/cashiers', undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impCashierList.status === 200, 'Impersonating SuperAdmin lists cashiers');
    const impItems = impCashierList.data?.data?.items || [];
    assert(impItems.every((c: any) => c.tenantId === compAId), 'All returned cashiers belong strictly to Company A');
    assert(!impItems.some((c: any) => c.id === bCashier1Id), 'Company B Cashier is NOT present in Company A impersonation');

    // 6.3 SuperAdmin impersonating Company A attempting Company B Cashier -> 404
    const impCrossGet = await request('GET', `/api/cashiers/${bCashier1Id}`, undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impCrossGet.status === 404, 'Impersonating SuperAdmin cannot access Company B Cashier (404 Not Found)');

    // 6.4 Exit impersonation
    const exitRes = await request('POST', '/api/platform/impersonate/exit', undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(exitRes.status === 200, 'SuperAdmin exits impersonation cleanly');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- Cleanup ---');
    await prisma.user.deleteMany({
      where: {
        OR: [
          { tenantId: compAId },
          { tenantId: compBId },
        ],
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { tenantId: compAId },
          { tenantId: compBId },
        ],
      },
    });
    await prisma.tenant.deleteMany({
      where: {
        id: { in: [compAId, compBId] },
      },
    });
    console.log('  [PASS] Test tenants and users cleaned up');

  } catch (err: any) {
    console.error('\n❌ Test execution error:', err);
    failed++;
  } finally {
    server?.close();
  }

  console.log('\n================================================================');
  console.log(`Cashier & Subscription Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
