import {
  ProductCategoryRepository,
  productCategoryRepository,
} from './product-category.repository.js';
import {
  CreateProductCategoryDTO,
  UpdateProductCategoryDTO,
  ProductCategoryQueryParams,
} from './product-category.types.js';
import { NotFoundError, AppError } from '../../utils/app-error.js';
import { prisma } from '../../config/database.js';

export class ProductCategoryService {
  constructor(private repo: ProductCategoryRepository = productCategoryRepository) {}

  async create(tenantId: string, input: CreateProductCategoryDTO) {
    const existing = await this.repo.findByNameInsensitive(tenantId, input.name);
    if (existing) {
      throw new AppError(`Product category '${input.name}' already exists`, 409);
    }

    if (input.parentId) {
      const parent = await this.repo.findById(tenantId, input.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent product category not found with ID '${input.parentId}'`);
      }
    }

    return this.repo.create(tenantId, input);
  }

  async list(tenantId: string, query: ProductCategoryQueryParams) {
    return this.repo.findMany(tenantId, query);
  }

  async getById(tenantId: string, id: string) {
    const category = await this.repo.findById(tenantId, id);
    if (!category) {
      throw new NotFoundError(`Product category not found with ID '${id}'`);
    }
    return category;
  }

  async update(tenantId: string, id: string, input: UpdateProductCategoryDTO) {
    await this.getById(tenantId, id);

    if (input.name) {
      const existing = await this.repo.findByNameInsensitive(tenantId, input.name, id);
      if (existing) {
        throw new AppError(`Product category '${input.name}' already exists`, 409);
      }
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new AppError('A category cannot be its own parent', 400);
      }
      const parent = await this.repo.findById(tenantId, input.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent product category not found with ID '${input.parentId}'`);
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
    const { products, children } = await this.repo.countRelations(tenantId, id);
    if (products > 0) {
      throw new AppError(
        `Cannot delete product category that contains ${products} active item(s). Please delete or reassign them first.`,
        409
      );
    }
    if (children > 0) {
      throw new AppError(
        `Cannot delete product category because it contains ${children} subcategory(s). Please reassign or delete them first.`,
        409
      );
    }
    return this.repo.delete(id);
  }
}

export const productCategoryService = new ProductCategoryService();
