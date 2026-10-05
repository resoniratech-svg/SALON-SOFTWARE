import { Prisma } from '@prisma/client';
import { packageRepository, PackageRepository } from './package.repository.js';
import { CreatePackageInput, UpdatePackageInput, PackageQuery } from './package.types.js';
import { AppError, NotFoundError } from '../../utils/app-error.js';

export class PackageService {
  constructor(private repo: PackageRepository = packageRepository) {}

  async create(tenantId: string, input: CreatePackageInput) {
    const existing = await this.repo.findByName(tenantId, input.name);
    if (existing) {
      throw new AppError(`Package '${input.name}' already exists in this company`, 409);
    }

    const data: Prisma.PackageUncheckedCreateInput = {
      tenantId,
      name: input.name.trim(),
      price: new Prisma.Decimal(input.price),
      validityDays: input.validityDays,
      renewalReminderDays: input.renewalReminderDays ?? 15,
      services: input.services ?? [],
      products: input.products ?? [],
      description: input.description ?? input.header ?? null,
      isActive: input.isActive ?? true,
    };

    return this.repo.create(data);
  }

  async list(tenantId: string, query: PackageQuery) {
    return this.repo.list(tenantId, query);
  }

  async getById(tenantId: string, id: string) {
    const pkg = await this.repo.findById(tenantId, id);
    if (!pkg) {
      throw new NotFoundError(`Package not found with ID '${id}'`);
    }
    return pkg;
  }

  async update(tenantId: string, id: string, input: UpdatePackageInput) {
    await this.getById(tenantId, id);

    if (input.name) {
      const existing = await this.repo.findByName(tenantId, input.name, id);
      if (existing) {
        throw new AppError(`Package '${input.name}' already exists in this company`, 409);
      }
    }

    const data: Prisma.PackageUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.price !== undefined) data.price = new Prisma.Decimal(input.price);
    if (input.validityDays !== undefined) data.validityDays = input.validityDays;
    if (input.renewalReminderDays !== undefined) data.renewalReminderDays = input.renewalReminderDays;
    if (input.services !== undefined) data.services = input.services;
    if (input.products !== undefined) data.products = input.products;
    if (input.description !== undefined) data.description = input.description;
    if (input.header !== undefined && !input.description) data.description = input.header;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.repo.update(id, data);
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    await this.getById(tenantId, id);
    return this.repo.update(id, { isActive });
  }

  async delete(tenantId: string, id: string) {
    const pkg = await this.getById(tenantId, id);
    const usageCount = await this.repo.countUsage(tenantId, id);
    if (usageCount > 0) {
      // Module Isolation: preserve guest package purchase history and historical sales.
      // Soft-delete by marking inactive so it disappears from package catalog and POS.
      await this.repo.update(id, { isActive: false });
      return { success: true, message: 'Package removed from catalog (customer purchase history preserved)', softDeleted: true };
    }
    await this.repo.delete(id);
    return { success: true, message: 'Package deleted successfully' };
  }
}

export const packageService = new PackageService();
