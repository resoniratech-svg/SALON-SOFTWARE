import { prisma } from '../../config/database.js';
import { CreateServiceInput, UpdateServiceInput, ServiceListQuery, StaffMappingItem } from './service.types.js';

export class ServiceRepository {
  async findByNameAndCategory(tenantId: string, name: string, categoryId: string, excludeId?: string) {
    return prisma.service.findFirst({
      where: {
        tenantId,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
        categoryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findById(tenantId: string, id: string) {
    return prisma.service.findFirst({
      where: { id, tenantId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            group: true,
            isActive: true,
            stores: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        serviceStaff: {
          select: {
            id: true,
            staffId: true,
            isRecommended: true,
            staff: {
              select: {
                id: true,
                name: true,
                isActive: true,
                personalDetails: {
                  select: {
                    displayName: true,
                    mobile: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async countHistoricalUsage(tenantId: string, id: string) {
    const [posCount, apptCount, enquiryCount] = await Promise.all([
      prisma.posOrderItem.count({ where: { tenantId, serviceId: id } }),
      prisma.appointmentItem.count({ where: { serviceId: id } }),
      prisma.enquiry.count({ where: { tenantId, serviceId: id } }),
    ]);
    return {
      posOrders: posCount,
      appointments: apptCount,
      enquiries: enquiryCount,
      total: posCount + apptCount + enquiryCount,
    };
  }

  async list(tenantId: string, query: ServiceListQuery) {
    const { search, categoryId, subcategoryId, group, isActive, hideFromCatalogue, store } = query;
    const where: any = { tenantId };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (group) {
      where.group = group;
    }

    if (hideFromCatalogue !== undefined) {
      where.hideFromCatalogue = hideFromCatalogue;
    }

    if (search) {
      where.name = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            group: true,
            isActive: true,
            stores: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        serviceStaff: {
          select: {
            id: true,
            staffId: true,
            isRecommended: true,
            staff: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (store && store.trim()) {
      const s = store.trim().toLowerCase();
      return services.filter((svc) => {
        const catStores = Array.isArray(svc.category?.stores) ? (svc.category.stores as string[]) : [];
        if (catStores.length === 0) return true;
        return catStores.some((st) => st.toLowerCase() === s);
      });
    }

    return services;
  }

  async countStaffByIds(tenantId: string, staffIds: string[]) {
    if (staffIds.length === 0) return 0;
    return prisma.staff.count({
      where: { id: { in: staffIds }, tenantId },
    });
  }

  async createServiceTransaction(tenantId: string, input: CreateServiceInput) {
    const hour = input.hour ?? 0;
    const minute = input.minute ?? 0;
    const durationMinutes = input.durationMinutes !== undefined ? input.durationMinutes : hour * 60 + minute;

    // Normalize staff mappings
    let staffMappings: StaffMappingItem[] = [];
    if (input.staff && input.staff.length > 0) {
      staffMappings = input.staff;
    } else if (input.staffIds && input.staffIds.length > 0) {
      staffMappings = input.staffIds.map((id) => ({ staffId: id, isRecommended: false }));
    }

    return prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: {
          tenantId,
          name: input.name.trim(),
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId ?? null,
          position: input.position ?? 0,
          isActive: input.isActive ?? true,
          hour,
          minute,
          durationMinutes,
          serviceReminderDays: input.serviceReminderDays ?? 0,
          sacCode: input.sacCode ? input.sacCode.trim() : null,
          serviceTag: input.serviceTag ? input.serviceTag.trim() : null,
          group: input.group ?? null,
          hideFromCatalogue: input.hideFromCatalogue ?? false,
          price: input.price,
          salePrice: input.salePrice ?? 0,
          isNonDiscountable: input.isNonDiscountable ?? false,
          description: input.description ? input.description.trim() : null,
          imageUrl: input.imageUrl ?? null,
          consumables: (input.consumables as any) ?? [],
          resourceIds: (input.resourceIds as any) ?? [],
        },
      });

      if (staffMappings.length > 0) {
        await tx.serviceStaff.createMany({
          data: staffMappings.map((sm) => ({
            serviceId: service.id,
            staffId: sm.staffId,
            isRecommended: sm.isRecommended ?? false,
          })),
        });
      }

      return service;
    });
  }

  async updateServiceTransaction(tenantId: string, id: string, input: UpdateServiceInput) {
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.hour !== undefined) updateData.hour = input.hour;
    if (input.minute !== undefined) updateData.minute = input.minute;

    if (input.durationMinutes !== undefined) {
      updateData.durationMinutes = input.durationMinutes;
    } else if (input.hour !== undefined || input.minute !== undefined) {
      const current = await prisma.service.findFirst({ where: { id, tenantId }, select: { hour: true, minute: true } });
      const finalHour = input.hour !== undefined ? input.hour : (current?.hour ?? 0);
      const finalMinute = input.minute !== undefined ? input.minute : (current?.minute ?? 0);
      updateData.durationMinutes = finalHour * 60 + finalMinute;
    }

    if (input.serviceReminderDays !== undefined) updateData.serviceReminderDays = input.serviceReminderDays;
    if (input.sacCode !== undefined) updateData.sacCode = input.sacCode ? input.sacCode.trim() : null;
    if (input.serviceTag !== undefined) updateData.serviceTag = input.serviceTag ? input.serviceTag.trim() : null;
    if (input.group !== undefined) updateData.group = input.group;
    if (input.hideFromCatalogue !== undefined) updateData.hideFromCatalogue = input.hideFromCatalogue;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
    if (input.isNonDiscountable !== undefined) updateData.isNonDiscountable = input.isNonDiscountable;
    if (input.description !== undefined) updateData.description = input.description ? input.description.trim() : null;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
    if (input.consumables !== undefined) updateData.consumables = input.consumables as any;
    if (input.resourceIds !== undefined) updateData.resourceIds = input.resourceIds as any;

    const hasStaffUpdate = input.staff !== undefined || input.staffIds !== undefined;
    let newStaffMappings: StaffMappingItem[] | null = null;
    if (input.staff !== undefined) {
      newStaffMappings = input.staff;
    } else if (input.staffIds !== undefined) {
      newStaffMappings = input.staffIds.map((sid) => ({ staffId: sid, isRecommended: false }));
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: updateData,
      });

      if (hasStaffUpdate && newStaffMappings !== null) {
        await tx.serviceStaff.deleteMany({
          where: { serviceId: id },
        });

        if (newStaffMappings.length > 0) {
          await tx.serviceStaff.createMany({
            data: newStaffMappings.map((sm) => ({
              serviceId: id,
              staffId: sm.staffId,
              isRecommended: sm.isRecommended ?? false,
            })),
          });
        }
      }

      return updated;
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return prisma.service.update({
      where: { id },
      data: { isActive },
    });
  }

  async delete(id: string) {
    return prisma.service.delete({
      where: { id },
    });
  }
}

export const serviceRepository = new ServiceRepository();
