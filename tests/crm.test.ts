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
let guestB: any;
let staffA: any;

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

export async function runCrmTests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE CRM & Guest 360 Management Module Test Suite');
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

    // Staff member for bookings and tasks
    staffA = await prisma.staff.findFirst({ where: { tenantId: tenantAId, isActive: true } });
    if (!staffA) {
      staffA = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'Piyush Stylist',
          isActive: true,
        },
      });
    }

    // -------------------------------------------------------------
    // 2. Add Guest (from CRM UI Add Guest modal)
    // -------------------------------------------------------------
    console.log('\n--- 2. Add Guest Modal Workflows ---');

    const uniqueMobileA = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const createGuestRes = await request('POST', '/api/crm/guests', {
      name: 'Prakash Sharma',
      mobile: uniqueMobileA,
      alternateMobile: '9910417057',
      email: 'prakash@example.com',
      gender: 'MALE',
      dateOfBirth: '1990-01-26',
      anniversary: '2020-08-11',
      gstNumber: '27AAAAA0000A1Z5',
      hairType: 'Straight Hair',
      store: 'kalyaninagar',
    }, adminAToken);

    assert(createGuestRes.status === 201, 'Add Guest returns 201 Created');
    guestA = createGuestRes.data?.data;
    assert(guestA?.name === 'Prakash Sharma', 'Guest name matches');
    assert(guestA?.mobile === uniqueMobileA, 'Guest mobile matches');
    assert(guestA?.hairType === 'Straight Hair', 'Guest hairType matches');

    // Quick lookup by mobile
    const lookupRes = await request('GET', `/api/crm/guests/lookup/${uniqueMobileA}`, undefined, adminAToken);
    assert(lookupRes.status === 200, 'Lookup by mobile returns 200 OK');
    assert(lookupRes.data?.data?.id === guestA.id, 'Lookup returns matching guest');

    // Create Tenant B Guest for isolation tests
    const uniqueMobileB = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const createGuestBRes = await request('POST', '/api/crm/guests', {
      name: 'Tenant B Guest',
      mobile: uniqueMobileB,
      gender: 'FEMALE',
    }, adminBToken);
    assert(createGuestBRes.status === 201, 'Tenant B Guest created returns 201');
    guestB = createGuestBRes.data?.data;

    // -------------------------------------------------------------
    // 3. CRM Table Listing & Filters (matching CRM.mp4 UI)
    // -------------------------------------------------------------
    console.log('\n--- 3. CRM Table Listing & Dynamic Filters ---');

    // Default listing
    const listRes = await request('GET', '/api/crm/guests/crm', undefined, adminAToken);
    assert(listRes.status === 200, 'CRM table listing returns 200 OK');
    assert(Array.isArray(listRes.data?.data?.items), 'Returns items array');
    const firstRow = listRes.data?.data?.items[0];
    assert(firstRow?.mobile !== undefined, 'Item has mobile column');
    assert(firstRow?.name !== undefined, 'Item has name column');
    assert(firstRow?.totalOrders !== undefined, 'Item has totalOrders column');
    assert(firstRow?.totalPurchaseAmount !== undefined, 'Item has totalPurchaseAmount column');
    assert(firstRow?.averagePurchaseAmount !== undefined, 'Item has averagePurchaseAmount column');
    assert(firstRow?.advance !== undefined, 'Item has advance column');
    assert(firstRow?.balance !== undefined, 'Item has balance column');
    assert(firstRow?.membershipCount !== undefined, 'Item has membershipCount column');
    assert(firstRow?.store !== undefined, 'Item has store column');

    // Filter by Hair Type
    const hairTypeFilter = await request('GET', '/api/crm/guests/crm', undefined, adminAToken, { hairType: 'Straight Hair' });
    assert(hairTypeFilter.status === 200, 'Filter by hairType returns 200 OK');
    assert(hairTypeFilter.data?.data?.items?.some((g: any) => g.id === guestA.id), 'Filter returns guest with Straight Hair');

    // Filter by Gender
    const genderFilter = await request('GET', '/api/crm/guests/crm', undefined, adminAToken, { gender: 'MALE' });
    assert(genderFilter.status === 200, 'Filter by gender returns 200 OK');
    assert(genderFilter.data?.data?.items?.every((g: any) => g.gender === 'MALE' || g.gender === 'Unspecified'), 'Gender filter verified');

    // Filter by Visit Type (New Guest)
    const newGuestFilter = await request('GET', '/api/crm/guests/crm', undefined, adminAToken, { visitType: 'NEW_GUEST' });
    assert(newGuestFilter.status === 200, 'Filter by visitType=NEW_GUEST returns 200 OK');

    // Search by name
    const searchRes = await request('GET', '/api/crm/guests/crm', undefined, adminAToken, { search: 'Prakash' });
    assert(searchRes.status === 200, 'Search by name returns 200 OK');
    assert(searchRes.data?.data?.items?.some((g: any) => g.id === guestA.id), 'Search returns target guest');

    // -------------------------------------------------------------
    // 4. Guest 360 Full Profile (All Sections)
    // -------------------------------------------------------------
    console.log('\n--- 4. Guest 360 Full Profile View ---');

    const g360Res = await request('GET', `/api/crm/guests/${guestA.id}/360`, undefined, adminAToken);
    assert(g360Res.status === 200, 'Guest 360 profile returns 200 OK');
    const profile = g360Res.data?.data;
    assert(profile?.profileInfo?.id === guestA.id, 'Profile Info ID matches');
    assert(Array.isArray(profile?.orders), 'Profile contains orders array');
    assert(Array.isArray(profile?.memberships), 'Profile contains memberships array');
    assert(Array.isArray(profile?.packages), 'Profile contains packages array');
    assert(profile?.wallet?.advanceBalance !== undefined, 'Profile contains wallet with advanceBalance');
    assert(Array.isArray(profile?.followUps), 'Profile contains followUps array');
    assert(Array.isArray(profile?.notes), 'Profile contains notes array');
    assert(Array.isArray(profile?.familyMembers), 'Profile contains familyMembers array');
    assert(Array.isArray(profile?.formSubmissions), 'Profile contains formSubmissions array');
    assert(Array.isArray(profile?.pastBookings), 'Profile contains pastBookings array');
    assert(Array.isArray(profile?.referrals), 'Profile contains referrals array');

    // -------------------------------------------------------------
    // 5. Add Membership from Guest 360 (matching frame_178, frame_195)
    // -------------------------------------------------------------
    console.log('\n--- 5. Add Membership Workflow ---');

    const addMemRes = await request('POST', `/api/crm/guests/${guestA.id}/memberships`, {
      name: 'Silver Membership',
      planFee: 5000,
      totalCredit: 6000, // Pay 5000 get 6000 (1000 benefit extra)
      validityDays: 365,
      membershipType: 'Fixed',
      staffId: staffA.id,
      payWith: {
        cash: 3000,
        balance: 2000, // Split payment: 3000 cash + 2000 due balance
      },
      notes: 'Festival discount membership bonus applied',
    }, adminAToken);

    assert(addMemRes.status === 201, 'Add Membership returns 201 Created');
    const memData = addMemRes.data?.data;
    assert(memData?.invoiceNumber?.startsWith('MEM/'), 'Invoice follows MEM/{N} numbering');
    assert(memData?.membershipCode?.startsWith('PR/'), 'Membership code follows PR/{N} numbering');
    assert(Number(memData?.totalCredit) === 6000, 'Total membership credit is 6000');
    assert(Number(memData?.remainingCredit) === 6000, 'Remaining membership credit is 6000');

    // Verify Guest due balance updated from split payment
    const refreshed360 = await request('GET', `/api/crm/guests/${guestA.id}/360`, undefined, adminAToken);
    assert(refreshed360.data?.data?.profileInfo?.dueBalance === 2000, 'Due balance updated to 2000 from split payment');
    assert(refreshed360.data?.data?.memberships?.length >= 1, 'Membership appears in Guest 360');

    // -------------------------------------------------------------
    // 6. Add Package from Guest 360
    // -------------------------------------------------------------
    console.log('\n--- 6. Add Package Workflow ---');

    const addPkgRes = await request('POST', `/api/crm/guests/${guestA.id}/packages`, {
      name: 'Bridal Glow 5 Sessions',
      price: 8500,
      validityDays: 180,
      totalSessions: 5,
      services: [
        { name: 'Fruit Clean Up', count: 3 },
        { name: 'Hair Spa', count: 2 },
      ],
    }, adminAToken);

    assert(addPkgRes.status === 201, 'Add Package returns 201 Created');
    assert(addPkgRes.data?.data?.totalSessions === 5, 'Package has 5 total sessions');
    assert(addPkgRes.data?.data?.remainingSessions === 5, 'Package has 5 remaining sessions');

    // -------------------------------------------------------------
    // 7. Wallet (Advance Deposit & Due Balance Settlement)
    // -------------------------------------------------------------
    console.log('\n--- 7. Advance Wallet & Due Balance Settlements ---');

    // Deposit Advance
    const depositRes = await request('POST', `/api/crm/guests/${guestA.id}/wallet`, {
      type: 'ADVANCE_DEPOSIT',
      amount: 1500,
      paymentMethod: 'GPay',
      notes: 'Advance deposit for upcoming bridal package',
    }, adminAToken);

    assert(depositRes.status === 201, 'Advance deposit returns 201 Created');
    assert(Number(depositRes.data?.data?.runningBalance) === 1500, 'Advance running balance is 1500');

    // Settle Due Balance
    const settleDueRes = await request('POST', `/api/crm/guests/${guestA.id}/wallet`, {
      type: 'DUE_BALANCE_PAID',
      amount: 1000, // Settle 1000 out of 2000 due
      paymentMethod: 'Cash',
      notes: 'Partial due balance settlement',
    }, adminAToken);

    assert(settleDueRes.status === 201, 'Due balance payment returns 201 Created');
    assert(Number(settleDueRes.data?.data?.runningBalance) === 1000, 'Remaining due balance is 1000');

    // -------------------------------------------------------------
    // 8. Follow-up Tasks (Reminders / Calls)
    // -------------------------------------------------------------
    console.log('\n--- 8. CRM Follow-up Tasks ---');

    const dueDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    const followUpRes = await request('POST', `/api/crm/guests/${guestA.id}/follow-ups`, {
      title: 'Post-treatment hair care check-in',
      description: 'Call guest to enquire about serum reaction',
      dueDate,
      staffId: staffA.id,
      status: 'PENDING',
    }, adminAToken);

    assert(followUpRes.status === 201, 'Create follow-up returns 201 Created');
    const followUp = followUpRes.data?.data;
    assert(followUp?.status === 'PENDING', 'Initial status is PENDING');

    // Complete follow-up
    const completeFollowUpRes = await request('PUT', `/api/crm/guests/${guestA.id}/follow-ups/${followUp.id}`, {
      status: 'COMPLETED',
      notes: 'Customer confirmed satisfied with treatment and product',
    }, adminAToken);

    assert(completeFollowUpRes.status === 200, 'Complete follow-up returns 200 OK');
    assert(completeFollowUpRes.data?.data?.status === 'COMPLETED', 'Status transitioned to COMPLETED');

    // -------------------------------------------------------------
    // 9. Notes & Preferences
    // -------------------------------------------------------------
    console.log('\n--- 9. Notes & Preferences ---');

    const addNoteRes = await request('POST', `/api/crm/guests/${guestA.id}/notes`, {
      note: 'Allergic to ammonia-based dyes; strictly use organic color',
      tag: 'ALLERGY',
    }, adminAToken);

    assert(addNoteRes.status === 201, 'Add note returns 201 Created');
    const note = addNoteRes.data?.data;
    assert(note?.tag === 'ALLERGY', 'Note tag matches');

    // Delete note
    const deleteNoteRes = await request('DELETE', `/api/crm/guests/${guestA.id}/notes/${note.id}`, undefined, adminAToken);
    assert(deleteNoteRes.status === 200, 'Delete note returns 200 OK');

    // -------------------------------------------------------------
    // 10. Family Members
    // -------------------------------------------------------------
    console.log('\n--- 10. Family Members Linking ---');

    const addFamRes = await request('POST', `/api/crm/guests/${guestA.id}/family`, {
      name: 'Sunita Sharma',
      relationship: 'SPOUSE',
      mobile: '9822019999',
      gender: 'FEMALE',
    }, adminAToken);

    assert(addFamRes.status === 201, 'Add family member returns 201 Created');
    const fam = addFamRes.data?.data;
    assert(fam?.relationship === 'SPOUSE', 'Relationship matches SPOUSE');

    // Delete family member
    const delFamRes = await request('DELETE', `/api/crm/guests/${guestA.id}/family/${fam.id}`, undefined, adminAToken);
    assert(delFamRes.status === 200, 'Delete family member returns 200 OK');

    // -------------------------------------------------------------
    // 11. Custom Consultation Form Submission
    // -------------------------------------------------------------
    console.log('\n--- 11. Custom Consultation Forms ---');

    const formSubmitRes = await request('POST', `/api/crm/guests/${guestA.id}/forms`, {
      formName: 'Hair & Scalp Consultation Form',
      responses: {
        scalpType: 'Oily',
        dandruffPresent: false,
        recommendedShampoo: 'Loreal Serie Expert Pure Resource',
      },
    }, adminAToken);

    assert(formSubmitRes.status === 201, 'Submit consultation form returns 201 Created');
    assert(formSubmitRes.data?.data?.formName === 'Hair & Scalp Consultation Form', 'Form name matches');

    // -------------------------------------------------------------
    // 12. Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- 12. Tenant Isolation ---');

    // Tenant B cannot view Tenant A guest 360
    const tenantBAccessRes = await request('GET', `/api/crm/guests/${guestA.id}/360`, undefined, adminBToken);
    assert(tenantBAccessRes.status === 404, 'Tenant B cannot view Tenant A Guest 360 (returns 404)');

    // Tenant B cannot add membership to Tenant A guest
    const tenantBMemRes = await request('POST', `/api/crm/guests/${guestA.id}/memberships`, {
      name: 'Malicious Membership',
      planFee: 1000,
      totalCredit: 1000,
      validityDays: 30,
    }, adminBToken);
    assert(tenantBMemRes.status === 404, 'Tenant B cannot add membership to Tenant A guest (returns 404)');

    // -------------------------------------------------------------
    // 13. CRM Export as CSV / XLSX
    // -------------------------------------------------------------
    console.log('\n--- 13. CRM Export as CSV / XLSX ---');

    const exportRes1 = await request('GET', '/api/crm/guests/export', undefined, adminAToken);
    assert(exportRes1.status === 200, 'GET /api/crm/guests/export returns 200 OK');
    assert(exportRes1.headers.get('content-type')?.includes('text/csv') || false, 'Export response Content-Type is text/csv');
    assert(exportRes1.text.includes('Mobile No.') && exportRes1.text.includes('Name'), 'Export CSV contains CRM table headers');

    const exportRes2 = await request('GET', '/api/crm/export', undefined, adminAToken);
    assert(exportRes2.status === 200, 'GET /api/crm/export alias returns 200 OK');
    assert(exportRes2.text.includes('Total Orders'), 'Export alias contains Total Orders header');

    // -------------------------------------------------------------
    // 14. Add Guest with Empty Optional Fields (UI Modal Behavior)
    // -------------------------------------------------------------
    console.log('\n--- 14. Add Guest with Empty Optional Fields ---');

    const addGuestModalRes = await request('POST', '/api/crm/guests', {
      name: 'Modal Test Guest',
      mobile: '9888877777',
      alternateMobile: '',
      email: '',
      dateOfBirth: '',
      anniversary: '',
      gstNumber: '',
      gender: 'MALE',
      hairType: 'Curly Hair',
    }, adminAToken);

    assert(addGuestModalRes.status === 201, 'Create guest with empty optional strings returns 201 Created');
    const createdModalGuestId = addGuestModalRes.data?.data?.id;

    // -------------------------------------------------------------
    // 15. Direct /api/crm Route Aliases
    // -------------------------------------------------------------
    console.log('\n--- 15. Direct /api/crm Route Aliases ---');

    const crmDirectRes = await request('GET', '/api/crm', undefined, adminAToken);
    assert(crmDirectRes.status === 200, 'GET /api/crm alias returns 200 OK');
    assert(Array.isArray(crmDirectRes.data?.data?.items), 'GET /api/crm returns items array');

    // -------------------------------------------------------------
    // 16. Multi-Select Bulk Delete (UI Delete Confirmation Flow)
    // -------------------------------------------------------------
    console.log('\n--- 16. Multi-Select Bulk Delete ---');

    // Create 2 temporary guests for bulk deletion
    const tempGuest1 = await request('POST', '/api/crm/guests', {
      name: 'Bulk Delete Target 1',
      mobile: '9900011111',
    }, adminAToken);
    const tempGuest2 = await request('POST', '/api/crm/guests', {
      name: 'Bulk Delete Target 2',
      mobile: '9900022222',
    }, adminAToken);

    assert(tempGuest1.status === 201 && tempGuest2.status === 201, 'Created temporary guests for bulk delete test');

    const id1 = tempGuest1.data?.data?.id;
    const id2 = tempGuest2.data?.data?.id;

    // Call Bulk Delete via /api/crm/guests/bulk
    const bulkDelRes = await request('DELETE', '/api/crm/guests/bulk', {
      ids: [id1, id2, createdModalGuestId],
    }, adminAToken);

    assert(bulkDelRes.status === 200, 'DELETE /api/crm/guests/bulk returns 200 OK');
    assert(bulkDelRes.data?.message === 'Guests deleted successfully', 'Message matches exact UI toast: "Guests deleted successfully"');
    assert(bulkDelRes.data?.data?.deletedCount === 3, 'All 3 selected guests successfully deleted');

    // Verify they are no longer accessible
    const checkDeletedRes = await request('GET', `/api/crm/guests/${id1}`, undefined, adminAToken);
    assert(checkDeletedRes.status === 404, 'Deleted guest is no longer found (returns 404)');

  } catch (error: any) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  console.log('\n================================================================');
  console.log(`   CRM Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('crm.test.ts')) {
  runCrmTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
