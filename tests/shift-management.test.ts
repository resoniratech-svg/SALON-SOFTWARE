import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let cashierToken: string;
let tenantId: string;
let tenantBId: string;
let tenantBAdminToken: string;

let testStaffId: string;
let createdShiftId: string;
let uniformShiftId: string;
let secondaryShiftId: string;

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

export async function runShiftManagementTests() {
  console.log('\n================================================================');
  console.log('   Shift Management Module: Comprehensive End-to-End Test Suite');
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

    // Ensure modules enabled
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { enabledModules: ['SETTINGS', 'STAFF', 'POS', 'REPORTS'] },
    });

    // Login Cashier (Non-admin)
    const loginCashier = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(loginCashier.status === 200, 'Cashier logs in successfully (200)');
    cashierToken = loginCashier.data?.data?.token;

    // Get or create staff for roster testing
    let staff = await prisma.staff.findFirst({ where: { tenantId, isActive: true } });
    if (!staff) {
      staff = await prisma.staff.create({
        data: {
          tenantId,
          name: 'Ananya Verma',
          gender: 'FEMALE',
          designation: 'Hair Stylist',
          category: 'SALON',
          isActive: true,
        },
      });
    }
    testStaffId = staff.id;
    assert(Boolean(testStaffId), 'Staff fixture ready for roster assignment');

    // Clean up any previous test shifts and schedule assignments for idempotency
    await prisma.staffWeeklySchedule.deleteMany({
      where: { staff: { tenantId } },
    });
    await prisma.shift.deleteMany({
      where: {
        tenantId,
        name: { in: ['Morning General Shift', 'Morning General Shift (Updated)', 'Evening Peak Shift', 'Uniform 9-to-6 Shift', 'Unauthorized Shift'] },
      },
    });
    const oldTenantB = await prisma.tenant.findFirst({ where: { code: 'TENANT_B_SHIFT' } });
    if (oldTenantB) {
      await prisma.shift.deleteMany({ where: { tenantId: oldTenantB.id } });
      await prisma.user.deleteMany({ where: { tenantId: oldTenantB.id } });
      await prisma.tenant.delete({ where: { id: oldTenantB.id } });
    }

    // -------------------------------------------------------------
    // 1. Shift Master Creation & Validation (Frames 015-022)
    // -------------------------------------------------------------
    console.log('\n--- 1. Shift Master Creation & Validation ---');

    // 1.1 Create Shift with day-wise timings and breaks
    const createRes = await request(
      'POST',
      '/api/settings/shifts',
      {
        name: 'Morning General Shift',
        isActive: true,
        startTime: '08:00 AM',
        endTime: '04:30 PM',
        timings: [
          { day: 'SUN', dayOfWeek: 0, startTime: '08:00 AM', endTime: '04:30 PM', isOff: false },
          { day: 'MON', dayOfWeek: 1, startTime: '08:00 AM', endTime: '04:30 PM', isOff: false },
          { day: 'TUE', dayOfWeek: 2, startTime: '08:00 AM', endTime: '04:30 PM', isOff: false },
          { day: 'WED', dayOfWeek: 3, startTime: '08:00 AM', endTime: '04:30 PM', isOff: false },
          { day: 'THU', dayOfWeek: 4, startTime: '08:00 AM', endTime: '04:30 PM', isOff: false },
          { day: 'FRI', dayOfWeek: 5, startTime: '08:00 AM', endTime: '04:30 PM', isOff: false },
          { day: 'SAT', dayOfWeek: 6, startTime: '09:00 AM', endTime: '03:00 PM', isOff: false },
        ],
        breaks: [
          { name: 'Lunch Break', from: '01:00 PM', to: '02:00 PM', isActive: true },
          { name: 'Tea Break', from: '04:00 PM', to: '04:15 PM', isActive: true },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(createRes.status === 201, 'POST /api/settings/shifts creates full shift schedule (201)');
    createdShiftId = createRes.data?.data?.id;
    assert(createRes.data?.data?.name === 'Morning General Shift', 'Shift name stored correctly');
    assert(createRes.data?.data?.isActive === true, 'Shift isActive defaults to true');
    assert(Array.isArray(createRes.data?.data?.timings) && createRes.data?.data?.timings.length === 7, 'Shift has 7 day timings (SUN-SAT)');
    assert(Array.isArray(createRes.data?.data?.breaks) && createRes.data?.data?.breaks.length === 2, 'Shift has 2 breaks configured');

    // 1.2 Create Shift using UI Aliases (shiftName, active, shiftTiming, shiftBreaks)
    const aliasRes = await request(
      'POST',
      '/api/settings/shifts',
      {
        shiftName: 'Evening Peak Shift',
        active: true,
        startTime: '01:00 PM',
        endTime: '09:30 PM',
        shiftTiming: [
          { day: 'SUN', startTime: '01:00 PM', endTime: '09:30 PM', isOff: false },
          { day: 'MON', startTime: '01:00 PM', endTime: '09:30 PM', isOff: false },
          { day: 'TUE', startTime: '01:00 PM', endTime: '09:30 PM', isOff: false },
          { day: 'WED', startTime: '01:00 PM', endTime: '09:30 PM', isOff: false },
          { day: 'THU', startTime: '01:00 PM', endTime: '09:30 PM', isOff: false },
          { day: 'FRI', startTime: '01:00 PM', endTime: '10:00 PM', isOff: false },
          { day: 'SAT', startTime: '01:00 PM', endTime: '10:00 PM', isOff: false },
        ],
        shiftBreaks: [
          { breakName: 'Dinner Break', from: '08:00 PM', to: '08:45 PM', active: true },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(aliasRes.status === 201, 'POST /api/settings/shifts accepts UI aliases (shiftName, shiftTiming, shiftBreaks)');
    secondaryShiftId = aliasRes.data?.data?.id;
    assert(aliasRes.data?.data?.name === 'Evening Peak Shift', 'Alias shiftName mapped to name');
    assert(aliasRes.data?.data?.breaks[0].name === 'Dinner Break', 'Alias breakName mapped to name');

    // 1.3 Create Shift with "All" checkbox uniform timing
    const uniformRes = await request(
      'POST',
      '/api/settings/shifts',
      {
        name: 'Uniform 9-to-6 Shift',
        allDays: true,
        startTime: '09:00 AM',
        endTime: '06:00 PM',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(uniformRes.status === 201, 'POST /api/settings/shifts creates uniform all-days shift (201)');
    uniformShiftId = uniformRes.data?.data?.id;
    assert(uniformRes.data?.data?.timings.length === 7, 'All 7 days automatically populated with uniform timing');
    assert(uniformRes.data?.data?.timings[0].startTime === '09:00 AM', 'Sunday inherits uniform start time');

    // 1.4 Validation: Missing Shift Name
    const emptyNameRes = await request(
      'POST',
      '/api/settings/shifts',
      {
        startTime: '09:00 AM',
        endTime: '05:00 PM',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(emptyNameRes.status === 400, 'POST /api/settings/shifts rejects missing name (400)');

    // 1.5 Validation: Duplicate Shift Name in same tenant
    const duplicateRes = await request(
      'POST',
      '/api/settings/shifts',
      {
        name: 'Morning General Shift',
        startTime: '08:00 AM',
        endTime: '04:30 PM',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(duplicateRes.status === 409, 'POST /api/settings/shifts rejects duplicate shift name in tenant (409 Conflict)');

    // -------------------------------------------------------------
    // 2. Shift Retrieval, Query Filtering, and Inspection
    // -------------------------------------------------------------
    console.log('\n--- 2. Shift Retrieval, Query Filtering, and Inspection ---');

    // 2.1 List all shifts
    const listRes = await request('GET', '/api/settings/shifts', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listRes.status === 200, 'GET /api/settings/shifts retrieves shift list (200)');
    assert(Array.isArray(listRes.data?.data) && listRes.data?.data.length >= 3, 'Shift list contains created shifts');

    // 2.2 Search shifts by name
    const searchRes = await request('GET', '/api/settings/shifts?search=Morning', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchRes.status === 200, 'GET /api/settings/shifts?search=Morning filters shifts (200)');
    assert(
      searchRes.data?.data.every((s: any) => s.name.toLowerCase().includes('morning')),
      'All returned shifts match search criteria'
    );

    // 2.3 Get shift by ID
    const getRes = await request('GET', `/api/settings/shifts/${createdShiftId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getRes.status === 200, 'GET /api/settings/shifts/:id retrieves specific shift (200)');
    assert(getRes.data?.data?.id === createdShiftId, 'Retrieved shift ID matches request');
    assert(getRes.data?.data?.timings[6].day === 'SAT', 'Saturday timing preserved with custom weekend hours');

    // 2.4 Get non-existent shift ID
    const notFoundRes = await request(
      'GET',
      '/api/settings/shifts/00000000-0000-0000-0000-000000000000',
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(notFoundRes.status === 404, 'GET /api/settings/shifts/:id returns 404 for unknown shift');

    // -------------------------------------------------------------
    // 3. Shift Update & Status Toggle
    // -------------------------------------------------------------
    console.log('\n--- 3. Shift Update & Status Toggle ---');

    // 3.1 Update shift timings and details
    const updateRes = await request(
      'PUT',
      `/api/settings/shifts/${createdShiftId}`,
      {
        name: 'Morning General Shift (Updated)',
        startTime: '08:30 AM',
        endTime: '05:00 PM',
        timings: [
          { day: 'SUN', dayOfWeek: 0, startTime: '08:30 AM', endTime: '05:00 PM', isOff: true },
          { day: 'MON', dayOfWeek: 1, startTime: '08:30 AM', endTime: '05:00 PM', isOff: false },
          { day: 'TUE', dayOfWeek: 2, startTime: '08:30 AM', endTime: '05:00 PM', isOff: false },
          { day: 'WED', dayOfWeek: 3, startTime: '08:30 AM', endTime: '05:00 PM', isOff: false },
          { day: 'THU', dayOfWeek: 4, startTime: '08:30 AM', endTime: '05:00 PM', isOff: false },
          { day: 'FRI', dayOfWeek: 5, startTime: '08:30 AM', endTime: '05:00 PM', isOff: false },
          { day: 'SAT', dayOfWeek: 6, startTime: '09:00 AM', endTime: '02:00 PM', isOff: false },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateRes.status === 200, 'PUT /api/settings/shifts/:id updates shift details (200)');
    assert(updateRes.data?.data?.name === 'Morning General Shift (Updated)', 'Updated shift name persisted');
    assert(updateRes.data?.data?.timings[0].isOff === true, 'Sunday off day preserved in timings');

    // 3.2 Update collision with existing name
    const updateConflict = await request(
      'PUT',
      `/api/settings/shifts/${createdShiftId}`,
      {
        name: 'Evening Peak Shift',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateConflict.status === 409, 'PUT /api/settings/shifts/:id prevents duplicate name collision (409)');

    // 3.3 Toggle active status via dedicated endpoint
    const toggleInactive = await request(
      'PATCH',
      `/api/settings/shifts/${createdShiftId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(toggleInactive.status === 200, 'PATCH /api/settings/shifts/:id/status deactivates shift (200)');
    assert(toggleInactive.data?.data?.isActive === false, 'Shift is marked inactive');

    // Filter by active status
    const filterActive = await request('GET', '/api/settings/shifts?isActive=true', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(
      filterActive.data?.data.every((s: any) => s.isActive === true),
      'GET /api/settings/shifts?isActive=true filters only active shifts'
    );

    // Toggle back to active
    const toggleActive = await request(
      'PATCH',
      `/api/settings/shifts/${createdShiftId}/status`,
      { isActive: true },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(toggleActive.status === 200, 'PATCH /api/settings/shifts/:id/status reactivates shift (200)');
    assert(toggleActive.data?.data?.isActive === true, 'Shift is marked active again');

    // -------------------------------------------------------------
    // 4. Granular Shift Break Management (Frames 020-022)
    // -------------------------------------------------------------
    console.log('\n--- 4. Granular Shift Break Management ---');

    // 4.1 Add new break
    const addBreakRes = await request(
      'POST',
      `/api/settings/shifts/${createdShiftId}/breaks`,
      {
        name: 'Snack Break',
        from: '04:30 PM',
        to: '04:45 PM',
        isActive: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(addBreakRes.status === 200, 'POST /api/settings/shifts/:id/breaks appends break (200)');
    assert(
      addBreakRes.data?.data?.breaks.some((b: any) => b.name === 'Snack Break'),
      'Newly added break appears in shift breaks list'
    );

    // 4.2 Delete a break by index
    const breakCountBefore = addBreakRes.data?.data?.breaks.length;
    const deleteBreakRes = await request(
      'DELETE',
      `/api/settings/shifts/${createdShiftId}/breaks/0`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deleteBreakRes.status === 200, 'DELETE /api/settings/shifts/:id/breaks/:index removes break (200)');
    assert(deleteBreakRes.data?.data?.breaks.length === breakCountBefore - 1, 'Break count decreased by 1');

    // 4.3 Delete invalid break index
    const invalidIndexRes = await request(
      'DELETE',
      `/api/settings/shifts/${createdShiftId}/breaks/99`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(invalidIndexRes.status === 400, 'DELETE with out-of-range break index returns 400');

    // -------------------------------------------------------------
    // 5. Staff Roster & Shift Mapping (Frames 024-036)
    // -------------------------------------------------------------
    console.log('\n--- 5. Staff Roster & Shift Mapping ---');

    // 5.1 Read Roster
    const rosterRes = await request('GET', '/api/settings/roster', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rosterRes.status === 200, 'GET /api/settings/roster retrieves full staff roster (200)');
    assert(Array.isArray(rosterRes.data?.data), 'Roster returns array of staff members');

    // 5.2 Apply Shift to Staff via Bulk Roster Assignment
    const applyShiftRes = await request(
      'POST',
      '/api/settings/roster/apply-shift',
      {
        shiftId: createdShiftId,
        staffIds: [testStaffId],
        daysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(applyShiftRes.status === 200, 'POST /api/settings/roster/apply-shift assigns shift to staff (200)');
    assert(applyShiftRes.data?.data?.updatedStaffCount === 1, 'Staff count updated matches 1');

    // Verify shift assignment in staff roster
    const verifyRosterRes = await request('GET', '/api/settings/roster', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    const staffRoster = verifyRosterRes.data?.data.find((s: any) => s.id === testStaffId);
    assert(Boolean(staffRoster), 'Target staff found in roster');
    const monSchedule = staffRoster?.weeklySchedules.find((ws: any) => ws.dayOfWeek === 1);
    assert(monSchedule?.shift?.id === createdShiftId, 'Monday schedule assigned to createdShiftId');
    assert(monSchedule?.shift?.timings?.length === 7, 'Shift timings populated in roster schedule');

    // 5.3 Attempt to assign inactive shift
    await request(
      'PATCH',
      `/api/settings/shifts/${uniformShiftId}/status`,
      { isActive: false },
      { Authorization: `Bearer ${adminToken}` }
    );
    const inactiveAssignRes = await request(
      'POST',
      '/api/settings/roster/apply-shift',
      {
        shiftId: uniformShiftId,
        staffIds: [testStaffId],
        daysOfWeek: [1, 2],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(inactiveAssignRes.status === 400, 'Assigning inactive shift to staff roster is rejected (400)');

    // 5.4 Update Individual Staff Roster via PUT /api/settings/roster/:staffId
    const updateRosterRes = await request(
      'PUT',
      `/api/settings/roster/${testStaffId}`,
      {
        schedules: [
          { dayOfWeek: 0, isWeeklyOff: true, shiftId: null },
          { dayOfWeek: 1, isWeeklyOff: false, shiftId: createdShiftId },
          { dayOfWeek: 2, isWeeklyOff: false, shiftId: createdShiftId },
          { dayOfWeek: 3, isWeeklyOff: false, shiftId: createdShiftId },
          { dayOfWeek: 4, isWeeklyOff: false, shiftId: createdShiftId },
          { dayOfWeek: 5, isWeeklyOff: false, shiftId: secondaryShiftId },
          { dayOfWeek: 6, isWeeklyOff: false, shiftId: secondaryShiftId },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(updateRosterRes.status === 200, 'PUT /api/settings/roster/:staffId updates full 7-day schedule (200)');
    assert(updateRosterRes.data?.data?.weeklySchedules?.length === 7, 'Staff has 7 daily schedules configured');

    // 5.5 Shift Deletion Protection: Shift currently assigned to staff cannot be deleted
    const protectedDelete = await request(
      'DELETE',
      `/api/settings/shifts/${createdShiftId}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(protectedDelete.status === 409, 'DELETE /api/settings/shifts/:id rejects deletion of shift in active roster use (409 Conflict)');

    // 5.6 Unassign shift from staff and delete shift
    await request(
      'PUT',
      `/api/settings/roster/${testStaffId}`,
      {
        schedules: [
          { dayOfWeek: 0, isWeeklyOff: true, shiftId: null },
          { dayOfWeek: 1, isWeeklyOff: false, shiftId: secondaryShiftId },
          { dayOfWeek: 2, isWeeklyOff: false, shiftId: secondaryShiftId },
          { dayOfWeek: 3, isWeeklyOff: false, shiftId: secondaryShiftId },
          { dayOfWeek: 4, isWeeklyOff: false, shiftId: secondaryShiftId },
          { dayOfWeek: 5, isWeeklyOff: false, shiftId: secondaryShiftId },
          { dayOfWeek: 6, isWeeklyOff: false, shiftId: secondaryShiftId },
        ],
      },
      { Authorization: `Bearer ${adminToken}` }
    );

    const successfulDelete = await request(
      'DELETE',
      `/api/settings/shifts/${createdShiftId}`,
      undefined,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(successfulDelete.status === 200, 'DELETE /api/settings/shifts/:id succeeds once unassigned (200)');

    // -------------------------------------------------------------
    // 6. Multi-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- 6. Multi-Tenant Isolation ---');

    // Create Tenant B
    let tenantB = await prisma.tenant.findFirst({ where: { name: 'Tenant B Salon' } });
    if (!tenantB) {
      tenantB = await prisma.tenant.create({
        data: {
          name: 'Tenant B Salon',
          code: 'TENANT_B_SHIFT',
          enabledModules: ['SETTINGS', 'STAFF'],
        },
      });
    }
    tenantBId = tenantB.id;

    // Create Admin user for Tenant B
    const bUser = await prisma.user.findFirst({
      where: { tenantId: tenantBId, username: 'tenant_b_admin' },
    });
    if (!bUser) {
      const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
      await prisma.user.create({
        data: {
          tenantId: tenantBId,
          username: 'tenant_b_admin',
          email: 'b_admin@saloonerp.test',
          passwordHash: loginAdmin.data?.data?.user ? (await prisma.user.findFirst({ where: { username: 'admin' } }))!.passwordHash : '',
          roleId: adminRole!.id,
          status: 'ACTIVE',
        },
      });
    }

    const loginTenantB = await request('POST', '/api/auth/login', {
      username: 'tenant_b_admin',
      password: 'DevelopmentPassword123!',
    });
    tenantBAdminToken = loginTenantB.data?.data?.token;
    assert(Boolean(tenantBAdminToken), 'Tenant B admin authenticated');

    // Create shift in Tenant B with identical name as Tenant A's shift
    const tenantBShiftRes = await request(
      'POST',
      '/api/settings/shifts',
      {
        name: 'Evening Peak Shift', // Same name as Tenant A
        startTime: '02:00 PM',
        endTime: '10:00 PM',
      },
      { Authorization: `Bearer ${tenantBAdminToken}` }
    );
    assert(tenantBShiftRes.status === 201, 'Identical shift name allowed in distinct tenant (201)');

    // Tenant B cannot access Tenant A's shift
    const crossTenantGet = await request(
      'GET',
      `/api/settings/shifts/${secondaryShiftId}`,
      undefined,
      { Authorization: `Bearer ${tenantBAdminToken}` }
    );
    assert(crossTenantGet.status === 404, 'Cross-tenant GET /api/settings/shifts/:id blocked (404 Not Found)');

    // Tenant B cannot delete Tenant A's shift
    const crossTenantDelete = await request(
      'DELETE',
      `/api/settings/shifts/${secondaryShiftId}`,
      undefined,
      { Authorization: `Bearer ${tenantBAdminToken}` }
    );
    assert(crossTenantDelete.status === 404, 'Cross-tenant DELETE /api/settings/shifts/:id blocked (404 Not Found)');

    // -------------------------------------------------------------
    // 7. Role-Based Access Control (RBAC) & Authorization
    // -------------------------------------------------------------
    console.log('\n--- 7. Role-Based Access Control (RBAC) & Authorization ---');

    // Unauthenticated access
    const unauthRes = await request('GET', '/api/settings/shifts');
    assert(unauthRes.status === 401, 'Unauthenticated GET /api/settings/shifts returns 401');

    // Cashier (non-admin) reading shifts
    const cashierRead = await request('GET', '/api/settings/shifts', undefined, {
      Authorization: `Bearer ${cashierToken}`,
    });
    assert(cashierRead.status === 200, 'Cashier with SETTINGS:READ can list shifts (200)');

    // Cashier attempting to create shift
    const cashierCreate = await request(
      'POST',
      '/api/settings/shifts',
      {
        name: 'Unauthorized Shift',
        startTime: '09:00 AM',
        endTime: '05:00 PM',
      },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierCreate.status === 403, 'Cashier attempting POST /api/settings/shifts is blocked (403 Forbidden)');

    // Cashier attempting to update shift
    const cashierUpdate = await request(
      'PUT',
      `/api/settings/shifts/${secondaryShiftId}`,
      { name: 'Hacked Shift' },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierUpdate.status === 403, 'Cashier attempting PUT /api/settings/shifts/:id is blocked (403 Forbidden)');

    // Cashier attempting to delete shift
    const cashierDelete = await request(
      'DELETE',
      `/api/settings/shifts/${secondaryShiftId}`,
      undefined,
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierDelete.status === 403, 'Cashier attempting DELETE /api/settings/shifts/:id is blocked (403 Forbidden)');

    // Cashier attempting to modify staff roster
    const cashierRoster = await request(
      'PUT',
      `/api/settings/roster/${testStaffId}`,
      { schedules: [{ dayOfWeek: 0, isWeeklyOff: true }] },
      { Authorization: `Bearer ${cashierToken}` }
    );
    assert(cashierRoster.status === 403, 'Cashier attempting PUT /api/settings/roster/:id is blocked (403 Forbidden)');

    // -------------------------------------------------------------
    // 8. Staff Module Meta Shift Integration
    // -------------------------------------------------------------
    console.log('\n--- 8. Staff Module Meta Shift Integration ---');

    const metaShiftsRes = await request('GET', '/api/staff/meta/shifts', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(metaShiftsRes.status === 200, 'GET /api/staff/meta/shifts retrieves shift list for staff forms (200)');
    assert(Array.isArray(metaShiftsRes.data?.data), 'Staff meta shifts returns array');
    const eveningShift = metaShiftsRes.data?.data.find((s: any) => s.id === secondaryShiftId);
    assert(Boolean(eveningShift), 'Evening Peak Shift present in staff meta');
    assert(Array.isArray(eveningShift?.timings), 'Shift timings array returned in staff meta');
    assert(Array.isArray(eveningShift?.breaks), 'Shift breaks array returned in staff meta');

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   Shift Management Test Results: Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('shift-management.test.ts')) {
  runShiftManagementTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
