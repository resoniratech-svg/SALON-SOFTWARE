import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let receptionistToken: string;
let designationId: string;
let shiftId: string;
let createdStaffId: string;

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
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  const cloned = res.clone();
  const data = await res.json().catch(() => null);
  const text = await cloned.text().catch(() => '');
  return { status: res.status, data, text, headers: res.headers };
}

async function runTests() {
  console.log('\n========================================');
  console.log('   QUBEXE SALOON SOFTWARE Staff Module Test Suite');
  console.log('========================================\n');

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
    // -------------------------------------------------------------
    // PREREQUISITES & AUTH SETUP
    // -------------------------------------------------------------
    console.log('--- 1. Setup & Authentication ---');

    const adminLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    adminToken = adminLogin.data?.data?.token;
    assert(!!adminToken, 'Admin authenticated and JWT obtained');

    const recLogin = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(recLogin.status === 401, 'Receptionist login rejected under 2-role model (HTTP 401)');

    // Clean any prior test staff records and related service mappings
    const priorStaff = await prisma.staff.findMany({
      where: {
        joiningDetails: {
          employeeNumber: { startsWith: 'EMP-' },
        },
      },
      select: { id: true },
    });
    const priorStaffIds = priorStaff.map((s) => s.id);
    if (priorStaffIds.length > 0) {
      await prisma.serviceStaff.deleteMany({
        where: { staffId: { in: priorStaffIds } },
      });
      await prisma.staff.deleteMany({
        where: { id: { in: priorStaffIds } },
      });
    }

    // Fetch prerequisite designation & shift from DB or meta API
    const desigRes = await request('GET', '/api/staff/meta/designations', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(desigRes.status === 200, 'GET /api/staff/meta/designations returns 200');
    designationId = desigRes.data?.data?.[0]?.id;
    assert(!!designationId, 'Designation ID obtained for testing');

    const shiftRes = await request('GET', '/api/staff/meta/shifts', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(shiftRes.status === 200, 'GET /api/staff/meta/shifts returns 200');
    shiftId = shiftRes.data?.data?.[0]?.id;
    assert(!!shiftId, 'Shift ID obtained for testing');

    // -------------------------------------------------------------
    // 2. CREATION TESTS (HAPPY PATH & ALL SECTIONS)
    // -------------------------------------------------------------
    console.log('\n--- 2. Staff Creation Tests ---');

    const validStaffPayload = {
      personalDetails: {
        firstName: 'Sushant',
        lastName: 'Praveen',
        displayName: 'Sushant P',
        gender: 'Male',
        dob: '1992-05-15',
        mobile: '9876543210',
        email: 'sushant@respark.local',
        address: '101 MG Road, Kalyaninagar, Pune',
        emergencyContactName: 'Praveen Senior',
        emergencyContactNumber: '9876543211',
        avatarUrl: 'https://respark.local/avatars/sushant.jpg',
      },
      documents: [
        {
          documentType: 'Aadhaar Card',
          documentNumber: '1234-5678-9012',
          documentUrl: 'https://respark.local/docs/aadhaar.pdf',
        },
      ],
      joiningDetails: {
        joiningDate: '2025-01-10',
        designationId,
        employeeNumber: 'EMP-001',
        reportingToId: null,
        workingHours: '09:00 - 18:00',
      },
      bankDetails: {
        bankName: 'HDFC Bank',
        branch: 'Kalyaninagar',
        accountNumber: '50100234567890',
        ifsc: 'HDFC0001234',
      },
      appointmentSettings: {
        enableAppointments: true,
        showAllAppointments: true,
      },
      weeklySchedule: [
        { dayOfWeek: 0, shiftId, isWeeklyOff: false },
        { dayOfWeek: 1, shiftId, isWeeklyOff: false },
        { dayOfWeek: 2, shiftId, isWeeklyOff: false },
        { dayOfWeek: 3, shiftId, isWeeklyOff: false },
        { dayOfWeek: 4, shiftId, isWeeklyOff: false },
        { dayOfWeek: 5, shiftId, isWeeklyOff: false },
        { dayOfWeek: 6, shiftId: null, isWeeklyOff: true },
      ],
    };

    const createRes = await request('POST', '/api/staff', validStaffPayload, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(createRes.status === 201, 'Valid Staff created successfully (HTTP 201)');
    assert(createRes.data?.success === true, 'Create response indicates success');
    assert(createRes.data?.data?.name === 'Sushant Praveen', 'Staff composite name created correctly');
    assert(createRes.data?.data?.personalDetails?.mobile === '9876543210', 'Personal details saved');
    assert(createRes.data?.data?.documents?.length === 1, 'Documents saved');
    assert(createRes.data?.data?.joiningDetails?.employeeNumber === 'EMP-001', 'Joining details saved');
    assert(createRes.data?.data?.bankDetails?.bankName === 'HDFC Bank', 'Bank details saved');
    assert(createRes.data?.data?.appointmentSettings?.enableAppointments === true, 'Appointment settings saved');
    assert(createRes.data?.data?.weeklySchedules?.length === 7, 'Weekly schedule saved for all 7 days');

    createdStaffId = createRes.data?.data?.id;

    // -------------------------------------------------------------
    // 3. VALIDATION & EDGE CASES IN CREATION
    // -------------------------------------------------------------
    console.log('\n--- 3. Validation & Edge Cases ---');

    // 3.1 Duplicate employee number
    const duplicateEmpRes = await request('POST', '/api/staff', {
      ...validStaffPayload,
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        employeeNumber: 'EMP-001', // duplicate
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(duplicateEmpRes.status === 409, 'Duplicate employee number rejected with HTTP 409 Conflict');

    // 3.2 Missing required personal detail (firstName)
    const missingFirstname = await request('POST', '/api/staff', {
      ...validStaffPayload,
      personalDetails: {
        ...validStaffPayload.personalDetails,
        firstName: '',
      },
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        employeeNumber: 'EMP-002',
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(missingFirstname.status === 400, 'Missing first name rejected with HTTP 400 Bad Request');

    // 3.3 Missing required bank details (accountNumber)
    const missingBankField = await request('POST', '/api/staff', {
      ...validStaffPayload,
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        employeeNumber: 'EMP-003',
      },
      bankDetails: {
        ...validStaffPayload.bankDetails,
        accountNumber: '',
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(missingBankField.status === 400, 'Missing bank account number rejected with HTTP 400 Bad Request');

    // 3.4 Non-existent designation ID
    const badDesig = await request('POST', '/api/staff', {
      ...validStaffPayload,
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        designationId: '00000000-0000-0000-0000-000000000000',
        employeeNumber: 'EMP-004',
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(badDesig.status === 400, 'Non-existent designation ID rejected with HTTP 400 Bad Request');

    // 3.5 Non-existent reporting manager
    const badManager = await request('POST', '/api/staff', {
      ...validStaffPayload,
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        reportingToId: '00000000-0000-0000-0000-000000000000',
        employeeNumber: 'EMP-005',
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(badManager.status === 400, 'Non-existent reporting manager rejected with HTTP 400 Bad Request');

    // 3.6 Valid reporting to another staff
    const staffWithManager = await request('POST', '/api/staff', {
      ...validStaffPayload,
      personalDetails: {
        ...validStaffPayload.personalDetails,
        firstName: 'Piyush',
        lastName: 'Kumar',
        mobile: '9876543299',
      },
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        employeeNumber: 'EMP-006',
        reportingToId: createdStaffId, // Reports to Sushant
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(staffWithManager.status === 201, 'Staff reporting to existing manager created successfully (HTTP 201)');
    const piyushId = staffWithManager.data?.data?.id;

    // 3.7 Self reporting check on update (Piyush cannot report to Piyush)
    const selfReportUpdate = await request('PUT', `/api/staff/${piyushId}`, {
      joiningDetails: {
        reportingToId: piyushId,
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(selfReportUpdate.status === 400, 'Self-reporting rejected with HTTP 400 Bad Request');

    // -------------------------------------------------------------
    // 4. RETRIEVAL & FILTERING TESTS
    // -------------------------------------------------------------
    console.log('\n--- 4. Staff Retrieval & Filtering Tests ---');

    // 4.1 Staff List
    const listRes = await request('GET', '/api/staff', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listRes.status === 200, 'GET /api/staff returns HTTP 200');
    assert(listRes.data?.data?.items?.length >= 2, 'List returns created staff items');
    // Verify bank account is masked in list view
    const maskedAccount = listRes.data?.data?.items?.[0]?.bankDetails?.accountNumber;
    assert(maskedAccount.startsWith('****'), 'Bank account is masked in staff list view');

    // 4.2 Search by name
    const searchRes = await request('GET', '/api/staff?search=Sushant', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchRes.status === 200, 'Search by name returns HTTP 200');
    assert(searchRes.data?.data?.items?.some((s: any) => s.name.includes('Sushant')), 'Search finds matching staff');

    // 4.3 Filter by active status
    const activeRes = await request('GET', '/api/staff?isActive=true', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(activeRes.data?.data?.items?.every((s: any) => s.isActive === true), 'Filter isActive=true matches only active staff');

    // 4.4 Get Staff Profile by ID
    const profileRes = await request('GET', `/api/staff/${createdStaffId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(profileRes.status === 200, 'GET /api/staff/:id returns HTTP 200');
    assert(profileRes.data?.data?.id === createdStaffId, 'Profile contains correct staff ID');
    assert(profileRes.data?.data?.bankDetails?.accountNumber === '50100234567890', 'Full unmasked bank account returned in detailed profile');

    // -------------------------------------------------------------
    // 5. UPDATE & STATUS TESTS
    // -------------------------------------------------------------
    console.log('\n--- 5. Staff Update & Status Tests ---');

    // 5.1 Partial update personal details
    const updateRes = await request('PUT', `/api/staff/${createdStaffId}`, {
      personalDetails: {
        firstName: 'Sushant',
        lastName: 'Sharma', // changed last name
        mobile: '9998887776',
      },
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(updateRes.status === 200, 'Staff updated successfully (HTTP 200)');
    assert(updateRes.data?.data?.name === 'Sushant Sharma', 'Composite name updated automatically');
    assert(updateRes.data?.data?.personalDetails?.mobile === '9998887776', 'Mobile number updated');
    assert(updateRes.data?.data?.joiningDetails?.employeeNumber === 'EMP-001', 'Other sections preserved untouched');

    // 5.2 Status toggle (Deactivate)
    const deactivateRes = await request('PATCH', `/api/staff/${createdStaffId}/status`, {
      isActive: false,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(deactivateRes.status === 200, 'Staff deactivated successfully (HTTP 200)');
    assert(deactivateRes.data?.data?.isActive === false, 'Staff status is now false');

    // 5.3 Status toggle (Reactivate)
    const reactivateRes = await request('PATCH', `/api/staff/${createdStaffId}/status`, {
      isActive: true,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reactivateRes.status === 200, 'Staff reactivated successfully (HTTP 200)');
    assert(reactivateRes.data?.data?.isActive === true, 'Staff status is now true');

    // -------------------------------------------------------------
    // 6. AUTHORIZATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 6. Authentication & Authorization Protection ---');

    // 6.1 Unauthenticated request rejected
    const unauthRes = await request('GET', '/api/staff');
    assert(unauthRes.status === 401, 'Unauthenticated request returns HTTP 401 Unauthorized');

    // 6.2 Non-admin/staff token presentation is rejected by authenticateJwt
    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    receptionistToken = jwt.sign(
      { userId: recUser?.id, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    const recListRes = await request('GET', '/api/staff', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recListRes.status === 401, 'Non-admin token rejected by authenticateJwt (HTTP 401)');

    // 6.3 Non-admin without permissions rejected
    const recCreateRes = await request('POST', '/api/staff', validStaffPayload, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recCreateRes.status === 401, 'User without Admin privileges returns HTTP 401 Unauthorized');

    // 6.4 Non-admin without permissions rejected
    const recStatusRes = await request('PATCH', `/api/staff/${createdStaffId}/status`, {
      isActive: false,
    }, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recStatusRes.status === 401, 'User without Admin privileges returns HTTP 401 Unauthorized');

    // -------------------------------------------------------------
    // 7. DATABASE INTEGRITY & TRANSACTION ROLLBACK
    // -------------------------------------------------------------
    console.log('\n--- 7. Database Integrity & Transaction Rollback ---');

    const staffCountBefore = await prisma.staff.count();
    const personalDetailsCountBefore = await prisma.staffPersonalDetail.count();

    // Trigger failure by invalid shift ID inside weeklySchedule during creation
    const failingPayload = {
      ...validStaffPayload,
      joiningDetails: {
        ...validStaffPayload.joiningDetails,
        employeeNumber: 'EMP-FAIL-TEST',
      },
      weeklySchedule: [
        { dayOfWeek: 0, shiftId: '00000000-0000-0000-0000-000000000000', isWeeklyOff: false },
      ],
    };

    const failRes = await request('POST', '/api/staff', failingPayload, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(failRes.status === 400, 'Creation with invalid shift fails with HTTP 400');

    const staffCountAfter = await prisma.staff.count();
    const personalDetailsCountAfter = await prisma.staffPersonalDetail.count();

    assert(staffCountBefore === staffCountAfter, 'Transaction rolled back: no orphan staff record created');
    assert(personalDetailsCountBefore === personalDetailsCountAfter, 'Transaction rolled back: no orphan personal details created');

    // -------------------------------------------------------------
    // 8. STAFF CSV EXPORT
    // -------------------------------------------------------------
    console.log('\n--- 8. Staff CSV Export ---');

    // 8.1 Export all staff as CSV
    const csvRes = await request('GET', '/api/staff?export=csv', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(csvRes.status === 200, 'GET /api/staff?export=csv returns HTTP 200');
    assert(
      String(csvRes.headers.get('content-type')).includes('text/csv'),
      'Staff CSV Content-Type header includes text/csv'
    );
    assert(
      String(csvRes.headers.get('content-disposition')).includes('attachment; filename="staff-export-'),
      'Staff CSV Content-Disposition includes attachment and filename'
    );
    assert(
      csvRes.text.includes('Name,Employee Number,Designation,Mobile,Email,Gender,Status,Appointments Enabled,Joining Date,Created At'),
      'Staff CSV output contains expected headers'
    );
    assert(
      csvRes.text.includes('Sushant Praveen') || csvRes.text.includes('Sushant'),
      'Staff CSV output contains created staff member'
    );

    // 8.2 Filtered CSV export by search
    const csvSearchRes = await request('GET', '/api/staff?export=csv&search=Sushant', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(csvSearchRes.status === 200, 'GET /api/staff?export=csv with search query returns HTTP 200');

    // 8.3 Filtered CSV export by status
    const csvStatusRes = await request('GET', '/api/staff?export=csv&isActive=true', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(csvStatusRes.status === 200, 'GET /api/staff?export=csv with isActive=true returns HTTP 200');

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('\n========================================');
    console.log(`Staff Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
