import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/app-error.js';
import { prisma } from '../config/database.js';

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role.name !== 'SUPERADMIN' || req.user.impersonating) {
    return next(
      new ForbiddenError('Access forbidden: Platform SuperAdmin privilege required')
    );
  }

  next();
};

export const requireModule = (moduleName: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      // If SuperAdmin is in platform context (not impersonating a company), module restrictions do not apply
      if (req.user.role.name === 'SUPERADMIN' && !req.user.impersonating) {
        return next();
      }

      const tenantId = req.effectiveTenantId || req.tenantId;
      if (!tenantId) {
        return next(new ForbiddenError('Company context required for this operation'));
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { enabledModules: true, isActive: true },
      });

      if (!tenant) {
        return next(new ForbiddenError('Target company organization not found'));
      }

      const enabledModules = Array.isArray(tenant.enabledModules)
        ? (tenant.enabledModules as string[])
        : ['SERVICES', 'PRODUCTS', 'DISPOSABLES', 'STAFF', 'SETTINGS', 'RESOURCES', 'CRM', 'GUESTS', 'POS', 'APPOINTMENTS', 'REPORTS', 'INVENTORY'];

      // Tier 1: Company Module check (Plan features and submodules)
      const isCompanyAllowed = enabledModules.includes(moduleName) ||
        (moduleName === 'SERVICES' && (enabledModules.includes('SERVICES') || enabledModules.includes('Master BackOffice Catalog') || enabledModules.includes('Quick Sale POS') || enabledModules.includes('POS'))) ||
        (moduleName === 'PRODUCTS' && (enabledModules.includes('PRODUCTS') || enabledModules.includes('Master BackOffice Catalog') || enabledModules.includes('Salon Inventory & POs') || enabledModules.includes('INVENTORY') || enabledModules.includes('Quick Sale POS') || enabledModules.includes('POS'))) ||
        (moduleName === 'PACKAGES' && (enabledModules.includes('PACKAGES') || enabledModules.includes('Master BackOffice Catalog') || enabledModules.includes('Quick Sale POS') || enabledModules.includes('POS'))) ||
        (moduleName === 'DISPOSABLES' && (enabledModules.includes('DISPOSABLES') || enabledModules.includes('Salon Disposables & Wastage') || enabledModules.includes('Salon Inventory & POs') || enabledModules.includes('INVENTORY') || enabledModules.includes('Master BackOffice Catalog') || enabledModules.includes('SERVICES') || enabledModules.includes('POS'))) ||
        ((moduleName === 'CRM' || moduleName === 'GUESTS') && (enabledModules.includes('CRM') || enabledModules.includes('GUESTS') || enabledModules.includes('CRM & Client Management') || enabledModules.includes('POS'))) ||
        ((moduleName === 'POS' || moduleName === 'APPOINTMENTS') && (enabledModules.includes('POS') || enabledModules.includes('Quick Sale POS') || enabledModules.includes('APPOINTMENTS') || enabledModules.includes('Appointment Booking & Calendar Grid'))) ||
        (moduleName === 'REPORTS' && (enabledModules.includes('REPORTS') || enabledModules.includes('Reports & Business Analytics') || enabledModules.includes('POS') || enabledModules.includes('Quick Sale POS'))) ||
        (moduleName === 'TRENDS' && (enabledModules.includes('TRENDS') || enabledModules.includes('Revenue Trends & Insights') || enabledModules.includes('REPORTS') || enabledModules.includes('POS'))) ||
        (moduleName === 'INVENTORY' && (enabledModules.includes('INVENTORY') || enabledModules.includes('Salon Inventory & POs') || enabledModules.includes('PRODUCTS') || enabledModules.includes('DISPOSABLES'))) ||
        ((moduleName === 'CASH_MGMT' || moduleName === 'CASH_MANAGEMENT') && (enabledModules.includes('CASH_MGMT') || enabledModules.includes('CASH_MANAGEMENT') || enabledModules.includes('Cash Management & Counter Float') || enabledModules.includes('POS') || enabledModules.includes('REPORTS') || enabledModules.includes('SETTINGS'))) ||
        (moduleName === 'EXPENSES' && (enabledModules.includes('EXPENSES') || enabledModules.includes('Expenses Management') || enabledModules.includes('SETTINGS') || enabledModules.includes('POS') || enabledModules.includes('REPORTS') || enabledModules.includes('CASH_MGMT'))) ||
        (moduleName === 'ENQUIRIES' && (enabledModules.includes('ENQUIRIES') || enabledModules.includes('CRM') || enabledModules.includes('GUESTS') || enabledModules.includes('SETTINGS'))) ||
        ((moduleName === 'STAFF' || moduleName === 'STAFF_MANAGEMENT') && (enabledModules.includes('STAFF') || enabledModules.includes('Staff Payroll & Commissions') || enabledModules.includes('PAYROLL') || enabledModules.includes('Quick Sale POS') || enabledModules.includes('POS') || enabledModules.includes('Appointment Booking & Calendar Grid') || enabledModules.includes('APPOINTMENTS'))) ||
        (moduleName === 'PAYROLL' && (enabledModules.includes('PAYROLL') || enabledModules.includes('Staff Payroll & Commissions') || enabledModules.includes('STAFF') || enabledModules.includes('SETTINGS'))) ||
        (moduleName === 'WHATSAPP' && (enabledModules.includes('WHATSAPP') || enabledModules.includes('WhatsApp Invoicing & Alerts') || enabledModules.includes('CRM') || enabledModules.includes('SETTINGS')));

      if (!isCompanyAllowed) {
        return next(
          new ForbiddenError(`Module '${moduleName}' is not enabled for this company`)
        );
      }

      // Tier 2: Cashier Module check (if actor is a CASHIER)
      if (req.user.role.name === 'CASHIER') {
        const cashierModules = Array.isArray(req.user.enabledModules)
          ? req.user.enabledModules
          : [];

        const isCashierAllowed = cashierModules.includes(moduleName) ||
          (moduleName === 'SERVICES' && (cashierModules.includes('SERVICES') || cashierModules.includes('POS'))) ||
          (moduleName === 'PRODUCTS' && (cashierModules.includes('PRODUCTS') || cashierModules.includes('POS'))) ||
          (moduleName === 'PACKAGES' && (cashierModules.includes('PACKAGES') || cashierModules.includes('POS'))) ||
          (moduleName === 'DISPOSABLES' && (cashierModules.includes('DISPOSABLES') || cashierModules.includes('POS'))) ||
          ((moduleName === 'CRM' || moduleName === 'GUESTS') && (cashierModules.includes('CRM') || cashierModules.includes('GUESTS') || cashierModules.includes('POS'))) ||
          ((moduleName === 'POS' || moduleName === 'APPOINTMENTS') && (cashierModules.includes('POS') || cashierModules.includes('APPOINTMENTS'))) ||
          ((moduleName === 'STAFF' || moduleName === 'STAFF_MANAGEMENT') && (cashierModules.includes('STAFF') || cashierModules.includes('Staff Payroll & Commissions') || cashierModules.includes('POS') || cashierModules.includes('APPOINTMENTS') || req.method === 'GET')) ||
          (moduleName === 'REPORTS' && (cashierModules.includes('REPORTS') || cashierModules.includes('POS'))) ||
          (moduleName === 'TRENDS' && (cashierModules.includes('TRENDS') || cashierModules.includes('REPORTS') || cashierModules.includes('POS'))) ||
          (moduleName === 'INVENTORY' && (cashierModules.includes('INVENTORY') || cashierModules.includes('POS'))) ||
          ((moduleName === 'CASH_MGMT' || moduleName === 'CASH_MANAGEMENT') && (cashierModules.includes('CASH_MGMT') || cashierModules.includes('CASH_MANAGEMENT') || cashierModules.includes('POS'))) ||
          (moduleName === 'EXPENSES' && (cashierModules.includes('EXPENSES') || cashierModules.includes('POS') || cashierModules.includes('CASH_MGMT'))) ||
          (moduleName === 'ENQUIRIES' && (cashierModules.includes('ENQUIRIES') || cashierModules.includes('CRM') || cashierModules.includes('POS'))) ||
          (moduleName === 'PAYROLL' && (cashierModules.includes('PAYROLL') || cashierModules.includes('STAFF'))) ||
          (moduleName === 'WHATSAPP' && (cashierModules.includes('WHATSAPP') || cashierModules.includes('CRM')));

        if (!isCashierAllowed) {
          return next(
            new ForbiddenError(`Module '${moduleName}' is not assigned to this cashier`)
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = req.user.role.name;
    if (userRole === 'SUPERADMIN') {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Access forbidden: Role '${userRole}' does not have access to this resource`
        )
      );
    }

    next();
  };
};

export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SuperAdmin and Company Admin possess full operational permissions within company context
    if (req.user.role.name === 'SUPERADMIN' || req.user.role.name === 'ADMIN') {
      return next();
    }

    const userPermissions = req.user.role.permissions;
    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      return next(
        new ForbiddenError(
          `Access forbidden: Missing required permissions: [${requiredPermissions.join(', ')}]`
        )
      );
    }

    next();
  };
};

export const requireAnyPermission = (...permissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role.name === 'SUPERADMIN') {
      return next();
    }

    const userPermissions = req.user.role.permissions;
    const hasAny = permissions.some((perm) => userPermissions.includes(perm));

    if (!hasAny) {
      return next(
        new ForbiddenError(
          `Access forbidden: Requires at least one of [${permissions.join(', ')}]`
        )
      );
    }

    next();
  };
};
