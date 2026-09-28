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

export async function runAppointmentEdgeCasesTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Appointments & Scheduling EDGE CASES Test Suite');
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
    console.log('--- 1. Authentication & Fixture Setup ---');

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

    // Seed test fixtures
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
        name: `Edge Service 1 ${Date.now()}`,
        price: 350.0,
        salePrice: 350.0,
        durationMinutes: 30,
      },
    });

    testServiceA2 = await prisma.service.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA.id,
        name: `Edge Service 2 ${Date.now()}`,
        price: 150.0,
        salePrice: 150.0,
        durationMinutes: 15,
      },
    });

    testStaffA1 = await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: `Stylist Alice ${Date.now()}`,
        isActive: true,
      },
    });

    testStaffA2 = await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: `Stylist Bob ${Date.now()}`,
        isActive: true,
      },
    });

    testResourceA1 = await prisma.resource.create({
      data: {
        tenantId: tenantAId,
        name: `Spa Room Alpha ${Date.now()}`,
        capacity: 1,
        isActive: true,
      },
    });

    testResourceA2 = await prisma.resource.create({
      data: {
        tenantId: tenantAId,
        name: `Chair Beta ${Date.now()}`,
        capacity: 1,
        isActive: true,
      },
    });

    testGuestA = await prisma.guest.create({
      data: {
        tenantId: tenantAId,
        name: 'Edge Case Test Guest',
        mobile: `9988${Math.floor(100000 + Math.random() * 900000)}`,
        email: 'edge.guest@example.com',
        customerType: 'REGULAR',
      },
    });

    assert(true, 'Test fixtures created');

    // -------------------------------------------------------------
    // 2. Validation & Boundary Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 2. Validation & Boundary Edge Cases ---');

    // 2.1 Missing both guestId and guest details
    const noGuestRes = await request(
      'POST',
      '/api/appointments',
      {
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '10:00' }],
      },
      adminAToken
    );
    assert(noGuestRes.status === 400, 'Creation without guestId and guest returns 400 Bad Request');
    assert(JSON.stringify(noGuestRes.data).includes('guestId') || JSON.stringify(noGuestRes.data).includes('guest'), 'Validation mentions guest requirement');

    // 2.2 Empty items array
    const emptyItemsRes = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        items: [],
      },
      adminAToken
    );
    assert(emptyItemsRes.status === 400, 'Creation with empty items array returns 400 Bad Request');

    // 2.3 Malformed date formats
    const badDate1 = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '26-08-2026',
        items: [{ serviceId: testServiceA1.id, startTime: '10:00' }],
      },
      adminAToken
    );
    assert(badDate1.status === 400, 'DD-MM-YYYY format is rejected (expects YYYY-MM-DD)');

    const badDate2 = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: 'not-a-date',
        items: [{ serviceId: testServiceA1.id, startTime: '10:00' }],
      },
      adminAToken
    );
    assert(badDate2.status === 400, 'Invalid string date is rejected');

    // 2.4 Malformed time formats
    const badTime1 = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '25:00' }],
      },
      adminAToken
    );
    assert(badTime1.status === 400, 'Hour 25:00 is rejected (valid: 00:00-23:59)');

    const badTime2 = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '12:60' }],
      },
      adminAToken
    );
    assert(badTime2.status === 400, 'Minute 12:60 is rejected (valid: 00:00-23:59)');

    const badTime3 = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '9:00' }],
      },
      adminAToken
    );
    assert(badTime3.status === 400, 'Single digit hour 9:00 without leading zero is rejected (expects HH:mm)');

    // 2.5 Invalid non-existent UUIDs
    const badServiceUuid = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        items: [{ serviceId: '00000000-0000-0000-0000-000000000000', startTime: '10:00' }],
      },
      adminAToken
    );
    assert(badServiceUuid.status === 400, 'Non-existent service UUID returns 400');

    // 2.6 Inline quick guest with invalid mobile
    const badMobileRes = await request(
      'POST',
      '/api/appointments',
      {
        guest: {
          name: 'Bad Mobile Guest',
          mobile: '12345',
        },
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '10:00' }],
      },
      adminAToken
    );
    assert(badMobileRes.status === 400, 'Mobile number shorter than 10 digits is rejected');

    // 2.7 Inline quick guest with invalid email format
    const badEmailRes = await request(
      'POST',
      '/api/appointments',
      {
        guest: {
          name: 'Bad Email Guest',
          mobile: '9876500001',
          email: 'not-an-email',
        },
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '10:00' }],
      },
      adminAToken
    );
    assert(badEmailRes.status === 400, 'Invalid email address format is rejected');

    // 2.8 Inline guest duplicate mobile: reuses existing guest record without collision
    const sharedMobile = `9777${Math.floor(100000 + Math.random() * 900000)}`;
    const guest1 = await request(
      'POST',
      '/api/appointments',
      {
        guest: { name: 'Original Name', mobile: sharedMobile },
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '09:00', durationMinutes: 30 }],
      },
      adminAToken
    );
    assert(guest1.status === 201, 'First appointment with quick guest created');

    const guest2 = await request(
      'POST',
      '/api/appointments',
      {
        guest: { name: 'Original Name Re-booked', mobile: sharedMobile },
        appointmentDate: '2026-09-01',
        items: [{ serviceId: testServiceA1.id, startTime: '09:30', durationMinutes: 30 }],
      },
      adminAToken
    );
    assert(guest2.status === 201, 'Second appointment with existing mobile reuses guest without error');
    assert(guest1.data.data.guest.id === guest2.data.data.guest.id, 'Same guest ID is linked for both appointments');

    // 2.9 Custom / zero price service (complimentary consultation)
    const freeServiceAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        items: [
          {
            serviceId: testServiceA1.id,
            startTime: '10:00',
            durationMinutes: 15,
            price: 0,
          },
        ],
      },
      adminAToken
    );
    assert(freeServiceAppt.status === 201, 'Booking with price 0 (complimentary) is accepted');
    assert(Number(freeServiceAppt.data.data.totalAmount) === 0, 'Total amount is 0');

    // 2.10 Max character instruction length (1000 chars)
    const longInstruction = 'A'.repeat(1000);
    const maxInstructionAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        instruction: longInstruction,
        items: [{ serviceId: testServiceA1.id, startTime: '10:15', durationMinutes: 15 }],
      },
      adminAToken
    );
    assert(maxInstructionAppt.status === 201, '1000-character instruction is accepted');

    const overflowInstruction = 'B'.repeat(1001);
    const overflowAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-01',
        instruction: overflowInstruction,
        items: [{ serviceId: testServiceA1.id, startTime: '10:30', durationMinutes: 15 }],
      },
      adminAToken
    );
    assert(overflowAppt.status === 400, 'Instruction exceeding 1000 characters is rejected');

    // -------------------------------------------------------------
    // 3. Conflict Detection Boundary Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 3. Conflict Detection Boundary Edge Cases ---');

    // Seed base appointment: Alice booked 11:00 - 11:30 in Room Alpha
    const baseAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            resourceId: testResourceA1.id,
            startTime: '11:00',
            endTime: '11:30',
          },
        ],
      },
      adminAToken
    );
    assert(baseAppt.status === 201, 'Base appointment for conflict tests created (11:00-11:30)');

    // 3.1 Consecutive slot AFTER: 11:30 - 12:00 (exact boundary -> NO conflict)
    const consecutiveAfter = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            startTime: '11:30',
            endTime: '12:00',
          },
        ],
      },
      adminAToken
    );
    assert(consecutiveAfter.status === 201, 'Appointment starting exactly when prior ends (11:30) created');
    assert(!consecutiveAfter.data.conflicts, 'Starts at end time: no conflict reported');

    // 3.2 Consecutive slot BEFORE: 10:30 - 11:00 (exact boundary -> NO conflict)
    const consecutiveBefore = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            startTime: '10:30',
            endTime: '11:00',
          },
        ],
      },
      adminAToken
    );
    assert(consecutiveBefore.status === 201, 'Appointment ending exactly when next begins (11:00) created');
    assert(!consecutiveBefore.data.conflicts, 'Ends at start time: no conflict reported');

    // 3.3 Partial overlap inside: 11:15 - 11:45 -> CONFLICT!
    const partialOverlap = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            startTime: '11:15',
            endTime: '11:45',
          },
        ],
      },
      adminAToken
    );
    assert(partialOverlap.status === 201, 'Overlapping appointment created');
    assert(
      Array.isArray(partialOverlap.data.conflicts) && partialOverlap.data.conflicts.length > 0,
      'Partial overlap 11:15-11:45 triggers conflict warning'
    );

    // 3.4 Full enclosure: 10:45 - 11:45 (completely encloses 11:00-11:30) -> CONFLICT!
    const fullEnclosure = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            startTime: '10:45',
            endTime: '11:45',
          },
        ],
      },
      adminAToken
    );
    assert(
      Array.isArray(fullEnclosure.data.conflicts) && fullEnclosure.data.conflicts.length > 0,
      'Full enclosure 10:45-11:45 triggers conflict warning'
    );

    // 3.5 Resource-only conflict: Different staff (Bob), same resource (Room Alpha) at 11:10 - 11:25 -> CONFLICT!
    const resourceConflict = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA2.id, // Bob
            resourceId: testResourceA1.id, // Room Alpha
            startTime: '11:10',
            endTime: '11:25',
          },
        ],
      },
      adminAToken
    );
    assert(
      Array.isArray(resourceConflict.data.conflicts) &&
      resourceConflict.data.conflicts.some((c: string) => c.includes('Resource')),
      'Resource overlap warning generated even when staff is different'
    );

    // Clean up temporary overlapping appointments on 2026-09-02
    await prisma.appointment.delete({ where: { id: partialOverlap.data.data.id } });
    await prisma.appointment.delete({ where: { id: fullEnclosure.data.data.id } });
    await prisma.appointment.delete({ where: { id: resourceConflict.data.data.id } });

    // 3.6 Cancelled appointment does NOT cause conflict
    // Cancel the base appointment
    await request(
      'PATCH',
      `/api/appointments/${baseAppt.data.data.id}/status`,
      { status: 'CANCELLED', cancelledReason: 'Testing conflict release' },
      adminAToken
    );

    const rebookSlot = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-02',
        items: [
          {
            serviceId: testServiceA1.id,
            staffId: testStaffA1.id,
            resourceId: testResourceA1.id,
            startTime: '11:00',
            endTime: '11:30',
          },
        ],
      },
      adminAToken
    );
    assert(!rebookSlot.data.conflicts, 'Re-booking cancelled slot triggers 0 conflicts (slot released)');

    // -------------------------------------------------------------
    // 4. Status Progression & State Machine Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 4. Status Progression & State Machine Edge Cases ---');

    const apptLifecycle = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-03',
        status: 'CONFIRMED',
        items: [{ serviceId: testServiceA1.id, startTime: '14:00', durationMinutes: 30 }],
      },
      adminAToken
    );
    const lifeId = apptLifecycle.data.data.id;

    // 4.1 Update status to CHECKED_IN
    const s1 = await request('PATCH', `/api/appointments/${lifeId}/status`, { status: 'CHECKED_IN' }, cashierToken);
    assert(s1.status === 200 && s1.data.data.status === 'CHECKED_IN', 'Status transitioned to CHECKED_IN');

    // 4.2 Update status to IN_PROGRESS
    const s2 = await request('PATCH', `/api/appointments/${lifeId}/status`, { status: 'IN_PROGRESS' }, cashierToken);
    assert(s2.status === 200 && s2.data.data.status === 'IN_PROGRESS', 'Status transitioned to IN_PROGRESS');

    // 4.3 Update status to NO_SHOW
    const s3 = await request('PATCH', `/api/appointments/${lifeId}/status`, { status: 'NO_SHOW' }, cashierToken);
    assert(s3.status === 200 && s3.data.data.status === 'NO_SHOW', 'Status transitioned to NO_SHOW');

    // 4.4 Invalid status enum
    const sBad = await request('PATCH', `/api/appointments/${lifeId}/status`, { status: 'PENDING_APPROVAL' }, cashierToken);
    assert(sBad.status === 400, 'Invalid status string returns 400 Bad Request');

    // 4.5 Status on non-existent appointment
    const s404 = await request('PATCH', '/api/appointments/00000000-0000-0000-0000-000000000000/status', { status: 'CHECKED_IN' }, cashierToken);
    assert(s404.status === 404, 'Status update on non-existent appointment returns 404');

    // -------------------------------------------------------------
    // 5. Checkout Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 5. Checkout Edge Cases ---');

    // 5.1 Checkout a normal appointment
    const checkoutTarget = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-03',
        status: 'IN_PROGRESS',
        items: [
          { serviceId: testServiceA1.id, staffId: testStaffA1.id, startTime: '15:00', durationMinutes: 30, price: 350 },
          { serviceId: testServiceA2.id, staffId: testStaffA2.id, startTime: '15:30', durationMinutes: 15, price: 150 },
        ],
      },
      cashierToken
    );
    const targetId = checkoutTarget.data.data.id;

    const coRes1 = await request('POST', `/api/appointments/${targetId}/checkout`, undefined, cashierToken);
    assert(coRes1.status === 200, 'Checkout creates POS Order successfully');
    assert(Number(coRes1.data.data.totalAmount) === 500, 'Order total matches appointment item sums (350 + 150 = 500)');
    assert(coRes1.data.data.items.length === 2, 'POS order has 2 items');

    // Verify appointment status updated to COMPLETED
    const coAppt = await request('GET', `/api/appointments/${targetId}`, undefined, cashierToken);
    assert(coAppt.data.data.status === 'COMPLETED', 'Appointment status is COMPLETED after checkout');
    assert(coAppt.data.data.posOrderId === coRes1.data.data.id, 'posOrderId correctly links to created POS order');

    // 5.2 Duplicate checkout attempt
    const coDup = await request('POST', `/api/appointments/${targetId}/checkout`, undefined, cashierToken);
    assert(coDup.status === 400, 'Duplicate checkout attempt returns 400 Bad Request');
    assert(coDup.data.message.includes('already been checked out'), 'Duplicate checkout error message is clear');

    // 5.3 Attempt checkout on CANCELLED appointment
    const cancelledAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-03',
        status: 'CANCELLED',
        items: [{ serviceId: testServiceA1.id, startTime: '16:00', durationMinutes: 30 }],
      },
      cashierToken
    );
    const coCancel = await request('POST', `/api/appointments/${cancelledAppt.data.data.id}/checkout`, undefined, cashierToken);
    assert(coCancel.status === 400, 'Checkout on CANCELLED appointment returns 400 Bad Request');
    assert(coCancel.data.message.includes('Cannot checkout a cancelled appointment'), 'Rejects checkout of cancelled appointment');

    // 5.4 Checkout on non-existent appointment
    const co404 = await request('POST', '/api/appointments/00000000-0000-0000-0000-000000000000/checkout', undefined, cashierToken);
    assert(co404.status === 404, 'Checkout on non-existent appointment returns 404 Not Found');

    // -------------------------------------------------------------
    // 6. Rescheduling Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 6. Rescheduling Edge Cases ---');

    const reschedAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-04',
        items: [{ serviceId: testServiceA1.id, staffId: testStaffA1.id, startTime: '10:00', durationMinutes: 30 }],
      },
      cashierToken
    );
    const reschedId = reschedAppt.data.data.id;
    const itemId = reschedAppt.data.data.items[0].id;

    // 6.1 Reschedule date, time, and transfer to Stylist Bob
    const reschedOk = await request(
      'PATCH',
      `/api/appointments/${reschedId}/reschedule`,
      {
        appointmentDate: '2026-09-05',
        items: [
          {
            id: itemId,
            serviceId: testServiceA1.id,
            staffId: testStaffA2.id,
            startTime: '16:00',
            endTime: '16:30',
          },
        ],
      },
      cashierToken
    );
    assert(reschedOk.status === 200, 'Reschedule date, time, and staff returns 200');
    assert(reschedOk.data.data.appointmentDate.startsWith('2026-09-05'), 'Date updated to 2026-09-05');
    assert(reschedOk.data.data.items[0].staffId === testStaffA2.id, 'Staff transferred to Stylist Bob');
    assert(reschedOk.data.data.items[0].startTime === '16:00', 'Start time updated to 16:00');

    // 6.2 Reschedule non-existent appointment
    const resched404 = await request(
      'PATCH',
      '/api/appointments/00000000-0000-0000-0000-000000000000/reschedule',
      { appointmentDate: '2026-09-05' },
      cashierToken
    );
    assert(resched404.status === 404, 'Rescheduling non-existent appointment returns 404');

    // -------------------------------------------------------------
    // 7. Calendar Grid & Query Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 7. Calendar Grid & Query Edge Cases ---');

    // 7.1 Calendar for date with 0 appointments (future date)
    const emptyCalendar = await request('GET', '/api/appointments/calendar', undefined, adminAToken, {
      date: '2029-12-31',
    });
    assert(emptyCalendar.status === 200, 'Calendar for empty date returns 200');
    assert(emptyCalendar.data.data.appointments.length === 0, 'Appointments list is empty');
    assert(emptyCalendar.data.data.statusCounts.total === 0, 'Total status count is 0');
    assert(emptyCalendar.data.data.timeSlots.length > 0, 'Time slots array still returned');
    assert(emptyCalendar.data.data.columns.length > 0, 'Columns array still returned');

    // 7.2 Calendar resource view
    const resCalendar = await request('GET', '/api/appointments/calendar', undefined, adminAToken, {
      date: '2026-09-02',
      view: 'resource',
    });
    assert(resCalendar.status === 200, 'Calendar with view=resource returns 200');
    assert(resCalendar.data.data.view === 'resource', 'View is resource');
    assert(
      resCalendar.data.data.columns.some((c: any) => c.id === testResourceA1.id),
      'Resource Room Alpha is in columns'
    );

    // 7.3 Filter calendar by status
    const confirmedOnlyCal = await request('GET', '/api/appointments/calendar', undefined, adminAToken, {
      date: '2026-09-03',
      status: 'COMPLETED',
    });
    assert(confirmedOnlyCal.status === 200, 'Calendar filtered by COMPLETED returns 200');
    assert(
      confirmedOnlyCal.data.data.appointments.every((a: any) => a.status === 'COMPLETED'),
      'All returned appointments have status COMPLETED'
    );

    // 7.4 Search non-existent string
    const emptySearch = await request('GET', '/api/appointments', undefined, adminAToken, {
      search: 'ZZZNonExistentGuestName123',
    });
    assert(emptySearch.status === 200, 'Search for non-existent guest returns 200');
    assert(emptySearch.data.data.length === 0, 'Search returns 0 records');
    assert(emptySearch.data.meta.total === 0, 'Meta total is 0');

    // 7.5 Pagination beyond total pages
    const beyondPage = await request('GET', '/api/appointments', undefined, adminAToken, {
      page: '9999',
      limit: '10',
    });
    assert(beyondPage.status === 200, 'Page 9999 returns 200');
    assert(beyondPage.data.data.length === 0, 'Data is empty array for out-of-range page');
    assert(beyondPage.data.meta.page === 9999, 'Meta page is 9999');

    // 7.6 CSV export for date with 0 records
    const emptyCsv = await request('GET', '/api/appointments', undefined, adminAToken, {
      date: '2029-12-31',
      export: 'csv',
    });
    assert(emptyCsv.status === 200, 'CSV export for empty date returns 200');
    assert(emptyCsv.headers.get('content-type')?.includes('text/csv') === true, 'Content-Type is text/csv');
    assert(typeof emptyCsv.data === 'string' && emptyCsv.data.startsWith('Appointment Number'), 'CSV header present');
    // Only 1 line (header)
    const lines = emptyCsv.data.trim().split('\n');
    assert(lines.length === 1, 'Only header row exists for empty result set');

    // 7.7 CSV export with quotes/commas in guest name and instruction
    const specialGuest = await prisma.guest.create({
      data: {
        tenantId: tenantAId,
        name: 'John "The Barber", Jr.',
        mobile: `9977${Math.floor(100000 + Math.random() * 900000)}`,
        customerType: 'REGULAR',
      },
    });

    const specialAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: specialGuest.id,
        appointmentDate: '2026-09-06',
        instruction: 'Wants "special" treatment, gentle wash.',
        items: [{ serviceId: testServiceA1.id, startTime: '12:00', durationMinutes: 30 }],
      },
      adminAToken
    );
    assert(specialAppt.status === 201, 'Appointment with quotes and commas created');

    const specialCsv = await request('GET', '/api/appointments', undefined, adminAToken, {
      date: '2026-09-06',
      export: 'csv',
    });
    assert(specialCsv.status === 200, 'CSV export for special characters returns 200');
    assert(specialCsv.data.includes('John ""The Barber"", Jr.'), 'Quotes and commas escaped properly in CSV');

    // -------------------------------------------------------------
    // 8. Strict Multi-Tenant SaaS Isolation Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 8. Strict Multi-Tenant SaaS Isolation Edge Cases ---');

    // Tenant B attempts actions on Tenant A's appointment
    const targetAId = specialAppt.data.data.id;

    const tBGet = await request('GET', `/api/appointments/${targetAId}`, undefined, adminBToken);
    assert(tBGet.status === 404, 'Tenant B cannot GET Tenant A appointment (404)');

    const tBPut = await request('PUT', `/api/appointments/${targetAId}`, { instruction: 'Hacked' }, adminBToken);
    assert(tBPut.status === 404, 'Tenant B cannot PUT Tenant A appointment (404)');

    const tBPatchStatus = await request('PATCH', `/api/appointments/${targetAId}/status`, { status: 'CANCELLED' }, adminBToken);
    assert(tBPatchStatus.status === 404, 'Tenant B cannot PATCH status of Tenant A appointment (404)');

    const tBResched = await request('PATCH', `/api/appointments/${targetAId}/reschedule`, { appointmentDate: '2026-09-10' }, adminBToken);
    assert(tBResched.status === 404, 'Tenant B cannot reschedule Tenant A appointment (404)');

    const tBCheckout = await request('POST', `/api/appointments/${targetAId}/checkout`, undefined, adminBToken);
    assert(tBCheckout.status === 404, 'Tenant B cannot checkout Tenant A appointment (404)');

    const tBDelete = await request('DELETE', `/api/appointments/${targetAId}`, undefined, adminBToken);
    assert(tBDelete.status === 404, 'Tenant B cannot DELETE Tenant A appointment (404)');

    const tBCalendar = await request('GET', '/api/appointments/calendar', undefined, adminBToken, {
      date: '2026-09-06',
    });
    assert(tBCalendar.data.data.appointments.length === 0, 'Tenant B calendar does not leak Tenant A appointments');

    const tBList = await request('GET', '/api/appointments', undefined, adminBToken, {
      date: '2026-09-06',
    });
    assert(tBList.data.data.length === 0, 'Tenant B list does not leak Tenant A appointments');

    // -------------------------------------------------------------
    // 9. Cascade & Deletion Edge Cases
    // -------------------------------------------------------------
    console.log('\n--- 9. Cascade & Deletion Edge Cases ---');

    const delAppt = await request(
      'POST',
      '/api/appointments',
      {
        guestId: testGuestA.id,
        appointmentDate: '2026-09-07',
        items: [
          { serviceId: testServiceA1.id, startTime: '10:00', durationMinutes: 30 },
          { serviceId: testServiceA2.id, startTime: '10:30', durationMinutes: 15 },
        ],
      },
      adminAToken
    );
    const delId = delAppt.data.data.id;

    // Verify items exist
    const itemsBefore = await prisma.appointmentItem.findMany({ where: { appointmentId: delId } });
    assert(itemsBefore.length === 2, '2 appointment items exist before delete');

    // Delete appointment
    const deleteRes = await request('DELETE', `/api/appointments/${delId}`, undefined, adminAToken);
    assert(deleteRes.status === 200, 'DELETE /api/appointments/:id returns 200');

    // Verify items cascaded/deleted
    const itemsAfter = await prisma.appointmentItem.findMany({ where: { appointmentId: delId } });
    assert(itemsAfter.length === 0, 'Appointment items cascaded and deleted with appointment');

    // Delete already deleted appointment
    const delAgain = await request('DELETE', `/api/appointments/${delId}`, undefined, adminAToken);
    assert(delAgain.status === 404, 'DELETE on already deleted appointment returns 404');

    // -------------------------------------------------------------
    // 10. Teardown
    // -------------------------------------------------------------
    console.log('\n--- 10. Teardown ---');

    await prisma.appointmentItem.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.appointment.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.posPayment.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.posOrderItem.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.posOrder.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.resource.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.staffAppointmentSetting.deleteMany({
      where: { staffId: { in: [testStaffA1.id, testStaffA2.id] } },
    });
    await prisma.staff.deleteMany({
      where: { id: { in: [testStaffA1.id, testStaffA2.id] } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: [testServiceA1.id, testServiceA2.id] } },
    });

    assert(true, 'Test fixtures cleaned up cleanly');
  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   Appointments Edge Cases Tests: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAppointmentEdgeCasesTests();
