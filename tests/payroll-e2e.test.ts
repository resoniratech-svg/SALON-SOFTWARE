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

let staffSuhaniId: string;
let staffRahulId: string;
let staffTenantBId: string;

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

export async function runPayrollE2ETests() {
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE Payroll & Salary Management E2E Test Suite');
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
    // 1. Setup & Multi-Tenant Authentication
    // -------------------------------------------------------------
    console.log('--- 1. Authentication & Multi-Tenant Setup ---');

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

    const cashierUser = await prisma.user.findFirst({ where: { username: 'cashier' } });
    if (cashierUser) {
      await prisma.user.update({
        where: { id: cashierUser.id },
        data: { enabledModules: ['PAYROLL', 'STAFF', 'POS', 'REPORTS', 'SETTINGS'] },
      });
    }

    const cashierLogin = await request('POST', '/api/auth/login', {
      username: 'cashier',
      password: 'DevelopmentPassword123!',
    });
    assert(cashierLogin.status === 200, 'Cashier login returns 200');
    cashierToken = cashierLogin.data?.data?.token;

    assert(!!adminAToken, 'Admin A token obtained');
    assert(!!adminBToken, 'Admin B token obtained');
    assert(!!cashierToken, 'Cashier A token obtained');

    // Create Staff Members matching video
    // 1. Designation
    let designation = await prisma.designation.findFirst({ where: { tenantId: tenantAId, name: 'Senior Stylist' } });
    if (!designation) {
      designation = await prisma.designation.create({
        data: { tenantId: tenantAId, name: 'Senior Stylist', description: 'Expert hair and beauty specialist' },
      });
    }

    // Clean old test salaries and configs for fresh runs
    await prisma.staffSalary.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.payrollConfig.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.staffSalary.deleteMany({ where: { tenantId: tenantBId } });

    await prisma.payrollConfig.deleteMany({ where: { tenantId: tenantBId } });

    // Staff Suhani Pareek (matching video frame 096-105)
    let staffSuhani = await prisma.staff.findFirst({
      where: { tenantId: tenantAId, name: 'Suhani Pareek' },
      include: { bankDetails: true, joiningDetails: true },
    });
    if (staffSuhani) {
      if (!staffSuhani.bankDetails) {
        await prisma.staffBankDetail.create({
          data: {
            staffId: staffSuhani.id,
            bankName: 'HDFC Bank',
            branch: 'Kalyaninagar Branch',
            accountNumber: '50100234567890',
            ifsc: 'HDFC0001234',
          },
        });
      }
      if (!staffSuhani.joiningDetails) {
        await prisma.staffJoiningDetail.create({
          data: {
            staffId: staffSuhani.id,
            joiningDate: new Date('2024-01-10'),
            employeeNumber: 'EMP-SP-001',
            designationId: designation.id,
            workingHours: '9',
          },
        });
      }
    } else {
      staffSuhani = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'Suhani Pareek',
          isActive: true,
          personalDetails: {
            create: {
              firstName: 'Suhani',
              lastName: 'Pareek',
              gender: 'FEMALE',
              mobile: '9822011223',
              email: 'suhani.pareek@qubexe.com',
              dob: new Date('1996-05-15'),
            },
          },
          joiningDetails: {
            create: {
              joiningDate: new Date('2024-01-10'),
              employeeNumber: 'EMP-SP-001',
              designationId: designation.id,
              workingHours: '9',
            },
          },
          bankDetails: {
            create: {
              bankName: 'HDFC Bank',
              branch: 'Kalyaninagar Branch',
              accountNumber: '50100234567890',
              ifsc: 'HDFC0001234',
            },
          },
        },
      });
    }
    staffSuhaniId = staffSuhani.id;

    // Staff Rahul Sharma
    let staffRahul = await prisma.staff.findFirst({ where: { tenantId: tenantAId, name: 'Rahul Sharma' } });
    if (!staffRahul) {
      staffRahul = await prisma.staff.create({
        data: {
          tenantId: tenantAId,
          name: 'Rahul Sharma',
          isActive: true,
          personalDetails: {
            create: {
              firstName: 'Rahul',
              lastName: 'Sharma',
              gender: 'MALE',
              mobile: '9822044556',
              email: 'rahul.sharma@qubexe.com',
              dob: new Date('1994-08-20'),
            },
          },
          joiningDetails: {
            create: {
              joiningDate: new Date('2024-03-01'),
              employeeNumber: 'EMP-RS-002',
              designationId: designation.id,
              workingHours: '9',
            },
          },
          bankDetails: {
            create: {
              bankName: 'ICICI Bank',
              branch: 'Pune Main Branch',
              accountNumber: '102938475601',
              ifsc: 'ICIC0005678',
            },
          },
        },
      });
    }
    staffRahulId = staffRahul.id;


    // Tenant B Staff
    let staffTenantB = await prisma.staff.findFirst({ where: { tenantId: tenantBId } });
    if (!staffTenantB) {
      staffTenantB = await prisma.staff.create({
        data: {
          tenantId: tenantBId,
          name: 'Tenant B Stylist',
          isActive: true,
        },
      });
    }
    staffTenantBId = staffTenantB.id;


    // -------------------------------------------------------------
    // 2. Unconfigured Payroll State (Matching Video Frames 096–105)
    // -------------------------------------------------------------
    console.log('\n--- 2. Unconfigured State (Video Parity) ---');

    const unconfiguredConfig = await request('GET', '/api/payroll/config', undefined, adminAToken, {
      staffId: staffSuhaniId,
    });
    assert(unconfiguredConfig.status === 200, 'GET /payroll/config returns 200 when unconfigured');
    assert(unconfiguredConfig.data?.configured === false, 'Configured flag is false');
    assert(unconfiguredConfig.data?.message === 'Payroll config not found', 'Message matches video toast: "Payroll config not found"');

    const unconfiguredPayslip = await request('GET', '/api/payroll/payslip', undefined, adminAToken, {
      staffId: staffSuhaniId,
      month: '8',
      year: '2026',
    });
    assert(unconfiguredPayslip.status === 200, 'GET /payroll/payslip returns 200 when unconfigured');
    assert(unconfiguredPayslip.data?.configured === false, 'Payslip configured flag is false');
    assert(unconfiguredPayslip.data?.message === 'Payroll config not found', 'Payslip message matches: "Payroll config not found"');

    // -------------------------------------------------------------
    // 3. Payroll Configuration Management
    // -------------------------------------------------------------
    console.log('\n--- 3. Payroll Configuration Management ---');

    // Save Tenant Default Configuration
    const saveDefaultConfig = await request('POST', '/api/payroll/config', {
      basicSalary: 25000,
      hra: 10000,
      conveyance: 2000,
      medicalAllowance: 1500,
      specialAllowance: 1500,
      pfPercentage: 12,
      esiPercentage: 0.75,
      professionalTax: 200,
      tdsPercentage: 5,
    }, adminAToken);
    assert(saveDefaultConfig.status === 200, 'POST /payroll/config saves default tenant config');
    assert(Number(saveDefaultConfig.data?.data?.basicSalary) === 25000, 'Basic salary saved as 25000');
    assert(Number(saveDefaultConfig.data?.data?.hra) === 10000, 'HRA saved as 10000');
    assert(Number(saveDefaultConfig.data?.data?.pfPercentage) === 12, 'PF saved as 12%');

    // Retrieve default config
    const getDefaultConfig = await request('GET', '/api/payroll/config', undefined, adminAToken);
    assert(getDefaultConfig.status === 200, 'GET /payroll/config returns tenant default config');
    assert(getDefaultConfig.data?.configured === true, 'Configured flag is now true');
    assert(Number(getDefaultConfig.data?.data?.basicSalary) === 25000, 'Basic salary retrieved correctly');

    // Save Staff-Specific Configuration for Suhani Pareek (Senior Stylist)
    const saveStaffConfig = await request('POST', '/api/payroll/config', {
      staffId: staffSuhaniId,
      basicSalary: 35000,
      hra: 14000,
      conveyance: 3000,
      medicalAllowance: 2500,
      specialAllowance: 2500,
      pfPercentage: 12,
      esiPercentage: 0, // Above ESI wage ceiling
      professionalTax: 200,
      tdsPercentage: 10,
    }, adminAToken);
    assert(saveStaffConfig.status === 200, 'POST /payroll/config saves staff-specific config for Suhani');
    assert(saveStaffConfig.data?.data?.staffId === staffSuhaniId, 'Staff ID correctly assigned');
    assert(Number(saveStaffConfig.data?.data?.basicSalary) === 35000, 'Suhani basic salary is 35000');

    // Verify staff-specific config precedence
    const getSuhaniConfig = await request('GET', '/api/payroll/config', undefined, adminAToken, {
      staffId: staffSuhaniId,
    });
    assert(getSuhaniConfig.status === 200, 'GET /payroll/config?staffId returns staff-specific config');
    assert(Number(getSuhaniConfig.data?.data?.basicSalary) === 35000, 'Takes precedence over tenant default (35000 vs 25000)');

    // Verify Rahul uses tenant default fallback
    const getRahulConfig = await request('GET', '/api/payroll/config', undefined, adminAToken, {
      staffId: staffRahulId,
    });
    assert(getRahulConfig.status === 200, 'GET /payroll/config for Rahul falls back to tenant default');
    assert(Number(getRahulConfig.data?.data?.basicSalary) === 25000, 'Rahul uses default 25000');

    // List All Configs
    const getAllConfigs = await request('GET', '/api/payroll/configs', undefined, adminAToken);
    assert(getAllConfigs.status === 200, 'GET /payroll/configs returns all configs');
    assert(Array.isArray(getAllConfigs.data?.data), 'Data is an array');
    assert(getAllConfigs.data?.data?.length >= 2, 'Contains default and staff-specific configs');

    // Validation: Negative basic salary rejected
    const negativeSalary = await request('POST', '/api/payroll/config', {
      basicSalary: -1000,
    }, adminAToken);
    assert(negativeSalary.status === 400, 'POST /payroll/config with negative salary returns 400 Bad Request');

    // Validation: PF percentage > 100 rejected
    const excessivePf = await request('POST', '/api/payroll/config', {
      basicSalary: 20000,
      pfPercentage: 150,
    }, adminAToken);
    assert(excessivePf.status === 400, 'POST /payroll/config with PF > 100% returns 400 Bad Request');

    // -------------------------------------------------------------
    // 4. Salary Generation (Salary Management Screen)
    // -------------------------------------------------------------
    console.log('\n--- 4. Salary Generation & Server-Side Calculations ---');

    // Generate salary for Suhani Pareek (Month: 8 / August 2026, Full 30 days)
    const generateSuhani = await request('POST', '/api/payroll/generate', {
      staffId: staffSuhaniId,
      month: 8,
      year: 2026,
      workingDays: 30,
      presentDays: 30,
      paymentMethod: 'BANK_TRANSFER',
      notes: 'August 2026 Salary',
    }, adminAToken);

    assert(generateSuhani.status === 200, 'POST /payroll/generate for Suhani returns 200');
    assert(generateSuhani.data?.data?.count === 1, 'Generates 1 record');
    const suhaniSal = generateSuhani.data?.data?.salaries[0];
    assert(Number(suhaniSal.basicSalary) === 35000, 'Suhani basic salary is 35000');
    // Allowances: HRA(14000) + Conv(3000) + Med(2500) + Spec(2500) = 22000
    assert(Number(suhaniSal.allowances) === 22000, 'Suhani total allowances is 22000');
    // Gross: 35000 + 22000 = 57000
    assert(Number(suhaniSal.grossSalary) === 57000, 'Suhani gross salary is 57000');
    // Deductions: PF(12% of 35000 = 4200) + ESI(0) + PT(200) + TDS(10% of 57000 = 5700) = 10100
    assert(Number(suhaniSal.deductions) === 10100, 'Suhani deductions is 10100');
    // Net: 57000 - 10100 = 46900
    assert(Number(suhaniSal.netSalary) === 46900, 'Suhani net salary is 46900');

    // Generate salary with pro-rated attendance (Rahul: 15 present days out of 30)
    const generateRahulProrated = await request('POST', '/api/payroll/generate', {
      staffId: staffRahulId,
      month: 8,
      year: 2026,
      workingDays: 30,
      presentDays: 15, // 50% pro-rated
    }, adminAToken);
    assert(generateRahulProrated.status === 200, 'POST /payroll/generate with pro-rated days returns 200');
    const rahulSal = generateRahulProrated.data?.data?.salaries[0];
    // Base: 25000 * 0.5 = 12500
    assert(Number(rahulSal.basicSalary) === 12500, 'Rahul pro-rated basic salary is 12500');
    // Allowances: (10000 + 2000 + 1500 + 1500) * 0.5 = 15000 * 0.5 = 7500
    assert(Number(rahulSal.allowances) === 7500, 'Rahul pro-rated allowances is 7500');
    // Gross: 12500 + 7500 = 20000
    assert(Number(rahulSal.grossSalary) === 20000, 'Rahul pro-rated gross salary is 20000');

    // Duplicate generation without forceRegenerate does not duplicate
    const dupGen = await request('POST', '/api/payroll/generate', {
      staffId: staffSuhaniId,
      month: 8,
      year: 2026,
    }, adminAToken);
    assert(dupGen.status === 200, 'POST /payroll/generate duplicate check returns 200');
    assert(dupGen.data?.data?.salaries[0]?.alreadyExisted === true, 'Duplicate flag alreadyExisted is true');

    // Force regenerate updates existing record
    const forceGen = await request('POST', '/api/payroll/generate', {
      staffId: staffSuhaniId,
      month: 8,
      year: 2026,
      workingDays: 30,
      presentDays: 28, // Adjusted
      forceRegenerate: true,
    }, adminAToken);
    assert(forceGen.status === 200, 'POST /payroll/generate with forceRegenerate returns 200');
    assert(forceGen.data?.data?.salaries[0]?.presentDays === 28, 'Updated present days reflected');

    // Validation: Invalid Month (13) rejected
    const badMonth = await request('POST', '/api/payroll/generate', {
      month: 13,
      year: 2026,
    }, adminAToken);
    assert(badMonth.status === 400, 'POST /payroll/generate with invalid month returns 400');

    // -------------------------------------------------------------
    // 5. Salary Listing & Management (Salary Management Screen)
    // -------------------------------------------------------------
    console.log('\n--- 5. Salary Listing & Management ---');

    // Query salaries for August 2026
    const listSalaries = await request('GET', '/api/payroll/salary', undefined, adminAToken, {
      month: '8',
      year: '2026',
    });
    assert(listSalaries.status === 200, 'GET /payroll/salary returns 200');
    assert(listSalaries.data?.data?.total >= 2, 'Lists both Suhani and Rahul salaries');
    assert(listSalaries.data?.data?.data[0]?.staff?.name !== undefined, 'Includes staff relation details');

    // Filter by staffId
    const filterByStaff = await request('GET', '/api/payroll/salary', undefined, adminAToken, {
      staffId: staffSuhaniId,
    });
    assert(filterByStaff.status === 200, 'GET /payroll/salary?staffId returns 200');
    assert(filterByStaff.data?.data?.data?.every((s: any) => s.staffId === staffSuhaniId), 'All returned rows match staffId');

    // Export Salaries as CSV
    const exportSalariesCsv = await request('GET', '/api/payroll/salary', undefined, adminAToken, {
      month: '8',
      year: '2026',
      export: 'csv',
    });
    assert(exportSalariesCsv.status === 200, 'GET /payroll/salary?export=csv returns 200');
    assert(exportSalariesCsv.headers.get('content-type')?.includes('text/csv') === true, 'Content-Type is text/csv');
    assert(exportSalariesCsv.text.includes('Staff Name') && exportSalariesCsv.text.includes('Net Salary'), 'Contains CSV headers');
    assert(exportSalariesCsv.text.includes('Suhani Pareek'), 'CSV contains staff row data');

    // Get Salary By ID
    const suhaniSalaryId = suhaniSal.id;
    const getSalary = await request('GET', `/api/payroll/salary/${suhaniSalaryId}`, undefined, adminAToken);
    assert(getSalary.status === 200, `GET /payroll/salary/:id returns 200`);
    assert(getSalary.data?.data?.id === suhaniSalaryId, 'Retrieved salary ID matches');
    assert(getSalary.data?.data?.status === 'PENDING', 'Initial status is PENDING');

    // Approve Salary
    const approveSalary = await request('PATCH', `/api/payroll/salary/${suhaniSalaryId}/status`, {
      status: 'APPROVED',
      notes: 'Approved by Branch Manager',
    }, adminAToken);
    assert(approveSalary.status === 200, 'PATCH /payroll/salary/:id/status (APPROVED) returns 200');
    assert(approveSalary.data?.data?.status === 'APPROVED', 'Status updated to APPROVED');

    // Mark Salary as PAID
    const paySalary = await request('PATCH', `/api/payroll/salary/${suhaniSalaryId}/status`, {
      status: 'PAID',
      paymentMethod: 'HDFC_NETBANKING',
      notes: 'Transferred via IMPS Batch #8812',
    }, adminAToken);
    assert(paySalary.status === 200, 'PATCH /payroll/salary/:id/status (PAID) returns 200');
    assert(paySalary.data?.data?.status === 'PAID', 'Status updated to PAID');
    assert(paySalary.data?.data?.paymentMethod === 'HDFC_NETBANKING', 'Payment method updated');
    assert(!!paySalary.data?.data?.paidAt, 'paidAt timestamp automatically set');

    // Custom adjustments: add incentives & bonuses
    const adjustSalary = await request('PATCH', `/api/payroll/salary/${suhaniSalaryId}`, {
      incentives: 5000,
      bonuses: 2000,
      notes: 'Incentive for exceeding monthly salon target',
    }, adminAToken);
    assert(adjustSalary.status === 200, 'PATCH /payroll/salary/:id (incentives & bonus) returns 200');
    assert(Number(adjustSalary.data?.data?.incentives) === 5000, 'Incentives recorded as 5000');
    assert(Number(adjustSalary.data?.data?.bonuses) === 2000, 'Bonuses recorded as 2000');

    // -------------------------------------------------------------
    // 6. Detailed Payslip Generation & Printable View
    // -------------------------------------------------------------
    console.log('\n--- 6. Detailed Payslip & Print View ---');

    // Payslip JSON
    const payslip = await request('GET', '/api/payroll/payslip', undefined, adminAToken, {
      staffId: staffSuhaniId,
      month: '8',
      year: '2026',
    });
    assert(payslip.status === 200, 'GET /payroll/payslip returns 200');
    assert(payslip.data?.configured === true, 'Payslip configured is true');
    assert(payslip.data?.data?.staff?.name === 'Suhani Pareek', 'Staff name is Suhani Pareek');
    assert(payslip.data?.data?.staff?.designation === 'Senior Stylist', 'Designation is Senior Stylist');
    assert(payslip.data?.data?.staff?.bankName === 'HDFC Bank', 'Bank name is HDFC Bank');
    assert(payslip.data?.data?.period?.monthName === 'August', 'Period month is August');
    assert(Array.isArray(payslip.data?.data?.earnings), 'Earnings breakdown is an array');
    assert(Array.isArray(payslip.data?.data?.deductions), 'Deductions breakdown is an array');
    assert(payslip.data?.data?.summary?.netSalary > 0, 'Net salary is positive value');
    assert(payslip.data?.data?.summary?.status === 'PAID', 'Summary reflects PAID status');

    // Printable HTML Payslip
    const printPayslip = await request('GET', '/api/payroll/payslip/print', undefined, adminAToken, {
      staffId: staffSuhaniId,
      month: '8',
      year: '2026',
    });
    assert(printPayslip.status === 200, 'GET /payroll/payslip/print returns 200');
    assert(printPayslip.headers.get('content-type')?.includes('text/html') === true, 'Content-Type is text/html');
    const tenantA = await prisma.tenant.findUnique({ where: { id: tenantAId } });
    const expectedName = tenantA?.name?.toUpperCase() || tenantA?.code?.toUpperCase() || 'SALON';
    assert(printPayslip.text.includes(expectedName), `HTML contains tenant brand header (${expectedName})`);
    assert(printPayslip.text.includes('Suhani Pareek'), 'HTML contains staff name');
    assert(printPayslip.text.includes('HDFC Bank'), 'HTML contains bank name');
    assert(printPayslip.text.includes('NET TAKE-HOME PAYABLE SALARY'), 'HTML contains net take-home box');

    // -------------------------------------------------------------
    // 7. Salary & Configuration Deletion
    // -------------------------------------------------------------
    console.log('\n--- 7. Salary & Configuration Deletion ---');

    // Create a temporary salary record to delete
    const tempSalary = await prisma.staffSalary.create({
      data: {
        tenantId: tenantAId,
        staffId: staffRahulId,
        month: 12,
        year: 2026,
        basicSalary: 20000,
        netSalary: 20000,
        status: 'PENDING',
      },
    });

    const deleteSal = await request('DELETE', `/api/payroll/salary/${tempSalary.id}`, undefined, adminAToken);
    assert(deleteSal.status === 200, 'DELETE /payroll/salary/:id returns 200');
    assert(deleteSal.data?.success === true, 'Salary deletion successful');

    const verifyDeletedSal = await prisma.staffSalary.findUnique({ where: { id: tempSalary.id } });
    assert(verifyDeletedSal === null, 'Salary record confirmed removed from database');

    // -------------------------------------------------------------
    // 8. Multi-Tenant SaaS Isolation & RBAC
    // -------------------------------------------------------------
    console.log('\n--- 8. Multi-Tenant SaaS Isolation & RBAC ---');

    // Tenant B cannot see Tenant A's salaries
    const tenantBSalaries = await request('GET', '/api/payroll/salary', undefined, adminBToken);
    assert(tenantBSalaries.status === 200, 'Tenant B query returns 200');
    assert(tenantBSalaries.data?.data?.total === 0, 'Tenant B sees 0 salaries (Tenant A salaries isolated)');

    // Tenant B cannot see Tenant A's payroll configs
    const tenantBConfigs = await request('GET', '/api/payroll/configs', undefined, adminBToken);
    assert(tenantBConfigs.status === 200, 'Tenant B configs query returns 200');
    assert(tenantBConfigs.data?.data?.length === 0, 'Tenant B sees 0 configs');

    // Tenant B cannot access Tenant A's salary by ID
    const crossTenantGet = await request('GET', `/api/payroll/salary/${suhaniSalaryId}`, undefined, adminBToken);
    assert(crossTenantGet.status === 404, 'Tenant B accessing Tenant A salary returns 404 Not Found');

    // Tenant B cannot update Tenant A's salary
    const crossTenantUpdate = await request('PATCH', `/api/payroll/salary/${suhaniSalaryId}/status`, {
      status: 'PAID',
    }, adminBToken);
    assert(crossTenantUpdate.status === 404, 'Tenant B updating Tenant A salary returns 404 Not Found');

    // Unauthenticated request returns 401
    const unauthReq = await request('GET', '/api/payroll/salary');
    assert(unauthReq.status === 401, 'Unauthenticated request returns 401 Unauthorized');

    // Cashier with PAYROLL permission can access payslip
    const cashierPayslip = await request('GET', '/api/payroll/payslip', undefined, cashierToken, {
      staffId: staffSuhaniId,
      month: '8',
      year: '2026',
    });
    assert(cashierPayslip.status === 200, 'Cashier with permissions can access payslip');

  } catch (error: any) {
    console.error('Test execution exception:', error);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPayrollE2ETests().catch((err) => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  });
}
