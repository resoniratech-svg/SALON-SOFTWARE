import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding authentication roles and permissions...');

  // 0. Seed Multi-Tenant Accounts
  const primaryTenant = await prisma.tenant.upsert({
    where: { code: 'primary-salon' },
    update: {
      plan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'RESOURCES', 'SETTINGS', 'CRM', 'GUESTS', 'POS'],
    },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Primary Salon Tenant',
      code: 'primary-salon',
      isActive: true,
      plan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'RESOURCES', 'SETTINGS', 'CRM', 'GUESTS', 'POS'],
    },
  });

  const secondaryTenant = await prisma.tenant.upsert({
    where: { code: 'secondary-salon' },
    update: {
      plan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'RESOURCES', 'SETTINGS', 'CRM', 'GUESTS', 'POS'],
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Secondary Salon Tenant',
      code: 'secondary-salon',
      isActive: true,
      plan: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      enabledModules: ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'RESOURCES', 'SETTINGS', 'CRM', 'GUESTS', 'POS'],
    },
  });

  // 1. Seed Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPERADMIN' },
    update: {},
    create: {
      name: 'SUPERADMIN',
      description: 'Platform Super Administrator with full platform-level authority',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator with full access to configuration & operations',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Branch / Floor Manager',
    },
  });

  const receptionistRole = await prisma.role.upsert({
    where: { name: 'RECEPTIONIST' },
    update: {},
    create: {
      name: 'RECEPTIONIST',
      description: 'Front-desk Receptionist',
    },
  });

  const stylistRole = await prisma.role.upsert({
    where: { name: 'STYLIST' },
    update: {},
    create: {
      name: 'STYLIST',
      description: 'Salon Stylist / Service Provider',
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: {
      name: 'CASHIER',
      description: 'Dedicated Cashier with assigned operational module privileges',
    },
  });

  // 2. Seed Permissions (Access Controls)
  const permissionsData = [
    // Module 01: Auth
    { module: 'AUTH', action: 'MANAGE', code: 'AUTH:MANAGE', description: 'Manage authentication & users' },
    { module: 'SETTINGS', action: 'MANAGE', code: 'SETTINGS:ACCESS_CONTROL:MANAGE', description: 'Configure Access Controls' },
    { module: 'SETTINGS', action: 'MANAGE', code: 'SETTINGS:MANAGE', description: 'Manage all company Settings' },
    { module: 'SETTINGS', action: 'TAX_MANAGE', code: 'SETTINGS:TAX:MANAGE', description: 'Manage tax mapping configuration' },
    { module: 'SETTINGS', action: 'BUSINESS_MANAGE', code: 'SETTINGS:BUSINESS:MANAGE', description: 'Manage business configuration' },
    { module: 'SETTINGS', action: 'READ', code: 'SETTINGS:READ', description: 'View Settings' },
    { module: 'POS', action: 'READ', code: 'POS:READ', description: 'Access Point of Sale & view orders' },
    { module: 'POS', action: 'CREATE', code: 'POS:CREATE', description: 'Create POS Quick Sale orders' },
    { module: 'POS', action: 'UPDATE', code: 'POS:UPDATE', description: 'Update POS orders' },
    { module: 'POS', action: 'DELETE', code: 'POS:DELETE', description: 'Delete / cancel POS orders' },
    { module: 'POS', action: 'MANAGE', code: 'POS:MANAGE', description: 'Full POS management' },
    { module: 'APPOINTMENT', action: 'READ', code: 'APPOINTMENT:READ', description: 'View Appointments' },
    // Module 02: Staff
    { module: 'STAFF', action: 'READ', code: 'STAFF:READ', description: 'View Staff list and profiles' },
    { module: 'STAFF', action: 'CREATE', code: 'STAFF:CREATE', description: 'Create Staff members' },
    { module: 'STAFF', action: 'UPDATE', code: 'STAFF:UPDATE', description: 'Update Staff members' },
    { module: 'STAFF', action: 'STATUS', code: 'STAFF:STATUS', description: 'Toggle Staff active/inactive status' },
    { module: 'STAFF', action: 'MANAGE', code: 'STAFF:MANAGE', description: 'Full Staff management' },
    // Module 03: Service Categories
    { module: 'SERVICE_CATEGORY', action: 'READ', code: 'SERVICE_CATEGORY:READ', description: 'View service categories' },
    { module: 'SERVICE_CATEGORY', action: 'CREATE', code: 'SERVICE_CATEGORY:CREATE', description: 'Create service categories' },
    { module: 'SERVICE_CATEGORY', action: 'UPDATE', code: 'SERVICE_CATEGORY:UPDATE', description: 'Update service categories' },
    { module: 'SERVICE_CATEGORY', action: 'STATUS', code: 'SERVICE_CATEGORY:STATUS', description: 'Toggle service category active/inactive status' },
    { module: 'SERVICE_CATEGORY', action: 'DELETE', code: 'SERVICE_CATEGORY:DELETE', description: 'Delete service category' },
    { module: 'SERVICE_CATEGORY', action: 'MANAGE', code: 'SERVICE_CATEGORY:MANAGE', description: 'Full service category management' },
    // Module 04: Services
    { module: 'SERVICE', action: 'READ', code: 'SERVICE:READ', description: 'View services' },
    { module: 'SERVICE', action: 'CREATE', code: 'SERVICE:CREATE', description: 'Create services' },
    { module: 'SERVICE', action: 'UPDATE', code: 'SERVICE:UPDATE', description: 'Update services' },
    { module: 'SERVICE', action: 'STATUS', code: 'SERVICE:STATUS', description: 'Toggle service active/inactive status' },
    { module: 'SERVICE', action: 'MANAGE', code: 'SERVICE:MANAGE', description: 'Full service management' },
    // Module 05: Product Categories
    { module: 'PRODUCT_CATEGORY', action: 'READ', code: 'PRODUCT_CATEGORY:READ', description: 'View product categories' },
    { module: 'PRODUCT_CATEGORY', action: 'CREATE', code: 'PRODUCT_CATEGORY:CREATE', description: 'Create product categories' },
    { module: 'PRODUCT_CATEGORY', action: 'UPDATE', code: 'PRODUCT_CATEGORY:UPDATE', description: 'Update product categories' },
    { module: 'PRODUCT_CATEGORY', action: 'STATUS', code: 'PRODUCT_CATEGORY:STATUS', description: 'Toggle product category active/inactive status' },
    { module: 'PRODUCT_CATEGORY', action: 'DELETE', code: 'PRODUCT_CATEGORY:DELETE', description: 'Delete product category' },
    { module: 'PRODUCT_CATEGORY', action: 'MANAGE', code: 'PRODUCT_CATEGORY:MANAGE', description: 'Full product category management' },
    // Module 06: Products
    { module: 'PRODUCT', action: 'READ', code: 'PRODUCT:READ', description: 'View products' },
    { module: 'PRODUCT', action: 'CREATE', code: 'PRODUCT:CREATE', description: 'Create products' },
    { module: 'PRODUCT', action: 'UPDATE', code: 'PRODUCT:UPDATE', description: 'Update products' },
    { module: 'PRODUCT', action: 'STATUS', code: 'PRODUCT:STATUS', description: 'Toggle product active/inactive status' },
    { module: 'PRODUCT', action: 'DELETE', code: 'PRODUCT:DELETE', description: 'Delete product' },
    { module: 'PRODUCT', action: 'MANAGE', code: 'PRODUCT:MANAGE', description: 'Full product management' },
    // Module 07: Disposables
    { module: 'DISPOSABLE', action: 'READ', code: 'DISPOSABLE:READ', description: 'View disposables' },
    { module: 'DISPOSABLE', action: 'CREATE', code: 'DISPOSABLE:CREATE', description: 'Create disposables' },
    { module: 'DISPOSABLE', action: 'UPDATE', code: 'DISPOSABLE:UPDATE', description: 'Update disposables' },
    { module: 'DISPOSABLE', action: 'STATUS', code: 'DISPOSABLE:STATUS', description: 'Toggle disposable active/inactive status' },
    { module: 'DISPOSABLE', action: 'DELETE', code: 'DISPOSABLE:DELETE', description: 'Delete disposable' },
    { module: 'DISPOSABLE', action: 'MANAGE', code: 'DISPOSABLE:MANAGE', description: 'Full disposable management' },
    // Module: Resources
    { module: 'RESOURCE', action: 'READ', code: 'RESOURCE:READ', description: 'View salon resources/rooms' },
    { module: 'RESOURCE', action: 'CREATE', code: 'RESOURCE:CREATE', description: 'Create salon resources/rooms' },
    { module: 'RESOURCE', action: 'UPDATE', code: 'RESOURCE:UPDATE', description: 'Update salon resources/rooms' },
    { module: 'RESOURCE', action: 'STATUS', code: 'RESOURCE:STATUS', description: 'Toggle resource active/inactive status' },
    { module: 'RESOURCE', action: 'DELETE', code: 'RESOURCE:DELETE', description: 'Delete salon resources/rooms' },
    { module: 'RESOURCE', action: 'MANAGE', code: 'RESOURCE:MANAGE', description: 'Full salon resource management' },
    // Module: Guests / CRM
    { module: 'CRM', action: 'READ', code: 'GUEST:READ', description: 'View guests and guest profiles' },
    { module: 'CRM', action: 'CREATE', code: 'GUEST:CREATE', description: 'Create guests' },
    { module: 'CRM', action: 'UPDATE', code: 'GUEST:UPDATE', description: 'Update guests' },
    { module: 'CRM', action: 'STATUS', code: 'GUEST:STATUS', description: 'Toggle guest active/blocked status' },
    { module: 'CRM', action: 'DELETE', code: 'GUEST:DELETE', description: 'Delete/deactivate guest' },
    { module: 'CRM', action: 'MANAGE', code: 'GUEST:MANAGE', description: 'Full guest management' },
  ];

  const createdPermissions = [];
  for (const perm of permissionsData) {
    const p = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
    createdPermissions.push(p);
  }

  // 3. Assign Permissions to SUPERADMIN and ADMIN role (All permissions)
  for (const perm of createdPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Assign POS:READ, APPOINTMENT:READ, STAFF:READ, SERVICE_CATEGORY:READ, SERVICE:READ, PRODUCT_CATEGORY:READ, PRODUCT:READ, DISPOSABLE:READ, RESOURCE:READ, GUEST:READ, GUEST:CREATE, GUEST:UPDATE to RECEPTIONIST
  for (const perm of createdPermissions.filter(p => ['POS:READ', 'APPOINTMENT:READ', 'STAFF:READ', 'SERVICE_CATEGORY:READ', 'SERVICE:READ', 'PRODUCT_CATEGORY:READ', 'PRODUCT:READ', 'DISPOSABLE:READ', 'RESOURCE:READ', 'GUEST:READ', 'GUEST:CREATE', 'GUEST:UPDATE'].includes(p.code))) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: receptionistRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: receptionistRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Assign operational permissions to CASHIER (includes RESOURCE:READ, SETTINGS:READ, GUEST:READ, GUEST:CREATE, GUEST:UPDATE, POS:CREATE)
  for (const perm of createdPermissions.filter(p => ['POS:READ', 'POS:CREATE', 'APPOINTMENT:READ', 'STAFF:READ', 'SERVICE_CATEGORY:READ', 'SERVICE:READ', 'PRODUCT_CATEGORY:READ', 'PRODUCT:READ', 'DISPOSABLE:READ', 'RESOURCE:READ', 'SETTINGS:READ', 'GUEST:READ', 'GUEST:CREATE', 'GUEST:UPDATE'].includes(p.code))) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: cashierRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: cashierRole.id,
        permissionId: perm.id,
      },
    });
  }

  // 4. Seed Development Users
  const defaultPasswordHash = await bcrypt.hash('DevelopmentPassword123!', 10);
  const superadminPasswordHash = await bcrypt.hash('SuperAdminSecretPassword123!', 10);

  // Platform SuperAdmin User (tenantId is null)
  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {
      passwordHash: superadminPasswordHash,
      roleId: superAdminRole.id,
      tenantId: null,
      isSuperAdmin: true,
      status: UserStatus.ACTIVE,
      phone: '+19999999999',
    },
    create: {
      username: 'superadmin',
      email: 'superadmin@respark.io',
      phone: '+19999999999',
      passwordHash: superadminPasswordHash,
      roleId: superAdminRole.id,
      tenantId: null,
      isSuperAdmin: true,
      status: UserStatus.ACTIVE,
    },
  });

  // Primary Tenant Users
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: defaultPasswordHash,
      roleId: adminRole.id,
      tenantId: primaryTenant.id,
      status: UserStatus.ACTIVE,
      phone: '+18888888888',
    },
    create: {
      username: 'admin',
      email: 'admin@respark.local',
      phone: '+18888888888',
      passwordHash: defaultPasswordHash,
      roleId: adminRole.id,
      tenantId: primaryTenant.id,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'receptionist' },
    update: {
      passwordHash: defaultPasswordHash,
      roleId: receptionistRole.id,
      tenantId: primaryTenant.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      username: 'receptionist',
      email: 'receptionist@respark.local',
      passwordHash: defaultPasswordHash,
      roleId: receptionistRole.id,
      tenantId: primaryTenant.id,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'inactive_user' },
    update: {
      passwordHash: defaultPasswordHash,
      roleId: receptionistRole.id,
      tenantId: primaryTenant.id,
      status: UserStatus.INACTIVE,
    },
    create: {
      username: 'inactive_user',
      email: 'inactive@respark.local',
      passwordHash: defaultPasswordHash,
      roleId: receptionistRole.id,
      tenantId: primaryTenant.id,
      status: UserStatus.INACTIVE,
    },
  });

  // Cashier User for Primary Tenant
  await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {
      passwordHash: defaultPasswordHash,
      roleId: cashierRole.id,
      tenantId: primaryTenant.id,
      enabledModules: ['POS', 'SERVICES', 'PRODUCTS', 'APPOINTMENT', 'CRM', 'GUESTS'],
      status: UserStatus.ACTIVE,
      phone: '+17777777777',
    },
    create: {
      username: 'cashier',
      email: 'cashier@respark.local',
      phone: '+17777777777',
      passwordHash: defaultPasswordHash,
      roleId: cashierRole.id,
      tenantId: primaryTenant.id,
      enabledModules: ['POS', 'SERVICES', 'PRODUCTS', 'APPOINTMENT', 'CRM', 'GUESTS'],
      status: UserStatus.ACTIVE,
    },
  });

  // Secondary Tenant Admin (for cross-tenant tests)
  await prisma.user.upsert({
    where: { username: 'admin-b' },
    update: {
      passwordHash: defaultPasswordHash,
      roleId: adminRole.id,
      tenantId: secondaryTenant.id,
      status: UserStatus.ACTIVE,
      phone: '+18888888889',
    },
    create: {
      username: 'admin-b',
      email: 'admin-b@respark.local',
      phone: '+18888888889',
      passwordHash: defaultPasswordHash,
      roleId: adminRole.id,
      tenantId: secondaryTenant.id,
      status: UserStatus.ACTIVE,
    },
  });

  // 5. Seed Designations (Staff prerequisite master)
  const designations = [
    { name: 'Hair Stylist', description: 'Performs hair cuts, styling, spa and hair chemical services' },
    { name: 'Senior Stylist', description: 'Senior professional stylist and salon floor lead' },
    { name: 'Therapist', description: 'Skin, massage and wellness treatments' },
    { name: 'Receptionist', description: 'Front-desk billing and appointment scheduling' },
  ];

  for (const t of [primaryTenant, secondaryTenant]) {
    for (const d of designations) {
      await prisma.designation.upsert({
        where: {
          tenantId_name: {
            tenantId: t.id,
            name: d.name,
          },
        },
        update: {},
        create: {
          tenantId: t.id,
          name: d.name,
          description: d.description,
        },
      });
    }
  }

  // 6. Seed Shifts (Shift Management prerequisite)
  const shifts = [
    { name: 'Morning Shift', startTime: '08:00', endTime: '17:00' },
    { name: 'General Shift', startTime: '10:00', endTime: '19:00' },
    { name: 'Evening Shift', startTime: '13:00', endTime: '22:00' },
  ];

  for (const t of [primaryTenant, secondaryTenant]) {
    for (const s of shifts) {
      await prisma.shift.upsert({
        where: {
          tenantId_name: {
            tenantId: t.id,
            name: s.name,
          },
        },
        update: {},
        create: {
          tenantId: t.id,
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
        },
      });
    }
  }

  // 7. Seed Resources (Rooms / Stations)
  const defaultResources = [
    { name: 'Room 1', capacity: 1, isActive: true, description: 'VIP Hair & Skin Treatment Room' },
    { name: 'Room 2', capacity: 2, isActive: true, description: 'General Styling Station & Wash Unit' },
  ];

  for (const r of defaultResources) {
    await prisma.resource.upsert({
      where: {
        tenantId_name: {
          tenantId: primaryTenant.id,
          name: r.name,
        },
      },
      update: {
        capacity: r.capacity,
        isActive: r.isActive,
        description: r.description,
      },
      create: {
        tenantId: primaryTenant.id,
        name: r.name,
        capacity: r.capacity,
        isActive: r.isActive,
        description: r.description,
      },
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
