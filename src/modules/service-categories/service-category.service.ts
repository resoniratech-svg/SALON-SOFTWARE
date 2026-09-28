import {
  ServiceCategoryRepository,
  serviceCategoryRepository,
} from './service-category.repository.js';
import {
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
  ServiceCategoryListQuery,
} from './service-category.types.js';
import { NotFoundError, AppError } from '../../utils/app-error.js';

export class ServiceCategoryService {
  constructor(private repo: ServiceCategoryRepository = serviceCategoryRepository) {}

  async create(tenantId: string, input: CreateServiceCategoryInput) {
    // 1. Check case-insensitive uniqueness of category name within this tenant
    const existing = await this.repo.findByName(tenantId, input.name);
    if (existing) {
      throw new AppError(`Service category '${input.name}' already exists`, 409);
    }

    // 2. Validate parent category if provided
    if (input.parentId) {
      const parent = await this.repo.findById(tenantId, input.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent service category not found with ID '${input.parentId}'`);
      }
    }

    return this.repo.create(tenantId, input);
  }

  async list(tenantId: string, query: ServiceCategoryListQuery) {
    return this.repo.list(tenantId, query);
  }

  async getById(tenantId: string, id: string) {
    const category = await this.repo.findById(tenantId, id);
    if (!category) {
      throw new NotFoundError(`Service category not found with ID '${id}'`);
    }
    return category;
  }

  async update(tenantId: string, id: string, input: UpdateServiceCategoryInput) {
    await this.getById(tenantId, id);

    if (input.name) {
      const existing = await this.repo.findByName(tenantId, input.name, id);
      if (existing) {
        throw new AppError(`Service category '${input.name}' already exists`, 409);
      }
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new AppError('A category cannot be its own parent', 400);
      }
      const parent = await this.repo.findById(tenantId, input.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent service category not found with ID '${input.parentId}'`);
      }
    }

    return this.repo.update(id, input);
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean) {
    await this.getById(tenantId, id);
    return this.repo.updateStatus(id, isActive);
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    const { services, children } = await this.repo.countRelations(tenantId, id);
    if (services > 0) {
      throw new AppError(
        `Cannot delete service category because it contains ${services} service(s). Please reassign or delete them first.`,
        409
      );
    }
    if (children > 0) {
      throw new AppError(
        `Cannot delete service category because it contains ${children} subcategory(s). Please reassign or delete them first.`,
        409
      );
    }
    return this.repo.delete(id);
  }
}

export const serviceCategoryService = new ServiceCategoryService();
