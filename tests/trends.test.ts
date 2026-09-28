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

let guestA: any;
let staffShantanu: any;
let staffSuhani: any;
let serviceCategoryHair: any;
let serviceHaircut: any;
let productCategoryHair: any;
let productShampoo: any;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
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

export async function runTrendsTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Trends & Performance Analytics Test Suite');
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
    // 1. Setup & Authentication
    // -------------------------------------------------------------
    console.log('--- 1. Authentication & Setup ---');

    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminALogin.status === 200, 'Tenant A Admin login returns 200');
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;

    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    assert(adminBLogin.status === 200, 'Tenant B Admin login returns 200');
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;

    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(cashierLogin.status === 200, 'Cashier login returns 200');
    cashierToken = cashierLogin.data?.data?.token;

    // -------------------------------------------------------------
    // 2. Seed Real Sales Data for Trends Aggregation
    // -------------------------------------------------------------
    console.log('\n--- 2. Seeding Real Sales & Entities for Tenant A ---');

    // Create or find staff members (Shantanu & Suhani)
    staffShantanu = await prisma.staff.findFirst({ where: { tenantId: tenantAId, name: 'Shantanu' } });
    if (!staffShantanu) {
      staffShantanu = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'Shantanu',
          isActive: true,
        },
      });
    }

    staffSuhani = await prisma.staff.findFirst({ where: { tenantId: tenantAId, name: 'Suhani Pareek' } });
    if (!staffSuhani) {
      staffSuhani = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'Suhani Pareek',
          isActive: true,
        },
      });
    }

    // Service category & service
    serviceCategoryHair = await prisma.serviceCategory.findFirst({
      where: { tenantId: tenantAId, name: 'Hair' },
    });
    if (!serviceCategoryHair) {
      serviceCategoryHair = await prisma.serviceCategory.create({
        data: {
          tenantId: tenantAId,
          name: 'Hair',
          isActive: true,
        },
      });
    }

    serviceHaircut = await prisma.service.findFirst({
      where: { tenantId: tenantAId, name: 'Haircut & Styling' },
    });
    if (!serviceHaircut) {
      serviceHaircut = await prisma.service.create({
        data: {
          tenantId: tenantAId,
          categoryId: serviceCategoryHair.id,
          name: 'Haircut & Styling',
          price: 1500,
          isActive: true,
          durationMinutes: 45,
        },
      });
    }

    // Product category & product
    productCategoryHair = await prisma.productCategory.findFirst({
      where: { tenantId: tenantAId, name: 'Wella' },
    });
    if (!productCategoryHair) {
      productCategoryHair = await prisma.productCategory.create({
        data: {
          tenantId: tenantAId,
          name: 'Wella',
          isActive: true,
        },
      });
    }

    productShampoo = await prisma.product.findFirst({
      where: { tenantId: tenantAId, name: 'Wella Professional Shampoo' },
    });
    if (!productShampoo) {
      productShampoo = await prisma.product.create({
        data: {
          tenantId: tenantAId,
          categoryId: productCategoryHair.id,
          name: 'Wella Professional Shampoo',
          price: 850,
          isActive: true,
        },
      });
    }

    // Guest in Kalyaninagar store
    guestA = await prisma.guest.findFirst({
      where: { tenantId: tenantAId, store: 'kalyaninagar' },
    });
    if (!guestA) {
      guestA = await prisma.guest.create({
        data: {
          tenantId: tenantAId,
          name: 'Ananya Deshmukh',
          mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          store: 'kalyaninagar',
          customerType: 'REGULAR',
        },
      });
    }

    // Create completed POS order with Service & Product
    const now = new Date();
    const order1 = await prisma.posOrder.create({
      data: {
        tenantId: tenantAId,
        orderNumber: `ORD-${Date.now()}-1`,
        guestId: guestA.id,
        status: 'COMPLETED',
        orderDate: now,
        subtotal: 2350,
        taxAmount: 250,
        totalAmount: 2600,
        paymentMethod: 'CASH',
        giftCardAmount: 200,
        items: {
          create: [
            {
              tenantId: tenantAId,
              itemType: 'SERVICE',
              serviceId: serviceHaircut.id,
              staffId: staffShantanu.id,
              itemName: 'Haircut & Styling',
              quantity: 1,
              unitPrice: 1500,
              subtotal: 1500,
              total: 1750,
            },
            {
              tenantId: tenantAId,
              itemType: 'PRODUCT',
              productId: productShampoo.id,
              staffId: staffSuhani.id,
              itemName: 'Wella Professional Shampoo',
              quantity: 1,
              unitPrice: 850,
              subtotal: 850,
              total: 850,
            },
          ],
        },
      },
    });
    assert(!!order1.id, 'Created seed POS order with Service and Product items');

    // Create Guest Membership attributed to Shantanu
    const membership1 = await prisma.guestMembership.create({
      data: {
        tenantId: tenantAId,
        guestId: guestA.id,
        staffId: staffShantanu.id,
        name: 'Gold VIP Membership',
        invoiceNumber: `INV-MB-${Date.now()}`,
        membershipCode: `MB-${Date.now()}`,
        planFee: 5000,
        totalCredit: 5000,
        remainingCredit: 5000,
        validityDays: 365,
        purchaseDate: now,
        expiryDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
        status: 'ACTIVE',
      },
    });
    assert(!!membership1.id, 'Created seed Guest Membership (5000 plan fee)');

    // Create Guest Package
    const package1 = await prisma.guestPackage.create({
      data: {
        tenantId: tenantAId,
        guestId: guestA.id,
        name: 'Bridal Package',
        invoiceNumber: `INV-PKG-${Date.now()}`,
        price: 3500,
        validityDays: 90,
        totalSessions: 5,
        remainingSessions: 5,
        purchaseDate: now,
        expiryDate: new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()),
        status: 'ACTIVE',
      },
    });
    assert(!!package1.id, 'Created seed Guest Package (3500 price)');

    // -------------------------------------------------------------
    // 3. GET /api/trends/locations
    // -------------------------------------------------------------
    console.log('\n--- 3. Locations / Branch Selector ---');

    const locRes = await request('GET', '/api/trends/locations', undefined, adminAToken);
    assert(locRes.status === 200, 'GET /api/trends/locations returns 200');
    assert(Array.isArray(locRes.data?.data), 'Locations returns an array');
    const hasKalyaninagar = locRes.data?.data?.some(
      (l: any) => l.id.toLowerCase() === 'kalyaninagar' || l.name.toLowerCase() === 'kalyaninagar'
    );
    assert(hasKalyaninagar, 'Locations includes Kalyaninagar store');

    // -------------------------------------------------------------
    // 4. GET /api/trends/categories
    // -------------------------------------------------------------
    console.log('\n--- 4. Categories Tabs ---');

    const catRes = await request('GET', '/api/trends/categories', undefined, adminAToken);
    assert(catRes.status === 200, 'GET /api/trends/categories returns 200');
    assert(
      JSON.stringify(catRes.data?.data) === JSON.stringify(['overall', 'service', 'product', 'staff']),
      'Returns all 4 categories: overall, service, product, staff'
    );

    // -------------------------------------------------------------
    // 5. GET /api/trends/series (Multi-Select Options)
    // -------------------------------------------------------------
    console.log('\n--- 5. Series Options per Category ---');

    // Overall series
    const seriesOverallRes = await request('GET', '/api/trends/series', undefined, adminAToken, {
      category: 'overall',
    });
    assert(seriesOverallRes.status === 200, 'GET /api/trends/series?category=overall returns 200');
    assert(
      seriesOverallRes.data?.data?.includes('Total') &&
      seriesOverallRes.data?.data?.includes('Service') &&
      seriesOverallRes.data?.data?.includes('Product') &&
      seriesOverallRes.data?.data?.includes('Package') &&
      seriesOverallRes.data?.data?.includes('Membership') &&
      seriesOverallRes.data?.data?.includes('Gift Card'),
      'Overall series contains all 6 series options'
    );

    // Service series
    const seriesServiceRes = await request('GET', '/api/trends/series', undefined, adminAToken, {
      category: 'service',
    });
    assert(seriesServiceRes.status === 200, 'GET /api/trends/series?category=service returns 200');
    assert(seriesServiceRes.data?.data?.includes('Hair'), 'Service series contains Hair category');

    // Product series
    const seriesProductRes = await request('GET', '/api/trends/series', undefined, adminAToken, {
      category: 'product',
    });
    assert(seriesProductRes.status === 200, 'GET /api/trends/series?category=product returns 200');
    assert(seriesProductRes.data?.data?.includes('Wella'), 'Product series contains Wella brand/category');

    // Staff series
    const seriesStaffRes = await request('GET', '/api/trends/series', undefined, adminAToken, {
      category: 'staff',
    });
    assert(seriesStaffRes.status === 200, 'GET /api/trends/series?category=staff returns 200');
    assert(
      seriesStaffRes.data?.data?.includes('Shantanu') && seriesStaffRes.data?.data?.includes('Suhani Pareek'),
      'Staff series contains Shantanu and Suhani Pareek'
    );

    // -------------------------------------------------------------
    // 6. GET /api/trends/revenue-split (All 7 Periods & Categories)
    // -------------------------------------------------------------
    console.log('\n--- 6. Revenue Split Periods & Categories ---');

    // Test all 7 periods
    const periods = ['1D', '7D', '14D', '1M', '2M', 'YTD', '1Y'];
    for (const p of periods) {
      const revRes = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
        category: 'overall',
        period: p,
      });
      assert(revRes.status === 200, `GET /api/trends/revenue-split with period=${p} returns 200`);
      assert(revRes.data?.data?.data?.length === 6, `Period ${p} returns 6 items in overall split`);
    }

    // Verify 14D overall split calculation
    const rev14Res = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'overall',
      period: '14D',
      location: 'kalyaninagar',
    });
    assert(rev14Res.status === 200, 'GET /api/trends/revenue-split 14D Kalyaninagar returns 200');
    const splitData = rev14Res.data?.data?.data || [];
    const serviceItem = splitData.find((d: any) => d.key === 'Service');
    const productItem = splitData.find((d: any) => d.key === 'Product');
    const packageItem = splitData.find((d: any) => d.key === 'Package');
    const membershipItem = splitData.find((d: any) => d.key === 'Membership');
    const giftCardItem = splitData.find((d: any) => d.key === 'Gift Card');
    const totalItem = splitData.find((d: any) => d.key === 'Total');

    assert(serviceItem?.amount >= 1750, 'Service revenue is >= 1750');
    assert(productItem?.amount >= 850, 'Product revenue is >= 850');
    assert(packageItem?.amount >= 3500, 'Package revenue is >= 3500');
    assert(membershipItem?.amount >= 5000, 'Membership revenue is >= 5000');
    assert(giftCardItem?.amount >= 200, 'Gift card amount is >= 200');
    assert(totalItem?.amount >= 11300, 'Overall total revenue correctly aggregates all streams');

    // Category = service
    const revServiceRes = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'service',
      period: '14D',
    });
    assert(revServiceRes.status === 200, 'GET /api/trends/revenue-split category=service returns 200');
    const hairService = revServiceRes.data?.data?.data?.find((d: any) => d.key === 'Hair');
    assert(hairService?.amount >= 1750, 'Service category "Hair" has amount >= 1750');

    // Category = product
    const revProductRes = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'product',
      period: '14D',
    });
    assert(revProductRes.status === 200, 'GET /api/trends/revenue-split category=product returns 200');
    const wellaProduct = revProductRes.data?.data?.data?.find((d: any) => d.key === 'Wella');
    assert(wellaProduct?.amount >= 850, 'Product category "Wella" has amount >= 850');

    // Category = staff
    const revStaffRes = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'staff',
      period: '14D',
    });
    assert(revStaffRes.status === 200, 'GET /api/trends/revenue-split category=staff returns 200');
    const shantanuStaff = revStaffRes.data?.data?.data?.find((d: any) => d.key === 'Shantanu');
    const suhaniStaff = revStaffRes.data?.data?.data?.find((d: any) => d.key === 'Suhani Pareek');
    assert(shantanuStaff?.amount >= 6750, 'Shantanu has service (1750) + membership (5000) = 6750');
    assert(suhaniStaff?.amount >= 850, 'Suhani Pareek has product revenue 850');

    // -------------------------------------------------------------
    // 7. GET /api/trends/time-series (All 6 Trend Periods)
    // -------------------------------------------------------------
    console.log('\n--- 7. Time-Series Trends & Multi-Select Series ---');

    const trendPeriods = ['Week', 'Month', '3M', '6M', '1Y', '5Y'];
    for (const tp of trendPeriods) {
      const tsRes = await request('GET', '/api/trends/time-series', undefined, adminAToken, {
        category: 'overall',
        period: tp,
      });
      assert(tsRes.status === 200, `GET /api/trends/time-series period=${tp} returns 200`);
      assert(Array.isArray(tsRes.data?.data?.intervals), `Period ${tp} intervals is array`);
      assert(tsRes.data?.data?.intervals.length > 0, `Period ${tp} has at least 1 interval`);
      // Verify interval structure for tooltips
      const first = tsRes.data?.data?.intervals[0];
      assert(!!first.period && !!first.date && typeof first.values === 'object', `Period ${tp} intervals include period, date, values`);
    }

    // Multi-select series filter
    const tsMultiRes = await request('GET', '/api/trends/time-series', undefined, adminAToken, {
      category: 'overall',
      period: 'Month',
      selected_series: 'Total,Service',
    });
    assert(tsMultiRes.status === 200, 'GET /api/trends/time-series with selected_series=Total,Service returns 200');
    assert(
      tsMultiRes.data?.data?.selectedSeries?.length === 2 &&
      tsMultiRes.data?.data?.selectedSeries?.includes('Total') &&
      tsMultiRes.data?.data?.selectedSeries?.includes('Service'),
      'Filtered selectedSeries contains only Total and Service'
    );

    // -------------------------------------------------------------
    // 8. GET /api/trends/dashboard (Unified Endpoint)
    // -------------------------------------------------------------
    console.log('\n--- 8. Unified Dashboard Endpoint ---');

    const dashRes = await request('GET', '/api/trends/dashboard', undefined, adminAToken, {
      location: 'kalyaninagar',
      category: 'overall',
      revenue_period: '14D',
      trend_period: 'Month',
    });
    assert(dashRes.status === 200, 'GET /api/trends/dashboard returns 200');
    assert(dashRes.data?.data?.location === 'kalyaninagar', 'Dashboard returns active location');
    assert(Array.isArray(dashRes.data?.data?.locations), 'Dashboard returns locations list');
    assert(Array.isArray(dashRes.data?.data?.seriesOptions), 'Dashboard returns seriesOptions');
    assert(!!dashRes.data?.data?.revenueSplit, 'Dashboard includes revenueSplit data');
    assert(!!dashRes.data?.data?.trends, 'Dashboard includes trends time-series data');

    // -------------------------------------------------------------
    // 9. Multi-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- 9. Multi-Tenant Isolation ---');

    const dashBRes = await request('GET', '/api/trends/dashboard', undefined, adminBToken);
    assert(dashBRes.status === 200, 'Tenant B Admin can access trends dashboard');
    // Ensure Tenant B cannot see Tenant A's sales
    const tenantBTotal = dashBRes.data?.data?.revenueSplit?.total || 0;
    assert(
      tenantBTotal === 0,
      `Tenant B revenue is isolated and zero (observed: ${tenantBTotal})`
    );

    // -------------------------------------------------------------
    // 10. Cashier Access
    // -------------------------------------------------------------
    console.log('\n--- 10. Role-Based Access (Cashier) ---');

    const cashierDash = await request('GET', '/api/trends/dashboard', undefined, cashierToken);
    assert(cashierDash.status === 200, 'Cashier with reports/trends access returns 200');

    // -------------------------------------------------------------
    // 11. Validation & Error Handling
    // -------------------------------------------------------------
    console.log('\n--- 11. Validation & Edge Cases ---');

    const invalidCat = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'invalid_category' as any,
    });
    assert(invalidCat.status === 400, 'Invalid category returns 400 Bad Request');

    const invalidPeriod = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      period: '99D' as any,
    });
    assert(invalidPeriod.status === 400, 'Invalid revenue period returns 400 Bad Request');

    // -------------------------------------------------------------
    // 12. CSV Exports & Advanced Reporting
    // -------------------------------------------------------------
    console.log('\n--- 12. CSV Exports & Advanced Analytics ---');

    const revSplitCsv = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'overall',
      period: '14D',
      export: 'csv',
    });
    assert(revSplitCsv.status === 200, 'Revenue Split CSV export returns 200 OK');
    assert(revSplitCsv.headers.get('content-type')?.includes('text/csv') || false, 'Revenue Split CSV has text/csv content type');
    assert(revSplitCsv.text.includes('Category') && revSplitCsv.text.includes('Amount (INR)'), 'Revenue Split CSV contains required headers');

    const productSplitCsv = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'product',
      period: '1M',
      export: 'csv',
    });
    assert(productSplitCsv.status === 200, 'Product Revenue Split CSV export returns 200 OK');
    assert(productSplitCsv.text.includes('product'), 'Product Revenue Split CSV contains product category');

    const staffSplitCsv = await request('GET', '/api/trends/revenue-split', undefined, adminAToken, {
      category: 'staff',
      period: '2M',
      export: 'csv',
    });
    assert(staffSplitCsv.status === 200, 'Staff Revenue Split CSV export returns 200 OK');

    const timeSeriesCsv = await request('GET', '/api/trends/time-series', undefined, adminAToken, {
      category: 'overall',
      period: 'Month',
      export: 'csv',
    });
    assert(timeSeriesCsv.status === 200, 'Time-Series Trends CSV export returns 200 OK');
    assert(timeSeriesCsv.headers.get('content-type')?.includes('text/csv') || false, 'Time-Series CSV has text/csv content type');
    assert(timeSeriesCsv.text.includes('Interval Period') && timeSeriesCsv.text.includes('Interval Date'), 'Time-Series CSV contains period and date headers');

    console.log('\n================================================================');
    console.log(`   TRENDS TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Unexpected error during trends testing:', err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise<void>((res) => server.close(() => res()));
    }
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith('trends.test.ts')) {
  runTrendsTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
