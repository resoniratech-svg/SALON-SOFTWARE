import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let receptionistToken: string;

let tenantAId: string;
let tenantBId: string;

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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  const cloned = res.clone();
  const data = await res.json().catch(() => null);
  const text = await cloned.text().catch(() => '');
  return { status: res.status, data, text, headers: res.headers };
}

export async function runPackagesEdgeCasesTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE: Packages Edge Cases & Deep Testing');
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
    // 1. SETUP & AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('--- 1. Setup & Authentication ---');

    // Admin Tenant A
    const loginA = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(loginA.status === 200, 'Tenant A admin logs in successfully (200)');
    adminAToken = loginA.data?.data?.token;
    tenantAId = loginA.data?.data?.user?.tenantId;
    assert(!!adminAToken, 'Tenant A JWT token retrieved');

    // Admin Tenant B
    const loginB = await request('POST', '/api/auth/login', {
      username: 'admin_b',
      password: 'DevelopmentPassword123!',
    });
    assert(loginB.status === 200, 'Tenant B admin logs in successfully (200)');
    adminBToken = loginB.data?.data?.token;
    tenantBId = loginB.data?.data?.user?.tenantId;
    assert(!!adminBToken, 'Tenant B JWT token retrieved');

    // Receptionist
    const loginRec = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    if (loginRec.status === 200) {
      receptionistToken = loginRec.data?.data?.token;
    }

    // -------------------------------------------------------------------------
    // 2. BOUNDARY & VALUE VALIDATION EDGE CASES
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Boundary & Value Validation Edge Cases ---');

    // 2.1 Zero-price package (Free promotional bundle)
    const zeroPriceRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Free Trial Welcome Bundle ${Date.now()}`,
        price: 0,
        validityDays: 30,
        services: [{ name: 'Complimentary Blowdry', count: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(zeroPriceRes.status === 201, 'Zero price package (₹0 promotional bundle) is accepted (201)');
    assert(Number(zeroPriceRes.data?.data?.price) === 0, 'Zero price preserved');

    // 2.2 Negative price package
    const negativePriceRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Negative Price Bundle ${Date.now()}`,
        price: -500,
        validityDays: 30,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(negativePriceRes.status === 400, 'Negative package price is rejected with HTTP 400');

    // 2.3 Extremely large price package (High-tier VIP annual grooming)
    const hugePriceRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Royal Diamond Lifetime Bundle ${Date.now()}`,
        price: 999999.99,
        validityDays: 3650,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(hugePriceRes.status === 201, 'High-tier luxury price (₹999,999.99) is accepted (201)');
    assert(Number(hugePriceRes.data?.data?.price) === 999999.99, 'High-tier luxury price stored with decimal precision');

    // 2.4 Zero validity days
    const zeroValidityRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Zero Validity Bundle ${Date.now()}`,
        price: 1000,
        validityDays: 0,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(zeroValidityRes.status === 400, 'Zero validity days rejected with HTTP 400');

    // 2.5 Negative validity days
    const negValidityRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Negative Validity Bundle ${Date.now()}`,
        price: 1000,
        validityDays: -10,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(negValidityRes.status === 400, 'Negative validity days rejected with HTTP 400');

    // 2.6 Empty or whitespace-only name
    const emptyNameRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: '   ',
        price: 1000,
        validityDays: 30,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(emptyNameRes.status === 400, 'Whitespace-only package name rejected with HTTP 400');

    // 2.7 Unicode, Emoji & Special Characters in name
    const unicodeName = `L'Oréal Spa & Glow ✨ / Déjà Vu Bundle (Gold-Edition) #${Date.now()}`;
    const unicodeRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: unicodeName,
        price: 3499,
        validityDays: 90,
        description: 'Contains emojis, french accents & symbols',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(unicodeRes.status === 201, 'Unicode, Emojis & Special Characters in package name accepted (201)');
    assert(unicodeRes.data?.data?.name === unicodeName, 'Unicode name preserved exactly');

    // 2.8 Name exceeding 100 characters limit
    const longName = 'A'.repeat(101);
    const longNameRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: longName,
        price: 1000,
        validityDays: 30,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(longNameRes.status === 400, 'Package name exceeding 100 characters rejected with HTTP 400');

    // -------------------------------------------------------------------------
    // 3. CONCURRENCY & COLLISION SAFETY
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Concurrency & Collision Safety ---');

    const concurrentPackageName = `Concurrent Unique Bundle ${Date.now()}`;
    const concurrentRequests = Array.from({ length: 5 }, () =>
      request(
        'POST',
        '/api/settings/packages',
        {
          name: concurrentPackageName,
          price: 2500,
          validityDays: 60,
        },
        { Authorization: `Bearer ${adminAToken}` }
      )
    );

    const concurrentResults = await Promise.all(concurrentRequests);
    const successCount = concurrentResults.filter((r) => r.status === 201).length;
    const conflictCount = concurrentResults.filter((r) => r.status === 409).length;

    assert(successCount === 1, 'Exactly 1 concurrent request succeeded in creating package');
    assert(conflictCount === 4, '4 concurrent requests failed with HTTP 409 Conflict (Collision protection verified)');

    // -------------------------------------------------------------------------
    // 4. ACTIVE / INACTIVE CATALOG INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Active / Inactive Catalog Integrity ---');

    const inactivePkgRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Seasonal Winter Package (Inactive) ${Date.now()}`,
        price: 4500,
        validityDays: 90,
        isActive: false,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(inactivePkgRes.status === 201, 'Inactive package created successfully (201)');
    const inactivePkgId = inactivePkgRes.data?.data?.id;

    // Filter list by isActive=false
    const listInactiveRes = await request(
      'GET',
      '/api/settings/packages?isActive=false',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(listInactiveRes.status === 200, 'List inactive packages returns 200');
    const inactiveList = listInactiveRes.data?.data || [];
    assert(
      inactiveList.some((p: any) => p.id === inactivePkgId),
      'Inactive package present in isActive=false query'
    );

    // Re-activate package
    const reactivateRes = await request(
      'PUT',
      `/api/settings/packages/${inactivePkgId}`,
      { isActive: true },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(reactivateRes.status === 200, 'Re-activating package returns 200');
    assert(reactivateRes.data?.data?.isActive === true, 'Package is now active');

    // -------------------------------------------------------------------------
    // 5. GUEST PACKAGE PURCHASES & SESSION REDEMPTION WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Guest Package Purchases & Session Redemption Workflow ---');

    // Create a Test Guest
    const testGuestRes = await request(
      'POST',
      '/api/guests',
      {
        name: 'Deepika Padukone',
        mobile: `98111${Math.floor(10000 + Math.random() * 90000)}`,
        gender: 'FEMALE',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(testGuestRes.status === 201, 'Guest created for redemption testing');
    const guestId = testGuestRes.data?.data?.id;

    // Purchase Package with 3 total sessions
    const purchaseRes = await request(
      'POST',
      `/api/guests/${guestId}/packages`,
      {
        name: 'Keratin Hair Treatment Series',
        price: 6000,
        validityDays: 90,
        totalSessions: 3,
        services: [{ name: 'Keratin Smoothing', count: 3 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(purchaseRes.status === 201, 'Guest purchases 3-session package (201)');
    const guestPackageId = purchaseRes.data?.data?.id;
    assert(purchaseRes.data?.data?.remainingSessions === 3, 'Remaining sessions initialized to 3');
    assert(purchaseRes.data?.data?.status === 'ACTIVE', 'Package status is ACTIVE');

    // 5.1 Redeem 1 Session
    const redeem1Res = await request(
      'POST',
      `/api/guests/${guestId}/packages/${guestPackageId}/redeem`,
      { sessions: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(redeem1Res.status === 200, 'Redeem 1 session returns HTTP 200');
    assert(redeem1Res.data?.data?.remainingSessions === 2, 'Remaining sessions decremented to 2');
    assert(redeem1Res.data?.data?.status === 'ACTIVE', 'Package status remains ACTIVE while sessions remain');

    // 5.2 Attempt to redeem more sessions than available (Try to redeem 5 sessions when only 2 remain)
    const overRedeemRes = await request(
      'POST',
      `/api/guests/${guestId}/packages/${guestPackageId}/redeem`,
      { sessions: 5 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(overRedeemRes.status === 400, 'Redeeming more sessions than available rejected with HTTP 400');

    // 5.3 Redeem remaining 2 sessions to complete the package
    const redeem2Res = await request(
      'POST',
      `/api/guests/${guestId}/packages/${guestPackageId}/redeem`,
      { sessions: 2 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(redeem2Res.status === 200, 'Redeeming final 2 sessions returns HTTP 200');
    assert(redeem2Res.data?.data?.remainingSessions === 0, 'Remaining sessions reached 0');
    assert(redeem2Res.data?.data?.status === 'COMPLETED', 'Package automatically transitioned to COMPLETED status');

    // 5.4 Attempt to redeem from already COMPLETED package
    const postCompleteRedeemRes = await request(
      'POST',
      `/api/guests/${guestId}/packages/${guestPackageId}/redeem`,
      { sessions: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(postCompleteRedeemRes.status === 400, 'Redeeming from COMPLETED package rejected with HTTP 400');

    // 5.5 Attempt to redeem non-existent package
    const nonExistentRedeemRes = await request(
      'POST',
      `/api/guests/${guestId}/packages/00000000-0000-0000-0000-000000000000/redeem`,
      { sessions: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(nonExistentRedeemRes.status === 404, 'Redeeming non-existent package ID returns HTTP 404');

    // 5.6 Attempt to assign package to non-existent guest
    const invalidGuestAssignRes = await request(
      'POST',
      '/api/guests/00000000-0000-0000-0000-000000000000/packages',
      {
        name: 'Orphan Package',
        price: 1000,
        validityDays: 30,
        totalSessions: 1,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(invalidGuestAssignRes.status === 404, 'Assigning package to non-existent guest returns HTTP 404');

    // -------------------------------------------------------------------------
    // 6. MULTI-TENANT ISOLATION EDGE CASES
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Multi-Tenant Isolation Edge Cases ---');

    // Tenant A creates package
    const tenantAPkgRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: `Tenant A Confidential Package ${Date.now()}`,
        price: 7777,
        validityDays: 120,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const tenantAPkgId = tenantAPkgRes.data?.data?.id;

    // Tenant B attempts to read Tenant A package
    const crossReadRes = await request(
      'GET',
      `/api/settings/packages/${tenantAPkgId}`,
      undefined,
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(crossReadRes.status === 404, 'Cross-tenant GET returns HTTP 404');

    // Tenant B attempts to update Tenant A package
    const crossUpdateRes = await request(
      'PUT',
      `/api/settings/packages/${tenantAPkgId}`,
      { price: 100 },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(crossUpdateRes.status === 404 || crossUpdateRes.status === 403, 'Cross-tenant PUT returns HTTP 404/403');

    // Tenant B attempts to delete Tenant A package
    const crossDeleteRes = await request(
      'DELETE',
      `/api/settings/packages/${tenantAPkgId}`,
      undefined,
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(crossDeleteRes.status === 404 || crossDeleteRes.status === 403, 'Cross-tenant DELETE returns HTTP 404/403');

    // Tenant B attempts to redeem Tenant A's guest package
    const crossRedeemRes = await request(
      'POST',
      `/api/guests/${guestId}/packages/${guestPackageId}/redeem`,
      { sessions: 1 },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(crossRedeemRes.status === 404 || crossRedeemRes.status === 403, 'Cross-tenant package redemption returns HTTP 404/403');

    // -------------------------------------------------------------------------
    // 7. REPORTS BOUNDARY & REVENUE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Reports Boundary & Revenue Verification ---');

    // Date range with zero sales (year 2010)
    const emptyReportRes = await request(
      'GET',
      '/api/reports/packages-sold?startDate=2010-01-01&endDate=2010-01-31',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(emptyReportRes.status === 200, 'Packages sold report for empty date window returns 200');

    // Package redemption report verification
    const redemptionReportRes = await request(
      'GET',
      '/api/reports/package-redemption',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(redemptionReportRes.status === 200, 'Package redemption report returns 200');
    const redemptionData = redemptionReportRes.data?.data;
    assert(redemptionData?.totals?.totalRedeemed >= 3, 'Redemption report includes the 3 redeemed sessions');

    // -------------------------------------------------------------------------
    // 8. SECURITY & MALFORMED REQUESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Security & Malformed Requests ---');

    // Malformed token
    const malformedTokenRes = await request(
      'GET',
      '/api/settings/packages',
      undefined,
      { Authorization: 'Bearer this.is.a.malformed.jwt.token' }
    );
    assert(malformedTokenRes.status === 401, 'Malformed JWT token rejected with HTTP 401');

    // Missing token
    const noTokenRes = await request('GET', '/api/settings/packages');
    assert(noTokenRes.status === 401, 'Request without Authorization header rejected with HTTP 401');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`   Packages Edge Cases: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      throw new Error(`${failed} tests failed in Packages Edge Cases test suite`);
    }
  } finally {
    server?.close();
  }
}

if (process.argv[1]?.endsWith('packages-edge-cases.test.ts')) {
  runPackagesEdgeCasesTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}
