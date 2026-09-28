import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';
import { UserStatus } from '@prisma/client';

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
  console.log('   QUBEXE SALOON SOFTWARE Unified Forgot Password Workflow Test Suite');
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
    // -------------------------------------------------------------
    // SETUP: Multi-Tenant Test Companies & Accounts
    // -------------------------------------------------------------
    console.log('\n--- Setup: Tenants & Test Accounts ---');

    // 1. Authenticate platform superadmin
    const superAdminLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(superAdminLogin.status === 200, 'SuperAdmin authenticates');
    const superToken = superAdminLogin.data?.data?.token;

    // 2. Create Company A
    const compARes = await request(
      'POST',
      '/api/platform/companies',
      {
        name: 'Forgot Test Salon Alpha',
        code: `forgot-alpha-${Date.now()}`,
        plan: 'PRO',
        admin: {
          username: `admin_alpha_${Date.now()}`,
          email: `admin_alpha_${Date.now()}@test.io`,
          phone: `+16000000001`,
          password: 'AdminPassword123!',
        },
      },
      { Authorization: `Bearer ${superToken}` }
    );
    assert(compARes.status === 201, 'Company Alpha created');
    const companyA = compARes.data?.data?.company;
    const adminAUser = compARes.data?.data?.adminUser;

    // 3. Create Company B
    const compBRes = await request(
      'POST',
      '/api/platform/companies',
      {
        name: 'Forgot Test Salon Beta',
        code: `forgot-beta-${Date.now()}`,
        plan: 'PRO',
        admin: {
          username: `admin_beta_${Date.now()}`,
          email: `admin_beta_${Date.now()}@test.io`,
          phone: `+16000000002`,
          password: 'AdminPassword123!',
        },
      },
      { Authorization: `Bearer ${superToken}` }
    );
    assert(compBRes.status === 201, 'Company Beta created');
    const companyB = compBRes.data?.data?.company;
    const adminBUser = compBRes.data?.data?.adminUser;

    // 4. Log in as Admin A and create Cashier A
    const adminALogin = await request('POST', '/api/auth/login', {
      username: adminAUser.username,
      password: 'AdminPassword123!',
    });
    assert(adminALogin.status === 200, 'Admin Alpha authenticates');
    const adminAToken = adminALogin.data?.data?.token;

    const cashierARes = await request(
      'POST',
      '/api/cashiers',
      {
        username: `cashier_alpha_${Date.now()}`,
        email: `cashier_alpha_${Date.now()}@test.io`,
        phone: `+16000000003`,
        password: 'CashierPassword123!',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(cashierARes.status === 201, 'Cashier Alpha created in Company Alpha');
    const cashierA = cashierARes.data?.data;

    // 5. Log in as Admin B and create Cashier B
    const adminBLogin = await request('POST', '/api/auth/login', {
      username: adminBUser.username,
      password: 'AdminPassword123!',
    });
    assert(adminBLogin.status === 200, 'Admin Beta authenticates');
    const adminBToken = adminBLogin.data?.data?.token;

    const cashierBRes = await request(
      'POST',
      '/api/cashiers',
      {
        username: `cashier_beta_${Date.now()}`,
        email: `cashier_beta_${Date.now()}@test.io`,
        phone: `+16000000004`,
        password: 'CashierPassword123!',
      },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(cashierBRes.status === 201, 'Cashier Beta created in Company Beta');
    const cashierB = cashierBRes.data?.data;

    // -------------------------------------------------------------
    // TEST GROUP 1: IDENTIFIER RESOLUTION & VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- 1. Identifier Resolution & Validation ---');

    // 1.1 Invalid / empty identifier
    const emptyIdRes = await request('POST', '/api/auth/forgot-password', {
      identifier: '   ',
    });
    assert(emptyIdRes.status === 400, 'Empty identifier returns HTTP 400 Bad Request');

    // 1.2 Non-existent identifier
    const nonExistentRes = await request('POST', '/api/auth/forgot-password', {
      identifier: 'completely_unknown_account_xyz_9999@nowhere.com',
    });
    assert(nonExistentRes.status === 404, 'Non-existent identifier returns HTTP 404');
    assert(
      nonExistentRes.data?.message === 'Account not found or invalid details.',
      'Non-existent identifier returns standard error message'
    );

    // 1.3 Inactive user lookup
    const inactiveUser = await prisma.user.findFirst({
      where: { status: UserStatus.INACTIVE },
    });
    if (inactiveUser) {
      const inactiveRes = await request('POST', '/api/auth/forgot-password', {
        identifier: inactiveUser.username,
      });
      assert(inactiveRes.status === 401, 'Inactive account returns HTTP 401 Unauthorized');
      assert(
        inactiveRes.data?.message.includes('inactive or suspended'),
        'Inactive account error message indicates status'
      );
    }

    // 1.4 Lookup via Mobile / Phone alias
    const phoneLookupRes = await request('POST', '/api/auth/forgot-password', {
      phone: cashierA.phone,
    });
    assert(phoneLookupRes.status === 200, 'Phone alias resolves account and returns HTTP 200');
    assert(phoneLookupRes.data?.data?.role === 'CASHIER', 'Phone lookup correctly identifies CASHIER role');

    // Clear reset request on cashierA for subsequent test
    await prisma.user.update({
      where: { id: cashierA.id },
      data: { passwordResetRequested: false, passwordResetRequestedAt: null },
    });

    // -------------------------------------------------------------
    // TEST GROUP 2: SUPERADMIN SELF-SERVICE RECOVERY WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- 2. SuperAdmin Self-Service Recovery Workflow ---');

    // 2.1 SuperAdmin enters identifier (email)
    const superAdminUser = await prisma.user.findFirst({ where: { username: 'superadmin' } });
    const superForgotRes = await request('POST', '/api/auth/forgot-password', {
      identifier: superAdminUser?.email || 'superadmin',
    });
    assert(superForgotRes.status === 200, 'SuperAdmin forgot-password returns HTTP 200');
    assert(superForgotRes.data?.data?.role === 'SUPERADMIN', 'Identified role is SUPERADMIN');
    assert(superForgotRes.data?.data?.mustChangePassword === true, 'mustChangePassword flag is true');
    assert(!!superForgotRes.data?.data?.delivery, 'Temporary credential delivery mechanism documented');
    assert(
      ['SMTP_NOT_CONFIGURED', 'DELIVERED'].includes(superForgotRes.data?.data?.delivery?.status),
      'Documents email/SMTP delivery status or not-configured state accurately'
    );
    const superTempPassword = superForgotRes.data?.data?.temporaryPassword;
    assert(!!superTempPassword, 'Temporary password provided in dev/test environment');

    // 2.2 SuperAdmin logs in with temporary password
    const superTempLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: superTempPassword,
    });
    assert(superTempLogin.status === 200, 'SuperAdmin authenticates using temporary password');
    assert(
      superTempLogin.data?.data?.user?.mustChangePassword === true,
      'User profile requires forced password change (mustChangePassword: true)'
    );
    const superTempToken = superTempLogin.data?.data?.token;

    // 2.3 SuperAdmin attempts change password with short password (< 8 chars)
    const superShortPwRes = await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: superTempPassword,
        newPassword: 'short',
      },
      { Authorization: `Bearer ${superTempToken}` }
    );
    assert(superShortPwRes.status === 400, 'Change password rejects new password < 8 characters');

    // 2.4 SuperAdmin attempts change password with wrong current password
    const superWrongCurrentRes = await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: 'WrongTemporaryPassword123!',
        newPassword: 'BrandNewSuperPass123!@#',
      },
      { Authorization: `Bearer ${superTempToken}` }
    );
    assert(superWrongCurrentRes.status === 400, 'Change password rejects incorrect current password');

    // 2.5 SuperAdmin successfully changes password
    const newSuperPassword = 'BrandNewSuperPass123!@#';
    const superChangePwRes = await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: superTempPassword,
        newPassword: newSuperPassword,
      },
      { Authorization: `Bearer ${superTempToken}` }
    );
    assert(superChangePwRes.status === 200, 'SuperAdmin changes password successfully');

    // 2.6 SuperAdmin logs in with new password
    const superNewLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: newSuperPassword,
    });
    assert(superNewLogin.status === 200, 'SuperAdmin authenticates with new password');
    assert(
      superNewLogin.data?.data?.user?.mustChangePassword === false,
      'mustChangePassword is now false after change'
    );

    // 2.7 Temporary password invalidated immediately
    const superTempReuseLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: superTempPassword,
    });
    assert(superTempReuseLogin.status === 401, 'Temporary password is invalid immediately after password change');

    // Restore original SuperAdmin password for subsequent test suites
    await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: newSuperPassword,
        newPassword: 'SuperAdminSecretPassword123!',
      },
      { Authorization: `Bearer ${superNewLogin.data?.data?.token}` }
    );

    // -------------------------------------------------------------
    // TEST GROUP 3: ADMIN SUPERADMIN-APPROVAL RECOVERY WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- 3. Admin SuperAdmin-Approval Recovery Workflow ---');

    // 3.1 Admin submits forgot password using username identifier
    const adminForgotRes = await request('POST', '/api/auth/forgot-password', {
      identifier: adminAUser.username,
    });
    assert(adminForgotRes.status === 200, 'Admin forgot-password returns HTTP 200');
    assert(adminForgotRes.data?.data?.role === 'ADMIN', 'Identified role is ADMIN');
    assert(adminForgotRes.data?.data?.status === 'PENDING_APPROVAL', 'Status is PENDING_APPROVAL');
    assert(
      adminForgotRes.data?.message.includes('contact the SuperAdmin for approval'),
      'Response directs Admin to contact SuperAdmin'
    );
    assert(!adminForgotRes.data?.data?.temporaryPassword, 'Admin does NOT receive temporary password directly');

    // 3.2 Duplicate request protection for Admin
    const adminDuplicateRes = await request('POST', '/api/auth/forgot-password', {
      identifier: adminAUser.username,
    });
    assert(adminDuplicateRes.status === 400, 'Duplicate reset request for Admin is blocked (HTTP 400)');
    assert(
      adminDuplicateRes.data?.message.includes('already pending approval'),
      'Duplicate error message informs that request is already pending'
    );

    // 3.3 SuperAdmin can see pending request in portal
    const pendingListRes = await request(
      'GET',
      '/api/platform/admin-reset-requests',
      undefined,
      { Authorization: `Bearer ${superToken}` }
    );
    assert(pendingListRes.status === 200, 'SuperAdmin retrieves pending admin reset requests');
    const pendingRequests = pendingListRes.data?.data || [];
    const targetRequest = pendingRequests.find((r: any) => r.id === adminAUser.id);
    assert(!!targetRequest, 'Admin Alpha appears in SuperAdmin pending reset requests list');
    assert(targetRequest?.tenant?.id === companyA.id, 'Target request includes company information');
    assert(targetRequest?.passwordResetRequested === true, 'passwordResetRequested is true');
    assert(!targetRequest?.passwordHash, 'Pending list NEVER exposes password hashes');

    // 3.4 Non-SuperAdmin cannot access admin reset portal
    const unauthorizedListRes = await request(
      'GET',
      '/api/platform/admin-reset-requests',
      undefined,
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(unauthorizedListRes.status === 403, 'Company Admin cannot access SuperAdmin admin reset requests (HTTP 403)');

    // 3.5 SuperAdmin approves Admin reset
    const adminApproveRes = await request(
      'POST',
      `/api/platform/admin-reset-requests/${adminAUser.id}/approve`,
      {},
      { Authorization: `Bearer ${superToken}` }
    );
    assert(adminApproveRes.status === 200, 'SuperAdmin approves Admin reset (HTTP 200)');
    const adminTempPassword = adminApproveRes.data?.data?.temporaryPassword;
    assert(!!adminTempPassword, 'SuperAdmin receives securely generated temporary password for Admin');
    assert(adminApproveRes.data?.data?.mustChangePassword === true, 'mustChangePassword flag is true');

    // 3.6 Admin logs in with temporary password
    const adminTempLogin = await request('POST', '/api/auth/login', {
      username: adminAUser.username,
      password: adminTempPassword,
    });
    assert(adminTempLogin.status === 200, 'Admin Alpha authenticates with temporary password');
    assert(
      adminTempLogin.data?.data?.user?.mustChangePassword === true,
      'Admin account requires forced password change'
    );
    const adminNewToken = adminTempLogin.data?.data?.token;

    // 3.7 Admin changes password
    const newAdminPassword = 'BrandNewAdminPass456!@#';
    const adminChangePwRes = await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: adminTempPassword,
        newPassword: newAdminPassword,
      },
      { Authorization: `Bearer ${adminNewToken}` }
    );
    assert(adminChangePwRes.status === 200, 'Admin changes password successfully');

    // 3.8 Admin logs in with new password
    const adminNewLogin = await request('POST', '/api/auth/login', {
      username: adminAUser.username,
      password: newAdminPassword,
    });
    assert(adminNewLogin.status === 200, 'Admin Alpha authenticates with new password');

    // 3.9 Admin temporary password is now invalid
    const adminTempReuse = await request('POST', '/api/auth/login', {
      username: adminAUser.username,
      password: adminTempPassword,
    });
    assert(adminTempReuse.status === 401, 'Admin temporary password is invalid after change');

    // -------------------------------------------------------------
    // TEST GROUP 4: CASHIER COMPANY ADMIN-APPROVAL & TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 4. Cashier Company Admin-Approval & Tenant Isolation ---');

    // 4.1 Cashier Alpha enters identifier on common forgot password screen
    const cashierForgotRes = await request('POST', '/api/auth/forgot-password', {
      identifier: cashierA.username,
    });
    assert(cashierForgotRes.status === 200, 'Cashier Alpha forgot-password returns HTTP 200');
    assert(cashierForgotRes.data?.data?.role === 'CASHIER', 'Identified role is CASHIER');
    assert(cashierForgotRes.data?.data?.status === 'PENDING_APPROVAL', 'Status is PENDING_APPROVAL');
    assert(
      cashierForgotRes.data?.message.includes('contact your company Administrator'),
      'Response directs Cashier to contact company Administrator'
    );
    assert(!cashierForgotRes.data?.data?.temporaryPassword, 'Cashier does NOT receive temporary password directly');

    // 4.2 Duplicate request protection for Cashier
    const cashierDuplicateRes = await request('POST', '/api/auth/forgot-password', {
      identifier: cashierA.email,
    });
    assert(cashierDuplicateRes.status === 400, 'Duplicate reset request for Cashier is blocked (HTTP 400)');
    assert(
      cashierDuplicateRes.data?.message.includes('already pending approval'),
      'Duplicate error message informs that request is already pending'
    );

    // 4.3 Multi-Tenant Visibility Test:
    // Admin A (same tenant) sees Cashier A in pending requests
    const adminAListCashiers = await request(
      'GET',
      '/api/cashiers?resetRequested=true',
      undefined,
      { Authorization: `Bearer ${adminNewLogin.data?.data?.token}` }
    );
    assert(adminAListCashiers.status === 200, 'Admin Alpha retrieves pending cashier requests');
    const adminAItems = adminAListCashiers.data?.data?.items || [];
    assert(adminAItems.some((c: any) => c.id === cashierA.id), 'Admin Alpha sees Cashier Alpha');

    // Admin B (different tenant) CANNOT see Cashier A
    const adminBListCashiers = await request(
      'GET',
      '/api/cashiers?resetRequested=true',
      undefined,
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(adminBListCashiers.status === 200, 'Admin Beta retrieves pending cashier requests');
    const adminBItems = adminBListCashiers.data?.data?.items || [];
    assert(!adminBItems.some((c: any) => c.id === cashierA.id), 'Admin Beta CANNOT see Cashier Alpha');

    // 4.4 Multi-Tenant Cross-Tenant Approval Attempt:
    // Admin B attempts to approve Cashier A's reset request -> must fail!
    const crossTenantApproveRes = await request(
      'POST',
      `/api/cashiers/${cashierA.id}/approve-reset`,
      {},
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(
      crossTenantApproveRes.status === 404 || crossTenantApproveRes.status === 403,
      'Cross-tenant reset approval is rejected with 403/404'
    );

    // 4.5 Admin A approves Cashier A reset request
    const correctApproveRes = await request(
      'POST',
      `/api/cashiers/${cashierA.id}/approve-reset`,
      {},
      { Authorization: `Bearer ${adminNewLogin.data?.data?.token}` }
    );
    assert(correctApproveRes.status === 200, 'Admin Alpha approves Cashier Alpha reset (HTTP 200)');
    const cashierTempPassword = correctApproveRes.data?.data?.temporaryPassword;
    assert(!!cashierTempPassword, 'Admin Alpha receives temporary password for Cashier');

    // 4.6 Cashier A logs in with temporary password
    const cashierTempLogin = await request('POST', '/api/auth/login', {
      username: cashierA.username,
      password: cashierTempPassword,
    });
    assert(cashierTempLogin.status === 200, 'Cashier Alpha authenticates with temporary password');
    assert(
      cashierTempLogin.data?.data?.user?.mustChangePassword === true,
      'Cashier account requires forced password change'
    );
    const cashierToken = cashierTempLogin.data?.data?.token;

    // 4.7 Cashier A changes password
    const newCashierPassword = 'BrandNewCashierPass789!@#';
    const cashierChangePwRes = await request(
      'POST',
      '/api/auth/change-password',
      {
        currentPassword: cashierTempPassword,
        newPassword: newCashierPassword,
      },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierChangePwRes.status === 200, 'Cashier Alpha changes password successfully');

    // 4.8 Cashier logs in with new password
    const cashierNewLogin = await request('POST', '/api/auth/login', {
      username: cashierA.username,
      password: newCashierPassword,
    });
    assert(cashierNewLogin.status === 200, 'Cashier Alpha authenticates with new password');

    // 4.9 Cashier temporary password is now invalid
    const cashierTempReuse = await request('POST', '/api/auth/login', {
      username: cashierA.username,
      password: cashierTempPassword,
    });
    assert(cashierTempReuse.status === 401, 'Cashier temporary password is invalid after change');

    // -------------------------------------------------------------
    // TEST GROUP 5: AUDIT TRAIL VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 5. Audit Trail Verification ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_APPROVED', 'PASSWORD_RESET_COMPLETED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const hasRequested = auditLogs.some((l) => l.action === 'PASSWORD_RESET_REQUESTED');
    const hasApproved = auditLogs.some((l) => l.action === 'PASSWORD_RESET_APPROVED');
    const hasCompleted = auditLogs.some((l) => l.action === 'PASSWORD_RESET_COMPLETED');

    assert(hasRequested, 'PASSWORD_RESET_REQUESTED audit event recorded');
    assert(hasApproved, 'PASSWORD_RESET_APPROVED audit event recorded');
    assert(hasCompleted, 'PASSWORD_RESET_COMPLETED audit event recorded');

    // Check that NO passwords or password hashes appear in audit log metadata
    let cleanLogs = true;
    for (const log of auditLogs) {
      const metaStr = JSON.stringify(log.metadata || {});
      if (
        metaStr.includes('passwordHash') ||
        metaStr.includes('temporaryPassword') ||
        metaStr.includes('Temp#') ||
        metaStr.includes('AdminPass#')
      ) {
        cleanLogs = false;
        console.error(`Audit log ${log.id} leaked credentials in metadata:`, metaStr);
      }
    }
    assert(cleanLogs, 'Audit logs contain zero credentials, temporary passwords, or password hashes');

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- Cleanup ---');
    await prisma.user.deleteMany({
      where: {
        tenantId: { in: [companyA.id, companyB.id] },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        tenantId: { in: [companyA.id, companyB.id] },
      },
    });
    await prisma.tenant.deleteMany({
      where: {
        id: { in: [companyA.id, companyB.id] },
      },
    });
    assert(true, 'Test companies and accounts cleaned up');

  } catch (error: any) {
    console.error('Unexpected test suite error:', error);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`Unified Forgot Password Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
