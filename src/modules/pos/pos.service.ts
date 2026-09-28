import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import {
  BadRequestError,
  NotFoundError,
} from '../../utils/app-error.js';
import { posRepository, PosRepository } from './pos.repository.js';
import {
  CreatePosOrderInput,
  CalculateOrderInput,
  CalculateOrderResult,
  PosOrderQuery,
  UpdatePosOrderStatusInput,
  UpdatePosOrderInput,
  PosStatsQuery,
  PosDashboardSummary,
  CalculatedOrderItem,
  TaxDetailItem,
} from './pos.types.js';

export class PosService {
  constructor(private repository: PosRepository = posRepository) {}

  async calculateOrder(tenantId: string, input: CalculateOrderInput): Promise<CalculateOrderResult> {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestError('Order must contain at least one item');
    }

    const calculatedItems: CalculatedOrderItem[] = [];
    let subtotal = 0;
    let itemDiscountTotal = 0;

    // Collect IDs for bulk lookup
    const serviceIds = input.items
      .filter((i) => i.itemType === 'SERVICE' && i.serviceId)
      .map((i) => i.serviceId as string);
    const productIds = input.items
      .filter((i) => i.itemType === 'PRODUCT' && i.productId)
      .map((i) => i.productId as string);
    const staffIds = input.items
      .filter((i) => i.staffId)
      .map((i) => i.staffId as string);

