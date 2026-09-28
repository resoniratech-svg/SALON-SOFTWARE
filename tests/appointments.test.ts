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

let testGuestA: any;
let testServiceA1: any;
let testServiceA2: any;
let testStaffA1: any;
let testStaffA2: any;
let testResourceA1: any;
let testResourceA2: any;

let createdAppointmentId: string;
let createdAppointmentNumber: string;

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

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    data = await response.text();
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

export async function runAppointmentTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Appointments & Scheduling (Calendar) Test Suite');
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
    // 1.2 Seed Fixtures for Appointments
    // -------------------------------------------------------------
    console.log('\n--- Seed Test Fixtures (Services, Staff, Resources, Guests) ---');

    // Clean up previous appointments for Tenant A
    await prisma.appointmentItem.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.appointment.deleteMany({ where: { tenantId: tenantAId } });

    // Seed Guest for Tenant A
    testGuestA = await prisma.guest.findFirst({ where: { tenantId: tenantAId } });
    if (!testGuestA) {
      testGuestA = await prisma.guest.create({
        data: {
          tenantId: tenantAId,
          name: 'Prakash Sharma',
          mobile: '9876543210',
          email: 'prakash@example.com',
          customerType: 'REGULAR',
        },
      });
    }

    // Seed Service Category & Services
    let categoryA = await prisma.serviceCategory.findFirst({ where: { tenantId: tenantAId } });
    if (!categoryA) {
      categoryA = await prisma.serviceCategory.create({
        data: { tenantId: tenantAId, name: 'Hair Services' },
      });
    }

    testServiceA1 = await prisma.service.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA.id,
        name: `Hair Cut (With Shampoo) ${Date.now()}`,
        price: 400.0,
        salePrice: 400.0,
        durationMinutes: 30,
      },
    });

    testServiceA2 = await prisma.service.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA.id,
        name: `Beard Styling ${Date.now()}`,
        price: 200.0,
        salePrice: 200.0,
        durationMinutes: 20,
      },
    });

    // Seed Staff
    testStaffA1 = await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: `Piyush Sharma ${Date.now()}`,
        isActive: true,
      },
    });

    testStaffA2 = await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: `Sakshi Verma ${Date.now()}`,
        isActive: true,
      },
    });

    // Staff Appointment Settings (Sakshi unavailable)
    await prisma.staffAppointmentSetting.create({
      data: {
        staffId: testStaffA1.id,
        enableAppointments: true,
      },
    });

    await prisma.staffAppointmentSetting.create({
      data: {
        staffId: testStaffA2.id,
        enableAppointments: false,
      },
    });

    // Seed Resources
    testResourceA1 = await prisma.resource.create({
      data: {
        tenantId: tenantAId,
        name: `Room 1 ${Date.now()}`,
        capacity: 1,
        isActive: true,
      },
    });

    testResourceA2 = await prisma.resource.create({
      data: {
        tenantId: tenantAId,
        name: `Room 2 ${Date.now()}`,
        capacity: 1,
        isActive: true,
      },
    });

    assert(true, 'Test fixtures created successfully');

    // -------------------------------------------------------------
    // 2. Authorization & RBAC
    // -------------------------------------------------------------
    console.log('\n--- 2. Authorization & RBAC ---');

    const noAuth = await request('GET', '/api/appointments/calendar');
    assert(noAuth.status === 401, 'Unauthenticated request to calendar returns 401');

    const invalidAuth = await request('GET', '/api/appointments/calendar', undefined, 'invalid.jwt.token');
    assert(invalidAuth.status === 401, 'Invalid JWT token returns 401');

    // -------------------------------------------------------------
    // 3. Calendar View & Grid Retrieval
    // -------------------------------------------------------------
    console.log('\n--- 3. Calendar View & Grid ---');

    const calendarStaff = await request('GET', '/api/appointments/calendar', undefined, adminAToken, {
      date: '2026-08-26',
      view: 'staff',
    });

    assert(calendarStaff.status === 200, 'GET /api/appointments/calendar (view=staff) returns 200');
    assert(calendarStaff.data.data.date === '2026-08-26', 'Calendar date is 2026-08-26');
    assert(Array.isArray(calendarStaff.data.data.timeSlots), 'Time slots array returned');
    assert(calendarStaff.data.data.timeSlots.includes('08:00 AM'), 'Time slots include 08:00 AM');
    assert(calendarStaff.data.data.timeSlots.includes('11:30 PM'), 'Time slots include 11:30 PM');
    assert(Array.isArray(calendarStaff.data.data.columns), 'Columns array returned for staff');

    // Verify Sakshi is flagged as "Staff Unavailable"
    const sakshiCol = calendarStaff.data.data.columns.find((c: any) => c.id === testStaffA2.id);
    assert(sakshiCol && sakshiCol.statusText === 'Staff Unavailable', 'Sakshi is flagged as "Staff Unavailable"');

    // Resource View
    const calendarResource = await request('GET', '/api/appointments/calendar', undefined, adminAToken, {
      date: '2026-08-26',
      view: 'resource',
    });
    assert(calendarResource.status === 200, 'GET /api/appointments/calendar (view=resource) returns 200');
    assert(calendarResource.data.data.view === 'resource', 'View is resource');
    const room1Col = calendarResource.data.data.columns.find((c: any) => c.id === testResourceA1.id);
    assert(room1Col && room1Col.capacity === 1, 'Resource Room 1 present in resource view');

    // Status metrics
    assert(calendarStaff.data.data.statusCounts.total === 0, 'Initial status total count is 0');

    // -------------------------------------------------------------
    // 4. Appointment Creation
    // -------------------------------------------------------------
    console.log('\n--- 4. Appointment Creation ---');

    // 4.1 Create appointment with existing guest and multi-service items
    const createRes = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-08-26',
        status: 'CONFIRMED',
        bookingSource: 'WALK_IN',
        instruction: 'Guest prefers low temperature blow dryer',
        confirmationSms: true,
        smsToOwner: true,
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            resourceId: testResourceA1.id,
            startTime: '19:15',
            endTime: '19:45',
            price: 400.0,
            isRecommendedStaff: true,
          },
          {
            serviceId: testServiceA2.id,
            staffId: testStaffA1.id,
            resourceId: testResourceA1.id,
            startTime: '19:45',
            endTime: '20:05',
            price: 200.0,
            isRecommendedStaff: false,
          },
        ],
      },
      adminAToken
    );

    assert(createRes.status === 201, 'POST /api/appointments returns 201 Created');
    assert(createRes.data.success === true, 'Response success is true');
    assert(createRes.data.data.appointmentNumber.startsWith('APT-'), 'Appointment number starts with APT-');
    assert(
      createRes.data.data.totalAmount === '600' || createRes.data.data.totalAmount === '600.00',
      'Total amount is calculated as 600.00 (400 + 200)'
    );
    assert(createRes.data.data.items.length === 2, 'Appointment has 2 items');
    assert(createRes.data.data.items[0].isRecommendedStaff === true, 'First item has isRecommendedStaff = true');

    createdAppointmentId = createRes.data.data.id;
    createdAppointmentNumber = createRes.data.data.appointmentNumber;

    // 4.2 Create appointment with quick-guest creation
    const quickGuestMobile = `91234${Math.floor(10000 + Math.random() * 90000)}`;
    const quickGuestRes = await request(
      'POST',
      '/api/appointments',
      {
        guest: {
          name: 'Rohit Khandelwal',
          mobile: quickGuestMobile,
          email: 'rohit@example.com',
          gender: 'MALE',
        },
        appointmentDate: '2026-08-26',
        status: 'ONLINE',
        bookingSource: 'ONLINE',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            startTime: '10:00',
            durationMinutes: 30,
          },
        ],
      },
      cashierToken
    );

    assert(quickGuestRes.status === 201, 'POST /api/appointments with quick guest creation returns 201');
    assert(quickGuestRes.data.data.guest.name === 'Rohit Khandelwal', 'Quick guest created and linked');
    assert(quickGuestRes.data.data.guest.mobile === quickGuestMobile, 'Quick guest mobile saved');
    assert(quickGuestRes.data.data.items[0].endTime === '10:30', 'Auto-calculated endTime 10:30 from 30 min duration');

    // -------------------------------------------------------------
    // 5. Conflict Detection
    // -------------------------------------------------------------
    console.log('\n--- 5. Conflict Detection ---');

    // Attempt to book the same staff (Piyush) in overlapping slot 19:30 - 20:00
    const conflictRes = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-08-26',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            resourceId: testResourceA1.id,
            startTime: '19:30',
            endTime: '20:00',
          },
        ],
      },
      adminAToken
    );

    assert(conflictRes.status === 201, 'Appointment with conflict created');
    assert(
      Array.isArray(conflictRes.data.conflicts) && conflictRes.data.conflicts.length > 0,
      'Conflicts array returned with staff & resource overlap warnings'
    );

    // Clean up conflict test appointment
    await prisma.appointment.delete({ where: { id: conflictRes.data.data.id } });

    // -------------------------------------------------------------
    // 6. Get Single Appointment & Guest History
    // -------------------------------------------------------------
    console.log('\n--- 6. Get Single Appointment & Guest History ---');

    const getRes = await request('GET', `/api/appointments/${createdAppointmentId}`, undefined, adminAToken);
    assert(getRes.status === 200, 'GET /api/appointments/:id returns 200');
    assert(getRes.data.data.id === createdAppointmentId, 'Returned appointment ID matches');
    assert(getRes.data.data.guest.name === testGuestA.name, 'Guest details included');
    assert(Array.isArray(getRes.data.data.guestHistory), 'Guest history array returned for history modal');

    // -------------------------------------------------------------
    // 7. Calendar Metrics Verification
    // -------------------------------------------------------------
    console.log('\n--- 7. Calendar Metrics Verification ---');

    const updatedCalendar = await request('GET', '/api/appointments/calendar', undefined, adminAToken, {
      date: '2026-08-26',
    });
    assert(updatedCalendar.data.data.statusCounts.total === 2, 'Total appointments on 2026-08-26 is now 2');
    assert(updatedCalendar.data.data.statusCounts.confirmed === 1, 'Confirmed appointments count is 1');
    assert(updatedCalendar.data.data.statusCounts.online === 1, 'Online appointments count is 1');

    // -------------------------------------------------------------
    // 8. Update & Status Transitions
    // -------------------------------------------------------------
    console.log('\n--- 8. Update & Status Transitions ---');

    // 8.1 Status transition to CHECKED_IN
    const checkInRes = await request(
      'PATCH',
      `/api/appointments/${createdAppointmentId}/status`,
      { status: 'CHECKED_IN' },
      cashierToken
    );
    assert(checkInRes.status === 200, 'PATCH /api/appointments/:id/status to CHECKED_IN returns 200');
    assert(checkInRes.data.data.status === 'CHECKED_IN', 'Status updated to CHECKED_IN');

    // 8.2 Reschedule appointment
    const rescheduleRes = await request(
      'PATCH',
      `/api/appointments/${createdAppointmentId}/reschedule`,
      { appointmentDate: '2026-08-27' },
      cashierToken
    );
    assert(rescheduleRes.status === 200, 'PATCH /api/appointments/:id/reschedule returns 200');
    assert(rescheduleRes.data.data.appointmentDate.startsWith('2026-08-27'), 'Date updated to 2026-08-27');

    // Reschedule back to 2026-08-26
    const rescheduleBack = await request(
      'PATCH',
      `/api/appointments/${createdAppointmentId}/reschedule`,
      { appointmentDate: '2026-08-26' },
      cashierToken
    );
    assert(rescheduleBack.status === 200, 'Rescheduled back to 2026-08-26 successfully');

    // 8.3 Status transition to IN_PROGRESS
    const inProgressRes = await request(
      'PATCH',
      `/api/appointments/${createdAppointmentId}/status`,
      { status: 'IN_PROGRESS' },
      cashierToken
    );
    assert(inProgressRes.status === 200, 'PATCH /api/appointments/:id/status to IN_PROGRESS returns 200');
    assert(inProgressRes.data.data.status === 'IN_PROGRESS', 'Status updated to IN_PROGRESS');

    // 8.4 List Appointments with Filters & Pagination
    console.log('\n--- 8.4. List Appointments & Search ---');
    const listAll = await request('GET', '/api/appointments', undefined, adminAToken, {
      date: '2026-08-26',
    });
    assert(listAll.status === 200, 'GET /api/appointments with date filter returns 200');
    assert(listAll.data.success === true, 'List appointments success is true');
    assert(Array.isArray(listAll.data.data), 'Appointments list is an array');
    assert(listAll.data.meta.total >= 2, 'Total appointments count >= 2');

    // Search by guest name
    const searchRes = await request('GET', '/api/appointments', undefined, adminAToken, {
      search: 'Rohit',
    });
    assert(searchRes.status === 200, 'GET /api/appointments with search query returns 200');
    assert(
      searchRes.data.data.some((a: any) => a.guest?.name?.includes('Rohit')),
      'Search finds appointment for guest Rohit'
    );

    // Pagination test
    const pageRes = await request('GET', '/api/appointments', undefined, adminAToken, {
      limit: '1',
      page: '1',
    });
    assert(pageRes.status === 200, 'GET /api/appointments with limit=1 returns 200');
    assert(pageRes.data.data.length === 1, 'Returns exactly 1 record for limit=1');
    assert(pageRes.data.meta.totalPages >= 2, 'Total pages >= 2 for limit=1');

    // 8.5 Export Appointments CSV
    console.log('\n--- 8.5. Export Appointments CSV ---');
    const exportRes = await request('GET', '/api/appointments', undefined, adminAToken, {
      date: '2026-08-26',
      export: 'csv',
    });
    assert(exportRes.status === 200, 'GET /api/appointments?export=csv returns 200');
    assert(
      exportRes.headers.get('content-type')?.includes('text/csv') === true,
      'Content-Type is text/csv'
    );
    assert(
      typeof exportRes.data === 'string' && exportRes.data.includes('Appointment Number'),
      'CSV contains header "Appointment Number"'
    );
    assert(
      exportRes.data.includes('Guest Name') && exportRes.data.includes('Total Amount'),
      'CSV contains Guest Name and Total Amount headers'
    );
    assert(
      exportRes.data.includes(createdAppointmentNumber),
      'CSV export contains created appointment record'
    );

    // -------------------------------------------------------------
    // 9. Checkout to POS Conversion
    // -------------------------------------------------------------
    console.log('\n--- 9. Checkout to POS Conversion ---');

    const checkoutRes = await request(
      'POST',
      `/api/appointments/${createdAppointmentId}/checkout`,
      undefined,
      cashierToken
    );

    assert(checkoutRes.status === 200, 'POST /api/appointments/:id/checkout returns 200');
    assert(checkoutRes.data.success === true, 'Checkout success is true');
    assert(checkoutRes.data.data.orderNumber.startsWith('ORD-'), 'Converted into a POS order with order number ORD-');
    assert(Number(checkoutRes.data.data.totalAmount) === 600, 'POS order total amount is 600.00');

    // Verify appointment status is now COMPLETED and linked to posOrderId
    const checkedAppt = await prisma.appointment.findUnique({
      where: { id: createdAppointmentId },
    });
    assert(checkedAppt?.status === 'COMPLETED', 'Appointment status transitioned to COMPLETED');
    assert(checkedAppt?.posOrderId === checkoutRes.data.data.id, 'Appointment posOrderId is linked to created POS order');

    // Duplicate checkout attempt must fail
    const dupCheckout = await request(
      'POST',
      `/api/appointments/${createdAppointmentId}/checkout`,
      undefined,
      cashierToken
    );
    assert(dupCheckout.status === 400, 'Duplicate checkout attempt returns 400 Bad Request');

    // -------------------------------------------------------------
    // 10. Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- 10. Tenant Isolation ---');

    // Tenant B attempts to access Tenant A's appointment
    const tenantBAccess = await request('GET', `/api/appointments/${createdAppointmentId}`, undefined, adminBToken);
    assert(tenantBAccess.status === 404, 'Tenant B querying Tenant A appointment returns 404 Not Found');

    const tenantBUpdate = await request(
      'PATCH',
      `/api/appointments/${createdAppointmentId}/status`,
      { status: 'CANCELLED' },
      adminBToken
    );
    assert(tenantBUpdate.status === 404, 'Tenant B modifying Tenant A appointment returns 404 Not Found');

    const tenantBCheckout = await request(
      'POST',
      `/api/appointments/${createdAppointmentId}/checkout`,
      undefined,
      adminBToken
    );
    assert(tenantBCheckout.status === 404, 'Tenant B checking out Tenant A appointment returns 404 Not Found');

    const tenantBList = await request('GET', '/api/appointments', undefined, adminBToken);
    assert(tenantBList.status === 200, 'Tenant B list returns 200');
    assert(tenantBList.data.data.length === 0, 'Tenant B cannot see Tenant A appointments (0 records)');

    const tenantBCalendar = await request('GET', '/api/appointments/calendar', undefined, adminBToken, {
      date: '2026-08-26',
    });
    assert(tenantBCalendar.status === 200, 'Tenant B calendar returns 200');
    assert(tenantBCalendar.data.data.statusCounts.total === 0, 'Tenant B calendar has 0 total appointments');

    // -------------------------------------------------------------
    // 11. Cancellation & Deletion
    // -------------------------------------------------------------
    console.log('\n--- 11. Cancellation & Deletion ---');

    const cancelRes = await request(
      'PATCH',
      `/api/appointments/${quickGuestRes.data.data.id}/status`,
      {
        status: 'CANCELLED',
        cancelledReason: 'Guest called to cancel',
      },
      adminAToken
    );
    assert(cancelRes.status === 200, 'Cancellation returns 200');
    assert(cancelRes.data.data.status === 'CANCELLED', 'Status is CANCELLED');
    assert(cancelRes.data.data.cancelledReason === 'Guest called to cancel', 'Cancellation reason saved');

    const deleteRes = await request('DELETE', `/api/appointments/${quickGuestRes.data.data.id}`, undefined, adminAToken);
    assert(deleteRes.status === 200, 'DELETE /api/appointments/:id returns 200');

    // -------------------------------------------------------------
    // 12. Cleanup
    // -------------------------------------------------------------
    console.log('\n--- 12. Cleanup ---');

    await prisma.appointmentItem.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.appointment.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.posPayment.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.posOrderItem.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.posOrder.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.resource.deleteMany({ where: { tenantId: tenantAId } });
    if (testStaffA1 && testStaffA2) {
      await prisma.staffAppointmentSetting.deleteMany({
        where: { staffId: { in: [testStaffA1.id, testStaffA2.id] } },
      });
      await prisma.staff.deleteMany({
        where: { id: { in: [testStaffA1.id, testStaffA2.id] } },
      });
    }
    if (testServiceA1 && testServiceA2) {
      await prisma.service.deleteMany({
        where: { id: { in: [testServiceA1.id, testServiceA2.id] } },
      });
    }

    assert(true, 'Test teardown completed cleanly');
  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   Appointments Module Tests: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAppointmentTests();
