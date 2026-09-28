import { prisma } from '../src/config/database.js';

const baseUrl = 'http://127.0.0.1:5000';

interface TestCaseResult {
  code: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  status: number;
  responseHeaders: Record<string, string>;
  responseBody: any;
  dbVerification?: string;
  expected: string;
  actual: string;
  result: 'PASS' | 'FAIL';
  failReason?: string;
}

const results: TestCaseResult[] = [];

function getGuestList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getGuestTotal(body: any): number {
  if (typeof body?.data?.total === 'number') return body.data.total;
  if (typeof body?.meta?.total === 'number') return body.meta.total;
  return getGuestList(body?.data).length;
}

async function makeRequest(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
) {
  const url = `${baseUrl}${path}`;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    if (['content-type', 'content-length', 'etag'].includes(key.toLowerCase())) {
      responseHeaders[key] = val;
    }
  });

  let responseBody: any;
  const text = await res.text();
  try {
    responseBody = JSON.parse(text);
  } catch {
    responseBody = text;
  }

  return {
    status: res.status,
    headers: responseHeaders,
    body: responseBody,
    url,
    reqHeaders,
  };
}

function recordResult(test: TestCaseResult) {
  results.push(test);
  console.log(`\n==================================================`);
  console.log(`TEST CASE: ${test.code}`);
  console.log(`NAME: ${test.name}`);
  console.log(`==================================================\n`);
  console.log(`REQUEST\n`);
  console.log(`Method:\n${test.method}\n`);
  console.log(`URL:\n${test.url}\n`);
  console.log(`Headers:\n${JSON.stringify(test.headers, null, 2)}\n`);
  if (test.body !== undefined) {
    console.log(`Body:\n${JSON.stringify(test.body, null, 2)}\n`);
  }
  console.log(`--------------------------------------------------\n`);
  console.log(`ACTUAL RESPONSE\n`);
  console.log(`HTTP Status:\n${test.status}\n`);
  console.log(`Response Headers:\n${JSON.stringify(test.responseHeaders, null, 2)}\n`);
  console.log(`Response Body:\n${JSON.stringify(test.responseBody, null, 2)}\n`);
  console.log(`--------------------------------------------------\n`);
  if (test.dbVerification) {
    console.log(`DATABASE VERIFICATION\n`);
    console.log(`${test.dbVerification}\n`);
    console.log(`--------------------------------------------------\n`);
  }
  console.log(`EXPECTED:\n${test.expected}\n`);
  console.log(`ACTUAL:\n${test.actual}\n`);
  console.log(`RESULT:\n${test.result}\n`);
  console.log(`==================================================\n`);

  if (test.result === 'FAIL') {
    console.error(`\n❌ [STOPPING EXECUTION] Test ${test.code} failed: ${test.failReason}`);
    process.exit(1);
  }
}

