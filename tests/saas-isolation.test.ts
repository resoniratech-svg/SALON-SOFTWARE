import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';
import bcrypt from 'bcryptjs';

let server: http.Server;
let baseUrl: string;

let tokenTenantA: string;
let tokenTenantB: string;

const TENANT_A_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_B_ID = '22222222-2222-2222-2222-222222222222';

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
  console.log('\n======================================================');
  console.log('       QUBEXE SALOON SOFTWARE SaaS Multi-Tenant Isolation Tests      ');
  console.log('======================================================\n');

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
    // 0. Authenticate as Tenant A and Tenant B
    console.log('--- 1. Multi-Tenant Authentication & JWT Verification ---');
    const loginA = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(loginA.status === 200, 'Tenant A (admin) logs in successfully');
    tokenTenantA = loginA.data?.data?.token;
    assert(loginA.data?.data?.user?.tenantId === TENANT_A_ID, 'Tenant A JWT user has correct tenantId');

    const loginB = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    assert(loginB.status === 200, 'Tenant B (admin-b) logs in successfully');
    tokenTenantB = loginB.data?.data?.token;
    assert(loginB.data?.data?.user?.tenantId === TENANT_B_ID, 'Tenant B JWT user has correct tenantId');

    const meA = await request('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${tokenTenantA}` });
    assert(meA.status === 200 && meA.data?.data?.tenantId === TENANT_A_ID, '/api/auth/me reflects Tenant A');

    const meB = await request('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${tokenTenantB}` });
    assert(meB.status === 200 && meB.data?.data?.tenantId === TENANT_B_ID, '/api/auth/me reflects Tenant B');

    // Clean up previous test runs for isolation test items
    await prisma.service.deleteMany({
      where: { name: { in: ['Shared Name Service', 'Tenant A Exclusive Service', 'Tenant B Exclusive Service', 'Staff Mapped Service'] } },
    });
    const oldServiceCatIds = (await prisma.serviceCategory.findMany({
      where: { name: { in: ['Shared Hair Treatments', 'Tenant A Exclusive Cat', 'Tenant B Exclusive Cat'] } },
      select: { id: true },
    })).map((c) => c.id);
    if (oldServiceCatIds.length > 0) {
      await prisma.posOrderItem.deleteMany({
        where: { service: { categoryId: { in: oldServiceCatIds } } },
      });
      await prisma.serviceStaff.deleteMany({
        where: { service: { categoryId: { in: oldServiceCatIds } } },
      });
      await prisma.service.deleteMany({ where: { categoryId: { in: oldServiceCatIds } } });
    }
    await prisma.serviceCategory.deleteMany({
      where: { name: { in: ['Shared Hair Treatments', 'Tenant A Exclusive Cat', 'Tenant B Exclusive Cat'] } },
    });
    const oldCatIds = (await prisma.productCategory.findMany({
      where: { name: { in: ['Shared Prod Category', 'Tenant A Prod Cat', 'Tenant B Prod Cat'] } },
      select: { id: true },
    })).map((c) => c.id);
    if (oldCatIds.length > 0) {
      await prisma.disposable.deleteMany({ where: { categoryId: { in: oldCatIds } } });
      await prisma.product.deleteMany({ where: { categoryId: { in: oldCatIds } } });
    }
    await prisma.product.deleteMany({
      where: { name: { in: ['Shared Name Product', 'Tenant A Product', 'Tenant B Product'] } },
    });
    await prisma.disposable.deleteMany({
      where: { name: { in: ['Shared Disposable', 'Tenant A Disposable', 'Tenant B Disposable'] } },
    });
    await prisma.productCategory.deleteMany({
      where: { name: { in: ['Shared Prod Category', 'Tenant A Prod Cat', 'Tenant B Prod Cat'] } },
    });
    await prisma.staff.deleteMany({
      where: { name: { in: ['Tenant A Staff Member', 'Tenant B Staff Member'] } },
    });

    // -----------------------------------------------------------------------------------
    // 2. Service Categories SaaS Isolation
    // -----------------------------------------------------------------------------------
    console.log('\n--- 2. Service Categories SaaS Isolation ---');
    // 2.1 Tenant A creates category
    const catARes = await request(
      'POST',
      '/api/service-categories',
      { name: 'Tenant A Exclusive Cat', group: 'Both', position: 1 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(catARes.status === 201, 'Tenant A creates service category successfully');
    const catAId = catARes.data?.data?.id;

    // 2.2 Tenant B creates category
    const catBRes = await request(
      'POST',
      '/api/service-categories',
      { name: 'Tenant B Exclusive Cat', group: 'Both', position: 1 },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(catBRes.status === 201, 'Tenant B creates service category successfully');
    const catBId = catBRes.data?.data?.id;

    // 2.3 Cross-tenant GET by ID returns 404
    const aGetB = await request('GET', `/api/service-categories/${catBId}`, undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(aGetB.status === 404, 'Tenant A accessing Tenant B service category returns 404 Not Found');

    const bGetA = await request('GET', `/api/service-categories/${catAId}`, undefined, {
      Authorization: `Bearer ${tokenTenantB}`,
    });
    assert(bGetA.status === 404, 'Tenant B accessing Tenant A service category returns 404 Not Found');

    // 2.4 Cross-tenant list isolation
    const listA = await request('GET', '/api/service-categories', undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(
      listA.data?.data?.every((c: any) => c.id !== catBId && c.name !== 'Tenant B Exclusive Cat'),
      'Tenant A category list contains zero Tenant B records'
    );

    const listB = await request('GET', '/api/service-categories', undefined, {
      Authorization: `Bearer ${tokenTenantB}`,
    });
    assert(
      listB.data?.data?.every((c: any) => c.id !== catAId && c.name !== 'Tenant A Exclusive Cat'),
      'Tenant B category list contains zero Tenant A records'
    );

    // 2.5 Same name in different tenants succeeds without collision
    const dupNameCatA = await request(
      'POST',
      '/api/service-categories',
      { name: 'Shared Hair Treatments', group: 'Both' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(dupNameCatA.status === 201, 'Tenant A creates "Shared Hair Treatments" (201)');

    const dupNameCatB = await request(
      'POST',
      '/api/service-categories',
      { name: 'Shared Hair Treatments', group: 'Both' },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(dupNameCatB.status === 201, 'Tenant B creates "Shared Hair Treatments" with identical name without conflict (201)');

    // 2.6 Cross-tenant UPDATE returns 404
    const aUpdateB = await request(
      'PUT',
      `/api/service-categories/${catBId}`,
      { name: 'Hacked Category' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aUpdateB.status === 404, 'Tenant A updating Tenant B category returns 404 Not Found');

    // 2.7 Cross-tenant DELETE returns 404
    const aDeleteB = await request(
      'DELETE',
      `/api/service-categories/${catBId}`,
      undefined,
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aDeleteB.status === 404, 'Tenant A deleting Tenant B category returns 404 Not Found');

    // -----------------------------------------------------------------------------------
    // 3. Services SaaS Isolation & Boundary Checks
    // -----------------------------------------------------------------------------------
    console.log('\n--- 3. Services SaaS Isolation & Boundary Checks ---');
    // 3.1 Tenant A creates service
    const servARes = await request(
      'POST',
      '/api/services',
      { name: 'Tenant A Exclusive Service', categoryId: catAId, price: 100, durationMinutes: 30 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(servARes.status === 201, 'Tenant A creates service');
    const servAId = servARes.data?.data?.id;

    // 3.2 Tenant B creates service
    const servBRes = await request(
      'POST',
      '/api/services',
      { name: 'Tenant B Exclusive Service', categoryId: catBId, price: 150, durationMinutes: 45 },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(servBRes.status === 201, 'Tenant B creates service');
    const servBId = servBRes.data?.data?.id;

    // 3.3 Cross-tenant Service GET /:id returns 404
    const aGetServB = await request('GET', `/api/services/${servBId}`, undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(aGetServB.status === 404, 'Tenant A GET Tenant B service returns 404 Not Found');

    const bGetServA = await request('GET', `/api/services/${servAId}`, undefined, {
      Authorization: `Bearer ${tokenTenantB}`,
    });
    assert(bGetServA.status === 404, 'Tenant B GET Tenant A service returns 404 Not Found');

    // 3.4 Cross-tenant Category Association Blocked: Tenant A cannot link service to Tenant B's category
    const crossCatLink = await request(
      'POST',
      '/api/services',
      { name: 'Illicit Cross Link Service', categoryId: catBId, price: 50, durationMinutes: 15 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(crossCatLink.status === 400, 'Tenant A cannot link service to Tenant B category (returns 400 Bad Request)');

    // 3.5 Cross-tenant Service UPDATE returns 404
    const aUpdateServB = await request(
      'PUT',
      `/api/services/${servBId}`,
      { name: 'Compromised Name' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aUpdateServB.status === 404, 'Tenant A updating Tenant B service returns 404 Not Found');

    // 3.6 Cross-tenant Service status change returns 404
    const aStatusServB = await request(
      'PATCH',
      `/api/services/${servBId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aStatusServB.status === 404, 'Tenant A patching status of Tenant B service returns 404 Not Found');

    // 3.7 Cross-tenant Service DELETE returns 404
    const aDeleteServB = await request(
      'DELETE',
      `/api/services/${servBId}`,
      undefined,
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aDeleteServB.status === 404, 'Tenant A deleting Tenant B service returns 404 Not Found');

    // 3.8 Same service name in different tenants succeeds without collision
    const dupServA = await request(
      'POST',
      '/api/services',
      { name: 'Shared Name Service', categoryId: catAId, price: 200, durationMinutes: 60 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(dupServA.status === 201, 'Tenant A creates "Shared Name Service" (201)');

    const dupServB = await request(
      'POST',
      '/api/services',
      { name: 'Shared Name Service', categoryId: catBId, price: 250, durationMinutes: 60 },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(dupServB.status === 201, 'Tenant B creates "Shared Name Service" with same name without collision (201)');

    // -----------------------------------------------------------------------------------
    // 4. Product Categories & Products SaaS Isolation
    // -----------------------------------------------------------------------------------
    console.log('\n--- 4. Product Categories & Products SaaS Isolation ---');
    // 4.1 Product Categories creation
    const prodCatARes = await request(
      'POST',
      '/api/product-categories',
      { name: 'Tenant A Prod Cat', group: 'Both' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(prodCatARes.status === 201, 'Tenant A creates product category');
    const prodCatAId = prodCatARes.data?.data?.id;

    const prodCatBRes = await request(
      'POST',
      '/api/product-categories',
      { name: 'Tenant B Prod Cat', group: 'Both' },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(prodCatBRes.status === 201, 'Tenant B creates product category');
    const prodCatBId = prodCatBRes.data?.data?.id;

    // 4.2 Cross-tenant Product Category GET returns 404
    const aGetProdCatB = await request('GET', `/api/product-categories/${prodCatBId}`, undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(aGetProdCatB.status === 404, 'Tenant A GET Tenant B product category returns 404 Not Found');

    // 4.3 Products creation with identical SKU and Barcode across tenants
    const prodA = await request(
      'POST',
      '/api/products',
      {
        name: 'Shared Name Product',
        categoryId: prodCatAId,
        price: 50,
        storeSku: 'SKU-SHARED-TENANT-TEST',
        barcode: 'BARCODE-TENANT-TEST-12345',
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(prodA.status === 201, 'Tenant A creates product with SKU & barcode');
    const prodAId = prodA.data?.data?.id;

    const prodB = await request(
      'POST',
      '/api/products',
      {
        name: 'Shared Name Product',
        categoryId: prodCatBId,
        price: 75,
        storeSku: 'SKU-SHARED-TENANT-TEST',
        barcode: 'BARCODE-TENANT-TEST-12345',
      },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(prodB.status === 201, 'Tenant B creates product with IDENTICAL name, SKU, and barcode without conflict (201)');
    const prodBId = prodB.data?.data?.id;

    // 4.4 Cross-tenant Product GET returns 404
    const aGetProdB = await request('GET', `/api/products/${prodBId}`, undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(aGetProdB.status === 404, 'Tenant A GET Tenant B product returns 404 Not Found');

    // 4.5 Cross-tenant Product UPDATE returns 404
    const aUpdateProdB = await request(
      'PUT',
      `/api/products/${prodBId}`,
      { name: 'Overwritten Product' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aUpdateProdB.status === 404, 'Tenant A PUT Tenant B product returns 404 Not Found');

    // 4.6 Cross-tenant Product DELETE returns 404
    const aDeleteProdB = await request(
      'DELETE',
      `/api/products/${prodBId}`,
      undefined,
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aDeleteProdB.status === 404, 'Tenant A DELETE Tenant B product returns 404 Not Found');

    // 4.7 Cross-tenant Product to ProductCategory link blocked: Tenant A cannot link product to Tenant B's category
    const crossProdCatLink = await request(
      'POST',
      '/api/products',
      { name: 'Cross Cat Product Test', categoryId: prodCatBId, price: 30 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(crossProdCatLink.status === 400, 'Tenant A linking product to Tenant B category fails (400 Bad Request)');

    // -----------------------------------------------------------------------------------
    // 5. Disposables SaaS Isolation
    // -----------------------------------------------------------------------------------
    console.log('\n--- 5. Disposables SaaS Isolation ---');
    // 5.1 Create disposables with identical code and barcode across tenants
    const dispA = await request(
      'POST',
      '/api/disposables',
      {
        name: 'Shared Disposable',
        code: 'DISP-CODE-101',
        barcode: 'DISP-BARCODE-999',
        category: 'Disposables',
        categoryId: prodCatAId,
        price: 10,
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(dispA.status === 201, 'Tenant A creates disposable');
    const dispAId = dispA.data?.data?.id;

    const dispB = await request(
      'POST',
      '/api/disposables',
      {
        name: 'Shared Disposable',
        code: 'DISP-CODE-101',
        barcode: 'DISP-BARCODE-999',
        category: 'Disposables',
        categoryId: prodCatBId,
        price: 15,
      },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(dispB.status === 201, 'Tenant B creates disposable with identical name, code & barcode (201)');
    const dispBId = dispB.data?.data?.id;

    // 5.2 Cross-tenant Disposable GET returns 404
    const aGetDispB = await request('GET', `/api/disposables/${dispBId}`, undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(aGetDispB.status === 404, 'Tenant A GET Tenant B disposable returns 404 Not Found');

    // 5.3 Cross-tenant Disposable UPDATE returns 404
    const aUpdateDispB = await request(
      'PUT',
      `/api/disposables/${dispBId}`,
      { name: 'Modified Disposable' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aUpdateDispB.status === 404, 'Tenant A PUT Tenant B disposable returns 404 Not Found');

    // 5.4 Cross-tenant Disposable DELETE returns 404
    const aDeleteDispB = await request(
      'DELETE',
      `/api/disposables/${dispBId}`,
      undefined,
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aDeleteDispB.status === 404, 'Tenant A DELETE Tenant B disposable returns 404 Not Found');

    // 5.5 Tenant A cannot link disposable to Tenant B product category
    const crossDispCatLink = await request(
      'POST',
      '/api/disposables',
      { name: 'Invalid Link Disposable', categoryId: prodCatBId, price: 20 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(crossDispCatLink.status === 400, 'Tenant A linking disposable to Tenant B category fails (400 Bad Request)');

    // -----------------------------------------------------------------------------------
    // 6. Staff SaaS Isolation
    // -----------------------------------------------------------------------------------
    console.log('\n--- 6. Staff SaaS Isolation ---');
    // Fetch designations for Tenant A and Tenant B
    const desListA = await request('GET', '/api/staff/meta/designations', undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    const desListB = await request('GET', '/api/staff/meta/designations', undefined, {
      Authorization: `Bearer ${tokenTenantB}`,
    });
    assert(desListA.status === 200 && desListA.data?.data?.length > 0, 'Tenant A has designations');
    assert(desListB.status === 200 && desListB.data?.data?.length > 0, 'Tenant B has designations');
    const desAId = desListA.data?.data?.[0]?.id;
    const desBId = desListB.data?.data?.[0]?.id;

    // 6.1 Create staff in Tenant A and Tenant B with identical employeeNumber
    const staffA = await request(
      'POST',
      '/api/staff',
      {
        personalDetails: { firstName: 'Tenant A', lastName: 'Staff Member', mobile: '9100000001' },
        joiningDetails: { joiningDate: '2026-01-01', designationId: desAId, employeeNumber: 'EMP-SAAS-001', workingHours: '8' },
        bankDetails: { bankName: 'HDFC Bank', branch: 'Branch A', accountNumber: '1234567890', ifsc: 'HDFC0001234' },
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(staffA.status === 201, 'Tenant A creates staff member');
    const staffAId = staffA.data?.data?.id;

    const staffB = await request(
      'POST',
      '/api/staff',
      {
        personalDetails: { firstName: 'Tenant B', lastName: 'Staff Member', mobile: '9200000001' },
        joiningDetails: { joiningDate: '2026-01-01', designationId: desBId, employeeNumber: 'EMP-SAAS-001', workingHours: '8' },
        bankDetails: { bankName: 'ICICI Bank', branch: 'Branch B', accountNumber: '9876543210', ifsc: 'ICIC0005678' },
      },
      { Authorization: `Bearer ${tokenTenantB}` }
    );
    assert(staffB.status === 201, 'Tenant B creates staff member with IDENTICAL employeeNumber (201)');
    const staffBId = staffB.data?.data?.id;

    // 6.2 Cross-tenant Staff GET profile returns 404
    const aGetStaffB = await request('GET', `/api/staff/${staffBId}`, undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(aGetStaffB.status === 404, 'Tenant A GET Tenant B staff returns 404 Not Found');

    // 6.3 Cross-tenant Staff UPDATE returns 404
    const aUpdateStaffB = await request(
      'PUT',
      `/api/staff/${staffBId}`,
      { personalDetails: { firstName: 'Hacked' } },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aUpdateStaffB.status === 404, 'Tenant A PUT Tenant B staff returns 404 Not Found');

    // 6.4 Cross-tenant Staff STATUS update returns 404
    const aStatusStaffB = await request(
      'PATCH',
      `/api/staff/${staffBId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(aStatusStaffB.status === 404, 'Tenant A PATCH status of Tenant B staff returns 404 Not Found');

    // 6.5 Cross-tenant Designation association blocked
    const crossDesLink = await request(
      'POST',
      '/api/staff',
      {
        personalDetails: { firstName: 'Cross', lastName: 'Desig', mobile: '9300000001' },
        joiningDetails: { joiningDate: '2026-01-01', designationId: desBId, employeeNumber: 'EMP-SAAS-002', workingHours: '8' },
        bankDetails: { bankName: 'SBI Bank', branch: 'Branch C', accountNumber: '1122334455', ifsc: 'SBIN0001122' },
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(crossDesLink.status === 400, 'Tenant A linking staff to Tenant B designation fails (400 Bad Request)');

    // -----------------------------------------------------------------------------------
    // 7. Cross-Tenant Staff Mapping to Service (CREATE & UPDATE)
    // -----------------------------------------------------------------------------------
    console.log('\n--- 7. Cross-Tenant Staff Mapping to Service (CREATE & UPDATE) ---');
    // 7.1 Tenant A creates service referencing Tenant B staff -> must return 400 Bad Request
    const crossStaffCreate = await request(
      'POST',
      '/api/services',
      {
        name: 'Illegal Staff Mapped Service',
        categoryId: catAId,
        price: 120,
        durationMinutes: 45,
        staffIds: [staffBId],
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(crossStaffCreate.status === 400, 'Tenant A creating service referencing Tenant B staff fails (400 Bad Request)');

    // 7.2 Tenant A creates service with its own staff
    const validStaffService = await request(
      'POST',
      '/api/services',
      {
        name: 'Staff Mapped Service',
        categoryId: catAId,
        price: 120,
        durationMinutes: 45,
        staffIds: [staffAId],
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(validStaffService.status === 201, 'Tenant A creates service with its own staff (201)');
    const validStaffServiceId = validStaffService.data?.data?.id;

    // 7.3 Tenant A updates service attempting to add Tenant B staff -> must return 400 Bad Request
    const crossStaffUpdate = await request(
      'PUT',
      `/api/services/${validStaffServiceId}`,
      { staffIds: [staffBId] },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(crossStaffUpdate.status === 400, 'Tenant A updating service to map Tenant B staff fails (400 Bad Request)');

    // -----------------------------------------------------------------------------------
    // 8. Database-Level Composite Foreign Key Integrity Verification
    // -----------------------------------------------------------------------------------
    console.log('\n--- 8. Database-Level Composite Foreign Key Integrity Verification ---');
    // 8.1 Attempt direct DB insert of Service with Tenant A tenantId and Tenant B categoryId
    let dbFkServiceError: any = null;
    try {
      await prisma.service.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Direct DB FK Violation Service',
          categoryId: catBId, // Belongs to Tenant B
          price: 100,
        },
      });
    } catch (e: any) {
      dbFkServiceError = e;
    }
    assert(
      !!dbFkServiceError && dbFkServiceError.message.includes('Foreign key constraint violated'),
      'Database rejects cross-tenant Service -> ServiceCategory link via composite FK constraint'
    );

    // 8.2 Attempt direct DB insert of Product with Tenant A tenantId and Tenant B categoryId
    let dbFkProdError: any = null;
    try {
      await prisma.product.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Direct DB FK Violation Product',
          categoryId: prodCatBId, // Belongs to Tenant B
          price: 50,
        },
      });
    } catch (e: any) {
      dbFkProdError = e;
    }
    assert(
      !!dbFkProdError && dbFkProdError.message.includes('Foreign key constraint violated'),
      'Database rejects cross-tenant Product -> ProductCategory link via composite FK constraint'
    );

    // 8.3 Attempt direct DB insert of Disposable with Tenant A tenantId and Tenant B categoryId
    let dbFkDispError: any = null;
    try {
      await prisma.disposable.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Direct DB FK Violation Disposable',
          categoryId: prodCatBId, // Belongs to Tenant B
          price: 20,
        },
      });
    } catch (e: any) {
      dbFkDispError = e;
    }
    assert(
      !!dbFkDispError && dbFkDispError.message.includes('Foreign key constraint violated'),
      'Database rejects cross-tenant Disposable -> ProductCategory link via composite FK constraint'
    );

    // -----------------------------------------------------------------------------------
    // 9. Inactive Tenant Protection & Real-time Invalidation
    // -----------------------------------------------------------------------------------
    console.log('\n--- 9. Inactive Tenant Protection & Real-time Invalidation ---');
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });

    // 9.1 Create an inactive tenant and a user under it
    const inactiveTenant = await prisma.tenant.create({
      data: {
        name: 'Inactive Salon Corporation',
        code: 'inactive-salon-test',
        isActive: false,
      },
    });

    const salt = await bcrypt.genSalt(10);
    const pwdHash = await bcrypt.hash('TestPassword123!', salt);
    await prisma.user.create({
      data: {
        tenantId: inactiveTenant.id,
        username: 'inactive-tenant-admin',
        passwordHash: pwdHash,
        roleId: adminRole!.id,
      },
    });

    // Attempt login with user of inactive tenant
    const inactiveLogin = await request('POST', '/api/auth/login', {
      username: 'inactive-tenant-admin',
      password: 'TestPassword123!',
    });
    assert(inactiveLogin.status === 401, 'Login for user of inactive tenant rejected (HTTP 401)');
    assert(
      inactiveLogin.data?.message?.includes('Tenant organization is inactive or suspended'),
      'Login error explicitly states tenant is inactive or suspended'
    );

    // 9.2 Create an active tenant, login, acquire token, then deactivate tenant
    const tempActiveTenant = await prisma.tenant.create({
      data: {
        name: 'Dynamic Deactivation Salon',
        code: 'dynamic-deact-test',
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        tenantId: tempActiveTenant.id,
        username: 'dynamic-deact-admin',
        passwordHash: pwdHash,
        roleId: adminRole!.id,
      },
    });

    const dynamicLogin = await request('POST', '/api/auth/login', {
      username: 'dynamic-deact-admin',
      password: 'TestPassword123!',
    });
    assert(dynamicLogin.status === 200, 'Login for dynamic test tenant succeeds (200)');
    const dynamicToken = dynamicLogin.data?.data?.token;

    // Call protected endpoint while active
    const activeReq = await request('GET', '/api/service-categories', undefined, {
      Authorization: `Bearer ${dynamicToken}`,
    });
    assert(activeReq.status === 200, 'Authenticated request succeeds while tenant is active');

    // Deactivate tenant in database
    await prisma.tenant.update({
      where: { id: tempActiveTenant.id },
      data: { isActive: false },
    });

    // Call protected endpoint after tenant deactivated
    const deactReq = await request('GET', '/api/service-categories', undefined, {
      Authorization: `Bearer ${dynamicToken}`,
    });
    assert(deactReq.status === 401, 'Request rejected with 401 immediately after tenant is deactivated');
    assert(
      deactReq.data?.message?.includes('Tenant organization is inactive or suspended'),
      'Middleware confirms tenant organization is inactive or suspended'
    );

    // Clean up test tenants
    await prisma.user.deleteMany({ where: { tenantId: { in: [inactiveTenant.id, tempActiveTenant.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [inactiveTenant.id, tempActiveTenant.id] } } });

    // -----------------------------------------------------------------------------------
    // 10. Multi-Module Tenant Spoofing Prevention
    // -----------------------------------------------------------------------------------
    console.log('\n--- 10. Multi-Module Tenant Spoofing Prevention ---');
    // 10.1 Service Category spoofing
    const scSpoof = await request(
      'POST',
      '/api/service-categories',
      { tenantId: TENANT_B_ID, name: 'Spoof Cat Test' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(scSpoof.status === 201, 'Service Category create with spoofed tenantId succeeds');
    const scSpoofId = scSpoof.data?.data?.id;
    const scDb = await prisma.serviceCategory.findUnique({ where: { id: scSpoofId } });
    assert(scDb?.tenantId === TENANT_A_ID, 'Service Category tenant_id strictly matches JWT (Tenant A)');

    // 10.2 Product Category spoofing
    const pcSpoof = await request(
      'POST',
      '/api/product-categories',
      { tenantId: TENANT_B_ID, name: 'Spoof ProdCat Test' },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(pcSpoof.status === 201, 'Product Category create with spoofed tenantId succeeds');
    const pcSpoofId = pcSpoof.data?.data?.id;
    const pcDb = await prisma.productCategory.findUnique({ where: { id: pcSpoofId } });
    assert(pcDb?.tenantId === TENANT_A_ID, 'Product Category tenant_id strictly matches JWT (Tenant A)');

    // 10.3 Product spoofing
    const prodSpoof = await request(
      'POST',
      '/api/products',
      { tenantId: TENANT_B_ID, name: 'Spoof Prod Test', categoryId: prodCatAId, price: 50 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(prodSpoof.status === 201, 'Product create with spoofed tenantId succeeds');
    const prodSpoofId = prodSpoof.data?.data?.id;
    const prodDb = await prisma.product.findUnique({ where: { id: prodSpoofId } });
    assert(prodDb?.tenantId === TENANT_A_ID, 'Product tenant_id strictly matches JWT (Tenant A)');

    // 10.4 Disposable spoofing
    const dispSpoof = await request(
      'POST',
      '/api/disposables',
      { tenantId: TENANT_B_ID, name: 'Spoof Disp Test', categoryId: prodCatAId, price: 10 },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(dispSpoof.status === 201, 'Disposable create with spoofed tenantId succeeds');
    const dispSpoofId = dispSpoof.data?.data?.id;
    const dispDb = await prisma.disposable.findUnique({ where: { id: dispSpoofId } });
    assert(dispDb?.tenantId === TENANT_A_ID, 'Disposable tenant_id strictly matches JWT (Tenant A)');

    // 10.5 Staff spoofing
    const staffSpoof = await request(
      'POST',
      '/api/staff',
      {
        tenantId: TENANT_B_ID,
        personalDetails: { firstName: 'Spoof', lastName: 'Staff', mobile: '9400000001' },
        joiningDetails: { joiningDate: '2026-01-01', designationId: desAId, employeeNumber: 'EMP-SPOOF-01', workingHours: '8' },
        bankDetails: { bankName: 'Axis Bank', branch: 'Branch D', accountNumber: '9988776655', ifsc: 'UTIB0001234' },
      },
      { Authorization: `Bearer ${tokenTenantA}` }
    );
    assert(staffSpoof.status === 201, 'Staff create with spoofed tenantId succeeds');
    const staffSpoofId = staffSpoof.data?.data?.id;
    const staffDb = await prisma.staff.findUnique({ where: { id: staffSpoofId } });
    assert(staffDb?.tenantId === TENANT_A_ID, 'Staff tenant_id strictly matches JWT (Tenant A)');

    // Clean up spoofed entities
    await prisma.staff.delete({ where: { id: staffSpoofId } });
    await prisma.disposable.delete({ where: { id: dispSpoofId } });
    await prisma.product.delete({ where: { id: prodSpoofId } });
    await prisma.productCategory.delete({ where: { id: pcSpoofId } });
    await prisma.serviceCategory.delete({ where: { id: scSpoofId } });

    // -----------------------------------------------------------------------------------
    // 11. Search, Filter, Pagination, and Count Isolation Verification
    // -----------------------------------------------------------------------------------
    console.log('\n--- 11. Search, Filter, Pagination, and Count Isolation ---');
    // Search Services
    const searchServA = await request('GET', '/api/services?search=Exclusive', undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(
      searchServA.data?.data?.every((s: any) => s.name.includes('Tenant A') && !s.name.includes('Tenant B')),
      'Tenant A service search returns only Tenant A records'
    );

    // Search Products
    const searchProdA = await request('GET', '/api/products?search=Shared', undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    assert(
      searchProdA.data?.data?.items?.length === 1 && searchProdA.data?.data?.items[0].id === prodAId,
      'Tenant A product search returns exactly 1 item belonging to Tenant A'
    );

    const searchProdB = await request('GET', '/api/products?search=Shared', undefined, {
      Authorization: `Bearer ${tokenTenantB}`,
    });
    assert(
      searchProdB.data?.data?.items?.length === 1 && searchProdB.data?.data?.items[0].id === prodBId,
      'Tenant B product search returns exactly 1 item belonging to Tenant B'
    );

    // Count / Pagination verification for Disposables
    const dispListA = await request('GET', '/api/disposables', undefined, {
      Authorization: `Bearer ${tokenTenantA}`,
    });
    const dbCountDispA = await prisma.disposable.count({ where: { tenantId: TENANT_A_ID } });
    assert(
      dispListA.data?.data?.pagination?.total === dbCountDispA,
      'Tenant A disposable total matches exact database count for Tenant A'
    );

    console.log('\n======================================================');
    console.log(`   SAAS ISOLATION TEST FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error in SaaS isolation test suite:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
