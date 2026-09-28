import { resourceRepository, ResourceRepository } from './resource.repository.js';
import { CreateResourceInput, UpdateResourceInput, ResourceQueryParams } from './resource.types.js';
import { AuthenticatedUser } from '../auth/auth.types.js';
import { AppError, NotFoundError, BadRequestError } from '../../utils/app-error.js';
import { prisma } from '../../config/database.js';

export class ResourceService {
  constructor(private repo: ResourceRepository = resourceRepository) {}

  async create(tenantId: string, input: CreateResourceInput, actor: AuthenticatedUser, ipAddress?: string) {
    const existing = await this.repo.findByName(tenantId, input.name);
    if (existing) {
      throw new AppError(`Resource '${input.name}' already exists in this company`, 409);
    }

    const resource = await this.repo.create(tenantId, input);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'RESOURCE_CREATED',
        entityType: 'RESOURCE',
        entityId: resource.id,
        metadata: {
          name: resource.name,
          capacity: resource.capacity,
          isActive: resource.isActive,
        },
        ipAddress,
      },
    });

    return resource;
  }

  async list(tenantId: string, params: ResourceQueryParams) {
    return this.repo.findMany(tenantId, params);
  }

  async getById(tenantId: string, id: string) {
    const resource = await this.repo.findById(tenantId, id);
    if (!resource) {
      throw new NotFoundError(`Resource not found with ID '${id}'`);
    }
    return resource;
  }

  async update(tenantId: string, id: string, input: UpdateResourceInput, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getById(tenantId, id);

    if (input.name) {
      const existing = await this.repo.findByName(tenantId, input.name, id);
      if (existing) {
        throw new AppError(`Resource '${input.name}' already exists in this company`, 409);
      }
    }

    const updated = await this.repo.update(tenantId, id, input);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'RESOURCE_UPDATED',
        entityType: 'RESOURCE',
        entityId: id,
        metadata: {
          updatedFields: Object.keys(input),
        },
        ipAddress,
      },
    });

    return updated;
  }

  async updateStatus(tenantId: string, id: string, isActive: boolean, actor: AuthenticatedUser, ipAddress?: string) {
    await this.getById(tenantId, id);

    const updated = await this.repo.updateStatus(tenantId, id, isActive);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'RESOURCE_STATUS_UPDATED',
        entityType: 'RESOURCE',
        entityId: id,
        metadata: { isActive },
        ipAddress,
      },
    });

    return updated;
  }

  async delete(tenantId: string, id: string, actor: AuthenticatedUser, ipAddress?: string) {
    const resource = await this.getById(tenantId, id);

    // Dependency check: prevent deleting resources assigned to active services
    const referencingServices = await this.repo.findReferencingServices(tenantId, id, resource.name);
    if (referencingServices.length > 0) {
      const serviceNames = referencingServices.map((s) => s.name).join(', ');
      throw new BadRequestError(
        `Cannot delete resource '${resource.name}' because it is assigned to ${referencingServices.length} service(s): ${serviceNames}`
      );
    }

    await this.repo.delete(tenantId, id);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorType: actor.role.name,
        actorName: actor.username,
        tenantId,
        action: 'RESOURCE_DELETED',
        entityType: 'RESOURCE',
        entityId: id,
        metadata: { name: resource.name },
        ipAddress,
      },
    });

    return {
      message: 'Resource deleted successfully',
      id,
    };
  }
}

export const resourceService = new ResourceService();
