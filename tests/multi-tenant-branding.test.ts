import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

let superAdminToken: string;
let adminAToken: string;
let adminBToken: string;

let tenantAId: string;
let tenantBId: string;

let staffAId: string;
let staffBId: string;

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
    data,
    text,
    headers: response.headers,
  };
}

export async function runMultiTenantBrandingTests() {
  console.log('\n================================================================');
  console.log('   MULTI-TENANT SAAS DYNAMIC BRANDING & ISOLATION TEST SUITE');
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
    // 1. Authenticate as SuperAdmin
    // -------------------------------------------------------------
    console.log('--- 1. Platform SuperAdmin Authentication ---');
    const saLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });

    assert(saLogin.status === 200, 'SuperAdmin login returns 200 OK');
    superAdminToken = saLogin.data.data.token;
    assert(!!superAdminToken, 'SuperAdmin JWT token acquired');

    // -------------------------------------------------------------
    // 2. SuperAdmin Creates Company A ("Famous Salon") & Company B ("Crazy Salon")
    // -------------------------------------------------------------
    console.log('\n--- 2. SuperAdmin Dynamic Company Provisioning ---');

    // Clean up any pre-existing test tenants
    await prisma.user.deleteMany({
      where: { username: { in: ['admin_famous_e2e', 'admin_crazy_e2e'] } },
    });

    const existingA = await prisma.tenant.findFirst({
      where: { code: { equals: 'famous_salon_e2e', mode: 'insensitive' } },
    });
    if (existingA) {
      await prisma.staffSalary.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.payrollConfig.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.staff.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.designation.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.user.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.tenant.delete({ where: { id: existingA.id } });
    }

    const existingB = await prisma.tenant.findFirst({
      where: { code: { equals: 'crazy_salon_e2e', mode: 'insensitive' } },
    });
    if (existingB) {
      await prisma.staffSalary.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.payrollConfig.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.staff.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.designation.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.user.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.tenant.delete({ where: { id: existingB.id } });
    }

    // Provision Company A: Famous Salon
    const createCompanyA = await request('POST', '/api/platform/companies', {
      name: 'Famous Salon',
      code: 'FAMOUS_SALON_E2E',
      plan: 'PRO',
      cashierLimit: 5,
      contactEmail: 'contact@famoussalon.com',
      contactPhone: '+91 9876543210',
      address: '101 MG Road, Bangalore',
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'SETTINGS', 'REPORTS', 'PAYROLL', 'POS', 'INVENTORY'],
      admin: {
        username: 'admin_famous_e2e',
        email: 'admin@famoussalon.com',
        phone: '+91 9876543210',
        password: 'AdminFamousPassword123!',
      },
    }, superAdminToken);

    if (createCompanyA.status !== 201) {
      console.error('createCompanyA error:', createCompanyA.status, createCompanyA.data || createCompanyA.text);
    }
    assert(createCompanyA.status === 201, 'SuperAdmin creates Company A ("Famous Salon") returns 201');
    tenantAId = createCompanyA.data?.data?.company?.id;
    assert(createCompanyA.data?.data?.company?.name === 'Famous Salon', 'Company A name in DB is "Famous Salon"');

    // Provision Company B: Crazy Salon
    const createCompanyB = await request('POST', '/api/platform/companies', {
      name: 'Crazy Salon',
      code: 'CRAZY_SALON_E2E',
      plan: 'ENTERPRISE',
      cashierLimit: 10,
      contactEmail: 'hello@crazysalon.com',
      contactPhone: '+91 9123456789',
      address: '404 Fashion Street, Mumbai',
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'SETTINGS', 'REPORTS', 'PAYROLL', 'POS', 'INVENTORY'],
      admin: {
        username: 'admin_crazy_e2e',
        email: 'admin@crazysalon.com',
        phone: '+91 9123456789',
        password: 'AdminCrazyPassword123!',
      },
    }, superAdminToken);

    assert(createCompanyB.status === 201, 'SuperAdmin creates Company B ("Crazy Salon") returns 201');
    tenantBId = createCompanyB.data.data.company.id;
    assert(createCompanyB.data.data.company.name === 'Crazy Salon', 'Company B name in DB is "Crazy Salon"');

    // -------------------------------------------------------------
    // 3. Authenticate Admins & Verify Dynamic Company Context
    // -------------------------------------------------------------
    console.log('\n--- 3. Tenant Admin Login & Context Verification ---');

    // Login Admin A (Famous Salon)
    const loginA = await request('POST', '/api/auth/login', {
      username: 'admin_famous_e2e',
      password: 'AdminFamousPassword123!',
    });
    assert(loginA.status === 200, 'Admin A login returns 200 OK');
    adminAToken = loginA.data.data.token;
    assert(loginA.data.data.user.company.name === 'Famous Salon', 'Admin A login response includes company.name = "Famous Salon"');
    assert(loginA.data.data.user.company.id === tenantAId, 'Admin A company.id matches tenantAId');

    // Verify /api/auth/me for Admin A
    const meA = await request('GET', '/api/auth/me', undefined, adminAToken);
    assert(meA.status === 200, 'Admin A GET /api/auth/me returns 200');
    assert(meA.data.data.company.name === 'Famous Salon', 'Admin A /api/auth/me dynamically returns "Famous Salon"');

    // Login Admin B (Crazy Salon)
    const loginB = await request('POST', '/api/auth/login', {
      username: 'admin_crazy_e2e',
      password: 'AdminCrazyPassword123!',
    });
    assert(loginB.status === 200, 'Admin B login returns 200 OK');
    adminBToken = loginB.data.data.token;
    assert(loginB.data.data.user.company.name === 'Crazy Salon', 'Admin B login response includes company.name = "Crazy Salon"');
    assert(loginB.data.data.user.company.id === tenantBId, 'Admin B company.id matches tenantBId');

    // Verify /api/auth/me for Admin B
    const meB = await request('GET', '/api/auth/me', undefined, adminBToken);
    assert(meB.status === 200, 'Admin B GET /api/auth/me returns 200');
    assert(meB.data.data.company.name === 'Crazy Salon', 'Admin B /api/auth/me dynamically returns "Crazy Salon"');

    // -------------------------------------------------------------
    // 4. Staff & Payroll Setup for Company A & Company B
    // -------------------------------------------------------------
    console.log('\n--- 4. Staff & Payroll Provisioning for Both Tenants ---');

    // Create Designation for Company A
    const desigA = await prisma.designation.create({
      data: {
        tenantId: tenantAId,
        name: 'Master Stylist',
      },
    });

    // Create Designation for Company B
    const desigB = await prisma.designation.create({
      data: {
        tenantId: tenantBId,
        name: 'Lead Colorist',
      },
    });

    // Create Staff A under Famous Salon
    const staffA = await prisma.staff.create({
      data: {
        tenantId: tenantAId,
        name: 'Pooja Stylist',
        isActive: true,
        personalDetails: {
          create: {
            firstName: 'Pooja',
            lastName: 'Stylist',
            mobile: '9876500001',
            email: 'pooja@famoussalon.com',
            gender: 'FEMALE',
          },
        },
        joiningDetails: {
          create: {
            designationId: desigA.id,
            joiningDate: new Date('2024-01-01'),
            employeeNumber: 'EMP-FS-001',
            workingHours: '9',
          },
        },
        bankDetails: {
          create: {
            bankName: 'HDFC Bank',
            branch: 'Indiranagar',
            accountNumber: '111122223333',
            ifsc: 'HDFC0001111',
          },
        },
      },
    });
    staffAId = staffA.id;

    // Create Staff B under Crazy Salon
    const staffB = await prisma.staff.create({
      data: {
        tenantId: tenantBId,
        name: 'Karan Stylist',
        isActive: true,
        personalDetails: {
          create: {
            firstName: 'Karan',
            lastName: 'Stylist',
            mobile: '9876500002',
            email: 'karan@crazysalon.com',
            gender: 'MALE',
          },
        },
        joiningDetails: {
          create: {
            designationId: desigB.id,
            joiningDate: new Date('2024-02-01'),
            employeeNumber: 'EMP-CS-001',
            workingHours: '9',
          },
        },
        bankDetails: {
          create: {
            bankName: 'ICICI Bank',
            branch: 'Bandra West',
            accountNumber: '444455556666',
            ifsc: 'ICIC0002222',
          },
        },
      },
    });
    staffBId = staffB.id;

    // Configure Payroll for Famous Salon (Admin A)
    const configA = await request('POST', '/api/payroll/config', {
      staffId: staffAId,
      basicSalary: 30000,
      hra: 12000,
      conveyance: 2500,
      medicalAllowance: 2000,
      specialAllowance: 1500,
      pfPercentage: 12,
      esiPercentage: 0.75,
      professionalTax: 200,
      tdsPercentage: 5,
      isActive: true,
    }, adminAToken);
    assert(configA.status === 200, 'Company A payroll config saved (200)');

    // Configure Payroll for Crazy Salon (Admin B)
    const configB = await request('POST', '/api/payroll/config', {
      staffId: staffBId,
      basicSalary: 45000,
      hra: 18000,
      conveyance: 3000,
      medicalAllowance: 2500,
      specialAllowance: 2500,
      pfPercentage: 12,
      esiPercentage: 0.75,
      professionalTax: 200,
      tdsPercentage: 10,
      isActive: true,
    }, adminBToken);
    assert(configB.status === 200, 'Company B payroll config saved (200)');

    // Generate Payroll for Company A Staff A
    const genA = await request('POST', '/api/payroll/generate', {
      month: 10,
      year: 2026,
      staffId: staffAId,
      workingDays: 30,
      presentDays: 30,
      paymentMethod: 'BANK_TRANSFER',
      forceRegenerate: true,
    }, adminAToken);
    assert(genA.status === 200, 'Company A payroll generated for Staff A');

    // Generate Payroll for Company B Staff B
    const genB = await request('POST', '/api/payroll/generate', {
      month: 10,
      year: 2026,
      staffId: staffBId,
      workingDays: 30,
      presentDays: 30,
      paymentMethod: 'BANK_TRANSFER',
      forceRegenerate: true,
    }, adminBToken);
    assert(genB.status === 200, 'Company B payroll generated for Staff B');

    // -------------------------------------------------------------
    // 5. Verify Famous Salon Payslip Dynamic Branding (JSON & HTML)
    // -------------------------------------------------------------
    console.log('\n--- 5. Company A ("Famous Salon") Payslip Verification ---');

    // Get Payslip JSON for Staff A
    const payslipA = await request('GET', '/api/payroll/payslip', undefined, adminAToken, {
      staffId: staffAId,
      month: '10',
      year: '2026',
    });

    assert(payslipA.status === 200, 'Famous Salon GET /api/payroll/payslip returns 200');
    assert(payslipA.data.data.company.name === 'Famous Salon', 'Payslip company.name is "Famous Salon"');
    assert(payslipA.data.data.company.id === tenantAId, 'Payslip company.id matches tenantAId');
    assert(payslipA.data.data.company.address === '101 MG Road, Bangalore', 'Payslip company.address is correct');

    // Get Printable HTML Payslip for Staff A
    const printA = await request('GET', '/api/payroll/payslip/print', undefined, adminAToken, {
      staffId: staffAId,
      month: '10',
      year: '2026',
    });

    assert(printA.status === 200, 'Famous Salon GET /api/payroll/payslip/print returns 200 HTML');
    assert(printA.text.includes('FAMOUS SALON'), 'HTML payslip header contains "FAMOUS SALON"');
    assert(printA.text.includes('101 MG Road, Bangalore'), 'HTML payslip contains Famous Salon address');
    assert(!printA.text.includes('QUBEXE SALOON SOFTWARE'), 'HTML payslip DOES NOT contain "QUBEXE SALOON SOFTWARE"');
    assert(!printA.text.includes('Crazy Salon'), 'HTML payslip DOES NOT contain "Crazy Salon"');

    // -------------------------------------------------------------
    // 6. Verify Crazy Salon Payslip Dynamic Branding (JSON & HTML)
    // -------------------------------------------------------------
    console.log('\n--- 6. Company B ("Crazy Salon") Payslip Verification ---');

    // Get Payslip JSON for Staff B
    const payslipB = await request('GET', '/api/payroll/payslip', undefined, adminBToken, {
      staffId: staffBId,
      month: '10',
      year: '2026',
    });

    assert(payslipB.status === 200, 'Crazy Salon GET /api/payroll/payslip returns 200');
    assert(payslipB.data.data.company.name === 'Crazy Salon', 'Payslip company.name is "Crazy Salon"');
    assert(payslipB.data.data.company.id === tenantBId, 'Payslip company.id matches tenantBId');
    assert(payslipB.data.data.company.address === '404 Fashion Street, Mumbai', 'Payslip company.address is correct');

    // Get Printable HTML Payslip for Staff B
    const printB = await request('GET', '/api/payroll/payslip/print', undefined, adminBToken, {
      staffId: staffBId,
      month: '10',
      year: '2026',
    });

    assert(printB.status === 200, 'Crazy Salon GET /api/payroll/payslip/print returns 200 HTML');
    assert(printB.text.includes('CRAZY SALON'), 'HTML payslip header contains "CRAZY SALON"');
    assert(printB.text.includes('404 Fashion Street, Mumbai'), 'HTML payslip contains Crazy Salon address');
    assert(!printB.text.includes('QUBEXE SALOON SOFTWARE'), 'HTML payslip DOES NOT contain "QUBEXE SALOON SOFTWARE"');
    assert(!printB.text.includes('Famous Salon'), 'HTML payslip DOES NOT contain "Famous Salon"');

    // -------------------------------------------------------------
    // 7. Cross-Tenant Data Isolation Test
    // -------------------------------------------------------------
    console.log('\n--- 7. Cross-Tenant Security & Isolation Verification ---');

    // Admin A attempts to access Staff B's payslip
    const crossAccessA = await request('GET', '/api/payroll/payslip', undefined, adminAToken, {
      staffId: staffBId,
      month: '10',
      year: '2026',
    });
    assert(crossAccessA.status === 404, 'Admin A accessing Company B Staff returns 404 Not Found (Cross-tenant blocked)');

    // Admin B attempts to access Staff A's payslip
    const crossAccessB = await request('GET', '/api/payroll/payslip', undefined, adminBToken, {
      staffId: staffAId,
      month: '10',
      year: '2026',
    });
    assert(crossAccessB.status === 404, 'Admin B accessing Company A Staff returns 404 Not Found (Cross-tenant blocked)');

    // -------------------------------------------------------------
    // 8. Dynamic Company Name Update Test (Zero Code Changes)
    // -------------------------------------------------------------
    console.log('\n--- 8. Real-time Company Name Update Test ---');

    // SuperAdmin renames "Famous Salon" to "Famous Salon Hyderabad"
    const updateName = await request('PUT', `/api/platform/companies/${tenantAId}`, {
      name: 'Famous Salon Hyderabad',
      address: 'Banjara Hills, Hyderabad',
    }, superAdminToken);

    assert(updateName.status === 200, 'SuperAdmin renames company to "Famous Salon Hyderabad"');

    // Admin A requests printable payslip again
    const printUpdatedA = await request('GET', '/api/payroll/payslip/print', undefined, adminAToken, {
      staffId: staffAId,
      month: '10',
      year: '2026',
    });

    assert(printUpdatedA.status === 200, 'Admin A gets printable payslip after rename');
    assert(printUpdatedA.text.includes('FAMOUS SALON HYDERABAD'), 'HTML payslip IMMEDIATELY reflects "FAMOUS SALON HYDERABAD" without code change');
    assert(printUpdatedA.text.includes('Banjara Hills, Hyderabad'), 'HTML payslip immediately reflects updated address');
    assert(!printUpdatedA.text.includes('QUBEXE SALOON SOFTWARE'), 'HTML payslip does not contain static default');

    // -------------------------------------------------------------
    // 9. Generic Settings Tenant Verification
    // -------------------------------------------------------------
    console.log('\n--- 9. Settings Module Tenant Verification ---');

    const settingsA = await request('GET', '/api/settings/generic', undefined, adminAToken);
    assert(settingsA.status === 200, 'GET /api/settings/generic returns 200 for Company A');
    assert(settingsA.data.data.companyName === 'Famous Salon Hyderabad', 'Settings reflects updated companyName "Famous Salon Hyderabad"');
    assert(settingsA.data.data.address === 'Banjara Hills, Hyderabad', 'Settings reflects updated address');

    const settingsB = await request('GET', '/api/settings/generic', undefined, adminBToken);
    assert(settingsB.status === 200, 'GET /api/settings/generic returns 200 for Company B');
    assert(settingsB.data.data.companyName === 'Crazy Salon', 'Settings reflects companyName "Crazy Salon"');

    // -------------------------------------------------------------
    // 10. Reports Module Tenant Verification
    // -------------------------------------------------------------
    console.log('\n--- 10. Reports Module Tenant Verification ---');

    const reportA = await request('GET', '/api/reports/sales-summary', undefined, adminAToken);
    assert(reportA.status === 200, 'Company A reports call returns 200');
    assert(reportA.data.data.company.name === 'Famous Salon Hyderabad', 'Report metadata includes company.name = "Famous Salon Hyderabad"');

    const reportB = await request('GET', '/api/reports/sales-summary', undefined, adminBToken);
    assert(reportB.status === 200, 'Company B reports call returns 200');
    assert(reportB.data.data.company.name === 'Crazy Salon', 'Report metadata includes company.name = "Crazy Salon"');

    // -------------------------------------------------------------
    // 11. Salary CSV Export Tenant Verification
    // -------------------------------------------------------------
    console.log('\n--- 11. Salary CSV Export Tenant Verification ---');

    const csvA = await request('GET', '/api/payroll/salary?export=csv', undefined, adminAToken);
    assert(csvA.status === 200, 'GET /api/payroll/salary?export=csv returns 200');
    assert(csvA.text.includes('Famous Salon Hyderabad'), 'Salary CSV export contains tenant company name');

    // Cleanup created test records
    await prisma.staffSalary.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.payrollConfig.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.designation.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiTenantBrandingTests();
}
