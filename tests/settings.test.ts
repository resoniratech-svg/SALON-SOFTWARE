import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let superToken: string;
let adminAToken: string;
let adminBToken: string;
let cashierToken: string;

let tenantAId: string;
let tenantBId: string;
let cashierUserId: string;

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
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Settings Module: Complete Test & Security Suite');
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
    // -------------------------------------------------------------------------
    // 1. SETUP & AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('--- 1. Setup & Authentication ---');

    const superLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(superLogin.status === 200, 'SuperAdmin login returns 200');
    superToken = superLogin.data?.data?.token;

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
    cashierUserId = cashierLogin.data?.data?.user?.id;

    // Ensure Tenant A and B have SETTINGS enabled in tenant modules
    for (const tid of [tenantAId, tenantBId]) {
      const t = await prisma.tenant.findUnique({ where: { id: tid }, select: { enabledModules: true } });
      const mods = (Array.isArray(t?.enabledModules) ? t?.enabledModules : []) as string[];
      if (!mods.includes('SETTINGS')) {
        await prisma.tenant.update({
          where: { id: tid },
          data: { enabledModules: [...mods, 'SETTINGS'] },
        });
      }
    }

    // Ensure Cashier has SETTINGS assigned in their enabledModules
    const cUser = await prisma.user.findUnique({ where: { id: cashierUserId }, select: { enabledModules: true } });
    const cMods = (Array.isArray(cUser?.enabledModules) ? cUser?.enabledModules : []) as string[];
    if (!cMods.includes('SETTINGS')) {
      await prisma.user.update({
        where: { id: cashierUserId },
        data: { enabledModules: [...cMods, 'SETTINGS'] },
      });
    }

    // Re-login cashier to refresh JWT token payload
    const refreshedCashier = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    cashierToken = refreshedCashier.data?.data?.token;

    // Clean up test entities for isolated runs
    await prisma.taxMapping.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.package.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.giftCard.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.coupon.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.expenseTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.pnlCategory.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.pnlIncomeTax.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.crmSegment.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.customForm.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.salutation.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });

    // -------------------------------------------------------------------------
    // 2. AUTHENTICATION & ACCESS CONTROL SECURITY TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Authentication & Access Security ---');

    const noToken = await request('GET', '/api/settings/generic');
    assert(noToken.status === 401, 'Request with no token returns 401 Unauthorized');

    const invalidToken = await request('GET', '/api/settings/generic', undefined, {
      Authorization: 'Bearer invalid.token.signature',
    });
    assert(invalidToken.status === 401, 'Request with invalid token returns 401 Unauthorized');

    // Cashier allowed operational read of generic settings
    const cashierReadGeneric = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierReadGeneric.status === 200, 'Cashier can read operational generic business settings (200)');

    // Cashier FORBIDDEN from updating settings (403)
    const cashierWriteGeneric = await request('PUT', '/api/settings/generic', {
      businessStatus: 'CLOSED',
    }, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierWriteGeneric.status === 403, 'Cashier forbidden from modifying business settings (403)');

    // -------------------------------------------------------------------------
    // 3. GENERIC / BUSINESS SETTINGS (Area 20)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Generic / Business Settings ---');

    const getGenA = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getGenA.status === 200, 'Admin A can fetch generic settings (200)');
    assert(getGenA.data?.data?.businessStatus === 'OPEN', 'Default business status is OPEN');

    const updateGenA = await request('PUT', '/api/settings/generic', {
      businessStatus: 'OPEN',
      openingTime: '09:00 AM',
      closingTime: '10:00 PM',
      genderSpecification: 'Both',
      weeklyOffDays: [0], // Sunday
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateGenA.status === 200, 'Admin A updates generic business settings (200)');
    assert(updateGenA.data?.data?.openingTime === '09:00 AM', 'Opening time updated to 09:00 AM');
    assert(Array.isArray(updateGenA.data?.data?.weeklyOffDays) && updateGenA.data?.data?.weeklyOffDays[0] === 0, 'Weekly off day set to Sunday');

    // Tenant B isolation: Company B still has default or its own settings
    const getGenB = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(getGenB.status === 200, 'Admin B fetches independent generic settings (200)');
    assert(getGenB.data?.data?.openingTime !== '09:00 AM', 'Tenant A generic settings did not leak to Tenant B');

    // -------------------------------------------------------------------------
    // 4. PRODUCT ORDERING SETTINGS (Area 19)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Product Ordering Settings ---');

    const updateOrdering = await request('PUT', '/api/settings/product-ordering', {
      homeDeliveryEnabled: true,
      pickupEnabled: true,
      codEnabled: false,
      cashOnPickupEnabled: true,
      minOrderValue: 500,
      deliveryFee: 50,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateOrdering.status === 200, 'Admin A updates product ordering settings (200)');
    assert(updateOrdering.data?.data?.minOrderValue === 500, 'Minimum order value is 500');
    assert(updateOrdering.data?.data?.codEnabled === false, 'COD disabled');

    // Cashier read operational ordering settings
    const cashierReadOrdering = await request('GET', '/api/settings/product-ordering', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierReadOrdering.status === 200, 'Cashier reads operational product ordering settings (200)');
    assert(cashierReadOrdering.data?.data?.minOrderValue === 500, 'Cashier sees correct min order value');

    // Negative value validation
    const invalidOrdering = await request('PUT', '/api/settings/product-ordering', {
      minOrderValue: -100,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(invalidOrdering.status === 400, 'Negative minOrderValue rejected with 400');

    // -------------------------------------------------------------------------
    // 5. ONLINE PAYMENT SETTINGS & SENSITIVE DATA PROTECTION (Area 18)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Online Payment Settings & Security ---');

    const updatePayment = await request('PUT', '/api/settings/payments', {
      onlinePaymentEnabled: true,
      paymentGateways: [
        {
          provider: 'Razorpay',
          isActive: true,
          keyId: 'rzp_test_1234567890',
          keySecret: 'SuperSecretKey999!',
          webhookSecret: 'WebhookSecret123!',
          merchantId: 'MID_123',
        },
      ],
      applyToOrders: true,
      applyToAppointments: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updatePayment.status === 200, 'Admin updates online payment gateway config (200)');

    const adminGetPayment = await request('GET', '/api/settings/payments', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(adminGetPayment.status === 200, 'Admin fetches online payment settings');
    const gateway = adminGetPayment.data?.data?.paymentGateways?.[0];
    assert(gateway?.keyId?.includes('***'), 'Admin keyId is masked (contains ***)');
    assert(gateway?.secretConfigured === true, 'Admin sees secretConfigured: true');
    assert(gateway?.keySecret === undefined, 'Admin response DOES NOT return keySecret in plain text');
    assert(gateway?.webhookSecret === undefined, 'Admin response DOES NOT return webhookSecret in plain text');

    // Cashier operational view: completely stripped of keys
    const cashierGetPayment = await request('GET', '/api/settings/payments', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierGetPayment.status === 200, 'Cashier fetches operational payment methods');
    const cashierGateway = cashierGetPayment.data?.data?.paymentGateways?.[0];
    assert(cashierGateway?.provider === 'Razorpay', 'Cashier sees active payment provider');
    assert(cashierGateway?.keyId === undefined, 'Cashier response NEVER contains keyId');
    assert(cashierGateway?.secretConfigured === undefined, 'Cashier response NEVER contains secret info');

    // -------------------------------------------------------------------------
    // 6. NOTIFICATION SETTINGS (Area 17)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Notification Settings ---');

    const updateNotif = await request('PUT', '/api/settings/notifications', {
      notificationsConfig: {
        smsEnabled: true,
        emailEnabled: true,
        whatsappEnabled: false,
        events: {
          appointmentBooked: true,
          invoiceGenerated: true,
        },
        smsProvider: {
          provider: 'Twilio',
          senderId: 'QUBEXE SALOON SOFTWARE',
          apiKey: 'secret_sms_key_xyz',
        },
      },
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateNotif.status === 200, 'Admin updates notification settings (200)');
    assert(updateNotif.data?.data?.notificationsConfig?.smsProvider?.apiKey === '***CONFIGURED***', 'Notification API key masked in response');

    // Cashier forbidden from sensitive notification settings
    const cashierGetNotif = await request('GET', '/api/settings/notifications', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierGetNotif.status === 403, 'Cashier forbidden from reading notification credentials (403)');

    // -------------------------------------------------------------------------
    // 7. FEEDBACK SETTINGS (Area 16)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Feedback Settings ---');

    const updateFeedback = await request('PUT', '/api/settings/feedback', {
      feedbackEnabled: true,
      ratingScale: 5,
      sendFeedbackSms: true,
      sendFeedbackEmail: false,
      feedbackQuestions: [
        { id: 'q1', question: 'How was your haircut experience?', type: 'RATING', required: true },
      ],
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateFeedback.status === 200, 'Admin updates feedback settings (200)');
    assert(updateFeedback.data?.data?.ratingScale === 5, 'Feedback rating scale is 5');

    // -------------------------------------------------------------------------
    // 8. REFERRAL & LOYALTY SETTINGS (Areas 10 & 11)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Referral & Loyalty Settings ---');

    const updateReferral = await request('PUT', '/api/settings/referrals', {
      referralsEnabled: true,
      referrerRewardType: 'POINTS',
      referrerRewardValue: 100,
      refereeRewardType: 'FIXED',
      refereeRewardValue: 50,
      referralMinOrder: 300,
      referralValidityDays: 60,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateReferral.status === 200, 'Admin updates referral settings (200)');
    assert(updateReferral.data?.data?.referrerRewardValue === 100, 'Referrer reward value set to 100');

    const updateLoyalty = await request('PUT', '/api/settings/loyalty', {
      loyaltyEnabled: true,
      pointsPerCurrency: 1, // 1 pt per 100
      currencyPerPoint: 0.5,
      minRedeemPoints: 50,
      maxRedeemPointsPerOrder: 500,
      loyaltyExpiryDays: 365,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateLoyalty.status === 200, 'Admin updates loyalty settings (200)');
    assert(updateLoyalty.data?.data?.minRedeemPoints === 50, 'Minimum redeem points is 50');

    // -------------------------------------------------------------------------
    // 9. INCENTIVE SETTINGS (Area 15)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Incentive Settings ---');

    const updateIncentive = await request('PUT', '/api/settings/incentives', {
      incentiveEnabled: true,
      incentiveCalculationType: 'SLAB',
      incentiveRules: [
        { targetType: 'SERVICE', minAmount: 10000, maxAmount: 50000, percentage: 5 },
        { targetType: 'SERVICE', minAmount: 50001, percentage: 10 },
      ],
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateIncentive.status === 200, 'Admin updates incentive rules (200)');
    assert(updateIncentive.data?.data?.incentiveCalculationType === 'SLAB', 'Incentive calculation type is SLAB');

    // -------------------------------------------------------------------------
    // 10. FOOTER, PRIVACY POLICY & TERMS (Areas 23, 24, 25)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Footer, Privacy & Terms Settings ---');

    const updateFooter = await request('PUT', '/api/settings/footer', {
      footerText: '© 2026 QUBEXE SALOON SOFTWARE Luxury Salon. All rights reserved.',
      footerLinks: [{ title: 'Instagram', url: 'https://instagram.com/respark' }],
      contactInfo: { phone: '+1234567890', email: 'info@respark.io' },
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateFooter.status === 200, 'Admin updates footer content (200)');

    const updatePrivacy = await request('PUT', '/api/settings/privacy-policy', {
      privacyPolicy: '# Privacy Policy\nWe protect your privacy.',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updatePrivacy.status === 200, 'Admin updates privacy policy (200)');

    const updateTerms = await request('PUT', '/api/settings/terms-conditions', {
      termsAndConditions: '# Terms and Conditions\nPlease arrive 10 minutes early.',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateTerms.status === 200, 'Admin updates terms and conditions (200)');

    // -------------------------------------------------------------------------
    // 11. TAX MAPPINGS (Area 1)
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Tax Mapping Module ---');

    const createTaxA = await request('POST', '/api/settings/tax-mappings', {
      name: 'GST 5%',
      rate: 5.0,
      isInclusive: false,
      applicableFor: ['SERVICE', 'PRODUCT'],
      isActive: true,
      description: 'Standard 5% goods and service tax',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createTaxA.status === 201, 'Admin A creates tax mapping GST 5% (201)');
    const taxAId = createTaxA.data?.data?.id;

    // Duplicate within Tenant A -> 409 Conflict
    const createTaxADup = await request('POST', '/api/settings/tax-mappings', {
      name: 'GST 5%',
      rate: 5.0,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createTaxADup.status === 409, 'Duplicate tax name in Tenant A rejected with 409 Conflict');

    // Multi-tenant isolation: Tenant B can create identical name 'GST 5%'
    const createTaxB = await request('POST', '/api/settings/tax-mappings', {
      name: 'GST 5%',
      rate: 18.0, // Tenant B has 18%
    }, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(createTaxB.status === 201, 'Tenant B creates GST 5% independently without conflict (201)');
    const taxBId = createTaxB.data?.data?.id;

    // Cross-tenant protection: Tenant A cannot access Tenant B's tax mapping
    const crossTaxGet = await request('GET', `/api/settings/tax-mappings/${taxBId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(crossTaxGet.status === 404, 'Tenant A cannot fetch Tenant B tax mapping (404)');

    // Cashier can read tax mappings for POS calculation
    const cashierGetTaxes = await request('GET', '/api/settings/tax-mappings', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierGetTaxes.status === 200, 'Cashier reads tax mappings for POS (200)');
    assert(Array.isArray(cashierGetTaxes.data?.data) && cashierGetTaxes.data?.data.length >= 1, 'Cashier sees Tenant A tax mapping');

    // Invalid tax rate (> 100%) -> 400
    const invalidTaxRate = await request('POST', '/api/settings/tax-mappings', {
      name: 'Excessive Tax',
      rate: 150,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(invalidTaxRate.status === 400, 'Tax rate > 100 rejected with 400');

    // -------------------------------------------------------------------------
    // 12. MEMBERSHIPS (Area 6)
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Membership Module ---');

    const createMemA = await request('POST', '/api/settings/memberships', {
      name: 'Silver Club',
      price: 1999,
      validityDays: 365,
      renewalReminderDays: 15,
      discountPercentage: 10,
      benefits: '10% off on all hair services',
      isActive: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createMemA.status === 201, 'Admin creates membership Silver Club (201)');
    const memAId = createMemA.data?.data?.id;

    // Duplicate within tenant rejected
    const createMemADup = await request('POST', '/api/settings/memberships', {
      name: 'Silver Club',
      price: 2999,
      validityDays: 180,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createMemADup.status === 409, 'Duplicate membership name rejected with 409 Conflict');

    // Cross-tenant independent creation
    const createMemB = await request('POST', '/api/settings/memberships', {
      name: 'Silver Club',
      price: 2499,
      validityDays: 180,
    }, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(createMemB.status === 201, 'Tenant B creates Silver Club independently (201)');

    // Cashier can read memberships for CRM sales
    const cashierGetMems = await request('GET', '/api/settings/memberships', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierGetMems.status === 200, 'Cashier can list memberships for guest sales (200)');

    // -------------------------------------------------------------------------
    // 13. PACKAGES (Area 7)
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Packages Module ---');

    const createPkgA = await request('POST', '/api/settings/packages', {
      name: 'Hair Care Package',
      price: 4999,
      validityDays: 180,
      renewalReminderDays: 15,
      description: 'Comprehensive hair spa & cut bundle',
      isActive: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPkgA.status === 201, 'Admin creates package Hair Care Package (201)');
    const pkgAId = createPkgA.data?.data?.id;

    const createPkgADup = await request('POST', '/api/settings/packages', {
      name: 'Hair Care Package',
      price: 5999,
      validityDays: 90,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPkgADup.status === 409, 'Duplicate package name in company rejected with 409');

    // -------------------------------------------------------------------------
    // 14. GIFT CARDS (Area 8)
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Gift Cards Module ---');

    const createGcA = await request('POST', '/api/settings/gift-cards', {
      name: 'Festive Voucher 1000',
      code: 'FESTIVE1000',
      amount: 1000,
      validityDays: 90,
      terms: 'Non-refundable, valid on all services',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createGcA.status === 201, 'Admin creates gift card FESTIVE1000 (201)');
    const gcAId = createGcA.data?.data?.id;

    const createGcADup = await request('POST', '/api/settings/gift-cards', {
      name: 'Another Voucher',
      code: 'FESTIVE1000',
      amount: 500,
      validityDays: 30,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createGcADup.status === 409, 'Duplicate gift card code rejected with 409 Conflict');

    // -------------------------------------------------------------------------
    // 15. COUPONS (Area 9)
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Coupons Module ---');

    const createCouponA = await request('POST', '/api/settings/coupons', {
      code: 'WELCOME20',
      description: '20% off on first salon visit',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderValue: 500,
      maxDiscount: 200,
      usageLimit: 100,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createCouponA.status === 201, 'Admin creates coupon WELCOME20 (201)');
    const couponAId = createCouponA.data?.data?.id;

    // Invalid percentage discount > 100
    const invalidCoupon = await request('POST', '/api/settings/coupons', {
      code: 'INVALID120',
      discountType: 'PERCENTAGE',
      discountValue: 120,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(invalidCoupon.status === 400, 'Coupon discount percentage > 100 rejected with 400');

    // Duplicate code within company rejected
    const createCouponADup = await request('POST', '/api/settings/coupons', {
      code: 'WELCOME20',
      discountType: 'FIXED',
      discountValue: 50,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createCouponADup.status === 409, 'Duplicate coupon code in company rejected with 409');

    // Cashier can read active coupons for POS application
    const cashierGetCoupons = await request('GET', '/api/settings/coupons', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierGetCoupons.status === 200, 'Cashier reads coupons for POS application (200)');

    // -------------------------------------------------------------------------
    // 16. PNL CATEGORIES (Area 13)
    // -------------------------------------------------------------------------
    console.log('\n--- 16. PNL Categories Module ---');

    const createPnlCatA = await request('POST', '/api/settings/pnl-categories', {
      name: 'Salon Supplies Expense',
      type: 'EXPENSE',
      description: 'Shampoos, conditioners, color tubes',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPnlCatA.status === 201, 'Admin creates PNL category (201)');
    const pnlCatAId = createPnlCatA.data?.data?.id;

    const createPnlCatADup = await request('POST', '/api/settings/pnl-categories', {
      name: 'Salon Supplies Expense',
      type: 'EXPENSE',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPnlCatADup.status === 409, 'Duplicate PNL category name rejected with 409');

    // -------------------------------------------------------------------------
    // 17. PNL INCOME TAXES & OVERLAP VALIDATION (Area 14)
    // -------------------------------------------------------------------------
    console.log('\n--- 17. PNL Income Taxes & Slab Overlap Checks ---');

    // Slab 1: 0 to 250,000 @ 0%
    const createSlab1 = await request('POST', '/api/settings/pnl-income-taxes', {
      fromAmount: 0,
      toAmount: 250000,
      taxRate: 0,
      description: 'Exempt bracket',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createSlab1.status === 201, 'Created income tax slab 0 - 250000 @ 0% (201)');

    // Slab 2: 250,000 to 500,000 @ 5% (contiguous non-overlapping)
    const createSlab2 = await request('POST', '/api/settings/pnl-income-taxes', {
      fromAmount: 250000,
      toAmount: 500000,
      taxRate: 5.0,
      description: '5% bracket',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createSlab2.status === 201, 'Created adjacent slab 250000 - 500000 @ 5% (201)');

    // Overlapping slab test: 100,000 to 300,000 (overlaps with both!)
    const overlapSlab = await request('POST', '/api/settings/pnl-income-taxes', {
      fromAmount: 100000,
      toAmount: 300000,
      taxRate: 10.0,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(overlapSlab.status === 409, 'Overlapping income tax range rejected with 409 Conflict');

    // Invalid range test: fromAmount >= toAmount
    const invertedSlab = await request('POST', '/api/settings/pnl-income-taxes', {
      fromAmount: 500000,
      toAmount: 100000,
      taxRate: 10.0,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(invertedSlab.status === 400, 'Inverted range (from > to) rejected with 400 Bad Request');

    const equalSlab = await request('POST', '/api/settings/pnl-income-taxes', {
      fromAmount: 500000,
      toAmount: 500000,
      taxRate: 10.0,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(equalSlab.status === 400, 'Zero range (from == to) rejected with 400 Bad Request');

    // -------------------------------------------------------------------------
    // 18. CRM SEGMENTS (Area 12)
    // -------------------------------------------------------------------------
    console.log('\n--- 18. CRM Segments Module ---');

    const createCrmA = await request('POST', '/api/settings/crm-segments', {
      name: 'High Spenders',
      description: 'Guests spending > ₹5000 in last 60 days',
      criteria: { minSpend: 5000, days: 60 },
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createCrmA.status === 201, 'Admin creates CRM segment (201)');

    // -------------------------------------------------------------------------
    // 19. CUSTOM FORMS (Area 22)
    // -------------------------------------------------------------------------
    console.log('\n--- 19. Custom Forms Module ---');

    const createFormA = await request('POST', '/api/settings/custom-forms', {
      name: 'Hair Consultation Form',
      description: 'Intake form before chemical hair treatments',
      fields: [
        { id: 'f1', label: 'Previous hair chemical history', type: 'TEXT', required: true },
        { id: 'f2', label: 'Scalp sensitivity', type: 'SELECT', required: false, options: ['None', 'Mild', 'Severe'] },
      ],
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createFormA.status === 201, 'Admin creates custom form (201)');

    // -------------------------------------------------------------------------
    // 20. SALUTATIONS (Area 26)
    // -------------------------------------------------------------------------
    console.log('\n--- 20. Salutations Module ---');

    const createSalA = await request('POST', '/api/settings/salutations', {
      title: 'Dr',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createSalA.status === 201, 'Admin creates salutation Dr (201)');

    // Cashier can read salutations for guest profile dropdown
    const cashierGetSal = await request('GET', '/api/settings/salutations', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierGetSal.status === 200, 'Cashier reads salutations for guest forms (200)');

    // -------------------------------------------------------------------------
    // 21. DESIGNATION & SHIFT MANAGEMENT (Areas 3 & 4 - REUSED)
    // -------------------------------------------------------------------------
    console.log('\n--- 21. Reused Designations & Shifts ---');

    const createDesig = await request('POST', '/api/settings/designations', {
      name: `Senior Stylist ${Date.now()}`,
      description: 'Experienced master colorist',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createDesig.status === 201, 'Admin creates designation via Settings (201)');
    const desigId = createDesig.data?.data?.id;

    const listDesig = await request('GET', '/api/settings/designations', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listDesig.status === 200, 'Admin lists designations via Settings (200)');

    const createShift = await request('POST', '/api/settings/shifts', {
      name: `Morning Shift ${Date.now()}`,
      startTime: '09:00',
      endTime: '17:00',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createShift.status === 201, 'Admin creates shift via Settings (201)');
    const shiftId = createShift.data?.data?.id;

    const listShifts = await request('GET', '/api/settings/shifts', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listShifts.status === 200, 'Admin lists shifts via Settings (200)');

    // -------------------------------------------------------------------------
    // 22. ROSTER MANAGEMENT (Area 5 - REUSED)
    // -------------------------------------------------------------------------
    console.log('\n--- 22. Roster Management ---');

    const getRoster = await request('GET', '/api/settings/roster', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getRoster.status === 200, 'Admin fetches staff roster (200)');
    assert(Array.isArray(getRoster.data?.data), 'Roster returns list of staff with schedules');

    // -------------------------------------------------------------------------
    // 23. ACCESS CONTROL (Area 21 - REUSED)
    // -------------------------------------------------------------------------
    console.log('\n--- 23. Access Control Settings ---');

    const getRoles = await request('GET', '/api/settings/access-control/roles', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getRoles.status === 200, 'Admin lists RBAC roles (200)');

    const getPerms = await request('GET', '/api/settings/access-control/permissions', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getPerms.status === 200, 'Admin lists system permissions (200)');

    const getUsers = await request('GET', '/api/settings/access-control/users', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getUsers.status === 200, 'Admin lists company users with roles (200)');

    // -------------------------------------------------------------------------
    // 24. RESOURCES INTEGRATION (Area 2 - REUSED)
    // -------------------------------------------------------------------------
    console.log('\n--- 24. Resources Settings Integration ---');

    const listResources = await request('GET', '/api/settings/resources', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listResources.status === 200, 'Admin fetches resources through Settings alias (200)');

    // -------------------------------------------------------------------------
    // 25. SUPERADMIN IMPERSONATION & TENANT ISOLATION (Section 5)
    // -------------------------------------------------------------------------
    console.log('\n--- 25. SuperAdmin Impersonation ---');

    const superImpersonateA = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${superToken}`,
      'x-impersonate-tenant-id': tenantAId,
    });
    assert(superImpersonateA.status === 200, 'SuperAdmin impersonates Tenant A for settings (200)');
    assert(superImpersonateA.data?.data?.openingTime === '09:00 AM', 'SuperAdmin sees Tenant A custom opening time');

    const superImpersonateB = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${superToken}`,
      'x-impersonate-tenant-id': tenantBId,
    });
    assert(superImpersonateB.status === 200, 'SuperAdmin impersonates Tenant B for settings (200)');
    assert(superImpersonateB.data?.data?.openingTime !== '09:00 AM', 'SuperAdmin sees Tenant B distinct configuration');

    // -------------------------------------------------------------------------
    // 26. SUBSCRIPTION LIFECYCLE ENFORCEMENT (Section 40)
    // -------------------------------------------------------------------------
    console.log('\n--- 26. Subscription Lifecycle Enforcement ---');

    // Temporarily expire Tenant B's subscription
    await prisma.tenant.update({
      where: { id: tenantBId },
      data: {
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiresAt: new Date(Date.now() - 24 * 3600 * 1000), // yesterday
      },
    });

    const expiredAccess = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(
      expiredAccess.status === 401 || expiredAccess.status === 403,
      'Expired subscription blocks Settings access with 401/403'
    );
    assert(
      expiredAccess.data?.message?.includes('subscription has expired'),
      'Expired response contains standard subscription renewal notice'
    );

    // Restore Tenant B's active subscription
    await prisma.tenant.update({
      where: { id: tenantBId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });

    const restoredAccess = await request('GET', '/api/settings/generic', undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(restoredAccess.status === 200, 'Restored subscription re-enables Settings access (200)');

    // -------------------------------------------------------------------------
    // 27. AUDIT LOGGING VERIFICATION (Section 37)
    // -------------------------------------------------------------------------
    console.log('\n--- 27. Audit Logging Verification ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: tenantAId,
        action: { in: ['TAX_MAPPING_CREATED', 'GENERIC_SETTINGS_UPDATED', 'ONLINE_PAYMENT_SETTINGS_UPDATED'] },
      },
    });
    assert(auditLogs.length >= 3, 'Audit log records generated for settings mutations');
    const paymentAudit = auditLogs.find((l) => l.action === 'ONLINE_PAYMENT_SETTINGS_UPDATED');
    const metadataStr = JSON.stringify(paymentAudit?.metadata || {});
    assert(!metadataStr.includes('SuperSecretKey999!'), 'Payment secrets REDACTED from audit log metadata');

    // -------------------------------------------------------------------------
    // 28. CONCURRENCY & RACE CONDITIONS (Section 41)
    // -------------------------------------------------------------------------
    console.log('\n--- 28. Concurrency & Race Conditions ---');

    const concurrentCode = `RACE_${Date.now()}`;
    const [raceRes1, raceRes2] = await Promise.all([
      request('POST', '/api/settings/coupons', {
        code: concurrentCode,
        discountType: 'PERCENTAGE',
        discountValue: 10,
      }, { Authorization: `Bearer ${adminAToken}` }),
      request('POST', '/api/settings/coupons', {
        code: concurrentCode,
        discountType: 'PERCENTAGE',
        discountValue: 10,
      }, { Authorization: `Bearer ${adminAToken}` }),
    ]);

    const statuses = [raceRes1.status, raceRes2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `Concurrent creation: exactly one 201 Created and one 409 Conflict (${raceRes1.status}, ${raceRes2.status})`
    );

    // Clean up created coupon
    await prisma.coupon.deleteMany({ where: { code: concurrentCode } });

    // -------------------------------------------------------------------------
    // 29. UI-SPECIFIC ALIASES & FRAME-MATCHING VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 29. UI-Specific Aliases & Frame-Matching Verification ---');

    // 29.1 Feedback Types CRUD (frame_053.jpg)
    const listFbTypes = await request('GET', '/api/settings/feedback/types', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listFbTypes.status === 200, 'Admin lists feedback types (200)');
    assert(Array.isArray(listFbTypes.data?.data) && listFbTypes.data?.data.length >= 1, 'Admin A lists configured feedback questions');

    const listFbTypesB = await request('GET', '/api/settings/feedback/types', undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(listFbTypesB.status === 200, 'Admin B lists default feedback types (200)');
    assert(Array.isArray(listFbTypesB.data?.data) && listFbTypesB.data?.data.length >= 3, 'Tenant B feedback types lists questions');

    const createFbType = await request('POST', '/api/settings/feedback/types', {
      name: 'Ambiance & Cleanliness',
      ratingType: 'STARS',
      isActive: true,
      required: false,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createFbType.status === 201, 'Admin creates new feedback type (201)');
    const createdFbId = createFbType.data?.data?.id;

    const updateFbType = await request('PUT', `/api/settings/feedback/types/${createdFbId}`, {
      name: 'Salon Ambiance & Cleanliness',
      isActive: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateFbType.status === 200, 'Admin updates feedback type (200)');
    assert(updateFbType.data?.data?.name === 'Salon Ambiance & Cleanliness', 'Feedback type name updated correctly');

    const deleteFbType = await request('DELETE', `/api/settings/feedback/types/${createdFbId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(deleteFbType.status === 200, 'Admin deletes feedback type (200)');

    // 29.2 Tax Mapping with UI aliases: taxName, taxValue (frame_043.jpg)
    const createTaxWithAlias = await request('POST', '/api/settings/tax-mappings', {
      taxName: `VAT Special ${Date.now()}`,
      taxValue: 12.5,
      isInclusive: true,
      applicableFor: ['SERVICE', 'PRODUCT'],
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createTaxWithAlias.status === 201, 'Tax mapping created with taxName & taxValue aliases (201)');
    assert(Number(createTaxWithAlias.data?.data?.rate) === 12.5, 'Tax rate saved correctly from taxValue');

    // 29.3 Membership with UI aliases: fees, validity, renewalReminder, membershipType, benefitAmount, membershipSharable (frame_078.jpg)
    const createMemWithAlias = await request('POST', '/api/settings/memberships', {
      name: `Bridal Elite ${Date.now()}`,
      fees: 9999,
      validity: 365,
      renewalReminder: 30,
      membershipType: 'FIXED',
      benefitAmount: 2000,
      membershipSharable: true,
      isActive: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createMemWithAlias.status === 201, 'Membership created with UI aliases fees & validity (201)');
    assert(Number(createMemWithAlias.data?.data?.price) === 9999, 'Membership price mapped from fees');
    assert(createMemWithAlias.data?.data?.validityDays === 365, 'Membership validityDays mapped from validity');

    // 29.4 Package with UI aliases: planValidity, renewalReminder, selectedServices (frame_088.jpg)
    const createPkgWithAlias = await request('POST', '/api/settings/packages', {
      name: `Hair Care Package ${Date.now()}`,
      price: 3499,
      planValidity: 90,
      renewalReminder: 10,
      selectedServices: ['srv-1', 'srv-2'],
      isActive: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPkgWithAlias.status === 201, 'Package created with UI aliases planValidity & selectedServices (201)');
    assert(createPkgWithAlias.data?.data?.validityDays === 90, 'Package validityDays mapped from planValidity');

    // 29.5 Gift Card auto-generated code and UI aliases: amount/validity/terms (frame_098.jpg)
    const createGcAutoCode = await request('POST', '/api/settings/gift-cards', {
      name: `Birthday Special ${Date.now()}`,
      amount: 1500,
      validity: 60,
      description: 'Valid for all weekend bookings',
      isActive: true,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createGcAutoCode.status === 201, 'Gift card created without explicit code (auto-generated code) (201)');
    assert(createGcAutoCode.data?.data?.code?.startsWith('GC-'), 'Auto-generated code has GC- prefix');
    assert(Number(createGcAutoCode.data?.data?.amount) === 1500, 'Gift card amount correctly set');

    // 29.6 PNL Income Tax with UI aliases: slabFrom, slabTo, taxValue (frame_166.jpg)
    const createPnlTaxAlias = await request('POST', '/api/settings/pnl-income-taxes', {
      slabFrom: 1500000,
      slabTo: 2500000,
      taxValue: 30,
      description: 'Super-high income slab',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPnlTaxAlias.status === 201, 'PNL Income tax slab created with slabFrom/slabTo/taxValue (201)');
    assert(Number(createPnlTaxAlias.data?.data?.fromAmount) === 1500000, 'fromAmount mapped from slabFrom');
    assert(Number(createPnlTaxAlias.data?.data?.taxRate) === 30, 'taxRate mapped from taxValue');

    // 29.7 PNL Category with UI alias: categorySequence (frame_154.jpg)
    const createPnlCatAlias = await request('POST', '/api/settings/pnl-categories', {
      name: `General & Admin Expenses ${Date.now()}`,
      type: 'EXPENSE',
      categorySequence: 4,
      description: 'Administrative overhead',
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(createPnlCatAlias.status === 201, 'PNL Category created with categorySequence (201)');

    // 29.8 Referrals with UI configuration (frame_130.jpg)
    const updateReferralsUI = await request('PUT', '/api/settings/referrals', {
      referralsEnabled: true,
      maxReferLimit: 20,
      referrerMaxBenefit: 500,
      referrerPercentage: 10,
      refereeMaxBenefit: 1000,
      refereePercentage: 15,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateReferralsUI.status === 200, 'Referral settings updated with UI referral configuration (200)');

    // 29.9 Loyalty with UI configuration (frame_071.jpg)
    const updateLoyaltyUI = await request('PUT', '/api/settings/loyalty', {
      loyaltyEnabled: true,
      earnPointsPerRupee: 1,
      rupeePerRedeemPoint: 1,
      minRedeemPoints: 100,
      loyaltyExpiryDays: 365,
    }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(updateLoyaltyUI.status === 200, 'Loyalty settings updated with UI loyalty configuration (200)');
  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   SETTINGS MODULE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
