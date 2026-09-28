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
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE CRM Guests Module: Complete Test & Security Suite');
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

    // Cleanup previous POS orders and guest test records
    await prisma.posOrderItem.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.posPayment.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.posOrder.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.guest.deleteMany({
      where: {
        tenantId: { in: [tenantAId, tenantBId] },
      },
    });

    // -------------------------------------------------------------------------
    // 2. AUTHENTICATION & SECURITY NEGATIVE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Authentication & Authorization Negative Tests ---');

    // 2.1 No token provided
    const noToken = await request('GET', '/api/crm/guests');
    assert(noToken.status === 401, 'Request without token returns 401 Unauthorized');

    // 2.2 Invalid token
    const invalidToken = await request('GET', '/api/crm/guests', undefined, {
      Authorization: 'Bearer invalid-token-sample',
    });
    assert(invalidToken.status === 401, 'Request with invalid token returns 401 Unauthorized');

    // -------------------------------------------------------------------------
    // 3. CASHIER RBAC (POS INTEGRATION)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cashier RBAC & POS Quick Sale Flow ---');

    // 3.1 Cashier can list guests
    const cashierList = await request('GET', '/api/crm/guests', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierList.status === 200, 'Cashier can list guests (for POS customer selection)');

    // 3.2 Cashier can create a walk-in guest
    const cashierCreate = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Walk-in Cashier Guest',
        mobile: '+919811111111',
        gender: 'FEMALE',
        customerType: 'WALK_IN',
        notes: 'Walk-in created during quick sale POS',
      },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierCreate.status === 201, 'Cashier can create walk-in guest at POS checkout');
    const cashierCreatedGuestId = cashierCreate.data?.data?.id;

    // 3.3 Cashier can update guest details
    const cashierUpdate = await request(
      'PUT',
      `/api/crm/guests/${cashierCreatedGuestId}`,
      {
        email: 'walkin@example.com',
        hairType: 'Wavy',
      },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierUpdate.status === 200, 'Cashier can update guest details (e.g. hair type, email)');

    // 3.4 Cashier is FORBIDDEN from updating guest status / blocking
    const cashierStatus = await request(
      'PATCH',
      `/api/crm/guests/${cashierCreatedGuestId}/status`,
      { isBlocked: true },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierStatus.status === 403, 'Cashier is FORBIDDEN from changing status or blocking guests');

    // 3.5 Cashier is FORBIDDEN from deleting a guest
    const cashierDelete = await request(
      'DELETE',
      `/api/crm/guests/${cashierCreatedGuestId}`,
      undefined,
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierDelete.status === 403, 'Cashier is FORBIDDEN from deleting guests');

    // -------------------------------------------------------------------------
    // 4. COMPREHENSIVE GUEST CREATION & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Comprehensive Guest Creation & Validation ---');

    // Setup master dependencies in Tenant A for relations test
    const salutation = await prisma.salutation.upsert({
      where: {
        tenantId_title: { tenantId: tenantAId, title: 'Ms.' },
      },
      update: {},
      create: {
        tenantId: tenantAId,
        title: 'Ms.',
        isActive: true,
      },
    });

    const crmSegment = await prisma.crmSegment.upsert({
      where: {
        tenantId_name: { tenantId: tenantAId, name: 'VIP Spenders' },
      },
      update: {},
      create: {
        tenantId: tenantAId,
        name: 'VIP Spenders',
        description: 'VIP Clients',
        isActive: true,
      },
    });

    const membership = await prisma.membership.upsert({
      where: {
        tenantId_name: { tenantId: tenantAId, name: 'Diamond Salon VIP' },
      },
      update: {},
      create: {
        tenantId: tenantAId,
        name: 'Diamond Salon VIP',
        price: 9999.0,
        validityDays: 365,
        discountPercentage: 20.0,
        isActive: true,
      },
    });

    // 4.1 Create full comprehensive guest
    const fullGuestPayload = {
      salutation: 'Ms.',
      salutationId: salutation.id,
      firstName: 'Priya',
      lastName: 'Sharma',
      name: 'Priya Sharma',
      displayName: 'Priya S.',
      gender: 'FEMALE',
      dateOfBirth: '1992-08-15',
      mobile: '+919876543210',
      alternateMobile: '+919876543211',
      email: 'priya.sharma@example.com',
      address: 'Suite 402, Green Glen Layout, Bellandur',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560103',
      anniversary: '2018-11-20',
      gstNumber: '29ABCDE1234F1Z5',
      hairType: 'Curly / Dry',
      preferences: 'Prefers organic chemical-free shampoos, warm water, and cold brew coffee',
      notes: 'Sensitive scalp, alert stylist before scalp massage',
      tags: ['VIP', 'Curly Hair', 'Bridal Prospect'],
      customerType: 'VIP',
      source: 'INSTAGRAM',
      referralCode: 'PRIYA2026',
      crmSegmentId: crmSegment.id,
      membershipId: membership.id,
      membershipExpiry: '2027-08-15T00:00:00.000Z',
      loyaltyPoints: 350,
      isActive: true,
      isBlocked: false,
    };

    const fullCreate = await request('POST', '/api/crm/guests', fullGuestPayload, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(fullCreate.status === 201, 'Admin can create guest with complete profile and relationships');
    const guestA1 = fullCreate.data?.data;
    assert(guestA1?.guestCode?.startsWith('GST-'), 'Auto-generated guest code starts with GST-');
    assert(guestA1?.salutationRef?.title === 'Ms.', 'Salutation relation resolved correctly');
    assert(guestA1?.crmSegmentRef?.name === 'VIP Spenders', 'CRM Segment relation resolved correctly');
    assert(guestA1?.membershipRef?.name === 'Diamond Salon VIP', 'Membership relation resolved correctly');
    assert(guestA1?.displayName === 'Priya S.', 'Display name saved correctly');
    assert(guestA1?.tags?.length === 3, 'Guest tags stored and returned as array');

    // 4.2 Create guest with custom guestCode
    const customCodeGuest = await request(
      'POST',
      '/api/crm/guests',
      {
        guestCode: 'CUSTOM-007',
        name: 'James Bond',
        mobile: '+919000000007',
        customerType: 'CORPORATE',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(customCodeGuest.status === 201, 'Guest with custom guestCode created successfully');
    assert(customCodeGuest.data?.data?.guestCode === 'CUSTOM-007', 'Custom guest code preserved');

    // 4.3 Create guest with POS dob alias
    const posDobGuest = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Ananya Roy',
        mobile: '+919888888888',
        dob: '1995-05-12',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(posDobGuest.status === 201, 'Guest created with POS dob alias');

    // 4.4 Duplicate mobile within same tenant -> 409 Conflict
    const dupMobile = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Another Priya',
        mobile: '+919876543210', // duplicate
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(dupMobile.status === 409, 'Duplicate mobile in same tenant returns 409 Conflict');

    // 4.5 Duplicate custom guestCode within same tenant -> 409 Conflict
    const dupCode = await request(
      'POST',
      '/api/crm/guests',
      {
        guestCode: 'CUSTOM-007', // duplicate
        name: 'Second 007',
        mobile: '+919000000008',
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(dupCode.status === 409, 'Duplicate guestCode in same tenant returns 409 Conflict');

    // 4.6 Missing required name
    const missingName = await request(
      'POST',
      '/api/crm/guests',
      { mobile: '+919111111111' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(missingName.status === 400, 'Missing name returns 400 Validation Error');

    // 4.7 Missing required mobile
    const missingMobile = await request(
      'POST',
      '/api/crm/guests',
      { name: 'No Mobile Customer' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(missingMobile.status === 400, 'Missing mobile returns 400 Validation Error');

    // 4.8 Invalid mobile format
    const invalidMobile = await request(
      'POST',
      '/api/crm/guests',
      { name: 'Invalid Phone', mobile: '123' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(invalidMobile.status === 400, 'Invalid short mobile format returns 400 Validation Error');

    // 4.9 Invalid email format
    const invalidEmail = await request(
      'POST',
      '/api/crm/guests',
      { name: 'Invalid Email', mobile: '+919222222222', email: 'not-an-email' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(invalidEmail.status === 400, 'Invalid email format returns 400 Validation Error');

    // 4.10 Negative loyalty points
    const negPoints = await request(
      'POST',
      '/api/crm/guests',
      { name: 'Neg Points', mobile: '+919333333333', loyaltyPoints: -50 },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(negPoints.status === 400, 'Negative loyalty points returns 400 Validation Error');

    // -------------------------------------------------------------------------
    // 5. SAAS MULTI-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. SaaS Multi-Tenant Isolation ---');

    // 5.1 Tenant B creates guest with IDENTICAL mobile number to Tenant A's guest
    const tenantBCreate = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Priya Sharma (Tenant B Customer)',
        mobile: '+919876543210', // Identical to Tenant A's guest
        customerType: 'VIP',
      },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(
      tenantBCreate.status === 201,
      'Tenant B can create guest with IDENTICAL mobile number to Tenant A (Tenant-scoped uniqueness)'
    );
    const guestB1 = tenantBCreate.data?.data;

    // 5.2 Tenant A cannot GET Tenant B's guest by ID
    const crossGetA = await request('GET', `/api/crm/guests/${guestB1.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(crossGetA.status === 404, 'Tenant A cannot GET Tenant B guest by ID (404 Not Found)');

    // 5.3 Tenant B cannot GET Tenant A's guest by ID
    const crossGetB = await request('GET', `/api/crm/guests/${guestA1.id}`, undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    assert(crossGetB.status === 404, 'Tenant B cannot GET Tenant A guest by ID (404 Not Found)');

    // 5.4 Tenant A cannot UPDATE Tenant B's guest
    const crossUpdateA = await request(
      'PUT',
      `/api/crm/guests/${guestB1.id}`,
      { name: 'Hacked Tenant B Guest' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(crossUpdateA.status === 404, 'Tenant A cannot UPDATE Tenant B guest (404 Not Found)');

    // 5.5 Tenant B cannot UPDATE Tenant A's guest
    const crossUpdateB = await request(
      'PUT',
      `/api/crm/guests/${guestA1.id}`,
      { name: 'Hacked Tenant A Guest' },
      { Authorization: `Bearer ${adminBToken}` }
    );
    assert(crossUpdateB.status === 404, 'Tenant B cannot UPDATE Tenant A guest (404 Not Found)');

    // 5.6 Tenant A cannot update status of Tenant B's guest
    const crossStatus = await request(
      'PATCH',
      `/api/crm/guests/${guestB1.id}/status`,
      { isBlocked: true },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(crossStatus.status === 404, 'Tenant A cannot update status of Tenant B guest (404 Not Found)');

    // 5.7 Tenant A cannot DELETE Tenant B's guest
    const crossDelete = await request('DELETE', `/api/crm/guests/${guestB1.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(crossDelete.status === 404, 'Tenant A cannot DELETE Tenant B guest (404 Not Found)');

    // 5.8 Tenant A list never leaks Tenant B records
    const listA = await request('GET', '/api/crm/guests?limit=100', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const hasGuestBInA = listA.data?.data?.items?.some((g: any) => g.id === guestB1.id);
    assert(!hasGuestBInA, 'Tenant A guest list never includes Tenant B records');

    // 5.9 Tenant B list never leaks Tenant A records
    const listB = await request('GET', '/api/crm/guests?limit=100', undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    const hasGuestAInB = listB.data?.data?.items?.some((g: any) => g.id === guestA1.id);
    assert(!hasGuestAInB, 'Tenant B guest list never includes Tenant A records');

    // 5.10 Cross-tenant search never returns another tenant's guest
    const searchCross = await request('GET', '/api/crm/guests?search=Tenant+B+Customer', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(
      searchCross.data?.data?.items?.length === 0,
      'Cross-tenant search returns 0 results for another company customer name'
    );

    // -------------------------------------------------------------------------
    // 6. READ, SEARCH, FILTER, AND PAGINATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Read, Search, Filters & Pagination ---');

    // 6.1 Get by ID
    const getById = await request('GET', `/api/crm/guests/${guestA1.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getById.status === 200, 'Get guest by ID returns 200 with full details');
    assert(getById.data?.data?.email === 'priya.sharma@example.com', 'Guest email matches');

    // 6.2 Get by invalid ID
    const getInvalid = await request('GET', '/api/crm/guests/00000000-0000-0000-0000-000000000000', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(getInvalid.status === 404, 'Get non-existent guest returns 404 Not Found');

    // 6.3 Quick lookup by mobile
    const lookupMobile = await request('GET', '/api/crm/guests/lookup/%2B919876543210', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(lookupMobile.status === 200, 'Quick lookup by mobile returns 200 (POS feature)');
    assert(lookupMobile.data?.data?.id === guestA1.id, 'Lookup returns correct guest');

    // 6.4 Quick lookup by unknown mobile
    const lookupUnknown = await request('GET', '/api/crm/guests/lookup/%2B919999999999', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(lookupUnknown.status === 404, 'Quick lookup for unknown mobile returns 404 Not Found');

    // 6.5 Search by mobile
    const searchMobile = await request('GET', '/api/crm/guests?search=9876543210', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(searchMobile.data?.data?.items?.length >= 1, 'Search by mobile returns matching guest');

    // 6.6 Search by alternate mobile
    const searchAltMobile = await request('GET', '/api/crm/guests?search=9876543211', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(searchAltMobile.data?.data?.items?.length >= 1, 'Search by alternate mobile returns matching guest');

    // 6.7 Search by email
    const searchEmail = await request('GET', '/api/crm/guests?search=priya.sharma@example.com', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(searchEmail.data?.data?.items?.length >= 1, 'Search by email returns matching guest');

    // 6.8 Search by guestCode
    const searchCode = await request('GET', '/api/crm/guests?search=CUSTOM-007', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(searchCode.data?.data?.items?.length === 1, 'Search by guestCode returns exact matching guest');

    // 6.9 Filter by gender
    const filterGender = await request('GET', '/api/crm/guests?gender=FEMALE', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(filterGender.status === 200, 'Filter by gender returns 200');
    assert(
      filterGender.data?.data?.items?.every((g: any) => g.gender === 'FEMALE'),
      'All returned guests have gender FEMALE'
    );

    // 6.10 Filter by customerType
    const filterType = await request('GET', '/api/crm/guests?customerType=VIP', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(filterType.status === 200, 'Filter by customerType returns 200');
    assert(
      filterType.data?.data?.items?.every((g: any) => g.customerType === 'VIP'),
      'All returned guests have customerType VIP'
    );

    // 6.11 Filter by membership
    const filterMem = await request('GET', `/api/crm/guests?membershipId=${membership.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(filterMem.status === 200, 'Filter by membershipId returns 200');
    assert(filterMem.data?.data?.items?.length >= 1, 'Returned guest has specified membership');

    // 6.12 Filter by hasMembership
    const filterHasMem = await request('GET', '/api/crm/guests?hasMembership=true', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(filterHasMem.data?.data?.items?.length >= 1, 'Filter by hasMembership=true returns members');

    // 6.13 Filter by isActive
    const filterActive = await request('GET', '/api/crm/guests?isActive=true', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(filterActive.data?.data?.items?.every((g: any) => g.isActive === true), 'Filter isActive=true matches');

    // 6.14 Pagination check
    const pageCheck = await request('GET', '/api/crm/guests?page=1&limit=2', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(pageCheck.data?.data?.items?.length <= 2, 'Pagination limit is respected');
    assert(pageCheck.data?.data?.page === 1, 'Current page is 1');
    assert(pageCheck.data?.data?.totalPages >= 1, 'Total pages calculated');

    // 6.15 Sorting check
    const sortCheck = await request('GET', '/api/crm/guests?sortBy=name&sortOrder=asc', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(sortCheck.status === 200, 'Sort by name ascending returns 200');

    // 6.16 Video Section 15: Has Anniversary Today Filter
    const todayStr = new Date().toISOString().split('T')[0];
    await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Anniversary Guest',
        mobile: '+919999900001',
        anniversary: todayStr,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const filterAnniv = await request('GET', '/api/crm/guests?hasAnniversaryToday=true', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(filterAnniv.status === 200, 'Filter hasAnniversaryToday returns 200 (Video Section 15)');
    assert(
      filterAnniv.data?.data?.items?.some((g: any) => g.name === 'Anniversary Guest'),
      'Returned guests include guest with anniversary today'
    );

    // -------------------------------------------------------------------------
    // 7. UPDATE GUEST DETAILS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Update Guest Details ---');

    // 7.1 Valid update
    const updateRes = await request(
      'PUT',
      `/api/crm/guests/${guestA1.id}`,
      {
        hairType: 'Wavy / Keratin Treated',
        preferences: 'Updated: Prefers peppermint green tea',
        tags: ['VIP', 'Curly Hair', 'Keratin'],
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateRes.status === 200, 'Admin can update guest hair type, preferences, tags');
    assert(updateRes.data?.data?.hairType === 'Wavy / Keratin Treated', 'Updated hair type persisted');

    // 7.2 Update mobile to new valid mobile
    const updateMobile = await request(
      'PUT',
      `/api/crm/guests/${guestA1.id}`,
      { mobile: '+919876543299' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateMobile.status === 200, 'Admin can update guest mobile number');
    assert(updateMobile.data?.data?.mobile === '+919876543299', 'New mobile persisted');

    // 7.3 Update mobile to already existing mobile in same tenant -> 409 Conflict
    const updateDupMobile = await request(
      'PUT',
      `/api/crm/guests/${guestA1.id}`,
      { mobile: '+919000000007' }, // Taken by James Bond
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(updateDupMobile.status === 409, 'Updating mobile to existing number in company returns 409 Conflict');

    // -------------------------------------------------------------------------
    // 8. STATUS & BLOCKING
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Status & Blocking Actions ---');

    // 8.1 Deactivate guest
    const deactRes = await request(
      'PATCH',
      `/api/crm/guests/${guestA1.id}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(deactRes.status === 200, 'Admin can toggle guest isActive status to false');
    assert(deactRes.data?.data?.isActive === false, 'Guest isActive is false');

    // 8.2 Block guest with reason
    const blockRes = await request(
      'PATCH',
      `/api/crm/guests/${guestA1.id}/status`,
      { isBlocked: true, blockReason: 'Repeated late cancellations without notice' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(blockRes.status === 200, 'Admin can block guest with reason');
    assert(blockRes.data?.data?.isBlocked === true, 'Guest isBlocked is true');
    assert(
      blockRes.data?.data?.blockReason === 'Repeated late cancellations without notice',
      'Block reason stored'
    );

    // 8.3 Unblock and reactivate guest
    const unblockRes = await request(
      'PATCH',
      `/api/crm/guests/${guestA1.id}/status`,
      { isBlocked: false, isActive: true },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(unblockRes.status === 200, 'Admin can unblock and reactivate guest');
    assert(unblockRes.data?.data?.isBlocked === false && unblockRes.data?.data?.isActive === true, 'Guest restored');

    // 8.4 Empty status body
    const emptyStatus = await request('PATCH', `/api/crm/guests/${guestA1.id}/status`, {}, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(emptyStatus.status === 400, 'Empty status payload returns 400 Validation Error');

    // -------------------------------------------------------------------------
    // 9. REFERRALS RELATIONSHIP
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Referral Tracking ---');

    // 9.1 Guest A refers Guest X and Guest Y
    const referralGuest1 = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Neha Kapoor (Friend of Priya)',
        mobile: '+919777777771',
        referredByGuestId: guestA1.id,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(referralGuest1.status === 201, 'Created guest referred by Priya');

    const referralGuest2 = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Rohan Mehra (Colleague of Priya)',
        mobile: '+919777777772',
        referredByGuestId: guestA1.id,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(referralGuest2.status === 201, 'Created second guest referred by Priya');

    // 9.2 Get referrals of Guest A
    const referralsList = await request('GET', `/api/crm/guests/${guestA1.id}/referrals`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(referralsList.status === 200, 'Get referrals for guest returns 200');
    assert(referralsList.data?.data?.length === 2, 'Priya has exactly 2 referred guests');

    // -------------------------------------------------------------------------
    // 10. ROUTE ALIASES & SUPERADMIN IMPERSONATION
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Route Aliases & SuperAdmin Impersonation ---');

    // 10.1 Access via /api/guests alias
    const aliasGet = await request('GET', `/api/guests/${guestA1.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(aliasGet.status === 200, 'Accessing via route alias /api/guests/:id returns 200');

    // 10.2 SuperAdmin with impersonation
    const superGet = await request('GET', `/api/crm/guests/${guestA1.id}`, undefined, {
      Authorization: `Bearer ${superToken}`,
      'x-impersonate-tenant-id': tenantAId,
    });
    assert(superGet.status === 200, 'SuperAdmin can access guest in Tenant A context with impersonation');

    // -------------------------------------------------------------------------
    // 11. AUDIT LOGGING VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Audit Logging ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: tenantAId,
        entityType: 'GUEST',
      },
    });
    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes('GUEST_CREATED'), 'Audit log contains GUEST_CREATED');
    assert(actions.includes('GUEST_UPDATED'), 'Audit log contains GUEST_UPDATED');
    assert(actions.includes('GUEST_STATUS_UPDATED'), 'Audit log contains GUEST_STATUS_UPDATED');

    // -------------------------------------------------------------------------
    // 12. DELETE & DEACTIVATION
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Delete & Deactivation ---');

    // 12.1 Delete guest with dependent referrals -> soft-deactivated
    const deleteReferrer = await request('DELETE', `/api/crm/guests/${guestA1.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(deleteReferrer.status === 200, 'Deleting guest with referrals completes without foreign key crash');
    const checkedReferrer = await request('GET', `/api/crm/guests/${guestA1.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(checkedReferrer.data?.data?.isActive === false, 'Referrer guest was safely soft-deactivated');

    // 12.2 Delete guest without dependencies
    const deleteClean = await request('DELETE', `/api/crm/guests/${customCodeGuest.data?.data?.id}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    assert(deleteClean.status === 200, 'Deleting unreferenced guest returns 200');

    // 12.3 Delete non-existent ID
    const deleteNonExistent = await request(
      'DELETE',
      '/api/crm/guests/00000000-0000-0000-0000-000000000000',
      undefined,
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(deleteNonExistent.status === 404, 'Deleting non-existent guest returns 404 Not Found');

    // -------------------------------------------------------------------------
    // 13. CONCURRENCY & RACE CONDITIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Concurrency & Race Conditions ---');

    // 13.1 Simultaneous creation with same mobile number
    const concurrentMobile = '+919999888800';
    const concurrentPayload = {
      name: 'Concurrent Guest Candidate',
      mobile: concurrentMobile,
      customerType: 'REGULAR',
    };

    const concurrentResults = await Promise.all([
      request('POST', '/api/crm/guests', concurrentPayload, { Authorization: `Bearer ${adminAToken}` }),
      request('POST', '/api/crm/guests', concurrentPayload, { Authorization: `Bearer ${adminAToken}` }),
      request('POST', '/api/crm/guests', concurrentPayload, { Authorization: `Bearer ${adminAToken}` }),
      request('POST', '/api/crm/guests', concurrentPayload, { Authorization: `Bearer ${adminAToken}` }),
    ]);

    const createdCount = concurrentResults.filter((r) => r.status === 201).length;
    const conflictCount = concurrentResults.filter((r) => r.status === 409).length;
    assert(
      createdCount === 1,
      'Exactly one concurrent request successfully creates guest (201)',
      `Actual createdCount: ${createdCount}, statuses: ${JSON.stringify(concurrentResults.map((r) => r.status))}`
    );
    assert(
      conflictCount === 3,
      'Other 3 concurrent requests are safely rejected with 409 Conflict',
      `Actual conflictCount: ${conflictCount}`
    );

    // -------------------------------------------------------------------------
    // 14. MASS ASSIGNMENT & SPOOFING PREVENTION
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Mass Assignment & Spoofing Prevention ---');

    // 14.1 Attempt to spoof tenantId and system metrics in create body
    const spoofCreate = await request(
      'POST',
      '/api/crm/guests',
      {
        name: 'Spoof Test Guest',
        mobile: '+919999888801',
        tenantId: tenantBId, // attempting to inject Tenant B ID into Tenant A request
        id: '99999999-9999-9999-9999-999999999999',
        totalSpend: 999999,
        visitCount: 50,
      },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(
      spoofCreate.status === 201,
      'Guest created while safely discarding spoofed fields',
      `Status: ${spoofCreate.status}, Body: ${JSON.stringify(spoofCreate.data)}`
    );
    assert(spoofCreate.data?.data?.tenantId === tenantAId, 'Guest strictly belongs to authenticated Tenant A, not spoofed Tenant B');
    assert(spoofCreate.data?.data?.id !== '99999999-9999-9999-9999-999999999999', 'Database generated ID, client injected ID ignored');
    assert(Number(spoofCreate.data?.data?.totalSpend) === 0, 'Total spend initialized to 0, not spoofed 999999');
    assert(spoofCreate.data?.data?.totalVisits === 0, 'Total visits initialized to 0, not spoofed 50');

    // -------------------------------------------------------------------------
    // 15. BOUNDARY & STRING LENGTH VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Boundary & String Length Validation ---');

    // 15.1 Name exceeds 100 characters
    const longName = 'A'.repeat(101);
    const longNameRes = await request(
      'POST',
      '/api/crm/guests',
      { name: longName, mobile: '+919999888802' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(longNameRes.status === 400, 'Name exceeding 100 characters returns 400 Bad Request');

    // 15.2 Mobile exceeds 20 characters
    const longMobile = '+919999999999999999999';
    const longMobileRes = await request(
      'POST',
      '/api/crm/guests',
      { name: 'Boundary Guest', mobile: longMobile },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(longMobileRes.status === 400, 'Mobile exceeding 20 digits returns 400 Bad Request');

    // 15.3 Empty name string
    const emptyNameRes = await request(
      'POST',
      '/api/crm/guests',
      { name: '   ', mobile: '+919999888803' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    assert(emptyNameRes.status === 400, 'Empty name returns 400 Bad Request');

    console.log('\n================================================================');
    console.log(`   CRM GUESTS TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    server.close();
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n❌ Unhandled error in tests:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
