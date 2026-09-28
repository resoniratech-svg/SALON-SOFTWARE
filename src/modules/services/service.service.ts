import { prisma } from '../../config/database.js';
import { ServiceRepository, serviceRepository } from './service.repository.js';
import { CreateServiceInput, UpdateServiceInput, ServiceListQuery } from './service.types.js';
import { BadRequestError, NotFoundError, AppError } from '../../utils/app-error.js';

export class ServiceService {
  constructor(private repo: ServiceRepository = serviceRepository) {}

  async create(tenantId: string, input: CreateServiceInput) {
    // 1. Verify Category exists and belongs to current tenant
    const category = await prisma.serviceCategory.findFirst({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) {
      throw new BadRequestError(`Service category not found with ID '${input.categoryId}'`);
    }

    // 1.1 Verify Subcategory exists and belongs to current tenant if provided
    if (input.subcategoryId) {
      const subcat = await prisma.serviceCategory.findFirst({
        where: { id: input.subcategoryId, tenantId },
      });
      if (!subcat) {
        throw new BadRequestError(`Service subcategory not found with ID '${input.subcategoryId}'`);
      }
    }

    // 2. Check case-insensitive uniqueness of service name within this category and tenant
    const existing = await this.repo.findByNameAndCategory(tenantId, input.name, input.categoryId);
    if (existing) {
      throw new AppError(`Service '${input.name}' already exists in this category`, 409);
    }

    // 3. Verify mapped staff exist in database within current tenant
    const staffIdsToVerify: string[] = [];
    if (input.staff && input.staff.length > 0) {
      staffIdsToVerify.push(...input.staff.map((s) => s.staffId));
    } else if (input.staffIds && input.staffIds.length > 0) {
      staffIdsToVerify.push(...input.staffIds);
    }

    if (staffIdsToVerify.length > 0) {
      const distinctStaffIds = Array.from(new Set(staffIdsToVerify));
      const foundCount = await this.repo.countStaffByIds(tenantId, distinctStaffIds);
      if (foundCount !== distinctStaffIds.length) {
        throw new BadRequestError('One or more mapped staff IDs do not exist');
      }
    }

    // 3.1 Verify mapped resources belong to current tenant
    if (input.resourceIds && input.resourceIds.length > 0) {
      const distinctResourceIds = Array.from(new Set(input.resourceIds));
      const foreignResource = await prisma.resource.findFirst({
        where: {
          OR: [
            { id: { in: distinctResourceIds } },
            { name: { in: distinctResourceIds } },
          ],
          tenantId: { not: tenantId },
        },
      });
      if (foreignResource) {
        throw new BadRequestError(
          `Cannot map resource '${foreignResource.name}' belonging to another company`
        );
      }
    }

    // Inherit group from category if not explicitly provided
    if (!input.group && category.group) {
      input.group = category.group;
    }

    // 4. Create Service atomically in transaction
    const created = await this.repo.createServiceTransaction(tenantId, input);
    return this.getById(tenantId, created.id);
  }

  async list(tenantId: string, query: ServiceListQuery) {
    return this.repo.list(tenantId, query);
  }

  async getById(tenantId: string, id: string) {
    const service = await this.repo.findById(tenantId, id);
    if (!service) {
      throw new NotFoundError(`Service not found with ID '${id}'`);
    }
    return service;
  }

  async update(tenantId: string, id: string, input: UpdateServiceInput) {
    const current = await this.getById(tenantId, id);

    const targetCategoryId = input.categoryId ?? current.categoryId;
    const targetName = input.name ?? current.name;

    // 1. If categoryId changed, verify new category exists in this tenant
    if (input.categoryId && input.categoryId !== current.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestError(`Service category not found with ID '${input.categoryId}'`);
      }
    }

    // 1.1 If subcategoryId provided, verify it exists in this tenant
    if (input.subcategoryId) {
      const subcat = await prisma.serviceCategory.findFirst({
        where: { id: input.subcategoryId, tenantId },
      });
      if (!subcat) {
        throw new BadRequestError(`Service subcategory not found with ID '${input.subcategoryId}'`);
      }
    }

    // 2. Check duplicate name if name or categoryId updated
    if (input.name || input.categoryId) {
      const existing = await this.repo.findByNameAndCategory(tenantId, targetName, targetCategoryId, id);
      if (existing) {
        throw new AppError(`Service '${targetName}' already exists in this category`, 409);
      }
    }

    // 3. Verify mapped staff if provided
    const staffIdsToVerify: string[] = [];
    if (input.staff !== undefined) {
      staffIdsToVerify.push(...input.staff.map((s) => s.staffId));
    } else if (input.staffIds !== undefined) {
      staffIdsToVerify.push(...input.staffIds);
    }

    if (staffIdsToVerify.length > 0) {
      const distinctStaffIds = Array.from(new Set(staffIdsToVerify));
      const foundCount = await this.repo.countStaffByIds(tenantId, distinctStaffIds);
      if (foundCount !== distinctStaffIds.length) {
        throw new BadRequestError('One or more mapped staff IDs do not exist');
      }
    }

    // 3.1 Verify mapped resources belong to current tenant
    if (input.resourceIds && input.resourceIds.length > 0) {
      const distinctResourceIds = Array.from(new Set(input.resourceIds));
      const foreignResource = await prisma.resource.findFirst({
        where: {
          OR: [
            { id: { in: distinctResourceIds } },
            { name: { in: distinctResourceIds } },
          ],
          tenantId: { not: tenantId },
        },
      });
      if (foreignResource) {
        throw new BadRequestError(
          `Cannot map resource '${foreignResource.name}' belonging to another company`
        );
      }
    }

    // 4. Update atomically
    await this.repo.updateServiceTransaction(tenantId, id, input);
    return this.getById(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    await this.getById(tenantId, id);
    return this.repo.updateStatus(id, isActive);
  }

  async delete(tenantId: string, id: string) {
    const service = await this.getById(tenantId, id);
    const usage = await this.repo.countHistoricalUsage(tenantId, id);
    if (usage.total > 0) {
      throw new AppError(
        `Cannot delete service '${service.name}' because it is referenced in historical sales orders (${usage.posOrders}), appointments (${usage.appointments}), or enquiries (${usage.enquiries}). Please deactivate it instead.`,
        409
      );
    }
    return this.repo.delete(id);
  }
}

export const serviceService = new ServiceService();
