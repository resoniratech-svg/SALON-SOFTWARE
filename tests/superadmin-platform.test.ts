import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import http from 'http';
import jwt from 'jsonwebtoken';

let server: http.Server;
let baseUrl: string;

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
  console.log('\n================================================================');
  console.log('   QUBEXE SALOON SOFTWARE SuperAdmin, Platform Management & Impersonation Suite');
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
    // SECTION 1: FINAL 2-ROLE LOGIN MODEL & AUTHENTICATION CONTEXTS
    // -------------------------------------------------------------------------
    console.log('--- 1. Login Model & Authentication Contexts ---');

    // 1.1 SuperAdmin login succeeds
    const superLogin = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'SuperAdminSecretPassword123!',
    });
    assert(superLogin.status === 200, 'SuperAdmin login returns HTTP 200');
    assert(superLogin.data?.data?.user?.isSuperAdmin === true, 'SuperAdmin user identified with isSuperAdmin=true');
    assert(superLogin.data?.data?.user?.role?.name === 'SUPERADMIN', 'SuperAdmin user role is SUPERADMIN');
    assert(superLogin.data?.data?.user?.tenantId === null, 'SuperAdmin tenantId is null (Platform context)');
    const superToken = superLogin.data?.data?.token;

    // 1.2 Company Admin login succeeds
    const adminLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'DevelopmentPassword123!',
    });
    assert(adminLogin.status === 200, 'Company Admin login returns HTTP 200');
    assert(adminLogin.data?.data?.user?.role?.name === 'ADMIN', 'Company Admin user role is ADMIN');
    assert(adminLogin.data?.data?.user?.tenantId !== null, 'Company Admin is linked to tenant');
    const adminToken = adminLogin.data?.data?.token;
    const companyAId = adminLogin.data?.data?.user?.tenantId;

    // 1.3 Staff / Receptionist / Worker login is rejected
    const staffLogin = await request('POST', '/api/auth/login', {
      username: 'receptionist',
      password: 'DevelopmentPassword123!',
    });
    assert(staffLogin.status === 401, 'Staff/Receptionist login strictly rejected with HTTP 401');
    assert(staffLogin.data?.success === false, 'Staff login response indicates failure');

    // 1.4 /api/auth/me platform context
    const superMe = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(superMe.status === 200, 'SuperAdmin /api/auth/me returns 200');
    assert(superMe.data?.data?.tenantId === null, 'SuperAdmin has no company context');
    assert(superMe.data?.data?.effectiveTenantId === null, 'SuperAdmin effectiveTenantId is null');
    assert(superMe.data?.data?.impersonating === false, 'SuperAdmin is not impersonating in platform context');

    // 1.5 /api/auth/me company admin context
    const adminMe = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminMe.status === 200, 'Company Admin /api/auth/me returns 200');
    assert(adminMe.data?.data?.tenantId === companyAId, 'Company Admin tenantId verified');
    assert(adminMe.data?.data?.effectiveTenantId === companyAId, 'Company Admin effectiveTenantId matches company');

    // -------------------------------------------------------------------------
    // SECTION 2: PLATFORM COMPANY MANAGEMENT (SUPERADMIN ONLY)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Platform Company Management ---');

    // 2.1 Company Admin cannot access platform endpoints (403)
    const adminPlatformForbidden = await request('GET', '/api/platform/companies', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminPlatformForbidden.status === 403, 'Company Admin forbidden from /api/platform/companies (HTTP 403)');

    // 2.2 SuperAdmin creates a new company with initial Admin
    const newCompanyPayload = {
      name: 'Elysian Wellness Salon',
      code: `elysian-${Date.now()}`,
      plan: 'PRO' as const,
      subscriptionStatus: 'ACTIVE' as const,
      enabledModules: ['SERVICES', 'PRODUCTS', 'STAFF'], // Disposables disabled initially
      contactEmail: 'contact@elysian.com',
      contactPhone: '+1-555-0199',
      adminUser: {
        username: `elysian_admin_${Date.now()}`,
        email: `admin@elysian-${Date.now()}.com`,
        password: 'InitialPassword123!',
      },
    };

    const createCompanyRes = await request('POST', '/api/platform/companies', newCompanyPayload, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(createCompanyRes.status === 201, 'SuperAdmin successfully creates new company (HTTP 201)');
    assert(createCompanyRes.data?.data?.company?.name === newCompanyPayload.name, 'Company name matches');
    assert(createCompanyRes.data?.data?.adminUser?.username === newCompanyPayload.adminUser.username, 'Initial Admin created');
    const createdCompanyId = createCompanyRes.data?.data?.company?.id;
    const createdAdminUsername = newCompanyPayload.adminUser.username;

    // 2.3 SuperAdmin lists companies
    const listCompaniesRes = await request('GET', '/api/platform/companies', undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(listCompaniesRes.status === 200, 'SuperAdmin lists companies (HTTP 200)');
    assert(Array.isArray(listCompaniesRes.data?.data?.items), 'Companies returned as array');
    assert(listCompaniesRes.data?.data?.items.some((c: any) => c.id === createdCompanyId), 'Created company is in list');

    // 2.4 SuperAdmin gets company details and stats
    const getCompanyRes = await request('GET', `/api/platform/companies/${createdCompanyId}`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(getCompanyRes.status === 200, 'SuperAdmin gets company details (HTTP 200)');
    assert(getCompanyRes.data?.data?.id === createdCompanyId, 'Fetched company ID matches');
    assert(typeof getCompanyRes.data?.data?.stats === 'object', 'Company stats object present');

    // 2.5 SuperAdmin updates company details
    const updateCompanyRes = await request('PUT', `/api/platform/companies/${createdCompanyId}`, {
      name: 'Elysian Luxury Spa & Salon',
      contactPhone: '+1-555-0999',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(updateCompanyRes.status === 200, 'SuperAdmin updates company details (HTTP 200)');
    assert(updateCompanyRes.data?.data?.name === 'Elysian Luxury Spa & Salon', 'Company name updated');

    // -------------------------------------------------------------------------
    // SECTION 3: SUBSCRIPTION & EXPIRY LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Subscription & Expiry Lifecycle ---');

    // Login as the newly created company's admin
    const newAdminLogin = await request('POST', '/api/auth/login', {
      username: createdAdminUsername,
      password: 'InitialPassword123!',
    });
    assert(newAdminLogin.status === 200, 'Newly created company admin authenticates successfully');
    const newAdminToken = newAdminLogin.data?.data?.token;

    // 3.1 SuperAdmin sets company subscription to EXPIRED
    const expireSubRes = await request('PATCH', `/api/platform/companies/${createdCompanyId}/subscription`, {
      subscriptionStatus: 'EXPIRED',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(expireSubRes.status === 200, 'SuperAdmin updates subscription to EXPIRED');

    // 3.2 Expired company admin login is blocked
    const expiredLoginRes = await request('POST', '/api/auth/login', {
      username: createdAdminUsername,
      password: 'InitialPassword123!',
    });
    assert(expiredLoginRes.status === 401, 'Expired company admin login rejected with HTTP 401');
    assert(expiredLoginRes.data?.message.includes('expired'), 'Rejection message explains subscription expiry');

    // 3.3 Expired company admin with existing token is blocked on API requests
    const expiredApiRes = await request('GET', '/api/services', undefined, {
      Authorization: `Bearer ${newAdminToken}`,
    });
    assert(expiredApiRes.status === 401, 'Existing token for expired company rejected on API call (HTTP 401)');

    // 3.4 SuperAdmin can still view and manage the expired company
    const superManageExpiredRes = await request('GET', `/api/platform/companies/${createdCompanyId}`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(superManageExpiredRes.status === 200, 'SuperAdmin can still access expired company in platform context');

    // 3.5 Reactivate company subscription
    const reactivateSubRes = await request('PATCH', `/api/platform/companies/${createdCompanyId}/subscription`, {
      subscriptionStatus: 'ACTIVE',
      plan: 'ENTERPRISE',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(reactivateSubRes.status === 200, 'SuperAdmin restores subscription to ACTIVE');

    // 3.6 Suspend company
    const suspendRes = await request('PATCH', `/api/platform/companies/${createdCompanyId}/status`, {
      isActive: false,
      reason: 'Terms of service violation',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(suspendRes.status === 200, 'SuperAdmin suspends company', `Got ${suspendRes.status}: ${JSON.stringify(suspendRes.data)}`);

    // Suspended company admin login is blocked
    const suspendedLoginRes = await request('POST', '/api/auth/login', {
      username: createdAdminUsername,
      password: 'InitialPassword123!',
    });
    assert(suspendedLoginRes.status === 401, 'Suspended company admin login rejected with HTTP 401', `Got ${suspendedLoginRes.status}`);

    // Reactivate company
    const activateRes = await request('PATCH', `/api/platform/companies/${createdCompanyId}/status`, {
      isActive: true,
      reason: 'Issue resolved',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(activateRes.status === 200, 'SuperAdmin reactivates company', `Got ${activateRes.status}: ${JSON.stringify(activateRes.data)}`);

    // -------------------------------------------------------------------------
    // SECTION 4: MODULE ACCESS CONTROL ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Module Access Control Enforcement ---');

    // Refresh newAdminToken
    const restoredAdminLogin = await request('POST', '/api/auth/login', {
      username: createdAdminUsername,
      password: 'InitialPassword123!',
    });
    const activeNewAdminToken = restoredAdminLogin.data?.data?.token;

    // Recall: DISPOSABLES was NOT in enabledModules for this company (only SERVICES, PRODUCTS, STAFF)
    // 4.1 Company Admin accessing disabled module returns 403 Forbidden
    const disabledModuleRes = await request('GET', '/api/disposables', undefined, {
      Authorization: `Bearer ${activeNewAdminToken}`,
    });
    assert(disabledModuleRes.status === 403, 'Access to disabled module DISPOSABLES returns HTTP 403 Forbidden');
    assert(disabledModuleRes.data?.message.includes('not enabled'), 'Error indicates module is not enabled');

    // 4.2 Company Admin accessing enabled module returns 200 OK
    const enabledModuleRes = await request('GET', '/api/services', undefined, {
      Authorization: `Bearer ${activeNewAdminToken}`,
    });
    assert(enabledModuleRes.status === 200, 'Access to enabled module SERVICES returns HTTP 200 OK');

    // 4.3 SuperAdmin enables DISPOSABLES module for this company
    const enableModRes = await request('PATCH', `/api/platform/companies/${createdCompanyId}/modules`, {
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF'],
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(enableModRes.status === 200, 'SuperAdmin enables DISPOSABLES module');

    // 4.4 Company Admin can now access DISPOSABLES
    const reaccessDispRes = await request('GET', '/api/disposables', undefined, {
      Authorization: `Bearer ${activeNewAdminToken}`,
    });
    assert(reaccessDispRes.status === 200, 'DISPOSABLES module now accessible (HTTP 200 OK)');

    // -------------------------------------------------------------------------
    // SECTION 5: SUPERADMIN IMPERSONATION FLOW & INVARIANTS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. SuperAdmin Impersonation Flow & Security Invariants ---');

    // 5.1 SuperAdmin starts impersonation for the company
    const impersonateRes = await request('POST', `/api/platform/companies/${createdCompanyId}/impersonate`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(impersonateRes.status === 200, 'SuperAdmin starts impersonation session (HTTP 200)');
    assert(impersonateRes.data?.data?.impersonating === true, 'Response marks impersonating as true');
    assert(impersonateRes.data?.data?.targetCompany?.id === createdCompanyId, 'Target company matches');
    const impToken = impersonateRes.data?.data?.token;

    // 5.2 Verify token payload
    const decodedImp: any = jwt.decode(impToken);
    assert(decodedImp.impersonating === true, 'JWT has impersonating = true');
    assert(decodedImp.targetTenantId === createdCompanyId, 'JWT has targetTenantId = companyId');
    assert(decodedImp.role === 'SUPERADMIN', 'JWT role remains SUPERADMIN (never downgraded)');

    // 5.3 Verify database invariant: SuperAdmin database user is NEVER altered
    const dbSuper = await prisma.user.findUnique({
      where: { username: 'superadmin' },
      include: { role: true },
    });
    assert(dbSuper?.role.name === 'SUPERADMIN', 'DB SuperAdmin role is still SUPERADMIN in database');
    assert(dbSuper?.tenantId === null, 'DB SuperAdmin tenantId is still null in database');

    // 5.4 Impersonating SuperAdmin accessing /api/auth/me
    const impMe = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impMe.status === 200, 'Impersonating SuperAdmin /api/auth/me returns 200');
    assert(impMe.data?.data?.impersonating === true, 'auth/me indicates impersonating');
    assert(impMe.data?.data?.effectiveTenantId === createdCompanyId, 'effectiveTenantId scoped to company');
    assert(impMe.data?.data?.isSuperAdmin === true, 'isSuperAdmin remains true');

    // 5.5 Impersonating SuperAdmin creates a product in the impersonated company
    // First create a category in the impersonated company
    const impCat = await request('POST', '/api/product-categories', {
      name: 'Elysian Aromas',
    }, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impCat.status === 201, 'Impersonating SuperAdmin creates product category in company');
    const impCatId = impCat.data?.data?.id;

    const impProd = await request('POST', '/api/products', {
      name: 'Elysian Lavender Oil',
      categoryId: impCatId,
      price: 250,
      storeSku: 'ELY-LAV-01',
      barcode: '8909999990001',
    }, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impProd.status === 201, 'Impersonating SuperAdmin creates product in company');
    const impProdId = impProd.data?.data?.id;

    // Verify created product belongs to the impersonated company in DB
    const dbImpProd = await prisma.product.findUnique({
      where: { id: impProdId },
    });
    assert(dbImpProd?.tenantId === createdCompanyId, 'Product created by impersonator has company tenantId in DB');

    // 5.6 Company-to-Company switching blocked while impersonating
    const switchRes = await request('POST', `/api/platform/companies/${companyAId}/impersonate`, undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(switchRes.status === 403, 'Direct company-to-company impersonation switch is blocked (HTTP 403)');

    // 5.7 Real-time status revalidation during active impersonation
    // SuperAdmin suspends the company via platform context
    await request('PATCH', `/api/platform/companies/${createdCompanyId}/status`, {
      isActive: false,
      reason: 'Audit investigation',
    }, {
      Authorization: `Bearer ${superToken}`,
    });

    // Impersonating token is immediately rejected on next API call even if token has not expired
    const impBlockedRes = await request('GET', '/api/products', undefined, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(impBlockedRes.status === 401, 'Impersonation request rejected when company suspended (real-time check)');

    // Reactivate company
    await request('PATCH', `/api/platform/companies/${createdCompanyId}/status`, {
      isActive: true,
    }, {
      Authorization: `Bearer ${superToken}`,
    });

    // 5.8 Exit Impersonation endpoint
    const exitRes = await request('POST', '/api/platform/impersonate/exit', {
      targetTenantId: createdCompanyId,
    }, {
      Authorization: `Bearer ${impToken}`,
    });
    assert(exitRes.status === 200, 'Exit impersonation succeeds (HTTP 200)');

    // -------------------------------------------------------------------------
    // SECTION 6: ZERO CROSS-TENANT DATA COLLISION & LEAKAGE
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Zero Cross-Tenant Data Collision & Isolation ---');

    // Company A Admin tries to access the product created in the Elysian company
    const crossAccessProduct = await request('GET', `/api/products/${impProdId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(crossAccessProduct.status === 404, 'Company A cannot view Elysian product by ID (HTTP 404 Not Found)');

    // Company A Admin tries to update the product created in the Elysian company
    const crossUpdateProduct = await request('PUT', `/api/products/${impProdId}`, {
      price: 1,
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(crossUpdateProduct.status === 404, 'Company A cannot update Elysian product by ID (HTTP 404 Not Found)');

    // Company A Admin tries to delete the product created in the Elysian company
    const crossDeleteProduct = await request('DELETE', `/api/products/${impProdId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(crossDeleteProduct.status === 404, 'Company A cannot delete Elysian product by ID (HTTP 404 Not Found)');

    // -------------------------------------------------------------------------
    // SECTION 7: MULTI-COMPANY COLLISION RESISTANCE (IDENTICAL SKU/BARCODE/NAME)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Multi-Company Collision Resistance ---');

    // Company A creates "Signature Pomade" with SKU "SKU-SHARED-99" and barcode "8908888888888"
    const catA = await prisma.productCategory.create({
      data: {
        tenantId: companyAId,
        name: 'Shared Hair Styling Category',
      },
    });

    const prodA = await request('POST', '/api/products', {
      name: 'Signature Pomade',
      categoryId: catA.id,
      price: 100,
      storeSku: 'SKU-SHARED-99',
      barcode: '8908888888888',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(prodA.status === 201, 'Company A creates Signature Pomade with SKU-SHARED-99');

    // Company B (Elysian) creates IDENTICAL product name, IDENTICAL SKU, and IDENTICAL barcode
    const prodB = await request('POST', '/api/products', {
      name: 'Signature Pomade',
      categoryId: impCatId,
      price: 150,
      storeSku: 'SKU-SHARED-99',
      barcode: '8908888888888',
    }, {
      Authorization: `Bearer ${activeNewAdminToken}`,
    });
    assert(prodB.status === 201, 'Company B creates IDENTICAL Signature Pomade with same SKU and Barcode (No Collision)');

    // List products in Company A -> only 1 Signature Pomade
    const listA = await request('GET', '/api/products?search=Signature+Pomade', undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(listA.data?.data?.items?.length === 1, 'Company A sees only its own Signature Pomade');
    assert(Number(listA.data?.data?.items[0]?.price) === 100, 'Company A sees its own price 100');

    // List products in Company B -> only 1 Signature Pomade
    const listB = await request('GET', '/api/products?search=Signature+Pomade', undefined, {
      Authorization: `Bearer ${activeNewAdminToken}`,
    });
    assert(listB.data?.data?.items?.length === 1, 'Company B sees only its own Signature Pomade');
    assert(Number(listB.data?.data?.items[0]?.price) === 150, 'Company B sees its own price 150');

    // Delete in Company A does not affect Company B
    const delA = await request('DELETE', `/api/products/${prodA.data?.data?.id}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(delA.status === 200, 'Company A deletes its Signature Pomade');

    const checkB = await request('GET', `/api/products/${prodB.data?.data?.id}`, undefined, {
      Authorization: `Bearer ${activeNewAdminToken}`,
    });
    assert(checkB.status === 200, 'Company B Signature Pomade is completely intact and unaffected');

    // -------------------------------------------------------------------------
    // SECTION 8: PLATFORM AUDIT LOGGING VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Platform Audit Logging Verification ---');

    const auditLogsRes = await request('GET', '/api/platform/audit-logs', undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(auditLogsRes.status === 200, 'SuperAdmin can query platform audit logs');
    const logs = auditLogsRes.data?.data?.items || [];
    assert(Array.isArray(logs), 'Audit logs returned as array');

    const actions = logs.map((l: any) => l.action);
    assert(actions.includes('COMPANY_CREATED'), 'Audit log contains COMPANY_CREATED');
    assert(actions.includes('IMPERSONATION_STARTED'), 'Audit log contains IMPERSONATION_STARTED');
    assert(actions.includes('IMPERSONATION_ENDED'), 'Audit log contains IMPERSONATION_ENDED');
    assert(actions.includes('SUBSCRIPTION_UPDATED'), 'Audit log contains SUBSCRIPTION_UPDATED');
    assert(actions.includes('MODULES_UPDATED'), 'Audit log contains MODULES_UPDATED');

    // -------------------------------------------------------------------------
    // SECTION 9: ENRICHED METRICS, MODULES, ADMIN & CASHIER MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Enriched Metrics, Modules, Admin & Cashier Management ---');

    // 9.1 Platform Metrics Overview
    const metricsRes = await request('GET', '/api/platform/metrics/overview', undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(metricsRes.status === 200, 'SuperAdmin can fetch enriched metrics overview');
    const metrics = metricsRes.data?.data;
    assert(typeof metrics?.totalCompanies === 'number', 'Metrics includes totalCompanies');
    assert(typeof metrics?.activeCompanies === 'number', 'Metrics includes activeCompanies');
    assert(typeof metrics?.inactiveCompanies === 'number', 'Metrics includes inactiveCompanies');
    assert(typeof metrics?.expiredCompanies === 'number', 'Metrics includes expiredCompanies');
    assert(typeof metrics?.totalAdmins === 'number' && metrics.totalAdmins > 0, 'Metrics includes totalAdmins > 0');
    assert(typeof metrics?.totalCashiers === 'number', 'Metrics includes totalCashiers');
    assert(typeof metrics?.activeSubscriptions === 'number', 'Metrics includes activeSubscriptions');
    assert(Array.isArray(metrics?.alerts), 'Metrics includes system alerts array');

    // 9.2 Platform Modules Catalog
    const modulesRes = await request('GET', '/api/platform/modules', undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(modulesRes.status === 200, 'SuperAdmin can fetch available modules catalog');
    const availableModules = modulesRes.data?.data;
    assert(Array.isArray(availableModules), 'Modules catalog returned as array');
    const modCodes = availableModules.map((m: any) => m.code);
    assert(modCodes.includes('SERVICES') && modCodes.includes('PRODUCTS') && modCodes.includes('STAFF'), 'Modules catalog includes core salon modules');

    // 9.3 Global Admins Listing
    const allAdminsRes = await request('GET', '/api/platform/admins', undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(allAdminsRes.status === 200, 'SuperAdmin can list all system admins via GET /api/platform/admins');
    assert(Array.isArray(allAdminsRes.data?.data) && allAdminsRes.data.data.length > 0, 'System admins list is non-empty');

    // 9.4 Company-scoped Admins Listing
    const companyAdminsRes = await request('GET', `/api/platform/companies/${companyAId}/admins`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(companyAdminsRes.status === 200, 'SuperAdmin can list admins for Company A');
    const compAAdmins = companyAdminsRes.data?.data || [];
    assert(compAAdmins.length > 0, 'Company A has at least one admin');
    const targetAdmin = compAAdmins[0];

    // 9.5 Get specific Admin by ID
    const singleAdminRes = await request('GET', `/api/platform/companies/${companyAId}/admins/${targetAdmin.id}`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(singleAdminRes.status === 200, 'SuperAdmin can get specific admin by ID');
    assert(singleAdminRes.data?.data?.id === targetAdmin.id, 'Retrieved admin matches requested admin ID');

    // 9.6 Update Admin details
    const updateAdminRes = await request('PUT', `/api/platform/companies/${companyAId}/admins/${targetAdmin.id}`, {
      phone: '+1-555-987-6543',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(updateAdminRes.status === 200, 'SuperAdmin can update company admin phone/profile');
    assert(updateAdminRes.data?.data?.phone === '+1-555-987-6543', 'Admin phone successfully updated');

    // 9.7 Admin Status Deactivation & Activation
    const deactivateAdminRes = await request('PATCH', `/api/platform/companies/${companyAId}/admins/${targetAdmin.id}/status`, {
      status: 'INACTIVE',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(deactivateAdminRes.status === 200, 'SuperAdmin can deactivate company admin');
    assert(deactivateAdminRes.data?.data?.status === 'INACTIVE', 'Admin status is now INACTIVE');

    // Verify deactivated admin cannot log in
    const inactiveLoginRes = await request('POST', '/api/auth/login', {
      username: targetAdmin.username,
      password: 'DevelopmentPassword123!',
    });
    assert(inactiveLoginRes.status === 401, 'Deactivated admin cannot log in (HTTP 401)');

    // Reactivate admin
    const reactivateAdminRes = await request('PATCH', `/api/platform/companies/${companyAId}/admins/${targetAdmin.id}/status`, {
      status: 'ACTIVE',
    }, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(reactivateAdminRes.status === 200, 'SuperAdmin can reactivate company admin');
    assert(reactivateAdminRes.data?.data?.status === 'ACTIVE', 'Admin status restored to ACTIVE');

    // Verify reactivated admin can log in
    const reactivatedLoginRes = await request('POST', '/api/auth/login', {
      username: targetAdmin.username,
      password: 'DevelopmentPassword123!',
    });
    assert(reactivatedLoginRes.status === 200, 'Reactivated admin can log in again successfully (HTTP 200)');

    // 9.8 Company Cashiers Listing
    const cashiersRes = await request('GET', `/api/platform/companies/${companyAId}/cashiers`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(cashiersRes.status === 200, 'SuperAdmin can list cashiers for Company A');
    assert(Array.isArray(cashiersRes.data?.data), 'Company cashiers returned as array');

    // 9.9 Company Subscription History
    const historyRes = await request('GET', `/api/platform/companies/${companyAId}/subscription-history`, undefined, {
      Authorization: `Bearer ${superToken}`,
    });
    assert(historyRes.status === 200, 'SuperAdmin can retrieve subscription history and audit trail');
    assert(historyRes.data?.data?.company?.id === companyAId, 'Subscription history contains company profile');
    assert(Array.isArray(historyRes.data?.data?.history), 'Subscription history contains audit log events array');

    // Clean up test data
    await prisma.product.deleteMany({
      where: { id: { in: [impProdId, prodB.data?.data?.id] } },
    });
    await prisma.productCategory.deleteMany({
      where: { id: { in: [impCatId, catA.id] } },
    });

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log(`Platform Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
