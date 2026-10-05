import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { CreateAppointmentDto, ListAppointmentsQueryDto, RescheduleAppointmentDto, UpdateAppointmentDto } from './appointment.dto.js';

export class AppointmentRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Generate sequential appointment number with format APT-YYYYMMDD-XXXX
   */
  async getNextAppointmentNumber(tenantId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `APT-${yyyy}${mm}${dd}-`;

    const lastAppointment = await client.appointment.findFirst({
      where: {
        tenantId,
        appointmentNumber: { startsWith: prefix },
      },
      orderBy: { appointmentNumber: 'desc' },
      select: { appointmentNumber: true },
    });

    let nextSeq = 1;
    if (lastAppointment?.appointmentNumber) {
      const parts = lastAppointment.appointmentNumber.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Helper: add minutes to HH:mm string
   */
  private addMinutesToTime(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  /**
   * Create an appointment with automatic collision-retry loop
   */
  async create(tenantId: string, data: CreateAppointmentDto) {
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 1. Resolve or create guest
          let guestId = data.guestId;
          if (!guestId && data.guest) {
            let existingGuest = await tx.guest.findUnique({
              where: {
                tenantId_mobile: {
                  tenantId,
                  mobile: data.guest.mobile,
                },
              },
            });

            if (!existingGuest) {
              const count = await tx.guest.count({ where: { tenantId } });
              const guestCode = `GST-${String(count + 1).padStart(4, '0')}`;
              existingGuest = await tx.guest.create({
                data: {
                  tenantId,
                  guestCode,
                  name: data.guest.name,
                  mobile: data.guest.mobile,
                  email: data.guest.email || null,
                  gender: data.guest.gender || 'OTHER',
                  customerType: 'REGULAR',
                },
              });
            }
            guestId = existingGuest.id;
          }

          if (!guestId) {
            throw new Error('Guest could not be resolved');
          }

          // 2. Fetch service details for calculation
          const serviceIds = data.items.map((i) => i.serviceId);
          const services = await tx.service.findMany({
            where: { tenantId, id: { in: serviceIds } },
          });
          const serviceMap = new Map(services.map((s) => [s.id, s]));

          // 3. Process items and calculate total
          let totalAmount = 0;
          const itemsToCreate = data.items.map((item) => {
            const svc = serviceMap.get(item.serviceId);
            if (!svc) {
              throw new Error(`Service with ID ${item.serviceId} not found`);
            }

            const itemPrice = item.price !== undefined ? item.price : Number(svc.salePrice || svc.price);
            const duration = item.durationMinutes || svc.durationMinutes || 30;
            const endTime = item.endTime || this.addMinutesToTime(item.startTime, duration);

            totalAmount += itemPrice;

            return {
              tenantId,
              serviceId: item.serviceId,
              staffId: item.staffId || null,
              resourceId: item.resourceId || null,
              startTime: item.startTime,
              endTime,
              durationMinutes: duration,
              price: new Prisma.Decimal(itemPrice),
              isRecommendedStaff: item.isRecommendedStaff || false,
            };
          });

          // 4. Generate appointment number
          const appointmentNumber = await this.getNextAppointmentNumber(tenantId, tx);

          // 5. Create Appointment
          const appointment = await tx.appointment.create({
            data: {
              tenantId,
              appointmentNumber,
              guestId,
              appointmentDate: new Date(data.appointmentDate),
              status: data.status || 'CONFIRMED',
              bookingSource: data.bookingSource || 'WALK_IN',
              totalAmount: new Prisma.Decimal(totalAmount),
              instruction: data.instruction || null,
              confirmationSms: data.confirmationSms !== undefined ? data.confirmationSms : true,
              smsToOwner: data.smsToOwner !== undefined ? data.smsToOwner : true,
              items: {
                create: itemsToCreate,
              },
            },
            include: {
              guest: true,
              items: {
                include: {
                  service: true,
                  staff: true,
                  resource: true,
                },
              },
            },
          });

          return appointment;
        });
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = error.meta?.target as string[] | string;
          const isApptCollision =
            (Array.isArray(target) && target.includes('appointment_number')) ||
            (typeof target === 'string' && target.includes('appointment_number'));

          if (isApptCollision && attempt < maxRetries) {
            const jitterMs = Math.floor(Math.random() * 50) + 20;
            await new Promise((r) => setTimeout(r, jitterMs));
            continue;
          }
        }
        throw error;
      }
    }
    throw new Error('Failed to generate a unique appointment number after multiple retries.');
  }

  /**
   * Calendar grid retrieval matching QUBEXE frame 052-118
   */
  async findCalendar(
    tenantId: string,
    dateStr: string,
    view: 'staff' | 'resource' = 'staff',
    statusFilter?: string
  ) {
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // 1. Fetch all appointments on this date
    const appointmentsWhere: Prisma.AppointmentWhereInput = {
      tenantId,
      appointmentDate: targetDate,
    };

    if (statusFilter && statusFilter !== 'TOTAL') {
      appointmentsWhere.status = statusFilter;
    }

    const appointments = await this.prisma.appointment.findMany({
      where: appointmentsWhere,
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            totalSpend: true,
            totalVisits: true,
          },
        },
        items: {
          include: {
            service: { select: { id: true, name: true, durationMinutes: true, price: true, salePrice: true } },
            staff: { select: { id: true, name: true, isActive: true } },
            resource: { select: { id: true, name: true, capacity: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch all appointments on this date for status pill metrics
    const allDateAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: targetDate,
      },
      select: { status: true, bookingSource: true },
    });

    const statusCounts = {
      confirmed: allDateAppointments.filter((a) => a.status === 'CONFIRMED').length,
      online: allDateAppointments.filter((a) => a.status === 'ONLINE' || a.bookingSource === 'ONLINE').length,
      completed: allDateAppointments.filter((a) => a.status === 'COMPLETED').length,
      cancelled: allDateAppointments.filter((a) => a.status === 'CANCELLED').length,
      total: allDateAppointments.length,
    };

    // 3. Generate standard 30-minute time slots (08:00 AM to 11:30 PM)
    const timeSlots: string[] = [];
    for (let h = 8; h <= 23; h++) {
      for (const m of [0, 30]) {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const timeFormatted = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
        timeSlots.push(timeFormatted);
      }
    }

    // 4. Columns: Staff or Resource
    let columns: any[] = [];
    if (view === 'staff') {
      const staffList = await this.prisma.staff.findMany({
        where: { tenantId, isActive: true },
        include: {
          appointmentSettings: true,
          weeklySchedules: {
            where: { dayOfWeek },
          },
        },
        orderBy: { name: 'asc' },
      });

      columns = staffList.map((s) => {
        let isAvailable = true;
        let statusText: string | null = null;

        if (s.appointmentSettings && !s.appointmentSettings.enableAppointments) {
          isAvailable = false;
          statusText = 'Staff Unavailable';
        } else if (s.weeklySchedules.length > 0 && s.weeklySchedules[0].isWeeklyOff) {
          isAvailable = false;
          statusText = 'Week Off';
        }

        return {
          id: s.id,
          name: s.name,
          isAvailable,
          statusText,
        };
      });
    } else {
      const resourceList = await this.prisma.resource.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
      });

      columns = resourceList.map((r) => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        isAvailable: r.isActive,
        statusText: r.isActive ? null : 'Inactive',
      }));
    }

    return {
      date: dateStr,
      view,
      statusCounts,
      timeSlots,
      columns,
      appointments,
    };
  }

  /**
   * Find appointment by ID with full details & guest profile
   */
  async findById(tenantId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        guest: {
          include: {
            salutationRef: true,
            membershipRef: true,
          },
        },
        posOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            paymentMethod: true,
            paymentStatus: true,
          },
        },
        items: {
          include: {
            service: true,
            staff: true,
            resource: true,
          },
        },
      },
    });

    if (!appointment) return null;

    // Fetch guest recent appointments for "Guest History" modal seen in frame 85
    const guestHistory = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        guestId: appointment.guestId,
        id: { not: id },
      },
      take: 5,
      orderBy: { appointmentDate: 'desc' },
      include: {
        items: {
          include: {
            service: { select: { name: true } },
          },
        },
      },
    });

    return {
      ...appointment,
      guestHistory,
    };
  }

  /**
   * List appointments with filters and pagination
   */
  async findMany(tenantId: string, query: ListAppointmentsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = { tenantId };

    if (query.date) {
      where.appointmentDate = new Date(query.date);
    } else if (query.startDate || query.endDate) {
      where.appointmentDate = {};
      if (query.startDate) where.appointmentDate.gte = new Date(query.startDate);
      if (query.endDate) where.appointmentDate.lte = new Date(query.endDate);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.guestId) {
      where.guestId = query.guestId;
    }

    if (query.staffId) {
      where.items = { some: { staffId: query.staffId } };
    }

    if (query.resourceId) {
      where.items = { some: { resourceId: query.resourceId } };
    }

    if (query.search) {
      where.OR = [
        { appointmentNumber: { contains: query.search, mode: 'insensitive' } },
        { guest: { name: { contains: query.search, mode: 'insensitive' } } },
        { guest: { mobile: { contains: query.search } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'appointmentDate']: query.sortOrder || 'desc' },
        include: {
          guest: {
            select: { id: true, name: true, mobile: true },
          },
          items: {
            include: {
              service: { select: { id: true, name: true } },
              staff: { select: { id: true, name: true } },
              resource: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update appointment details and items
   */
  async update(tenantId: string, id: string, data: UpdateAppointmentDto) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });

      if (!existing) {
        throw new Error('Appointment not found');
      }

      let totalAmount = Number(existing.totalAmount);

      if (data.items) {
        // Delete existing items and recreate
        await tx.appointmentItem.deleteMany({
          where: { appointmentId: id, tenantId },
        });

        const serviceIds = data.items.map((i) => i.serviceId);
        const services = await tx.service.findMany({
          where: { tenantId, id: { in: serviceIds } },
        });
        const serviceMap = new Map(services.map((s) => [s.id, s]));

        totalAmount = 0;
        const newItems = data.items.map((item) => {
          const svc = serviceMap.get(item.serviceId);
          if (!svc) throw new Error(`Service ${item.serviceId} not found`);

          const itemPrice = item.price !== undefined ? item.price : Number(svc.salePrice || svc.price);
          const duration = item.durationMinutes || svc.durationMinutes || 30;
          const endTime = item.endTime || this.addMinutesToTime(item.startTime, duration);
          totalAmount += itemPrice;

          return {
            tenantId,
            serviceId: item.serviceId,
            staffId: item.staffId || null,
            resourceId: item.resourceId || null,
            startTime: item.startTime,
            endTime,
            durationMinutes: duration,
            price: new Prisma.Decimal(itemPrice),
            isRecommendedStaff: item.isRecommendedStaff || false,
          };
        });

        await tx.appointmentItem.createMany({
          data: newItems.map((item) => ({
            ...item,
            appointmentId: id,
          })),
        });
      }

      if (data.staffId) {
        await tx.appointmentItem.updateMany({
          where: { appointmentId: id, tenantId },
          data: { staffId: data.staffId },
        });
      }

      return await tx.appointment.update({
        where: { id },
        data: {
          guestId: data.guestId || undefined,
          appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : undefined,
          status: data.status || undefined,
          bookingSource: data.bookingSource || undefined,
          instruction: data.instruction !== undefined ? data.instruction : undefined,
          confirmationSms: data.confirmationSms !== undefined ? data.confirmationSms : undefined,
          smsToOwner: data.smsToOwner !== undefined ? data.smsToOwner : undefined,
          totalAmount: new Prisma.Decimal(totalAmount),
        },
        include: {
          guest: true,
          items: {
            include: {
              service: true,
              staff: true,
              resource: true,
            },
          },
        },
      });
    });
  }

  /**
   * Status change (Check In, Start, Complete, Cancel, No Show)
   */
  async updateStatus(tenantId: string, id: string, status: string, cancelledReason?: string | null) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;

    return await this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        cancelledReason: cancelledReason || undefined,
      },
      include: {
        guest: true,
        items: true,
      },
    });
  }

  /**
   * Reschedule appointment (date and times)
   */
  async reschedule(tenantId: string, id: string, data: RescheduleAppointmentDto) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!existing) throw new Error('Appointment not found');

      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (item.id) {
            await tx.appointmentItem.update({
              where: { id: item.id },
              data: {
                startTime: item.startTime,
                endTime: item.endTime || undefined,
                staffId: item.staffId !== undefined ? item.staffId : undefined,
                resourceId: item.resourceId !== undefined ? item.resourceId : undefined,
              },
            });
          }
        }
      } else if (data.staffId || data.startTime) {
        await tx.appointmentItem.updateMany({
          where: { appointmentId: id, tenantId },
          data: {
            ...(data.staffId ? { staffId: data.staffId } : {}),
            ...(data.startTime ? { startTime: data.startTime } : {}),
          },
        });
      }

      return await tx.appointment.update({
        where: { id },
        data: {
          appointmentDate: new Date(data.appointmentDate),
        },
        include: {
          guest: true,
          items: {
            include: {
              service: true,
              staff: true,
              resource: true,
            },
          },
        },
      });
    });
  }

  /**
   * Checkout to POS: seamlessly convert appointment into a POS order
   */
  async checkoutToPos(tenantId: string, id: string, cashierId?: string) {
    return await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { id, tenantId },
        include: {
          guest: true,
          items: {
            include: {
              service: true,
              staff: true,
            },
          },
        },
      });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.posOrderId) {
        throw new Error('This appointment has already been checked out to POS');
      }

      if (appointment.status === 'CANCELLED') {
        throw new Error('Cannot checkout a cancelled appointment');
      }

      // Generate POS order number
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const prefix = `ORD-${yyyy}${mm}${dd}-`;

      const lastOrder = await tx.posOrder.findFirst({
        where: { tenantId, orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });

      let nextSeq = 1;
      if (lastOrder?.orderNumber) {
        const parts = lastOrder.orderNumber.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed)) nextSeq = parsed + 1;
        }
      }
      const orderNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

      // Calculate totals
      let subtotal = 0;
      const orderItems = appointment.items.map((item) => {
        const price = Number(item.price);
        subtotal += price;
        return {
          tenantId,
          itemType: 'SERVICE',
          serviceId: item.serviceId,
          staffId: item.staffId,
          itemName: item.service.name,
          quantity: 1,
          unitPrice: new Prisma.Decimal(price),
          subtotal: new Prisma.Decimal(price),
          total: new Prisma.Decimal(price),
        };
      });

      // Create POS Order
      const order = await tx.posOrder.create({
        data: {
          tenantId,
          orderNumber,
          guestId: appointment.guestId,
          cashierId: cashierId || null,
          status: 'PENDING',
          orderDate: now,
          subtotal: new Prisma.Decimal(subtotal),
          totalAmount: new Prisma.Decimal(subtotal),
          paymentMethod: 'CASH',
          paymentStatus: 'UNPAID',
          instruction: appointment.instruction || null,
          notes: `Converted from Appointment #${appointment.appointmentNumber}`,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
        },
      });

      // Update Appointment with posOrderId and status COMPLETED
      await tx.appointment.update({
        where: { id },
        data: {
          posOrderId: order.id,
          status: 'COMPLETED',
        },
      });

      return order;
    });
  }

  /**
   * Delete appointment and cascade-delete linked POS order if any
   */
  async delete(tenantId: string, id: string) {
    const isUuid = typeof id === 'string' && /^[0-9a-fA-F-]{36}$/.test(id);
    const cleanId = typeof id === 'string' ? id.replace(/^#/, '').trim() : '';

    const existing = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        OR: [
          ...(isUuid ? [{ id }] : []),
          { appointmentNumber: id },
          { appointmentNumber: cleanId },
          { appointmentNumber: `#${cleanId}` },
          ...(isUuid ? [{ posOrderId: id }] : []),
          { posOrder: { orderNumber: id } },
          { posOrder: { orderNumber: cleanId } },
        ],
      },
      include: {
        posOrder: true,
      },
    });

    if (existing) {
      // 1. If this appointment has a linked POS order, delete the PosOrder too
      if (existing.posOrderId) {
        await this.prisma.posOrder.deleteMany({
          where: { id: existing.posOrderId, tenantId },
        });
      }

      // 2. Delete the appointment record (items cascade deleted via relation)
      return await this.prisma.appointment.delete({
        where: { id: existing.id },
      });
    }

    // If no appointment was found, check if this is a standalone POS order ID/number
    const posOrder = await this.prisma.posOrder.findFirst({
      where: {
        tenantId,
        OR: [
          ...(isUuid ? [{ id }] : []),
          { orderNumber: id },
          { orderNumber: cleanId },
          { orderNumber: `#${cleanId}` },
        ],
      },
    });

    if (posOrder) {
      await this.prisma.appointment.deleteMany({
        where: { tenantId, posOrderId: posOrder.id },
      });
      await this.prisma.posOrder.delete({
        where: { id: posOrder.id },
      });
      return { id: posOrder.id };
    }

    return null;
  }
}

export const appointmentRepository = new AppointmentRepository();
