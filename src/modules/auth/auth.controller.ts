import { Request, Response, NextFunction } from 'express';
import { authService, AuthService } from './auth.service.js';
import { sendResponse } from '../../utils/api-response.js';
import { prisma } from '../../config/database.js';

export class AuthController {
  constructor(private service: AuthService = authService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body);
      sendResponse(res, 200, true, 'Authentication successful', result);
    } catch (error) {
      next(error);
    }
  };

  getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }
      const profile = await this.service.getProfile(req.user.id);
      sendResponse(res, 200, true, 'User profile retrieved successfully', {
        ...profile,
        tenantId: req.user.tenantId,
        effectiveTenantId: req.user.effectiveTenantId ?? req.user.tenantId ?? null,
        impersonating: req.user.impersonating || false,
        targetTenantId: req.user.targetTenantId,
        originalActorId: req.user.originalActorId,
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.forgotPassword(req.body, req.ip);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const password = req.body.password || req.body.newPassword;
      const result = await this.service.resetPassword(req.body.token, password, req.ip);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }
      const result = await this.service.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, req.ip);
      sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  };

  requestCashierPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }
      const result = await this.service.requestCashierPasswordReset(req.user.id);
      sendResponse(res, 200, true, result.message);
    } catch (error) {
      next(error);
    }
  };

  getTenantPublicProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req.params.id || req.query.id || req.headers['x-tenant-id']) as string;
      const tenant = await prisma.tenant.findFirst({
        where: tenantId
          ? {
              OR: [
                { id: tenantId },
                { name: { equals: tenantId, mode: 'insensitive' } },
                { code: { equals: tenantId, mode: 'insensitive' } },
              ],
            }
          : { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          logoUrl: true,
          city: true,
          primaryBranchName: true,
          address: true,
          contactEmail: true,
          contactPhone: true,
          isActive: true,
        },
      });

      if (!tenant) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }

      sendResponse(res, 200, true, 'Company profile retrieved successfully', tenant);
    } catch (error) {
      next(error);
    }
  };

  testProtected = async (req: Request, res: Response): Promise<void> => {
    sendResponse(res, 200, true, 'Protected resource accessed successfully', {
      user: req.user,
      timestamp: new Date().toISOString(),
    });
  };
}

export const authController = new AuthController();
