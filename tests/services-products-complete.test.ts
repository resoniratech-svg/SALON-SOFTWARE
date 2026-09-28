import { prisma } from '../src/config/database.js';
import { serviceService } from '../src/modules/services/service.service.js';
import { productService } from '../src/modules/products/product.service.js';
import { serviceCategoryService } from '../src/modules/service-categories/service-category.service.js';
import { productCategoryService } from '../src/modules/product-categories/product-category.service.js';
import { Prisma } from '@prisma/client';

const RUN_ID = `sp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function run() {
  console.log('===============================================================');
  console.log(`  SERVICES & PRODUCTS MODULE COMPLETE E2E TEST SUITE [${RUN_ID}]`);
  console.log('===============================================================\n');

  // 1. Setup Tenants and Vendors
  const tenants = await prisma.tenant.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
  if (tenants.length < 2) {
    throw new Error('At least 2 tenants must exist in the database');
  }

  const tenantA = tenants[0];
  const tenantB = tenants[1];
  const tenantAId = tenantA.id;
  const tenantBId = tenantB.id;

  // Create a vendor for supplier integration test
  const vendor = await prisma.vendor.create({
    data: {
      tenantId: tenantAId,
      vendorName: `Vendor_${RUN_ID}`,
      firmName: `Firm_${RUN_ID}`,
      mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      address: '123 Market St',
      city: 'Pune',
    },
  });

  // Track created entities for clean cleanup
  const createdServiceCategoryIds: string[] = [];
  const createdProductCategoryIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  try {
    // ==============================================================
    // SUITE 1: 1:1 VIDEO FLOW — CENTRALISED SERVICE CATEGORIES
    // ==============================================================
    console.log('--- 1. 1:1 Video Flow: Centralised Service Categories ---');

    // 1.1 Root category: HAIR (stores: kalyaninagar, wadgaon)
    const hairCat = await serviceCategoryService.create(tenantAId, {
      name: `HAIR_${RUN_ID}`,
      position: 1,
      group: 'Both',
      hideFromCatalogue: false,
      stores: ['kalyaninagar', 'wadgaon'],
    });
    createdServiceCategoryIds.push(hairCat.id);
    assert(hairCat.name === `HAIR_${RUN_ID}`, 'Root service category HAIR created');
    assert(Array.isArray(hairCat.stores) && (hairCat.stores as string[]).includes('kalyaninagar'), 'Stores assigned to HAIR');

    // 1.2 Root category: skin (store: kalyaninagar)
    const skinCat = await serviceCategoryService.create(tenantAId, {
      name: `skin_${RUN_ID}`,
      position: 2,
      group: 'Female',
      hideFromCatalogue: false,
      stores: ['kalyaninagar'],
    });
    createdServiceCategoryIds.push(skinCat.id);
    assert(skinCat.name === `skin_${RUN_ID}`, 'Root service category skin created');

    // 1.3 Subcategory under skin: facial
    const facialSubcat = await serviceCategoryService.create(tenantAId, {
      name: `facial_${RUN_ID}`,
      parentId: skinCat.id,
      position: 1,
      group: 'Female',
      hideFromCatalogue: false,
      stores: ['kalyaninagar'],
    });
    createdServiceCategoryIds.push(facialSubcat.id);
    assert(facialSubcat.parentId === skinCat.id, 'Subcategory facial created with parent skin');

    // 1.4 Subcategory under HAIR: Hair Spa | Color
    const hairSpaSubcat = await serviceCategoryService.create(tenantAId, {
      name: `Hair Spa | Color_${RUN_ID}`,
      parentId: hairCat.id,
      position: 1,
      group: 'Both',
      hideFromCatalogue: false,
      stores: ['kalyaninagar', 'wadgaon'],
    });
    createdServiceCategoryIds.push(hairSpaSubcat.id);
    assert(hairSpaSubcat.parentId === hairCat.id, 'Subcategory Hair Spa | Color created with parent HAIR');

    // 1.5 Hierarchy Tree query
    const tree = await serviceCategoryService.list(tenantAId, { tree: true });
    const hairInTree = tree.find((c: any) => c.id === hairCat.id);
    assert(!!hairInTree, 'Root category found in tree');
    assert(hairInTree?.children && hairInTree.children.length >= 1, 'Children included in category tree');

    // 1.6 Store filter query
    const kalyaniCats = await serviceCategoryService.list(tenantAId, { store: 'kalyaninagar' });
    assert(kalyaniCats.some((c: any) => c.id === hairCat.id), 'Category returned when matching store filter');

    // ==============================================================
    // SUITE 2: 1:1 VIDEO FLOW — ADD SERVICE (Hair Spa Loreal)
    // ==============================================================
    console.log('\n--- 2. 1:1 Video Flow: Add Service (Hair Spa Loreal) ---');

    const lorealService = await serviceService.create(tenantAId, {
      name: `Hair Spa Loreal_${RUN_ID}`,
      categoryId: hairCat.id,
      subcategoryId: hairSpaSubcat.id,
      position: 1,
      hour: 0,
      minute: 45,
      durationMinutes: 45,
      serviceReminderDays: 30,
      sacCode: '999721',
      serviceTag: 'Haircare',
      group: 'Both',
      hideFromCatalogue: false,
      price: 800.0,
      salePrice: 0.0,
      isNonDiscountable: true,
      description: 'Loreal professional hair spa treatment',
      consumables: [{ name: 'Loreal Cream Bath', quantity: 50, unit: 'ml' }],
      resourceIds: ['Room 1'],
    });
    createdServiceIds.push(lorealService.id);

    assert(lorealService.name === `Hair Spa Loreal_${RUN_ID}`, 'Service created with exact name');
    assert(Number(lorealService.price) === 800.0, 'Service price is 800.00');
    assert(lorealService.durationMinutes === 45, 'Duration is 45 minutes');
    assert(lorealService.sacCode === '999721', 'SAC Code correctly stored');
    assert(lorealService.subcategoryId === hairSpaSubcat.id, 'Subcategory linked to service');
    assert(lorealService.category?.name === `HAIR_${RUN_ID}`, 'Category relation populated');

    // ==============================================================
    // SUITE 3: 1:1 VIDEO FLOW — CENTRALISED PRODUCT CATEGORIES
    // ==============================================================
    console.log('\n--- 3. 1:1 Video Flow: Centralised Product Categories ---');

    // 3.1 Product Category: cream
    const creamCat = await productCategoryService.create(tenantAId, {
      name: `cream_${RUN_ID}`,
      position: 1,
      group: 'Both',
      stores: ['kalyaninagar'],
    });
    createdProductCategoryIds.push(creamCat.id);
    assert(creamCat.name === `cream_${RUN_ID}`, 'Product category cream created');

    // 3.2 Product Subcategory: cream items
    const creamSubcat = await productCategoryService.create(tenantAId, {
      name: `cream_sub_${RUN_ID}`,
      parentId: creamCat.id,
      position: 1,
      stores: ['kalyaninagar'],
    });
    createdProductCategoryIds.push(creamSubcat.id);
    assert(creamSubcat.parentId === creamCat.id, 'Product subcategory linked to parent cream');

    // ==============================================================
    // SUITE 4: 1:1 VIDEO FLOW — ADD PRODUCT (fair and lovely)
    // ==============================================================
    console.log('\n--- 4. 1:1 Video Flow: Add Product (fair and lovely) with Stock ---');

    const fairProduct = await productService.create(tenantAId, {
      name: `fair and lovely_${RUN_ID}`,
      categoryId: creamCat.id,
      subcategoryId: creamSubcat.id,
      position: 1,
      hsnCode: '330499',
      productTag: 'fgh',
      storeSku: `sku_${RUN_ID}`,
      barcode: `bar_${RUN_ID}`,
      group: 'Both',
      hideFromCatalogue: false,
      price: 10.0,
      salePrice: 20.0,
      purchasePrice: 8.0,
      isNonDiscountable: true,
      description: 'fair and lovely fairness cream',
      supplierId: vendor.id,
      initialStock: 50,
      location: 'kalyaninagar',
      taxes: [{ name: 'GST', rate: 18, type: 'percentage' }],
      variations: [{ name: '50g', price: 10, salePrice: 20 }],
    });
    createdProductIds.push(fairProduct.id);

    assert(fairProduct.name === `fair and lovely_${RUN_ID}`, 'Product fair and lovely created');
    assert(Number(fairProduct.price) === 10.0, 'Product price is 10.00');
    assert(Number(fairProduct.salePrice) === 20.0, 'Sale price is 20.00');
    assert(Number(fairProduct.purchasePrice) === 8.0, 'Purchase price is 8.00');
    assert(fairProduct.hsnCode === '330499', 'HSN code is 330499');
    assert(fairProduct.productTag === 'fgh', 'Product tag is fgh');
    assert(fairProduct.storeSku === `sku_${RUN_ID}`, 'Store SKU is stored');
    assert(fairProduct.supplierId === vendor.id, 'Supplier linked to product');

    // 4.1 Verify Initial Stock Transaction Created in Database
    const stockTx = await prisma.stockTransaction.findFirst({
      where: { tenantId: tenantAId, productId: fairProduct.id },
    });
    assert(!!stockTx, 'Stock transaction created automatically');
    assert(stockTx?.type === 'INWARD', 'Stock transaction type is INWARD');
    assert(Number(stockTx?.quantity) === 50, 'Stock quantity is 50');
    assert(stockTx?.destinationStore === 'kalyaninagar', 'Stock destination store matches location');

    // 4.2 Verify Computed Current Stock on Product Query
    const productWithStock = await productService.getById(tenantAId, fairProduct.id);
    assert((productWithStock as any).currentStock === 50, 'Computed currentStock returns 50');

    // ==============================================================
    // SUITE 5: PRICING & DECIMAL PRECISION
    // ==============================================================
    console.log('\n--- 5. Pricing & Decimal Edge Cases ---');

    // 5.1 Decimal price (e.g. 199.99)
    const decimalService = await serviceService.create(tenantAId, {
      name: `Decimal Svc_${RUN_ID}`,
      categoryId: hairCat.id,
      price: 199.99,
      salePrice: 149.50,
    });
    createdServiceIds.push(decimalService.id);
    assert(Number(decimalService.price) === 199.99, 'Decimal price 199.99 stored accurately');
    assert(Number(decimalService.salePrice) === 149.50, 'Decimal sale price 149.50 stored accurately');

    // 5.2 Zero price
    const freeService = await serviceService.create(tenantAId, {
      name: `Free Consultation_${RUN_ID}`,
      categoryId: hairCat.id,
      price: 0,
      salePrice: 0,
    });
    createdServiceIds.push(freeService.id);
    assert(Number(freeService.price) === 0, 'Zero price service permitted for free consultations');

    // 5.3 Large price (e.g. 50000.00)
    const bridalService = await serviceService.create(tenantAId, {
      name: `Premium Bridal Package_${RUN_ID}`,
      categoryId: hairCat.id,
      price: 50000.0,
    });
    createdServiceIds.push(bridalService.id);
    assert(Number(bridalService.price) === 50000.0, 'Large price 50000.00 stored accurately');

    // ==============================================================
    // SUITE 6: DURATION EDGE CASES
    // ==============================================================
    console.log('\n--- 6. Duration Edge Cases ---');

    // 6.1 Hour & Minute calculation: 1 hour 30 minutes = 90 min
    const ninetyMinService = await serviceService.create(tenantAId, {
      name: `Keratin Treatment_${RUN_ID}`,
      categoryId: hairCat.id,
      hour: 1,
      minute: 30,
      price: 3500,
    });
    createdServiceIds.push(ninetyMinService.id);
    assert(ninetyMinService.durationMinutes === 90, '1 hr 30 min computed as 90 durationMinutes');

    // 6.2 Zero duration
    const zeroDurService = await serviceService.create(tenantAId, {
      name: `Quick Polish_${RUN_ID}`,
      categoryId: hairCat.id,
      hour: 0,
      minute: 0,
      price: 100,
    });
    createdServiceIds.push(zeroDurService.id);
    assert(zeroDurService.durationMinutes === 0, 'Zero duration handled correctly');

    // ==============================================================
    // SUITE 7: BARCODE & SKU UNIQUENESS
    // ==============================================================
    console.log('\n--- 7. Barcode & SKU Uniqueness ---');

    // 7.1 Barcode generator produces unique value
    const autoBarcode = await productService.generateBarcode(tenantAId);
    assert(typeof autoBarcode === 'string' && autoBarcode.length >= 10, 'Barcode generated with valid length');

    // 7.2 Duplicate barcode in same tenant rejected
    let dupBarcodeFailed = false;
    try {
      await productService.create(tenantAId, {
        name: `Duplicate Barcode Prod_${RUN_ID}`,
        categoryId: creamCat.id,
        price: 50,
        barcode: `bar_${RUN_ID}`, // same as fairProduct
      });
    } catch (err: any) {
      dupBarcodeFailed = true;
      assert(err.statusCode === 409, 'Duplicate barcode rejected with 409 Conflict');
    }
    assert(dupBarcodeFailed, 'Cannot create product with duplicate barcode');

    // 7.3 Duplicate store SKU in same tenant rejected
    let dupSkuFailed = false;
    try {
      await productService.create(tenantAId, {
        name: `Duplicate SKU Prod_${RUN_ID}`,
        categoryId: creamCat.id,
        price: 50,
        storeSku: `sku_${RUN_ID}`, // same as fairProduct
      });
    } catch (err: any) {
      dupSkuFailed = true;
      assert(err.statusCode === 409, 'Duplicate store SKU rejected with 409 Conflict');
    }
    assert(dupSkuFailed, 'Cannot create product with duplicate store SKU');

    // ==============================================================
    // SUITE 8: SEARCH & FILTER MATRIX
    // ==============================================================
    console.log('\n--- 8. Search & Filter Matrix ---');

    // 8.1 Services search by exact and partial name
    const svcSearchExact = await serviceService.list(tenantAId, { search: `Hair Spa Loreal_${RUN_ID}` });
    assert(svcSearchExact.length === 1, 'Search service by exact name found 1 record');

    const svcSearchPartial = await serviceService.list(tenantAId, { search: 'Loreal' });
    assert(svcSearchPartial.some((s: any) => s.id === lorealService.id), 'Search service by partial name found record');

    // 8.2 Services filter by category & subcategory
    const svcCatFilter = await serviceService.list(tenantAId, { categoryId: hairCat.id });
    assert(svcCatFilter.some((s: any) => s.id === lorealService.id), 'Filter service by categoryId returned matches');

    const svcSubcatFilter = await serviceService.list(tenantAId, { subcategoryId: hairSpaSubcat.id });
    assert(svcSubcatFilter.some((s: any) => s.id === lorealService.id), 'Filter service by subcategoryId returned matches');

    // 8.3 Products search by barcode & SKU
    const prodByBarcode = await productService.list(tenantAId, { search: `bar_${RUN_ID}` });
    assert(prodByBarcode.items.some((p: any) => p.id === fairProduct.id), 'Product searched by barcode found');

    const prodBySku = await productService.list(tenantAId, { search: `sku_${RUN_ID}` });
    assert(prodBySku.items.some((p: any) => p.id === fairProduct.id), 'Product searched by store SKU found');

    // 8.4 Products filter by supplier
    const prodBySupplier = await productService.list(tenantAId, { supplierId: vendor.id });
    assert(prodBySupplier.items.some((p: any) => p.id === fairProduct.id), 'Product filtered by supplier found');

    // ==============================================================
    // SUITE 9: INVENTORY INTEGRATION & STOCK MOVEMENTS
    // ==============================================================
    console.log('\n--- 9. Inventory Integration & Stock Movement ---');

    // Record an OUTWARD stock transaction (sale/consumption) of 15 units
    await prisma.stockTransaction.create({
      data: {
        tenantId: tenantAId,
        productId: fairProduct.id,
        type: 'OUTWARD',
        quantity: new Prisma.Decimal(15),
        unitPrice: new Prisma.Decimal(10),
        totalAmount: new Prisma.Decimal(150),
        notes: 'POS Sale Outward',
      },
    });

    const updatedStockProd = await productService.getById(tenantAId, fairProduct.id);
    assert((updatedStockProd as any).currentStock === 35, 'Stock reduced from 50 to 35 after OUTWARD transaction');

    // ==============================================================
    // SUITE 10: EDIT SERVICE & PRODUCT (NON-DESTRUCTIVE)
    // ==============================================================
    console.log('\n--- 10. Edit Service & Product Details ---');

    // 10.1 Edit Service details
    const updatedSvc = await serviceService.update(tenantAId, lorealService.id, {
      name: `Hair Spa Loreal Deluxe_${RUN_ID}`,
      price: 950.0,
      hour: 1,
      minute: 0,
      description: 'Updated deluxe formula',
    });
    assert(updatedSvc.name === `Hair Spa Loreal Deluxe_${RUN_ID}`, 'Service name updated');
    assert(Number(updatedSvc.price) === 950.0, 'Service price updated to 950.00');
    assert(updatedSvc.durationMinutes === 60, 'Service duration updated to 60 minutes');

    // 10.2 Edit Product details
    const updatedProd = await productService.update(tenantAId, fairProduct.id, {
      price: 15.0,
      salePrice: 25.0,
      description: 'Updated fair and lovely advanced multi-vitamin',
    });
    assert(Number(updatedProd.price) === 15.0, 'Product price updated to 15.00');
    assert(Number(updatedProd.salePrice) === 25.0, 'Product sale price updated to 25.00');

    // ==============================================================
    // SUITE 11: HISTORICAL SALES / POS DATA INTEGRITY
    // ==============================================================
    console.log('\n--- 11. Historical Sales / POS Data Consistency & Protection ---');

    // 11.1 Create historical POS order snapshotting service & product
    const guest = await prisma.guest.findFirst({ where: { tenantId: tenantAId } })
      || await prisma.guest.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Customer',
          lastName: 'Test',
          mobile: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      });

    const historicalOrder = await prisma.posOrder.create({
      data: {
        tenant: { connect: { id: tenantAId } },
        guest: { connect: { id: guest.id } },
        orderNumber: `ORD_${RUN_ID}`,
        status: 'PAID',
        subtotal: new Prisma.Decimal(965.0),
        totalAmount: new Prisma.Decimal(965.0),
        items: {
          create: [
            {
              tenant: { connect: { id: tenantAId } },
              itemType: 'SERVICE',
              service: { connect: { id: lorealService.id } },
              itemName: 'Hair Spa Loreal (Original Historical)',
              quantity: 1,
              unitPrice: new Prisma.Decimal(800.0),
              subtotal: new Prisma.Decimal(800.0),
              total: new Prisma.Decimal(800.0),
            },
            {
              tenant: { connect: { id: tenantAId } },
              itemType: 'PRODUCT',
              product: { connect: { id: fairProduct.id } },
              itemName: 'fair and lovely (Original Historical)',
              quantity: 1,
              unitPrice: new Prisma.Decimal(10.0),
              subtotal: new Prisma.Decimal(10.0),
              total: new Prisma.Decimal(10.0),
            },
          ],
        },
      },
      include: { items: true },
    });
    createdOrderIds.push(historicalOrder.id);

    // 11.2 Verify historical POS order preserved exact historical price and item name
    const orderItems = historicalOrder.items;
    const svcOrderItem = orderItems.find((it) => it.serviceId === lorealService.id);
    const prodOrderItem = orderItems.find((it) => it.productId === fairProduct.id);

    assert(Number(svcOrderItem?.unitPrice) === 800.0, 'Historical POS service price remains 800.00 despite service price updated to 950.00');
    assert(Number(prodOrderItem?.unitPrice) === 10.0, 'Historical POS product price remains 10.00 despite product price updated to 15.00');

    // 11.3 Attempt to hard-delete service with historical sales -> Must be blocked with 409
    let serviceDeleteBlocked = false;
    try {
      await serviceService.delete(tenantAId, lorealService.id);
    } catch (err: any) {
      serviceDeleteBlocked = true;
      assert(err.statusCode === 409, 'Service deletion blocked with 409 due to historical sales references');
    }
    assert(serviceDeleteBlocked, 'Hard delete blocked for service in historical sales');

    // 11.4 Attempt to hard-delete product with historical sales -> Must be blocked with 409
    let prodDeleteBlocked = false;
    try {
      await productService.delete(tenantAId, fairProduct.id);
    } catch (err: any) {
      prodDeleteBlocked = true;
      assert(err.statusCode === 409, 'Product deletion blocked with 409 due to historical sales/stock references');
    }
    assert(prodDeleteBlocked, 'Hard delete blocked for product in historical sales');

    // 11.5 Deactivate service and product instead of deleting (allowed & safe)
    const deactivatedSvc = await serviceService.updateStatus(tenantAId, lorealService.id, false);
    assert(deactivatedSvc.isActive === false, 'Service successfully soft-deactivated');

    const deactivatedProd = await productService.updateStatus(tenantAId, fairProduct.id, false);
    assert(deactivatedProd.isActive === false, 'Product successfully soft-deactivated');

    // Re-verify historical order is completely untouched
    const orderAfterDeactivation = await prisma.posOrder.findUnique({
      where: { id: historicalOrder.id },
      include: { items: true },
    });
    assert(orderAfterDeactivation?.items.length === 2, 'Historical order items completely preserved after deactivation');

    // ==============================================================
    // SUITE 12: MULTI-TENANT ISOLATION
    // ==============================================================
    console.log('\n--- 12. Multi-Tenant Isolation ---');

    // 12.1 Tenant B cannot view Tenant A's service
    let tenantBServiceAccess = false;
    try {
      await serviceService.getById(tenantBId, lorealService.id);
      tenantBServiceAccess = true;
    } catch (err: any) {
      assert(err.statusCode === 404, 'Tenant B rejected from accessing Tenant A service (404 Not Found)');
    }
    assert(!tenantBServiceAccess, 'Tenant isolation enforced on service getById');

    // 12.2 Tenant B cannot update Tenant A's service
    let tenantBServiceUpdate = false;
    try {
      await serviceService.update(tenantBId, lorealService.id, { name: 'Hacked' });
      tenantBServiceUpdate = true;
    } catch (err: any) {
      assert(err.statusCode === 404, 'Tenant B rejected from updating Tenant A service (404 Not Found)');
    }
    assert(!tenantBServiceUpdate, 'Tenant isolation enforced on service update');

    // 12.3 Tenant B cannot view Tenant A's product
    let tenantBProductAccess = false;
    try {
      await productService.getById(tenantBId, fairProduct.id);
      tenantBProductAccess = true;
    } catch (err: any) {
      assert(err.statusCode === 404, 'Tenant B rejected from accessing Tenant A product (404 Not Found)');
    }
    assert(!tenantBProductAccess, 'Tenant isolation enforced on product getById');

    // 12.4 Tenant B can create product with same name without collision
    let tenantBCat = await prisma.productCategory.findFirst({ where: { tenantId: tenantBId } });
    if (!tenantBCat) {
      tenantBCat = await productCategoryService.create(tenantBId, { name: `TB_Cat_${RUN_ID}` });
      createdProductCategoryIds.push(tenantBCat.id);
    }

    const tenantBProduct = await productService.create(tenantBId, {
      name: `fair and lovely_${RUN_ID}`,
      categoryId: tenantBCat.id,
      price: 15.0,
      storeSku: `sku_tb_${RUN_ID}`,
    });
    createdProductIds.push(tenantBProduct.id);
    assert(tenantBProduct.tenantId === tenantBId, 'Same product name allowed in separate tenant without collision');

    // ==============================================================
    // SUITE 13: CATEGORY DELETION PROTECTION
    // ==============================================================
    console.log('\n--- 13. Category Deletion Protection ---');

    // 13.1 Cannot delete category that contains services
    let catDeleteBlocked = false;
    try {
      await serviceCategoryService.delete(tenantAId, hairCat.id);
    } catch (err: any) {
      catDeleteBlocked = true;
      assert(err.statusCode === 409, 'Service category delete blocked with 409 because it has services/subcategories');
    }
    assert(catDeleteBlocked, 'Category with services protected against deletion');

    // 13.2 Cannot delete category that contains products
    let prodCatDeleteBlocked = false;
    try {
      await productCategoryService.delete(tenantAId, creamCat.id);
    } catch (err: any) {
      prodCatDeleteBlocked = true;
      assert(err.statusCode === 409, 'Product category delete blocked with 409 because it has products/subcategories');
    }
    assert(prodCatDeleteBlocked, 'Category with products protected against deletion');

    // ==============================================================
    // SUITE 14: CLEAN DELETION OF UNREFERENCED ITEMS
    // ==============================================================
    console.log('\n--- 14. Clean Deletion of Unreferenced Items ---');

    // Create an unreferenced product and category, delete them cleanly
    const tempCat = await productCategoryService.create(tenantAId, {
      name: `TempCat_${RUN_ID}`,
    });
    const tempProd = await productService.create(tenantAId, {
      name: `TempProd_${RUN_ID}`,
      categoryId: tempCat.id,
      price: 10,
    });

    await productService.delete(tenantAId, tempProd.id);
    assert(true, 'Unreferenced product deleted cleanly');

    await productCategoryService.delete(tenantAId, tempCat.id);
    assert(true, 'Empty product category deleted cleanly');

  } finally {
    // Cleanup created test records
    console.log('\n--- Cleaning up test records ---');
    if (createdOrderIds.length > 0) {
      await prisma.posOrderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.posOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdProductIds.length > 0) {
      await prisma.stockTransaction.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdServiceIds.length > 0) {
      await prisma.serviceStaff.deleteMany({ where: { serviceId: { in: createdServiceIds } } });
      await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
    }
    if (createdProductCategoryIds.length > 0) {
      await prisma.productCategory.deleteMany({ where: { id: { in: createdProductCategoryIds } } });
    }
    if (createdServiceCategoryIds.length > 0) {
      await prisma.serviceCategory.deleteMany({ where: { id: { in: createdServiceCategoryIds } } });
    }
    await prisma.vendor.delete({ where: { id: vendor.id } }).catch(() => {});
  }

  console.log('\n===============================================================');
  console.log(`  SERVICES & PRODUCTS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
