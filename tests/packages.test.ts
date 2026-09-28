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

export async function runPackagesTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE: Packages Comprehensive Test Suite');
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

    // Receptionist Tenant A (Non-admin)
    const loginRec = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    if (loginRec.status === 200) {
      receptionistToken = loginRec.data?.data?.token;
    }

    // Clean up prior test packages in Tenant A and B
    await prisma.guestPackage.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.package.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });

    // -------------------------------------------------------------------------
    // 2. PACKAGE CONFIGURATION IN SETTINGS (CRUD)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Package Configuration (Settings CRUD) ---');

    // 2.1 Create Package (Bridal Glow Package)
    const createPkgRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: 'Bridal Glow Package',
        price: 8999,
        validityDays: 180,
        renewalReminderDays: 15,
        services: [
          { name: 'Bridal Makeup', count: 1 },
          { name: 'Hair Spa', count: 2 },
          { name: 'Full Arms Waxing', count: 1 },
        ],
        products: [
          { name: 'Bridal Glow Serum', count: 1 },
        ],
        description: 'Premium pre-wedding bridal grooming ritual',
        isActive: true,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(createPkgRes.status === 201, 'POST /api/settings/packages creates Bridal Glow Package (201)');
    const pkg1 = createPkgRes.data?.data;
    assert(pkg1?.name === 'Bridal Glow Package', 'Created package name matches');
    assert(Number(pkg1?.price) === 8999, 'Created package price is ₹8999');
    assert(pkg1?.validityDays === 180, 'Created package validity is 180 days');
    assert(pkg1?.isActive === true, 'Package is active');
    const pkg1Id = pkg1?.id;

    // 2.2 Create Package using UI Aliases (mirroring frame_088.jpg)
    const createPkgAliasRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: 'Hair Care Package',
        packagePrice: 4999,
        planValidity: 90,
        renewalReminder: 10,
        services: [{ name: 'Hair Cut', count: 3 }],
        description: '3 Haircut & styling sessions',
        isActive: true,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(createPkgAliasRes.status === 201, 'Package created using UI aliases packagePrice & planValidity (201)');
    const pkg2 = createPkgAliasRes.data?.data;
    assert(pkg2?.name === 'Hair Care Package', 'UI alias package name set');
    assert(Number(pkg2?.price) === 4999, 'UI alias packagePrice mapped to price');
    assert(pkg2?.validityDays === 90, 'UI alias planValidity mapped to validityDays');
    const pkg2Id = pkg2?.id;

    // 2.3 Duplicate package name rejected with 409
    const dupRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: 'Bridal Glow Package',
        price: 9999,
        validityDays: 120,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(dupRes.status === 409, 'Duplicate package name in same tenant returns HTTP 409 Conflict');

    // 2.4 List Packages
    const listRes = await request(
      'GET',
      '/api/settings/packages',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(listRes.status === 200, 'GET /api/settings/packages returns 200 OK');
    const packagesList = listRes.data?.data;
    assert(Array.isArray(packagesList) && packagesList.length >= 2, 'Package list contains at least 2 packages');

    // 2.5 Get Package by ID
    const getByIdRes = await request(
      'GET',
      `/api/settings/packages/${pkg1Id}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(getByIdRes.status === 200, 'GET /api/settings/packages/:id returns 200 OK');
    assert(getByIdRes.data?.data?.name === 'Bridal Glow Package', 'Fetched package matches requested ID');

    // 2.6 Update Package
    const updateRes = await request(
      'PUT',
      `/api/settings/packages/${pkg2Id}`,
      {
        price: 5499,
        description: 'Updated hair care bundle with conditioning',
        isActive: false,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateRes.status === 200, 'PUT /api/settings/packages/:id updates package (200)');
    assert(Number(updateRes.data?.data?.price) === 5499, 'Updated price reflected');
    assert(updateRes.data?.data?.isActive === false, 'Updated active status reflected');

    // 2.7 Delete Package
    const deleteRes = await request(
      'DELETE',
      `/api/settings/packages/${pkg2Id}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(deleteRes.status === 200, 'DELETE /api/settings/packages/:id deletes package (200)');

    // Verify deleted
    const verifyDelRes = await request(
      'GET',
      `/api/settings/packages/${pkg2Id}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(verifyDelRes.status === 404, 'Deleted package returns 404 Not Found');

    // -------------------------------------------------------------------------
    // 3. MULTI-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Multi-Tenant Isolation ---');

    // Tenant B cannot see Tenant A's packages
    const listBRes = await request(
      'GET',
      '/api/settings/packages',
      undefined,
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(listBRes.status === 200, 'Tenant B can list own packages');
    const hasTenantAPkg = (listBRes.data?.data || []).some((p: any) => p.id === pkg1Id);
    assert(!hasTenantAPkg, 'Tenant B package list does NOT contain Tenant A packages (Isolation verified)');

    // Tenant B cannot modify Tenant A's package
    const modifyBRes = await request(
      'PUT',
      `/api/settings/packages/${pkg1Id}`,
      { name: 'Hacked Package Name' },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(modifyBRes.status === 404 || modifyBRes.status === 403, 'Tenant B cannot modify Tenant A package (404/403)');

    // Same package name can exist in Tenant B without conflict
    const createBRes = await request(
      'POST',
      '/api/settings/packages',
      {
        name: 'Bridal Glow Package',
        price: 11999,
        validityDays: 365,
      },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(createBRes.status === 201, 'Same package name in different tenant succeeds (Multi-tenant scoped uniqueness)');

    // -------------------------------------------------------------------------
    // 4. GUEST PACKAGE PURCHASES & CRM 360 PROFILE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Guest Package Purchases & Lifecycle (CRM / Guest 360) ---');

    // Create a Guest in Tenant A
    const createGuestRes = await request(
      'POST',
      '/api/guests',
      {
        name: 'Priyanka Chopra',
        mobile: `98200${Math.floor(10000 + Math.random() * 90000)}`,
        gender: 'FEMALE',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(createGuestRes.status === 201, 'Guest created for package purchase (201)');
    const guestId = createGuestRes.data?.data?.id;

    // Sell/Assign Package to Guest
    const addGuestPkgRes = await request(
      'POST',
      `/api/guests/${guestId}/packages`,
      {
        packageId: pkg1Id,
        name: 'Bridal Glow Package',
        price: 8999,
        validityDays: 180,
        totalSessions: 4,
        services: [
          { name: 'Bridal Makeup', count: 1 },
          { name: 'Hair Spa', count: 2 },
          { name: 'Waxing', count: 1 },
        ],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(addGuestPkgRes.status === 201, 'POST /api/guests/:id/packages sells package to client (201)');
    const guestPkg = addGuestPkgRes.data?.data;
    assert(guestPkg?.name === 'Bridal Glow Package', 'Guest package name matches');
    assert(guestPkg?.totalSessions === 4, 'Total sessions initialized to 4');
    assert(guestPkg?.remainingSessions === 4, 'Remaining sessions initialized to 4');
    assert(guestPkg?.status === 'ACTIVE', 'Package status is ACTIVE');
    assert(!!guestPkg?.expiryDate, 'Expiry date calculated and set');

    // Check Guest 360 Profile returns the active package
    const guestProfileRes = await request(
      'GET',
      `/api/guests/${guestId}/360`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(guestProfileRes.status === 200, 'GET /api/guests/:id/360 returns profile (200)');
    const profilePkgs = guestProfileRes.data?.data?.packages;
    assert(Array.isArray(profilePkgs) && profilePkgs.length === 1, 'Guest profile includes packages array with 1 item');
    assert(profilePkgs[0].name === 'Bridal Glow Package', 'Profile package name matches');
    assert(profilePkgs[0].remainingSessions === 4, 'Profile package remaining sessions match');

    // -------------------------------------------------------------------------
    // 5. REPORTS INTEGRATION (PACKAGES SOLD & REDEMPTION)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Reports & Analytics Integration ---');

    // 5.1 Packages Sold Report
    const soldReportRes = await request(
      'GET',
      '/api/reports/packages-sold?startDate=2020-01-01&endDate=2030-12-31',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(soldReportRes.status === 200, 'GET /api/reports/packages-sold returns 200 OK');
    const soldData = soldReportRes.data?.data;
    assert(soldData?.totals?.totalPackages >= 1, 'Packages sold totalPackages is >= 1');
    assert(soldData?.totals?.totalValue >= 8999, 'Packages sold totalValue reflects revenue');
    assert(Array.isArray(soldData?.rows) && soldData.rows.length >= 1, 'Report rows contains sold package item');

    // 5.2 Package Redemption Report
    const redemptionReportRes = await request(
      'GET',
      '/api/reports/package-redemption',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(redemptionReportRes.status === 200, 'GET /api/reports/package-redemption returns 200 OK');
    const redemptionData = redemptionReportRes.data?.data;
    assert(redemptionData?.totals?.totalPackages >= 1, 'Package redemption reports tracked packages');

    // -------------------------------------------------------------------------
    // 6. RBAC & SECURITY
    // -------------------------------------------------------------------------
    console.log('\n--- 6. RBAC & Security ---');

    // Unauthenticated request rejected
    const noAuthRes = await request('GET', '/api/settings/packages');
    assert(noAuthRes.status === 401, 'Unauthenticated request to packages returns HTTP 401');

    // Non-admin cannot create package if receptionist token present
    if (receptionistToken) {
      const recCreateRes = await request(
        'POST',
        '/api/settings/packages',
        { name: 'Unauthorized Package', price: 100 },
        { Authorization: `Bearer ${receptionistToken}` }
      );
      assert(recCreateRes.status === 403 || recCreateRes.status === 401, 'Non-admin cannot create packages');
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`   Packages Module Tests: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      throw new Error(`${failed} tests failed in Packages test suite`);
    }
  } finally {
    server?.close();
  }
}

if (process.argv[1]?.endsWith('packages.test.ts')) {
  runPackagesTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}
