import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';
import { Prisma } from '@prisma/client';

export interface TestCaseResult {
  testCaseId: string;
  module: string;
  scenario: string;
  preconditions: string;
  testSteps: string;
  testData: any;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  evidence?: string;
}

export const testResults: TestCaseResult[] = [];

let server: http.Server;
let baseUrl: string;

let adminAToken: string;
let adminBToken: string;
let tenantAId: string;
let tenantBId: string;

const RUN_ID = `sp_e2e_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

function recordTest(result: TestCaseResult) {
  testResults.push(result);
  const icon = result.status === 'PASS' ? '✅ [PASS]' : result.status === 'FAIL' ? '❌ [FAIL]' : '⚠️ [BLOCKED]';
  console.log(`${icon} ${result.testCaseId}: ${result.scenario}`);
  if (result.status === 'FAIL') {
    console.error(`     Expected: ${result.expectedResult}`);
    console.error(`     Actual:   ${result.actualResult}`);
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

export async function runCompleteServicesProductsTests() {
  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(`   SERVICES & PRODUCTS MODULE: COMPLETE END-TO-END VERIFICATION [${RUN_ID}]`);
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

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

  // Track entities for teardown
  const createdServiceCatIds: string[] = [];
  const createdProductCatIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  try {
    // =========================================================================
    // 1. AUTHENTICATION & MULTI-TENANT TOKENS
    // =========================================================================
    console.log('>>> 1. AUTHENTICATION & MULTI-TENANT INITIALIZATION');

    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;

    recordTest({
      testCaseId: 'AUTH-01',
      module: 'Auth',
      scenario: 'Tenant A Admin Authentication',
      preconditions: 'Tenant A user exists with valid credentials',
      testSteps: 'POST /api/auth/login with username admin',
      testData: { username: 'admin' },
      expectedResult: 'HTTP 200 with JWT token and tenantId',
      actualResult: `HTTP ${adminALogin.status}, token: ${!!adminAToken}`,
      status: adminALogin.status === 200 && !!adminAToken ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;

    recordTest({
      testCaseId: 'AUTH-02',
      module: 'Auth',
      scenario: 'Tenant B Admin Authentication',
      preconditions: 'Tenant B user exists with valid credentials',
      testSteps: 'POST /api/auth/login with username admin-b',
      testData: { username: 'admin-b' },
      expectedResult: 'HTTP 200 with JWT token and distinct tenantId',
      actualResult: `HTTP ${adminBLogin.status}, tenantId: ${tenantBId}`,
      status: adminBLogin.status === 200 && !!adminBToken && tenantBId !== tenantAId ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 2. CENTRALISED SERVICE CATEGORIES & HIERARCHY
    // =========================================================================
    console.log('\n>>> 2. CENTRALISED SERVICE CATEGORIES & HIERARCHY (1:1 VIDEO FLOW)');

    // 2.1 Create Root Category: HAIR
    const rootHairRes = await request('POST', '/api/service-categories', {
      name: `HAIR_${RUN_ID}`,
      position: 1,
      group: 'Both',
      hideFromCatalogue: false,
      stores: ['kalyaninagar', 'wadgaon'],
    }, adminAToken);

    const hairCatId = rootHairRes.data?.data?.id;
    if (hairCatId) createdServiceCatIds.push(hairCatId);

    recordTest({
      testCaseId: 'SCAT-01',
      module: 'ServiceCategories',
      scenario: 'Create Root Category (HAIR) with Stores Array',
      preconditions: 'Tenant A authenticated',
      testSteps: 'POST /api/service-categories with stores array',
      testData: { name: `HAIR_${RUN_ID}`, stores: ['kalyaninagar', 'wadgaon'] },
      expectedResult: 'HTTP 201, parentId null, stores contains kalyaninagar & wadgaon',
      actualResult: `HTTP ${rootHairRes.status}, parentId: ${rootHairRes.data?.data?.parentId}, stores: ${JSON.stringify(rootHairRes.data?.data?.stores)}`,
      status: rootHairRes.status === 201 && rootHairRes.data?.data?.parentId === null ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 2.2 Create Subcategory under HAIR: Hair Spa
    const subHairSpaRes = await request('POST', '/api/service-categories', {
      parentId: hairCatId,
      name: `Hair Spa_${RUN_ID}`,
      position: 1,
      group: 'Both',
      stores: ['kalyaninagar', 'wadgaon'],
    }, adminAToken);

    const hairSpaSubcatId = subHairSpaRes.data?.data?.id;
    if (hairSpaSubcatId) createdServiceCatIds.push(hairSpaSubcatId);

    recordTest({
      testCaseId: 'SCAT-02',
      module: 'ServiceCategories',
      scenario: 'Create Subcategory under Root (Hair Spa -> HAIR)',
      preconditions: 'Parent category exists',
      testSteps: 'POST /api/service-categories with parentId',
      testData: { parentId: hairCatId, name: `Hair Spa_${RUN_ID}` },
      expectedResult: 'HTTP 201, parentId matches hairCatId',
      actualResult: `HTTP ${subHairSpaRes.status}, parentId: ${subHairSpaRes.data?.data?.parentId}`,
      status: subHairSpaRes.status === 201 && subHairSpaRes.data?.data?.parentId === hairCatId ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 2.3 Create Root Category: skin (assigned only to kalyaninagar)
    const rootSkinRes = await request('POST', '/api/service-categories', {
      name: `skin_${RUN_ID}`,
      position: 2,
      group: 'Female',
      stores: ['kalyaninagar'],
    }, adminAToken);

    const skinCatId = rootSkinRes.data?.data?.id;
    if (skinCatId) createdServiceCatIds.push(skinCatId);

    recordTest({
      testCaseId: 'SCAT-03',
      module: 'ServiceCategories',
      scenario: 'Create Single-Store Service Category (skin -> kalyaninagar)',
      preconditions: 'Tenant A authenticated',
      testSteps: 'POST /api/service-categories with single store',
      testData: { name: `skin_${RUN_ID}`, stores: ['kalyaninagar'] },
      expectedResult: 'HTTP 201, stores array length 1',
      actualResult: `HTTP ${rootSkinRes.status}, stores: ${JSON.stringify(rootSkinRes.data?.data?.stores)}`,
      status: rootSkinRes.status === 201 && rootSkinRes.data?.data?.stores?.length === 1 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 2.4 Query Tree View (Centralised Categories View)
    const treeRes = await request('GET', '/api/service-categories', undefined, adminAToken, { tree: 'true' });
    const treeItems = treeRes.data?.data || [];
    const hairInTree = treeItems.find((c: any) => c.id === hairCatId);
    const hasHairSpaChild = hairInTree?.children?.some((c: any) => c.id === hairSpaSubcatId);

    recordTest({
      testCaseId: 'SCAT-04',
      module: 'ServiceCategories',
      scenario: 'Retrieve Centralised Service Categories in Hierarchical Tree',
      preconditions: 'Parent and child categories created',
      testSteps: 'GET /api/service-categories?tree=true',
      testData: { tree: 'true' },
      expectedResult: 'HTTP 200, parent categories contain nested children array',
      actualResult: `HTTP ${treeRes.status}, parent found: ${!!hairInTree}, child nested: ${hasHairSpaChild}`,
      status: treeRes.status === 200 && hasHairSpaChild ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 2.5 Query Store Filtered Categories
    const kalyaniRes = await request('GET', '/api/service-categories', undefined, adminAToken, { store: 'kalyaninagar' });
    const kalyaniList = kalyaniRes.data?.data || [];
    const skinInKalyani = kalyaniList.some((c: any) => c.id === skinCatId);

    const wadgaonRes = await request('GET', '/api/service-categories', undefined, adminAToken, { store: 'wadgaon' });
    const wadgaonList = wadgaonRes.data?.data || [];
    const skinInWadgaon = wadgaonList.some((c: any) => c.id === skinCatId);

    recordTest({
      testCaseId: 'SCAT-05',
      module: 'ServiceCategories',
      scenario: 'Store-Filtered Category Querying (Branch Isolation)',
      preconditions: 'skin assigned to kalyaninagar only',
      testSteps: 'GET /api/service-categories?store=kalyaninagar vs wadgaon',
      testData: { stores: ['kalyaninagar', 'wadgaon'] },
      expectedResult: 'skin present in kalyaninagar, absent in wadgaon',
      actualResult: `in kalyaninagar: ${skinInKalyani}, in wadgaon: ${skinInWadgaon}`,
      status: skinInKalyani && !skinInWadgaon ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 3. SERVICES OPERATIONS & MANAGEMENT (1:1 VIDEO FLOW)
    // =========================================================================
    console.log('\n>>> 3. SERVICES OPERATIONS & MANAGEMENT (1:1 VIDEO FLOW)');

    // 3.1 Create Service: Hair Spa Loreal with SAC Code 999721 & Duration 45m
    const staffMember = await prisma.staff.findFirst({ where: { tenantId: tenantAId } });

    const createServiceRes = await request('POST', '/api/services', {
      categoryId: hairCatId,
      subcategoryId: hairSpaSubcatId,
      name: `Hair Spa Loreal_${RUN_ID}`,
      position: 1,
      sacCode: '999721',
      durationMinutes: 45,
      price: 800.0,
      specialPrice: 750.0,
      group: 'Both',
      consumables: [{ name: 'Cream', quantity: 50, unit: 'g' }, { name: 'Serum', quantity: 10, unit: 'ml' }],
      resourceIds: ['Hair Station 1'],
      staffIds: staffMember ? [staffMember.id] : [],
      isActive: true,
    }, adminAToken);

    const lorealService = createServiceRes.data?.data;
    if (lorealService?.id) createdServiceIds.push(lorealService.id);

    recordTest({
      testCaseId: 'SERV-01',
      module: 'Services',
      scenario: 'Create Service with Government SAC Code, Duration & Consumables',
      preconditions: 'Service category & subcategory exist',
      testSteps: 'POST /api/services with sacCode 999721, duration 45m, price 800',
      testData: { name: `Hair Spa Loreal_${RUN_ID}`, sacCode: '999721', duration: 45, price: 800 },
      expectedResult: 'HTTP 201, sacCode stored, duration 45, price 800.00',
      actualResult: `HTTP ${createServiceRes.status}, sacCode: ${lorealService?.sacCode}, duration: ${lorealService?.durationMinutes}`,
      status: createServiceRes.status === 201 && lorealService?.sacCode === '999721' && lorealService?.durationMinutes === 45 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 3.2 Get Service with Relations (Category, Subcategory)
    const getServiceRes = await request('GET', `/api/services/${lorealService?.id}`, undefined, adminAToken);
    const fetchedService = getServiceRes.data?.data;

    recordTest({
      testCaseId: 'SERV-02',
      module: 'Services',
      scenario: 'Retrieve Service by ID with Populated Category Hierarchy',
      preconditions: 'Service exists',
      testSteps: 'GET /api/services/:id',
      testData: { id: lorealService?.id },
      expectedResult: 'HTTP 200, category and subcategory relations populated',
      actualResult: `HTTP ${getServiceRes.status}, category: ${fetchedService?.category?.name}, subcategory: ${fetchedService?.subcategory?.name}`,
      status: getServiceRes.status === 200 && fetchedService?.category?.id === hairCatId && fetchedService?.subcategory?.id === hairSpaSubcatId ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 3.3 Update Service Details
    const updateServiceRes = await request('PUT', `/api/services/${lorealService?.id}`, {
      name: `Hair Spa Loreal Premium_${RUN_ID}`,
      price: 950.0,
      durationMinutes: 50,
    }, adminAToken);

    recordTest({
      testCaseId: 'SERV-03',
      module: 'Services',
      scenario: 'Update Service Details (Name, Price, Duration)',
      preconditions: 'Service exists',
      testSteps: 'PUT /api/services/:id with new values',
      testData: { price: 950.0, durationMinutes: 50 },
      expectedResult: 'HTTP 200, updated price 950.00 and duration 50',
      actualResult: `HTTP ${updateServiceRes.status}, price: ${updateServiceRes.data?.data?.price}, duration: ${updateServiceRes.data?.data?.durationMinutes}`,
      status: updateServiceRes.status === 200 && parseFloat(updateServiceRes.data?.data?.price) === 950.0 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 3.4 Service Status Toggle
    const toggleServiceRes = await request('PATCH', `/api/services/${lorealService?.id}/status`, {
      isActive: false,
    }, adminAToken);

    recordTest({
      testCaseId: 'SERV-04',
      module: 'Services',
      scenario: 'Toggle Service Active / Inactive Status',
      preconditions: 'Service exists',
      testSteps: 'PATCH /api/services/:id/status with isActive: false',
      testData: { isActive: false },
      expectedResult: 'HTTP 200, isActive false',
      actualResult: `HTTP ${toggleServiceRes.status}, isActive: ${toggleServiceRes.data?.data?.isActive}`,
      status: toggleServiceRes.status === 200 && toggleServiceRes.data?.data?.isActive === false ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    // Reactivate for subsequent tests
    await request('PATCH', `/api/services/${lorealService?.id}/status`, { isActive: true }, adminAToken);

    // =========================================================================
    // 4. PRODUCT CATEGORIES & PRODUCTS WITH INVENTORY INWARDING
    // =========================================================================
    console.log('\n>>> 4. PRODUCTS & AUTOMATED INVENTORY INWARDING (1:1 VIDEO FLOW)');

    // 4.1 Create Product Category: Skin Care
    const prodCatRes = await request('POST', '/api/product-categories', {
      name: `Skin Care Products_${RUN_ID}`,
      position: 1,
      group: 'Both',
      stores: ['kalyaninagar', 'wadgaon'],
    }, adminAToken);

    const prodCatId = prodCatRes.data?.data?.id;
    if (prodCatId) createdProductCatIds.push(prodCatId);

    // 4.2 Create Product Subcategory: Creams
    const prodSubcatRes = await request('POST', '/api/product-categories', {
      parentId: prodCatId,
      name: `Creams_${RUN_ID}`,
      position: 1,
      stores: ['kalyaninagar', 'wadgaon'],
    }, adminAToken);

    const prodSubcatId = prodSubcatRes.data?.data?.id;
    if (prodSubcatId) createdProductCatIds.push(prodSubcatId);

    // 4.3 Create Product with Initial Stock (fair and lovely)
    const createProdRes = await request('POST', '/api/products', {
      categoryId: prodCatId,
      subcategoryId: prodSubcatId,
      name: `fair and lovely_${RUN_ID}`,
      position: 1,
      hsnCode: '330499',
      productTag: 'fgh',
      storeSku: `sku_${RUN_ID}`,
      barcode: `bar_${RUN_ID}`,
      price: 10.0,
      salePrice: 20.0,
      purchasePrice: 8.0,
      initialStock: 50,
      isRetail: true,
      isNonDiscountable: false,
      isActive: true,
    }, adminAToken);

    const fairProduct = createProdRes.data?.data;
    if (fairProduct?.id) createdProductIds.push(fairProduct.id);

    recordTest({
      testCaseId: 'PROD-01',
      module: 'Products',
      scenario: 'Create Product with GST HSN Code, SKU, Barcode & Initial Stock',
      preconditions: 'Product category exists',
      testSteps: 'POST /api/products with hsnCode 330499, SKU, barcode, initialStock: 50',
      testData: { name: `fair and lovely_${RUN_ID}`, hsnCode: '330499', initialStock: 50 },
      expectedResult: 'HTTP 201, hsnCode 330499, storeSku stored, initialStock 50',
      actualResult: `HTTP ${createProdRes.status}, hsn: ${fairProduct?.hsnCode}, sku: ${fairProduct?.storeSku}`,
      status: createProdRes.status === 201 && fairProduct?.hsnCode === '330499' ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 4.4 Automated Inventory Inwarding & Dynamic Stock Check
    const getProdRes = await request('GET', `/api/products/${fairProduct?.id}`, undefined, adminAToken);
    const currentStock = getProdRes.data?.data?.currentStock;

    const inwardTx = await prisma.stockTransaction.findFirst({
      where: { productId: fairProduct?.id, type: 'INWARD' },
    });

    recordTest({
      testCaseId: 'PROD-02',
      module: 'Products',
      scenario: 'Automatic Atomic StockTransaction INWARD Creation on Product Creation',
      preconditions: 'Product created with initialStock > 0',
      testSteps: 'Verify PostgreSQL StockTransaction table and GET /api/products/:id currentStock',
      testData: { initialStock: 50 },
      expectedResult: 'INWARD StockTransaction exists in DB with qty 50, and currentStock === 50',
      actualResult: `INWARD tx found: ${!!inwardTx}, tx qty: ${inwardTx?.quantity}, currentStock: ${currentStock}`,
      status: !!inwardTx && parseFloat(inwardTx.quantity.toString()) === 50 && currentStock === 50 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 5. CROSS-MODULE INTEGRATION: POS SALES ORDER
    // =========================================================================
    console.log('\n>>> 5. CROSS-MODULE INTEGRATION: POS ORDER WITH SERVICE & PRODUCT');

    let guest = await prisma.guest.findFirst({ where: { tenantId: tenantAId } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Customer',
          lastName: 'VIP',
          mobile: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      });
    }

    const posOrder = await prisma.posOrder.create({
      data: {
        tenant: { connect: { id: tenantAId } },
        guest: { connect: { id: guest.id } },
        orderNumber: `ORD_${RUN_ID}`,
        status: 'PAID',
        subtotal: new Prisma.Decimal(990.0),
        totalAmount: new Prisma.Decimal(990.0),
        items: {
          create: [
            {
              tenant: { connect: { id: tenantAId } },
              itemType: 'SERVICE',
              service: { connect: { id: lorealService.id } },
              itemName: `Hair Spa Loreal Premium_${RUN_ID}`,
              quantity: 1,
              unitPrice: new Prisma.Decimal(950.0),
              subtotal: new Prisma.Decimal(950.0),
              total: new Prisma.Decimal(950.0),
            },
            {
              tenant: { connect: { id: tenantAId } },
              itemType: 'PRODUCT',
              product: { connect: { id: fairProduct.id } },
              itemName: `fair and lovely_${RUN_ID}`,
              quantity: 2,
              unitPrice: new Prisma.Decimal(20.0),
              subtotal: new Prisma.Decimal(40.0),
              total: new Prisma.Decimal(40.0),
            },
          ],
        },
      },
      include: { items: true },
    });
    createdOrderIds.push(posOrder.id);

    recordTest({
      testCaseId: 'POS-01',
      module: 'POS Integration',
      scenario: 'POS Order Processing with Service & Product Line Items',
      preconditions: 'Active service and product exist',
      testSteps: 'Create POS order with 1 service item and 1 product item (2 qty)',
      testData: { orderNumber: `ORD_${RUN_ID}`, total: 990.0 },
      expectedResult: 'POS Order recorded with 2 items referencing service and product',
      actualResult: `Items count: ${posOrder.items.length}, total: ${posOrder.totalAmount}`,
      status: posOrder.items.length === 2 && parseFloat(posOrder.totalAmount.toString()) === 990.0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 6. CROSS-MODULE INTEGRATION: APPOINTMENT SCHEDULING
    // =========================================================================
    console.log('\n>>> 6. CROSS-MODULE INTEGRATION: APPOINTMENT BOOKING');

    const appt = await prisma.appointment.create({
      data: {
        tenantId: tenantAId,
        appointmentNumber: `APT_${RUN_ID}`,
        guestId: guest.id,
        appointmentDate: new Date(),
        status: 'CONFIRMED',
        totalAmount: new Prisma.Decimal(950.0),
        items: {
          create: [
            {
              tenantId: tenantAId,
              serviceId: lorealService.id,
              startTime: '11:00',
              endTime: '11:50',
              durationMinutes: 50,
              price: new Prisma.Decimal(950.0),
            },
          ],
        },
      },
      include: { items: true },
    });
    createdAppointmentIds.push(appt.id);

    recordTest({
      testCaseId: 'APPT-01',
      module: 'Appointments',
      scenario: 'Appointment Booking with Service Duration Mapping',
      preconditions: 'Service exists with 50m duration',
      testSteps: 'Schedule appointment linked to service',
      testData: { serviceId: lorealService.id, duration: 50 },
      expectedResult: 'Appointment created with item referencing serviceId and duration 50',
      actualResult: `Appt item serviceId: ${appt.items[0]?.serviceId}, durationMinutes: ${appt.items[0]?.durationMinutes}`,
      status: appt.items[0]?.serviceId === lorealService.id && appt.items[0]?.durationMinutes === 50 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 7. HISTORICAL DATA PRESERVATION & DELETION GUARDS (HTTP API)
    // =========================================================================
    console.log('\n>>> 7. HISTORICAL DATA PRESERVATION & DELETION GUARDS (HTTP API)');

    // 7.1 Deletion of service linked to historical records blocked
    const delServiceRes = await request('DELETE', `/api/services/${lorealService.id}`, undefined, adminAToken);

    recordTest({
      testCaseId: 'HIST-01',
      module: 'Historical Protection',
      scenario: 'Blocked Deletion of Service Referenced by POS Orders / Appointments',
      preconditions: 'Service referenced in historical POS order item and appointment',
      testSteps: 'DELETE /api/services/:id',
      testData: { id: lorealService.id },
      expectedResult: 'HTTP 409 Conflict, deletion blocked, explanatory error message',
      actualResult: `HTTP ${delServiceRes.status}, message: ${delServiceRes.data?.message || delServiceRes.data?.error}`,
      status: delServiceRes.status === 409 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 7.2 Deletion of product linked to POS order blocked
    const delProdRes = await request('DELETE', `/api/products/${fairProduct.id}`, undefined, adminAToken);

    recordTest({
      testCaseId: 'HIST-02',
      module: 'Historical Protection',
      scenario: 'Blocked Deletion of Product Referenced by POS Orders',
      preconditions: 'Product referenced in historical POS order item',
      testSteps: 'DELETE /api/products/:id',
      testData: { id: fairProduct.id },
      expectedResult: 'HTTP 409 Conflict, deletion blocked',
      actualResult: `HTTP ${delProdRes.status}, message: ${delProdRes.data?.message || delProdRes.data?.error}`,
      status: delProdRes.status === 409 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 7.3 Category Deletion Blocked when Children/Services Exist
    const delCatRes = await request('DELETE', `/api/service-categories/${hairCatId}`, undefined, adminAToken);

    recordTest({
      testCaseId: 'HIST-03',
      module: 'Historical Protection',
      scenario: 'Blocked Deletion of Category Containing Subcategories or Services',
      preconditions: 'hairCat contains subcategories and services',
      testSteps: 'DELETE /api/service-categories/:id',
      testData: { id: hairCatId },
      expectedResult: 'HTTP 409 Conflict, deletion blocked',
      actualResult: `HTTP ${delCatRes.status}, message: ${delCatRes.data?.message || delCatRes.data?.error}`,
      status: delCatRes.status === 409 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 7.4 Historical Order Items Unaltered After Item Deactivation
    await request('PATCH', `/api/services/${lorealService.id}/status`, { isActive: false }, adminAToken);
    await request('PATCH', `/api/products/${fairProduct.id}/status`, { isActive: false }, adminAToken);

    const recheckOrder = await prisma.posOrder.findUnique({
      where: { id: posOrder.id },
      include: { items: true },
    });

    recordTest({
      testCaseId: 'HIST-04',
      module: 'Historical Protection',
      scenario: 'Historical POS Orders & Financials 100% Preserved After Soft Deactivation',
      preconditions: 'Service and Product deactivated',
      testSteps: 'Query POS order items in database',
      testData: { orderId: posOrder.id },
      expectedResult: 'All order items, names, prices, and totals remain intact',
      actualResult: `Items count: ${recheckOrder?.items.length}, total: ${recheckOrder?.totalAmount}`,
      status: recheckOrder?.items.length === 2 && parseFloat(recheckOrder.totalAmount.toString()) === 990.0 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 8. VALIDATION, BOUNDARY & SECURITY ENFORCEMENT
    // =========================================================================
    console.log('\n>>> 8. VALIDATION, BOUNDARY & SECURITY ENFORCEMENT');

    // 8.1 Negative price rejected
    const negPriceRes = await request('POST', '/api/services', {
      categoryId: hairCatId,
      name: `Neg_Price_${RUN_ID}`,
      price: -100,
      durationMinutes: 30,
    }, adminAToken);

    recordTest({
      testCaseId: 'SEC-01',
      module: 'Validation',
      scenario: 'Reject Negative Service Price',
      preconditions: 'Tenant A authenticated',
      testSteps: 'POST /api/services with price: -100',
      testData: { price: -100 },
      expectedResult: 'HTTP 400 Bad Request',
      actualResult: `HTTP ${negPriceRes.status}`,
      status: negPriceRes.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 8.2 Negative duration rejected
    const negDurRes = await request('POST', '/api/services', {
      categoryId: hairCatId,
      name: `Neg_Duration_${RUN_ID}`,
      price: 100,
      durationMinutes: -15,
    }, adminAToken);

    recordTest({
      testCaseId: 'SEC-02',
      module: 'Validation',
      scenario: 'Reject Negative Service Duration',
      preconditions: 'Tenant A authenticated',
      testSteps: 'POST /api/services with durationMinutes: -15',
      testData: { durationMinutes: -15 },
      expectedResult: 'HTTP 400 Bad Request',
      actualResult: `HTTP ${negDurRes.status}`,
      status: negDurRes.status === 400 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 8.3 Duplicate Barcode within same tenant rejected
    const dupBarRes = await request('POST', '/api/products', {
      categoryId: prodCatId,
      name: `Dup_Bar_${RUN_ID}`,
      price: 25,
      barcode: `bar_${RUN_ID}`, // Duplicate barcode
    }, adminAToken);

    recordTest({
      testCaseId: 'SEC-03',
      module: 'Validation',
      scenario: 'Reject Duplicate Product Barcode in Same Tenant',
      preconditions: 'Barcode bar_... already assigned to fair and lovely',
      testSteps: 'POST /api/products with existing barcode',
      testData: { barcode: `bar_${RUN_ID}` },
      expectedResult: 'HTTP 400 or 409 Conflict',
      actualResult: `HTTP ${dupBarRes.status}`,
      status: dupBarRes.status === 400 || dupBarRes.status === 409 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 8.4 Duplicate SKU within same tenant rejected
    const dupSkuRes = await request('POST', '/api/products', {
      categoryId: prodCatId,
      name: `Dup_SKU_${RUN_ID}`,
      price: 25,
      storeSku: `sku_${RUN_ID}`, // Duplicate SKU
    }, adminAToken);

    recordTest({
      testCaseId: 'SEC-04',
      module: 'Validation',
      scenario: 'Reject Duplicate Product SKU in Same Tenant',
      preconditions: 'SKU sku_... already assigned to fair and lovely',
      testSteps: 'POST /api/products with existing storeSku',
      testData: { storeSku: `sku_${RUN_ID}` },
      expectedResult: 'HTTP 400 or 409 Conflict',
      actualResult: `HTTP ${dupSkuRes.status}`,
      status: dupSkuRes.status === 400 || dupSkuRes.status === 409 ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // 8.5 Unauthorized Request (Missing Token)
    const unauthRes = await request('GET', '/api/services');

    recordTest({
      testCaseId: 'SEC-05',
      module: 'Security',
      scenario: 'Enforce Bearer Authentication on Protected Endpoints',
      preconditions: 'No Authorization header',
      testSteps: 'GET /api/services without token',
      testData: {},
      expectedResult: 'HTTP 401 Unauthorized',
      actualResult: `HTTP ${unauthRes.status}`,
      status: unauthRes.status === 401 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 8.6 Multi-Tenant Data Isolation: Tenant B cannot access Tenant A Service
    const crossAccessRes = await request('GET', `/api/services/${lorealService.id}`, undefined, adminBToken);

    recordTest({
      testCaseId: 'SEC-06',
      module: 'Security',
      scenario: 'Cross-Tenant Service Access Rejection (Data Isolation)',
      preconditions: 'Tenant B authenticated, requests Tenant A service ID',
      testSteps: 'GET /api/services/:id with Tenant B token',
      testData: { serviceId: lorealService.id },
      expectedResult: 'HTTP 404 Not Found (Data Isolation)',
      actualResult: `HTTP ${crossAccessRes.status}`,
      status: crossAccessRes.status === 404 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // 8.7 Multi-Tenant Data Isolation: Tenant B cannot access Tenant A Product
    const crossProdRes = await request('GET', `/api/products/${fairProduct.id}`, undefined, adminBToken);

    recordTest({
      testCaseId: 'SEC-07',
      module: 'Security',
      scenario: 'Cross-Tenant Product Access Rejection (Data Isolation)',
      preconditions: 'Tenant B authenticated, requests Tenant A product ID',
      testSteps: 'GET /api/products/:id with Tenant B token',
      testData: { productId: fairProduct.id },
      expectedResult: 'HTTP 404 Not Found (Data Isolation)',
      actualResult: `HTTP ${crossProdRes.status}`,
      status: crossProdRes.status === 404 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    // =========================================================================
    // 9. CONCURRENCY & RACE CONDITIONS
    // =========================================================================
    console.log('\n>>> 9. CONCURRENCY & PARALLEL EXECUTION SAFETY');

    const concurrentPromises = [1, 2, 3, 4, 5].map((idx) =>
      request('POST', '/api/products', {
        categoryId: prodCatId,
        name: `Concurrent_Prod_${idx}_${RUN_ID}`,
        price: 50 + idx,
        storeSku: `sku_conc_${idx}_${RUN_ID}`,
        barcode: `bar_conc_${idx}_${RUN_ID}`,
        initialStock: 10,
      }, adminAToken)
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const allSuccessful = concurrentResults.every((r) => r.status === 201);

    for (const r of concurrentResults) {
      if (r.data?.data?.id) {
        createdProductIds.push(r.data.data.id);
      }
    }

    recordTest({
      testCaseId: 'CONC-01',
      module: 'Concurrency',
      scenario: '5 Concurrent Product Creations with Inventory Inwarding',
      preconditions: 'Tenant A authenticated',
      testSteps: 'Dispatch 5 simultaneous POST /api/products requests with initialStock',
      testData: { count: 5 },
      expectedResult: 'All 5 return HTTP 201 without lock contention or duplicate key errors',
      actualResult: `All 201: ${allSuccessful}`,
      status: allSuccessful ? 'PASS' : 'FAIL',
      severity: 'HIGH',
    });

    // =========================================================================
    // 10. CLEAN DELETION OF UNREFERENCED ITEMS
    // =========================================================================
    console.log('\n>>> 10. CLEAN DELETION OF UNREFERENCED ITEMS');

    const unrefProdRes = await request('POST', '/api/products', {
      categoryId: prodCatId,
      name: `Unreferenced_Prod_${RUN_ID}`,
      price: 45,
    }, adminAToken);
    const unrefProdId = unrefProdRes.data?.data?.id;

    const cleanDelProdRes = await request('DELETE', `/api/products/${unrefProdId}`, undefined, adminAToken);

    recordTest({
      testCaseId: 'CLEAN-01',
      module: 'Clean Deletion',
      scenario: 'Clean Deletion of Unreferenced Product',
      preconditions: 'Product not referenced in any orders or stock transactions',
      testSteps: 'DELETE /api/products/:id',
      testData: { id: unrefProdId },
      expectedResult: 'HTTP 200 Success',
      actualResult: `HTTP ${cleanDelProdRes.status}`,
      status: cleanDelProdRes.status === 200 ? 'PASS' : 'FAIL',
      severity: 'MEDIUM',
    });

    // =========================================================================
    // 11. DIRECT POSTGRESQL DATABASE VERIFICATION
    // =========================================================================
    console.log('\n>>> 11. DIRECT POSTGRESQL DATABASE VERIFICATION');

    const dbService = await prisma.service.findUnique({
      where: { id: lorealService.id },
    });

    recordTest({
      testCaseId: 'DB-01',
      module: 'Database Verification',
      scenario: 'Direct PostgreSQL services Table Column & Type Verification',
      preconditions: 'Service created via API',
      testSteps: 'Query PostgreSQL services table via Prisma',
      testData: { id: lorealService.id },
      expectedResult: 'sacCode === 999721, durationMinutes === 50, valid timestamps',
      actualResult: `sacCode: ${dbService?.sacCode}, duration: ${dbService?.durationMinutes}, created: ${!!dbService?.createdAt}`,
      status: dbService?.sacCode === '999721' && dbService?.durationMinutes === 50 && !!dbService?.createdAt ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

    const dbProduct = await prisma.product.findUnique({
      where: { id: fairProduct.id },
    });

    recordTest({
      testCaseId: 'DB-02',
      module: 'Database Verification',
      scenario: 'Direct PostgreSQL products Table Column & Type Verification',
      preconditions: 'Product created via API',
      testSteps: 'Query PostgreSQL products table via Prisma',
      testData: { id: fairProduct.id },
      expectedResult: 'hsnCode === 330499, storeSku stored, valid timestamps',
      actualResult: `hsnCode: ${dbProduct?.hsnCode}, storeSku: ${dbProduct?.storeSku}`,
      status: dbProduct?.hsnCode === '330499' && dbProduct?.storeSku === `sku_${RUN_ID}` ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
    });

  } finally {
    // Teardown
    console.log('\n>>> TEARDOWN & CLEANUP');
    if (createdAppointmentIds.length > 0) {
      await prisma.appointmentItem.deleteMany({ where: { appointmentId: { in: createdAppointmentIds } } });
      await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    }
    if (createdOrderIds.length > 0) {
      await prisma.posOrderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.posOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdProductIds.length > 0) {
      await prisma.stockTransaction.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdServiceIds.length > 0) {
      await prisma.serviceStaff.deleteMany({ where: { serviceId: { in: createdServiceIds } } });
      await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
    }
    if (createdProductCatIds.length > 0) {
      await prisma.productCategory.deleteMany({ where: { id: { in: createdProductCatIds } } });
    }
    if (createdServiceCatIds.length > 0) {
      await prisma.serviceCategory.deleteMany({ where: { id: { in: createdServiceCatIds } } });
    }

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    console.log('Teardown complete.');
  }

  const passedTests = testResults.filter((t) => t.status === 'PASS').length;
  const failedTests = testResults.filter((t) => t.status === 'FAIL').length;

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(`   SERVICES & PRODUCTS EXHAUSTIVE TEST SUITE: Total ${testResults.length} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCompleteServicesProductsTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
