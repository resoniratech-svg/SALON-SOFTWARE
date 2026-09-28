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
  const cloned = res.clone();
  const data = await res.json().catch(() => null);
  const text = await cloned.text().catch(() => '');
  return { status: res.status, data, text, headers: res.headers };
}

export async function runPosTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE POS (Point of Sale) Module: Comprehensive Test Suite');
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

    // 1.1 SuperAdmin Login
    const superLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(superLogin.status === 200, 'SuperAdmin login returns 200');
    superToken = superLogin.data?.data?.token;

    // 1.2 Tenant A Admin Login
    const adminALogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminALogin.status === 200, 'Tenant A Admin login returns 200');
    adminAToken = adminALogin.data?.data?.token;
    tenantAId = adminALogin.data?.data?.user?.tenantId;

    // 1.3 Tenant B Admin Login
    const adminBLogin = await request('POST', '/api/auth/login', {
      username: 'admin-b',
      password: 'DevelopmentPassword123!',
    });
    assert(adminBLogin.status === 200, 'Tenant B Admin login returns 200');
    adminBToken = adminBLogin.data?.data?.token;
    tenantBId = adminBLogin.data?.data?.user?.tenantId;

    // 1.4 Cashier Login (belongs to Tenant A)
    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(cashierLogin.status === 200, 'Cashier login returns 200');
    cashierToken = cashierLogin.data?.data?.token;

    // -------------------------------------------------------------------------
    // 1.5 SEED TEST DATA FOR TENANT A AND TENANT B
    // -------------------------------------------------------------------------
    console.log('\n--- Seed Test Fixtures (Staff, Services, Products, Guests, Tax) ---');

    // Clean previous test POS orders
    await prisma.posOrderItem.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.posPayment.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.posOrder.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });

    // Tenant A Category & Service
    let categoryA = await prisma.serviceCategory.findFirst({ where: { tenantId: tenantAId } });
    if (!categoryA) {
      categoryA = await prisma.serviceCategory.create({
        data: { tenantId: tenantAId, name: 'Hair Services' },
      });
    }

    let serviceA = await prisma.service.findFirst({ where: { tenantId: tenantAId, name: 'Classic Haircut' } });
    if (!serviceA) {
      serviceA = await prisma.service.create({
        data: {
          tenantId: tenantAId,
          categoryId: categoryA.id,
          name: 'Classic Haircut',
          price: 500,
          salePrice: 450,
          durationMinutes: 30,
        },
      });
    }

    // Tenant A Staff
    let staffA = await prisma.staff.findFirst({ where: { tenantId: tenantAId } });
    if (!staffA) {
      staffA = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'John Stylist',
        },
      });
    }

    // Tenant A Product Category & Product
    let prodCatA = await prisma.productCategory.findFirst({ where: { tenantId: tenantAId } });
    if (!prodCatA) {
      prodCatA = await prisma.productCategory.create({
        data: { tenantId: tenantAId, name: 'Hair Care' },
      });
    }

    let productA = await prisma.product.findFirst({ where: { tenantId: tenantAId, name: 'Keratin Shampoo' } });
    if (!productA) {
      productA = await prisma.product.create({
        data: {
          tenantId: tenantAId,
          categoryId: prodCatA.id,
          name: 'Keratin Shampoo',
          price: 800,
          salePrice: 750,
        },
      });
    }

    // Tenant A Guest
    let guestA = await prisma.guest.findFirst({ where: { tenantId: tenantAId, mobile: '9123456789' } });
    if (!guestA) {
      guestA = await prisma.guest.create({
        data: {
          tenantId: tenantAId,
          name: 'Rohit Sharma',
          mobile: '9123456789',
          email: 'rohit@example.com',
          customerType: 'REGULAR',
        },
      });
    }

    // Tenant A Tax Mapping (GST 18% Exclusive)
    let taxA = await prisma.taxMapping.findFirst({ where: { tenantId: tenantAId, name: 'GST 18%' } });
    if (!taxA) {
      taxA = await prisma.taxMapping.create({
        data: {
          tenantId: tenantAId,
          name: 'GST 18%',
          rate: 18,
          isInclusive: false,
        },
      });
    }

    // Tenant B Service & Staff
    let categoryB = await prisma.serviceCategory.findFirst({ where: { tenantId: tenantBId } });
    if (!categoryB) {
      categoryB = await prisma.serviceCategory.create({
        data: { tenantId: tenantBId, name: 'Spa Services' },
      });
    }

    let serviceB = await prisma.service.findFirst({ where: { tenantId: tenantBId, name: 'Aroma Massage' } });
    if (!serviceB) {
      serviceB = await prisma.service.create({
        data: {
          tenantId: tenantBId,
          categoryId: categoryB.id,
          name: 'Aroma Massage',
          price: 1500,
        },
      });
    }

    let staffB = await prisma.staff.findFirst({ where: { tenantId: tenantBId } });
    if (!staffB) {
      staffB = await prisma.staff.create({
        data: {
          tenantId: tenantBId,
          name: 'Spa Therapist B',
        },
      });
    }

    // -------------------------------------------------------------------------
    // 2. SECURITY & AUTHENTICATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Security & Authentication Tests ---');

    // 2.1 Missing Token
    const resNoToken = await request('GET', '/api/pos/orders');
    assert(resNoToken.status === 401, 'Request without token returns 401 Unauthorized');

    // 2.2 Invalid Token
    const resBadToken = await request('GET', '/api/pos/orders', undefined, {
      Authorization: 'Bearer invalid.token.value',
    });
    assert(resBadToken.status === 401, 'Request with invalid token returns 401 Unauthorized');

    // -------------------------------------------------------------------------
    // 3. MANDATORY VALIDATION & VIDEO SRS RULES
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Validation Rules (Staff Mandatory for Services, Cart Items) ---');

    // 3.1 Empty items array
    const resEmptyItems = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resEmptyItems.status === 400, 'Empty items array returns 400');

    // 3.2 Service without Staff -> MUST return 400 "Select Staff / Staff is required"
    const resMissingStaff = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            quantity: 1,
            // staffId is omitted!
          },
        ],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(
      resMissingStaff.status === 400,
      'Service item without staffId returns 400 (Select Staff requirement enforced)'
    );

    // 3.3 Missing both guestId and guest details
    const resMissingGuest = await request(
      'POST',
      '/api/pos/orders',
      {
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
          },
        ],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resMissingGuest.status === 400, 'Missing both guestId and guest object returns 400');

    // 3.4 Cross-tenant service reference (Tenant A order referencing Tenant B service)
    const resCrossTenantService = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceB.id, // Belongs to Tenant B!
            staffId: staffA.id,
            quantity: 1,
          },
        ],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(
      resCrossTenantService.status === 400,
      'Cross-tenant service reference is rejected with 400 (Multi-tenant isolation)'
    );

    // 3.5 Cross-tenant staff reference (Tenant A order referencing Tenant B staff)
    const resCrossTenantStaff = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffB.id, // Belongs to Tenant B!
            quantity: 1,
          },
        ],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(
      resCrossTenantStaff.status === 400,
      'Cross-tenant staff reference is rejected with 400 (Multi-tenant isolation)'
    );

    // -------------------------------------------------------------------------
    // 4. CHECKOUT CALCULATION API (/api/pos/calculate)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Checkout Calculation API ---');

    const resCalc = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 2, // 450 * 2 = 900
          },
          {
            itemType: 'PRODUCT',
            productId: productA.id,
            quantity: 1, // 750 * 1 = 750
          },
        ],
        discountType: 'PERCENTAGE',
        discountValue: 10, // 10% of 1650 = 165. Taxable = 1485
        tipAmount: 50,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );

    assert(resCalc.status === 200, 'Calculate order returns 200');
    assert(resCalc.data?.data?.subtotal === 1650, 'Calculates correct subtotal (900 + 750 = 1650)');
    assert(resCalc.data?.data?.totalDiscount === 165, 'Calculates correct 10% order discount (165)');
    assert(resCalc.data?.data?.taxableAmount === 1485, 'Calculates correct taxable amount (1485)');
    assert(resCalc.data?.data?.tipAmount === 50, 'Includes tip amount (50)');
    assert(resCalc.data?.data?.totalAmount > 1485, 'Calculates grand total including tax and tip');

    // -------------------------------------------------------------------------
    // 5. QUICK SALE ORDER CREATION (Admin & Cashier)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Quick Sale Order Creation ---');

    let orderAId: string;
    let orderANumber: string;

    // 5.1 Admin creates order for existing guest
    const resCreateOrder = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
            unitPrice: 450,
          },
          {
            itemType: 'PRODUCT',
            productId: productA.id,
            quantity: 1,
            unitPrice: 750,
          },
        ],
        paymentMethod: 'CASH',
        tipAmount: 20,
        notes: 'VIP client request',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );

    assert(resCreateOrder.status === 201, 'Admin creates POS Order successfully (returns 201)');
    assert(resCreateOrder.data?.data?.orderNumber?.startsWith('INV-'), 'Order number has INV- prefix');
    assert(resCreateOrder.data?.data?.status === 'COMPLETED', 'Order status is COMPLETED');
    assert(resCreateOrder.data?.data?.items?.length === 2, 'Order has 2 line items');
    assert(resCreateOrder.data?.data?.payments?.length === 1, 'Order has 1 payment record');

    orderAId = resCreateOrder.data?.data?.id;
    orderANumber = resCreateOrder.data?.data?.orderNumber;

    // 5.2 Verify Guest metrics were atomically updated
    const updatedGuestA = await prisma.guest.findUnique({ where: { id: guestA.id } });
    assert(
      Number(updatedGuestA?.totalSpend) > 0,
      'Guest totalSpend was incremented atomically after order creation'
    );
    assert(
      Number(updatedGuestA?.totalVisits) >= 1,
      'Guest totalVisits was incremented after order creation'
    );

    // 5.3 On-the-fly guest creation in POS checkout
    const walkinMobile = '9911223344';
    await prisma.posOrderItem.deleteMany({ where: { tenantId: tenantAId, order: { guest: { mobile: walkinMobile } } } });
    await prisma.posPayment.deleteMany({ where: { tenantId: tenantAId, order: { guest: { mobile: walkinMobile } } } });
    await prisma.posOrder.deleteMany({ where: { tenantId: tenantAId, guest: { mobile: walkinMobile } } });
    await prisma.guest.deleteMany({ where: { tenantId: tenantAId, mobile: walkinMobile } });

    const resWalkinOrder = await request(
      'POST',
      '/api/pos/orders',
      {
        guest: {
          name: 'Prakash Sharma',
          mobile: walkinMobile,
          email: 'pp@gmail.com',
          gender: 'MALE',
          dob: '2008-01-26',
          anniversaryDate: '2026-08-11',
          gstNumber: '27AAHCR9544A1ZB',
          hairType: 'Straight',
          alternateMobile: '+919911223399',
        },
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
          },
        ],
        paymentMethod: 'GPAY',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );

    assert(resWalkinOrder.status === 201, 'Order with on-the-fly guest creation returns 201');
    const autoCreatedGuest = await prisma.guest.findFirst({
      where: { tenantId: tenantAId, mobile: walkinMobile },
    });
    assert(autoCreatedGuest !== null, 'New guest was auto-created in database during POS checkout');
    assert(autoCreatedGuest?.customerType === 'WALK_IN', 'Auto-created guest customerType is WALK_IN');
    assert(autoCreatedGuest?.gstNumber === '27AAHCR9544A1ZB', 'Guest GSTIN stored from quick registration');
    assert(autoCreatedGuest?.hairType === 'Straight', 'Guest hairType stored from quick registration');

    // 5.4 Cashier creates order (Cashier role permissions test)
    const resCashierOrder = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
          },
        ],
        paymentMethod: 'HDFC',
        payments: [
          {
            method: 'HDFC',
            amount: 500,
            referenceNumber: 'HDFC-TXN-12345',
          },
        ],
      },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(resCashierOrder.status === 201, 'Cashier can successfully create POS Order (POS:CREATE)');

    // -------------------------------------------------------------------------
    // 6. COUPON & GIFT CARD CHECKOUT INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Coupon & Gift Card Integration ---');

    // Create a coupon for Tenant A
    const couponCode = 'SAVE20';
    await prisma.coupon.deleteMany({ where: { tenantId: tenantAId, code: couponCode } });
    await prisma.coupon.create({
      data: {
        tenantId: tenantAId,
        code: couponCode,
        discountType: 'PERCENTAGE',
        discountValue: 20,
        minOrderValue: 200,
        isActive: true,
      },
    });

    const resCouponOrder = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
            unitPrice: 500,
          },
        ],
        couponCode: couponCode,
        paymentMethod: 'CASH',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );

    assert(resCouponOrder.status === 201, 'Order with valid coupon code succeeds (201)');
    assert(Number(resCouponOrder.data?.data?.couponDiscount) > 0, 'Coupon discount was applied to order');

    // Expired or invalid coupon test
    const resBadCoupon = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
          },
        ],
        couponCode: 'NONEXISTENT_COUPON',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resBadCoupon.status === 400, 'Invalid coupon code returns 400');

    // -------------------------------------------------------------------------
    // 7. POS ORDERS DASHBOARD, LIST & FILTERS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. POS Orders Dashboard & Filtering ---');

    // 7.1 List orders
    const resList = await request('GET', '/api/pos/orders', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resList.status === 200, 'List POS orders returns 200');
    assert(resList.data?.data?.data?.length >= 3, 'Returns list of POS orders');
    assert(resList.data?.data?.total >= 3, 'Returns correct total order count');

    // 7.2 Filter by status
    const resFilterStatus = await request('GET', '/api/pos/orders?status=COMPLETED', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resFilterStatus.status === 200, 'Filter orders by status=COMPLETED returns 200');

    // 7.3 Search by guest mobile
    const resSearch = await request(`GET`, `/api/pos/orders?search=${guestA.mobile}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resSearch.status === 200, 'Search orders by guest mobile returns 200');
    assert(resSearch.data?.data?.data?.length > 0, 'Search returns matching orders');

    // 7.4 Get Order by ID
    const resGetById = await request('GET', `/api/pos/orders/${orderAId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resGetById.status === 200, 'Get order by ID returns 200');
    assert(resGetById.data?.data?.id === orderAId, 'Retrieved correct order by ID');
    assert(resGetById.data?.data?.items?.length > 0, 'Order includes item details');
    assert(resGetById.data?.data?.guest?.name === guestA.name, 'Order includes guest details');

    // 7.5 Get Order by Order Number
    const resGetByNum = await request('GET', `/api/pos/orders/number/${orderANumber}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resGetByNum.status === 200, 'Get order by Order Number returns 200');
    assert(resGetByNum.data?.data?.orderNumber === orderANumber, 'Retrieved correct order by orderNumber');

    // 7.6 Update Order Status
    const resUpdateStatus = await request(
      'PATCH',
      `/api/pos/orders/${orderAId}/status`,
      { status: 'PENDING', notes: 'Customer pending payment' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resUpdateStatus.status === 200, 'Update order status returns 200');
    assert(resUpdateStatus.data?.data?.status === 'PENDING', 'Order status was updated to PENDING');

    // 7.7 Full Order Edit (Frames 135 & 145: "CLICK HERE TO EDIT" -> "Update")
    const resEditOrder = await request(
      'PUT',
      `/api/pos/orders/${orderAId}`,
      {
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 2,
            unitPrice: 450,
          },
        ],
        instruction: 'Special shampoo request',
        paymentMethod: 'CARD',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resEditOrder.status === 200, 'Full order edit (PUT /api/pos/orders/:id) returns 200');
    assert(resEditOrder.data?.data?.items?.length === 1, 'Edited order has updated line items');
    assert(resEditOrder.data?.data?.items[0]?.quantity === 2, 'Quantity updated in edit mode');
    assert(resEditOrder.data?.data?.instruction === 'Special shampoo request', 'Special instruction updated');

    // 7.8 Complete Order Action (Frame 111 & 151: "Complete" button)
    const resCompleteOrder = await request(
      'POST',
      `/api/pos/orders/${orderAId}/complete`,
      {},
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resCompleteOrder.status === 200, 'Complete order action (POST /complete) returns 200');
    assert(resCompleteOrder.data?.data?.status === 'COMPLETED', 'Order status is now COMPLETED');

    // 7.9 Cancel Order Action (Frame 111: "Cancel Order" button)
    const resCancelOrder = await request(
      'POST',
      `/api/pos/orders/${orderAId}/cancel`,
      { reason: 'Customer requested cancellation' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resCancelOrder.status === 200, 'Cancel order action (POST /cancel) returns 200');
    assert(resCancelOrder.data?.data?.status === 'CANCELLED', 'Order status is now CANCELLED');

    // -------------------------------------------------------------------------
    // 8. BILL / INVOICE ACTIONS (Video SRS: Print, Resend, WhatsApp)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Bill / Invoice Actions ---');

    // 8.1 Get Formatted Invoice
    const resInvoice = await request('GET', `/api/pos/orders/${orderAId}/invoice`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resInvoice.status === 200, 'Get Formatted Invoice returns 200');
    assert(resInvoice.data?.data?.invoiceNumber === orderANumber, 'Invoice contains invoiceNumber');
    assert(resInvoice.data?.data?.salon?.name !== undefined, 'Invoice contains salon name');
    assert(resInvoice.data?.data?.items?.length > 0, 'Invoice contains itemized line items');
    assert(resInvoice.data?.data?.items[0]?.sr === 1, 'Invoice items include serial number (sr: 1)');

    // 8.2 Resend Invoice
    const resResend = await request('POST', `/api/pos/orders/${orderAId}/resend`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resResend.status === 200, 'Resend Invoice returns 200');
    assert(resResend.data?.data?.orderNumber === orderANumber, 'Resend confirmation includes orderNumber');

    // 8.3 Send WhatsApp Invoice (Video SRS: salon_transaction_invoice_1 template)
    const resWhatsApp = await request('POST', `/api/pos/orders/${orderAId}/whatsapp`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resWhatsApp.status === 200, 'Send WhatsApp Invoice returns 200');
    assert(
      resWhatsApp.data?.data?.template === 'salon_transaction_invoice_1',
      'WhatsApp notification uses salon_transaction_invoice_1 template as per video SRS'
    );
    assert(resWhatsApp.data?.data?.whatsappStatus === 'SENT', 'WhatsApp status set to SENT');

    // -------------------------------------------------------------------------
    // 9. POS DASHBOARD STATS API (/api/pos/stats)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. POS Dashboard Stats API ---');

    const resStats = await request('GET', '/api/pos/stats', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resStats.status === 200, 'Get POS Dashboard stats returns 200');
    assert(resStats.data?.data?.totalOrders >= 0, 'Stats includes totalOrders');
    assert(resStats.data?.data?.totalSales >= 0, 'Stats includes totalSales');
    assert(resStats.data?.data?.paymentBreakdown !== undefined, 'Stats includes paymentBreakdown');

    // -------------------------------------------------------------------------
    // 10. CASHIER RBAC BOUNDARIES & VOID PERMISSIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Cashier RBAC Boundaries ---');

    // 10.1 Cashier tries to DELETE/void order -> Must be 403 Forbidden (requires POS:DELETE)
    const resCashierDelete = await request('DELETE', `/api/pos/orders/${orderAId}`, undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(
      resCashierDelete.status === 403,
      'Cashier cannot void/delete order (403 Forbidden - Admin only)'
    );

    // 10.2 Admin deletes/voids order -> 200 OK
    const resAdminDelete = await request('DELETE', `/api/pos/orders/${orderAId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resAdminDelete.status === 200, 'Admin can void/delete order (returns 200)');

    // -------------------------------------------------------------------------
    // 11. MULTI-TENANT SAAS ISOLATION (Tenant A vs Tenant B)
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Multi-Tenant SaaS Isolation ---');

    // Create a new order for Tenant A
    const resOrderA2 = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
          },
        ],
        paymentMethod: 'CASH',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const orderA2Id = resOrderA2.data?.data?.id;

    // 11.1 Tenant B Admin tries to GET Tenant A's order by ID -> 404 Not Found
    const resCrossTenantGet = await request('GET', `/api/pos/orders/${orderA2Id}`, undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(
      resCrossTenantGet.status === 404,
      'Tenant B cannot access Tenant A order by ID (returns 404 Not Found)'
    );

    // 11.2 Tenant B Admin tries to UPDATE Tenant A's order status -> 404 Not Found
    const resCrossTenantUpdate = await request(
      'PATCH',
      `/api/pos/orders/${orderA2Id}/status`,
      { status: 'CANCELLED' },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(
      resCrossTenantUpdate.status === 404,
      'Tenant B cannot update Tenant A order status (returns 404 Not Found)'
    );

    // 11.3 Tenant B Admin tries to DELETE Tenant A's order -> 404 Not Found
    const resCrossTenantDelete = await request('DELETE', `/api/pos/orders/${orderA2Id}`, undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(
      resCrossTenantDelete.status === 404,
      'Tenant B cannot delete Tenant A order (returns 404 Not Found)'
    );

    // 11.4 Tenant B listing orders does NOT include Tenant A orders
    const resListB = await request('GET', '/api/pos/orders', undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    const containsTenantAOrder = resListB.data?.data?.data?.some((o: any) => o.id === orderA2Id);
    assert(!containsTenantAOrder, 'Tenant B order list does not leak Tenant A orders (Strict SaaS isolation)');

    // -------------------------------------------------------------------------
    // 12. POS DASHBOARD & ORDER LIFECYCLE (VIDEO FLOW: NEW -> ACCEPTED -> COMPLETED, REJECT)
    // -------------------------------------------------------------------------
    console.log('\n--- 12. POS Dashboard & Order Lifecycle (Video Flow) ---');

    // 12.1 Get Initial Dashboard Summary
    const initialSummaryRes = await request('GET', '/api/pos/dashboard/summary', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(initialSummaryRes.status === 200, 'GET /api/pos/dashboard/summary returns 200');
    assert(
      typeof initialSummaryRes.data?.data?.new === 'number' &&
      typeof initialSummaryRes.data?.data?.accepted === 'number' &&
      typeof initialSummaryRes.data?.data?.rejected === 'number' &&
      typeof initialSummaryRes.data?.data?.completed === 'number' &&
      typeof initialSummaryRes.data?.data?.total === 'number',
      'Dashboard summary contains new, accepted, rejected, completed, and total counters'
    );
    const initialSummary = initialSummaryRes.data.data;

    // 12.2 Create Order in NEW Status
    const newOrderRes = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        status: 'NEW',
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
            unitPrice: 800,
          },
        ],
        paymentMethod: 'CASH',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(newOrderRes.status === 201, 'Create Order with NEW status returns 201');
    assert(newOrderRes.data?.data?.status === 'NEW', 'Created order has status NEW');
    const lifecycleOrderId = newOrderRes.data?.data?.id;

    // 12.3 Verify Dashboard Summary reflects NEW count increment
    const summaryAfterNew = await request('GET', '/api/pos/dashboard/summary', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(
      summaryAfterNew.data?.data?.new === initialSummary.new + 1,
      'Dashboard summary new counter increments after creating NEW order'
    );
    assert(
      summaryAfterNew.data?.data?.total === initialSummary.total + 1,
      'Dashboard summary total counter increments'
    );

    // 12.4 Accept Order (NEW -> ACCEPTED)
    const acceptRes = await request('POST', `/api/pos/orders/${lifecycleOrderId}/accept`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(acceptRes.status === 200, 'POST /orders/:id/accept returns 200');
    assert(acceptRes.data?.data?.status === 'ACCEPTED', 'Order status transitions to ACCEPTED');

    // 12.5 Verify Dashboard Summary reflects ACCEPTED count increment
    const summaryAfterAccept = await request('GET', '/api/pos/dashboard/summary', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(
      summaryAfterAccept.data?.data?.accepted === initialSummary.accepted + 1,
      'Dashboard summary accepted counter increments after accepting order'
    );
    assert(
      summaryAfterAccept.data?.data?.new === initialSummary.new,
      'Dashboard summary new counter decrements after order is accepted'
    );

    // 12.6 Complete Order from ACCEPTED (ACCEPTED -> COMPLETED)
    const completeAcceptedRes = await request('POST', `/api/pos/orders/${lifecycleOrderId}/complete`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(completeAcceptedRes.status === 200, 'POST /orders/:id/complete on ACCEPTED order returns 200');
    assert(completeAcceptedRes.data?.data?.status === 'COMPLETED', 'Order status transitions to COMPLETED');
    assert(completeAcceptedRes.data?.data?.paymentStatus === 'PAID', 'Order paymentStatus is PAID');

    // 12.7 Verify Dashboard Summary reflects COMPLETED count increment
    const summaryAfterComplete = await request('GET', '/api/pos/dashboard/summary', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(
      summaryAfterComplete.data?.data?.completed === initialSummary.completed + 1,
      'Dashboard summary completed counter increments after completing order'
    );
    assert(
      summaryAfterComplete.data?.data?.accepted === initialSummary.accepted,
      'Dashboard summary accepted counter decrements back'
    );

    // 12.8 Reject Order Flow (NEW -> REJECTED)
    const rejectOrderNewRes = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        status: 'NEW',
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 1,
            unitPrice: 500,
          },
        ],
        paymentMethod: 'CASH',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const rejectOrderId = rejectOrderNewRes.data?.data?.id;

    const rejectRes = await request(
      'POST',
      `/api/pos/orders/${rejectOrderId}/reject`,
      { reason: 'Customer requested cancellation before salon visit' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(rejectRes.status === 200, 'POST /orders/:id/reject returns 200');
    assert(rejectRes.data?.data?.status === 'REJECTED', 'Order status transitions to REJECTED');

    // 12.9 Verify Dashboard Summary reflects REJECTED count increment
    const summaryAfterReject = await request('GET', '/api/pos/dashboard/summary', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(
      summaryAfterReject.data?.data?.rejected === initialSummary.rejected + 1,
      'Dashboard summary rejected counter increments after rejecting order'
    );

    // 12.10 Filter Orders by Status
    const listAccepted = await request('GET', '/api/pos/orders?status=ACCEPTED', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listAccepted.status === 200, 'GET /api/pos/orders?status=ACCEPTED returns 200');
    assert(
      listAccepted.data?.data?.data?.every((o: any) => o.status === 'ACCEPTED'),
      'All orders in status=ACCEPTED filter have status ACCEPTED'
    );

    const listRejected = await request('GET', '/api/pos/orders?status=REJECTED', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(listRejected.status === 200, 'GET /api/pos/orders?status=REJECTED returns 200');
    assert(
      listRejected.data?.data?.data?.some((o: any) => o.id === rejectOrderId),
      'Rejected order appears in status=REJECTED filter'
    );

    // 12.11 Date Range Filter on Dashboard Summary
    const dateFilteredSummary = await request(
      'GET',
      '/api/pos/dashboard/summary?dateFrom=2026-01-01&dateTo=2026-12-31',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(dateFilteredSummary.status === 200, 'GET /api/pos/dashboard/summary with date range returns 200');
    assert(dateFilteredSummary.data?.data?.total >= 2, 'Date-filtered summary includes orders created in 2026');

    // 12.12 Per-Item Calculation Line Details (Matches Update Bill Table)
    const calcDetailRes = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [
          {
            itemType: 'SERVICE',
            serviceId: serviceA.id,
            staffId: staffA.id,
            quantity: 2,
            unitPrice: 800,
            discountAmount: 100,
          },
        ],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(calcDetailRes.status === 200, 'POST /api/pos/calculate returns 200');
    const firstCalculated = calcDetailRes.data?.data?.itemsCalculated?.[0];
    assert(firstCalculated !== undefined, 'Line item is present in itemsCalculated');
    assert(typeof firstCalculated.discountPercentage === 'number', 'Line item includes discountPercentage');
    assert(typeof firstCalculated.taxRate === 'number', 'Line item includes taxRate');
    assert(typeof firstCalculated.taxAmount === 'number', 'Line item includes taxAmount');
    assert(typeof firstCalculated.taxExclusiveSubtotal === 'number', 'Line item includes taxExclusiveSubtotal');
    assert(firstCalculated.total === 1500, 'Line item total equals subtotal minus discount (1600 - 100 = 1500)');

    // -------------------------------------------------------------------------
    // 13. GRANULAR INPUT VALIDATION & BOUNDARY VALUE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Input Validation & Boundary Value Tests ---');

    // 13.1 Invalid UUID format for guestId
    const resBadGuestUuid = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: 'not-a-valid-uuid',
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resBadGuestUuid.status === 400, 'Invalid UUID format for guestId returns 400');

    // 13.2 Invalid UUID format for serviceId
    const resBadServiceUuid = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: 'bad-service-uuid', staffId: staffA.id, quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resBadServiceUuid.status === 400, 'Invalid UUID format for serviceId returns 400');

    // 13.3 Invalid UUID format for staffId
    const resBadStaffUuid = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: 'bad-staff-uuid', quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resBadStaffUuid.status === 400, 'Invalid UUID format for staffId returns 400');

    // 13.4 Zero quantity (quantity: 0)
    const resZeroQty = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 0 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resZeroQty.status === 400, 'Zero quantity (quantity: 0) returns 400');

    // 13.5 Negative quantity (quantity: -1)
    const resNegQty = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: -1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resNegQty.status === 400, 'Negative quantity (quantity: -1) returns 400');

    // 13.6 Negative unitPrice (unitPrice: -50)
    const resNegPrice = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1, unitPrice: -50 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resNegPrice.status === 400, 'Negative unitPrice returns 400');

    // 13.7 Negative discountAmount (discountAmount: -20)
    const resNegDisc = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1, discountAmount: -20 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resNegDisc.status === 400, 'Negative discountAmount returns 400');

    // 13.8 Negative tipAmount (tipAmount: -10)
    const resNegTip = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
        tipAmount: -10,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resNegTip.status === 400, 'Negative tipAmount returns 400');

    // 13.9 Invalid paymentMethod
    const resBadPayMethod = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
        paymentMethod: 'BITCOIN',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resBadPayMethod.status === 400, 'Invalid paymentMethod returns 400');

    // 13.10 Invalid status enum on creation
    const resBadStatusCreate = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        status: 'NON_EXISTENT_STATUS',
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resBadStatusCreate.status === 400, 'Invalid status enum on creation returns 400');

    // 13.11 Service item with empty staffId string
    const resEmptyStaffStr = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: '   ', quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resEmptyStaffStr.status === 400, 'Service item with whitespace staffId returns 400');

    // -------------------------------------------------------------------------
    // 14. SUBSCRIPTION & MODULE RESTRICTION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Subscription & Module Restriction Tests ---');

    // 14.1 Disabled POS module for company returns 403 Forbidden
    const currentModules = (await prisma.tenant.findUnique({ where: { id: tenantAId } }))?.enabledModules;
    await prisma.tenant.update({
      where: { id: tenantAId },
      data: { enabledModules: ['SERVICES', 'STAFF'] },
    });
    const resPosDisabled = await request('GET', '/api/pos/orders', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resPosDisabled.status === 403, 'POS access with disabled POS module returns 403 Forbidden');

    // Restore enabled modules
    await prisma.tenant.update({
      where: { id: tenantAId },
      data: { enabledModules: currentModules as any },
    });
    const resPosRestored = await request('GET', '/api/pos/orders', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resPosRestored.status === 200, 'Restoring POS module in tenant re-enables POS access (200 OK)');

    // 14.2 Corrupted / Tampered JWT Signature returns 401 Unauthorized
    const resTamperedToken = await request('GET', '/api/pos/orders', undefined, {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature',
    });
    assert(resTamperedToken.status === 401, 'Tampered JWT signature returns 401 Unauthorized');

    // -------------------------------------------------------------------------
    // 15. NON-EXISTENT ENTITY & 404 TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Non-Existent Entity & 404 Tests ---');

    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    // 15.1 Non-existent serviceId in calculation -> 400
    const resNonExistentService = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: fakeUuid, staffId: staffA.id, quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resNonExistentService.status === 400, 'Non-existent serviceId returns 400');

    // 15.2 Non-existent staffId in calculation -> 400
    const resNonExistentStaff = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: fakeUuid, quantity: 1 }],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resNonExistentStaff.status === 400, 'Non-existent staffId returns 400');

    // 15.3 Non-existent order on GET by ID -> 404
    const resNonExistentOrderGet = await request('GET', `/api/pos/orders/${fakeUuid}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentOrderGet.status === 404, 'GET non-existent order ID returns 404');

    // 15.4 Non-existent order on accept -> 404
    const resNonExistentAccept = await request('POST', `/api/pos/orders/${fakeUuid}/accept`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentAccept.status === 404, 'Accept non-existent order returns 404');

    // 15.5 Non-existent order on reject -> 404
    const resNonExistentReject = await request('POST', `/api/pos/orders/${fakeUuid}/reject`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentReject.status === 404, 'Reject non-existent order returns 404');

    // 15.6 Non-existent order on invoice -> 404
    const resNonExistentInvoice = await request('GET', `/api/pos/orders/${fakeUuid}/invoice`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentInvoice.status === 404, 'GET invoice for non-existent order returns 404');

    // 15.7 Non-existent order on resend -> 404
    const resNonExistentResend = await request('POST', `/api/pos/orders/${fakeUuid}/resend`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentResend.status === 404, 'Resend invoice for non-existent order returns 404');

    // 15.8 Non-existent order on whatsapp -> 404
    const resNonExistentWhatsapp = await request('POST', `/api/pos/orders/${fakeUuid}/whatsapp`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentWhatsapp.status === 404, 'Send WhatsApp for non-existent order returns 404');

    // 15.9 Non-existent order on DELETE -> 404
    const resNonExistentDelete = await request('DELETE', `/api/pos/orders/${fakeUuid}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentDelete.status === 404, 'DELETE non-existent order returns 404');

    // 15.10 Non-existent order number on GET by number -> 404
    const resNonExistentNum = await request('GET', '/api/pos/orders/number/INV-99999999-9999', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(resNonExistentNum.status === 404, 'GET order by non-existent order number returns 404');

    // -------------------------------------------------------------------------
    // 16. PROMOTION, COUPON & GIFT CARD EDGE CASES
    // -------------------------------------------------------------------------
    console.log('\n--- 16. Promotion, Coupon & Gift Card Edge Cases ---');

    // 16.1 Inactive coupon rejected
    const inactiveCoupon = await prisma.coupon.create({
      data: {
        tenantId: tenantAId,
        code: 'INACTIVECOUPON',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        isActive: false,
      },
    });
    const resInactiveCoupon = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
        couponCode: 'INACTIVECOUPON',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resInactiveCoupon.status === 400, 'Applying inactive coupon returns 400');

    // 16.2 Expired coupon rejected
    const expiredCoupon = await prisma.coupon.create({
      data: {
        tenantId: tenantAId,
        code: 'EXPIREDCOUPON',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        endDate: new Date(Date.now() - 86400000), // Expired yesterday
        isActive: true,
      },
    });
    const resExpiredCoupon = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
        couponCode: 'EXPIREDCOUPON',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resExpiredCoupon.status === 400, 'Applying expired coupon returns 400');

    // 16.3 Coupon minOrderValue requirement not met
    const minOrderCoupon = await prisma.coupon.create({
      data: {
        tenantId: tenantAId,
        code: 'MINORDER5000',
        discountType: 'FIXED',
        discountValue: 500,
        minOrderValue: 5000,
        isActive: true,
      },
    });
    const resMinOrderFailed = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1, unitPrice: 800 }],
        couponCode: 'MINORDER5000',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resMinOrderFailed.status === 400, 'Coupon minOrderValue requirement returns 400 when subtotal too low');

    // 16.4 Inactive gift card rejected
    const inactiveGiftCard = await prisma.giftCard.create({
      data: {
        tenantId: tenantAId,
        name: 'Inactive Card',
        code: 'INACTIVEGC',
        amount: 500,
        validityDays: 30,
        isActive: false,
      },
    });
    const resInactiveGiftCard = await request(
      'POST',
      '/api/pos/calculate',
      {
        guestId: guestA.id,
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1 }],
        giftCardCode: 'INACTIVEGC',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(resInactiveGiftCard.status === 400, 'Applying inactive gift card returns 400');

    // Clean up test coupons & gift cards
    await prisma.coupon.deleteMany({ where: { id: { in: [inactiveCoupon.id, expiredCoupon.id, minOrderCoupon.id] } } });
    await prisma.giftCard.deleteMany({ where: { id: inactiveGiftCard.id } });

    // -------------------------------------------------------------------------
    // 17. DATABASE PERSISTENCE, ATOMICITY & CONCURRENCY
    // -------------------------------------------------------------------------
    console.log('\n--- 17. Database Persistence, Atomicity & Concurrency ---');

    // 17.1 Guest visit & spend atomicity upon completing an order
    const guestBeforeComplete = await prisma.guest.findUnique({ where: { id: guestA.id } });
    const prevVisits = Number(guestBeforeComplete?.totalVisits || 0);
    const prevSpend = Number(guestBeforeComplete?.totalSpend || 0);

    const testAtomicOrderRes = await request(
      'POST',
      '/api/pos/orders',
      {
        guestId: guestA.id,
        status: 'NEW',
        items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1, unitPrice: 600 }],
        paymentMethod: 'CASH',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const atomicOrderId = testAtomicOrderRes.data?.data?.id;
    const atomicOrderTotal = Number(testAtomicOrderRes.data?.data?.totalAmount);

    // Complete order
    await request('POST', `/api/pos/orders/${atomicOrderId}/complete`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const guestAfterComplete = await prisma.guest.findUnique({ where: { id: guestA.id } });
    assert(
      Number(guestAfterComplete?.totalVisits) === prevVisits + 1,
      'Completing order increments guest totalVisits by 1 in database'
    );
    assert(
      Number(guestAfterComplete?.totalSpend) === prevSpend + atomicOrderTotal,
      'Completing order increments guest totalSpend by totalAmount in database'
    );

    // 17.2 Cancelling order reverses guest spend & visits
    await request('POST', `/api/pos/orders/${atomicOrderId}/cancel`, { reason: 'Customer requested refund' }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const guestAfterCancel = await prisma.guest.findUnique({ where: { id: guestA.id } });
    assert(
      Number(guestAfterCancel?.totalVisits) === prevVisits,
      'Cancelling completed order decrements guest totalVisits back to original value'
    );
    assert(
      Number(guestAfterCancel?.totalSpend) === prevSpend,
      'Cancelling completed order decrements guest totalSpend back to original value'
    );

    // 17.3 Concurrency Test: 5 concurrent order submissions produce distinct sequential order numbers
    const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
      request(
        'POST',
        '/api/pos/orders',
        {
          guestId: guestA.id,
          status: 'COMPLETED',
          items: [{ itemType: 'SERVICE', serviceId: serviceA.id, staffId: staffA.id, quantity: 1, unitPrice: 500 + i * 50 }],
          paymentMethod: 'CASH',
        },
        { Authorization: `Bearer ${adminAToken}` }
      )
    );

    const concurrentResponses = await Promise.all(concurrentRequests);
    const all201 = concurrentResponses.every((r) => r.status === 201);
    assert(all201, '5 concurrent order creations all succeed with status 201');

    const createdOrderNumbers = concurrentResponses.map((r) => r.data?.data?.orderNumber);
    const uniqueOrderNumbers = new Set(createdOrderNumbers);
    assert(
      uniqueOrderNumbers.size === 5,
      '5 concurrent orders generate 5 unique, non-colliding order numbers (Concurrency safety)'
    );

    // Verify all 5 persisted in database
    const validOrderNumbers = createdOrderNumbers.filter((x): x is string => typeof x === 'string');
    const dbCount = await prisma.posOrder.count({
      where: { tenantId: tenantAId, orderNumber: { in: validOrderNumbers } },
    });
    assert(dbCount === 5, 'All 5 concurrent orders exist in the database');

    // -------------------------------------------------------------------------
    // 18. CSV EXPORT
    // -------------------------------------------------------------------------
    console.log('\n--- Section 18: POS Orders CSV Export ---');

    // 18.1 Export all POS orders as CSV
    const csvRes = await request('GET', '/api/pos?export=csv', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(csvRes.status === 200, 'GET /api/pos?export=csv returns 200 OK');
    assert(
      String(csvRes.headers.get('content-type')).includes('text/csv'),
      'Response Content-Type header includes text/csv'
    );
    assert(
      String(csvRes.headers.get('content-disposition')).includes('attachment; filename="pos-orders-export-'),
      'Response Content-Disposition header indicates attachment with filename'
    );
    assert(
      csvRes.text.includes('Order Number,Date,Guest Name,Guest Mobile,Items Count,Items Summary,Subtotal,Discount Amount,Tax Amount,Tip Amount,Total Amount,Payment Method,Payment Status,Order Status,Cashier Name,Notes'),
      'CSV output contains standard POS orders header row'
    );
    assert(
      csvRes.text.includes(guestA.name),
      'CSV output contains order records with guest name'
    );

    // 18.2 Export with date filter
    const csvFilteredRes = await request(
      'GET',
      '/api/pos?export=csv&dateFrom=2020-01-01&dateTo=2030-12-31',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(csvFilteredRes.status === 200, 'GET /api/pos?export=csv with date filter returns 200 OK');
    assert(csvFilteredRes.text.split('\n').length >= 2, 'CSV output contains data rows');

    // 18.3 Export via /api/pos/orders endpoint
    const csvOrdersEndpointRes = await request(
      'GET',
      '/api/pos/orders?export=csv',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(csvOrdersEndpointRes.status === 200, 'GET /api/pos/orders?export=csv returns 200 OK');
    assert(csvOrdersEndpointRes.text.includes('Order Number'), 'Orders endpoint CSV output contains header');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`   POS Module Tests: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      throw new Error(`${failed} tests failed in POS module test suite`);
    }
  } finally {
    server?.close();
  }
}

if (process.argv[1]?.endsWith('pos.test.ts')) {
  runPosTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}
