import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let receptionistToken: string;
let categoryId1: string;
let categoryId2: string;
let staffId1: string;
let staffId2: string;
let staffId3: string;
let inactiveStaffId: string;
let createdServiceId: string;

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
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log('\n========================================');
  console.log('       QUBEXE SALOON SOFTWARE Services Test Suite      ');
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
    // 1. SETUP & AUTHENTICATION
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

    // Clean up any existing test services and test categories
    await prisma.service.deleteMany({
      where: {
        name: {
          in: [
            'Hair Spa Loreal',
            'Minimal Service',
            'Cross Cat Service',
            'Staff Sync Service',
            'Rollback Service',
            'Delete Service Test',
            'Duplicate Name Service',
            'Inactive Staff Service',
            'Hair Cut & Style',
            'Hair Color Inoa',
          ],
        },
      },
    });

    // Ensure prerequisite test categories exist
    const cat1 = await prisma.serviceCategory.upsert({
      where: {
        tenantId_name: {
          tenantId: '11111111-1111-1111-1111-111111111111',
          name: 'Hair Services Cat',
        },
      },
      update: {},
      create: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Hair Services Cat',
        group: 'Both',
        position: 1,
        isActive: true,
      },
    });
    categoryId1 = cat1.id;

    const cat2 = await prisma.serviceCategory.upsert({
      where: {
        tenantId_name: {
          tenantId: '11111111-1111-1111-1111-111111111111',
          name: 'Skin Services Cat',
        },
      },
      update: {},
      create: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Skin Services Cat',
        group: 'Female',
        position: 2,
        isActive: true,
      },
    });
    categoryId2 = cat2.id;
    assert(!!categoryId1 && !!categoryId2, 'Prerequisite categories ready for testing');

    // Ensure prerequisite test staff exist
    const des = await prisma.designation.findFirst({ where: { tenantId: '11111111-1111-1111-1111-111111111111' } });
    const desId = des?.id || (await prisma.designation.create({ data: { tenantId: '11111111-1111-1111-1111-111111111111', name: 'Test Stylist Desig' } })).id;

    const s1 = await prisma.staff.upsert({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      update: {},
      create: {
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Stylist Alpha',
        isActive: true,
        personalDetails: { create: { firstName: 'Stylist', lastName: 'Alpha', mobile: '9900000001' } },
        joiningDetails: { create: { joiningDate: new Date(), designationId: desId, employeeNumber: 'TEST-EMP-A', workingHours: '8' } },
      },
    });
    staffId1 = s1.id;

    const s2 = await prisma.staff.upsert({
      where: { id: '22222222-2222-2222-2222-222222222222' },
      update: {},
      create: {
        id: '22222222-2222-2222-2222-222222222222',
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Stylist Beta',
        isActive: true,
        personalDetails: { create: { firstName: 'Stylist', lastName: 'Beta', mobile: '9900000002' } },
        joiningDetails: { create: { joiningDate: new Date(), designationId: desId, employeeNumber: 'TEST-EMP-B', workingHours: '8' } },
      },
    });
    staffId2 = s2.id;

    const s3 = await prisma.staff.upsert({
      where: { id: '33333333-3333-3333-3333-333333333333' },
      update: {},
      create: {
        id: '33333333-3333-3333-3333-333333333333',
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Stylist Gamma',
        isActive: true,
        personalDetails: { create: { firstName: 'Stylist', lastName: 'Gamma', mobile: '9900000003' } },
        joiningDetails: { create: { joiningDate: new Date(), designationId: desId, employeeNumber: 'TEST-EMP-C', workingHours: '8' } },
      },
    });
    staffId3 = s3.id;

    const sInactive = await prisma.staff.upsert({
      where: { id: '44444444-4444-4444-4444-444444444444' },
      update: {},
      create: {
        id: '44444444-4444-4444-4444-444444444444',
        tenantId: '11111111-1111-1111-1111-111111111111',
        name: 'Stylist Inactive',
        isActive: false,
        personalDetails: { create: { firstName: 'Stylist', lastName: 'Inactive', mobile: '9900000004' } },
        joiningDetails: { create: { joiningDate: new Date(), designationId: desId, employeeNumber: 'TEST-EMP-INACT', workingHours: '8' } },
      },
    });
    inactiveStaffId = sInactive.id;

    assert(!!staffId1 && !!staffId2 && !!staffId3 && !!inactiveStaffId, 'Prerequisite staff records ready for testing');

    // -------------------------------------------------------------
    // 2. CREATION TESTS (ALL DEMONSTRATED FRONTEND FIELDS)
    // -------------------------------------------------------------
    console.log('\n--- 2. Service Creation Tests ---');

    // 2.1 Create with all demonstrated frontend fields
    const fullPayload = {
      name: 'Hair Spa Loreal',
      categoryId: categoryId1,
      position: 1,
      isActive: true,
      hour: 1,
      minute: 15,
      serviceReminderDays: 30,
      sacCode: '999721',
      serviceTag: 'HairSpa',
      group: 'Male',
      hideFromCatalogue: false,
      price: 800,
      salePrice: 750,
      isNonDiscountable: false,
      description: 'Loreal professional hair spa treatment for deep conditioning',
      imageUrl: 'https://respark.local/services/hair-spa-loreal.jpg',
      staff: [
        { staffId: staffId1, isRecommended: true },
        { staffId: staffId2, isRecommended: false },
      ],
      resourceIds: ['Room 1', 'Room 2'],
      consumables: [
        { name: 'Loreal Spa Cream', quantity: 50, unit: 'ml' },
        { name: 'Hair Serum', quantity: 5, unit: 'ml' },
      ],
    };

    const createRes = await request('POST', '/api/services', fullPayload, {
      Authorization: `Bearer ${adminToken}`,
    });

    assert(createRes.status === 201, 'Create valid service returns HTTP 201');
    assert(createRes.data?.success === true, 'Response indicates success');
    assert(createRes.data?.data?.name === 'Hair Spa Loreal', 'Service name matches');
    assert(createRes.data?.data?.categoryId === categoryId1, 'Category ID matches');
    assert(createRes.data?.data?.durationMinutes === 75, 'Duration calculated correctly (1h 15m = 75m)');
    assert(Number(createRes.data?.data?.price) === 800, 'Price saved as 800');
    assert(Number(createRes.data?.data?.salePrice) === 750, 'Sale price saved as 750');
    assert(createRes.data?.data?.group === 'Male', 'Group saved as Male');
    assert(createRes.data?.data?.serviceStaff?.length === 2, '2 staff mapped');
    assert(createRes.data?.data?.serviceStaff?.find((s: any) => s.staffId === staffId1)?.isRecommended === true, 'Staff 1 marked recommended');
    assert(createRes.data?.data?.consumables?.length === 2, 'Consumables saved as JSON');
    assert(createRes.data?.data?.resourceIds?.length === 2, 'Resource IDs saved as JSON');

    createdServiceId = createRes.data?.data?.id;

    // 2.2 Create with minimum required fields
    const minimalPayload = {
      name: 'Minimal Service',
      categoryId: categoryId1,
      price: 200,
    };
    const minRes = await request('POST', '/api/services', minimalPayload, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(minRes.status === 201, 'Create with minimum required fields succeeds (HTTP 201)');
    assert(minRes.data?.data?.position === 0, 'Default position is 0');
    assert(minRes.data?.data?.isActive === true, 'Default isActive is true');
    assert(minRes.data?.data?.group === 'Both', 'Default group inherits from category or defaults to Both');
    assert(minRes.data?.data?.serviceStaff?.length === 0, 'Default staff mappings is empty');

    // 2.3 Validation: Missing service name
    const noName = await request('POST', '/api/services', { categoryId: categoryId1, price: 100 }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(noName.status === 400, 'Missing service name returns HTTP 400');

    // 2.4 Validation: Empty service name
    const emptyName = await request('POST', '/api/services', { name: '', categoryId: categoryId1, price: 100 }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(emptyName.status === 400, 'Empty service name returns HTTP 400');

    // 2.5 Validation: Whitespace-only service name
    const wsName = await request('POST', '/api/services', { name: '   ', categoryId: categoryId1, price: 100 }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(wsName.status === 400, 'Whitespace service name returns HTTP 400');

    // 2.6 Validation: Invalid category UUID
    const badUuidCat = await request('POST', '/api/services', { name: 'Bad Cat', categoryId: 'not-a-uuid', price: 100 }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(badUuidCat.status === 400, 'Invalid category UUID returns HTTP 400');

    // 2.7 Validation: Non-existent category ID
    const nonExistentCat = await request('POST', '/api/services', {
      name: 'Non Existent Cat',
      categoryId: '00000000-0000-0000-0000-000000000000',
      price: 100,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(nonExistentCat.status === 400, 'Non-existent category returns HTTP 400');

    // 2.8 Validation: Negative price
    const negPrice = await request('POST', '/api/services', { name: 'Neg Price', categoryId: categoryId1, price: -50 }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(negPrice.status === 400, 'Negative price returns HTTP 400');

    // 2.9 Validation: Negative duration
    const negDuration = await request('POST', '/api/services', {
      name: 'Neg Duration',
      categoryId: categoryId1,
      price: 100,
      hour: -1,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(negDuration.status === 400, 'Negative hour/duration returns HTTP 400');

    // 2.10 Validation: Negative position
    const negPos = await request('POST', '/api/services', {
      name: 'Neg Pos',
      categoryId: categoryId1,
      price: 100,
      position: -1,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(negPos.status === 400, 'Negative position returns HTTP 400');

    // 2.11 Validation: Invalid group enum
    const badGroup = await request('POST', '/api/services', {
      name: 'Bad Group',
      categoryId: categoryId1,
      price: 100,
      group: 'InvalidGroup' as any,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(badGroup.status === 400, 'Invalid group enum returns HTTP 400');

    // 2.12 Validation: Oversized base64 image (> 100 KB)
    const largeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(150 * 1024);
    const oversizedImg = await request('POST', '/api/services', {
      name: 'Oversized Img',
      categoryId: categoryId1,
      price: 100,
      imageUrl: largeBase64,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(oversizedImg.status === 400, 'Base64 image > 100 KB rejected with HTTP 400');

    // 2.13 Validation: Long URL string does NOT get confused with image file size
    const longUrl = 'https://respark.local/assets/images/' + 'a'.repeat(200) + '.png';
    const validUrlRes = await request('POST', '/api/services', {
      name: 'Valid URL Service',
      categoryId: categoryId1,
      price: 100,
      imageUrl: longUrl,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(validUrlRes.status === 201, 'Long image URL (not base64) is accepted without byte size rejection');
    // clean it up
    await prisma.service.delete({ where: { id: validUrlRes.data?.data?.id } });

    // 2.14 Duplicate service name within same category -> 409
    const dupRes = await request('POST', '/api/services', {
      name: 'Hair Spa Loreal',
      categoryId: categoryId1,
      price: 900,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(dupRes.status === 409, 'Duplicate service name within category rejected with HTTP 409 Conflict');

    // 2.15 Same service name in different category -> allowed
    const crossCatRes = await request('POST', '/api/services', {
      name: 'Hair Spa Loreal',
      categoryId: categoryId2,
      price: 900,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(crossCatRes.status === 201, 'Same service name in different category is allowed (HTTP 201)');
    await prisma.service.delete({ where: { id: crossCatRes.data?.data?.id } });

    // 2.16 Staff mapping: Non-existent staff ID -> 400
    const nonExistentStaffRes = await request('POST', '/api/services', {
      name: 'Non Existent Staff Service',
      categoryId: categoryId1,
      price: 100,
      staffIds: ['00000000-0000-0000-0000-000000000000'],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(nonExistentStaffRes.status === 400, 'Non-existent staff ID rejected with HTTP 400');

    // 2.17 Staff mapping: Duplicate staff ID in payload -> 400
    const dupStaffRes = await request('POST', '/api/services', {
      name: 'Dup Staff Service',
      categoryId: categoryId1,
      price: 100,
      staffIds: [staffId1, staffId1],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(dupStaffRes.status === 400, 'Duplicate staff IDs in payload rejected with HTTP 400');

    // 2.18 Staff mapping: Inactive staff can be mapped without error
    const inactStaffRes = await request('POST', '/api/services', {
      name: 'Inactive Staff Service',
      categoryId: categoryId1,
      price: 100,
      staffIds: [inactiveStaffId],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(inactStaffRes.status === 201, 'Inactive staff can be mapped successfully (HTTP 201)');
    await prisma.service.delete({ where: { id: inactStaffRes.data?.data?.id } });

    // 2.19 Database Atomicity: Transaction rollback on failure proves 0 orphan records
    const serviceCountBefore = await prisma.service.count();
    const serviceStaffCountBefore = await prisma.serviceStaff.count();

    const rollbackRes = await request('POST', '/api/services', {
      name: 'Rollback Service',
      categoryId: categoryId1,
      price: 100,
      staffIds: ['00000000-0000-0000-0000-000000000000'], // will fail validation
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rollbackRes.status === 400, 'Failing payload rejected');

    const serviceCountAfter = await prisma.service.count();
    const serviceStaffCountAfter = await prisma.serviceStaff.count();

    assert(serviceCountBefore === serviceCountAfter, 'Transaction rolled back: services count unchanged');
    assert(serviceStaffCountBefore === serviceStaffCountAfter, 'Transaction rolled back: service_staff count unchanged');

    const orphanCheck = await prisma.service.findFirst({ where: { name: 'Rollback Service' } });
    assert(orphanCheck === null, 'No orphan service record exists in database');

    // -------------------------------------------------------------
    // 3. MAPPING SYNCHRONIZATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- 3. Staff Mapping Synchronization Tests ---');

    // Create service with Staff [A, B]
    const syncCreateRes = await request('POST', '/api/services', {
      name: 'Staff Sync Service',
      categoryId: categoryId1,
      price: 500,
      staff: [
        { staffId: staffId1, isRecommended: true },
        { staffId: staffId2, isRecommended: false },
      ],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const syncServiceId = syncCreateRes.data?.data?.id;
    assert(syncCreateRes.status === 201, 'Sync test service created with Staff [A, B]');

    // 3.1 Verify initial mappings in DB
    let dbMappings = await prisma.serviceStaff.findMany({
      where: { serviceId: syncServiceId },
      orderBy: { staffId: 'asc' },
    });
    assert(dbMappings.length === 2, 'DB has exactly 2 mapped staff');
    assert(dbMappings.some((m) => m.staffId === staffId1 && m.isRecommended === true), 'Staff A is mapped and recommended');
    assert(dbMappings.some((m) => m.staffId === staffId2 && m.isRecommended === false), 'Staff B is mapped');

    // 3.2 Update mapping: Replace Staff [A, B] with [A, C]
    const syncUpdateRes = await request('PUT', `/api/services/${syncServiceId}`, {
      staff: [
        { staffId: staffId1, isRecommended: false },
        { staffId: staffId3, isRecommended: true },
      ],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(syncUpdateRes.status === 200, 'Update staff mapping to [A, C] succeeds');

    dbMappings = await prisma.serviceStaff.findMany({
      where: { serviceId: syncServiceId },
      orderBy: { staffId: 'asc' },
    });
    assert(dbMappings.length === 2, 'DB has exactly 2 mapped staff after replacement');
    assert(!dbMappings.some((m) => m.staffId === staffId2), 'Staff B was removed from mapping');
    assert(dbMappings.some((m) => m.staffId === staffId3 && m.isRecommended === true), 'Staff C is newly mapped');
    assert(dbMappings.some((m) => m.staffId === staffId1 && m.isRecommended === false), 'Staff A updated to not recommended');

    // 3.3 Clear mapping: Update with empty array []
    const clearRes = await request('PUT', `/api/services/${syncServiceId}`, {
      staff: [],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(clearRes.status === 200, 'Clearing staff mappings succeeds');
    const clearedDbMappings = await prisma.serviceStaff.findMany({ where: { serviceId: syncServiceId } });
    assert(clearedDbMappings.length === 0, 'DB has 0 mapped staff after clearing');

    // 3.4 Repeated update with same mapping does not create duplicate rows
    await request('PUT', `/api/services/${syncServiceId}`, {
      staffIds: [staffId1],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    await request('PUT', `/api/services/${syncServiceId}`, {
      staffIds: [staffId1],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const singleDbMapping = await prisma.serviceStaff.findMany({ where: { serviceId: syncServiceId } });
    assert(singleDbMapping.length === 1, 'Repeated update maintains exactly 1 mapped row without duplicate');

    // Clean up sync test service
    await prisma.service.delete({ where: { id: syncServiceId } });

    // -------------------------------------------------------------
    // 4. RETRIEVAL TESTS
    // -------------------------------------------------------------
    console.log('\n--- 4. Service Retrieval Tests ---');

    // 4.1 Get all Services
    const listRes = await request('GET', '/api/services', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listRes.status === 200, 'GET /api/services returns HTTP 200');
    assert(Array.isArray(listRes.data?.data), 'Services list is an array');

    // 4.2 Created service appears in list
    assert(listRes.data?.data?.some((s: any) => s.id === createdServiceId), 'Created service appears in list');

    // 4.3 Search by service name
    const searchRes = await request('GET', '/api/services?search=Loreal', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchRes.data?.data?.length > 0, 'Search by service name returns matching records');
    assert(searchRes.data?.data?.every((s: any) => s.name.toLowerCase().includes('loreal')), 'All search results match query');

    // 4.4 Category filter
    const catFilterRes = await request('GET', `/api/services?categoryId=${categoryId1}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(catFilterRes.data?.data?.every((s: any) => s.categoryId === categoryId1), 'Category filter returns only matching category records');

    // 4.5 Group filter
    const groupFilterRes = await request('GET', '/api/services?group=Male', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(groupFilterRes.data?.data?.every((s: any) => s.group === 'Male'), 'Group filter returns only matching records');

    // 4.6 Active status filter
    const activeFilterRes = await request('GET', '/api/services?isActive=true', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(activeFilterRes.data?.data?.every((s: any) => s.isActive === true), 'isActive=true filter returns only active services');

    // 4.7 Position ordering
    const sortedRes = await request('GET', '/api/services', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    const positions = sortedRes.data?.data?.map((s: any) => s.position);
    const isSorted = positions.every((v: number, i: number, arr: number[]) => i === 0 || arr[i - 1] <= v);
    assert(isSorted, 'Services are ordered by position ascending');

    // 4.8 Get service by ID
    const getByIdRes = await request('GET', `/api/services/${createdServiceId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getByIdRes.status === 200, 'GET /api/services/:id returns HTTP 200');
    assert(getByIdRes.data?.data?.id === createdServiceId, 'Correct service returned');
    assert(getByIdRes.data?.data?.category?.id === categoryId1, 'Category object populated');
    assert(getByIdRes.data?.data?.serviceStaff?.length === 2, 'Staff mappings populated');
    assert(getByIdRes.data?.data?.consumables?.length === 2, 'Consumables JSON populated');
    assert(getByIdRes.data?.data?.resourceIds?.length === 2, 'Resource IDs JSON populated');

    // 4.9 Non-existent ID returns 404
    const notFoundRes = await request('GET', '/api/services/00000000-0000-0000-0000-000000000000', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(notFoundRes.status === 404, 'Non-existent service ID returns HTTP 404 Not Found');

    // 4.10 Malformed UUID returns 404/400
    const malformedIdRes = await request('GET', '/api/services/not-a-uuid', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(malformedIdRes.status === 404, 'Malformed UUID returns HTTP 404');

    // -------------------------------------------------------------
    // 5. UPDATE TESTS
    // -------------------------------------------------------------
    console.log('\n--- 5. Service Update Tests ---');

    // 5.1 Update multiple fields
    const updateRes = await request('PUT', `/api/services/${createdServiceId}`, {
      name: 'Hair Spa Loreal Professional',
      price: 950,
      salePrice: 900,
      hour: 1,
      minute: 30, // 90 min
      position: 5,
      isNonDiscountable: true,
      serviceReminderDays: 45,
      description: 'Updated treatment description',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(updateRes.status === 200, 'Service updated successfully (HTTP 200)');
    assert(updateRes.data?.data?.name === 'Hair Spa Loreal Professional', 'Name updated');
    assert(Number(updateRes.data?.data?.price) === 950, 'Price updated to 950');
    assert(Number(updateRes.data?.data?.salePrice) === 900, 'Sale price updated to 900');
    assert(updateRes.data?.data?.durationMinutes === 90, 'Duration recomputed to 90m');
    assert(updateRes.data?.data?.position === 5, 'Position updated to 5');
    assert(updateRes.data?.data?.isNonDiscountable === true, 'isNonDiscountable updated to true');

    // 5.2 Partial update: omitted fields remain unchanged
    const partialUpdateRes = await request('PUT', `/api/services/${createdServiceId}`, {
      serviceTag: 'LuxurySpa',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(partialUpdateRes.status === 200, 'Partial update returns HTTP 200');
    assert(partialUpdateRes.data?.data?.serviceTag === 'LuxurySpa', 'Service tag updated');
    assert(Number(partialUpdateRes.data?.data?.price) === 950, 'Price remained unchanged at 950');
    assert(partialUpdateRes.data?.data?.name === 'Hair Spa Loreal Professional', 'Name remained unchanged');

    // 5.3 Duplicate name on update (conflict within same category)
    const dupUpdateRes = await request('PUT', `/api/services/${createdServiceId}`, {
      name: 'Minimal Service', // already taken in categoryId1
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(dupUpdateRes.status === 409, 'Updating to existing service name returns HTTP 409 Conflict');

    // 5.4 Update with non-existent category
    const badCatUpdateRes = await request('PUT', `/api/services/${createdServiceId}`, {
      categoryId: '00000000-0000-0000-0000-000000000000',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(badCatUpdateRes.status === 400, 'Updating with non-existent category returns HTTP 400');

    // 5.5 Update non-existent service returns 404
    const notFoundUpdate = await request('PUT', '/api/services/00000000-0000-0000-0000-000000000000', {
      name: 'Ghost Service',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(notFoundUpdate.status === 404, 'Updating non-existent service returns HTTP 404');

    // -------------------------------------------------------------
    // 6. STATUS TESTS
    // -------------------------------------------------------------
    console.log('\n--- 6. Service Status Tests ---');

    // 6.1 Deactivate service
    const deactRes = await request('PATCH', `/api/services/${createdServiceId}/status`, {
      isActive: false,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(deactRes.status === 200, 'Service deactivated successfully (HTTP 200)');
    assert(deactRes.data?.data?.isActive === false, 'isActive is now false in response');
    const deactDb = await prisma.service.findUnique({ where: { id: createdServiceId } });
    assert(deactDb?.isActive === false, 'Database confirms isActive is false');

    // 6.2 Reactivate service
    const reactRes = await request('PATCH', `/api/services/${createdServiceId}/status`, {
      isActive: true,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reactRes.status === 200, 'Service reactivated successfully (HTTP 200)');
    assert(reactRes.data?.data?.isActive === true, 'isActive is now true in response');
    const reactDb = await prisma.service.findUnique({ where: { id: createdServiceId } });
    assert(reactDb?.isActive === true, 'Database confirms isActive is true');

    // 6.3 Already active idempotent update
    const idempotentRes = await request('PATCH', `/api/services/${createdServiceId}/status`, {
      isActive: true,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(idempotentRes.status === 200, 'Idempotent active status update returns HTTP 200');

    // 6.4 Status toggle for non-existent service returns 404
    const notFoundStatus = await request('PATCH', '/api/services/00000000-0000-0000-0000-000000000000/status', {
      isActive: false,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(notFoundStatus.status === 404, 'Status toggle for non-existent service returns HTTP 404');

    // -------------------------------------------------------------
    // 7. DELETION & INTEGRITY TESTS
    // -------------------------------------------------------------
    console.log('\n--- 7. Service Deletion & Integrity Tests ---');

    const toDeleteRes = await request('POST', '/api/services', {
      name: 'Delete Service Test',
      categoryId: categoryId1,
      price: 300,
      staffIds: [staffId1],
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    const toDeleteId = toDeleteRes.data?.data?.id;

    // 7.1 Delete existing service
    const deleteRes = await request('DELETE', `/api/services/${toDeleteId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(deleteRes.status === 200, 'Service deleted successfully (HTTP 200)');

    // 7.2 Deleted service is no longer found
    const verifyDel = await request('GET', `/api/services/${toDeleteId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(verifyDel.status === 404, 'Deleted service returns HTTP 404');

    // 7.3 Mappings cleaned up (cascade)
    const orphanMappings = await prisma.serviceStaff.findMany({ where: { serviceId: toDeleteId } });
    assert(orphanMappings.length === 0, 'Cascade delete removed all associated service_staff mappings');

    // 7.4 Staff record itself remains intact (Restrict on staff deletion)
    const staffStillExists = await prisma.staff.findUnique({ where: { id: staffId1 } });
    assert(staffStillExists !== null, 'Mapped staff record was NOT deleted and remains intact');

    // 7.5 Repeated deletion returns 404
    const repeatDel = await request('DELETE', `/api/services/${toDeleteId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repeatDel.status === 404, 'Repeated deletion returns HTTP 404');

    // -------------------------------------------------------------
    // 8. AUTHENTICATION & RBAC TESTS
    // -------------------------------------------------------------
    console.log('\n--- 8. Authentication & RBAC Tests ---');

    // 8.1 Missing token
    const unauthRes = await request('GET', '/api/services');
    assert(unauthRes.status === 401, 'Unauthenticated request returns HTTP 401');

    // 8.2 Invalid token
    const badTokenRes = await request('GET', '/api/services', undefined, {
      Authorization: 'Bearer invalid-token-12345',
    });
    assert(badTokenRes.status === 401, 'Invalid token returns HTTP 401');

    // 8.3 Non-admin token presentation rejected by authenticateJwt
    const recUser = await prisma.user.findUnique({ where: { username: 'receptionist' } });
    receptionistToken = jwt.sign(
      { userId: recUser?.id, username: 'receptionist', role: 'RECEPTIONIST' },
      config.jwt.secret
    );
    const recListRes = await request('GET', '/api/services', undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recListRes.status === 401, 'Non-admin token rejected by authenticateJwt (HTTP 401)');

    // 8.4 Non-admin without permissions cannot get service by ID
    const recGetRes = await request('GET', `/api/services/${createdServiceId}`, undefined, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recGetRes.status === 401, 'Non-admin token rejected by authenticateJwt (HTTP 401)');

    // 8.5 Receptionist without Admin privileges cannot create service
    const recCreateRes = await request('POST', '/api/services', {
      name: 'Forbidden Service',
      categoryId: categoryId1,
      price: 100,
    }, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recCreateRes.status === 401, 'Non-admin user returns HTTP 401 Unauthorized');

    // 8.6 Receptionist without Admin privileges cannot update service
    const recUpdateRes = await request('PUT', `/api/services/${createdServiceId}`, {
      price: 999,
    }, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recUpdateRes.status === 401, 'Non-admin user returns HTTP 401 Unauthorized');

    // 8.7 Receptionist without Admin privileges cannot toggle status
    const recStatusRes = await request('PATCH', `/api/services/${createdServiceId}/status`, {
      isActive: false,
    }, {
      Authorization: `Bearer ${receptionistToken}`,
    });
    assert(recStatusRes.status === 401, 'Non-admin user returns HTTP 401 Unauthorized');

    // Clean up created test service
    if (createdServiceId) {
      await prisma.service.delete({ where: { id: createdServiceId } }).catch(() => {});
    }

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('\n========================================');
    console.log(`Services Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
