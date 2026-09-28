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
let createdProductId: string;

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
  console.log('       QUBEXE SALOON SOFTWARE Products Test Suite      ');
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
    // 0. Clean test data
    console.log('--- 0. Clean previous test artifacts ---');
    await prisma.product.deleteMany({
      where: {
        OR: [
          {
            category: {
              name: {
                in: ['Test Products Cat Alpha', 'Test Products Cat Beta', 'Delete Restricted Category'],
              },
            },
          },
          {
            name: {
              in: [
                'Test Hair Gel',
                'Test Glow Serum',
                'Duplicate Name Product',
                'Cross Cat Product',
                'Full Spec Cream',
                'Barcode Clashing Product',
                'SKU Clashing Product',
                'Test Filter Item A',
                'Test Filter Item B',
                'Delete Target Product',
                'RBAC Forbidden Product',
              ],
            },
          },
        ],
      },
    });

    await prisma.productCategory.deleteMany({
      where: {
        name: {
          in: ['Test Products Cat Alpha', 'Test Products Cat Beta', 'Delete Restricted Category'],
        },
      },
    });

    // Create test categories
    const cat1 = await prisma.productCategory.create({
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Test Products Cat Alpha',
        position: 1,
        group: 'Both',
        isActive: true,
      },
    });
    testCategoryId1 = cat1.id;

    const cat2 = await prisma.productCategory.create({
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Test Products Cat Beta',
        position: 2,
        group: 'Female',
        isActive: true,
      },
    });
    testCategoryId2 = cat2.id;

    // 1. Authentication
    console.log('\n--- 1. Authentication ---');
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

    // 2. Barcode Generation
    console.log('\n--- 2. Barcode Generation ---');
    const barcodeRes = await request('GET', '/api/products/generate-barcode', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(barcodeRes.status === 200, 'GET /generate-barcode returns 200');
    assert(typeof barcodeRes.data?.data?.barcode === 'string', 'Barcode returned is string');
    assert(barcodeRes.data?.data?.barcode.length >= 10, 'Barcode generated has standard length');
    const autoBarcode = barcodeRes.data?.data?.barcode;

    // 3. Product Creation - Minimal & Comprehensive
    console.log('\n--- 3. Product Creation ---');
    const minimalCreate = await request(
      'POST',
      '/api/products',
      {
        name: 'Test Hair Gel',
        categoryId: testCategoryId1,
        price: 15.5,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(minimalCreate.status === 201, 'Create minimal product returns 201');
    assert(minimalCreate.data?.data?.name === 'Test Hair Gel', 'Minimal product name preserved');
    assert(minimalCreate.data?.data?.price === '15.5' || Number(minimalCreate.data?.data?.price) === 15.5, 'Minimal product price saved');
    assert(minimalCreate.data?.data?.isRetail === true, 'Default isRetail is true');
    assert(minimalCreate.data?.data?.group === 'Both', 'Default group is Both');
    assert(minimalCreate.data?.data?.isActive === true, 'Default isActive is true');

    const fullSpecCreate = await request(
      'POST',
      '/api/products',
      {
        name: 'Full Spec Cream',
        categoryId: testCategoryId1,
        position: 10,
        hsnCode: 'HSN3304',
        productTag: 'Skincare',
        storeSku: 'SKU-FSC-001',
        isRetail: true,
        group: 'Female',
        hideFromCatalogue: false,
        price: 499.0,
        salePrice: 449.0,
        isNonDiscountable: false,
        description: 'Advanced nourishing facial cream with vitamin E',
        barcode: autoBarcode,
        variations: [
          { name: '50ml', sku: 'SKU-FSC-50', price: 499, salePrice: 449, barcode: '50ML-BARCODE' },
          { name: '100ml', sku: 'SKU-FSC-100', price: 899, salePrice: 799, barcode: '100ML-BARCODE' },
        ],
        taxes: [
          { name: 'CGST', rate: 9, type: 'percentage' },
          { name: 'SGST', rate: 9, type: 'percentage' },
        ],
        videoLink: 'https://example.com/demo.mp4',
        benefits: 'Hydrates deeply, protects skin barrier',
        ingredients: 'Aqua, Shea Butter, Vitamin E, Hyaluronic Acid',
        usageInstructions: 'Apply evenly on cleansed skin morning and night',
        displayImages: [
          'https://example.com/cream1.png',
          { url: 'https://example.com/cream2.png', position: 1, isPrimary: true },
        ],
        isActive: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(fullSpecCreate.status === 201, 'Create comprehensive product returns 201');
    createdProductId = fullSpecCreate.data?.data?.id;
    assert(!!createdProductId, 'Created product has valid UUID id');
    assert(fullSpecCreate.data?.data?.hsnCode === 'HSN3304', 'HSN code saved');
    assert(fullSpecCreate.data?.data?.storeSku === 'SKU-FSC-001', 'Store SKU saved');
    assert(fullSpecCreate.data?.data?.barcode === autoBarcode, 'Barcode saved');
    assert(Array.isArray(fullSpecCreate.data?.data?.variations), 'Variations saved as JSON array');
    assert(fullSpecCreate.data?.data?.variations?.length === 2, 'Two variations saved');
    assert(Array.isArray(fullSpecCreate.data?.data?.taxes), 'Taxes saved as JSON array');
    assert(fullSpecCreate.data?.data?.taxes?.length === 2, 'Two taxes saved');
    assert(Array.isArray(fullSpecCreate.data?.data?.displayImages), 'Display images saved as JSON array');

    // 4. Validation Errors
    console.log('\n--- 4. Validation Errors ---');
    const missingName = await request(
      'POST',
      '/api/products',
      { categoryId: testCategoryId1, price: 100 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(missingName.status === 400, 'POST /products without name returns 400');

    const emptyName = await request(
      'POST',
      '/api/products',
      { name: '   ', categoryId: testCategoryId1, price: 100 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(emptyName.status === 400, 'POST /products with empty string name returns 400');

    const missingCategory = await request(
      'POST',
      '/api/products',
      { name: 'Missing Cat Item', price: 100 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(missingCategory.status === 400, 'POST /products without categoryId returns 400');

    const invalidCategoryUUID = await request(
      'POST',
      '/api/products',
      { name: 'Invalid Cat UUID', categoryId: 'not-a-uuid', price: 100 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidCategoryUUID.status === 400, 'POST /products with non-UUID categoryId returns 400');

    const nonExistentCategory = await request(
      'POST',
      '/api/products',
      { name: 'Non Existent Cat', categoryId: '00000000-0000-0000-0000-000000000000', price: 100 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(nonExistentCategory.status === 400, 'POST /products with non-existent category returns 400');

    const negativePrice = await request(
      'POST',
      '/api/products',
      { name: 'Negative Price', categoryId: testCategoryId1, price: -50 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(negativePrice.status === 400, 'POST /products with negative price returns 400');

    const invalidGroup = await request(
      'POST',
      '/api/products',
      { name: 'Invalid Group', categoryId: testCategoryId1, price: 100, group: 'InvalidGroup' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidGroup.status === 400, 'POST /products with invalid group returns 400');

    // 5. Uniqueness Constraints
    console.log('\n--- 5. Uniqueness Constraints ---');
    // First create a product for uniqueness testing
    const baseDup = await request(
      'POST',
      '/api/products',
      {
        name: 'Duplicate Name Product',
        categoryId: testCategoryId1,
        price: 50,
        storeSku: 'SKU-DUP-1',
        barcode: 'BC-DUP-1',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(baseDup.status === 201, 'Base product for duplicate test created');

    // Duplicate name in same category
    const dupNameSameCat = await request(
      'POST',
      '/api/products',
      {
        name: 'Duplicate Name Product',
        categoryId: testCategoryId1,
        price: 60,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupNameSameCat.status === 409, 'Duplicate product name in same category returns 409 Conflict');

    // Case-insensitive duplicate name in same category
    const dupNameCaseSameCat = await request(
      'POST',
      '/api/products',
      {
        name: 'duplicate name product',
        categoryId: testCategoryId1,
        price: 60,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupNameCaseSameCat.status === 409, 'Case-insensitive duplicate name in same category returns 409 Conflict');

    // Same product name in a DIFFERENT category is ALLOWED
    const sameNameDiffCat = await request(
      'POST',
      '/api/products',
      {
        name: 'Duplicate Name Product',
        categoryId: testCategoryId2,
        price: 70,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(sameNameDiffCat.status === 201, 'Same product name in a different category is permitted (201)');

    // Duplicate barcode
    const dupBarcode = await request(
      'POST',
      '/api/products',
      {
        name: 'Barcode Clashing Product',
        categoryId: testCategoryId1,
        price: 80,
        barcode: 'BC-DUP-1',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupBarcode.status === 409, 'Duplicate barcode across products returns 409 Conflict');

    // Duplicate storeSku
    const dupSku = await request(
      'POST',
      '/api/products',
      {
        name: 'SKU Clashing Product',
        categoryId: testCategoryId1,
        price: 90,
        storeSku: 'SKU-DUP-1',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(dupSku.status === 409, 'Duplicate store SKU across products returns 409 Conflict');

    // 6. Retrieval & Filters
    console.log('\n--- 6. Retrieval & Filters ---');
    const getById = await request('GET', `/api/products/${createdProductId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getById.status === 200, 'GET /products/:id returns 200');
    assert(getById.data?.data?.id === createdProductId, 'Retrieved product ID matches');
    assert(getById.data?.data?.category?.id === testCategoryId1, 'Category relation included in response');

    const notFoundGet = await request(
      'GET',
      '/api/products/00000000-0000-0000-0000-000000000000',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundGet.status === 404, 'GET /products/:id with non-existent UUID returns 404');

    // List all
    const listAll = await request('GET', '/api/products', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listAll.status === 200, 'GET /products returns 200');
    assert(Array.isArray(listAll.data?.data?.items), 'Items returned as array');
    assert(listAll.data?.data?.pagination?.total >= 3, 'Pagination total accurate');

    // Filter by category
    const filterCat = await request('GET', `/api/products?categoryId=${testCategoryId2}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(filterCat.status === 200, 'GET /products?categoryId=... returns 200');
    assert(
      filterCat.data?.data?.items.every((p: any) => p.categoryId === testCategoryId2),
      'All filtered products match requested category'
    );

    // Filter by group
    const filterGroup = await request('GET', '/api/products?group=Female', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(filterGroup.status === 200, 'GET /products?group=Female returns 200');
    assert(
      filterGroup.data?.data?.items.every((p: any) => p.group === 'Female'),
      'All filtered products match group Female'
    );

    // Search by name
    const searchName = await request('GET', '/api/products?search=Spec', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchName.status === 200, 'GET /products?search=Spec returns 200');
    assert(
      searchName.data?.data?.items.some((p: any) => p.name === 'Full Spec Cream'),
      'Search finds product by partial name'
    );

    // Search by SKU
    const searchSku = await request('GET', '/api/products?search=SKU-FSC', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchSku.status === 200, 'GET /products?search=SKU-FSC returns 200');
    assert(
      searchSku.data?.data?.items.some((p: any) => p.storeSku === 'SKU-FSC-001'),
      'Search finds product by SKU'
    );

    // Pagination
    const paginationTest = await request('GET', '/api/products?limit=2&page=1', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(paginationTest.status === 200, 'GET /products?limit=2&page=1 returns 200');
    assert(paginationTest.data?.data?.items.length <= 2, 'Pagination limit respected');
    assert(paginationTest.data?.data?.pagination?.page === 1, 'Pagination page is 1');

    // 7. Update Operations
    console.log('\n--- 7. Update Operations ---');
    const updateRes = await request(
      'PUT',
      `/api/products/${createdProductId}`,
      {
        price: 549.0,
        salePrice: 499.0,
        position: 15,
        description: 'Updated description for cream',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateRes.status === 200, 'PUT /products/:id returns 200');
    assert(Number(updateRes.data?.data?.price) === 549, 'Product price updated');
    assert(Number(updateRes.data?.data?.salePrice) === 499, 'Product salePrice updated');
    assert(updateRes.data?.data?.position === 15, 'Product position updated');
    assert(updateRes.data?.data?.description === 'Updated description for cream', 'Description updated');

    // Update with conflicting barcode
    const updateConflictBarcode = await request(
      'PUT',
      `/api/products/${createdProductId}`,
      { barcode: 'BC-DUP-1' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateConflictBarcode.status === 409, 'Updating to an already used barcode returns 409');

    // Update with conflicting SKU
    const updateConflictSku = await request(
      'PUT',
      `/api/products/${createdProductId}`,
      { storeSku: 'SKU-DUP-1' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateConflictSku.status === 409, 'Updating to an already used store SKU returns 409');

    // 8. Status Toggle
    console.log('\n--- 8. Status Toggle ---');
    const deactivateRes = await request(
      'PATCH',
      `/api/products/${createdProductId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deactivateRes.status === 200, 'PATCH /products/:id/status (deactivate) returns 200');
    assert(deactivateRes.data?.data?.isActive === false, 'Product isActive is false');

    const activateRes = await request(
      'PATCH',
      `/api/products/${createdProductId}/status`,
      { isActive: true },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(activateRes.status === 200, 'PATCH /products/:id/status (activate) returns 200');
    assert(activateRes.data?.data?.isActive === true, 'Product isActive is true');

    // 9. Relational Integrity & Deletion
    console.log('\n--- 9. Relational Integrity & Deletion ---');
    // Create a special category and product to test delete restriction
    const delCat = await prisma.productCategory.create({
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Delete Restricted Category',
        position: 99,
      },
    });
    const delProd = await request(
      'POST',
      '/api/products',
      {
        name: 'Delete Target Product',
        categoryId: delCat.id,
        price: 25,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(delProd.status === 201, 'Target product for delete testing created');
    const delProdId = delProd.data?.data?.id;

    // Attempt to delete category containing products -> must fail due to onDelete: Restrict
    const delCatFail = await request(
      'DELETE',
      `/api/product-categories/${delCat.id}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(
      delCatFail.status === 409,
      'Deleting ProductCategory containing active products returns 409 Conflict with informative error'
    );

    // Delete product
    const delProdRes = await request('DELETE', `/api/products/${delProdId}`, undefined, {
      Authorization: `Bearer ${adminToken}` }
    );
    assert(delProdRes.status === 200, 'DELETE /products/:id returns 200');

    // Verify product is gone
    const verifyProdGone = await request('GET', `/api/products/${delProdId}`, undefined, {
      Authorization: `Bearer ${adminToken}` }
    );
    assert(verifyProdGone.status === 404, 'Product returns 404 after deletion');

    // Now deleting the empty category succeeds
    const delCatSuccess = await request(
      'DELETE',
      `/api/product-categories/${delCat.id}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(delCatSuccess.status === 200, 'Deleting empty ProductCategory succeeds after product deletion');

    // 10. RBAC Enforcement
    console.log('\n--- 10. RBAC Enforcement ---');
    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    receptionistToken = jwt.sign(
      { userId: recUser?.id, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    // Non-admin token presentation is rejected by authenticateJwt
    const recepList = await request('GET', '/api/products', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recepList.status === 401, 'Non-admin token rejected by authenticateJwt (401)');

    const recepGet = await request('GET', `/api/products/${createdProductId}`, undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recepGet.status === 401, 'Non-admin token rejected by authenticateJwt (401)');

    // Receptionist cannot create
    const recepCreate = await request(
      'POST',
      '/api/products',
      { name: 'RBAC Forbidden Product', categoryId: testCategoryId1, price: 10 },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepCreate.status === 401, 'Receptionist cannot create product (401 Unauthorized)');

    // Receptionist cannot update
    const recepUpdate = await request(
      'PUT',
      `/api/products/${createdProductId}`,
      { price: 999 },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepUpdate.status === 401, 'Receptionist cannot update product (401 Unauthorized)');

    // Receptionist cannot toggle status
    const recepStatus = await request(
      'PATCH',
      `/api/products/${createdProductId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepStatus.status === 401, 'Receptionist cannot toggle product status (401 Unauthorized)');

    // Receptionist cannot delete
    const recepDelete = await request(
      'DELETE',
      `/api/products/${createdProductId}`,
      undefined,
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(recepDelete.status === 401, 'Receptionist cannot delete product (401 Unauthorized)');

    // 11. Advanced Edge Cases & Negative Paths
    console.log('\n--- 11. Advanced Edge Cases & Negative Paths ---');
    const nonExistentUUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    // 11.1 Update non-existent product
    const updateNonExistent = await request(
      'PUT',
      `/api/products/${nonExistentUUID}`,
      { price: 99 },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateNonExistent.status === 404, 'PUT /products/:id on non-existent product returns 404');

    // 11.2 Delete non-existent product
    const deleteNonExistent = await request(
      'DELETE',
      `/api/products/${nonExistentUUID}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deleteNonExistent.status === 404, 'DELETE /products/:id on non-existent product returns 404');

    // 11.3 Status toggle non-existent product
    const statusNonExistent = await request(
      'PATCH',
      `/api/products/${nonExistentUUID}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(statusNonExistent.status === 404, 'PATCH /products/:id/status on non-existent product returns 404');

    // 11.4 Complimentary / Tester product with price = 0
    const zeroPriceProduct = await request(
      'POST',
      '/api/products',
      {
        name: 'Complimentary Tester Sachet',
        categoryId: testCategoryId1,
        price: 0,
        isRetail: false,
        hideFromCatalogue: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(zeroPriceProduct.status === 201, 'Product with price 0 (tester/complimentary) is permitted (201)');
    const zeroPriceId = zeroPriceProduct.data?.data?.id;

    // 11.5 Filter by isRetail = false
    const nonRetailList = await request(
      'GET',
      '/api/products?isRetail=false',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(nonRetailList.status === 200, 'GET /products?isRetail=false returns 200');
    assert(
      nonRetailList.data?.data?.items.some((p: any) => p.name === 'Complimentary Tester Sachet'),
      'isRetail=false filter includes backbar tester item'
    );

    // 11.6 Filter by hideFromCatalogue = true
    const hiddenList = await request(
      'GET',
      '/api/products?hideFromCatalogue=true',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(hiddenList.status === 200, 'GET /products?hideFromCatalogue=true returns 200');
    assert(
      hiddenList.data?.data?.items.every((p: any) => p.hideFromCatalogue === true),
      'hideFromCatalogue=true filter only includes hidden items'
    );

    // 11.7 Clear barcode to null
    const clearBarcodeRes = await request(
      'PUT',
      `/api/products/${createdProductId}`,
      { barcode: null },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(clearBarcodeRes.status === 200, 'Clearing barcode to null succeeds (200)');
    assert(clearBarcodeRes.data?.data?.barcode === null, 'Barcode is null after clear');

    // Clean up zero price tester
    if (zeroPriceId) {
      await request('DELETE', `/api/products/${zeroPriceId}`, undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
    }

    console.log('\n========================================');
    console.log(`   PRODUCTS TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
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
