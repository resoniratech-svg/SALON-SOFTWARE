import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let receptionistToken: string;
let testCategoryId1: string;
let testCategoryId2: string;
let createdDisposableId: string;

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
  console.log('     QUBEXE SALOON SOFTWARE Disposables Test Suite     ');
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
    // 0. Clean previous test artifacts
    console.log('--- 0. Clean previous test artifacts ---');
    await prisma.disposable.deleteMany({
      where: {
        OR: [
          {
            category: {
              in: ['Disposables', 'Test Disposables Cat Alpha', 'Test Disposables Cat Beta', 'Secondary Category'],
            },
          },
          {
            name: {
              in: [
                'Large Gloves',
                'Small Gloves',
                'Full Spec Gloves',
                'Default Minimal Item',
                'Duplicate Test Gloves',
                'Cross Cat Gloves',
                'Filter Item A',
                'Filter Item B',
                'Delete Target Disposable',
                'Barcode Clashing Disposable',
                'Code Clashing Disposable',
                'RBAC Forbidden Disposable',
                'Category Link Tester',
              ],
            },
          },
        ],
      },
    });

    await prisma.productCategory.deleteMany({
      where: {
        name: {
          in: ['Test Disposables Cat Alpha', 'Test Disposables Cat Beta'],
        },
      },
    });

    // 1. Authenticate and obtain tokens
    console.log('\n--- 1. Authenticate and Obtain Tokens ---');
    const adminLoginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeds (200)');
    adminToken = adminLoginRes.data?.data?.token;
    assert(Boolean(adminToken), 'Admin token acquired');

    const recLoginRes = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(recLoginRes.status === 401, 'Receptionist login rejected under 2-role model (401)');

    // Create test product categories for category relation testing
    const cat1 = await prisma.productCategory.create({
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Test Disposables Cat Alpha',
        position: 1,
        group: 'Both',
      },
    });
    testCategoryId1 = cat1.id;

    const cat2 = await prisma.productCategory.create({
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Test Disposables Cat Beta',
        position: 2,
        group: 'Female',
      },
    });
    testCategoryId2 = cat2.id;
    assert(Boolean(testCategoryId1 && testCategoryId2), 'Test product categories created');

    // 2. Barcode Generation
    console.log('\n--- 2. Barcode Generation ---');
    const barcodeRes = await request('GET', '/api/disposables/generate-barcode', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(barcodeRes.status === 200, 'GET /generate-barcode returns 200');
    assert(Boolean(barcodeRes.data?.data?.barcode), 'Barcode is returned in response');
    assert(
      typeof barcodeRes.data?.data?.barcode === 'string' &&
      barcodeRes.data?.data?.barcode.length >= 10,
      'Barcode is at least 10 characters length string'
    );

    // 3. Create Disposable
    console.log('\n--- 3. Create Disposable ---');
    // 3.1 Create standard disposable with defaults
    const defaultRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Default Minimal Item' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(defaultRes.status === 201, 'Create disposable with defaults returns 201');
    assert(defaultRes.data?.data?.name === 'Default Minimal Item', 'Name matches');
    assert(defaultRes.data?.data?.category === 'Disposables', 'Default category is "Disposables"');
    assert(Number(defaultRes.data?.data?.price) === 0, 'Default price is 0');
    assert(Number(defaultRes.data?.data?.quantity) === 1, 'Default quantity is 1');
    assert(defaultRes.data?.data?.unit === 'pcs', 'Default unit is "pcs"');
    assert(defaultRes.data?.data?.gender === 'Both', 'Default gender is "Both"');
    assert(defaultRes.data?.data?.isRetail === false, 'Default isRetail is false');
    assert(defaultRes.data?.data?.hideFromCatalogue === false, 'Default hideFromCatalogue is false');
    assert(defaultRes.data?.data?.isNonDiscountable === false, 'Default isNonDiscountable is false');
    assert(defaultRes.data?.data?.isActive === true, 'Default isActive is true');

    // 3.2 Create full-specification disposable (Large Gloves)
    const fullSpecRes = await request(
      'POST',
      '/api/disposables',
      {
        name: 'Large Gloves',
        code: 'DISP-GLV-001',
        category: 'Disposables',
        categoryId: testCategoryId1,
        price: 25.5,
        salePrice: 20.0,
        quantity: 100,
        unit: 'box',
        gender: 'Both',
        isRetail: false,
        hideFromCatalogue: false,
        isNonDiscountable: true,
        description: 'Latex powder-free examination gloves, Large size',
        barcode: '987654321001',
        position: 1,
        hsnCode: '4015',
        productTag: 'Sanitation',
        isActive: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(fullSpecRes.status === 201, 'Create full-specification disposable returns 201');
    createdDisposableId = fullSpecRes.data?.data?.id;
    assert(Boolean(createdDisposableId), 'Created disposable ID acquired');
    assert(fullSpecRes.data?.data?.name === 'Large Gloves', 'Name matches "Large Gloves"');
    assert(fullSpecRes.data?.data?.code === 'DISP-GLV-001', 'Code matches');
    assert(Number(fullSpecRes.data?.data?.price) === 25.5, 'Price matches 25.50');
    assert(Number(fullSpecRes.data?.data?.salePrice) === 20.0, 'Sale price matches 20.00');
    assert(Number(fullSpecRes.data?.data?.quantity) === 100, 'Quantity matches 100');
    assert(fullSpecRes.data?.data?.unit === 'box', 'Unit matches "box"');
    assert(fullSpecRes.data?.data?.isNonDiscountable === true, 'isNonDiscountable is true');
    assert(fullSpecRes.data?.data?.productCategory?.id === testCategoryId1, 'Category relation resolved');

    // 3.3 Create disposable inheriting category name from categoryId
    const catInheritRes = await request(
      'POST',
      '/api/disposables',
      {
        name: 'Small Gloves',
        categoryId: testCategoryId2,
        price: 15.0,
        quantity: 50,
        unit: 'box',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(catInheritRes.status === 201, 'Create disposable inheriting category name returns 201');
    assert(catInheritRes.data?.data?.category === 'Test Disposables Cat Beta', 'Category inherited from ProductCategory');

    // 4. Validation & Constraint Handling
    console.log('\n--- 4. Validation & Constraint Handling ---');
    // 4.1 Missing name -> 400
    const noNameRes = await request(
      'POST',
      '/api/disposables',
      { price: 10 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(noNameRes.status === 400, 'Missing name returns 400');

    // 4.2 Empty name -> 400
    const emptyNameRes = await request(
      'POST',
      '/api/disposables',
      { name: '   ' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(emptyNameRes.status === 400, 'Empty name returns 400');

    // 4.3 Invalid categoryId UUID -> 400
    const invalidUuidRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Invalid Cat UUID', categoryId: 'not-a-uuid' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidUuidRes.status === 400, 'Invalid categoryId UUID format returns 400');

    // 4.4 Non-existent categoryId UUID -> 400
    const nonExistentCatRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Non Existent Cat', categoryId: '00000000-0000-0000-0000-000000000000' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(nonExistentCatRes.status === 400, 'Non-existent categoryId returns 400');

    // 4.5 Negative price -> 400
    const negPriceRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Negative Price Item', price: -5 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(negPriceRes.status === 400, 'Negative price returns 400');

    // 4.6 Negative quantity -> 400
    const negQtyRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Negative Qty Item', quantity: -10 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(negQtyRes.status === 400, 'Negative quantity returns 400');

    // 4.7 Invalid gender -> 400
    const invalidGenderRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Invalid Gender Item', gender: 'Unknown' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidGenderRes.status === 400, 'Invalid gender returns 400');

    // 4.8 Duplicate name in same category (case-insensitive) -> 409
    const dupNameRes = await request(
      'POST',
      '/api/disposables',
      { name: '  large GLOVES  ', category: 'disposables' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupNameRes.status === 409, 'Duplicate name in same category returns 409 Conflict');

    // 4.9 Same name in DIFFERENT category -> 201
    const crossCatRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Large Gloves', category: 'Secondary Category' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(crossCatRes.status === 201, 'Same name in different category returns 201');

    // 4.10 Duplicate barcode -> 409
    const dupBarcodeRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Barcode Clashing Disposable', barcode: '987654321001' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupBarcodeRes.status === 409, 'Duplicate barcode returns 409 Conflict');

    // 4.11 Duplicate code -> 409
    const dupCodeRes = await request(
      'POST',
      '/api/disposables',
      { name: 'Code Clashing Disposable', code: 'DISP-GLV-001' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupCodeRes.status === 409, 'Duplicate code returns 409 Conflict');

    // 5. Read Tests (List, Filters, Pagination, Sorting, GetById)
    console.log('\n--- 5. Read Tests ---');
    // 5.1 List with pagination
    const listRes = await request('GET', '/api/disposables?page=1&limit=10', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listRes.status === 200, 'GET /api/disposables returns 200');
    assert(Array.isArray(listRes.data?.data?.items), 'Items is an array');
    assert(listRes.data?.data?.pagination?.page === 1, 'Pagination page is 1');
    assert(listRes.data?.data?.pagination?.limit === 10, 'Pagination limit is 10');
    assert(typeof listRes.data?.data?.pagination?.total === 'number', 'Pagination total is number');

    // 5.2 Get by valid ID
    const getByIdRes = await request('GET', `/api/disposables/${createdDisposableId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getByIdRes.status === 200, 'GET /api/disposables/:id returns 200');
    assert(getByIdRes.data?.data?.id === createdDisposableId, 'ID matches');
    assert(getByIdRes.data?.data?.productCategory?.name === 'Test Disposables Cat Alpha', 'Category relation included');

    // 5.3 Get by invalid/non-existent UUID format -> 404
    const invalidIdRes = await request('GET', '/api/disposables/not-a-valid-uuid', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(invalidIdRes.status === 404, 'Invalid UUID returns 404');

    // 5.4 Get by non-existent UUID -> 404
    const notFoundRes = await request(
      'GET',
      '/api/disposables/00000000-0000-0000-0000-000000000000',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundRes.status === 404, 'Non-existent ID returns 404');

    // 5.5 Filter by category
    const catFilterRes = await request('GET', '/api/disposables?category=Disposables', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(catFilterRes.status === 200, 'Filter by category returns 200');
    assert(
      catFilterRes.data?.data?.items.every((d: any) => d.category.toLowerCase() === 'disposables'),
      'All filtered items belong to Disposables category'
    );

    // 5.6 Filter by unit
    const unitFilterRes = await request('GET', '/api/disposables?unit=box', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(unitFilterRes.status === 200, 'Filter by unit returns 200');
    assert(
      unitFilterRes.data?.data?.items.every((d: any) => d.unit.toLowerCase() === 'box'),
      'All filtered items have unit="box"'
    );

    // 5.7 Filter by isActive
    const activeFilterRes = await request('GET', '/api/disposables?isActive=true', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(activeFilterRes.status === 200, 'Filter by isActive=true returns 200');
    assert(
      activeFilterRes.data?.data?.items.every((d: any) => d.isActive === true),
      'All filtered items are active'
    );

    // 5.8 Search query
    const searchRes = await request('GET', '/api/disposables?search=Large%20Gloves', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchRes.status === 200, 'Search returns 200');
    assert(
      searchRes.data?.data?.items.some((d: any) => d.name === 'Large Gloves'),
      'Search finds "Large Gloves"'
    );

    // 5.9 Sorting
    const sortRes = await request('GET', '/api/disposables?sortBy=price&sortOrder=desc', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(sortRes.status === 200, 'Sort by price desc returns 200');
    const items = sortRes.data?.data?.items || [];
    if (items.length >= 2) {
      assert(Number(items[0].price) >= Number(items[1].price), 'Prices sorted descending');
    }

    // 6. Update Disposable
    console.log('\n--- 6. Update Disposable ---');
    // 6.1 Update fields
    const updateRes = await request(
      'PUT',
      `/api/disposables/${createdDisposableId}`,
      {
        name: 'Large Gloves Pro',
        price: 28.0,
        salePrice: 24.0,
        unit: 'pack',
        quantity: 120,
        description: 'Updated premium latex powder-free examination gloves',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateRes.status === 200, 'Update disposable returns 200');
    assert(updateRes.data?.data?.name === 'Large Gloves Pro', 'Updated name matches');
    assert(Number(updateRes.data?.data?.price) === 28.0, 'Updated price matches');
    assert(Number(updateRes.data?.data?.quantity) === 120, 'Updated quantity matches');
    assert(updateRes.data?.data?.unit === 'pack', 'Updated unit matches');

    // 6.2 Update to duplicate name in same category -> 409
    const dupUpdateRes = await request(
      'PUT',
      `/api/disposables/${createdDisposableId}`,
      { name: 'Default Minimal Item' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupUpdateRes.status === 409, 'Update to duplicate name returns 409');

    // 6.3 Update non-existent disposable -> 404
    const notFoundUpdateRes = await request(
      'PUT',
      '/api/disposables/00000000-0000-0000-0000-000000000000',
      { name: 'New Name' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundUpdateRes.status === 404, 'Update non-existent returns 404');

    // 7. Status Toggle
    console.log('\n--- 7. Status Toggle ---');
    // 7.1 Deactivate
    const deactRes = await request(
      'PATCH',
      `/api/disposables/${createdDisposableId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deactRes.status === 200, 'Deactivate status returns 200');
    assert(deactRes.data?.data?.isActive === false, 'isActive is now false');

    // 7.2 Re-activate
    const reactRes = await request(
      'PATCH',
      `/api/disposables/${createdDisposableId}/status`,
      { isActive: true },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(reactRes.status === 200, 'Reactivate status returns 200');
    assert(reactRes.data?.data?.isActive === true, 'isActive is now true');

    // 7.3 Invalid status payload -> 400
    const invalidStatusRes = await request(
      'PATCH',
      `/api/disposables/${createdDisposableId}/status`,
      { isActive: 'not-a-bool' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidStatusRes.status === 400, 'Invalid status payload returns 400');

    // 8. Delete Disposable
    console.log('\n--- 8. Delete Disposable ---');
    // Create target to delete
    const delTarget = await request(
      'POST',
      '/api/disposables',
      { name: 'Delete Target Disposable' },
      { Authorization: `Bearer ${adminToken}` }
    );
    const delId = delTarget.data?.data?.id;

    // Delete existing
    const deleteRes = await request('DELETE', `/api/disposables/${delId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(deleteRes.status === 200, 'Delete disposable returns 200');

    // Verify deleted
    const verifyDelRes = await request('GET', `/api/disposables/${delId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(verifyDelRes.status === 404, 'Subsequent GET returns 404');

    // Delete non-existent -> 404
    const delNotFoundRes = await request(
      'DELETE',
      '/api/disposables/00000000-0000-0000-0000-000000000000',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(delNotFoundRes.status === 404, 'Delete non-existent returns 404');

    // 9. RBAC & Security
    console.log('\n--- 9. RBAC & Security ---');
    // 9.1 Unauthenticated requests -> 401
    const unauthGetRes = await request('GET', '/api/disposables');
    assert(unauthGetRes.status === 401, 'Unauthenticated GET /api/disposables returns 401');

    const unauthPostRes = await request('POST', '/api/disposables', { name: 'Unauth Item' });
    assert(unauthPostRes.status === 401, 'Unauthenticated POST /api/disposables returns 401');

    // 9.2 Non-admin token presentation rejected by authenticateJwt
    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    receptionistToken = jwt.sign(
      { userId: recUser?.id, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    const recListRes = await request('GET', '/api/disposables', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recListRes.status === 401, 'Non-admin token rejected by authenticateJwt (401)');

    const recGetBarcodeRes = await request('GET', '/api/disposables/generate-barcode', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recGetBarcodeRes.status === 401, 'Non-admin token rejected by authenticateJwt (401)');

    const recGetByIdRes = await request('GET', `/api/disposables/${createdDisposableId}`, undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recGetByIdRes.status === 401, 'Non-admin token rejected by authenticateJwt (401)');

    // 9.3 Receptionist without Admin privileges -> 401
    const recPostRes = await request(
      'POST',
      '/api/disposables',
      { name: 'RBAC Forbidden Disposable' },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recPostRes.status === 401, 'Receptionist POST returns 401 Unauthorized');

    // 9.4 Receptionist without Admin privileges -> 401
    const recPutRes = await request(
      'PUT',
      `/api/disposables/${createdDisposableId}`,
      { name: 'Receptionist Rename' },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recPutRes.status === 401, 'Receptionist PUT returns 401 Unauthorized');

    // 9.5 Receptionist without Admin privileges -> 401
    const recPatchRes = await request(
      'PATCH',
      `/api/disposables/${createdDisposableId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recPatchRes.status === 401, 'Receptionist PATCH /status returns 401 Unauthorized');

    // 9.6 Receptionist without Admin privileges -> 401
    const recDeleteRes = await request(
      'DELETE',
      `/api/disposables/${createdDisposableId}`,
      undefined,
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recDeleteRes.status === 401, 'Receptionist DELETE returns 401 Unauthorized');

    // 10. Clean up created items
    console.log('\n--- 10. Cleanup ---');
    await prisma.disposable.deleteMany({
      where: {
        OR: [
          { category: { in: ['Disposables', 'Test Disposables Cat Alpha', 'Test Disposables Cat Beta', 'Secondary Category'] } },
          { name: { in: ['Large Gloves Pro', 'Default Minimal Item', 'Small Gloves', 'Large Gloves'] } },
        ],
      },
    });

    await prisma.productCategory.deleteMany({
      where: {
        id: { in: [testCategoryId1, testCategoryId2] },
      },
    });
    console.log('  Cleaned up test disposables and categories');

    console.log('\n========================================');
    console.log(`   DISPOSABLES TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
