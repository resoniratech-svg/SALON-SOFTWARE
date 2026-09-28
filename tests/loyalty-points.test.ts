import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let receptionistToken: string;
let tenantId: string;
let testGuestId: string;
let testStaffId: string;
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
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

export async function runLoyaltyTests() {
  console.log('\n================================================================');
  console.log('   Loyalty Points Module: Comprehensive End-to-End Test Suite');
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
    assert(Boolean(adminToken && tenantId), 'Admin token and tenant context retrieved');

    // Enable modules
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { enabledModules: ['SETTINGS', 'GUESTS', 'POS', 'REPORTS'] },
    });

    // Login Cashier (Non-admin)
    const loginCashier = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(loginCashier.status === 200, 'Cashier logs in successfully (200)');
    receptionistToken = loginCashier.data?.data?.token;

    // Get or create staff
    let staff = await prisma.staff.findFirst({ where: { tenantId, isActive: true } });
    if (!staff) {
      staff = await prisma.staff.create({
        data: {
          tenantId,
          name: 'Priya Stylist',
          gender: 'FEMALE',
          designation: 'Senior Stylist',
          category: 'SALON',
          isActive: true,
        },
      });
    }
    testStaffId = staff.id;

    // Get or create service
    let service = await prisma.service.findFirst({ where: { tenantId, isActive: true } });
    if (!service) {
      service = await prisma.service.create({
        data: {
          tenantId,
          name: 'Hair Spa & Conditioning',
          price: 2000,
          salePrice: 2000,
          durationMinutes: 60,
          isActive: true,
        },
      });
    }
    testServiceId = service.id;

    // Get or create guest
    const guestMobile = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const guest = await prisma.guest.create({
      data: {
        tenantId,
        name: 'Aishwarya Sharma',
        mobile: guestMobile,
        email: `aishwarya.${Date.now()}@example.com`,
        customerType: 'VIP',
        loyaltyPoints: 100, // Starts with 100 points
      },
    });
    testGuestId = guest.id;

    assert(Boolean(testStaffId && testServiceId && testGuestId), 'Staff, Service, and Guest test fixtures ready');

    // -------------------------------------------------------------
    // 1. Loyalty Settings Configuration (frame_068.jpg & frame_069.jpg alignment)
    // -------------------------------------------------------------
    console.log('\n--- 1. Loyalty Settings Configuration (Settings Screen) ---');
    const getSettingsRes = await request('GET', '/api/settings/loyalty', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getSettingsRes.status === 200, 'GET /api/settings/loyalty returns 200 OK');
    assert(getSettingsRes.data.data !== undefined, 'Settings data object exists');
    assert(typeof getSettingsRes.data.data.earnSummary === 'string', 'earnSummary label generated');
    assert(typeof getSettingsRes.data.data.redeemSummary === 'string', 'redeemSummary label generated');

    // Update loyalty settings with UI aliases matching frame_068.jpg
    const updatePayload = {
      loyaltyEnabled: true,
      earnIndividually: true,
      skipOnRedemption: true,
      earnOnMembership: true,
      earnAmount: 20,
      earnPoints: 1,
      redeemIndividually: true,
      redeemPoints: 1,
      redeemAmount: 1,
      minRedeemPoints: 20,
      maxRedeemPointsPerOrder: 150,
      maxRedeemPercentage: 50,
      loyaltyExpiryDays: 180,
    };

    const updateRes = await request('PUT', '/api/settings/loyalty', updatePayload, {
      Authorization: `Bearer ${adminToken}`,
    });

    assert(updateRes.status === 200, 'PUT /api/settings/loyalty returns 200 OK');
    assert(updateRes.data.data.loyaltyEnabled === true, 'loyaltyEnabled is true');
    assert(updateRes.data.data.minRedeemPoints === 20, 'minRedeemPoints set to 20');
    assert(updateRes.data.data.maxRedeemPointsPerOrder === 150, 'maxRedeemPointsPerOrder set to 150');
    assert(updateRes.data.data.maxRedeemPercentage === 50, 'maxRedeemPercentage set to 50%');
    assert(updateRes.data.data.earnSummary.includes('Every ₹20 Spent'), 'earnSummary includes ₹20 spent ratio');
    assert(updateRes.data.data.redeemSummary.includes('Redeem ₹1 on Every 1 Point'), 'redeemSummary matches 1:1 redemption ratio');

    // -------------------------------------------------------------
    // 2. CRM Guest 360 & Loyalty Ledger Transactions
    // -------------------------------------------------------------
    console.log('\n--- 2. CRM Guest 360 & Wallet Loyalty Transactions ---');
    const guest360Initial = await request('GET', `/api/guests/${testGuestId}/360`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(guest360Initial.status === 200, 'GET /api/guests/:id/360 returns 200 OK');
    assert(guest360Initial.data.data.profileInfo.loyaltyPoints === 100, 'Initial guest loyaltyPoints is 100');
    assert(guest360Initial.data.data.wallet.loyaltyPoints === 100, 'Wallet loyaltyPoints matches 100');

    // Credit bonus loyalty points via wallet ledger
    const creditRes = await request(
      'POST',
      `/api/guests/${testGuestId}/wallet/transactions`,
      {
        type: 'LOYALTY_CREDIT',
        amount: 50,
        paymentMethod: 'Festive Bonus',
        notes: 'Diwali Festive Loyalty Points Credit',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(creditRes.status === 201, 'POST /wallet/transactions (LOYALTY_CREDIT) returns 201');
    assert(Number(creditRes.data.data.runningBalance) === 150, 'Running balance updated to 150');

    // Verify 360 profile reflects updated balance
    const guest360AfterCredit = await request('GET', `/api/guests/${testGuestId}/360`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(guest360AfterCredit.data.data.profileInfo.loyaltyPoints === 150, 'Guest loyaltyPoints incremented to 150');

    // Manual Debit
    const debitRes = await request(
      'POST',
      `/api/guests/${testGuestId}/wallet/transactions`,
      {
        type: 'LOYALTY_DEBIT',
        amount: 30,
        notes: 'Manual Points Adjustment',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(debitRes.status === 201, 'POST /wallet/transactions (LOYALTY_DEBIT) returns 201');
    assert(Number(debitRes.data.data.runningBalance) === 120, 'Running balance decremented to 120');

    // Insufficient balance rejection
    const overDebitRes = await request(
      'POST',
      `/api/guests/${testGuestId}/wallet/transactions`,
      {
        type: 'LOYALTY_DEBIT',
        amount: 500, // Available is 120
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(overDebitRes.status === 400, 'Over-debit rejected with HTTP 400 Bad Request');

    // -------------------------------------------------------------
    // 3. POS Order Calculation with Loyalty Redemption
    // -------------------------------------------------------------
    console.log('\n--- 3. POS Order Calculation & Loyalty Validation ---');
    // Calculate with valid redemption (Redeem 40 points on ₹2000 service)
    const calcRes = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: testGuestId,
        redeemLoyaltyPoints: 40,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: testServiceId,
            staffId: testStaffId,
            quantity: 1,
            unitPrice: 2000,
          },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(calcRes.status === 200, 'POST /api/pos/calculate with loyalty returns 200 OK');
    assert(calcRes.data.data.loyaltyDiscount === 40, 'loyaltyDiscount is ₹40 (40 points * ₹1)');
    assert(calcRes.data.data.loyaltyPointsRedeemed === 40, 'loyaltyPointsRedeemed is 40');
    assert(Number(calcRes.data.data.taxableAmount) === 1960, 'taxableAmount is ₹1960 (2000 - 40)');
    assert(Number(calcRes.data.data.totalAmount) >= 1960, 'totalAmount reflects discounted total');

    // Edge case: Below minRedeemPoints (min is 20, attempt 10)
    const belowMinCalc = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: testGuestId,
        redeemLoyaltyPoints: 10,
        items: [{ itemType: 'SERVICE', serviceId: testServiceId, staffId: testStaffId, quantity: 1, unitPrice: 1000 }],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(belowMinCalc.status === 400, 'Redemption below minRedeemPoints rejected with 400');

    // Edge case: Above guest balance (guest has 120, attempt 130)
    const overBalanceCalc = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: testGuestId,
        redeemLoyaltyPoints: 130,
        items: [{ itemType: 'SERVICE', serviceId: testServiceId, staffId: testStaffId, quantity: 1, unitPrice: 2000 }],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(overBalanceCalc.status === 400, 'Redemption exceeding guest balance rejected with 400');

    // -------------------------------------------------------------
    // 4. POS Order Checkout & Full Points Earning / Redemption Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- 4. POS Order Checkout & Automated Balance Settlement ---');
    // Configure earning on orders:
    // earnAmount: 20, earnPoints: 1 => 0.05 pts/rupee.
    // Allow earning even when redeeming: set skipOnRedemption: false for this test
    await request(
      'PUT',
      '/api/settings/loyalty',
      {
        loyaltyEnabled: true,
        skipOnRedemption: false,
        pointsPerCurrency: 0.05, // 1 pt per ₹20
        currencyPerPoint: 1,
        minRedeemPoints: 20,
        maxRedeemPointsPerOrder: 100,
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    // Current guest loyalty balance is 120.
    // Order: ₹2000 service. Redeem 50 points (₹50 discount).
    // Net spend: ₹1950.
    // Points to earn: 1950 * 0.05 = 97 points.
    // Expected final balance: 120 - 50 + 97 = 167 points.
    const createOrderRes = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: testGuestId,
        redeemLoyaltyPoints: 50,
        paymentMethod: 'CASH',
        items: [
          {
            itemType: 'SERVICE',
            serviceId: testServiceId,
            staffId: testStaffId,
            quantity: 1,
            unitPrice: 2000,
          },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert(createOrderRes.status === 201, 'POST /api/pos/orders created order with HTTP 201');
    const orderData = createOrderRes.data.data;
    assert(orderData.loyaltyPointsRedeemed === 50, 'Order tracks loyaltyPointsRedeemed: 50');
    assert(Number(orderData.loyaltyDiscount) === 50, 'Order tracks loyaltyDiscount: ₹50');
    assert(orderData.loyaltyPointsEarned === 97, 'Order tracks loyaltyPointsEarned: 97');
    assert(Number(orderData.subtotal) - Number(orderData.loyaltyDiscount) === 1950, 'Order net taxable spend is ₹1950');
    assert(Number(orderData.totalAmount) >= 1950, 'Order totalAmount reflects discounted total');

    // Verify Guest 360 profile has both debit and credit wallet ledger entries
    const guest360Final = await request('GET', `/api/guests/${testGuestId}/360`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(guest360Final.data.data.profileInfo.loyaltyPoints === 167, 'Guest final loyaltyPoints is exactly 167 (120 - 50 + 97)');

    const txTypes = guest360Final.data.data.wallet.transactions.map((t: any) => t.type);
    assert(txTypes.includes('LOYALTY_DEBIT'), 'Wallet ledger records LOYALTY_DEBIT for checkout redemption');
    assert(txTypes.includes('LOYALTY_CREDIT'), 'Wallet ledger records LOYALTY_CREDIT for checkout earning');

    // -------------------------------------------------------------
    // 5. Reports Integration: Loyalty Points Analytics
    // -------------------------------------------------------------
    console.log('\n--- 5. Reports Integration (Loyalty Points Report) ---');
    const catalogRes = await request('GET', '/api/reports/catalog', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(catalogRes.status === 200, 'GET /api/reports/catalog returns 200 OK');
    const hasLoyaltyReport = catalogRes.data.data.reports.some((r: any) => r.id === 'loyalty-points');
    assert(hasLoyaltyReport, 'Catalog includes loyalty-points report');

    const todayStr = new Date().toISOString().slice(0, 10);
    const reportRes = await request(
      'GET',
      `/api/reports/loyalty-points?startDate=${todayStr}&endDate=${todayStr}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(reportRes.status === 200, 'GET /api/reports/loyalty-points returns 200 OK');
    const repData = reportRes.data?.data;
    if (!repData || !repData.totals) {
      console.log('Report response:', JSON.stringify(reportRes.data, null, 2));
    }
    assert(repData?.totals?.totalPointsRedeemed >= 50, `Report tracks redeemed points total (>= 50), got: ${repData?.totals?.totalPointsRedeemed}`);
    assert(repData?.totals?.totalLoyaltyDiscount >= 50, `Report tracks total loyalty discount (>= ₹50), got: ${repData?.totals?.totalLoyaltyDiscount}`);
    assert(repData?.totals?.activePointsLiability >= 167, `Report tracks active salon points liability (>= 167), got: ${repData?.totals?.activePointsLiability}`);
    assert(Array.isArray(repData?.topLoyaltyGuests), 'Report includes topLoyaltyGuests list');
    assert(Array.isArray(repData?.rows), 'Report includes transaction audit rows');

    // -------------------------------------------------------------
    // 6. RBAC & Security Protections
    // -------------------------------------------------------------
    console.log('\n--- 6. Security & RBAC Enforcement ---');
    // Non-admin attempting to update loyalty settings
    const forbiddenRes = await request(
      'PUT',
      '/api/settings/loyalty',
      { loyaltyEnabled: false },
      { Authorization: `Bearer ${receptionistToken}` }
    );
    assert(forbiddenRes.status === 403, `Non-admin PUT /api/settings/loyalty rejected with HTTP 403, got: ${forbiddenRes.status} ${JSON.stringify(forbiddenRes.data)}`);

    // Unauthenticated request
    const unauthRes = await request('GET', '/api/settings/loyalty');
    assert(unauthRes.status === 401, 'Unauthenticated GET /api/settings/loyalty rejected with HTTP 401');

    console.log('\n================================================================');
    console.log(`   Loyalty Points Tests: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runLoyaltyTests();
