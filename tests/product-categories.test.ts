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
  console.log('   QUBEXE SALOON SOFTWARE Product Categories Test Suite');
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
    // 0. Clean test data from previous runs
    await prisma.productCategory.deleteMany({
      where: {
        name: {
          in: [
            'Test Hair Wax',
            'Test Shampoo',
            'Test Conditioner',
            'Test Serum',
            'Test Skin Cream',
            'skin',
            'Skin',
            'SKIN',
            'cream',
            'Cream',
            'CREAM',
            'Test Unicode 💅 Products',
            'Test Spaces Category',
            'Delete Target Category',
            'Non Existent Update',
          ],
        },
      },
    });

    // 1. Authenticate ADMIN and RECEPTIONIST
    console.log('--- 1. Authentication ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminLogin.status === 200, 'ADMIN login successful');
    adminToken = adminLogin.data.data.token;

    const receptionistLogin = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(receptionistLogin.status === 401, 'RECEPTIONIST login rejected under 2-role model (HTTP 401)');

    // 2. Authentication & Authorization Enforcement
    console.log('\n--- 2. Auth & RBAC Enforcement ---');
    const noAuth = await request('GET', '/api/product-categories');
    assert(noAuth.status === 401, 'No Authorization header returns 401');

    const invalidAuth = await request('GET', '/api/product-categories', null, {
      Authorization: 'Bearer invalid.jwt.token',
    });
    assert(invalidAuth.status === 401, 'Invalid JWT returns 401');

    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    receptionistToken = jwt.sign(
      { userId: recUser?.id, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    const recepRead = await request('GET', '/api/product-categories', null, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recepRead.status === 401, 'Non-admin token rejected by authenticateJwt (HTTP 401)');

    const recepCreate = await request(
      'POST',
      '/api/product-categories',
      { name: 'Recep Attempt' },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepCreate.status === 401, 'Non-admin user rejected with HTTP 401 Unauthorized');

    // 3. Category Creation Validation (Section 28)
    console.log('\n--- 3. Category Creation Validation ---');
    const missingName = await request(
      'POST',
      '/api/product-categories',
      {},
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(missingName.status === 400, 'Missing name returns 400');

    const emptyName = await request(
      'POST',
      '/api/product-categories',
      { name: '' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(emptyName.status === 400, 'Empty name returns 400');

    const whitespaceName = await request(
      'POST',
      '/api/product-categories',
      { name: '    ' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(whitespaceName.status === 400, 'Whitespace-only name returns 400');

    const invalidType = await request(
      'POST',
      '/api/product-categories',
      { name: 12345 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidType.status === 400, 'Non-string name returns 400');

    const longName = await request(
      'POST',
      '/api/product-categories',
      { name: 'A'.repeat(101) },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(longName.status === 400, 'Name > 100 characters returns 400');

    const invalidPos = await request(
      'POST',
      '/api/product-categories',
      { name: 'Invalid Pos', position: -5 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidPos.status === 400, 'Negative position returns 400');

    const decimalPos = await request(
      'POST',
      '/api/product-categories',
      { name: 'Decimal Pos', position: 2.5 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(decimalPos.status === 400, 'Decimal position returns 400');

    const invalidGroup = await request(
      'POST',
      '/api/product-categories',
      { name: 'Invalid Group', group: 'Unisex' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidGroup.status === 400, 'Invalid group enum returns 400');

    // 4. Image Size Validation (Section 19 & 28)
    console.log('\n--- 4. Image Size Validation ---');
    // Small valid base64 image (approx 100 bytes)
    const validBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const validImgCat = await request(
      'POST',
      '/api/product-categories',
      { name: 'Test Hair Wax', imageUrl: validBase64 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(validImgCat.status === 201, 'Valid base64 image under 100 KB creates successfully');

    // Oversized base64 image (> 100 KB: ~110 KB base64 payload)
    const largeBase64Data = 'A'.repeat(150 * 1024); // ~150 KB raw data
    const oversizedBase64 = `data:image/png;base64,${largeBase64Data}`;
    const oversizedImgCat = await request(
      'POST',
      '/api/product-categories',
      { name: 'Oversized Cat', imageUrl: oversizedBase64 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(oversizedImgCat.status === 400, 'Image exceeding 100 KB is rejected with 400');
    assert(
      JSON.stringify(oversizedImgCat.data).includes('under 100 KB'),
      'Image error message mentions 100 KB limit'
    );

    // Regular URL string should be accepted without measuring string length as file bytes
    const regularUrlCat = await request(
      'POST',
      '/api/product-categories',
      {
        name: 'Test Shampoo',
        imageUrl: 'https://respark.local/cdn/products/categories/shampoo.png',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(regularUrlCat.status === 201, 'Standard URL image path creates successfully');

    // 5. Successful Creation with All Fields (Section 28)
    console.log('\n--- 5. Full & Minimum Fields Creation ---');
    const fullCatRes = await request(
      'POST',
      '/api/product-categories',
      {
        name: 'Test Conditioner',
        position: 5,
        group: 'Female',
        hideFromCatalogue: true,
        imageUrl: 'https://respark.local/conditioner.jpg',
        isActive: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(fullCatRes.status === 201, 'Create with all fields returns 201');
    createdCategoryId = fullCatRes.data.data.id;
    assert(createdCategoryId !== undefined, 'Returned record includes UUID id');
    assert(fullCatRes.data.data.position === 5, 'Position stored correctly');
    assert(fullCatRes.data.data.group === 'Female', 'Group stored correctly');
    assert(fullCatRes.data.data.hideFromCatalogue === true, 'hideFromCatalogue stored correctly');
    assert(fullCatRes.data.data.isActive === true, 'isActive stored correctly');

    // Minimum required fields
    const minCatRes = await request(
      'POST',
      '/api/product-categories',
      { name: 'Test Serum' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(minCatRes.status === 201, 'Create with minimum required fields returns 201');
    assert(minCatRes.data.data.position === 0, 'Default position is 0');
    assert(minCatRes.data.data.group === 'Both', 'Default group is Both');
    assert(minCatRes.data.data.hideFromCatalogue === false, 'Default hideFromCatalogue is false');
    assert(minCatRes.data.data.isActive === true, 'Default isActive is true');

    // 6. Case-Insensitive Duplicate Prevention (Section 9, 20 & 28)
    console.log('\n--- 6. Case-Insensitive Duplicate Name Check ---');
    const exactDup = await request(
      'POST',
      '/api/product-categories',
      { name: 'Test Conditioner' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(exactDup.status === 409, 'Exact duplicate name rejected with 409 Conflict');

    const caseDup1 = await request(
      'POST',
      '/api/product-categories',
      { name: 'test conditioner' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(caseDup1.status === 409, 'Lower-case duplicate name rejected with 409 Conflict');

    const caseDup2 = await request(
      'POST',
      '/api/product-categories',
      { name: 'TEST CONDITIONER' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(caseDup2.status === 409, 'Upper-case duplicate name rejected with 409 Conflict');

    // Whitespace trimming during duplicate check
    const spaceDup = await request(
      'POST',
      '/api/product-categories',
      { name: '   Test Conditioner   ' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(spaceDup.status === 409, 'Whitespace-padded duplicate name rejected with 409 Conflict');

    // 7. Retrieval & Query Filtering (Section 29)
    console.log('\n--- 7. Retrieval & Filters ---');
    const listRes = await request('GET', '/api/product-categories', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listRes.status === 200, 'GET /api/product-categories returns 200');
    assert(Array.isArray(listRes.data.data), 'Returns an array of categories');
    const foundCreated = listRes.data.data.some((c: any) => c.id === createdCategoryId);
    assert(foundCreated, 'Created category is included in list');

    // Search filter
    const searchRes = await request(
      'GET',
      '/api/product-categories?search=conditioner',
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(searchRes.status === 200, 'Search by keyword returns 200');
    assert(
      searchRes.data.data.every((c: any) => c.name.toLowerCase().includes('conditioner')),
      'All search results match query keyword'
    );

    // Group filter
    const groupRes = await request(
      'GET',
      '/api/product-categories?group=Female',
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(groupRes.status === 200, 'Filter by group returns 200');
    assert(
      groupRes.data.data.every((c: any) => c.group === 'Female'),
      'All results have group Female'
    );

    // Status filter
    const activeRes = await request(
      'GET',
      '/api/product-categories?isActive=true',
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(activeRes.status === 200, 'Filter by isActive=true returns 200');
    assert(
      activeRes.data.data.every((c: any) => c.isActive === true),
      'All results are active'
    );

    // Get by ID
    const getByIdRes = await request(
      'GET',
      `/api/product-categories/${createdCategoryId}`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(getByIdRes.status === 200, 'GET by valid ID returns 200');
    assert(getByIdRes.data.data.id === createdCategoryId, 'Returns matching category record');

    const getNonExistent = await request(
      'GET',
      '/api/product-categories/00000000-0000-0000-0000-000000000000',
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(getNonExistent.status === 404, 'GET non-existent ID returns 404');

    // 8. Update Tests (Section 30)
    console.log('\n--- 8. Update Tests ---');
    const updateRes = await request(
      'PUT',
      `/api/product-categories/${createdCategoryId}`,
      {
        name: 'Test Conditioner Premium',
        position: 10,
        group: 'Both',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateRes.status === 200, 'PUT updates category successfully');
    assert(updateRes.data.data.name === 'Test Conditioner Premium', 'Name updated');
    assert(updateRes.data.data.position === 10, 'Position updated');
    assert(updateRes.data.data.group === 'Both', 'Group updated');
    assert(updateRes.data.data.hideFromCatalogue === true, 'Omitted fields remain unchanged');

    // Update with same name in different case should be allowed for same record
    const selfCaseUpdate = await request(
      'PUT',
      `/api/product-categories/${createdCategoryId}`,
      { name: 'test conditioner premium' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(selfCaseUpdate.status === 200, 'Updating self with different casing is permitted');

    // Update to another existing category's name should be rejected (409)
    const conflictUpdate = await request(
      'PUT',
      `/api/product-categories/${createdCategoryId}`,
      { name: 'Test Shampoo' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(conflictUpdate.status === 409, 'Updating to another existing name returns 409 Conflict');

    // RBAC: RECEPTIONIST cannot update
    const recepUpdate = await request(
      'PUT',
      `/api/product-categories/${createdCategoryId}`,
      { name: 'Recep Edit' },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepUpdate.status === 401, 'Non-admin without UPDATE returns 401');

    // Non-existent update
    const updateNonExistent = await request(
      'PUT',
      '/api/product-categories/00000000-0000-0000-0000-000000000000',
      { name: 'Non Existent Update' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateNonExistent.status === 404, 'Update non-existent category returns 404');

    // 9. Status Toggle Tests (Section 31)
    console.log('\n--- 9. Status Toggle Tests ---');
    const toggleInactive = await request(
      'PATCH',
      `/api/product-categories/${createdCategoryId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(toggleInactive.status === 200, 'PATCH status to inactive returns 200');
    assert(toggleInactive.data.data.isActive === false, 'Category is now inactive');

    const toggleActive = await request(
      'PATCH',
      `/api/product-categories/${createdCategoryId}/status`,
      { isActive: true },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(toggleActive.status === 200, 'PATCH status back to active returns 200');
    assert(toggleActive.data.data.isActive === true, 'Category is now active again');

    const invalidStatus = await request(
      'PATCH',
      `/api/product-categories/${createdCategoryId}/status`,
      { isActive: 'not-a-bool' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidStatus.status === 400, 'Invalid isActive returns 400');

    // RBAC: RECEPTIONIST cannot toggle status
    const recepStatus = await request(
      'PATCH',
      `/api/product-categories/${createdCategoryId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepStatus.status === 401, 'Non-admin without STATUS returns 401');

    // 10. Delete Tests (Section 32)
    console.log('\n--- 10. Delete Tests ---');
    // Create dedicated target for deletion
    const delTarget = await request(
      'POST',
      '/api/product-categories',
      { name: 'Delete Target Category' },
      { Authorization: `Bearer ${adminToken}` }
    );
    const delTargetId = delTarget.data.data.id;

    // RBAC: Non-admin cannot delete
    const recepDelete = await request(
      'DELETE',
      `/api/product-categories/${delTargetId}`,
      null,
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepDelete.status === 401, 'Non-admin without DELETE returns 401');

    // Authorized delete
    const adminDelete = await request(
      'DELETE',
      `/api/product-categories/${delTargetId}`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(adminDelete.status === 200, 'DELETE category returns 200');

    // Repeated deletion returns 404
    const repeatDelete = await request(
      'DELETE',
      `/api/product-categories/${delTargetId}`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(repeatDelete.status === 404, 'Repeated DELETE returns 404');

    // Verify deletion in database directly
    const dbCheck = await prisma.productCategory.findUnique({
      where: { id: delTargetId },
    });
    assert(dbCheck === null, 'Category completely removed from PostgreSQL');

    // 11. Edge Cases & Unicode (Section 36)
    console.log('\n--- 11. Edge Cases & Unicode ---');
    const unicodeCat = await request(
      'POST',
      '/api/product-categories',
      { name: 'Test Unicode 💅 Products' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(unicodeCat.status === 201, 'Category with Unicode emoji name created successfully');

    const spaceCat = await request(
      'POST',
      '/api/product-categories',
      { name: '   Test Spaces Category   ' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(spaceCat.status === 201, 'Category name whitespace is trimmed');
    assert(spaceCat.data.data.name === 'Test Spaces Category', 'Trimmed name stored');

    // 12. Database Constraints & Single Table Verification (Section 40)
    console.log('\n--- 12. Single-Table Database Verification ---');
    const dbRecord = await prisma.productCategory.findUnique({
      where: { id: createdCategoryId },
    });
    assert(dbRecord !== null, 'Record verified directly in PostgreSQL product_categories table');
    assert(dbRecord?.name === 'test conditioner premium', 'Name in DB matches update');
    assert(dbRecord?.createdAt instanceof Date, 'createdAt populated');
    assert(dbRecord?.updatedAt instanceof Date, 'updatedAt populated');

    // Clean up created test records
    await prisma.productCategory.deleteMany({
      where: {
        id: {
          in: [
            createdCategoryId,
            validImgCat.data?.data?.id,
            regularUrlCat.data?.data?.id,
            minCatRes.data?.data?.id,
            unicodeCat.data?.data?.id,
            spaceCat.data?.data?.id,
          ].filter(Boolean),
        },
      },
    });

    console.log('\n========================================');
    console.log(`   TESTS COMPLETED: ${passed + failed}`);
    console.log(`   PASSED: ${passed}`);
    console.log(`   FAILED: ${failed}`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite error:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
