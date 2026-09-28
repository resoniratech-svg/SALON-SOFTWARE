import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let cashierToken: string;
let superToken: string;

let tenantAId: string;
let tenantBId: string;
let cashierUserId: string;

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
  console.log('   QUBEXE SALOON SOFTWARE Resources Module: Complete Suite & SaaS Security');
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
    // SETUP & AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('--- 1. Setup & Authentication ---');

    // 1.1 SuperAdmin Login
    const superLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(superLogin.status === 200, 'SuperAdmin login returns 200');
    superToken = superLogin.data?.data?.token;

    // 1.2 Tenant A Admin Login
    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminALogin.status === 200, 'Tenant A Admin login returns 200');
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;

    // 1.3 Tenant B Admin Login
    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    assert(adminBLogin.status === 200, 'Tenant B Admin login returns 200');
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;

    // 1.4 Cashier Login
    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(cashierLogin.status === 200, 'Cashier login returns 200');
    cashierToken = cashierLogin.data?.data?.token;
    cashierUserId = cashierLogin.data?.data?.user?.id;

    // Cleanup previous test resources
    const testNames = [
      'VIP Facial Room',
      'VIP Facial Room Updated',
      'Minimal Room',
      'Deluxe Suite',
      'Multi-Tenant Station',
      'Dependency Target Room',
      'SuperAdmin Impersonated Room',
      'Search Target Alpha',
      'Search Target Beta',
      'Status Test Room',
      'Rename Room Old',
      'Rename Room New',
      'Resource For Service Test',
      'Multi Service Dependency Target',
      'a',
      'Room ' + 'X'.repeat(95),
      'Huge Capacity Room',
      'Empty Desc Room',
      '1000 Char Desc Room',
      'Concurrent Race Target',
      'Temporary Test Room',
    ];
    await prisma.resource.deleteMany({
      where: {
        name: { in: testNames },
      },
    });

    // Ensure Tenant A has RESOURCES enabled in company
    const tenantA = await prisma.tenant.findUnique({
      where: { id: tenantAId },
      select: { enabledModules: true },
    });
    const currentModules = (Array.isArray(tenantA?.enabledModules) ? tenantA?.enabledModules : []) as string[];
    if (!currentModules.includes('RESOURCES')) {
      await prisma.tenant.update({
        where: { id: tenantAId },
        data: { enabledModules: [...currentModules, 'RESOURCES'] },
      });
    }

    // Ensure Tenant B also has RESOURCES enabled
    const tenantB = await prisma.tenant.findUnique({
      where: { id: tenantBId },
      select: { enabledModules: true },
    });
    const currentModulesB = (Array.isArray(tenantB?.enabledModules) ? tenantB?.enabledModules : []) as string[];
    if (!currentModulesB.includes('RESOURCES')) {
      await prisma.tenant.update({
        where: { id: tenantBId },
        data: { enabledModules: [...currentModulesB, 'RESOURCES'] },
      });
    }

    // Ensure Cashier has RESOURCES enabled for initial RBAC test
    await prisma.user.update({
      where: { id: cashierUserId },
      data: {
        enabledModules: ['POS', 'SERVICES', 'PRODUCTS', 'APPOINTMENT', 'RESOURCES'],
      },
    });

    // 1.5 Authentication Security Tests
    const noTokenRes = await request('GET', '/api/resources');
    assert(noTokenRes.status === 401, 'Request without token returns 401 Unauthorized');

    const invalidTokenRes = await request('GET', '/api/resources', undefined, {
      Authorization: 'Bearer invalid-garbage-token-12345',
    });
    assert(invalidTokenRes.status === 401, 'Request with invalid token returns 401 Unauthorized');

    const expiredToken = jwt.sign(
      { id: cashierUserId, username: 'cashier', role: 'CASHIER', tenantId: tenantAId },
      config.jwt.secret,
      { expiresIn: -10 }
    );
    const expiredTokenRes = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert(expiredTokenRes.status === 401, 'Request with expired JWT returns 401 Unauthorized');

    const staffLoginAttempt = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(staffLoginAttempt.status === 401, 'Staff/receptionist business record cannot login (401)');

    // -------------------------------------------------------------------------
    // SECTION 2: RESOURCE CREATION & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Resource Creation & Validation ---');

    // 2.1 Create with all fields
    const createFullRes = await request(
      'POST',
      '/api/resources',
      {
        name: 'VIP Facial Room',
        capacity: 2,
        isActive: true,
        description: 'Luxury treatment room with motorized esthetic bed',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(createFullRes.status === 201, 'Create resource with all fields returns 201');
    assert(createFullRes.data?.data?.name === 'VIP Facial Room', 'Returned name matches');
    assert(createFullRes.data?.data?.capacity === 2, 'Returned capacity is 2');
    assert(createFullRes.data?.data?.isActive === true, 'Returned isActive is true');
    assert(
      createFullRes.data?.data?.description === 'Luxury treatment room with motorized esthetic bed',
      'Returned description matches'
    );
    assert(createFullRes.data?.data?.tenantId === tenantAId, 'Resource belongs to Tenant A');
    const createdResourceId = createFullRes.data?.data?.id;

    // 2.2 Create with minimal fields (defaults: capacity = 1, isActive = true, description = null)
    const createMinRes = await request(
      'POST',
      '/api/resources',
      {
        name: 'Minimal Room',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(createMinRes.status === 201, 'Create resource with minimal fields returns 201');
    assert(createMinRes.data?.data?.capacity === 1, 'Default capacity is 1');
    assert(createMinRes.data?.data?.isActive === true, 'Default isActive is true');
    assert(createMinRes.data?.data?.description === null, 'Default description is null');

    // 2.3 Validation: Missing name
    const noNameRes = await request(
      'POST',
      '/api/resources',
      { capacity: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(noNameRes.status === 400, 'Missing name returns 400 Bad Request');

    // 2.4 Validation: Empty name
    const emptyNameRes = await request(
      'POST',
      '/api/resources',
      { name: '   ', capacity: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(emptyNameRes.status === 400, 'Empty/Whitespace name returns 400');

    // 2.5 Validation: Name exceeds 100 characters
    const longNameRes = await request(
      'POST',
      '/api/resources',
      { name: 'A'.repeat(101), capacity: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(longNameRes.status === 400, 'Name > 100 chars returns 400');

    // 2.6 Validation: Capacity < 1
    const zeroCapRes = await request(
      'POST',
      '/api/resources',
      { name: 'Zero Cap Room', capacity: 0 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(zeroCapRes.status === 400, 'Capacity = 0 returns 400');

    const negCapRes = await request(
      'POST',
      '/api/resources',
      { name: 'Neg Cap Room', capacity: -5 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(negCapRes.status === 400, 'Negative capacity returns 400');

    // 2.7 Validation: Non-integer capacity
    const floatCapRes = await request(
      'POST',
      '/api/resources',
      { name: 'Float Cap Room', capacity: 2.5 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(floatCapRes.status === 400, 'Non-integer capacity returns 400');

    // 2.8 Validation: Description exceeds 1000 characters
    const longDescRes = await request(
      'POST',
      '/api/resources',
      { name: 'Long Desc Room', capacity: 1, description: 'X'.repeat(1001) },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(longDescRes.status === 400, 'Description > 1000 chars returns 400');

    // 2.9 Validation: Duplicate name in same tenant
    const duplicateRes = await request(
      'POST',
      '/api/resources',
      { name: 'VIP Facial Room', capacity: 3 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(duplicateRes.status === 409, 'Duplicate resource name returns 409 Conflict');

    // 2.10 Validation: Duplicate name with different whitespace
    const dupTrimRes = await request(
      'POST',
      '/api/resources',
      { name: '  VIP Facial Room  ', capacity: 3 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(dupTrimRes.status === 409, 'Duplicate name after trim returns 409 Conflict');

    // 2.11 Edge Cases: Name lengths
    const singleCharNameRes = await request(
      'POST',
      '/api/resources',
      { name: 'a' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(singleCharNameRes.status === 201, 'Single-character name "a" succeeds (201)');

    const max100Name = 'Room ' + 'X'.repeat(95);
    const maxNameRes = await request(
      'POST',
      '/api/resources',
      { name: max100Name },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(maxNameRes.status === 201, 'Exact 100-character name succeeds (201)');

    // 2.12 Edge Cases: Capacity limits
    const hugeCapRes = await request(
      'POST',
      '/api/resources',
      { name: 'Huge Capacity Room', capacity: 999999 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(hugeCapRes.status === 201, 'Capacity = 999999 succeeds (201)');

    const nonNumCapRes = await request(
      'POST',
      '/api/resources',
      { name: 'Bad Cap Room', capacity: 'not-a-number' as any },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(nonNumCapRes.status === 400, 'Non-numeric capacity string returns 400');

    // 2.13 Edge Cases: Description bounds
    const emptyDescRes = await request(
      'POST',
      '/api/resources',
      { name: 'Empty Desc Room', description: '' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(emptyDescRes.status === 201, 'Empty string description succeeds (201)');

    const max1000Desc = 'D'.repeat(1000);
    const maxDescRes = await request(
      'POST',
      '/api/resources',
      { name: '1000 Char Desc Room', description: max1000Desc },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(maxDescRes.status === 201, 'Exact 1000-character description succeeds (201)');

    // 2.14 Edge Cases: Invalid isActive boolean
    const badActiveRes = await request(
      'POST',
      '/api/resources',
      { name: 'Bad Active Room', isActive: 'not-a-boolean' as any },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(badActiveRes.status === 400, 'Non-boolean isActive returns 400');

    // 2.15 Concurrent / Race duplicate creation test
    const [raceRes1, raceRes2] = await Promise.all([
      request('POST', '/api/resources', { name: 'Concurrent Race Target' }, { Authorization: `Bearer ${adminAToken}` }),
      request('POST', '/api/resources', { name: 'Concurrent Race Target' }, { Authorization: `Bearer ${adminAToken}` }),
    ]);
    const statuses = [raceRes1.status, raceRes2.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 409, 'Concurrent creation safely creates one (201) and rejects second (409)');

    // -------------------------------------------------------------------------
    // SECTION 3: READ, SEARCH & PAGINATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Read, Search & Pagination ---');

    // 3.1 Get by ID
    const getByIdRes = await request(
      'GET',
      `/api/resources/${createdResourceId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(getByIdRes.status === 200, 'Get resource by ID returns 200');
    assert(getByIdRes.data?.data?.id === createdResourceId, 'Returned ID matches');

    // 3.2 Get non-existent ID
    const notFoundRes = await request(
      'GET',
      '/api/resources/00000000-0000-0000-0000-000000000000',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(notFoundRes.status === 404, 'Get non-existent resource ID returns 404');

    // Seed items for search and filter testing
    await request('POST', '/api/resources', { name: 'Search Target Alpha', capacity: 1, isActive: true }, { Authorization: `Bearer ${adminAToken}` });
    await request('POST', '/api/resources', { name: 'Search Target Beta', capacity: 2, isActive: false }, { Authorization: `Bearer ${adminAToken}` });

    // 3.3 List resources (default pagination)
    const listRes = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listRes.status === 200, 'List resources returns 200');
    assert(Array.isArray(listRes.data?.data?.items), 'Returned items is array');
    assert(typeof listRes.data?.data?.meta?.total === 'number', 'Meta contains total count');

    // 3.4 Search with query `q`
    const searchRes = await request('GET', '/api/resources?q=Target+Alpha', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(searchRes.status === 200, 'Search query returns 200');
    assert(
      searchRes.data?.data?.items.some((r: any) => r.name === 'Search Target Alpha'),
      'Search results include matching item'
    );
    assert(
      !searchRes.data?.data?.items.some((r: any) => r.name === 'Search Target Beta'),
      'Search results exclude non-matching item'
    );

    // 3.5 Filter by isActive=true
    const activeRes = await request('GET', '/api/resources?isActive=true', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(activeRes.status === 200, 'Filter isActive=true returns 200');
    assert(
      activeRes.data?.data?.items.every((r: any) => r.isActive === true),
      'All returned items have isActive === true'
    );

    // 3.6 Filter by isActive=false
    const inactiveRes = await request('GET', '/api/resources?isActive=false', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(inactiveRes.status === 200, 'Filter isActive=false returns 200');
    assert(
      inactiveRes.data?.data?.items.every((r: any) => r.isActive === false),
      'All returned items have isActive === false'
    );

    // 3.7 Pagination test
    const pageRes = await request('GET', '/api/resources?page=1&limit=2', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(pageRes.status === 200, 'Pagination page=1&limit=2 returns 200');
    assert(pageRes.data?.data?.items.length <= 2, 'Page returns at most limit items');
    assert(pageRes.data?.data?.meta?.limit === 2, 'Meta reflects limit 2');
    assert(pageRes.data?.data?.meta?.page === 1, 'Meta reflects page 1');

    // -------------------------------------------------------------------------
    // SECTION 4: RESOURCE UPDATES & STATUS TOGGLE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Resource Updates & Status Toggle ---');

    // 4.1 Update name, capacity, description
    const updateRes = await request(
      'PUT',
      `/api/resources/${createdResourceId}`,
      {
        name: 'VIP Facial Room Updated',
        capacity: 4,
        description: 'Expanded capacity with dual esthetic tables',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateRes.status === 200, 'Update resource returns 200');
    assert(updateRes.data?.data?.name === 'VIP Facial Room Updated', 'Updated name reflected');
    assert(updateRes.data?.data?.capacity === 4, 'Updated capacity is 4');
    assert(
      updateRes.data?.data?.description === 'Expanded capacity with dual esthetic tables',
      'Updated description reflected'
    );

    // 4.2 Self-rename (keep same name)
    const selfRenameRes = await request(
      'PUT',
      `/api/resources/${createdResourceId}`,
      { name: 'VIP Facial Room Updated' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(selfRenameRes.status === 200, 'Self-rename with same name returns 200');

    // 4.3 Rename conflict with another existing resource
    const conflictRenameRes = await request(
      'PUT',
      `/api/resources/${createdResourceId}`,
      { name: 'Minimal Room' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(conflictRenameRes.status === 409, 'Rename to existing resource name returns 409 Conflict');

    // 4.4 Update non-existent resource
    const updateNotFound = await request(
      'PUT',
      '/api/resources/00000000-0000-0000-0000-000000000000',
      { name: 'Does Not Exist' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateNotFound.status === 404, 'Update non-existent resource returns 404');

    // 4.5 Status toggle to false
    const deactRes = await request(
      'PATCH',
      `/api/resources/${createdResourceId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(deactRes.status === 200, 'PATCH status to false returns 200');
    assert(deactRes.data?.data?.isActive === false, 'Resource is now inactive');
    assert(deactRes.data?.message?.includes('deactivated'), 'Deactivation message returned');

    // 4.6 Status toggle to true
    const actRes = await request(
      'PATCH',
      `/api/resources/${createdResourceId}/status`,
      { isActive: true },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(actRes.status === 200, 'PATCH status to true returns 200');
    assert(actRes.data?.data?.isActive === true, 'Resource is now active');
    assert(actRes.data?.message?.includes('activated'), 'Activation message returned');

    // -------------------------------------------------------------------------
    // SECTION 5: SERVICE INTEGRATION & DEPENDENCY INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Service Integration & Dependency Integrity ---');

    // 5.1 Create a dedicated resource for dependency testing
    const depRes = await request(
      'POST',
      '/api/resources',
      { name: 'Resource For Service Test', capacity: 1 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(depRes.status === 201, 'Create resource for service test returns 201');
    const depResourceId = depRes.data?.data?.id;

    // Get an existing service category for Tenant A
    const cat = await prisma.serviceCategory.findFirst({
      where: { tenantId: tenantAId },
    });
    assert(!!cat, 'Existing service category found for Tenant A');

    // 5.2 Create service referencing this resource
    const srvRes = await request(
      'POST',
      '/api/services',
      {
        name: `Service Using Resource ${Date.now()}`,
        categoryId: cat!.id,
        price: 75,
        duration: 45,
        resourceIds: [depResourceId],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(srvRes.status === 201, 'Service referencing resource created (201)');
    const linkedServiceId = srvRes.data?.data?.id;

    // 5.3 Attempt to delete resource while assigned to service -> BLOCKED (400)
    const blockedDeleteRes = await request(
      'DELETE',
      `/api/resources/${depResourceId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(blockedDeleteRes.status === 400, 'Deleting resource referenced by service is blocked (400 Bad Request)');
    assert(
      blockedDeleteRes.data?.message?.includes('assigned to 1 service'),
      'Error message details service dependency'
    );

    // 5.4 Unlink resource from service
    const updateSrvRes = await request(
      'PUT',
      `/api/services/${linkedServiceId}`,
      { resourceIds: [] },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateSrvRes.status === 200, 'Unlinked resource from service (200)');

    // 5.5 Delete unlinked resource -> SUCCESS (200)
    const allowedDeleteRes = await request(
      'DELETE',
      `/api/resources/${depResourceId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(allowedDeleteRes.status === 200, 'Delete unlinked resource succeeds (200)');

    // Clean up test service
    await prisma.service.delete({ where: { id: linkedServiceId } });

    // 5.6 Multiple Service Dependencies: Resource referenced by 2 services
    const multiDepRes = await request(
      'POST',
      '/api/resources',
      { name: 'Multi Service Dependency Target' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(multiDepRes.status === 201, 'Resource for multi-service dependency created (201)');
    const multiDepId = multiDepRes.data?.data?.id;

    const srv1 = await request(
      'POST',
      '/api/services',
      {
        name: `Multi Srv 1 ${Date.now()}`,
        categoryId: cat!.id,
        price: 50,
        duration: 30,
        resourceIds: [multiDepId],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const srv2 = await request(
      'POST',
      '/api/services',
      {
        name: `Multi Srv 2 ${Date.now()}`,
        categoryId: cat!.id,
        price: 60,
        duration: 40,
        resourceIds: [multiDepId],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(srv1.status === 201 && srv2.status === 201, 'Two services mapped to same resource created (201)');

    const multiDeleteBlocked = await request(
      'DELETE',
      `/api/resources/${multiDepId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(multiDeleteBlocked.status === 400, 'Delete resource referenced by multiple services is blocked (400)');
    assert(
      multiDeleteBlocked.data?.message?.includes('assigned to 2 service(s)'),
      'Error message correctly indicates 2 referencing services'
    );

    // Clean up the two services and delete the resource
    await prisma.service.deleteMany({ where: { id: { in: [srv1.data?.data?.id, srv2.data?.data?.id] } } });
    const multiDeleteSuccess = await request(
      'DELETE',
      `/api/resources/${multiDepId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(multiDeleteSuccess.status === 200, 'Delete unreferenced resource succeeds after services removed (200)');

    // 5.7 Non-existent and already-deleted resource delete returns 404
    const alreadyDeletedRes = await request(
      'DELETE',
      `/api/resources/${multiDepId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(alreadyDeletedRes.status === 404, 'Deleting already deleted resource returns 404 Not Found');

    const invalidUuidDeleteRes = await request(
      'DELETE',
      '/api/resources/non-existent-uuid-12345',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(invalidUuidDeleteRes.status === 404, 'Deleting non-existent resource returns 404 Not Found');

    // -------------------------------------------------------------------------
    // SECTION 6: SAAS MULTI-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. SaaS Multi-Tenant Isolation ---');

    // 6.1 Tenant A and Tenant B can create resource with identical name
    const tenantAResource = await request(
      'POST',
      '/api/resources',
      { name: 'Multi-Tenant Station', capacity: 1, description: 'Tenant A Station' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(tenantAResource.status === 201, 'Tenant A creates "Multi-Tenant Station"');
    const tenantAResourceId = tenantAResource.data?.data?.id;

    const tenantBResource = await request(
      'POST',
      '/api/resources',
      { name: 'Multi-Tenant Station', capacity: 2, description: 'Tenant B Station' },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(tenantBResource.status === 201, 'Tenant B creates "Multi-Tenant Station" with same name without collision');
    const tenantBResourceId = tenantBResource.data?.data?.id;

    // 6.2 Tenant A cannot view Tenant B resource (404)
    const crossGet = await request(
      'GET',
      `/api/resources/${tenantBResourceId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(crossGet.status === 404, 'Tenant A accessing Tenant B resource returns 404');

    // 6.3 Tenant A cannot update Tenant B resource (404)
    const crossUpdate = await request(
      'PUT',
      `/api/resources/${tenantBResourceId}`,
      { name: 'Hacked Station' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(crossUpdate.status === 404, 'Tenant A updating Tenant B resource returns 404');

    // 6.4 Tenant A cannot update status of Tenant B resource (404)
    const crossStatus = await request(
      'PATCH',
      `/api/resources/${tenantBResourceId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(crossStatus.status === 404, 'Tenant A patching Tenant B resource status returns 404');

    // 6.5 Tenant A cannot delete Tenant B resource (404)
    const crossDelete = await request(
      'DELETE',
      `/api/resources/${tenantBResourceId}`,
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(crossDelete.status === 404, 'Tenant A deleting Tenant B resource returns 404');

    // 6.6 Cross-tenant Service Resource mapping blocked:
    // Tenant A attempts to map Tenant B's resource into Tenant A's service during creation
    const crossCreateService = await request(
      'POST',
      '/api/services',
      {
        name: `Illegal Cross Resource Service ${Date.now()}`,
        categoryId: cat!.id,
        price: 50,
        duration: 30,
        resourceIds: [tenantBResourceId],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(
      crossCreateService.status === 400,
      'Tenant A cannot map Tenant B resource in Service Create (400 Bad Request)'
    );
    assert(
      crossCreateService.data?.message?.includes('belonging to another company'),
      'Error message prevents cross-company resource leakage'
    );

    // Tenant A attempts to map Tenant B's resource during update
    const dummyService = await request(
      'POST',
      '/api/services',
      {
        name: `Valid Temp Service ${Date.now()}`,
        categoryId: cat!.id,
        price: 50,
        duration: 30,
        resourceIds: [tenantAResourceId],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(dummyService.status === 201, 'Temp service created with own resource');
    const dummyServiceId = dummyService.data?.data?.id;

    const crossUpdateService = await request(
      'PUT',
      `/api/services/${dummyServiceId}`,
      { resourceIds: [tenantBResourceId] },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(
      crossUpdateService.status === 400,
      'Tenant A cannot map Tenant B resource in Service Update (400 Bad Request)'
    );

    // Clean up dummy service
    await prisma.service.delete({ where: { id: dummyServiceId } });

    // -------------------------------------------------------------------------
    // SECTION 7: RBAC & CASHIER PERMISSIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. RBAC & Cashier Permissions ---');

    // 7.1 Cashier can list resources (200)
    const cashierList = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierList.status === 200, 'Cashier can list resources (HTTP 200)');

    // 7.2 Cashier can read single resource (200)
    const cashierGet = await request(
      'GET',
      `/api/resources/${tenantAResourceId}`,
      undefined,
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierGet.status === 200, 'Cashier can get resource by ID (HTTP 200)');

    // 7.3 Cashier CANNOT create resource (403 Forbidden)
    const cashierCreate = await request(
      'POST',
      '/api/resources',
      { name: 'Unauthorized Room', capacity: 1 },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierCreate.status === 403, 'Cashier cannot create resource (403 Forbidden)');

    // 7.4 Cashier CANNOT update resource (403 Forbidden)
    const cashierUpdate = await request(
      'PUT',
      `/api/resources/${tenantAResourceId}`,
      { name: 'Unauthorized Rename' },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierUpdate.status === 403, 'Cashier cannot update resource (403 Forbidden)');

    // 7.5 Cashier CANNOT toggle resource status (403 Forbidden)
    const cashierStatus = await request(
      'PATCH',
      `/api/resources/${tenantAResourceId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierStatus.status === 403, 'Cashier cannot patch resource status (403 Forbidden)');

    // 7.6 Cashier CANNOT delete resource (403 Forbidden)
    const cashierDelete = await request(
      'DELETE',
      `/api/resources/${tenantAResourceId}`,
      undefined,
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierDelete.status === 403, 'Cashier cannot delete resource (403 Forbidden)');

    // -------------------------------------------------------------------------
    // SECTION 8: TWO-TIER MODULE ACCESS ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Two-Tier Module Access Enforcement ---');

    // 8.1 Tier 2 Test: Remove RESOURCES module from Cashier profile
    await prisma.user.update({
      where: { id: cashierUserId },
      data: { enabledModules: ['POS', 'SERVICES', 'PRODUCTS'] }, // RESOURCES removed
    });

    const cashierTier2Blocked = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(
      cashierTier2Blocked.status === 403,
      'Tier 2: Cashier blocked when RESOURCES is not assigned to profile (HTTP 403)'
    );
    assert(
      cashierTier2Blocked.data?.message?.includes('not assigned to this cashier'),
      'Error message clarifies cashier profile module restriction'
    );

    // Re-enable RESOURCES for cashier
    await prisma.user.update({
      where: { id: cashierUserId },
      data: { enabledModules: ['POS', 'SERVICES', 'PRODUCTS', 'RESOURCES'] },
    });

    const cashierTier2Allowed = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(
      cashierTier2Allowed.status === 200,
      'Tier 2: Cashier accesses resources when module is reassigned (HTTP 200)'
    );

    // 8.2 Tier 1 Test: Remove RESOURCES module from Company
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: tenantAId },
      select: { enabledModules: true },
    });
    if (tenantRecord) {
      const origModules = (Array.isArray(tenantRecord.enabledModules)
        ? tenantRecord.enabledModules
        : ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'RESOURCES']) as string[];
      const strippedModules = origModules.filter((m) => m !== 'RESOURCES');

      await prisma.tenant.update({
        where: { id: tenantAId },
        data: { enabledModules: strippedModules },
      });

      const adminTier1Blocked = await request('GET', '/api/resources', undefined, {
        Authorization: `Bearer ${adminAToken}`,
      });
      assert(
        adminTier1Blocked.status === 403,
        'Tier 1: Company Admin blocked when RESOURCES module is disabled for company (HTTP 403)'
      );
      assert(
        adminTier1Blocked.data?.message?.includes('not enabled for this company'),
        'Error message clarifies company-level subscription module restriction'
      );

      // Restore Tier 1 module
      await prisma.tenant.update({
        where: { id: tenantAId },
        data: { enabledModules: origModules },
      });

      const adminTier1Restored = await request('GET', '/api/resources', undefined, {
        Authorization: `Bearer ${adminAToken}`,
      });
      assert(
        adminTier1Restored.status === 200,
        'Tier 1: Company Admin accesses resources after module re-enabled (HTTP 200)'
      );
    }

    // 8.3 Subscription Expiration Enforcement
    // Temporarily expire Tenant A subscription
    const currentTenantA = await prisma.tenant.findUnique({ where: { id: tenantAId } });
    const origSubStatus = currentTenantA?.subscriptionStatus || 'ACTIVE';
    const origSubExpiry = currentTenantA?.subscriptionExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.tenant.update({
      where: { id: tenantAId },
      data: {
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    });

    const expiredAdminRes = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(
      expiredAdminRes.status === 401 || expiredAdminRes.status === 403,
      'Expired company Admin blocked from accessing resources (401/403)'
    );
    assert(
      expiredAdminRes.data?.message?.includes('Your company subscription has expired'),
      'Expired response contains exact subscription expired message'
    );

    const expiredCashierRes = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(
      expiredCashierRes.status === 401 || expiredCashierRes.status === 403,
      'Expired company Cashier blocked from accessing resources (401/403)'
    );
    assert(
      expiredCashierRes.data?.message?.includes('Your company subscription has expired'),
      'Expired Cashier response contains exact subscription expired message'
    );

    // Restore subscription to ACTIVE
    await prisma.tenant.update({
      where: { id: tenantAId },
      data: {
        subscriptionStatus: origSubStatus,
        subscriptionExpiresAt: origSubExpiry,
      },
    });

    const restoredAdminRes = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(restoredAdminRes.status === 200, 'Admin can access resources after subscription restored (200)');

    // -------------------------------------------------------------------------
    // SECTION 9: SUPERADMIN IMPERSONATION
    // -------------------------------------------------------------------------
    console.log('\n--- 9. SuperAdmin Impersonation ---');

    // 9.1 SuperAdmin impersonates Tenant A
    const impRes = await request(
      'POST',
      `/api/platform/companies/${tenantAId}/impersonate`,
      undefined,
      { Authorization: `Bearer ${superToken}` }
    );
    assert(impRes.status === 200, 'SuperAdmin starts impersonation of Tenant A (200)');
    const impToken = impRes.data?.data?.token;

    // 9.2 Impersonator can list resources
    const impList = await request('GET', '/api/resources', undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impList.status === 200, 'Impersonating SuperAdmin lists resources (200)');

    // 9.3 Impersonator can create resource under Tenant A
    const impCreate = await request(
      'POST',
      '/api/resources',
      {
        name: 'SuperAdmin Impersonated Room',
        capacity: 3,
        description: 'Created during platform impersonation session',
      },
      { Authorization: `Bearer ${impToken}` }
    );
    assert(impCreate.status === 201, 'Impersonating SuperAdmin creates resource (201)');
    assert(
      impCreate.data?.data?.tenantId === tenantAId,
      'Resource created by impersonator belongs to Tenant A'
    );
    const impResourceId = impCreate.data?.data?.id;

    // 9.4 Exit impersonation
    const exitRes = await request(
      'POST',
      '/api/platform/impersonate/exit',
      { targetTenantId: tenantAId },
      { Authorization: `Bearer ${impToken}` }
    );
    assert(exitRes.status === 200, 'SuperAdmin exits impersonation (200)');

    // -------------------------------------------------------------------------
    // SECTION 10: AUDIT LOGGING VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Audit Logging Verification ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'RESOURCE',
        tenantId: tenantAId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    assert(auditLogs.length > 0, 'Audit logs recorded for RESOURCE entity');

    const actions = auditLogs.map((l) => l.action);
    assert(
      actions.includes('RESOURCE_CREATED') || actions.some((a) => a.includes('CREATE')),
      'Audit log contains CREATE action for RESOURCE'
    );
    assert(
      actions.includes('RESOURCE_UPDATED') || actions.some((a) => a.includes('UPDATE')),
      'Audit log contains UPDATE action for RESOURCE'
    );

    // Verify zero credentials/passwords/hashes leaked in audit logs
    const hasSecretsInMetadata = auditLogs.some((l) => {
      const metaStr = JSON.stringify(l.metadata || {});
      return metaStr.includes('password') || metaStr.includes('secret') || metaStr.includes('hash');
    });
    assert(!hasSecretsInMetadata, 'Audit logs for RESOURCE contain zero passwords, hashes, or secrets');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- Cleanup ---');
    await prisma.resource.deleteMany({
      where: {
        name: { in: testNames },
      },
    });
    if (impResourceId) {
      await prisma.resource.deleteMany({ where: { id: impResourceId } });
    }
    if (tenantBResourceId) {
      await prisma.resource.deleteMany({ where: { id: tenantBResourceId } });
    }
  } catch (err: any) {
    console.error('Unexpected test exception:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