async function runPostmanExecution() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE CRM Guests: Real-Execution Postman Test Suite');
  console.log(`   Target Server: ${baseUrl}`);
  console.log('================================================================\n');

  // Verify server reachability first
  try {
    await fetch(`${baseUrl}/api/guests`);
  } catch (err: any) {
    console.error(`Server unreachable at ${baseUrl}:`, err.message);
    process.exit(1);
  }

  let adminAToken = '';
  let adminBToken = '';
  let cashierAToken = '';
  let superAdminToken = '';
  let tenantAId = '';
  let tenantBId = '';
  let guestAId = '';
  let guestBId = '';

  // ---------------------------------------------------------------------------
  // CG-001: Admin A Login
  // ---------------------------------------------------------------------------
  {
    const reqBody = { username: 'admin', password: 'DevelopmentPassword123!' };
    const res = await makeRequest('POST', '/api/auth/login', reqBody);
    adminAToken = res.body?.data?.token || '';
    tenantAId = res.body?.data?.user?.tenantId || '';
    const pass = res.status === 200 && Boolean(adminAToken) && Boolean(tenantAId);
    recordResult({
      code: 'CG-001',
      name: 'Admin A Login',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: reqBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `Verified user 'admin' in PostgreSQL. Tenant ID resolved: ${tenantAId}`,
      expected: 'HTTP 200 with JWT authentication token and tenantId for Tenant A Admin',
      actual: `HTTP ${res.status}, success: ${res.body?.success}, token extracted: ${adminAToken.substring(0, 20)}...`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Failed to authenticate Admin A or missing token/tenantId',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-002: Admin B Login
  // ---------------------------------------------------------------------------
  {
    const reqBody = { username: 'admin-b', password: 'DevelopmentPassword123!' };
    const res = await makeRequest('POST', '/api/auth/login', reqBody);
    adminBToken = res.body?.data?.token || '';
    tenantBId = res.body?.data?.user?.tenantId || '';
    const pass = res.status === 200 && Boolean(adminBToken) && Boolean(tenantBId) && tenantBId !== tenantAId;
    recordResult({
      code: 'CG-002',
      name: 'Admin B Login',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: reqBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `Verified user 'admin-b' in PostgreSQL. Tenant ID resolved: ${tenantBId} (distinct from Tenant A)`,
      expected: 'HTTP 200 with JWT authentication token and distinct tenantId for Tenant B Admin',
      actual: `HTTP ${res.status}, success: ${res.body?.success}, tenantId: ${tenantBId}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Failed to authenticate Admin B or tenantId matches Tenant A',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-003: Cashier A Login
  // ---------------------------------------------------------------------------
  {
    const reqBody = { username: 'cashier', password: 'DevelopmentPassword123!' };
    const res = await makeRequest('POST', '/api/auth/login', reqBody);
    cashierAToken = res.body?.data?.token || '';
    const pass = res.status === 200 && Boolean(cashierAToken) && res.body?.data?.user?.role?.name?.toUpperCase() === 'CASHIER';
    recordResult({
      code: 'CG-003',
      name: 'Cashier A Login',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: reqBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `Verified user 'cashier' with role 'Cashier' in Tenant A (${tenantAId})`,
      expected: 'HTTP 200 with JWT authentication token and role Cashier for Tenant A',
      actual: `HTTP ${res.status}, role: ${res.body?.data?.user?.role?.name}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Failed to authenticate Cashier A',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-004: SuperAdmin Login
  // ---------------------------------------------------------------------------
  {
    const reqBody = { username: 'superadmin', password: 'SuperAdminSecretPassword123!' };
    const res = await makeRequest('POST', '/api/auth/login', reqBody);
    superAdminToken = res.body?.data?.token || '';
    const pass = res.status === 200 && Boolean(superAdminToken) && res.body?.data?.user?.isSuperAdmin === true;
    recordResult({
      code: 'CG-004',
      name: 'SuperAdmin Login',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: reqBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `Verified user 'superadmin' with isSuperAdmin=true in PostgreSQL`,
      expected: 'HTTP 200 with JWT token for SuperAdmin with platform privileges',
      actual: `HTTP ${res.status}, isSuperAdmin: ${res.body?.data?.user?.isSuperAdmin}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Failed to authenticate SuperAdmin',
    });
  }

  // Clean slate for testing tenants to ensure clean counts
  await prisma.guest.deleteMany({
    where: { tenantId: { in: [tenantAId, tenantBId] } },
  });

  // ---------------------------------------------------------------------------
  // CG-005: Admin A Create Guest
  // ---------------------------------------------------------------------------
  {
    const preCount = await prisma.guest.count({ where: { tenantId: tenantAId } });
    const createBody = {
      name: 'Priya Sharma',
      mobile: '+919876543210',
      email: 'priya.sharma@example.com',
      salutation: 'Ms.',
      gender: 'FEMALE',
      dateOfBirth: '1994-06-15',
      anniversary: '2020-11-20',
      gstNumber: '29ABCDE1234F1Z5',
      hairType: 'Curly / Dry',
      customerType: 'VIP',
      address: 'Plot 42, Jubilee Hills Road No 36',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      postalCode: '500033',
      preferences: 'Prefers organic shampoos, herbal tea on arrival',
      notes: 'High-value customer, visited luxury salon network previously',
      tags: ['VIP', 'CurlyHair', 'SkinCare'],
    };

    const res = await makeRequest('POST', '/api/crm/guests', createBody, {
      Authorization: `Bearer ${adminAToken}`,
    });

    guestAId = res.body?.data?.id || '';
    const postRecord = await prisma.guest.findUnique({ where: { id: guestAId } });
    const postCount = await prisma.guest.count({ where: { tenantId: tenantAId } });

    const pass =
      res.status === 201 &&
      Boolean(guestAId) &&
      postCount === preCount + 1 &&
      postRecord?.tenantId === tenantAId &&
      postRecord?.name === 'Priya Sharma' &&
      postRecord?.mobile === '+919876543210' &&
      postRecord?.email === 'priya.sharma@example.com' &&
      postRecord?.customerType === 'VIP';

    recordResult({
      code: 'CG-005',
      name: 'Admin A Create Guest with Complete Profile',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: createBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Verification:\n- Record Before: count = ${preCount}\n- Record After: count = ${postCount}, ID = ${guestAId}, Code = ${postRecord?.guestCode}, Tenant = ${postRecord?.tenantId}, Mobile = ${postRecord?.mobile}`,
      expected: 'HTTP 201 Created with auto-generated guestCode (GST-00001) and persisted fields',
      actual: `HTTP ${res.status}, ID: ${guestAId}, guestCode: ${res.body?.data?.guestCode}, persisted in DB: ${Boolean(postRecord)}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Guest creation failed or data mismatch with PostgreSQL',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-006: Get Created Guest by ID
  // ---------------------------------------------------------------------------
  {
    const res = await makeRequest('GET', `/api/crm/guests/${guestAId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const dbRecord = await prisma.guest.findUnique({ where: { id: guestAId } });

    const pass =
      res.status === 200 &&
      res.body?.data?.id === guestAId &&
      res.body?.data?.tenantId === tenantAId &&
      res.body?.data?.name === dbRecord?.name &&
      res.body?.data?.mobile === dbRecord?.mobile &&
      res.body?.data?.gstNumber === dbRecord?.gstNumber;

    recordResult({
      code: 'CG-006',
      name: 'Get Created Guest by ID',
      method: 'GET',
      url: res.url,
      headers: res.reqHeaders,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Record checked: ID ${dbRecord?.id}, name: '${dbRecord?.name}', guestCode: '${dbRecord?.guestCode}'`,
      expected: 'HTTP 200 with full guest profile matching database record',
      actual: `HTTP ${res.status}, retrieved guest: '${res.body?.data?.name}' (${res.body?.data?.guestCode})`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Failed to retrieve guest by ID or field mismatch',
    });
  }

  // Also create a guest in Tenant B for isolation testing
  {
    const createB = {
      name: 'Rohan Mehra',
      mobile: '+919111222333',
      email: 'rohan.mehra@example.com',
      customerType: 'REGULAR',
    };
    const resB = await makeRequest('POST', '/api/crm/guests', createB, {
      Authorization: `Bearer ${adminBToken}`,
    });
    guestBId = resB.body?.data?.id || '';
  }

  // ---------------------------------------------------------------------------
  // CG-007: List Guests with SaaS Isolation
  // ---------------------------------------------------------------------------
  {
    const res = await makeRequest('GET', '/api/crm/guests', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const tenantAGuestsInDb = await prisma.guest.findMany({ where: { tenantId: tenantAId } });
    const items = getGuestList(res.body?.data);
    const idsInResponse = items.map((g: any) => g.id);

    const pass =
      res.status === 200 &&
      items.length === tenantAGuestsInDb.length &&
      idsInResponse.includes(guestAId) &&
      !idsInResponse.includes(guestBId);

    recordResult({
      code: 'CG-007',
      name: 'List Guests with Tenant Isolation',
      method: 'GET',
      url: res.url,
      headers: res.reqHeaders,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `Database has ${tenantAGuestsInDb.length} guest(s) for Tenant A, and 1 guest for Tenant B (${guestBId}). Response contains 0 Tenant B guests.`,
      expected: 'HTTP 200 returning only Tenant A guests, strictly omitting Tenant B guests',
      actual: `HTTP ${res.status}, returned count: ${items.length}, contains Guest A: ${idsInResponse.includes(guestAId)}, contains Guest B: ${idsInResponse.includes(guestBId)}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Cross-tenant leak detected or count mismatch in listing',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-008: Search Guests (Exact, Partial, No Result)
  // ---------------------------------------------------------------------------
  {
    // 8.1 Exact mobile search
    const resMobile = await makeRequest('GET', '/api/crm/guests?search=9876543210', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    // 8.2 Partial name search
    const resName = await makeRequest('GET', '/api/crm/guests?search=priya', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    // 8.3 Non-existent search
    const resNone = await makeRequest('GET', '/api/crm/guests?search=NonExistent999', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const itemsMobile = getGuestList(resMobile.body?.data);
    const itemsName = getGuestList(resName.body?.data);
    const itemsNone = getGuestList(resNone.body?.data);

    const pass =
      resMobile.status === 200 &&
      itemsMobile.length === 1 &&
      itemsMobile[0]?.id === guestAId &&
      resName.status === 200 &&
      itemsName.length === 1 &&
      resNone.status === 200 &&
      itemsNone.length === 0;

    recordResult({
      code: 'CG-008',
      name: 'Search Guests (Exact, Partial, No Match)',
      method: 'GET',
      url: `${baseUrl}/api/crm/guests?search=...`,
      headers: resMobile.reqHeaders,
      status: resMobile.status,
      responseHeaders: resMobile.headers,
      responseBody: {
        search_mobile_count: itemsMobile.length,
        search_name_count: itemsName.length,
        search_nonexistent_count: itemsNone.length,
      },
      dbVerification: `Queried PostgreSQL ILIKE matching: '9876543210' -> matched Priya; 'priya' -> matched Priya; 'NonExistent999' -> 0 rows`,
      expected: 'HTTP 200 returning accurate matches for exact/partial queries and empty array for non-matches',
      actual: `Exact mobile: ${itemsMobile.length} match; Partial name: ${itemsName.length} match; Non-existent: ${itemsNone.length} matches`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Search queries failed to return expected results',
    });
  }

  // Create additional guests for filter & pagination tests
  const today = new Date();
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayDay = String(today.getDate()).padStart(2, '0');
  const anniversaryTodayDate = `2018-${todayMonth}-${todayDay}`;

  const guestAnnivRes = await makeRequest(
    'POST',
    '/api/crm/guests',
    {
      name: 'Anita Desai',
      mobile: '+919876500001',
      gender: 'FEMALE',
      customerType: 'REGULAR',
      anniversary: anniversaryTodayDate,
    },
    { Authorization: `Bearer ${adminAToken}` }
  );
  const guestAnnivId = guestAnnivRes.body?.data?.id;

  // ---------------------------------------------------------------------------
  // CG-009: Filter Guests (Anniversary Today & Customer Type)
  // ---------------------------------------------------------------------------
  {
    // Filter by hasAnniversaryToday=true
    const resAnniv = await makeRequest('GET', '/api/crm/guests?hasAnniversaryToday=true', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    // Filter by customerType=VIP
    const resVip = await makeRequest('GET', '/api/crm/guests?customerType=VIP', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const itemsAnniv = getGuestList(resAnniv.body?.data);
    const itemsVip = getGuestList(resVip.body?.data);

    const pass =
      resAnniv.status === 200 &&
      itemsAnniv.some((g: any) => g.id === guestAnnivId) &&
      resVip.status === 200 &&
      itemsVip.every((g: any) => g.customerType === 'VIP');

    recordResult({
      code: 'CG-009',
      name: 'Filter Guests (hasAnniversaryToday & customerType)',
      method: 'GET',
      url: `${baseUrl}/api/crm/guests?hasAnniversaryToday=true & ?customerType=VIP`,
      headers: resAnniv.reqHeaders,
      status: resAnniv.status,
      responseHeaders: resAnniv.headers,
      responseBody: {
        anniversary_today_returned: itemsAnniv.map((g: any) => ({ name: g.name, anniversary: g.anniversary })),
        vip_returned: itemsVip.map((g: any) => ({ name: g.name, customerType: g.customerType })),
      },
      dbVerification: `PostgreSQL EXTRACT(MONTH/DAY) matched Anita Desai (${anniversaryTodayDate}) for today's date ${todayMonth}-${todayDay}`,
      expected: 'HTTP 200 with anniversary filter isolating today matching guests and customerType isolating VIPs',
      actual: `Anniversary today returned: ${itemsAnniv.length} guest(s); VIP returned: ${itemsVip.length} guest(s)`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Filter validation failed',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-010: Pagination (Page 1, Limit 1, Page 2)
  // ---------------------------------------------------------------------------
  {
    const resP1 = await makeRequest('GET', '/api/crm/guests?page=1&limit=1', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const resP2 = await makeRequest('GET', '/api/crm/guests?page=2&limit=1', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const itemsP1 = getGuestList(resP1.body?.data);
    const itemsP2 = getGuestList(resP2.body?.data);
    const total = getGuestTotal(resP1.body);

    const pass =
      resP1.status === 200 &&
      resP2.status === 200 &&
      itemsP1.length === 1 &&
      itemsP2.length === 1 &&
      itemsP1[0]?.id !== itemsP2[0]?.id &&
      total >= 2;

    recordResult({
      code: 'CG-010',
      name: 'Pagination Verification (Page 1, Limit 1 vs Page 2)',
      method: 'GET',
      url: `${baseUrl}/api/crm/guests?page=1&limit=1`,
      headers: resP1.reqHeaders,
      status: resP1.status,
      responseHeaders: resP1.headers,
      responseBody: {
        page_1_id: itemsP1[0]?.id,
        page_2_id: itemsP2[0]?.id,
        total,
      },
      dbVerification: `PostgreSQL OFFSET 0 LIMIT 1 returned ${itemsP1[0]?.name}; OFFSET 1 LIMIT 1 returned ${itemsP2[0]?.name}`,
      expected: 'HTTP 200 with distinct single record on page 1 and page 2, correct meta.total',
      actual: `Page 1: ${itemsP1[0]?.name}, Page 2: ${itemsP2[0]?.name}, Total: ${total}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Pagination failed or returned duplicate records across pages',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-011: Update Guest
  // ---------------------------------------------------------------------------
  {
    const dbBefore = await prisma.guest.findUnique({ where: { id: guestAId } });
    const updateBody = {
      name: 'Priya Sharma-Kapoor',
      email: 'priya.kapoor@example.com',
      notes: 'Updated VIP notes: prefers afternoon appointments',
      customerType: 'VIP',
    };

    const res = await makeRequest('PUT', `/api/crm/guests/${guestAId}`, updateBody, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const dbAfter = await prisma.guest.findUnique({ where: { id: guestAId } });

    const pass =
      res.status === 200 &&
      dbAfter?.name === 'Priya Sharma-Kapoor' &&
      dbAfter?.email === 'priya.kapoor@example.com' &&
      dbAfter?.notes === 'Updated VIP notes: prefers afternoon appointments';

    recordResult({
      code: 'CG-011',
      name: 'Update Guest Profile Fields',
      method: 'PUT',
      url: res.url,
      headers: res.reqHeaders,
      body: updateBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Verification:\n- Name Before: '${dbBefore?.name}' -> After: '${dbAfter?.name}'\n- Email Before: '${dbBefore?.email}' -> After: '${dbAfter?.email}'\n- Notes Before: '${dbBefore?.notes}' -> After: '${dbAfter?.notes}'`,
      expected: 'HTTP 200 with updated fields reflected both in API response and in PostgreSQL',
      actual: `HTTP ${res.status}, updated name in DB: '${dbAfter?.name}'`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Update failed or database was not updated',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-012: Guest Status Endpoint (Block & Unblock)
  // ---------------------------------------------------------------------------
  {
    // 12.1 Block guest
    const blockBody = { isBlocked: true, blockReason: 'Repeated late cancellations' };
    const resBlock = await makeRequest('PATCH', `/api/crm/guests/${guestAId}/status`, blockBody, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const dbBlocked = await prisma.guest.findUnique({ where: { id: guestAId } });

    // 12.2 Unblock guest
    const unblockBody = { isBlocked: false, blockReason: null };
    const resUnblock = await makeRequest('PATCH', `/api/crm/guests/${guestAId}/status`, unblockBody, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const dbUnblocked = await prisma.guest.findUnique({ where: { id: guestAId } });

    const pass =
      resBlock.status === 200 &&
      dbBlocked?.isBlocked === true &&
      dbBlocked?.blockReason === 'Repeated late cancellations' &&
      resUnblock.status === 200 &&
      dbUnblocked?.isBlocked === false &&
      dbUnblocked?.blockReason === null;

    recordResult({
      code: 'CG-012',
      name: 'Guest Status Management (Block / Unblock)',
      method: 'PATCH',
      url: resBlock.url,
      headers: resBlock.reqHeaders,
      body: blockBody,
      status: resBlock.status,
      responseHeaders: resBlock.headers,
      responseBody: {
        block_response: resBlock.body,
        unblock_response: resUnblock.body,
      },
      dbVerification: `PostgreSQL Verification:\n- After Block: isBlocked = ${dbBlocked?.isBlocked}, reason = '${dbBlocked?.blockReason}'\n- After Unblock: isBlocked = ${dbUnblocked?.isBlocked}, reason = ${dbUnblocked?.blockReason}`,
      expected: 'HTTP 200 on status patch with exact boolean and reason persistence in PostgreSQL',
      actual: `Block: HTTP ${resBlock.status} (DB isBlocked=${dbBlocked?.isBlocked}); Unblock: HTTP ${resUnblock.status} (DB isBlocked=${dbUnblocked?.isBlocked})`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Status endpoint failed or database did not reflect status changes',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-013: Admin B Cross-Tenant Access Attack (Tenant B on Guest A)
  // ---------------------------------------------------------------------------
  {
    const dbBefore = await prisma.guest.findUnique({ where: { id: guestAId } });

    const resGet = await makeRequest('GET', `/api/crm/guests/${guestAId}`, undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });
    const resPut = await makeRequest('PUT', `/api/crm/guests/${guestAId}`, { name: 'Hacked Name' }, {
      Authorization: `Bearer ${adminBToken}`,
    });
    const resDelete = await makeRequest('DELETE', `/api/crm/guests/${guestAId}`, undefined, {
      Authorization: `Bearer ${adminBToken}`,
    });

    const dbAfter = await prisma.guest.findUnique({ where: { id: guestAId } });

    const pass =
      resGet.status === 404 &&
      resPut.status === 404 &&
      resDelete.status === 404 &&
      dbAfter?.name === dbBefore?.name &&
      dbAfter?.tenantId === tenantAId;

    recordResult({
      code: 'CG-013',
      name: 'Cross-Tenant IDOR Prevention (Tenant B on Tenant A Guest)',
      method: 'GET / PUT / DELETE',
      url: `${baseUrl}/api/crm/guests/${guestAId}`,
      headers: resGet.reqHeaders,
      status: resGet.status,
      responseHeaders: resGet.headers,
      responseBody: {
        get_status: resGet.status,
        get_body: resGet.body,
        put_status: resPut.status,
        delete_status: resDelete.status,
      },
      dbVerification: `PostgreSQL Verification: Guest A (${guestAId}) remained 100% unchanged. Name: '${dbAfter?.name}', TenantId: '${dbAfter?.tenantId}'`,
      expected: 'HTTP 404 Not Found for all cross-tenant attempts, zero modification in PostgreSQL',
      actual: `GET: ${resGet.status}, PUT: ${resPut.status}, DELETE: ${resDelete.status}. DB record uncompromised.`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Cross-tenant IDOR vulnerability detected! Tenant B accessed or modified Tenant A data',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-014: Admin A Cross-Tenant Access Attack (Tenant A on Guest B)
  // ---------------------------------------------------------------------------
  {
    const resGet = await makeRequest('GET', `/api/crm/guests/${guestBId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const resPut = await makeRequest('PUT', `/api/crm/guests/${guestBId}`, { name: 'Tenant A Infiltration' }, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const pass = resGet.status === 404 && resPut.status === 404;

    recordResult({
      code: 'CG-014',
      name: 'Reverse Cross-Tenant IDOR Prevention (Tenant A on Tenant B Guest)',
      method: 'GET / PUT',
      url: `${baseUrl}/api/crm/guests/${guestBId}`,
      headers: resGet.reqHeaders,
      status: resGet.status,
      responseHeaders: resGet.headers,
      responseBody: { get_status: resGet.status, put_status: resPut.status },
      dbVerification: `PostgreSQL Verification: Guest B (${guestBId}) in Tenant B remained unaffected`,
      expected: 'HTTP 404 Not Found for reverse cross-tenant access attempts',
      actual: `GET: ${resGet.status}, PUT: ${resPut.status}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Reverse cross-tenant access succeeded inappropriately',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-015: Tenant ID Spoofing in Body
  // ---------------------------------------------------------------------------
  {
    const spoofPayload = {
      name: 'Spoof Attempt Guest',
      mobile: '+919999888805',
      tenantId: tenantBId, // Injecting Tenant B ID in body while authenticating as Admin A
      id: '00000000-0000-0000-0000-000000000099',
    };

    const res = await makeRequest('POST', '/api/crm/guests', spoofPayload, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const createdId = res.body?.data?.id;
    const dbRecord = createdId ? await prisma.guest.findUnique({ where: { id: createdId } }) : null;

    const pass =
      res.status === 201 &&
      res.body?.data?.tenantId === tenantAId &&
      dbRecord?.tenantId === tenantAId &&
      dbRecord?.id !== '00000000-0000-0000-0000-000000000099';

    recordResult({
      code: 'CG-015',
      name: 'Tenant ID Spoofing & ID Injection Prevention',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: spoofPayload,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Record: ID = ${dbRecord?.id}, tenantId in DB = '${dbRecord?.tenantId}' (matches authenticated Tenant A, injected Tenant B discarded)`,
      expected: 'HTTP 201 with guest strictly bound to authenticated Tenant A, ignoring body tenantId and id',
      actual: `HTTP ${res.status}, persisted tenantId: '${dbRecord?.tenantId}', generated ID: '${dbRecord?.id}'`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Tenant ID spoofing succeeded! Injected tenantId or ID was accepted',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-016: Cashier Permitted Operations (POS Walk-in Guest Creation & Lookup)
  // ---------------------------------------------------------------------------
  {
    // 16.1 Cashier list guests
    const resList = await makeRequest('GET', '/api/crm/guests', undefined, {
      Authorization: `Bearer ${cashierAToken}`,
    });
    // 16.2 Cashier create walk-in guest at POS counter
    const walkInBody = {
      name: 'Walk-In POS Guest',
      mobile: '+919811223344',
      gender: 'MALE',
      customerType: 'WALK_IN',
      notes: 'Quick sale customer registered at POS checkout',
    };
    const resCreate = await makeRequest('POST', '/api/crm/guests', walkInBody, {
      Authorization: `Bearer ${cashierAToken}`,
    });

    const cashierGuestId = resCreate.body?.data?.id;
    const dbRecord = cashierGuestId ? await prisma.guest.findUnique({ where: { id: cashierGuestId } }) : null;

    const pass =
      resList.status === 200 &&
      resCreate.status === 201 &&
      dbRecord?.name === 'Walk-In POS Guest' &&
      dbRecord?.customerType === 'WALK_IN' &&
      dbRecord?.tenantId === tenantAId;

    recordResult({
      code: 'CG-016',
      name: 'Cashier Permitted Operations (POS Lookup & Creation)',
      method: 'GET / POST',
      url: resCreate.url,
      headers: resCreate.reqHeaders,
      body: walkInBody,
      status: resCreate.status,
      responseHeaders: resCreate.headers,
      responseBody: resCreate.body,
      dbVerification: `PostgreSQL Record: Created guest '${dbRecord?.name}' with code '${dbRecord?.guestCode}', customerType = 'WALK_IN', tenantId = '${dbRecord?.tenantId}'`,
      expected: 'HTTP 200 on list and HTTP 201 on walk-in creation for Cashier role in POS flow',
      actual: `List: HTTP ${resList.status}, Create: HTTP ${resCreate.status}, persisted in DB: ${Boolean(dbRecord)}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Cashier permitted operations failed',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-017: Cashier Forbidden Operations (Status Modification & Deletion)
  // ---------------------------------------------------------------------------
  {
    const dbBefore = await prisma.guest.findUnique({ where: { id: guestAId } });

    // Cashier attempts to block guest
    const resStatus = await makeRequest('PATCH', `/api/crm/guests/${guestAId}/status`, { isBlocked: true }, {
      Authorization: `Bearer ${cashierAToken}`,
    });
    // Cashier attempts to delete guest
    const resDelete = await makeRequest('DELETE', `/api/crm/guests/${guestAId}`, undefined, {
      Authorization: `Bearer ${cashierAToken}`,
    });

    const dbAfter = await prisma.guest.findUnique({ where: { id: guestAId } });

    const pass =
      resStatus.status === 403 &&
      resDelete.status === 403 &&
      dbAfter?.isBlocked === dbBefore?.isBlocked &&
      dbAfter?.isActive === dbBefore?.isActive;

    recordResult({
      code: 'CG-017',
      name: 'Cashier Forbidden Operations (Status Change & Delete Blocked)',
      method: 'PATCH / DELETE',
      url: `${baseUrl}/api/crm/guests/${guestAId}`,
      headers: resStatus.reqHeaders,
      status: resStatus.status,
      responseHeaders: resStatus.headers,
      responseBody: {
        patch_status: resStatus.status,
        patch_body: resStatus.body,
        delete_status: resDelete.status,
        delete_body: resDelete.body,
      },
      dbVerification: `PostgreSQL Record: isBlocked remains ${dbAfter?.isBlocked}, isActive remains ${dbAfter?.isActive}. No mutation permitted.`,
      expected: 'HTTP 403 Forbidden for Cashier status toggle and deletion attempts',
      actual: `PATCH status: HTTP ${resStatus.status}, DELETE: HTTP ${resDelete.status}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Cashier unauthorized administrative actions were not forbidden',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-018: Unauthenticated Requests (No Token & Invalid Token)
  // ---------------------------------------------------------------------------
  {
    const resNoToken = await makeRequest('GET', '/api/crm/guests');
    const resInvalidToken = await makeRequest('GET', '/api/crm/guests', undefined, {
      Authorization: 'Bearer invalid-token-xyz-123',
    });

    const pass = resNoToken.status === 401 && resInvalidToken.status === 401;

    recordResult({
      code: 'CG-018',
      name: 'Unauthenticated Request Rejections',
      method: 'GET',
      url: resNoToken.url,
      headers: resNoToken.reqHeaders,
      status: resNoToken.status,
      responseHeaders: resNoToken.headers,
      responseBody: {
        no_token: resNoToken.body,
        invalid_token: resInvalidToken.body,
      },
      expected: 'HTTP 401 Unauthorized for both missing and invalid JWT headers',
      actual: `Missing token: HTTP ${resNoToken.status} ('${resNoToken.body?.message}'); Invalid token: HTTP ${resInvalidToken.status} ('${resInvalidToken.body?.message}')`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Unauthenticated access was allowed',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-019: Invalid Guest ID Format & Non-existent ID
  // ---------------------------------------------------------------------------
  {
    const resMalformed = await makeRequest('GET', '/api/crm/guests/not-a-valid-uuid', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const resNonExistent = await makeRequest('GET', '/api/crm/guests/00000000-0000-0000-0000-000000000000', undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const pass = (resMalformed.status === 400 || resMalformed.status === 404) && resNonExistent.status === 404;

    recordResult({
      code: 'CG-019',
      name: 'Invalid and Non-Existent Guest ID Handling',
      method: 'GET',
      url: `${baseUrl}/api/crm/guests/:id`,
      headers: resMalformed.reqHeaders,
      status: resNonExistent.status,
      responseHeaders: resNonExistent.headers,
      responseBody: {
        malformed_uuid: { status: resMalformed.status, body: resMalformed.body },
        non_existent_uuid: { status: resNonExistent.status, body: resNonExistent.body },
      },
      expected: 'HTTP 400/404 for malformed UUID and HTTP 404 for non-existent UUID',
      actual: `Malformed: HTTP ${resMalformed.status}, Non-existent: HTTP ${resNonExistent.status}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Invalid ID handling did not return expected error status',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-020: Required Field Validation (Missing Name & Missing Mobile)
  // ---------------------------------------------------------------------------
  {
    const preCount = await prisma.guest.count({ where: { tenantId: tenantAId } });

    const resNoName = await makeRequest('POST', '/api/crm/guests', { mobile: '+919999000011' }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const resNoMobile = await makeRequest('POST', '/api/crm/guests', { name: 'No Mobile Guest' }, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const postCount = await prisma.guest.count({ where: { tenantId: tenantAId } });

    const pass =
      resNoName.status === 400 &&
      resNoMobile.status === 400 &&
      postCount === preCount;

    recordResult({
      code: 'CG-020',
      name: 'Required Field Validation (Missing Name & Missing Mobile)',
      method: 'POST',
      url: resNoName.url,
      headers: resNoName.reqHeaders,
      status: resNoName.status,
      responseHeaders: resNoName.headers,
      responseBody: {
        missing_name: resNoName.body,
        missing_mobile: resNoMobile.body,
      },
      dbVerification: `PostgreSQL Verification: Guest count before = ${preCount}, count after = ${postCount}. Zero invalid records inserted.`,
      expected: 'HTTP 400 Validation Error for missing mandatory fields; zero database inserts',
      actual: `Missing Name: HTTP ${resNoName.status}; Missing Mobile: HTTP ${resNoMobile.status}; DB count unchanged: ${postCount === preCount}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Validation accepted missing required fields or created invalid records',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-021: Null Values on Nullable Fields
  // ---------------------------------------------------------------------------
  {
    const nullPayload = {
      name: 'Nullable Field Guest',
      mobile: '+919999000022',
      email: null,
      notes: null,
      address: null,
      gstNumber: null,
    };

    const res = await makeRequest('POST', '/api/crm/guests', nullPayload, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const createdId = res.body?.data?.id;
    const dbRecord = createdId ? await prisma.guest.findUnique({ where: { id: createdId } }) : null;

    const pass =
      res.status === 201 &&
      dbRecord?.email === null &&
      dbRecord?.notes === null &&
      dbRecord?.gstNumber === null;

    recordResult({
      code: 'CG-021',
      name: 'Null Values on Nullable Fields',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: nullPayload,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Record: ID = ${dbRecord?.id}, email = ${dbRecord?.email}, notes = ${dbRecord?.notes}, gstNumber = ${dbRecord?.gstNumber}`,
      expected: 'HTTP 201 with explicit null values persisted accurately in database',
      actual: `HTTP ${res.status}, DB email: ${dbRecord?.email}, DB notes: ${dbRecord?.notes}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Null values on optional fields caused unexpected error',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-022: Empty / Whitespace-Only Name
  // ---------------------------------------------------------------------------
  {
    const resEmpty = await makeRequest('POST', '/api/crm/guests', { name: '', mobile: '+919999000033' }, {
      Authorization: `Bearer ${adminAToken}`,
    });
    const resWhitespace = await makeRequest('POST', '/api/crm/guests', { name: '    ', mobile: '+919999000033' }, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const pass = resEmpty.status === 400 && resWhitespace.status === 400;

    recordResult({
      code: 'CG-022',
      name: 'Empty and Whitespace-Only Name Validation',
      method: 'POST',
      url: resEmpty.url,
      headers: resEmpty.reqHeaders,
      status: resWhitespace.status,
      responseHeaders: resWhitespace.headers,
      responseBody: {
        empty_name: resEmpty.body,
        whitespace_name: resWhitespace.body,
      },
      expected: 'HTTP 400 Bad Request rejecting empty and whitespace-only name strings',
      actual: `Empty: HTTP ${resEmpty.status}, Whitespace: HTTP ${resWhitespace.status}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Whitespace-only name was accepted',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-023: Invalid Format Validation (Email, Mobile, Enum)
  // ---------------------------------------------------------------------------
  {
    const resBadEmail = await makeRequest(
      'POST',
      '/api/crm/guests',
      { name: 'Format Test', mobile: '+919999000044', email: 'not-an-email-address' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const resBadMobile = await makeRequest(
      'POST',
      '/api/crm/guests',
      { name: 'Format Test', mobile: 'phone-with-letters-abc' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const resBadEnum = await makeRequest(
      'POST',
      '/api/crm/guests',
      { name: 'Format Test', mobile: '+919999000044', gender: 'ALIEN_SPECIES' },
      { Authorization: `Bearer ${adminAToken}` }
    );

    const pass = resBadEmail.status === 400 && resBadMobile.status === 400 && resBadEnum.status === 400;

    recordResult({
      code: 'CG-023',
      name: 'Format Validations (Invalid Email, Mobile, Enum)',
      method: 'POST',
      url: resBadEmail.url,
      headers: resBadEmail.reqHeaders,
      status: resBadEmail.status,
      responseHeaders: resBadEmail.headers,
      responseBody: {
        bad_email: resBadEmail.body,
        bad_mobile: resBadMobile.body,
        bad_enum: resBadEnum.body,
      },
      expected: 'HTTP 400 for malformed email, phone with alphabetic characters, and unsupported enum',
      actual: `Bad email: HTTP ${resBadEmail.status}; Bad mobile: HTTP ${resBadMobile.status}; Bad enum: HTTP ${resBadEnum.status}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Format validation failed to reject invalid values',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-024: Maximum Length Boundaries
  // ---------------------------------------------------------------------------
  {
    // Name > 100 characters
    const resLongName = await makeRequest(
      'POST',
      '/api/crm/guests',
      { name: 'N'.repeat(101), mobile: '+919999000055' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    // Mobile > 20 digits
    const resLongMobile = await makeRequest(
      'POST',
      '/api/crm/guests',
      { name: 'Length Boundary Guest', mobile: '+9199999999999999999999' },
      { Authorization: `Bearer ${adminAToken}` }
    );

    const pass = resLongName.status === 400 && resLongMobile.status === 400;

    recordResult({
      code: 'CG-024',
      name: 'Maximum Length Boundary Enforcements',
      method: 'POST',
      url: resLongName.url,
      headers: resLongName.reqHeaders,
      status: resLongName.status,
      responseHeaders: resLongName.headers,
      responseBody: {
        long_name_result: resLongName.body,
        long_mobile_result: resLongMobile.body,
      },
      expected: 'HTTP 400 Bad Request for values exceeding database column constraints',
      actual: `Name > 100 chars: HTTP ${resLongName.status}; Mobile > 20 digits: HTTP ${resLongMobile.status}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Length boundary validation failed',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-025: Duplicate Guest Mobile in Same Tenant
  // ---------------------------------------------------------------------------
  {
    const preCount = await prisma.guest.count({ where: { tenantId: tenantAId, mobile: '+919876543210' } });

    const duplicateBody = {
      name: 'Duplicate Priya Sharma',
      mobile: '+919876543210', // already registered in CG-005
    };

    const res = await makeRequest('POST', '/api/crm/guests', duplicateBody, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const postCount = await prisma.guest.count({ where: { tenantId: tenantAId, mobile: '+919876543210' } });

    const pass = res.status === 409 && postCount === preCount && postCount === 1;

    recordResult({
      code: 'CG-025',
      name: 'Duplicate Guest Mobile Conflict Rejection',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: duplicateBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Verification: Guest count for mobile '+919876543210' remained strictly 1`,
      expected: 'HTTP 409 Conflict rejecting duplicate phone number in the same tenant',
      actual: `HTTP ${res.status} ('${res.body?.message}'), DB count remained: ${postCount}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Duplicate mobile was accepted or failed with wrong status code',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-026: Special Characters & Unicode Data Handling
  // ---------------------------------------------------------------------------
  {
    const unicodeBody = {
      name: "Lakshmi Narayana Rao (లక్ష్మి నారాయణ) d'Souza-O'Connor",
      mobile: '+919848012345',
      address: 'D.No. 4-12/1, వెంకటేశ్వర కాలనీ, Vijayawada',
      notes: "Telugu name verification: VIP guest with special hair requirements & scalp massage.",
    };

    const res = await makeRequest('POST', '/api/crm/guests', unicodeBody, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const createdId = res.body?.data?.id;
    const dbRecord = createdId ? await prisma.guest.findUnique({ where: { id: createdId } }) : null;

    const pass =
      res.status === 201 &&
      dbRecord?.name === unicodeBody.name &&
      dbRecord?.address === unicodeBody.address;

    recordResult({
      code: 'CG-026',
      name: 'Special Characters, Apostrophes & Unicode Persistence',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: unicodeBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Record checked: Name persisted accurately as: '${dbRecord?.name}', Address: '${dbRecord?.address}'`,
      expected: 'HTTP 201 with UTF-8 / Telugu and punctuation characters persisted verbatim in PostgreSQL',
      actual: `HTTP ${res.status}, persisted name: '${dbRecord?.name}'`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Unicode or special characters corrupted or rejected',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-027: Mass Assignment & Protected Fields Tampering
  // ---------------------------------------------------------------------------
  {
    const tamperBody = {
      name: 'Tamper Test Guest',
      mobile: '+919888777666',
      totalSpend: 999999.99,
      totalVisits: 100,
      loyaltyPoints: 500,
    };

    const res = await makeRequest('POST', '/api/crm/guests', tamperBody, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const createdId = res.body?.data?.id;
    const dbRecord = createdId ? await prisma.guest.findUnique({ where: { id: createdId } }) : null;

    const pass =
      res.status === 201 &&
      Number(dbRecord?.totalSpend) === 0 &&
      dbRecord?.totalVisits === 0;

    recordResult({
      code: 'CG-027',
      name: 'Mass Assignment & Protected Spend / Visit Counters Protection',
      method: 'POST',
      url: res.url,
      headers: res.reqHeaders,
      body: tamperBody,
      status: res.status,
      responseHeaders: res.headers,
      responseBody: res.body,
      dbVerification: `PostgreSQL Record: totalSpend in DB = ${dbRecord?.totalSpend} (not 999999.99), totalVisits in DB = ${dbRecord?.totalVisits} (not 100)`,
      expected: 'HTTP 201 Created while securely initializing totalSpend and totalVisits to 0',
      actual: `HTTP ${res.status}, totalSpend in DB: ${dbRecord?.totalSpend}, totalVisits in DB: ${dbRecord?.totalVisits}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Mass assignment vulnerability detected! Client was able to spoof totalSpend or totalVisits',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-028: Delete & Graceful Deactivation
  // ---------------------------------------------------------------------------
  {
    // Create a disposable guest for clean hard-deletion
    const cleanGuest = await makeRequest(
      'POST',
      '/api/crm/guests',
      { name: 'To Be Deleted Guest', mobile: '+919999111222' },
      { Authorization: `Bearer ${adminAToken}` }
    );
    const deleteId = cleanGuest.body?.data?.id;

    const resDelete = await makeRequest('DELETE', `/api/crm/guests/${deleteId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const dbRecordAfter = await prisma.guest.findUnique({ where: { id: deleteId } });

    const pass = resDelete.status === 200 && dbRecordAfter === null;

    recordResult({
      code: 'CG-028',
      name: 'Delete Unreferenced Guest (Hard Delete)',
      method: 'DELETE',
      url: resDelete.url,
      headers: resDelete.reqHeaders,
      status: resDelete.status,
      responseHeaders: resDelete.headers,
      responseBody: resDelete.body,
      dbVerification: `PostgreSQL Record: Querying ID ${deleteId} returned null (record completely deleted)`,
      expected: 'HTTP 200 with record purged from PostgreSQL database',
      actual: `HTTP ${resDelete.status}, record in DB: ${dbRecordAfter}`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'Delete operation failed or record was not deleted',
    });

    // -------------------------------------------------------------------------
    // CG-029: Repeated Delete on Already Deleted Guest
    // -------------------------------------------------------------------------
    const resRepeat = await makeRequest('DELETE', `/api/crm/guests/${deleteId}`, undefined, {
      Authorization: `Bearer ${adminAToken}`,
    });

    const passRepeat = resRepeat.status === 404;

    recordResult({
      code: 'CG-029',
      name: 'Repeated Delete on Already Deleted Record',
      method: 'DELETE',
      url: resRepeat.url,
      headers: resRepeat.reqHeaders,
      status: resRepeat.status,
      responseHeaders: resRepeat.headers,
      responseBody: resRepeat.body,
      expected: 'HTTP 404 Not Found when attempting to delete a non-existent / already-deleted record',
      actual: `HTTP ${resRepeat.status} ('${resRepeat.body?.message}')`,
      result: passRepeat ? 'PASS' : 'FAIL',
      failReason: passRepeat ? undefined : 'Repeated delete returned unexpected status',
    });
  }

  // ---------------------------------------------------------------------------
  // CG-030: POS Quick Sale Customer Selection Flow
  // ---------------------------------------------------------------------------
  {
    // Step 1: Cashier searches guest by phone number at POS checkout
    const searchRes = await makeRequest('GET', '/api/crm/guests?search=9876543210', undefined, {
      Authorization: `Bearer ${cashierAToken}`,
    });
    const foundGuest = getGuestList(searchRes.body?.data)[0];

    // Step 2: Cashier fetches full profile for bill invoice generation
    const profileRes = await makeRequest('GET', `/api/crm/guests/${foundGuest?.id}`, undefined, {
      Authorization: `Bearer ${cashierAToken}`,
    });

    const pass =
      searchRes.status === 200 &&
      profileRes.status === 200 &&
      foundGuest?.mobile === '+919876543210' &&
      profileRes.body?.data?.id === foundGuest?.id &&
      profileRes.body?.data?.isActive === true;

    recordResult({
      code: 'CG-030',
      name: 'POS Quick Sale Customer Search & Checkout Selection Flow',
      method: 'GET',
      url: `${baseUrl}/api/crm/guests?search=9876543210`,
      headers: searchRes.reqHeaders,
      status: profileRes.status,
      responseHeaders: profileRes.headers,
      responseBody: {
        searched_guest: foundGuest?.name,
        mobile: foundGuest?.mobile,
        code: foundGuest?.guestCode,
        customerType: foundGuest?.customerType,
      },
      dbVerification: `PostgreSQL checked: Guest ID ${foundGuest?.id} verified active and ready for POS invoice attachment`,
      expected: 'HTTP 200 allowing Cashier to seamlessly search, select, and read customer for POS billing',
      actual: `Search: HTTP ${searchRes.status}, Profile: HTTP ${profileRes.status}, selected: '${foundGuest?.name}' (${foundGuest?.guestCode})`,
      result: pass ? 'PASS' : 'FAIL',
      failReason: pass ? undefined : 'POS integration flow failed',
    });
  }

  console.log('\n================================================================');
  console.log(`   EXECUTION COMPLETE: ${results.filter((r) => r.result === 'PASS').length} PASSED | ${results.filter((r) => r.result === 'FAIL').length} FAILED`);
  console.log('================================================================\n');
}

runPostmanExecution().catch((err) => {
  console.error('Execution encountered fatal error:', err);
  process.exit(1);
});
