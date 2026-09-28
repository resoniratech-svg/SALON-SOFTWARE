import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let cashierToken: string;
let tenantAId: string;
let tenantBId: string;

let testProductA: any;
let testProductB: any;
let testProductLowStock: any;
let testDisposableA: any;

let passed = 0;
let failed = 0;

export interface TestResultEntry {
  id: string;
  module: string;
  scenario: string;
  steps: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  bug?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fix?: string;
}

export const detailedTestLog: TestResultEntry[] = [];

function recordTest(entry: TestResultEntry) {
  detailedTestLog.push(entry);
  if (entry.status === 'PASS') {
    passed++;
    console.log(`  [PASS] ${entry.id}: ${entry.scenario}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${entry.id}: ${entry.scenario} - ${entry.actual}`);
  }
}

async function request(
  method: string,
  endpoint: string,
  body?: any,
  token?: string,
  query?: Record<string, string>
) {
  let url = `${baseUrl}${endpoint}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  let text: string = '';

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    text = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
    text,
  };
}

export async function runInventoryTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Inventory & Stock Management Module Complete Test Suite');
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

  try {
    // -------------------------------------------------------------
    // 1. SETUP & AUTHENTICATION
    // -------------------------------------------------------------
    console.log('--- 1. Authentication & Setup ---');

    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;
    recordTest({
      id: 'INV-AUTH-01',
      module: 'Authentication',
      scenario: 'Admin Tenant A Login',
      steps: 'POST /api/auth/login with Tenant A admin credentials',
      expected: 'Status 200 OK and valid JWT token returned',
      actual: `Status ${adminALogin.status}`,
      status: adminALogin.status === 200 && !!adminAToken ? 'PASS' : 'FAIL',
    });

    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;
    recordTest({
      id: 'INV-AUTH-02',
      module: 'Authentication',
      scenario: 'Admin Tenant B Login (Multi-tenant check)',
      steps: 'POST /api/auth/login with Tenant B admin credentials',
      expected: 'Status 200 OK and separate tenant ID returned',
      actual: `Status ${adminBLogin.status}, TenantB: ${tenantBId}`,
      status: adminBLogin.status === 200 && tenantBId !== tenantAId ? 'PASS' : 'FAIL',
    });

    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    cashierToken = cashierLogin.data?.data?.token;
    recordTest({
      id: 'INV-AUTH-03',
      module: 'Authentication',
      scenario: 'Cashier Login',
      steps: 'POST /api/auth/login with cashier credentials',
      expected: 'Status 200 OK',
      actual: `Status ${cashierLogin.status}`,
      status: cashierLogin.status === 200 ? 'PASS' : 'FAIL',
    });

    // Seed test master data
    let catA = await prisma.productCategory.findFirst({ where: { tenantId: tenantAId } });
    if (!catA) {
      catA = await prisma.productCategory.create({
        data: { tenantId: tenantAId, name: 'Hair Care' },
      });
    }

    testProductA = await prisma.product.findFirst({ where: { tenantId: tenantAId, name: 'Loreal Serie Expert Shampoo' } });
    if (!testProductA) {
      testProductA = await prisma.product.create({
        data: {
          tenantId: tenantAId,
          categoryId: catA.id,
          name: 'Loreal Serie Expert Shampoo',
          barcode: 'BAR-LOREAL-01',
          price: 950,
          isActive: true,
        },
      });
    }

    testProductLowStock = await prisma.product.findFirst({ where: { tenantId: tenantAId, name: 'Keratin Smooth Serum Low Stock' } });
    if (!testProductLowStock) {
      testProductLowStock = await prisma.product.create({
        data: {
          tenantId: tenantAId,
          categoryId: catA.id,
          name: 'Keratin Smooth Serum Low Stock',
          barcode: 'BAR-KERATIN-LOW',
          price: 1200,
          isActive: true,
        },
      });
    }

    let catB = await prisma.productCategory.findFirst({ where: { tenantId: tenantBId } });
    if (!catB) {
      catB = await prisma.productCategory.create({
        data: { tenantId: tenantBId, name: 'Spa Care' },
      });
    }

    testProductB = await prisma.product.findFirst({ where: { tenantId: tenantBId, name: 'Tenant B Oil' } });
    if (!testProductB) {
      testProductB = await prisma.product.create({
        data: {
          tenantId: tenantBId,
          categoryId: catB.id,
          name: 'Tenant B Oil',
          barcode: 'BAR-TENANTB-01',
          price: 500,
          isActive: true,
        },
      });
    }

    testDisposableA = await prisma.disposable.findFirst({ where: { tenantId: tenantAId } });
    if (!testDisposableA) {
      testDisposableA = await prisma.disposable.create({
        data: {
          tenantId: tenantAId,
          name: 'Cotton Pads 100pk',
          price: 150,
          unit: 'pcs',
        },
      });
    }

    // -------------------------------------------------------------
    // 2. INVENTORY DASHBOARD
    // -------------------------------------------------------------
    console.log('\n--- 2. Inventory Dashboard ---');

    const dashRes = await request('GET', '/api/inventory/dashboard', undefined, adminAToken);
    recordTest({
      id: 'INV-DASH-01',
      module: 'Inventory Dashboard',
      scenario: 'Dashboard loads successfully',
      steps: 'GET /api/inventory/dashboard with admin token',
      expected: 'Status 200 OK and valid JSON data structure',
      actual: `Status ${dashRes.status}`,
      status: dashRes.status === 200 && dashRes.data?.success === true ? 'PASS' : 'FAIL',
    });

    const dData = dashRes.data?.data;
    recordTest({
      id: 'INV-DASH-02',
      module: 'Inventory Dashboard',
      scenario: 'Inventory Summary metrics present',
      steps: 'Inspect inventorySummary object in dashboard response',
      expected: 'Contains stockInHand and stockYetToBeReceived numbers',
      actual: `stockInHand: ${dData?.inventorySummary?.stockInHand}, stockYetToBeReceived: ${dData?.inventorySummary?.stockYetToBeReceived}`,
      status: typeof dData?.inventorySummary?.stockInHand === 'number' && typeof dData?.inventorySummary?.stockYetToBeReceived === 'number' ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-DASH-03',
      module: 'Inventory Dashboard',
      scenario: 'Product Summary metrics present',
      steps: 'Inspect productSummary object in dashboard response',
      expected: 'totalItems, activeItems, inactiveItems counts match underlying product records',
      actual: `total: ${dData?.productSummary?.totalItems}, active: ${dData?.productSummary?.activeItems}, inactive: ${dData?.productSummary?.inactiveItems}`,
      status: dData?.productSummary?.totalItems >= 2 && dData?.productSummary?.activeItems >= 2 ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-DASH-04',
      module: 'Inventory Dashboard',
      scenario: 'Transfer Request status counts present',
      steps: 'Inspect transferRequest object in dashboard response',
      expected: 'Contains inRequestedTrCount, inApprovedTrCount, inRejectedTrCount, stockTransferReportCount',
      actual: JSON.stringify(dData?.transferRequest),
      status: typeof dData?.transferRequest?.inRequestedTrCount === 'number' ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-DASH-05',
      module: 'Inventory Dashboard',
      scenario: 'PO status counts present',
      steps: 'Inspect pendingPoCount, approvedPoCount, rejectedPoCount',
      expected: 'All PO status counters are valid numbers',
      actual: `pending: ${dData?.pendingPoCount}, approved: ${dData?.approvedPoCount}, rejected: ${dData?.rejectedPoCount}`,
      status: typeof dData?.pendingPoCount === 'number' && typeof dData?.approvedPoCount === 'number' ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-DASH-06',
      module: 'Inventory Dashboard',
      scenario: 'Minimum stock items correctly identified',
      steps: 'Inspect minStockItemCount in dashboard response',
      expected: 'minStockItemCount counts products with stock <= 5',
      actual: `minStockItemCount: ${dData?.minStockItemCount}`,
      status: typeof dData?.minStockItemCount === 'number' && dData?.minStockItemCount >= 1 ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-DASH-07',
      module: 'Inventory Dashboard',
      scenario: 'Top Selling Items array present',
      steps: 'Inspect topSellingItems in dashboard response',
      expected: 'topSellingItems is an array',
      actual: `Array.isArray: ${Array.isArray(dData?.topSellingItems)}, length: ${dData?.topSellingItems?.length}`,
      status: Array.isArray(dData?.topSellingItems) ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 3. VENDOR MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- 3. Vendor Management ---');

    const uniqueFirm = `Loreal India Distribution ${Date.now()}`;
    const uniqueMobile = `9822${Date.now().toString().slice(-6)}`;
    const uniqueEmail = `rajesh-${Date.now()}@loreal-dist.com`;

    // 3.1 Create valid vendor
    const createVendorRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Rajesh Sharma',
      firmName: uniqueFirm,
      mobile: uniqueMobile,
      alternateMobile: '9822054321',
      email: uniqueEmail,
      gstNumber: '27AAAAA0000A1Z5',
      address: 'Shop 14, Commercial Complex, MG Road',
      area: 'Camp',
      landmark: 'Near Victory Theatre',
      city: 'Pune',
      pincode: '411001',
      isActive: true,
    }, adminAToken);

    const vendorA = createVendorRes.data?.data;
    recordTest({
      id: 'INV-VND-01',
      module: 'Vendor Management',
      scenario: 'Create vendor with full valid fields',
      steps: 'POST /api/inventory/vendors with complete details',
      expected: 'Status 201 Created and vendor object returned',
      actual: `Status ${createVendorRes.status}`,
      status: createVendorRes.status === 201 && vendorA?.firmName === uniqueFirm ? 'PASS' : 'FAIL',
    });

    // 3.2 Duplicate firm name validation
    const dupFirmRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Rajesh Duplicate Firm',
      firmName: uniqueFirm,
      mobile: `9823${Date.now().toString().slice(-6)}`,
      address: 'Another address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-02',
      module: 'Vendor Management',
      scenario: 'Reject duplicate firm name',
      steps: 'POST /api/inventory/vendors with existing firmName',
      expected: 'Status 400 Bad Request with meaningful error message',
      actual: `Status ${dupFirmRes.status}, message: ${dupFirmRes.data?.message}`,
      status: dupFirmRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.3 Duplicate mobile validation
    const dupMobileRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Rajesh Duplicate Mobile',
      firmName: `Another Firm ${Date.now()}`,
      mobile: uniqueMobile,
      address: 'Another address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-03',
      module: 'Vendor Management',
      scenario: 'Reject duplicate mobile number',
      steps: 'POST /api/inventory/vendors with existing mobile',
      expected: 'Status 400 Bad Request',
      actual: `Status ${dupMobileRes.status}, message: ${dupMobileRes.data?.message}`,
      status: dupMobileRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.4 Duplicate email validation
    const dupEmailRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Rajesh Duplicate Email',
      firmName: `Another Firm Email ${Date.now()}`,
      mobile: `9824${Date.now().toString().slice(-6)}`,
      email: uniqueEmail,
      address: 'Another address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-04',
      module: 'Vendor Management',
      scenario: 'Reject duplicate email address',
      steps: 'POST /api/inventory/vendors with existing email',
      expected: 'Status 400 Bad Request',
      actual: `Status ${dupEmailRes.status}`,
      status: dupEmailRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.5 Invalid mobile formats
    const alphaMobileRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Alpha Mobile Vendor',
      firmName: `Alpha Firm ${Date.now()}`,
      mobile: 'ABCDEFGHIJ',
      address: 'Test Address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-05',
      module: 'Vendor Management',
      scenario: 'Reject alphabetic mobile number',
      steps: 'POST /api/inventory/vendors with mobile="ABCDEFGHIJ"',
      expected: 'Status 400 Validation Error',
      actual: `Status ${alphaMobileRes.status}`,
      status: alphaMobileRes.status === 400 ? 'PASS' : 'FAIL',
    });

    const shortMobileRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Short Mobile Vendor',
      firmName: `Short Firm ${Date.now()}`,
      mobile: '123',
      address: 'Test Address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-06',
      module: 'Vendor Management',
      scenario: 'Reject too-short mobile number (< 7 digits)',
      steps: 'POST /api/inventory/vendors with mobile="123"',
      expected: 'Status 400 Validation Error',
      actual: `Status ${shortMobileRes.status}`,
      status: shortMobileRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.6 Invalid email format
    const badEmailRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Bad Email Vendor',
      firmName: `Bad Email Firm ${Date.now()}`,
      mobile: `9825${Date.now().toString().slice(-6)}`,
      email: 'not-a-valid-email',
      address: 'Test Address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-07',
      module: 'Vendor Management',
      scenario: 'Reject invalid email format',
      steps: 'POST /api/inventory/vendors with email="not-a-valid-email"',
      expected: 'Status 400 Validation Error',
      actual: `Status ${badEmailRes.status}`,
      status: badEmailRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.7 Invalid GST number format
    const badGstRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'Bad GST Vendor',
      firmName: `Bad GST Firm ${Date.now()}`,
      mobile: `9826${Date.now().toString().slice(-6)}`,
      gstNumber: 'INVALIDGST123',
      address: 'Test Address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-08',
      module: 'Vendor Management',
      scenario: 'Reject invalid GST format',
      steps: 'POST /api/inventory/vendors with gstNumber="INVALIDGST123"',
      expected: 'Status 400 Validation Error',
      actual: `Status ${badGstRes.status}`,
      status: badGstRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.8 Empty required fields
    const emptyNameRes = await request('POST', '/api/inventory/vendors', {
      vendorName: '   ',
      firmName: `Firm ${Date.now()}`,
      mobile: `9827${Date.now().toString().slice(-6)}`,
      address: 'Test Address',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-09',
      module: 'Vendor Management',
      scenario: 'Reject whitespace-only vendorName',
      steps: 'POST /api/inventory/vendors with vendorName="   "',
      expected: 'Status 400 Validation Error',
      actual: `Status ${emptyNameRes.status}`,
      status: emptyNameRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 3.9 List and Search Vendors
    const listVendorsRes = await request('GET', '/api/inventory/vendors', undefined, adminAToken, { search: 'Rajesh' });
    recordTest({
      id: 'INV-VND-10',
      module: 'Vendor Management',
      scenario: 'List and search vendors by keyword',
      steps: 'GET /api/inventory/vendors?search=Rajesh',
      expected: 'Status 200 OK and vendors array containing match',
      actual: `Status ${listVendorsRes.status}, count: ${listVendorsRes.data?.vendors?.length}`,
      status: listVendorsRes.status === 200 && listVendorsRes.data?.vendors?.length >= 1 ? 'PASS' : 'FAIL',
    });

    // 3.10 Get Vendor by ID
    const getVendorRes = await request('GET', `/api/inventory/vendors/${vendorA.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-VND-11',
      module: 'Vendor Management',
      scenario: 'Get vendor details by ID',
      steps: `GET /api/inventory/vendors/${vendorA.id}`,
      expected: 'Status 200 OK and all fields matching created record',
      actual: `Status ${getVendorRes.status}, firmName: ${getVendorRes.data?.data?.firmName}`,
      status: getVendorRes.status === 200 && getVendorRes.data?.data?.id === vendorA.id ? 'PASS' : 'FAIL',
    });

    // 3.11 Update Vendor details
    const updateVendorRes = await request('PUT', `/api/inventory/vendors/${vendorA.id}`, {
      vendorName: 'Rajesh Kumar Sharma',
      city: 'Pune Central',
      area: 'Koregaon Park',
    }, adminAToken);
    recordTest({
      id: 'INV-VND-12',
      module: 'Vendor Management',
      scenario: 'Update vendor fields and verify persistence',
      steps: `PUT /api/inventory/vendors/${vendorA.id}`,
      expected: 'Status 200 OK and updated vendor fields persisted',
      actual: `Status ${updateVendorRes.status}, name: ${updateVendorRes.data?.data?.vendorName}`,
      status: updateVendorRes.status === 200 && updateVendorRes.data?.data?.vendorName === 'Rajesh Kumar Sharma' ? 'PASS' : 'FAIL',
    });

    // 3.12 Set Vendor Items (Product & Disposable catalogue)
    const setVendorItemsRes = await request('POST', `/api/inventory/vendors/${vendorA.id}/items`, {
      items: [
        { productId: testProductA.id, price: 800 },
        { disposableId: testDisposableA.id, price: 120 },
      ],
    }, adminAToken);
    recordTest({
      id: 'INV-VND-13',
      module: 'Vendor Management',
      scenario: 'Associate catalogue products and disposables with vendor prices',
      steps: `POST /api/inventory/vendors/${vendorA.id}/items`,
      expected: 'Status 200 OK and 2 vendor items linked',
      actual: `Status ${setVendorItemsRes.status}`,
      status: setVendorItemsRes.status === 200 ? 'PASS' : 'FAIL',
    });

    // 3.13 Multi-tenant isolation on Vendor
    const crossTenantVendorRes = await request('GET', `/api/inventory/vendors/${vendorA.id}`, undefined, adminBToken);
    recordTest({
      id: 'INV-VND-14',
      module: 'Vendor Management',
      scenario: 'Tenant B cannot view Tenant A vendor',
      steps: `GET /api/inventory/vendors/${vendorA.id} with Tenant B token`,
      expected: 'Status 404 Not Found',
      actual: `Status ${crossTenantVendorRes.status}`,
      status: crossTenantVendorRes.status === 404 ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 4. PURCHASE ORDER CREATION & CALCULATIONS
    // -------------------------------------------------------------
    console.log('\n--- 4. Purchase Order Creation & Calculations ---');

    // 4.1 Valid PO Creation with 1 item
    const poPayload1 = {
      vendorId: vendorA.id,
      expectedDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      poDate: new Date().toISOString().split('T')[0],
      comment: 'Urgent stock order for weekend rush',
      items: [
        {
          productId: testProductA.id,
          requiredQty: 10,
          price: 800,
          servicesPercent: 5,
        },
      ],
    };

    const createPoRes1 = await request('POST', '/api/inventory/purchase-orders', poPayload1, adminAToken);
    const poA = createPoRes1.data?.data;
    recordTest({
      id: 'INV-PO-01',
      module: 'Purchase Order',
      scenario: 'Create Purchase Order with 1 item',
      steps: 'POST /api/inventory/purchase-orders with valid line item',
      expected: 'Status 201 Created and poNumber starts with Inv/Po/',
      actual: `Status ${createPoRes1.status}, poNumber: ${poA?.poNumber}`,
      status: createPoRes1.status === 201 && poA?.poNumber?.startsWith('Inv/Po/') ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-PO-02',
      module: 'Purchase Order',
      scenario: 'Total Items and Total Value mathematical calculation',
      steps: 'Verify totalItems = requiredQty and totalValue = requiredQty * price',
      expected: 'totalItems is 10 and totalValue is 8000',
      actual: `totalItems: ${poA?.totalItems}, totalValue: ${poA?.totalValue}`,
      status: poA?.totalItems === 10 && Number(poA?.totalValue) === 8000 ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-PO-03',
      module: 'Purchase Order',
      scenario: 'Services Amount percentage calculation',
      steps: 'Verify servicesAmount = (lineTotal * servicesPercent) / 100',
      expected: 'servicesAmount = 400 (5% of 8000)',
      actual: `servicesAmount: ${poA?.items?.[0]?.servicesAmount}`,
      status: Number(poA?.items?.[0]?.servicesAmount) === 400 ? 'PASS' : 'FAIL',
    });

    // 4.2 Valid PO Creation with Multiple Items & Decimal Price
    const createPoResMulti = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      expectedDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      items: [
        { productId: testProductA.id, requiredQty: 5, price: 799.50 },
        { productId: testProductLowStock.id, requiredQty: 10, price: 1150.25 },
      ],
    }, adminAToken);
    const poMulti = createPoResMulti.data?.data;
    const expectedMultiTotal = Number((5 * 799.50 + 10 * 1150.25).toFixed(2));
    recordTest({
      id: 'INV-PO-04',
      module: 'Purchase Order',
      scenario: 'Create PO with multiple items and decimal prices',
      steps: 'POST /api/inventory/purchase-orders with 2 items and decimal rates',
      expected: `Status 201, totalItems = 15, totalValue = ${expectedMultiTotal}`,
      actual: `Status ${createPoResMulti.status}, totalItems: ${poMulti?.totalItems}, totalValue: ${poMulti?.totalValue}`,
      status: createPoResMulti.status === 201 && poMulti?.totalItems === 15 && Number(poMulti?.totalValue) === expectedMultiTotal ? 'PASS' : 'FAIL',
    });

    // 4.3 Validation: Quantity = 0
    const zeroQtyPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [{ productId: testProductA.id, requiredQty: 0, price: 800 }],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-05',
      module: 'Purchase Order',
      scenario: 'Reject PO with requiredQty = 0',
      steps: 'POST /api/inventory/purchase-orders with requiredQty = 0',
      expected: 'Status 400 Validation Error',
      actual: `Status ${zeroQtyPoRes.status}`,
      status: zeroQtyPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.4 Validation: Negative Quantity
    const negQtyPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [{ productId: testProductA.id, requiredQty: -5, price: 800 }],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-06',
      module: 'Purchase Order',
      scenario: 'Reject PO with negative quantity',
      steps: 'POST /api/inventory/purchase-orders with requiredQty = -5',
      expected: 'Status 400 Validation Error',
      actual: `Status ${negQtyPoRes.status}`,
      status: negQtyPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.5 Validation: Negative Price
    const negPricePoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [{ productId: testProductA.id, requiredQty: 5, price: -100 }],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-07',
      module: 'Purchase Order',
      scenario: 'Reject PO with negative price',
      steps: 'POST /api/inventory/purchase-orders with price = -100',
      expected: 'Status 400 Validation Error',
      actual: `Status ${negPricePoRes.status}`,
      status: negPricePoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.6 Boundary: Price = 0 (Free sample / gift promotion)
    const zeroPricePoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      comment: 'Free marketing samples from vendor',
      items: [{ productId: testProductA.id, requiredQty: 2, price: 0 }],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-08',
      module: 'Purchase Order',
      scenario: 'Allow PO with price = 0 (Free sample items)',
      steps: 'POST /api/inventory/purchase-orders with price = 0',
      expected: 'Status 201 Created and totalValue = 0',
      actual: `Status ${zeroPricePoRes.status}, totalValue: ${zeroPricePoRes.data?.data?.totalValue}`,
      status: zeroPricePoRes.status === 201 && Number(zeroPricePoRes.data?.data?.totalValue) === 0 ? 'PASS' : 'FAIL',
    });

    // 4.7 Validation: Duplicate Item Selection in Same PO
    const dupItemPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [
        { productId: testProductA.id, requiredQty: 3, price: 800 },
        { productId: testProductA.id, requiredQty: 2, price: 800 },
      ],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-09',
      module: 'Purchase Order',
      scenario: 'Reject duplicate item selection in same PO',
      steps: 'POST /api/inventory/purchase-orders with duplicate productId lines',
      expected: 'Status 400 Bad Request',
      actual: `Status ${dupItemPoRes.status}, message: ${dupItemPoRes.data?.message}`,
      status: dupItemPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.8 Validation: Missing Vendor
    const missingVendorPoRes = await request('POST', '/api/inventory/purchase-orders', {
      items: [{ productId: testProductA.id, requiredQty: 3, price: 800 }],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-10',
      module: 'Purchase Order',
      scenario: 'Reject PO creation without vendorId',
      steps: 'POST /api/inventory/purchase-orders without vendorId field',
      expected: 'Status 400 Validation Error',
      actual: `Status ${missingVendorPoRes.status}`,
      status: missingVendorPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.9 Validation: Empty Items Array
    const emptyItemsPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-11',
      module: 'Purchase Order',
      scenario: 'Reject PO with empty items array',
      steps: 'POST /api/inventory/purchase-orders with items: []',
      expected: 'Status 400 Validation Error',
      actual: `Status ${emptyItemsPoRes.status}`,
      status: emptyItemsPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.10 Validation: Inactive Vendor Rejection
    const inactiveVendor = await prisma.vendor.create({
      data: {
        tenantId: tenantAId,
        vendorName: 'Inactive Vendor Test',
        firmName: `Inactive Firm ${Date.now()}`,
        mobile: `9828${Date.now().toString().slice(-6)}`,
        address: 'Test Address',
        city: 'Pune',
        isActive: false,
      },
    });
    const inactiveVendorPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: inactiveVendor.id,
      items: [{ productId: testProductA.id, requiredQty: 2, price: 800 }],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-12',
      module: 'Purchase Order',
      scenario: 'Reject PO for inactive vendor',
      steps: `POST /api/inventory/purchase-orders with inactive vendor ID ${inactiveVendor.id}`,
      expected: 'Status 400 Bad Request with inactive vendor error message',
      actual: `Status ${inactiveVendorPoRes.status}, message: ${inactiveVendorPoRes.data?.message}`,
      status: inactiveVendorPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.11 PO Listing with Status Tabs and Search
    const listPosRes = await request('GET', '/api/inventory/purchase-orders', undefined, adminAToken, { status: 'PLACED' });
    recordTest({
      id: 'INV-PO-13',
      module: 'Purchase Order',
      scenario: 'Filter PO list by status PLACED and verify tab counts',
      steps: 'GET /api/inventory/purchase-orders?status=PLACED',
      expected: 'Status 200 OK and statusCounts containing placed >= 1',
      actual: `Status ${listPosRes.status}, placedCount: ${listPosRes.data?.statusCounts?.placed}`,
      status: listPosRes.status === 200 && listPosRes.data?.statusCounts?.placed >= 1 ? 'PASS' : 'FAIL',
    });

    const searchPoRes = await request('GET', '/api/inventory/purchase-orders', undefined, adminAToken, { search: poA.poNumber });
    const poOrdersList = searchPoRes.data?.orders || searchPoRes.data?.purchaseOrders || [];
    recordTest({
      id: 'INV-PO-14',
      module: 'Purchase Order',
      scenario: 'Search PO by poNumber',
      steps: `GET /api/inventory/purchase-orders?search=${poA.poNumber}`,
      expected: 'Status 200 OK and PO returned in list',
      actual: `Status ${searchPoRes.status}, count: ${poOrdersList.length}`,
      status: searchPoRes.status === 200 && poOrdersList.length >= 1 ? 'PASS' : 'FAIL',
    });

    // 4.12 Get PO by ID
    const getPoByIdRes = await request('GET', `/api/inventory/purchase-orders/${poA.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-PO-15',
      module: 'Purchase Order',
      scenario: 'Open created PO and verify saved details',
      steps: `GET /api/inventory/purchase-orders/${poA.id}`,
      expected: 'Status 200 OK, items array populated, vendor details included',
      actual: `Status ${getPoByIdRes.status}, items: ${getPoByIdRes.data?.data?.items?.length}`,
      status: getPoByIdRes.status === 200 && getPoByIdRes.data?.data?.items?.length === 1 ? 'PASS' : 'FAIL',
    });

    // 4.13 Update PO while in PLACED status
    const updatePoRes = await request('PUT', `/api/inventory/purchase-orders/${poA.id}`, {
      comment: 'Updated delivery instructions and modified quantity',
      items: [
        {
          productId: testProductA.id,
          requiredQty: 12,
          price: 800,
          servicesPercent: 5,
        },
      ],
    }, adminAToken);
    recordTest({
      id: 'INV-PO-16',
      module: 'Purchase Order',
      scenario: 'Update PO line items while PLACED and verify recalculation',
      steps: `PUT /api/inventory/purchase-orders/${poA.id} with qty = 12`,
      expected: 'Status 200 OK, totalItems updated to 12, totalValue updated to 9600',
      actual: `Status ${updatePoRes.status}, totalItems: ${updatePoRes.data?.data?.totalItems}, totalValue: ${updatePoRes.data?.data?.totalValue}`,
      status: updatePoRes.status === 200 && updatePoRes.data?.data?.totalItems === 12 && Number(updatePoRes.data?.data?.totalValue) === 9600 ? 'PASS' : 'FAIL',
    });

    // 4.14 PO Approval
    const approvePoRes = await request('POST', `/api/inventory/purchase-orders/${poA.id}/approve`, {}, adminAToken);
    recordTest({
      id: 'INV-PO-17',
      module: 'Purchase Order',
      scenario: 'Approve PO transitions status to APPROVED',
      steps: `POST /api/inventory/purchase-orders/${poA.id}/approve`,
      expected: 'Status 200 OK, PO status = APPROVED',
      actual: `Status ${approvePoRes.status}, status: ${approvePoRes.data?.data?.status}`,
      status: approvePoRes.status === 200 && approvePoRes.data?.data?.status === 'APPROVED' ? 'PASS' : 'FAIL',
    });

    // 4.15 Cannot Edit PO Once Approved
    const badEditPoRes = await request('PUT', `/api/inventory/purchase-orders/${poA.id}`, { comment: 'Illegal edit' }, adminAToken);
    recordTest({
      id: 'INV-PO-18',
      module: 'Purchase Order',
      scenario: 'Disallow modifying PO once APPROVED',
      steps: `PUT /api/inventory/purchase-orders/${poA.id}`,
      expected: 'Status 400 Bad Request',
      actual: `Status ${badEditPoRes.status}`,
      status: badEditPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.16 Partial Receive PO & Verify Stock Transaction
    const poItem1 = approvePoRes.data?.data?.items[0];
    const partialRecRes = await request('POST', `/api/inventory/purchase-orders/${poA.id}/receive`, {
      items: [{ itemId: poItem1.id, receivedQty: 5 }],
      comment: 'Partial consignment received: 5 units',
    }, adminAToken);
    recordTest({
      id: 'INV-PO-19',
      module: 'Purchase Order',
      scenario: 'Partial delivery receive transitions status to PARTIAL_SETTLED',
      steps: `POST /api/inventory/purchase-orders/${poA.id}/receive with receivedQty: 5`,
      expected: 'Status 200 OK, status = PARTIAL_SETTLED',
      actual: `Status ${partialRecRes.status}, status: ${partialRecRes.data?.data?.status}`,
      status: partialRecRes.status === 200 && partialRecRes.data?.data?.status === 'PARTIAL_SETTLED' ? 'PASS' : 'FAIL',
    });

    // 4.17 Complete Settle Remaining Qty on PO
    const fullRecRes = await request('POST', `/api/inventory/purchase-orders/${poA.id}/receive`, {
      items: [{ itemId: poItem1.id, receivedQty: 7 }],
      comment: 'Final consignment received: 7 units',
    }, adminAToken);
    recordTest({
      id: 'INV-PO-20',
      module: 'Purchase Order',
      scenario: 'Receive remaining items transitions status to SETTLED',
      steps: `POST /api/inventory/purchase-orders/${poA.id}/receive with receivedQty: 7`,
      expected: 'Status 200 OK, status = SETTLED',
      actual: `Status ${fullRecRes.status}, status: ${fullRecRes.data?.data?.status}`,
      status: fullRecRes.status === 200 && fullRecRes.data?.data?.status === 'SETTLED' ? 'PASS' : 'FAIL',
    });

    // 4.18 Cannot Cancel SETTLED PO
    const cantCancelPoRes = await request('POST', `/api/inventory/purchase-orders/${poA.id}/cancel`, {
      reason: 'Should fail',
    }, adminAToken);
    recordTest({
      id: 'INV-PO-21',
      module: 'Purchase Order',
      scenario: 'Disallow cancellation of SETTLED PO',
      steps: `POST /api/inventory/purchase-orders/${poA.id}/cancel on SETTLED order`,
      expected: 'Status 400 Bad Request',
      actual: `Status ${cantCancelPoRes.status}`,
      status: cantCancelPoRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 4.19 Rejection Flow with Reason
    const rejectPoCreate = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [{ productId: testProductA.id, requiredQty: 2, price: 800 }],
    }, adminAToken);
    const rejectPo = rejectPoCreate.data?.data;
    const rejectPoAction = await request('POST', `/api/inventory/purchase-orders/${rejectPo.id}/reject`, {
      reason: 'Price quotation mismatch',
    }, adminAToken);
    recordTest({
      id: 'INV-PO-22',
      module: 'Purchase Order',
      scenario: 'Reject PO transitions status to REJECTED with reason recorded',
      steps: `POST /api/inventory/purchase-orders/${rejectPo.id}/reject`,
      expected: 'Status 200 OK, status = REJECTED, rejectionReason stored',
      actual: `Status ${rejectPoAction.status}, status: ${rejectPoAction.data?.data?.status}, reason: ${rejectPoAction.data?.data?.rejectionReason}`,
      status: rejectPoAction.status === 200 && rejectPoAction.data?.data?.status === 'REJECTED' && rejectPoAction.data?.data?.rejectionReason === 'Price quotation mismatch' ? 'PASS' : 'FAIL',
    });

    // 4.20 Cancellation Flow with Reason
    const cancelPoCreate = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [{ productId: testProductA.id, requiredQty: 3, price: 800 }],
    }, adminAToken);
    const cancelPo = cancelPoCreate.data?.data;
    const cancelPoAction = await request('POST', `/api/inventory/purchase-orders/${cancelPo.id}/cancel`, {
      reason: 'Order entered by mistake',
    }, adminAToken);
    recordTest({
      id: 'INV-PO-23',
      module: 'Purchase Order',
      scenario: 'Cancel PO transitions status to CANCELLED',
      steps: `POST /api/inventory/purchase-orders/${cancelPo.id}/cancel`,
      expected: 'Status 200 OK, status = CANCELLED',
      actual: `Status ${cancelPoAction.status}, status: ${cancelPoAction.data?.data?.status}`,
      status: cancelPoAction.status === 200 && cancelPoAction.data?.data?.status === 'CANCELLED' ? 'PASS' : 'FAIL',
    });

    // 4.21 Multi-Tenant Isolation on PO
    const crossTenantPoRes = await request('GET', `/api/inventory/purchase-orders/${poA.id}`, undefined, adminBToken);
    recordTest({
      id: 'INV-PO-24',
      module: 'Purchase Order',
      scenario: 'Tenant B cannot view Tenant A PO',
      steps: `GET /api/inventory/purchase-orders/${poA.id} with Tenant B token`,
      expected: 'Status 404 Not Found',
      actual: `Status ${crossTenantPoRes.status}`,
      status: crossTenantPoRes.status === 404 ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 5. TRANSFER REQUEST LIFECYCLE & STOCK AVAILABILITY
    // -------------------------------------------------------------
    console.log('\n--- 5. Transfer Request Lifecycle & Stock Availability ---');

    // 5.1 Validation: Same Source and Destination
    const sameLocTrRes = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'kalyaninagar',
      requestor: 'kalyaninagar',
      items: [{ productId: testProductA.id, requestedQty: 2, price: 950 }],
    }, adminAToken);
    recordTest({
      id: 'INV-TR-01',
      module: 'Transfer Request',
      scenario: 'Reject TR when source and destination locations are identical',
      steps: 'POST /api/inventory/transfer-requests with sender="kalyaninagar" and requestor="kalyaninagar"',
      expected: 'Status 400 Bad Request',
      actual: `Status ${sameLocTrRes.status}, message: ${sameLocTrRes.data?.message}`,
      status: sameLocTrRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 5.2 Validation: Quantity Greater Than Available Stock
    const excessQtyTrRes = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'wadgaonsheri',
      requestor: 'kalyaninagar',
      items: [{ productId: testProductA.id, requestedQty: 99999, price: 950 }],
    }, adminAToken);
    recordTest({
      id: 'INV-TR-02',
      module: 'Transfer Request',
      scenario: 'Reject TR when requested quantity exceeds available stock',
      steps: 'POST /api/inventory/transfer-requests with requestedQty = 99999',
      expected: 'Status 400 Bad Request with available stock message',
      actual: `Status ${excessQtyTrRes.status}, message: ${excessQtyTrRes.data?.message}`,
      status: excessQtyTrRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 5.3 Validation: Quantity = 0
    const zeroQtyTrRes = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'wadgaonsheri',
      requestor: 'kalyaninagar',
      items: [{ productId: testProductA.id, requestedQty: 0, price: 950 }],
    }, adminAToken);
    recordTest({
      id: 'INV-TR-03',
      module: 'Transfer Request',
      scenario: 'Reject TR with requestedQty = 0',
      steps: 'POST /api/inventory/transfer-requests with requestedQty = 0',
      expected: 'Status 400 Validation Error',
      actual: `Status ${zeroQtyTrRes.status}`,
      status: zeroQtyTrRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 5.4 Validation: Duplicate Items in TR
    const dupItemTrRes = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'wadgaonsheri',
      requestor: 'kalyaninagar',
      items: [
        { productId: testProductA.id, requestedQty: 2, price: 950 },
        { productId: testProductA.id, requestedQty: 1, price: 950 },
      ],
    }, adminAToken);
    recordTest({
      id: 'INV-TR-04',
      module: 'Transfer Request',
      scenario: 'Reject duplicate item selection in transfer request',
      steps: 'POST /api/inventory/transfer-requests with duplicate productId items',
      expected: 'Status 400 Bad Request',
      actual: `Status ${dupItemTrRes.status}, message: ${dupItemTrRes.data?.message}`,
      status: dupItemTrRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 5.5 Valid Transfer Request Creation (within available stock: 12 units available from received PO)
    const validTrRes = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'wadgaonsheri',
      requestor: 'kalyaninagar',
      expectedDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      comment: 'Inter-branch stock transfer for urgent client treatments',
      items: [
        {
          productId: testProductA.id,
          requestedQty: 4,
          price: 950,
        },
      ],
    }, adminAToken);
    const trA = validTrRes.data?.data;
    recordTest({
      id: 'INV-TR-05',
      module: 'Transfer Request',
      scenario: 'Create valid Transfer Request within stock limits',
      steps: 'POST /api/inventory/transfer-requests with valid sender, requestor and items',
      expected: 'Status 201 Created and trNumber starts with Inv/Tr/',
      actual: `Status ${validTrRes.status}, trNumber: ${trA?.trNumber}`,
      status: validTrRes.status === 201 && trA?.trNumber?.startsWith('Inv/Tr/') ? 'PASS' : 'FAIL',
    });

    recordTest({
      id: 'INV-TR-06',
      module: 'Transfer Request',
      scenario: 'TR Total Items and Total Value calculation',
      steps: 'Verify totalItems = 4 and totalValue = 4 * 950 = 3800',
      expected: 'totalItems: 4, totalValue: 3800',
      actual: `totalItems: ${trA?.totalItems}, totalValue: ${trA?.totalValue}`,
      status: trA?.totalItems === 4 && Number(trA?.totalValue) === 3800 ? 'PASS' : 'FAIL',
    });

    // 5.6 List TRs with status filter
    const listTrsRes = await request('GET', '/api/inventory/transfer-requests', undefined, adminAToken, { status: 'TRANSFER_IN' });
    recordTest({
      id: 'INV-TR-07',
      module: 'Transfer Request',
      scenario: 'List TRs filtered by TRANSFER_IN tab',
      steps: 'GET /api/inventory/transfer-requests?status=TRANSFER_IN',
      expected: 'Status 200 OK and statusCounts containing transferIn >= 1',
      actual: `Status ${listTrsRes.status}, transferInCount: ${listTrsRes.data?.statusCounts?.transferIn}`,
      status: listTrsRes.status === 200 && listTrsRes.data?.statusCounts?.transferIn >= 1 ? 'PASS' : 'FAIL',
    });

    // 5.7 Get TR by ID
    const getTrByIdRes = await request('GET', `/api/inventory/transfer-requests/${trA.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-TR-08',
      module: 'Transfer Request',
      scenario: 'Open created TR and verify persisted details',
      steps: `GET /api/inventory/transfer-requests/${trA.id}`,
      expected: 'Status 200 OK and line items populated',
      actual: `Status ${getTrByIdRes.status}, items: ${getTrByIdRes.data?.data?.items?.length}`,
      status: getTrByIdRes.status === 200 && getTrByIdRes.data?.data?.items?.length === 1 ? 'PASS' : 'FAIL',
    });

    // 5.8 Update TR while in REQUESTED status
    const updateTrRes = await request('PUT', `/api/inventory/transfer-requests/${trA.id}`, {
      sender: 'baner',
      comment: 'Shifted source branch to Baner warehouse',
    }, adminAToken);
    recordTest({
      id: 'INV-TR-09',
      module: 'Transfer Request',
      scenario: 'Update TR sender location while in REQUESTED status',
      steps: `PUT /api/inventory/transfer-requests/${trA.id} with sender="baner"`,
      expected: 'Status 200 OK and sender updated to "baner"',
      actual: `Status ${updateTrRes.status}, sender: ${updateTrRes.data?.data?.sender}`,
      status: updateTrRes.status === 200 && updateTrRes.data?.data?.sender === 'baner' ? 'PASS' : 'FAIL',
    });

    // 5.9 Approve TR
    const approveTrRes = await request('POST', `/api/inventory/transfer-requests/${trA.id}/approve`, {}, adminAToken);
    recordTest({
      id: 'INV-TR-10',
      module: 'Transfer Request',
      scenario: 'Approve TR transitions status to APPROVED',
      steps: `POST /api/inventory/transfer-requests/${trA.id}/approve`,
      expected: 'Status 200 OK, status = APPROVED',
      actual: `Status ${approveTrRes.status}, status: ${approveTrRes.data?.data?.status}`,
      status: approveTrRes.status === 200 && approveTrRes.data?.data?.status === 'APPROVED' ? 'PASS' : 'FAIL',
    });

    // 5.10 Cannot Edit TR Once Approved
    const badEditTrRes = await request('PUT', `/api/inventory/transfer-requests/${trA.id}`, {
      comment: 'Disallowed update',
    }, adminAToken);
    recordTest({
      id: 'INV-TR-11',
      module: 'Transfer Request',
      scenario: 'Disallow modifying TR once APPROVED',
      steps: `PUT /api/inventory/transfer-requests/${trA.id}`,
      expected: 'Status 400 Bad Request',
      actual: `Status ${badEditTrRes.status}`,
      status: badEditTrRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 5.11 Dispatch TR
    const dispatchTrRes = await request('POST', `/api/inventory/transfer-requests/${trA.id}/dispatch`, {}, adminAToken);
    recordTest({
      id: 'INV-TR-12',
      module: 'Transfer Request',
      scenario: 'Dispatch TR transitions status to DISPATCHED',
      steps: `POST /api/inventory/transfer-requests/${trA.id}/dispatch`,
      expected: 'Status 200 OK, status = DISPATCHED',
      actual: `Status ${dispatchTrRes.status}, status: ${dispatchTrRes.data?.data?.status}`,
      status: dispatchTrRes.status === 200 && dispatchTrRes.data?.data?.status === 'DISPATCHED' ? 'PASS' : 'FAIL',
    });

    // 5.12 Receive TR & Verify Stock Transaction
    const receiveTrRes = await request('POST', `/api/inventory/transfer-requests/${trA.id}/receive`, {}, adminAToken);
    recordTest({
      id: 'INV-TR-13',
      module: 'Transfer Request',
      scenario: 'Receive TR transitions status to RECEIVED and creates TRANSFER transaction',
      steps: `POST /api/inventory/transfer-requests/${trA.id}/receive`,
      expected: 'Status 200 OK, status = RECEIVED',
      actual: `Status ${receiveTrRes.status}, status: ${receiveTrRes.data?.data?.status}`,
      status: receiveTrRes.status === 200 && receiveTrRes.data?.data?.status === 'RECEIVED' ? 'PASS' : 'FAIL',
    });

    const stockTxTr = await prisma.stockTransaction.findFirst({
      where: {
        tenantId: tenantAId,
        type: 'TRANSFER',
        destinationStore: 'kalyaninagar',
      },
    });
    recordTest({
      id: 'INV-TR-14',
      module: 'Transfer Request',
      scenario: 'Verify TRANSFER StockTransaction created with stores and quantity',
      steps: 'Query StockTransaction for TR transfer event',
      expected: 'StockTransaction exists with type TRANSFER and quantity = 4',
      actual: `Exists: ${!!stockTxTr}, qty: ${stockTxTr?.quantity}, source: ${stockTxTr?.sourceStore}, dest: ${stockTxTr?.destinationStore}`,
      status: stockTxTr !== null && Number(stockTxTr?.quantity) === 4 ? 'PASS' : 'FAIL',
    });

    // 5.13 Rejection Flow
    const rejectTrCreate = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'wadgaonsheri',
      items: [{ productId: testProductA.id, requestedQty: 1, price: 950 }],
    }, adminAToken);
    const rejectTr = rejectTrCreate.data?.data;
    const rejectTrAction = await request('POST', `/api/inventory/transfer-requests/${rejectTr.id}/reject`, {
      reason: 'Stock reserved for VIP appointments',
    }, adminAToken);
    recordTest({
      id: 'INV-TR-15',
      module: 'Transfer Request',
      scenario: 'Reject TR with reason',
      steps: `POST /api/inventory/transfer-requests/${rejectTr.id}/reject`,
      expected: 'Status 200 OK, status = REJECTED',
      actual: `Status ${rejectTrAction.status}, status: ${rejectTrAction.data?.data?.status}`,
      status: rejectTrAction.status === 200 && rejectTrAction.data?.data?.status === 'REJECTED' ? 'PASS' : 'FAIL',
    });

    // 5.14 Multi-Tenant Isolation on TR
    const crossTenantTrRes = await request('GET', `/api/inventory/transfer-requests/${trA.id}`, undefined, adminBToken);
    recordTest({
      id: 'INV-TR-16',
      module: 'Transfer Request',
      scenario: 'Tenant B cannot view Tenant A Transfer Request',
      steps: `GET /api/inventory/transfer-requests/${trA.id} with Tenant B token`,
      expected: 'Status 404 Not Found',
      actual: `Status ${crossTenantTrRes.status}`,
      status: crossTenantTrRes.status === 404 ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 6. CENTRALIZED APPROVALS INBOX
    // -------------------------------------------------------------
    console.log('\n--- 6. Centralized Approvals Inbox ---');

    // Create a pending PO and pending TR
    const pendingPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      items: [{ productId: testProductA.id, requiredQty: 3, price: 800 }],
    }, adminAToken);

    const pendingTrRes = await request('POST', '/api/inventory/transfer-requests', {
      sender: 'wadgaonsheri',
      items: [{ productId: testProductA.id, requestedQty: 1, price: 950 }],
    }, adminAToken);

    const approvalsRes = await request('GET', '/api/inventory/approvals', undefined, adminAToken);
    const appData = approvalsRes.data?.data;
    recordTest({
      id: 'INV-APP-01',
      module: 'Approvals Inbox',
      scenario: 'Pending approvals inbox lists placed POs and requested TRs',
      steps: 'GET /api/inventory/approvals',
      expected: 'Status 200 OK, counts.purchaseOrders >= 1, counts.transferRequests >= 1, counts.total >= 2',
      actual: `Status ${approvalsRes.status}, POs: ${appData?.counts?.purchaseOrders}, TRs: ${appData?.counts?.transferRequests}, total: ${appData?.counts?.total}`,
      status: approvalsRes.status === 200 && appData?.counts?.purchaseOrders >= 1 && appData?.counts?.transferRequests >= 1 && appData?.counts?.total >= 2 ? 'PASS' : 'FAIL',
    });

    // Cleanup pending orders
    await request('POST', `/api/inventory/purchase-orders/${pendingPoRes.data?.data?.id}/cancel`, {}, adminAToken);
    await request('POST', `/api/inventory/transfer-requests/${pendingTrRes.data?.data?.id}/cancel`, {}, adminAToken);

    // -------------------------------------------------------------
    // 7. STOCK RECONCILIATION
    // -------------------------------------------------------------
    console.log('\n--- 7. Stock Reconciliation ---');

    // 7.1 List reconciliation items
    const reconListRes = await request('GET', '/api/inventory/reconciliation', undefined, adminAToken);
    recordTest({
      id: 'INV-REC-01',
      module: 'Stock Reconciliation',
      scenario: 'List inventory items for reconciliation audit',
      steps: 'GET /api/inventory/reconciliation',
      expected: 'Status 200 OK and data is an array containing products and disposables',
      actual: `Status ${reconListRes.status}, count: ${reconListRes.data?.data?.length}`,
      status: reconListRes.status === 200 && Array.isArray(reconListRes.data?.data) && reconListRes.data?.data?.length >= 2 ? 'PASS' : 'FAIL',
    });

    const reconItemA = reconListRes.data?.data?.find((i: any) => i.id === testProductA.id);
    const initialActualStock = reconItemA?.actualStock || 0;

    recordTest({
      id: 'INV-REC-02',
      module: 'Stock Reconciliation',
      scenario: 'Reconciliation table columns verified',
      steps: 'Check item properties: id, categoryName, itemName, actualStock, adjustStock, stockDifference, stockValue, unit, remark',
      expected: 'All required table columns present',
      actual: `Item: ${reconItemA?.itemName}, actualStock: ${reconItemA?.actualStock}, unit: ${reconItemA?.unit}`,
      status: reconItemA && typeof reconItemA.actualStock === 'number' && typeof reconItemA.stockValue === 'number' ? 'PASS' : 'FAIL',
    });

    // 7.2 Inward Adjustment (Adjust Stock > Actual Stock, e.g. found stock)
    const inwardAdjustRes = await request('POST', '/api/inventory/reconciliation/adjust', {
      itemId: testProductA.id,
      itemType: 'PRODUCT',
      actualStock: initialActualStock,
      adjustStock: initialActualStock + 10,
      remark: 'Physical audit: Found unopened carton in back storage',
    }, adminAToken);
    recordTest({
      id: 'INV-REC-03',
      module: 'Stock Reconciliation',
      scenario: 'Increase stock via positive reconciliation adjustment (Inward)',
      steps: `POST /api/inventory/reconciliation/adjust with adjustStock = ${initialActualStock + 10}`,
      expected: 'Status 200 OK, difference = 10, newStock = initial + 10',
      actual: `Status ${inwardAdjustRes.status}, difference: ${inwardAdjustRes.data?.data?.difference}`,
      status: inwardAdjustRes.status === 200 && inwardAdjustRes.data?.data?.difference === 10 ? 'PASS' : 'FAIL',
    });

    // 7.3 Outward Adjustment (Adjust Stock < Actual Stock, e.g. leakage/damage)
    const currentActualAfterInward = initialActualStock + 10;
    const outwardAdjustRes = await request('POST', '/api/inventory/reconciliation/adjust', {
      itemId: testProductA.id,
      itemType: 'PRODUCT',
      actualStock: currentActualAfterInward,
      adjustStock: currentActualAfterInward - 4,
      remark: '4 bottles broken during shelf reorganization',
    }, adminAToken);
    recordTest({
      id: 'INV-REC-04',
      module: 'Stock Reconciliation',
      scenario: 'Decrease stock via negative reconciliation adjustment (Outward)',
      steps: `POST /api/inventory/reconciliation/adjust with adjustStock = ${currentActualAfterInward - 4}`,
      expected: 'Status 200 OK, difference = -4',
      actual: `Status ${outwardAdjustRes.status}, difference: ${outwardAdjustRes.data?.data?.difference}`,
      status: outwardAdjustRes.status === 200 && outwardAdjustRes.data?.data?.difference === -4 ? 'PASS' : 'FAIL',
    });

    // 7.4 Zero Adjustment (Adjust Stock = Actual Stock)
    const noChangeAdjustRes = await request('POST', '/api/inventory/reconciliation/adjust', {
      itemId: testProductA.id,
      itemType: 'PRODUCT',
      actualStock: currentActualAfterInward - 4,
      adjustStock: currentActualAfterInward - 4,
      remark: 'Audit completed: Physical stock matches system exactly',
    }, adminAToken);
    recordTest({
      id: 'INV-REC-05',
      module: 'Stock Reconciliation',
      scenario: 'Adjust Stock equals Actual Stock (diff = 0)',
      steps: 'POST /api/inventory/reconciliation/adjust with adjustStock = actualStock',
      expected: 'Status 200 OK, difference = 0',
      actual: `Status ${noChangeAdjustRes.status}, difference: ${noChangeAdjustRes.data?.data?.difference}`,
      status: noChangeAdjustRes.status === 200 && noChangeAdjustRes.data?.data?.difference === 0 ? 'PASS' : 'FAIL',
    });

    // 7.5 Validation: Missing Remark
    const noRemarkAdjustRes = await request('POST', '/api/inventory/reconciliation/adjust', {
      itemId: testProductA.id,
      itemType: 'PRODUCT',
      actualStock: 10,
      adjustStock: 15,
      remark: '',
    }, adminAToken);
    recordTest({
      id: 'INV-REC-06',
      module: 'Stock Reconciliation',
      scenario: 'Reject adjustment with empty remark',
      steps: 'POST /api/inventory/reconciliation/adjust with remark=""',
      expected: 'Status 400 Bad Request',
      actual: `Status ${noRemarkAdjustRes.status}`,
      status: noRemarkAdjustRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 7.6 Validation: Negative Adjusted Stock
    const negAdjustStockRes = await request('POST', '/api/inventory/reconciliation/adjust', {
      itemId: testProductA.id,
      itemType: 'PRODUCT',
      actualStock: 10,
      adjustStock: -5,
      remark: 'Invalid negative stock input',
    }, adminAToken);
    recordTest({
      id: 'INV-REC-07',
      module: 'Stock Reconciliation',
      scenario: 'Reject negative adjusted stock',
      steps: 'POST /api/inventory/reconciliation/adjust with adjustStock = -5',
      expected: 'Status 400 Bad Request',
      actual: `Status ${negAdjustStockRes.status}`,
      status: negAdjustStockRes.status === 400 ? 'PASS' : 'FAIL',
    });

    // 7.7 Bulk Stock Reconciliation
    const bulkAdjustRes = await request('POST', '/api/inventory/reconciliation/bulk-adjust', {
      items: [
        {
          itemId: testProductA.id,
          itemType: 'PRODUCT',
          actualStock: currentActualAfterInward - 4,
          adjustStock: 25,
          remark: 'Quarterly physical stocktaking reconciliation',
        },
        {
          itemId: testDisposableA.id,
          itemType: 'DISPOSABLE',
          actualStock: 0,
          adjustStock: 50,
          remark: 'Opening stock count for cotton pads',
        },
      ],
    }, adminAToken);
    recordTest({
      id: 'INV-REC-08',
      module: 'Stock Reconciliation',
      scenario: 'Bulk adjust stock for multiple products and disposables',
      steps: 'POST /api/inventory/reconciliation/bulk-adjust with 2 items',
      expected: 'Status 200 OK and 2 adjustments recorded',
      actual: `Status ${bulkAdjustRes.status}, count: ${bulkAdjustRes.data?.data?.length}`,
      status: bulkAdjustRes.status === 200 && bulkAdjustRes.data?.data?.length === 2 ? 'PASS' : 'FAIL',
    });

    // 7.8 Verify Dashboard Stock In Hand Updates Accurately
    const postReconDashRes = await request('GET', '/api/inventory/dashboard', undefined, adminAToken);
    const postReconStock = postReconDashRes.data?.data?.inventorySummary?.stockInHand;
    recordTest({
      id: 'INV-REC-09',
      module: 'Stock Reconciliation',
      scenario: 'Dashboard Stock In Hand reflects adjusted stock count',
      steps: 'GET /api/inventory/dashboard after bulk reconciliation',
      expected: 'Dashboard stockInHand >= 25',
      actual: `stockInHand: ${postReconStock}`,
      status: typeof postReconStock === 'number' && postReconStock >= 25 ? 'PASS' : 'FAIL',
    });

    // 7.9 CSV Export
    const csvExportRes = await request('GET', '/api/inventory/reconciliation/export', undefined, adminAToken);
    recordTest({
      id: 'INV-REC-10',
      module: 'Stock Reconciliation',
      scenario: 'Export reconciliation report as CSV',
      steps: 'GET /api/inventory/reconciliation/export',
      expected: 'Status 200 OK, Content-Type contains text/csv, headers present',
      actual: `Status ${csvExportRes.status}, contentType: ${csvExportRes.headers.get('content-type')}`,
      status: csvExportRes.status === 200 && csvExportRes.headers.get('content-type')?.includes('text/csv') && csvExportRes.text.includes('Category Name,Item Name,Type') ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 8. SECURITY & INPUT TESTING
    // -------------------------------------------------------------
    console.log('\n--- 8. Security & Input Testing ---');

    // 8.1 SQL Injection in Search
    const sqlInjectionRes = await request('GET', '/api/inventory/vendors', undefined, adminAToken, {
      search: "' OR '1'='1' --",
    });
    recordTest({
      id: 'INV-SEC-01',
      module: 'Security Testing',
      scenario: 'SQL Injection string in vendor search parameter',
      steps: "GET /api/inventory/vendors?search=' OR '1'='1' --",
      expected: 'Status 200 OK without crashing or exposing unauthorized data',
      actual: `Status ${sqlInjectionRes.status}`,
      status: sqlInjectionRes.status === 200 ? 'PASS' : 'FAIL',
    });

    // 8.2 XSS / Script Injection in Comments & Remarks
    const xssPoRes = await request('POST', '/api/inventory/purchase-orders', {
      vendorId: vendorA.id,
      comment: '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
      items: [{ productId: testProductA.id, requiredQty: 1, price: 800 }],
    }, adminAToken);
    const xssPo = xssPoRes.data?.data;
    recordTest({
      id: 'INV-SEC-02',
      module: 'Security Testing',
      scenario: 'Store XSS and script payload safely without execution or crash',
      steps: 'POST /api/inventory/purchase-orders with HTML/script comment',
      expected: 'Status 201 Created and string sanitized/stored safely',
      actual: `Status ${xssPoRes.status}, comment: ${xssPo?.comment}`,
      status: xssPoRes.status === 201 && xssPo?.comment?.includes('<script>') ? 'PASS' : 'FAIL',
    });

    // 8.3 Unicode & Multi-byte Characters
    const unicodeVendorRes = await request('POST', '/api/inventory/vendors', {
      vendorName: 'サロン 💆‍♀️ Vendor',
      firmName: `Shampoo & Spa 🧴 ${Date.now()}`,
      mobile: `9829${Date.now().toString().slice(-6)}`,
      address: '東京都 渋谷区 1-2-3 / Pune Station',
      city: 'Pune',
    }, adminAToken);
    recordTest({
      id: 'INV-SEC-03',
      module: 'Security Testing',
      scenario: 'Unicode & Emoji support in vendor details',
      steps: 'POST /api/inventory/vendors with multi-byte Japanese and emoji characters',
      expected: 'Status 201 Created and characters preserved exactly',
      actual: `Status ${unicodeVendorRes.status}, name: ${unicodeVendorRes.data?.data?.vendorName}`,
      status: unicodeVendorRes.status === 201 && unicodeVendorRes.data?.data?.vendorName === 'サロン 💆‍♀️ Vendor' ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 9. CLEANUP & DELETE VENDOR
    // -------------------------------------------------------------
    console.log('\n--- 9. Delete Vendor & Constraints ---');

    // 9.1 Disallow Deleting Vendor with Existing POs
    const deleteVendorWithPos = await request('DELETE', `/api/inventory/vendors/${vendorA.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-DEL-01',
      module: 'Vendor Management',
      scenario: 'Prevent deletion of vendor with existing purchase orders',
      steps: `DELETE /api/inventory/vendors/${vendorA.id} (has associated POs)`,
      expected: 'Status 400 Bad Request with guidance to deactivate instead',
      actual: `Status ${deleteVendorWithPos.status}, message: ${deleteVendorWithPos.data?.message}`,
      status: deleteVendorWithPos.status === 400 ? 'PASS' : 'FAIL',
    });

    // 9.2 Delete Vendor Without POs
    const deleteVendorNoPos = await request('DELETE', `/api/inventory/vendors/${unicodeVendorRes.data?.data?.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-DEL-02',
      module: 'Vendor Management',
      scenario: 'Allow deletion of unreferenced vendor',
      steps: `DELETE /api/inventory/vendors/${unicodeVendorRes.data?.data?.id}`,
      expected: 'Status 200 OK',
      actual: `Status ${deleteVendorNoPos.status}`,
      status: deleteVendorNoPos.status === 200 ? 'PASS' : 'FAIL',
    });

    // -------------------------------------------------------------
    // 10. ADVANCED FEATURES: PRINT, CSV EXPORTS, DELETIONS & ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 10. Advanced Features: Vendor Items, Print, CSV Exports & Deletions ---');

    // 10.1 Get Vendor Items directly via GET endpoint
    const getVendorItemsRes = await request('GET', `/api/inventory/vendors/${vendorA.id}/items`, undefined, adminAToken);
    recordTest({
      id: 'INV-EXT-01',
      module: 'Vendor Management',
      scenario: 'Fetch vendor mapped items via GET /api/inventory/vendors/:id/items',
      steps: `GET /api/inventory/vendors/${vendorA.id}/items`,
      expected: 'Status 200 OK with array of mapped items',
      actual: `Status ${getVendorItemsRes.status}, items count: ${Array.isArray(getVendorItemsRes.data?.data) ? getVendorItemsRes.data?.data.length : 'not array'}`,
      status: getVendorItemsRes.status === 200 && Array.isArray(getVendorItemsRes.data?.data) ? 'PASS' : 'FAIL',
    });

    // 10.2 Export Purchase Orders as CSV
    const exportPoRes = await request('GET', '/api/inventory/purchase-orders', undefined, adminAToken, { export: 'csv' });
    recordTest({
      id: 'INV-EXT-02',
      module: 'Purchase Orders',
      scenario: 'Export Purchase Orders to CSV format',
      steps: 'GET /api/inventory/purchase-orders?export=csv',
      expected: 'Status 200 OK, text/csv content type containing PO Number header',
      actual: `Status ${exportPoRes.status}, contains PO Number: ${exportPoRes.text.includes('PO Number')}`,
      status: exportPoRes.status === 200 && exportPoRes.text.includes('PO Number') ? 'PASS' : 'FAIL',
    });

    // 10.3 Export Transfer Requests as CSV (Stock Transfer Report)
    const exportTrRes = await request('GET', '/api/inventory/transfer-requests', undefined, adminAToken, { export: 'csv' });
    recordTest({
      id: 'INV-EXT-03',
      module: 'Transfer Requests',
      scenario: 'Export Transfer Requests (Stock Transfer Report) to CSV format',
      steps: 'GET /api/inventory/transfer-requests?export=csv',
      expected: 'Status 200 OK, text/csv content type containing TR Number header',
      actual: `Status ${exportTrRes.status}, contains TR Number: ${exportTrRes.text.includes('TR Number')}`,
      status: exportTrRes.status === 200 && exportTrRes.text.includes('TR Number') ? 'PASS' : 'FAIL',
    });

    // 10.4 Printable Purchase Order HTML
    const printPoRes = await request('GET', `/api/inventory/purchase-orders/${poA.id}/print`, undefined, adminAToken);
    recordTest({
      id: 'INV-EXT-04',
      module: 'Purchase Orders',
      scenario: 'Render printable Purchase Order HTML document',
      steps: `GET /api/inventory/purchase-orders/${poA.id}/print`,
      expected: 'Status 200 OK, text/html content containing PO Number and Vendor Details',
      actual: `Status ${printPoRes.status}, contains Inv/Po: ${printPoRes.text.includes('Inv/Po')}`,
      status: printPoRes.status === 200 && printPoRes.text.includes('Inv/Po') && printPoRes.text.includes('Vendor Details') ? 'PASS' : 'FAIL',
    });

    // 10.5 Disallow Deleting Settled Purchase Order
    const deleteSettledPo = await request('DELETE', `/api/inventory/purchase-orders/${poA.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-EXT-05',
      module: 'Purchase Orders',
      scenario: 'Prevent deletion of settled purchase order with stock received',
      steps: `DELETE /api/inventory/purchase-orders/${poA.id} (SETTLED)`,
      expected: 'Status 400 Bad Request',
      actual: `Status ${deleteSettledPo.status}, message: ${deleteSettledPo.data?.message}`,
      status: deleteSettledPo.status === 400 ? 'PASS' : 'FAIL',
    });

    // 10.6 Create Draft PO and Delete It
    const tempPoRes = await request(
      'POST',
      '/api/inventory/purchase-orders',
      {
        vendorId: vendorA.id,
        items: [{ productId: testProductA.id, requiredQty: 2, price: 100 }],
        comment: 'Temporary PO for deletion testing',
      },
      adminAToken
    );
    const deleteDraftPo = await request('DELETE', `/api/inventory/purchase-orders/${tempPoRes.data?.data?.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-EXT-06',
      module: 'Purchase Orders',
      scenario: 'Allow deletion of PLACED draft purchase order',
      steps: `DELETE /api/inventory/purchase-orders/${tempPoRes.data?.data?.id}`,
      expected: 'Status 200 OK with success message',
      actual: `Status ${deleteDraftPo.status}`,
      status: deleteDraftPo.status === 200 ? 'PASS' : 'FAIL',
    });

    // 10.7 Disallow Deleting Received Transfer Request
    const deleteReceivedTr = await request('DELETE', `/api/inventory/transfer-requests/${trA.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-EXT-07',
      module: 'Transfer Requests',
      scenario: 'Prevent deletion of received transfer request with stock movement',
      steps: `DELETE /api/inventory/transfer-requests/${trA.id} (RECEIVED)`,
      expected: 'Status 400 Bad Request',
      actual: `Status ${deleteReceivedTr.status}, message: ${deleteReceivedTr.data?.message}`,
      status: deleteReceivedTr.status === 400 ? 'PASS' : 'FAIL',
    });

    // 10.8 Create Draft TR and Delete It
    const tempTrRes = await request(
      'POST',
      '/api/inventory/transfer-requests',
      {
        sender: 'viman_nagar',
        requestor: 'kalyaninagar',
        items: [{ productId: testProductA.id, requestedQty: 1, price: 100 }],
        comment: 'Temporary TR for deletion testing',
      },
      adminAToken
    );
    const deleteDraftTr = await request('DELETE', `/api/inventory/transfer-requests/${tempTrRes.data?.data?.id}`, undefined, adminAToken);
    recordTest({
      id: 'INV-EXT-08',
      module: 'Transfer Requests',
      scenario: 'Allow deletion of REQUESTED draft transfer request',
      steps: `DELETE /api/inventory/transfer-requests/${tempTrRes.data?.data?.id}`,
      expected: 'Status 200 OK with success message',
      actual: `Status ${deleteDraftTr.status}`,
      status: deleteDraftTr.status === 200 ? 'PASS' : 'FAIL',
    });

    // 10.9 Cross-Tenant Isolation: Tenant B cannot access Tenant A vendor items
    const tenantBCrossVendorItems = await request('GET', `/api/inventory/vendors/${vendorA.id}/items`, undefined, adminBToken);
    recordTest({
      id: 'INV-EXT-09',
      module: 'SaaS Isolation',
      scenario: 'Tenant B cannot view Tenant A vendor items (Returns 404)',
      steps: `Tenant B GET /api/inventory/vendors/${vendorA.id}/items`,
      expected: 'Status 404 Not Found',
      actual: `Status ${tenantBCrossVendorItems.status}`,
      status: tenantBCrossVendorItems.status === 404 ? 'PASS' : 'FAIL',
    });

    // 10.10 Cross-Tenant Isolation: Tenant B cannot delete Tenant A purchase order
    const tenantBCrossDeletePo = await request('DELETE', `/api/inventory/purchase-orders/${poA.id}`, undefined, adminBToken);
    recordTest({
      id: 'INV-EXT-10',
      module: 'SaaS Isolation',
      scenario: 'Tenant B cannot delete Tenant A purchase order (Returns 404)',
      steps: `Tenant B DELETE /api/inventory/purchase-orders/${poA.id}`,
      expected: 'Status 404 Not Found',
      actual: `Status ${tenantBCrossDeletePo.status}`,
      status: tenantBCrossDeletePo.status === 404 ? 'PASS' : 'FAIL',
    });

  } catch (error: any) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  console.log('\n================================================================');
  console.log(`   Inventory Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('inventory.test.ts')) {
  runInventoryTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