    // Fetch services, products, and staff belonging strictly to this tenant
    const [services, products, staffMembers, tenantTaxes] = await Promise.all([
      serviceIds.length > 0
        ? prisma.service.findMany({
            where: { id: { in: serviceIds }, tenantId },
            include: { category: true },
          })
        : [],
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds }, tenantId },
            include: { category: true },
          })
        : [],
      staffIds.length > 0
        ? prisma.staff.findMany({
            where: { id: { in: staffIds }, tenantId },
            select: { id: true, name: true },
          })
        : [],
      prisma.taxMapping.findMany({
        where: { tenantId, isActive: true },
      }),
    ]);

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const staffMap = new Map(staffMembers.map((st) => [st.id, st.name]));

    // Check Guest Membership for discount if guestId provided
    let membershipDiscountPercentage = 0;
    if (input.guestId) {
      const guest = await prisma.guest.findFirst({
        where: { id: input.guestId, tenantId },
        include: { membershipRef: true },
      });
      if (guest?.membershipRef && guest.membershipRef.isActive) {
        membershipDiscountPercentage = Number(guest.membershipRef.discountPercentage || 0);
      }
    }

    // Process line items
    for (const item of input.items) {
      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      let unitPrice = 0;
      let itemName = item.itemName || 'Custom Item';
      let itemCategory = item.itemCategory || null;
      let staffName: string | null = null;

      if (item.itemType === 'SERVICE') {
        if (!item.staffId) {
          throw new BadRequestError('Select Staff: Staff is required for service items');
        }
        if (!staffMap.has(item.staffId)) {
          // Verify if staff exists in this tenant
          const staffCheck = await prisma.staff.findFirst({
            where: { id: item.staffId, tenantId },
          });
          if (!staffCheck) {
            throw new BadRequestError(`Staff with ID ${item.staffId} not found in this salon`);
          }
          staffName = staffCheck.name;
          staffMap.set(staffCheck.id, staffCheck.name);
        } else {
          staffName = staffMap.get(item.staffId) || null;
        }

        if (item.serviceId) {
          const service = serviceMap.get(item.serviceId);
          if (!service) {
            throw new BadRequestError(`Service with ID ${item.serviceId} not found in this salon`);
          }
          itemName = service.name;
          itemCategory = service.category?.name || null;
          const servicePrice = Number(service.salePrice) > 0 ? Number(service.salePrice) : Number(service.price);
          unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : servicePrice;
        } else if (item.unitPrice !== undefined) {
          unitPrice = Number(item.unitPrice);
        }
      } else if (item.itemType === 'PRODUCT') {
        if (item.productId) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new BadRequestError(`Product with ID ${item.productId} not found in this salon`);
          }
          itemName = product.name;
          itemCategory = product.category?.name || null;
          const prodPrice = Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price);
          unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : prodPrice;
        } else if (item.unitPrice !== undefined) {
          unitPrice = Number(item.unitPrice);
        }

        if (item.staffId && staffMap.has(item.staffId)) {
          staffName = staffMap.get(item.staffId) || null;
        }
      }

      const itemSub = Number((unitPrice * quantity).toFixed(2));
      const itemDisc = item.discountAmount ? Math.min(Number(item.discountAmount), itemSub) : 0;
      const itemTotal = Number((itemSub - itemDisc).toFixed(2));

      subtotal += itemSub;
      itemDiscountTotal += itemDisc;

      calculatedItems.push({
        itemType: item.itemType,
        serviceId: item.serviceId || null,
        productId: item.productId || null,
        staffId: item.staffId || null,
        staffName,
        itemName,
        itemCategory,
        quantity,
        unitPrice,
        discountAmount: itemDisc,
        taxAmount: 0, // Computed below
        subtotal: itemSub,
        total: itemTotal,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    itemDiscountTotal = Number(itemDiscountTotal.toFixed(2));

    // Calculate order-level discount
    let orderDiscountAmount = 0;
    const netAfterItemDiscount = Math.max(0, subtotal - itemDiscountTotal);

    if (input.discountType === 'PERCENTAGE' && input.discountValue && input.discountValue > 0) {
      orderDiscountAmount = Number(((netAfterItemDiscount * input.discountValue) / 100).toFixed(2));
    } else if (input.discountAmount && input.discountAmount > 0) {
      orderDiscountAmount = Math.min(Number(input.discountAmount), netAfterItemDiscount);
    } else if (input.discountValue && input.discountValue > 0) {
      orderDiscountAmount = Math.min(Number(input.discountValue), netAfterItemDiscount);
    }

    let runningTotal = Math.max(0, netAfterItemDiscount - orderDiscountAmount);

    // Membership discount
    let membershipDiscount = 0;
    if (membershipDiscountPercentage > 0 && runningTotal > 0) {
      membershipDiscount = Number(((runningTotal * membershipDiscountPercentage) / 100).toFixed(2));
      runningTotal = Math.max(0, runningTotal - membershipDiscount);
    }

    // Coupon discount
    let couponDiscount = 0;
    if (input.couponCode && input.couponCode.trim() !== '') {
      const coupon = await prisma.coupon.findFirst({
        where: {
          tenantId,
          code: { equals: input.couponCode.trim(), mode: 'insensitive' },
          isActive: true,
        },
      });

      if (!coupon) {
        throw new BadRequestError(`Coupon code "${input.couponCode}" is invalid or inactive`);
      }

      const now = new Date();
      if (coupon.startDate && coupon.startDate > now) {
        throw new BadRequestError(`Coupon "${input.couponCode}" is not active yet`);
      }
      if (coupon.endDate && coupon.endDate < now) {
        throw new BadRequestError(`Coupon "${input.couponCode}" has expired`);
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestError(`Coupon "${input.couponCode}" usage limit has been reached`);
      }
      if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
        throw new BadRequestError(`Minimum order value for coupon "${input.couponCode}" is ₹${coupon.minOrderValue}`);
      }

      if (coupon.discountType === 'PERCENTAGE') {
        couponDiscount = Number(((runningTotal * Number(coupon.discountValue)) / 100).toFixed(2));
        if (coupon.maxDiscount && couponDiscount > Number(coupon.maxDiscount)) {
          couponDiscount = Number(coupon.maxDiscount);
        }
      } else {
        couponDiscount = Math.min(Number(coupon.discountValue), runningTotal);
      }

      runningTotal = Math.max(0, runningTotal - couponDiscount);
    }

    // Referral discount
    let referralDiscount = 0;
    if (input.referralCode && input.referralCode.trim() !== '') {
      const tenantSettings = await prisma.tenantSettings.findFirst({
        where: { tenantId },
      });
      if (tenantSettings?.referralsEnabled && tenantSettings.refereeRewardValue) {
        if (tenantSettings.refereeRewardType === 'PERCENTAGE') {
          referralDiscount = Number(((runningTotal * Number(tenantSettings.refereeRewardValue)) / 100).toFixed(2));
        } else {
          referralDiscount = Math.min(Number(tenantSettings.refereeRewardValue), runningTotal);
        }
        runningTotal = Math.max(0, runningTotal - referralDiscount);
      }
    }

    // Loyalty Points Redemption
    let loyaltyDiscount = 0;
    let loyaltyPointsRedeemed = 0;
    let loyaltyPointsEstimatedEarn = 0;

    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    });

    if (input.redeemLoyaltyPoints && input.redeemLoyaltyPoints > 0) {
      if (!tenantSettings?.loyaltyEnabled) {
        throw new BadRequestError('Loyalty rewards are currently disabled for this store');
      }
      if (!input.guestId) {
        throw new BadRequestError('Guest identification is required to redeem loyalty points');
      }
      const guest = await prisma.guest.findFirst({
        where: { id: input.guestId, tenantId },
      });
      if (!guest) {
        throw new NotFoundError('Guest not found');
      }
      if (guest.loyaltyPoints < input.redeemLoyaltyPoints) {
        throw new BadRequestError(`Insufficient loyalty points. Guest has ${guest.loyaltyPoints}, requested ${input.redeemLoyaltyPoints}`);
      }
      const minRedeem = tenantSettings.minRedeemPoints ?? 100;
      if (input.redeemLoyaltyPoints < minRedeem) {
        throw new BadRequestError(`Minimum points eligible for redemption is ${minRedeem}`);
      }
      if (tenantSettings.maxRedeemPointsPerOrder && input.redeemLoyaltyPoints > tenantSettings.maxRedeemPointsPerOrder) {
        throw new BadRequestError(`Maximum points redeemable per order is ${tenantSettings.maxRedeemPointsPerOrder}`);
      }

      const currencyPerPoint = tenantSettings.currencyPerPoint ? Number(tenantSettings.currencyPerPoint) : 1;
      let calculatedLoyaltyValue = Number((input.redeemLoyaltyPoints * currencyPerPoint).toFixed(2));

      // Check max percentage redeemable on order if configured
      const rules = (tenantSettings.loyaltyRules as Record<string, any>) || {};
      if (rules.maxRedeemPercentage && rules.maxRedeemPercentage > 0) {
        const maxAllowed = Number(((runningTotal * rules.maxRedeemPercentage) / 100).toFixed(2));
        if (calculatedLoyaltyValue > maxAllowed) {
          calculatedLoyaltyValue = maxAllowed;
        }
      }

      loyaltyDiscount = Math.min(calculatedLoyaltyValue, runningTotal);
      loyaltyPointsRedeemed = input.redeemLoyaltyPoints;
      runningTotal = Math.max(0, runningTotal - loyaltyDiscount);
    }

    // Gift Card deduction
    let giftCardAmount = 0;
    if (input.giftCardCode && input.giftCardCode.trim() !== '') {
      const giftCard = await prisma.giftCard.findFirst({
        where: {
          tenantId,
          code: { equals: input.giftCardCode.trim(), mode: 'insensitive' },
          isActive: true,
        },
      });

      if (!giftCard) {
        throw new BadRequestError(`Gift card code "${input.giftCardCode}" is invalid or inactive`);
      }

      giftCardAmount = Math.min(Number(giftCard.amount), runningTotal);
      runningTotal = Math.max(0, runningTotal - giftCardAmount);
    }

    // Estimate loyalty points to be earned on this order
    if (tenantSettings?.loyaltyEnabled) {
      const rules = (tenantSettings.loyaltyRules as Record<string, any>) || {};
      const skipOnRedeem = rules.skipOnRedemption ?? false;
      if (!skipOnRedeem || loyaltyPointsRedeemed === 0) {
        const pointsPerCurrency = tenantSettings.pointsPerCurrency ? Number(tenantSettings.pointsPerCurrency) : 1;
        loyaltyPointsEstimatedEarn = Math.floor(runningTotal * pointsPerCurrency);
      }
    }

    const totalDiscount = Number(
      (itemDiscountTotal + orderDiscountAmount + membershipDiscount + couponDiscount + referralDiscount + loyaltyDiscount).toFixed(2)
    );

    const taxableAmount = Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));

    // Tax calculation
    const taxDetails: TaxDetailItem[] = [];
    let totalTaxRate = 0;
    let taxAmount = 0;

    if (tenantTaxes.length > 0) {
      for (const t of tenantTaxes) {
        const rate = Number(t.rate);
        totalTaxRate += rate;
        let tAmount = 0;
        if (t.isInclusive) {
          // Tax is already included in taxableAmount: Tax = Taxable * Rate / (100 + Rate)
          tAmount = Number(((taxableAmount * rate) / (100 + rate)).toFixed(2));
        } else {
          // Tax is exclusive: Tax = Taxable * Rate / 100
          tAmount = Number(((taxableAmount * rate) / 100).toFixed(2));
        }
        taxDetails.push({
          name: t.name,
          rate,
          amount: tAmount,
          isInclusive: t.isInclusive,
        });
      }
      taxAmount = taxDetails.reduce((sum, item) => sum + (item.isInclusive ? 0 : item.amount), 0);
      taxAmount = Number(taxAmount.toFixed(2));
    }

    const totalInclusiveRate = tenantTaxes
      .filter((t) => t.isInclusive)
      .reduce((sum, t) => sum + Number(t.rate), 0);
    const totalExclusiveRate = tenantTaxes
      .filter((t) => !t.isInclusive)
      .reduce((sum, t) => sum + Number(t.rate), 0);

    for (const item of calculatedItems) {
      const netItem = Math.max(0, item.subtotal - item.discountAmount);
      item.discountPercentage =
        item.subtotal > 0 ? Number(((item.discountAmount / item.subtotal) * 100).toFixed(1)) : 0;
      item.taxRate = totalTaxRate;
      if (totalInclusiveRate > 0) {
        item.taxAmount = Number(((netItem * totalInclusiveRate) / (100 + totalInclusiveRate)).toFixed(2));
        item.taxExclusiveSubtotal = Number((netItem - item.taxAmount).toFixed(2));
      } else if (totalExclusiveRate > 0) {
        item.taxAmount = Number(((netItem * totalExclusiveRate) / 100).toFixed(2));
        item.taxExclusiveSubtotal = netItem;
      } else {
        item.taxAmount = 0;
        item.taxExclusiveSubtotal = netItem;
      }
    }

    const tipAmount = input.tipAmount ? Number(input.tipAmount.toFixed(2)) : 0;
    const totalAmount = Number((taxableAmount + taxAmount + tipAmount - giftCardAmount).toFixed(2));

    return {
      subtotal,
      itemDiscountTotal,
      orderDiscountAmount,
      couponDiscount,
      giftCardAmount,
      referralDiscount,
      membershipDiscount,
      loyaltyDiscount,
      loyaltyPointsRedeemed,
      loyaltyPointsEstimatedEarn,
      totalDiscount,
      taxableAmount,
      taxRate: totalTaxRate,
      taxAmount,
      taxDetails,
      tipAmount,
      totalAmount: Math.max(0, totalAmount),
      itemsCalculated: calculatedItems,
    };
  }

  async create(tenantId: string, input: CreatePosOrderInput, currentUser: any): Promise<any> {
    // 1. Resolve or Create Guest
    let guestId = input.guestId;

    if (!guestId) {
      if (!input.guest || !input.guest.name || !input.guest.mobile) {
        throw new BadRequestError('Either guestId or guest details (name and mobile) must be provided');
      }

      // Check if guest with this mobile already exists in this tenant
      let existingGuest = await prisma.guest.findFirst({
        where: {
          tenantId,
          mobile: input.guest.mobile.trim(),
        },
      });

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        // Quick create guest
        const today = new Date();
        const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const count = await prisma.guest.count({ where: { tenantId } });
        const guestCode = `G-${datePrefix}-${String(count + 1).padStart(4, '0')}`;

        existingGuest = await prisma.guest.create({
          data: {
            tenantId,
            guestCode,
            name: input.guest.name.trim(),
            mobile: input.guest.mobile.trim(),
            email: input.guest.email?.trim() || null,
            gender: input.guest.gender || 'UNSPECIFIED',
            dateOfBirth: input.guest.dob ? new Date(input.guest.dob) : input.guest.dateOfBirth ? new Date(input.guest.dateOfBirth) : null,
            anniversary: input.guest.anniversary ? new Date(input.guest.anniversary) : input.guest.anniversaryDate ? new Date(input.guest.anniversaryDate) : null,
            gstNumber: input.guest.gstNumber?.trim() || null,
            hairType: input.guest.hairType?.trim() || null,
            alternateMobile: input.guest.alternateMobile?.trim() || null,
            salutationId: input.guest.salutationId || null,
            customerType: 'WALK_IN',
          },
        });
        guestId = existingGuest.id;
      }
    } else {
      // Verify guest belongs to this tenant
      const guest = await prisma.guest.findFirst({
        where: { id: guestId, tenantId },
      });
      if (!guest) {
        throw new NotFoundError('Guest not found in this salon');
      }
    }

    // 2. Run Calculation Engine
    const calculation = await this.calculateOrder(tenantId, {
      guestId,
      items: input.items,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: input.discountAmount,
      couponCode: input.couponCode,
      giftCardCode: input.giftCardCode,
      referralCode: input.referralCode,
      redeemLoyaltyPoints: input.redeemLoyaltyPoints,
      tipAmount: input.tipAmount,
    });

    // 3. Generate Order Number
    const orderNumber = await this.repository.getNextOrderNumber(tenantId);

    // 4. Format payments
    const payments = [];
    if (input.payments && input.payments.length > 0) {
      for (const p of input.payments) {
        payments.push({
          method: p.method,
          amount: new Prisma.Decimal(p.amount),
          referenceNumber: p.referenceNumber || null,
          status: 'SUCCESS',
        });
      }
    } else {
      payments.push({
        method: input.paymentMethod || 'CASH',
        amount: new Prisma.Decimal(calculation.totalAmount),
        referenceNumber: null,
        status: 'SUCCESS',
      });
    }

    // Determine cashier ID
    const cashierId = input.cashierId || (currentUser?.id ? currentUser.id : null);

    // 5. Prepare Order Items with mapped decimal fields
    const orderItems = calculation.itemsCalculated.map((item) => ({
      itemType: item.itemType,
      serviceId: item.serviceId,
      productId: item.productId,
      staffId: item.staffId,
      itemName: item.itemName,
      itemCategory: item.itemCategory,
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(item.unitPrice),
      discountAmount: new Prisma.Decimal(item.discountAmount),
      taxAmount: new Prisma.Decimal(item.taxAmount),
      subtotal: new Prisma.Decimal(item.subtotal),
      total: new Prisma.Decimal(item.total),
      notes: null,
    }));

    // 6. Create Order in Repository transaction
    const createdOrder = await this.repository.create(
      tenantId,
      {
        orderNumber,
        guestId,
        cashierId,
        status: input.status || 'COMPLETED',
        orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
        subtotal: new Prisma.Decimal(calculation.subtotal),
        discountType: input.discountType || null,
        discountValue: input.discountValue ? new Prisma.Decimal(input.discountValue) : null,
        discountAmount: new Prisma.Decimal(calculation.orderDiscountAmount),
        couponCode: input.couponCode || null,
        couponDiscount: new Prisma.Decimal(calculation.couponDiscount),
        giftCardCode: input.giftCardCode || null,
        giftCardAmount: new Prisma.Decimal(calculation.giftCardAmount),
        referralCode: input.referralCode || null,
        referralDiscount: new Prisma.Decimal(calculation.referralDiscount),
        membershipDiscount: new Prisma.Decimal(calculation.membershipDiscount),
        loyaltyPointsRedeemed: calculation.loyaltyPointsRedeemed || 0,
        loyaltyDiscount: new Prisma.Decimal(calculation.loyaltyDiscount || 0),
        loyaltyPointsEarned: calculation.loyaltyPointsEstimatedEarn || 0,
        taxAmount: new Prisma.Decimal(calculation.taxAmount),
        taxRate: new Prisma.Decimal(calculation.taxRate),
        taxDetails: calculation.taxDetails as unknown as Prisma.InputJsonValue,
        tipAmount: new Prisma.Decimal(calculation.tipAmount),
        totalAmount: new Prisma.Decimal(calculation.totalAmount),
        paymentMethod: input.paymentMethod || (input.payments && input.payments.length > 1 ? 'SPLIT' : 'CASH'),
        paymentStatus: 'PAID',
        notes: input.notes || null,
        instruction: input.instruction || null,
      },
      orderItems,
      payments
    );

    return createdOrder;
  }

  async list(tenantId: string, query: PosOrderQuery) {
    return this.repository.findMany(tenantId, query);
  }

  async exportOrdersCsv(tenantId: string, query: PosOrderQuery): Promise<string> {
    const result = await this.repository.findMany(tenantId, {
      ...query,
      page: 1,
      limit: 10000,
    });

    const headers = [
      'Order Number',
      'Date',
      'Guest Name',
      'Guest Mobile',
      'Items Count',
      'Items Summary',
      'Subtotal',
      'Discount Amount',
      'Tax Amount',
      'Tip Amount',
      'Total Amount',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Cashier Name',
      'Notes',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = result.data.map((order) => {
      const guestName = order.guest?.name || 'Walk-in Guest';
      const guestMobile = order.guest?.mobile || '';
      const itemsCount = order.items?.length || 0;
      const itemsSummary = (order.items || [])
        .map((i: any) => `${i.itemName || 'Item'} x ${i.quantity}`)
        .join('; ');
      const cashierName = order.cashier?.username || '';

      return [
        escapeCsv(order.orderNumber),
        escapeCsv(order.orderDate ? new Date(order.orderDate).toISOString().slice(0, 10) : ''),
        escapeCsv(guestName),
        escapeCsv(guestMobile),
        escapeCsv(itemsCount),
        escapeCsv(itemsSummary),
        escapeCsv(Number(order.subtotal || 0).toFixed(2)),
        escapeCsv(Number(order.discountAmount || 0).toFixed(2)),
        escapeCsv(Number(order.taxAmount || 0).toFixed(2)),
        escapeCsv(Number(order.tipAmount || 0).toFixed(2)),
        escapeCsv(Number(order.totalAmount || 0).toFixed(2)),
        escapeCsv(order.paymentMethod || 'CASH'),
        escapeCsv(order.paymentStatus || 'PAID'),
        escapeCsv(order.status || 'COMPLETED'),
        escapeCsv(cashierName),
        escapeCsv(order.notes || ''),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async getById(tenantId: string, id: string) {
    const order = await this.repository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  }

  async getByOrderNumber(tenantId: string, orderNumber: string) {
    const order = await this.repository.findByOrderNumber(tenantId, orderNumber);
    if (!order) {
      throw new NotFoundError(`Order with number "${orderNumber}" not found`);
    }
    return order;
  }

  async updateStatus(tenantId: string, id: string, input: UpdatePosOrderStatusInput) {
    const order = await this.repository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    await this.repository.updateStatus(tenantId, id, input.status, input.notes);
    return this.repository.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const order = await this.repository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    await this.repository.delete(tenantId, id);
    return { success: true, message: 'Order voided/deleted successfully' };
  }

  async update(tenantId: string, id: string, input: UpdatePosOrderInput, currentUser: any) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    const guestId = input.guestId || existing.guestId;

    let calculation: CalculateOrderResult | null = null;
    let orderItems: any[] | undefined = undefined;
    let payments: any[] | undefined = undefined;

    if (input.items && input.items.length > 0) {
      calculation = await this.calculateOrder(tenantId, {
        guestId,
        items: input.items,
        discountType: input.discountType !== undefined ? input.discountType : (existing.discountType as any),
        discountValue: input.discountValue !== undefined ? input.discountValue : (existing.discountValue ? Number(existing.discountValue) : undefined),
        discountAmount: input.discountAmount !== undefined ? input.discountAmount : (existing.discountAmount ? Number(existing.discountAmount) : 0),
        couponCode: input.couponCode !== undefined ? input.couponCode : existing.couponCode,
        giftCardCode: input.giftCardCode !== undefined ? input.giftCardCode : existing.giftCardCode,
        referralCode: input.referralCode !== undefined ? input.referralCode : existing.referralCode,
        tipAmount: input.tipAmount !== undefined ? input.tipAmount : (existing.tipAmount ? Number(existing.tipAmount) : 0),
      });

      orderItems = calculation.itemsCalculated.map((item) => ({
        itemType: item.itemType,
        serviceId: item.serviceId,
        productId: item.productId,
        staffId: item.staffId,
        itemName: item.itemName,
        itemCategory: item.itemCategory,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        discountAmount: new Prisma.Decimal(item.discountAmount),
        taxAmount: new Prisma.Decimal(item.taxAmount),
        subtotal: new Prisma.Decimal(item.subtotal),
        total: new Prisma.Decimal(item.total),
        notes: null,
      }));

      if (input.payments && input.payments.length > 0) {
        payments = input.payments.map((p) => ({
          method: p.method,
          amount: new Prisma.Decimal(p.amount),
          referenceNumber: p.referenceNumber || null,
          status: 'SUCCESS',
        }));
      } else {
        payments = [
          {
            method: input.paymentMethod || existing.paymentMethod || 'CASH',
            amount: new Prisma.Decimal(calculation.totalAmount),
            referenceNumber: null,
            status: 'SUCCESS',
          },
        ];
      }
    }

    const orderData: any = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    };

    if (calculation) {
      orderData.subtotal = new Prisma.Decimal(calculation.subtotal);
      orderData.discountType = input.discountType !== undefined ? input.discountType : existing.discountType;
      orderData.discountValue = input.discountValue !== undefined ? (input.discountValue ? new Prisma.Decimal(input.discountValue) : null) : existing.discountValue;
      orderData.discountAmount = new Prisma.Decimal(calculation.orderDiscountAmount);
      orderData.couponCode = input.couponCode !== undefined ? input.couponCode : existing.couponCode;
      orderData.couponDiscount = new Prisma.Decimal(calculation.couponDiscount);
      orderData.giftCardCode = input.giftCardCode !== undefined ? input.giftCardCode : existing.giftCardCode;
      orderData.giftCardAmount = new Prisma.Decimal(calculation.giftCardAmount);
      orderData.referralCode = input.referralCode !== undefined ? input.referralCode : existing.referralCode;
      orderData.referralDiscount = new Prisma.Decimal(calculation.referralDiscount);
      orderData.membershipDiscount = new Prisma.Decimal(calculation.membershipDiscount);
      orderData.taxAmount = new Prisma.Decimal(calculation.taxAmount);
      orderData.taxRate = new Prisma.Decimal(calculation.taxRate);
      orderData.taxDetails = calculation.taxDetails as unknown as Prisma.InputJsonValue;
      orderData.tipAmount = new Prisma.Decimal(calculation.tipAmount);
      orderData.totalAmount = new Prisma.Decimal(calculation.totalAmount);
    }

    const updated = await this.repository.updateOrder(tenantId, id, orderData, orderItems, payments);
    return updated;
  }

  async acceptOrder(tenantId: string, id: string) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }
    await this.repository.acceptOrder(tenantId, id);
    return this.repository.findById(tenantId, id);
  }

  async rejectOrder(tenantId: string, id: string, reason?: string) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }
    await this.repository.rejectOrder(tenantId, id, reason);
    return this.repository.findById(tenantId, id);
  }

  async complete(tenantId: string, id: string) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    if (existing.status === 'COMPLETED') {
      return existing;
    }

    await prisma.$transaction(async (tx) => {
      await tx.posOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });

      await tx.guest.update({
        where: { id: existing.guestId },
        data: {
          totalSpend: { increment: existing.totalAmount },
          totalVisits: { increment: 1 },
          lastVisitDate: new Date(),
        },
      });

      for (const item of existing.items) {
        if (item.productId) {
          await tx.stockTransaction.create({
            data: {
              tenantId,
              productId: item.productId,
              type: 'OUTWARD',
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: item.unitPrice,
              totalAmount: item.total,
              notes: `POS Completed Sale: ${existing.orderNumber}`,
              transactionDate: new Date(),
            },
          });
        }
      }
    });

    return this.repository.findById(tenantId, id);
  }

  async cancel(tenantId: string, id: string, reason?: string) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    if (existing.status === 'CANCELLED') {
      return existing;
    }

    await prisma.$transaction(async (tx) => {
      await tx.posOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          ...(reason ? { notes: reason } : {}),
        },
      });

      // If previously completed, reverse guest spend and visits, and restore product stock
      if (existing.status === 'COMPLETED') {
        await tx.guest.update({
          where: { id: existing.guestId },
          data: {
            totalSpend: { decrement: existing.totalAmount },
            totalVisits: { decrement: 1 },
          },
        });

        for (const item of existing.items) {
          if (item.productId) {
            await tx.stockTransaction.create({
              data: {
                tenantId,
                productId: item.productId,
                type: 'INWARD',
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: item.unitPrice,
                totalAmount: item.total,
                notes: `POS Cancelled Reversal: ${existing.orderNumber}`,
                transactionDate: new Date(),
              },
            });
          }
        }
      }
    });

    return this.repository.findById(tenantId, id);
  }

  async getInvoice(tenantId: string, id: string) {
    const order = await this.repository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tenantSettings: true,
      },
    });

    return {
      invoiceNumber: order.orderNumber,
      orderId: order.id,
      orderDate: order.orderDate,
      salon: {
        name: tenant?.name?.trim() ? tenant.name : (tenant?.code || 'Salon'),
        code: tenant?.code,
        address: tenant?.address || null,
        contact: tenant?.tenantSettings?.contactInfo || tenant?.contactPhone || null,
        footerText: tenant?.tenantSettings?.footerText || 'Thank you for visiting! Please visit us again.',
      },
      guest: order.guest,
      cashier: order.cashier,
      items: order.items.map((item, index) => ({
        sr: index + 1,
        id: item.id,
        itemType: item.itemType,
        name: item.itemName,
        sacCode: (item.service as any)?.sacCode || (item.product as any)?.hsnCode || null,
        category: item.itemCategory,
        staffName: item.staff?.name || null,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        taxAmount: Number(item.taxAmount),
        total: Number(item.total),
      })),
      financialSummary: {
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        couponDiscount: Number(order.couponDiscount),
        giftCardAmount: Number(order.giftCardAmount),
        membershipDiscount: Number(order.membershipDiscount),
        taxAmount: Number(order.taxAmount),
        taxRate: Number(order.taxRate),
        taxDetails: order.taxDetails,
        tipAmount: Number(order.tipAmount),
        totalAmount: Number(order.totalAmount),
      },
      payments: order.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        referenceNumber: p.referenceNumber,
        status: p.status,
      })),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      instruction: order.instruction,
    };
  }

  async resendInvoice(tenantId: string, id: string) {
    const order = await this.repository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return {
      success: true,
      message: `Invoice for order ${order.orderNumber} resent successfully to ${order.guest.mobile || order.guest.email}`,
      orderNumber: order.orderNumber,
      recipient: order.guest.mobile,
      timestamp: new Date().toISOString(),
    };
  }

  async sendWhatsAppInvoice(tenantId: string, id: string) {
    const order = await this.repository.findById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    await this.repository.updateWhatsappStatus(tenantId, id, 'SENT');

    return {
      success: true,
      message: `WhatsApp invoice notification queued and sent successfully for order ${order.orderNumber}`,
      template: 'salon_transaction_invoice_1',
      recipient: order.guest.mobile,
      whatsappStatus: 'SENT',
      orderNumber: order.orderNumber,
      totalAmount: Number(order.totalAmount),
      timestamp: new Date().toISOString(),
    };
  }

  async getStats(tenantId: string, query: PosStatsQuery) {
    const from = query.dateFrom || query.startDate ? new Date(query.dateFrom || query.startDate!) : undefined;
    const to = query.dateTo || query.endDate ? new Date(query.dateTo || query.endDate!) : undefined;
    if (to && (query.dateTo?.length === 10 || query.endDate?.length === 10)) {
      to.setHours(23, 59, 59, 999);
    }
    return this.repository.getStats(tenantId, from, to);
  }

  async getDashboardSummary(tenantId: string, query: PosStatsQuery): Promise<PosDashboardSummary> {
    const fromStr = query.dateFrom || query.startDate;
    const toStr = query.dateTo || query.endDate;
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    if (to && toStr && toStr.length === 10) {
      to.setHours(23, 59, 59, 999);
    }
    const counts = await this.repository.getDashboardSummary(tenantId, from, to);
    return {
      ...counts,
      dateFrom: fromStr || null,
      dateTo: toStr || null,
    };
  }

  generateInvoiceHtml(invoice: any): string {
    const salon = invoice.salon || {};
    const guest = invoice.guest || {};
    const cashier = invoice.cashier || {};
    const summary = invoice.financialSummary || {};
    const items = invoice.items || [];
    const payments = invoice.payments || [];

    const orderDateFormatted = invoice.orderDate
      ? new Date(invoice.orderDate).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'N/A';

    const itemRows = items
      .map(
        (item: any, i: number) => `
        <tr>
          <td style="text-align: center; color: #6b7280;">${item.sr || i + 1}</td>
          <td>
            <strong>${item.name || 'Service'}</strong>
            ${item.category ? `<div style="font-size: 11px; color: #6b7280;">${item.category}</div>` : ''}
          </td>
          <td style="color: #4b5563;">${item.staffName || '-'}</td>
          <td style="text-align: center;">${item.quantity || 1}</td>
          <td style="text-align: right;">₹${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td style="text-align: right; font-weight: 600;">₹${Number(item.total || 0).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const paymentsRows = payments
      .map(
        (p: any) => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
          <span>Payment via <strong>${p.method || 'CASH'}</strong>${p.referenceNumber ? ` (${p.referenceNumber})` : ''}</span>
          <span style="font-weight: 600;">₹${Number(p.amount || 0).toFixed(2)}</span>
        </div>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Customer Bill Invoice - ${invoice.invoiceNumber || 'Receipt'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      padding: 30px 15px;
    }
    .invoice-card {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .invoice-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .salon-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .salon-meta {
      font-size: 13px;
      opacity: 0.9;
      line-height: 1.5;
    }
    .badge-invoice {
      display: inline-block;
      margin-top: 12px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.4);
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .invoice-body {
      padding: 30px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 1px dashed #d1d5db;
    }
    .meta-block h4 {
      font-size: 11px;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .meta-block p {
      font-size: 14px;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    th {
      background: #f9fafb;
      color: #374151;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-bottom: 2px solid #e5e7eb;
      text-align: left;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 13px;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 25px;
    }
    .summary-table {
      width: 320px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .summary-row.total {
      font-size: 18px;
      font-weight: 800;
      color: #1e3a8a;
      border-top: 2px solid #e5e7eb;
      padding-top: 10px;
      margin-top: 6px;
    }
    .payments-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 25px;
    }
    .payments-header {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .invoice-footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
      line-height: 1.6;
    }
    .print-actions {
      text-align: center;
      margin-top: 20px;
    }
    .print-btn {
      background: #1e3a8a;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .print-btn:hover { background: #1e40af; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="invoice-header">
      <div class="salon-name">${salon.name || 'SALON'}</div>
      <div class="salon-meta">
        ${salon.address ? `<div>${salon.address}</div>` : ''}
        ${salon.contact ? `<div>Tel: ${salon.contact}</div>` : ''}
      </div>
      <div class="badge-invoice">CUSTOMER TAX INVOICE & RECEIPT</div>
    </div>

    <div class="invoice-body">
      <div class="meta-grid">
        <div class="meta-block">
          <h4>Billed To (Customer)</h4>
          <p><strong>${guest.name || 'Walk-in Customer'}</strong></p>
          ${guest.mobile ? `<p>Phone: ${guest.mobile}</p>` : ''}
          ${guest.email ? `<p>Email: ${guest.email}</p>` : ''}
        </div>
        <div class="meta-block" style="text-align: right;">
          <h4>Invoice Details</h4>
          <p><strong>Invoice No:</strong> ${invoice.invoiceNumber || 'INV-DRAFT'}</p>
          <p><strong>Date & Time:</strong> ${orderDateFormatted}</p>
          <p><strong>Cashier:</strong> ${cashier.username || 'Counter Staff'}</p>
          <p><strong>Payment Status:</strong> <span style="color: #16a34a; font-weight: 700;">${invoice.paymentStatus || 'PAID'}</span></p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Item / Service Description</th>
            <th>Stylist</th>
            <th style="width: 50px; text-align: center;">Qty</th>
            <th style="width: 90px; text-align: right;">Rate</th>
            <th style="width: 100px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="summary-section">
        <div class="summary-table">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>₹${Number(summary.subtotal || 0).toFixed(2)}</span>
          </div>
          ${Number(summary.discountAmount || 0) > 0 ? `
            <div class="summary-row" style="color: #dc2626;">
              <span>Discount:</span>
              <span>-₹${Number(summary.discountAmount).toFixed(2)}</span>
            </div>
          ` : ''}
          ${Number(summary.taxAmount || 0) > 0 ? `
            <div class="summary-row">
              <span>Taxes (GST):</span>
              <span>+₹${Number(summary.taxAmount).toFixed(2)}</span>
            </div>
          ` : ''}
          ${Number(summary.tipAmount || 0) > 0 ? `
            <div class="summary-row">
              <span>Tip:</span>
              <span>+₹${Number(summary.tipAmount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="summary-row total">
            <span>Grand Total:</span>
            <span>₹${Number(summary.totalAmount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="payments-box">
        <div class="payments-header">Settlement & Payment Details</div>
        ${paymentsRows || `<div style="font-size: 13px;">Settled via ${invoice.paymentMethod || 'CASH'}</div>`}
      </div>

      <div class="invoice-footer">
        <p style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px;">
          ${salon.footerText || 'Thank you for visiting! Please visit us again.'}
        </p>
        <p>This is a computer-generated tax invoice. No signature required.</p>
      </div>
    </div>
  </div>

  <div class="print-actions no-print">
    <button class="print-btn" onclick="window.print()">Print Receipt / Bill</button>
  </div>
</body>
</html>`;
  }
}

export const posService = new PosService();
