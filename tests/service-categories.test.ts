import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let receptionistToken: string;
let createdCategoryId: string;

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
  console.log('   QUBEXE SALOON SOFTWARE Service Categories Test Suite');
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
    // PREREQUISITES & AUTH SETUP
    // -------------------------------------------------------------
    console.log('--- 1. Setup & Authentication ---');

    const adminLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    adminToken = adminLogin.data?.data?.token;
    assert(!!adminToken, 'Admin authenticated and JWT obtained');

    const recLogin = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(recLogin.status === 401, 'Receptionist login rejected under 2-role model (HTTP 401)');

    // Clean any prior test categories and attached services
    const priorCats = await prisma.serviceCategory.findMany({
      where: {
        name: { in: ['Skin', 'skin', 'Facial', 'Hair', 'TestCat', 'MinimalCat', 'OversizedCat'] },
      },
      select: { id: true },
    });
    const priorCatIds = priorCats.map((c) => c.id);
    if (priorCatIds.length > 0) {
      await prisma.service.deleteMany({
        where: { categoryId: { in: priorCatIds } },
      });
      await prisma.serviceCategory.deleteMany({
        where: { id: { in: priorCatIds } },
      });
    }

    // -------------------------------------------------------------
    // 2. CREATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 2. Service Category Creation Tests ---');

    // 2.1 Create with all demonstrated fields
    const validCategoryPayload = {
      name: 'Skin',
      position: 7,
      group: 'Both',
      hideFromCatalogue: false,
      imageUrl: 'https://respark.local/categories/skin.jpg',
      isActive: true,
    };

    const createRes = await request('POST', '/api/service-categories', validCategoryPayload, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(createRes.status === 201, 'Valid Service Category created (HTTP 201)');
    assert(createRes.data?.success === true, 'Response indicates success');
    assert(createRes.data?.data?.name === 'Skin', 'Category name saved correctly');
    assert(createRes.data?.data?.position === 7, 'Position saved correctly');
    assert(createRes.data?.data?.group === 'Both', 'Group saved correctly');
    assert(createRes.data?.data?.hideFromCatalogue === false, 'hideFromCatalogue saved correctly');
    assert(createRes.data?.data?.imageUrl === 'https://respark.local/categories/skin.jpg', 'Image URL saved correctly');
    assert(createRes.data?.data?.isActive === true, 'isActive defaults to true');

    createdCategoryId = createRes.data?.data?.id;

    // 2.2 Create with minimal valid fields (only name)
    const minRes = await request('POST', '/api/service-categories', { name: 'Facial' }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(minRes.status === 201, 'Minimal category created with default position & group (HTTP 201)');
    assert(minRes.data?.data?.group === 'Both', 'Default group is Both');
    assert(minRes.data?.data?.position === 0, 'Default position is 0');

    // 2.3 Missing required name
    const noName = await request('POST', '/api/service-categories', {}, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(noName.status === 400, 'Missing name rejected with HTTP 400 Bad Request');

    // 2.4 Empty name
    const emptyName = await request('POST', '/api/service-categories', { name: '' }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(emptyName.status === 400, 'Empty name rejected with HTTP 400');

    // 2.5 Whitespace-only name
    const wsName = await request('POST', '/api/service-categories', { name: '    ' }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(wsName.status === 400, 'Whitespace-only name rejected with HTTP 400');

    // 2.6 Name exceeding allowed length (>100 characters)
    const longName = await request('POST', '/api/service-categories', {
      name: 'A'.repeat(101),
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(longName.status === 400, 'Name exceeding 100 characters rejected with HTTP 400');

    // 2.7 Duplicate name check (case-insensitive duplicate 'skin' vs 'Skin')
    const dupRes = await request('POST', '/api/service-categories', { name: 'skin' }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(dupRes.status === 409, 'Duplicate category name rejected with HTTP 409 Conflict');

    // 2.8 Valid base64 image under 100 KB
    const smallBase64 = 'data:image/png;base64,' + 'A'.repeat(1000); // approx 1 KB
    const validImgRes = await request('POST', '/api/service-categories', {
      name: 'Hair',
      imageUrl: smallBase64,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(validImgRes.status === 201, 'Valid image under 100 KB accepted (HTTP 201)');

    // 2.9 Oversized image rejection (> 100 KB)
    // 100 KB is ~102,400 bytes, which in base64 is ~136,533 chars
    const oversizedBase64 = 'data:image/png;base64,' + 'A'.repeat(150000); // approx 110 KB
    const oversizedRes = await request('POST', '/api/service-categories', {
      name: 'OversizedCat',
      imageUrl: oversizedBase64,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(oversizedRes.status === 400, 'Oversized image (>100 KB) rejected with HTTP 400');

    // -------------------------------------------------------------
    // 3. RETRIEVAL & FILTER TESTS
    // -------------------------------------------------------------
    console.log('\n--- 3. Retrieval & Filter Tests ---');

    // 3.1 Get category list
    const listRes = await request('GET', '/api/service-categories', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listRes.status === 200, 'GET /api/service-categories returns HTTP 200');
    assert(Array.isArray(listRes.data?.data), 'Returns an array of categories');
    assert(listRes.data?.data?.length >= 3, 'Contains created categories');

    // 3.2 Search by name
    const searchRes = await request('GET', '/api/service-categories?search=fac', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchRes.status === 200, 'Search by name returns HTTP 200');
    assert(searchRes.data?.data?.some((c: any) => c.name === 'Facial'), 'Search matches "Facial"');

    // 3.3 Filter by group
    const groupRes = await request('GET', '/api/service-categories?group=Both', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(groupRes.data?.data?.every((c: any) => c.group === 'Both'), 'Filter by group returns only matching records');

    // 3.4 Filter by active status
    const activeRes = await request('GET', '/api/service-categories?isActive=true', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(activeRes.data?.data?.every((c: any) => c.isActive === true), 'Filter by isActive=true returns only active categories');

    // 3.5 Get category by ID
    const getByIdRes = await request('GET', `/api/service-categories/${createdCategoryId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getByIdRes.status === 200, 'GET /api/service-categories/:id returns HTTP 200');
    assert(getByIdRes.data?.data?.id === createdCategoryId, 'Returns correct category by ID');

    // 3.6 Non-existent category ID returns 404
    const badIdRes = await request('GET', '/api/service-categories/00000000-0000-0000-0000-000000000000', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(badIdRes.status === 404, 'Non-existent category returns HTTP 404 Not Found');

    // -------------------------------------------------------------
    // 4. UPDATE & STATUS TESTS
    // -------------------------------------------------------------
    console.log('\n--- 4. Update & Status Tests ---');

    // 4.1 Update category fields
    const updateRes = await request('PUT', `/api/service-categories/${createdCategoryId}`, {
      name: 'Skin Care',
      position: 8,
      group: 'Female',
      hideFromCatalogue: true,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(updateRes.status === 200, 'Category updated successfully (HTTP 200)');
    assert(updateRes.data?.data?.name === 'Skin Care', 'Category name updated');
    assert(updateRes.data?.data?.position === 8, 'Position updated');
    assert(updateRes.data?.data?.group === 'Female', 'Group updated');
    assert(updateRes.data?.data?.hideFromCatalogue === true, 'hideFromCatalogue updated');

    // 4.2 Duplicate name check on update
    const dupUpdateRes = await request('PUT', `/api/service-categories/${createdCategoryId}`, {
      name: 'Facial', // already taken by another category
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(dupUpdateRes.status === 409, 'Updating to existing category name returns HTTP 409 Conflict');

    // 4.3 Update status (deactivate)
    const deactRes = await request('PATCH', `/api/service-categories/${createdCategoryId}/status`, {
      isActive: false,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(deactRes.status === 200, 'Category deactivated (HTTP 200)');
    assert(deactRes.data?.data?.isActive === false, 'isActive is now false');

    // 4.4 Update status (reactivate)
    const reactRes = await request('PATCH', `/api/service-categories/${createdCategoryId}/status`, {
      isActive: true,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reactRes.status === 200, 'Category reactivated (HTTP 200)');
    assert(reactRes.data?.data?.isActive === true, 'isActive is now true');

    // -------------------------------------------------------------
    // 5. DELETION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 5. Deletion Tests ---');

    // 5.1 Delete existing category
    const deleteRes = await request('DELETE', `/api/service-categories/${createdCategoryId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(deleteRes.status === 200, 'Category deleted successfully (HTTP 200)');

    // 5.2 Verify category no longer exists
    const verifyDel = await request('GET', `/api/service-categories/${createdCategoryId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(verifyDel.status === 404, 'Deleted category is no longer found (HTTP 404)');

    // 5.3 Repeated deletion returns 404
    const repeatDel = await request('DELETE', `/api/service-categories/${createdCategoryId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repeatDel.status === 404, 'Deleting non-existent category returns HTTP 404');

    // -------------------------------------------------------------
    // 6. AUTHENTICATION & RBAC TESTS
    // -------------------------------------------------------------
    console.log('\n--- 6. Authentication & RBAC Tests ---');

    // 6.1 Missing token
    const unauth = await request('GET', '/api/service-categories');
    assert(unauth.status === 401, 'Unauthenticated request returns HTTP 401');

    // 6.2 Non-admin token presentation is rejected by authenticateJwt
    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    receptionistToken = jwt.sign(
      { userId: recUser?.id, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    const recList = await request('GET', '/api/service-categories', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recList.status === 401, 'Non-admin token rejected by authenticateJwt (HTTP 401)');

    // 6.3 Non-admin without permissions rejected
    const recCreate = await request('POST', '/api/service-categories', { name: 'ForbiddenCat' }, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recCreate.status === 401, 'Non-admin user rejected with HTTP 401 Unauthorized');

    // 6.4 Non-admin without permissions rejected
    const recDelete = await request('DELETE', '/api/service-categories/00000000-0000-0000-0000-000000000000', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recDelete.status === 401, 'Non-admin user rejected with HTTP 401 Unauthorized');

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('\n========================================');
    console.log(`Service Categories Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
