import { execSync } from 'child_process';

console.log('\n========================================');
console.log('   RUNNING ALL TEST SUITES IN SEQUENCE');
console.log('========================================\n');

function run(cmd: string, name: string) {
  console.log(`\n>>> Running: ${name} (${cmd})`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('npx tsx tests/auth.test.ts', 'Module 01: Authentication');
  run('npx tsx tests/staff.test.ts', 'Module 02: Staff Agent');
  run('npx tsx tests/service-categories.test.ts', 'Module 03: Service Categories');
  run('npx tsx tests/services.test.ts', 'Module 04: Services');
  run('npx tsx tests/product-categories.test.ts', 'Module 05: Product Categories');
  run('npx tsx tests/products.test.ts', 'Module 06: Products');
  run('npx tsx tests/disposables.test.ts', 'Module 07: Disposables');
  run('npx tsx tests/saas-isolation.test.ts', 'SaaS Multi-Tenant Isolation Suite');
  run('npx tsx tests/superadmin-platform.test.ts', 'Platform: SuperAdmin & Impersonation Suite');
  run('npx tsx tests/cashier-subscription.test.ts', 'Module 08: Cashier Management & Subscription Lifecycle');
  run('npx tsx tests/forgot-password-unified.test.ts', 'Final Unified Forgot Password Workflow Suite');
  run('npx tsx tests/resources.test.ts', 'Module 09: Resources');
  run('npx tsx tests/settings.test.ts', 'Module 10: Settings');
  run('npx tsx tests/guests.test.ts', 'Module 11: CRM Guests');
  run('npx tsx tests/pos.test.ts', 'Module 12: POS (Point of Sale)');
  run('npx tsx tests/appointments.test.ts', 'Module 13: Appointments & Scheduling (Calendar)');
  run('npx tsx tests/reports.test.ts', 'Module 14: Reports & Analytics (All 41 Reports)');
  run('npx tsx tests/inventory.test.ts', 'Module 15: Inventory & Stock Management');
  run('npx tsx tests/crm.test.ts', 'Module 16: CRM Guest 360 & Advanced Lifecycle');
  run('npx tsx tests/trends.test.ts', 'Module 17: Trends & Performance Analytics');
  run('npx tsx tests/cash-management.test.ts', 'Module 18: Cash Management');
  run('npx tsx tests/four-modules.test.ts', 'Module 19: Expenses, Enquiries/Referrals, Payroll, WhatsApp');
  run('npx tsx tests/four-modules-complete.test.ts', 'Module 19b: Deep Comprehensive Suite (232 Tests - Expenses, Enquiries, Referrals, Payroll, WhatsApp)');
  run('npx tsx tests/expenses-e2e.test.ts', 'Module 19c: Expenses Dedicated E2E Flow (72 Tests)');
  run('npx tsx tests/enquiries-e2e.test.ts', 'Module 19d: Enquiries & Referral Dashboard Dedicated E2E Flow (68 Tests)');
  run('npx tsx tests/payroll-e2e.test.ts', 'Module 19e: Payroll & Salary Management Dedicated E2E Flow (95 Tests)');
  console.log('\n========================================');
  console.log('   ALL TEST SUITES COMPLETED WITH 0 FAILURES');
  console.log('========================================\n');
} catch (e: any) {
  console.error('\n❌ Test execution failed:', e.message);
  process.exit(1);
}
