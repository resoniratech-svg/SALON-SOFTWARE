import { prisma } from '../src/config/database.js';

const BASE_URL = 'http://localhost:5000';

interface StepResult {
  step: string;
  name: string;
  method: string;
  endpoint: string;
  status: number;
  expectedStatus: number;
  passed: boolean;
  notes?: string;
}

const results: StepResult[] = [];

async function request(method: string, path: string, body?: any, headers?: Record<string, string>) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }
  return { status: res.status, data };
}

function record(step: string, name: string, method: string, endpoint: string, status: number, expectedStatus: number, condition: boolean, notes?: string) {
  const passed = status === expectedStatus && condition;
  results.push({ step, name, method, endpoint, status, expectedStatus, passed, notes });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${step}] ${name.padEnd(38)} | ${method} ${endpoint.padEnd(35)} | HTTP ${status} (expected ${expectedStatus}) | ${mark} ${notes ? `(${notes})` : ''}`);
}

async function runChecklist() {
  console.log('================================================================');
  console.log('      QUBEXE SALOON SOFTWARE — 33-STEP EXECUTION & VALIDATION CHECKLIST       ');
  console.log('================================================================\n');

  let tokenA = '';
  let tokenB = '';
  let tokenReceptionist = '';
  let tenantIdA = '';
  let categoryId = '';
  let productId = '';
  let disposableId = '';

  // Clean up previous runs
  await prisma.disposable.deleteMany({
    where: { name: { in: ['Checklist Disposable 1', 'Checklist Vinyl Gloves', 'Checklist Vinyl Gloves Nitrile', 'Hacked Disposable'] } },
  });
  await prisma.product.deleteMany({
    where: { name: { in: ['Checklist Hair Wax', 'Checklist Hair Wax Premium', 'Tenant Spoofing Probe', 'Duplicate SKU Product', 'Duplicate Barcode Product', 'Hacked by Tenant B'] } },
  });
  await prisma.productCategory.deleteMany({
    where: { name: { in: ['Checklist Cat Alpha'] } },
  });

  // -------------------------------------------------------------------------
  // SECTION 1: BASE WORKFLOW (Admin Tenant A)
  // -------------------------------------------------------------------------
  console.log('--- Base Workflow (Admin Tenant A) ---');

  // 01 Login - Admin Tenant A
  const res01 = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'DevelopmentPassword123!',
  });
  tokenA = res01.data?.data?.token || '';
  record('01', 'Login - Admin Tenant A', 'POST', '/api/auth/login', res01.status, 200, !!tokenA, 'Token acquired');

  // 02 Auth Me
  const res02 = await request('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${tokenA}` });
  tenantIdA = res02.data?.data?.tenantId || '';
  record('02', 'Auth Me', 'GET', '/api/auth/me', res02.status, 200, res02.data?.data?.username === 'admin', `Tenant: ${tenantIdA}`);

  // 03 Create Product Category
  const res03 = await request('POST', '/api/product-categories', {
    name: 'Checklist Cat Alpha',
    group: 'Both',
    position: 1,
  }, { Authorization: `Bearer ${tokenA}` });
  categoryId = res03.data?.data?.id || '';
  record('03', 'Create Product Category', 'POST', '/api/product-categories', res03.status, 201, !!categoryId, `Cat ID: ${categoryId}`);

  // 04 Create Product
  const res04 = await request('POST', '/api/products', {
    categoryId,
    name: 'Checklist Hair Wax',
    price: 450,
    salePrice: 399,
    storeSku: 'CHK-SKU-001',
    barcode: '8901234567890',
    isRetail: true,
    group: 'Both',
  }, { Authorization: `Bearer ${tokenA}` });
  productId = res04.data?.data?.id || '';
  record('04', 'Create Product', 'POST', '/api/products', res04.status, 201, !!productId, `Product ID: ${productId}`);

  // 05 Get Products
  const res05 = await request('GET', '/api/products', undefined, { Authorization: `Bearer ${tokenA}` });
  const hasProdInList = Array.isArray(res05.data?.data?.items) && res05.data.data.items.some((p: any) => p.id === productId);
  record('05', 'Get Products', 'GET', '/api/products', res05.status, 200, hasProdInList, `Items count: ${res05.data?.data?.items?.length}`);

  // 06 Get Product
  const res06 = await request('GET', `/api/products/${productId}`, undefined, { Authorization: `Bearer ${tokenA}` });
  record('06', 'Get Product', 'GET', `/api/products/${productId}`, res06.status, 200, res06.data?.data?.id === productId, `Fetched: ${res06.data?.data?.name}`);

  // 07 Update Product
  const res07 = await request('PUT', `/api/products/${productId}`, {
    name: 'Checklist Hair Wax Premium',
    price: 500,
  }, { Authorization: `Bearer ${tokenA}` });
  record('07', 'Update Product', 'PUT', `/api/products/${productId}`, res07.status, 200, res07.data?.data?.name === 'Checklist Hair Wax Premium', 'Name updated');

  // 08 Product Status
  const res08 = await request('PATCH', `/api/products/${productId}/status`, {
    isActive: false,
  }, { Authorization: `Bearer ${tokenA}` });
  const statusDeactivated = res08.data?.data?.isActive === false;
  // Restore status back to true
  await request('PATCH', `/api/products/${productId}/status`, { isActive: true }, { Authorization: `Bearer ${tokenA}` });
  record('08', 'Product Status', 'PATCH', `/api/products/${productId}/status`, res08.status, 200, statusDeactivated, 'isActive toggled false->true');

  // 09 Create Disposable
  const res09 = await request('POST', '/api/disposables', {
    name: 'Checklist Vinyl Gloves',
    categoryId,
    price: 150,
    code: 'CHK-DISP-001',
    barcode: '8901234567999',
    quantity: 100,
    unit: 'pcs',
  }, { Authorization: `Bearer ${tokenA}` });
  disposableId = res09.data?.data?.id || '';
  record('09', 'Create Disposable', 'POST', '/api/disposables', res09.status, 201, !!disposableId, `Disp ID: ${disposableId}`);

  // 10 Get Disposables
  const res10 = await request('GET', '/api/disposables', undefined, { Authorization: `Bearer ${tokenA}` });
  const hasDispInList = Array.isArray(res10.data?.data?.items) && res10.data.data.items.some((d: any) => d.id === disposableId);
  record('10', 'Get Disposables', 'GET', '/api/disposables', res10.status, 200, hasDispInList, `Items count: ${res10.data?.data?.items?.length}`);

  // 11 Get Disposable
  const res11 = await request('GET', `/api/disposables/${disposableId}`, undefined, { Authorization: `Bearer ${tokenA}` });
  record('11', 'Get Disposable', 'GET', `/api/disposables/${disposableId}`, res11.status, 200, res11.data?.data?.id === disposableId, `Fetched: ${res11.data?.data?.name}`);

  // 12 Update Disposable
  const res12 = await request('PUT', `/api/disposables/${disposableId}`, {
    name: 'Checklist Vinyl Gloves Nitrile',
    price: 180,
  }, { Authorization: `Bearer ${tokenA}` });
  record('12', 'Update Disposable', 'PUT', `/api/disposables/${disposableId}`, res12.status, 200, res12.data?.data?.name === 'Checklist Vinyl Gloves Nitrile', 'Name updated');

  // -------------------------------------------------------------------------
  // SECTION 2: SAAS MULTI-TENANT ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- SaaS ---');

  // 13 Login - Admin Tenant B
  const res13 = await request('POST', '/api/auth/login', {
    username: 'admin-b',
    password: 'DevelopmentPassword123!',
  });
  tokenB = res13.data?.data?.token || '';
  record('13', 'Login - Admin Tenant B', 'POST', '/api/auth/login', res13.status, 200, !!tokenB, 'Tenant B token acquired');

  // 14 Tenant B -> Get Tenant A Product
  const res14 = await request('GET', `/api/products/${productId}`, undefined, { Authorization: `Bearer ${tokenB}` });
  record('14', 'Tenant B → Get Tenant A Product', 'GET', `/api/products/${productId}`, res14.status, 404, true, 'Properly isolated (404)');

  // 15 Tenant B -> Update Tenant A Product
  const res15 = await request('PUT', `/api/products/${productId}`, { name: 'Hacked by Tenant B' }, { Authorization: `Bearer ${tokenB}` });
  record('15', 'Tenant B → Update Tenant A Product', 'PUT', `/api/products/${productId}`, res15.status, 404, true, 'Properly blocked (404)');

  // 16 Tenant B -> Delete Tenant A Product
  const res16 = await request('DELETE', `/api/products/${productId}`, undefined, { Authorization: `Bearer ${tokenB}` });
  record('16', 'Tenant B → Delete Tenant A Product', 'DELETE', `/api/products/${productId}`, res16.status, 404, true, 'Properly blocked (404)');

  // 17 Tenant B -> Get Tenant A Disposable
  const res17 = await request('GET', `/api/disposables/${disposableId}`, undefined, { Authorization: `Bearer ${tokenB}` });
  record('17', 'Tenant B → Get Tenant A Disposable', 'GET', `/api/disposables/${disposableId}`, res17.status, 404, true, 'Properly isolated (404)');

  // 18 Tenant B -> Update Tenant A Disposable
  const res18 = await request('PUT', `/api/disposables/${disposableId}`, { name: 'Hacked Disposable' }, { Authorization: `Bearer ${tokenB}` });
  record('18', 'Tenant B → Update Tenant A Disposable', 'PUT', `/api/disposables/${disposableId}`, res18.status, 404, true, 'Properly blocked (404)');

  // 19 Tenant B -> Delete Tenant A Disposable
  const res19 = await request('DELETE', `/api/disposables/${disposableId}`, undefined, { Authorization: `Bearer ${tokenB}` });
  record('19', 'Tenant B → Delete Tenant A Disposable', 'DELETE', `/api/disposables/${disposableId}`, res19.status, 404, true, 'Properly blocked (404)');

  // 20 Tenant B -> List Products
  const res20 = await request('GET', '/api/products', undefined, { Authorization: `Bearer ${tokenB}` });
  const tenantBHasProductA = Array.isArray(res20.data?.data?.items) && res20.data.data.items.some((p: any) => p.id === productId);
  record('20', 'Tenant B → List Products', 'GET', '/api/products', res20.status, 200, !tenantBHasProductA, 'Tenant A product invisible in Tenant B');

  // 21 Tenant A -> List Products
  const res21 = await request('GET', '/api/products', undefined, { Authorization: `Bearer ${tokenA}` });
  const tenantAHasProductA = Array.isArray(res21.data?.data?.items) && res21.data.data.items.some((p: any) => p.id === productId);
  record('21', 'Tenant A → List Products', 'GET', '/api/products', res21.status, 200, tenantAHasProductA, 'Tenant A product visible in Tenant A');

  // -------------------------------------------------------------------------
  // SECTION 3: SECURITY
  // -------------------------------------------------------------------------
  console.log('\n--- Security ---');

  // 22 Tenant Spoofing
  const res22 = await request('POST', '/api/products', {
    tenantId: '00000000-0000-0000-0000-000000000002', // Attempt to spoof Tenant B
    categoryId,
    name: 'Tenant Spoofing Probe',
    price: 250,
    storeSku: 'CHK-SPOOF-99',
  }, { Authorization: `Bearer ${tokenA}` });
  const spoofedProduct = await prisma.product.findFirst({ where: { storeSku: 'CHK-SPOOF-99' } });
  const spoofPrevented = spoofedProduct?.tenantId === tenantIdA;
  record('22', 'Tenant Spoofing', 'POST', '/api/products', res22.status, 201, spoofPrevented, `Assigned to Tenant A (${tenantIdA})`);
  if (spoofedProduct) {
    await prisma.product.delete({ where: { id: spoofedProduct.id } });
  }

  // 23 No JWT
  const res23 = await request('GET', '/api/products');
  record('23', 'No JWT', 'GET', '/api/products', res23.status, 401, true, 'Unauthorized on missing token');

  // 24 Invalid JWT
  const res24 = await request('GET', '/api/products', undefined, { Authorization: 'Bearer invalid.token.signature' });
  record('24', 'Invalid JWT', 'GET', '/api/products', res24.status, 401, true, 'Unauthorized on forged token');

  // Receptionist Login for RBAC
  const recLogin = await request('POST', '/api/auth/login', {
    username: 'receptionist',
    password: 'DevelopmentPassword123!',
  });
  tokenReceptionist = recLogin.data?.data?.token || '';

  // 25 Receptionist READ
  const res25 = await request('GET', '/api/products', undefined, { Authorization: `Bearer ${tokenReceptionist}` });
  record('25', 'Receptionist READ', 'GET', '/api/products', res25.status, 200, true, 'PRODUCT:READ allowed (200)');

  // 26 Receptionist CREATE
  const res26 = await request('POST', '/api/products', {
    categoryId,
    name: 'Recep Attempt',
    price: 100,
  }, { Authorization: `Bearer ${tokenReceptionist}` });
  record('26', 'Receptionist CREATE', 'POST', '/api/products', res26.status, 403, true, 'PRODUCT:CREATE forbidden (403)');

  // 27 Receptionist UPDATE
  const res27 = await request('PUT', `/api/products/${productId}`, {
    name: 'Recep Update Attempt',
  }, { Authorization: `Bearer ${tokenReceptionist}` });
  record('27', 'Receptionist UPDATE', 'PUT', `/api/products/${productId}`, res27.status, 403, true, 'PRODUCT:UPDATE forbidden (403)');

  // 28 Receptionist DELETE
  const res28 = await request('DELETE', `/api/products/${productId}`, undefined, { Authorization: `Bearer ${tokenReceptionist}` });
  record('28', 'Receptionist DELETE', 'DELETE', `/api/products/${productId}`, res28.status, 403, true, 'PRODUCT:DELETE forbidden (403)');

  // -------------------------------------------------------------------------
  // SECTION 4: VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- Validation ---');

  // 29 Missing required fields
  const res29 = await request('POST', '/api/products', {}, { Authorization: `Bearer ${tokenA}` });
  record('29', 'Missing required fields', 'POST', '/api/products', res29.status, 400, true, 'Zod validation error (400)');

  // 30 Invalid ID
  const res30 = await request('GET', '/api/products/00000000-0000-0000-0000-999999999999', undefined, { Authorization: `Bearer ${tokenA}` });
  record('30', 'Invalid ID', 'GET', '/api/products/00000000-...-999999999999', res30.status, 404, true, 'Non-existent ID returns 404 Not Found');

  // 31 Duplicate SKU
  const res31 = await request('POST', '/api/products', {
    categoryId,
    name: 'Duplicate SKU Product',
    price: 199,
    storeSku: 'CHK-SKU-001', // Already belongs to Checklist Hair Wax
  }, { Authorization: `Bearer ${tokenA}` });
  record('31', 'Duplicate SKU', 'POST', '/api/products', res31.status, 409, true, 'Conflict on unique storeSku (409)');

  // 32 Duplicate Barcode
  const res32 = await request('POST', '/api/products', {
    categoryId,
    name: 'Duplicate Barcode Product',
    price: 199,
    storeSku: 'CHK-SKU-NEW',
    barcode: '8901234567890', // Already belongs to Checklist Hair Wax
  }, { Authorization: `Bearer ${tokenA}` });
  record('32', 'Duplicate Barcode', 'POST', '/api/products', res32.status, 409, true, 'Conflict on unique barcode (409)');

  // 33 Nonexistent Category
  const res33 = await request('POST', '/api/products', {
    categoryId: '00000000-0000-0000-0000-000000000999',
    name: 'Nonexistent Category Product',
    price: 199,
    storeSku: 'CHK-SKU-GHOST',
  }, { Authorization: `Bearer ${tokenA}` });
  record('33', 'Nonexistent Category', 'POST', '/api/products', res33.status, 400, true, 'Bad Request on missing category (400)');

  // -------------------------------------------------------------------------
  // CLEANUP & SUMMARY
  // -------------------------------------------------------------------------
  if (disposableId) {
    await prisma.disposable.delete({ where: { id: disposableId } });
  }
  if (productId) {
    await prisma.product.delete({ where: { id: productId } });
  }
  if (categoryId) {
    await prisma.productCategory.delete({ where: { id: categoryId } });
  }

  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`TOTAL: 33 | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runChecklist().catch(err => {
  console.error('Fatal checklist runner error:', err);
  process.exit(1);
});
