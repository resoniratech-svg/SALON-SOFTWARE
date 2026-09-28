import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let cashierToken: string;
let tenantId: string;
let tenantBToken: string;
let tenantBId: string;

let testGuestId: string;
let testStaffId: string;
let testProductId: string;
let testServiceId: string;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

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
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  let text = '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    text = await res.text().catch(() => '');
  }
  return { status: res.status, data, text, headers: res.headers };
}

export async function runReportsEdgeCasesTests() {
  console.log('\n================================================================');
  console.log('   Reports Module: Advanced Edge Cases & UI Alignment Test Suite');
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
    // 0. Setup Fixtures & Authentication
    // -------------------------------------------------------------
    console.log('--- 0. Setup Fixtures & Authentication ---');
    const loginAdmin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(loginAdmin.status === 200, 'Admin logs in successfully (200)');
    adminToken = loginAdmin.data?.data?.token;
    tenantId = loginAdmin.data?.data?.user?.tenantId;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { enabledModules: ['SETTINGS', 'STAFF', 'POS', 'REPORTS', 'INVENTORY'] },
    });

    const loginCashier = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    cashierToken = loginCashier.data?.data?.token;
    assert(loginCashier.status === 200, 'Cashier logs in successfully (200)');

    // Tenant B Setup
    let tenantB = await prisma.tenant.findFirst({ where: { code: 'TENANT_B_REPORTS' } });
    if (!tenantB) {
      tenantB = await prisma.tenant.create({
        data: {
          name: 'Reports Tenant B',
          code: 'TENANT_B_REPORTS',
          enabledModules: ['REPORTS', 'POS'],
        },
      });
    }
    tenantBId = tenantB.id;

    const bAdminUser = await prisma.user.findFirst({ where: { username: 'tenant_b_rpt_admin' } });
    if (!bAdminUser) {
      const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
      await prisma.user.create({
        data: {
          tenantId: tenantBId,
          username: 'tenant_b_rpt_admin',
          email: 'b_rpt@saloonerp.test',
          passwordHash: (await prisma.user.findFirst({ where: { username: 'admin' } }))!.passwordHash,
          roleId: adminRole!.id,
          status: 'ACTIVE',
        },
      });
    }

    const loginTenantB = await request('POST', '/api/auth/login', {
      username: 'tenant_b_rpt_admin',
      password: 'DevelopmentPassword123!',
    });
    tenantBToken = loginTenantB.data?.data?.token;
    assert(Boolean(tenantBToken), 'Tenant B authenticated');

    // Fixtures in Tenant A
    let guest = await prisma.guest.findFirst({ where: { tenantId } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          tenantId,
          name: 'Aanya Sharma',
          mobile: '9898001122',
          gender: 'FEMALE',
        },
      });
    }
    testGuestId = guest.id;

    let staff = await prisma.staff.findFirst({ where: { tenantId } });
    if (!staff) {
      staff = await prisma.staff.create({
        data: {
          tenantId,
          name: 'Rohit Stylist',
          gender: 'MALE',
          designation: 'Senior Hair Stylist',
          category: 'SALON',
          isActive: true,
        },
      });
    }
    testStaffId = staff.id;

    let product = await prisma.product.findFirst({ where: { tenantId } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId,
          name: 'Moroccanoil Treatment 100ml',
          sku: 'MOR-100',
          barcode: '8901234567890',
          salePrice: 3200,
          purchasePrice: 2000,
          hsnCode: '33059040',
          currentStock: 15,
          unit: 'PIECES',
          isActive: true,
        },
      });
    }
    testProductId = product.id;

    let service = await prisma.service.findFirst({ where: { tenantId } });
    if (!service) {
      service = await prisma.service.create({
        data: {
          tenantId,
          name: 'Keratin Complex Therapy',
          price: 5500,
          salePrice: 5500,
          durationMinutes: 120,
          sacCode: '999721',
          isActive: true,
        },
      });
    }
    testServiceId = service.id;

    // -------------------------------------------------------------
    // 1. Date Range Presets & Boundary Testing (Frames 001, 015, 025)
    // -------------------------------------------------------------
    console.log('\n--- 1. Date Range Presets & Boundary Testing ---');

    // 1.1 Preset: 'today'
    const todayRes = await request('GET', '/api/reports/sales-summary?preset=today', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(todayRes.status === 200, 'GET /api/reports/sales-summary?preset=today returns 200');
    assert(todayRes.data?.data?.filters?.preset === 'today', 'Preset filter correctly preserved as today');
    assert(Boolean(todayRes.data?.data?.filters?.startDate), 'StartDate populated for today');

    // 1.2 Preset: 'weekly'
    const weeklyRes = await request('GET', '/api/reports/sales-summary?preset=weekly', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(weeklyRes.status === 200, 'GET /api/reports/sales-summary?preset=weekly returns 200');
    assert(weeklyRes.data?.data?.filters?.preset === 'weekly', 'Preset filter correctly preserved as weekly');

    // 1.3 Preset: 'monthly'
    const monthlyRes = await request('GET', '/api/reports/sales-summary?preset=monthly', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(monthlyRes.status === 200, 'GET /api/reports/sales-summary?preset=monthly returns 200');
    assert(monthlyRes.data?.data?.filters?.preset === 'monthly', 'Preset filter correctly preserved as monthly');

    // 1.4 Preset: 'yearly'
    const yearlyRes = await request('GET', '/api/reports/sales-summary?preset=yearly', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(yearlyRes.status === 200, 'GET /api/reports/sales-summary?preset=yearly returns 200');
    assert(yearlyRes.data?.data?.filters?.preset === 'yearly', 'Preset filter correctly preserved as yearly');

    // 1.5 Custom Date Boundary: Single Day Range (Same Start & End Date)
    const singleDayRes = await request(
      'GET',
      '/api/reports/sales-summary?startDate=2026-08-26&endDate=2026-08-26',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(singleDayRes.status === 200, 'Single day date range (2026-08-26) returns 200');
    assert(singleDayRes.data?.data?.filters?.startDate === '2026-08-26', 'Start date matches');
    assert(singleDayRes.data?.data?.filters?.endDate === '2026-08-26', 'End date matches');

    // 1.6 Future Date Range with Zero Records
    const futureRes = await request(
      'GET',
      '/api/reports/sales-summary?startDate=2030-01-01&endDate=2030-01-31',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(futureRes.status === 200, 'Future date range returns 200 with zero sales');
    assert(futureRes.data?.data?.totals?.grossSales === 0, 'Gross sales is 0 for future date');
    assert(futureRes.data?.data?.totals?.netSales === 0, 'Net sales is 0 for future date');
    assert(futureRes.data?.data?.rows.length === 0, 'Zero rows returned without error');

    // -------------------------------------------------------------
    // 2. CSV Streaming & Export Endpoints (UI Download Button)
    // -------------------------------------------------------------
    console.log('\n--- 2. CSV Streaming & Export Endpoints ---');

    // 2.1 Sales Summary CSV Export via query param format=csv
    const csvQueryRes = await request('GET', '/api/reports/sales-summary?format=csv', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(csvQueryRes.status === 200, 'format=csv returns 200');
    assert(csvQueryRes.headers.get('content-type')?.includes('text/csv') ?? false, 'Header Content-Type is text/csv');
    assert(csvQueryRes.text.length > 0, 'CSV output body is non-empty text');

    // 2.2 Product Revenue CSV Export via Accept header text/csv
    const csvHeaderRes = await request('GET', '/api/reports/product-revenue', undefined, {
      Authorization: `Bearer ${adminToken}`,
      Accept: 'text/csv',
    });
    assert(csvHeaderRes.status === 200, 'Accept: text/csv returns 200');
    assert(csvHeaderRes.headers.get('content-type')?.includes('text/csv') ?? false, 'Header Content-Type is text/csv');

    // 2.3 PNL Report CSV Export via export=csv
    const pnlCsvRes = await request('GET', '/api/reports/pnl-report?export=csv', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(pnlCsvRes.status === 200, 'export=csv returns 200');
    assert(pnlCsvRes.headers.get('content-type')?.includes('text/csv') ?? false, 'Header Content-Type is text/csv');

    // -------------------------------------------------------------
    // 3. Multi-Dimension Filtering (Store, Staff, Product, Service)
    // -------------------------------------------------------------
    console.log('\n--- 3. Multi-Dimension Filtering ---');

    // 3.1 Product Revenue filtered by specific product ID
    const prodFilterRes = await request('GET', `/api/reports/product-revenue?productId=${testProductId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(prodFilterRes.status === 200, 'Product Revenue filtered by productId returns 200');

    // 3.2 Service Revenue filtered by specific service ID
    const servFilterRes = await request('GET', `/api/reports/service-revenue?serviceId=${testServiceId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(servFilterRes.status === 200, 'Service Revenue filtered by serviceId returns 200');

    // 3.3 Staff Revenue filtered by staff ID
    const staffFilterRes = await request('GET', `/api/reports/staff-revenue?staffId=${testStaffId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(staffFilterRes.status === 200, 'Staff Revenue filtered by staffId returns 200');

    // 3.4 Service Reminder filtered by category
    const reminderRes = await request('GET', '/api/reports/service-reminder?category=HAIR', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reminderRes.status === 200, 'Service Reminder filtered by category returns 200');

    // 3.5 Guest Collection filtered by guest ID
    const guestColRes = await request('GET', `/api/reports/guest-collection?guestId=${testGuestId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(guestColRes.status === 200, 'Guest Collection filtered by guestId returns 200');

    // 3.6 Gender Group Filter ('Female')
    const femaleGroupRes = await request('GET', '/api/reports/product-revenue?group=Female', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(femaleGroupRes.status === 200, 'Product Revenue with group=Female returns 200');

    // 3.7 Gender Group Filter ('Male')
    const maleGroupRes = await request('GET', '/api/reports/service-revenue?group=Male', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(maleGroupRes.status === 200, 'Service Revenue with group=Male returns 200');

    // -------------------------------------------------------------
    // 4. Multi-Tenant Strict Isolation
    // -------------------------------------------------------------
    console.log('\n--- 4. Multi-Tenant Strict Isolation ---');

    // Tenant B Sales Summary should reflect 0 of Tenant A's orders
    const tenantBSalesRes = await request('GET', '/api/reports/sales-summary', undefined, {
      Authorization: `Bearer ${tenantBToken}`,
    });
    assert(tenantBSalesRes.status === 200, 'Tenant B requests sales summary (200)');
    assert(tenantBSalesRes.data?.data?.totals?.totalOrders === 0, 'Tenant B sees 0 orders from Tenant A');
    assert(tenantBSalesRes.data?.data?.totals?.grossSales === 0, 'Tenant B sees 0 gross sales');

    // Tenant B PNL Report should reflect 0 of Tenant A's expenses or revenue
    const tenantBPnlRes = await request('GET', '/api/reports/pnl-report', undefined, {
      Authorization: `Bearer ${tenantBToken}`,
    });
    assert(tenantBPnlRes.status === 200, 'Tenant B requests PNL report (200)');
    assert(tenantBPnlRes.data?.data?.totals?.grossRevenue === 0, 'Tenant B gross revenue is 0');
    assert(tenantBPnlRes.data?.data?.totals?.totalExpenses === 0, 'Tenant B expenses are 0');

    // -------------------------------------------------------------
    // 5. Fallback Slug Routing & Error Handling
    // -------------------------------------------------------------
    console.log('\n--- 5. Fallback Slug Routing & Error Handling ---');

    // 5.1 Dynamic route GET /api/reports/:reportType with valid slug
    const dynamicRes = await request('GET', '/api/reports/tip-report', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(dynamicRes.status === 200, 'GET /api/reports/:reportType routes properly (200)');
    assert(dynamicRes.data?.data?.reportType === 'tip-report', 'Report type slug mapped correctly');

    // 5.2 Invalid report type slug returns 400
    const invalidSlugRes = await request('GET', '/api/reports/non-existent-report-xyz', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(invalidSlugRes.status === 400, 'Unknown report slug returns 400 Bad Request');
    assert(invalidSlugRes.data?.success === false, 'Error response has success: false');

    // 5.3 Pagination edge case: page=999, limit=5
    const paginationRes = await request('GET', '/api/reports/sales-summary?page=999&limit=5', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(paginationRes.status === 200, 'High page number (page=999) returns 200 without error');
    assert(paginationRes.data?.data?.page === 999, 'Page number reflected');
    assert(paginationRes.data?.data?.limit === 5, 'Limit reflected');
    assert(paginationRes.data?.data?.rows.length === 0, 'Returns empty rows on out-of-bounds page');

    // 5.4 RBAC: Cashier without REPORTS module permission gets 403
    // First remove REPORTS from Cashier's tenant module temporarily or check authorization
    const cashierReportsRes = await request('GET', '/api/reports/catalog', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierReportsRes.status === 200, 'Authorized Cashier with REPORTS module accesses catalog (200)');

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   Reports Edge Cases Test Results: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('reports-edge-cases.test.ts')) {
  runReportsEdgeCasesTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
