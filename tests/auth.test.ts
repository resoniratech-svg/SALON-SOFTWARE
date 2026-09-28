import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/environment.js';

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
  console.log('\n========================================');
  console.log('   QUBEXE SALOON SOFTWARE Auth Module Test Suite');
  console.log('========================================\n');

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
    // TEST GROUP 1: LOGIN
    // -------------------------------------------------------------
    console.log('--- 1. Login Tests ---');

    // 1.1 Valid credentials
    const validLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(validLogin.status === 200, 'Valid credentials return HTTP 200');
    assert(validLogin.data?.success === true, 'Response indicates success');
    assert(!!validLogin.data?.data?.token, 'JWT is returned in response');
    assert(validLogin.data?.data?.user?.username === 'admin', 'User object contains correct username');
    assert(validLogin.data?.data?.user?.password === undefined, 'Plain-text password is NOT returned in response');
    assert(validLogin.data?.data?.user?.passwordHash === undefined, 'Password hash is NOT returned in response');

    const adminToken = validLogin.data?.data?.token;

    // 1.2 Invalid password
    const invalidPw = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'WrongPassword!',
    });
    assert(invalidPw.status === 401, 'Invalid password returns HTTP 401');
    assert(invalidPw.data?.success === false, 'Invalid password response indicates failure');

    // 1.3 Non-existent user
    const noUser = await request('POST', '/api/auth/login', {
      username: 'nonexistent_user',
      password: 'DevelopmentPassword123!',
    });
    assert(noUser.status === 401, 'Non-existent username returns HTTP 401');
    assert(noUser.data?.message === 'Invalid username or password', 'Generic error message masks account existence');

    // 1.4 Inactive user cannot authenticate
    const inactiveLogin = await request('POST', '/api/auth/login', {
      username: 'inactive_user',
      password: 'DevelopmentPassword123!',
    });
    assert(inactiveLogin.status === 401, 'Inactive user cannot authenticate (HTTP 401)');

    // 1.5 Missing fields
    const missingUsername = await request('POST', '/api/auth/login', {
      password: 'DevelopmentPassword123!',
    });
    assert(missingUsername.status === 400, 'Missing username returns HTTP 400 Bad Request');

    const missingPassword = await request('POST', '/api/auth/login', {
      username: 'admin',
    });
    assert(missingPassword.status === 400, 'Missing password returns HTTP 400 Bad Request');

    // -------------------------------------------------------------
    // TEST GROUP 2: JWT VERIFICATION & PAYLOAD
    // -------------------------------------------------------------
    console.log('\n--- 2. JWT Verification Tests ---');

    // 2.1 JWT payload inspection
    const decoded: any = jwt.decode(adminToken);
    assert(!!decoded?.userId, 'JWT contains userId');
    assert(decoded?.role === 'ADMIN', 'JWT contains role');
    assert(decoded?.password === undefined, 'JWT does NOT contain password');
    assert(decoded?.passwordHash === undefined, 'JWT does NOT contain password hash');

    // 2.2 Valid JWT accepted on protected endpoint
    const validMe = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(validMe.status === 200, 'Valid JWT accepted on /api/auth/me (HTTP 200)');
    assert(validMe.data?.data?.username === 'admin', 'Identifies correct authenticated user');

    // 2.3 Missing JWT rejected
    const noToken = await request('GET', '/api/auth/me');
    assert(noToken.status === 401, 'Missing token returns HTTP 401');

    // 2.4 Invalid token rejected
    const invalidToken = await request('GET', '/api/auth/me', undefined, {
      Authorization: 'Bearer invalid.token.value',
    });
    assert(invalidToken.status === 401, 'Invalid JWT token returns HTTP 401');

    // 2.5 Malformed header rejected
    const malformedHeader = await request('GET', '/api/auth/me', undefined, {
      Authorization: 'TokenWithoutBearer 12345',
    });
    assert(malformedHeader.status === 401, 'Malformed Authorization header returns HTTP 401');

    // 2.6 Expired token rejected
    const expiredToken = jwt.sign(
      { userId: decoded.userId, username: 'admin', roleId: decoded.roleId, role: 'ADMIN' },
      config.jwt.secret,
      { expiresIn: '-10s' }
    );
    const expiredReq = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert(expiredReq.status === 401, 'Expired JWT returns HTTP 401');

    // -------------------------------------------------------------
    // TEST GROUP 3: AUTHORIZATION & RBAC (ROLES & PERMISSIONS)
    // -------------------------------------------------------------
    console.log('\n--- 3. Authorization & RBAC Tests ---');

    // 3.1 Role authorization: ADMIN allows /test-admin-only
    const adminRoleCheck = await request('GET', '/api/auth/test-admin-only', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminRoleCheck.status === 200, 'ADMIN role allowed on /test-admin-only (HTTP 200)');

    // 3.2 Non-admin role (RECEPTIONIST) login is strictly rejected under 2-role model
    const recLogin = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(recLogin.status === 401, 'Non-admin role (receptionist) login rejected (HTTP 401)');

    // 3.3 Permission authorization: ADMIN has SETTINGS:ACCESS_CONTROL:MANAGE
    const adminPermCheck = await request('GET', '/api/auth/test-access-control-permission', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminPermCheck.status === 200, 'User with SETTINGS:ACCESS_CONTROL:MANAGE allowed (HTTP 200)');

    // 3.4 Non-admin token presentation is rejected by authenticateJwt
    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    const forgedRecToken = jwt.sign(
      { userId: recUser?.id || decoded.userId, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    const recPermCheck = await request('GET', '/api/auth/test-access-control-permission', undefined, {
      Authorization: `Bearer ${forgedRecToken}`,
    });
    assert(recPermCheck.status === 401, 'Non-admin token rejected by authenticateJwt (HTTP 401)');

    // -------------------------------------------------------------
    // TEST GROUP 4: DATABASE DIRECT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 4. Database Integrity Tests ---');

    const dbUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    assert(!!dbUser, 'User record found in database');
    assert(dbUser?.passwordHash.startsWith('$2'), 'Password stored as bcrypt hash');
    assert(!('password' in (dbUser || {})), 'No plain-text password field in user schema');
    assert(dbUser?.role.name === 'ADMIN', 'User is linked to correct Role');
    assert(
      dbUser?.role.rolePermissions.some((rp) => rp.permission.code === 'SETTINGS:ACCESS_CONTROL:MANAGE') || false,
      'Access control permissions mapped to Role correctly'
    );

    // -------------------------------------------------------------
    // TEST GROUP 5: SUPERADMIN FORGOT & RESET PASSWORD FLOW
    // -------------------------------------------------------------
    console.log('\n--- 5. SuperAdmin Forgot & Reset Password Tests ---');

    // 5.1 Non-existent user forgot password returns generic message
    const noUserForgot = await request('POST', '/api/auth/forgot-password', {
      email: 'nonexistent@nowhere.com',
    });
    assert(noUserForgot.status === 200, 'Non-existent user forgot-password returns HTTP 200 generic message');
    assert(noUserForgot.data?.message.includes('password reset link has been dispatched'), 'Generic message masks account existence');
    assert(!noUserForgot.data?.data?.resetToken, 'No reset token generated for non-existent account');

    // 5.2 Non-superadmin user forgot password returns generic message without token
    const adminForgot = await request('POST', '/api/auth/forgot-password', {
      username: 'admin',
    });
    assert(adminForgot.status === 200, 'Non-superadmin forgot-password returns HTTP 200 generic message');
    assert(!adminForgot.data?.data?.resetToken, 'No reset token generated for non-superadmin account');

    // 5.3 SuperAdmin forgot password by email
    const superUser = await prisma.user.findFirst({ where: { username: 'superadmin' } });
    const superForgotEmail = await request('POST', '/api/auth/forgot-password', {
      email: superUser?.email || 'superadmin@respark.io',
    });
    assert(superForgotEmail.status === 200, 'SuperAdmin forgot-password by email returns HTTP 200');
    assert(!!superForgotEmail.data?.data?.resetToken, 'Reset token generated for SuperAdmin');
    let resetToken = superForgotEmail.data?.data?.resetToken;

    // 5.4 SuperAdmin forgot password by username
    const superForgotUsername = await request('POST', '/api/auth/forgot-password', {
      username: 'superadmin',
    });
    assert(superForgotUsername.status === 200, 'SuperAdmin forgot-password by username returns HTTP 200');
    assert(!!superForgotUsername.data?.data?.resetToken, 'Reset token generated for SuperAdmin via username');
    resetToken = superForgotUsername.data?.data?.resetToken;

    // 5.5 Reset password with invalid token
    const invalidTokenReset = await request('POST', '/api/auth/reset-password', {
      token: 'invalid-nonexistent-token-12345',
      password: 'BrandNewSuperPassword123!',
    });
    assert(invalidTokenReset.status === 400, 'Invalid reset token returns HTTP 400');
    assert(invalidTokenReset.data?.message.includes('invalid or has expired'), 'Proper error message for invalid token');

    // 5.6 Reset password with password shorter than 8 characters
    const shortPwReset = await request('POST', '/api/auth/reset-password', {
      token: resetToken,
      password: 'Short1!',
    });
    assert(shortPwReset.status === 400, 'Password < 8 chars returns HTTP 400 Bad Request');

    // 5.7 Reset password with valid token and strong password
    const validReset = await request('POST', '/api/auth/reset-password', {
      token: resetToken,
      password: 'NewSuperSecretPass456!',
    });
    assert(validReset.status === 200, 'Valid reset token updates password successfully (HTTP 200)');

    // 5.8 SuperAdmin login with new password
    const newLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'NewSuperSecretPass456!',
    });
    assert(newLogin.status === 200, 'SuperAdmin authenticates with new password');
    assert(newLogin.data?.data?.user?.username === 'superadmin', 'Authenticated as superadmin');

    // 5.9 Old password no longer works
    const oldLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(oldLogin.status === 401, 'Old SuperAdmin password is now rejected (HTTP 401)');

    // 5.10 Re-using same reset token fails
    const reuseReset = await request('POST', '/api/auth/reset-password', {
      token: resetToken,
      password: 'AnotherPassword789!',
    });
    assert(reuseReset.status === 400, 'Re-using consumed reset token is rejected (HTTP 400)');

    // 5.11 Restore SuperAdmin password back to original for subsequent test suites
    const restoreForgot = await request('POST', '/api/auth/forgot-password', {
      username: 'superadmin',
    });
    const restoreToken = restoreForgot.data?.data?.resetToken;
    const restoredReset = await request('POST', '/api/auth/reset-password', {
      token: restoreToken,
      password: 'SuperAdminSecretPassword123!',
    });
    assert(restoredReset.status === 200, 'SuperAdmin password restored for regression compatibility');

    // 5.12 Verify audit logs recorded SuperAdmin password reset events
    const resetLogs = await prisma.auditLog.findMany({
      where: {
        action: { in: ['SUPERADMIN_PASSWORD_RESET_REQUESTED', 'SUPERADMIN_PASSWORD_RESET_COMPLETED'] },
      },
    });
    assert(resetLogs.length >= 2, 'Audit logs recorded SuperAdmin reset request and completion');
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('\n========================================');
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
