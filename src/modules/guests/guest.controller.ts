import { Request, Response, NextFunction } from 'express';
import { guestService, GuestService } from './guest.service.js';
import { sendResponse } from '../../utils/api-response.js';
import { BadRequestError } from '../../utils/app-error.js';

export class GuestController {
  constructor(private service: GuestService = guestService) {}

  private getTenantId(req: Request): string {
    const tenantId = (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-impersonate-tenant-id'] as string) ||
      (req.query?.tenantId as string) ||
      ((req as any).validatedQuery?.tenantId as string) ||
      req.body?.tenantId
    ) as string;
    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }
    return tenantId;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.create(tenantId, req.body, req.user!, req.ip);
      sendResponse(res, 201, true, 'Guest created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.list(tenantId, query);
      sendResponse(res, 200, true, 'Guests retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getById(tenantId, id);
      sendResponse(res, 200, true, 'Guest retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getByMobile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const mobile = String(req.params.mobile);
      const result = await this.service.getByMobile(tenantId, mobile);
      sendResponse(res, 200, true, 'Guest retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.update(tenantId, id, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Guest updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.updateStatus(tenantId, id, req.body, req.user!, req.ip);
      sendResponse(res, 200, true, 'Guest status updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const bodyIds = req.body?.ids || req.body?.guestIds;
      if (Array.isArray(bodyIds) && bodyIds.length > 0) {
        const result = await this.service.bulkDelete(tenantId, bodyIds, req.user!, req.ip);
        sendResponse(res, 200, true, result.message, result);
        return;
      }
      const id = String(req.params.id);
      const result = await this.service.delete(tenantId, id, req.user!, req.ip);
      sendResponse(res, 200, true, result.message, null);
    } catch (error) {
      next(error);
    }
  };

  bulkDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const ids = req.body?.ids || req.body?.guestIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('Array of guest IDs is required');
      }
      const result = await this.service.bulkDelete(tenantId, ids, req.user!, req.ip);
      sendResponse(res, 200, true, result.message, result);
    } catch (error) {
      next(error);
    }
  };

  exportCrm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const csv = await this.service.exportCrmGuestsCsv(tenantId, query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="crm_guests_export_${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };

  getReferrals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getReferrals(tenantId, id);
      sendResponse(res, 200, true, 'Guest referrals retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // CRM 360 HANDLERS
  // ==========================================
  crmList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = (req as any).validatedQuery || req.query;
      const result = await this.service.getCrmGuestList(tenantId, query);
      sendResponse(res, 200, true, 'CRM guests retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  get360 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getGuest360(tenantId, id);
      sendResponse(res, 200, true, 'Guest 360 profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  addMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.addGuestMembership(tenantId, id, req.body, req.user);
      sendResponse(res, 201, true, 'Guest membership added successfully', result);
    } catch (error) {
      next(error);
    }
  };

  addPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.addGuestPackage(tenantId, id, req.body, req.user);
      sendResponse(res, 201, true, 'Guest package added successfully', result);
    } catch (error) {
      next(error);
    }
  };

  redeemPackageSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const packageId = String(req.params.packageId);
      const sessions = req.body.sessions ? Number(req.body.sessions) : 1;
      const result = await this.service.redeemPackageSession(tenantId, id, packageId, sessions);
      sendResponse(res, 200, true, 'Package session redeemed successfully', result);
    } catch (error) {
      next(error);
    }
  };

  recordWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const staffId = req.user?.id;
      const result = await this.service.recordWalletTransaction(tenantId, id, req.body, staffId);
      sendResponse(res, 201, true, 'Wallet transaction recorded successfully', result);
    } catch (error) {
      next(error);
    }
  };

  createFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.createFollowUp(tenantId, id, req.body);
      sendResponse(res, 201, true, 'Follow-up created successfully', result);
    } catch (error) {
      next(error);
    }
  };

  updateFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const followUpId = String(req.params.followUpId);
      const status = req.body.status || 'COMPLETED';
      const result = await this.service.updateFollowUp(tenantId, followUpId, status, req.body.notes);
      sendResponse(res, 200, true, 'Follow-up updated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  addNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const staffId = req.user?.id;
      const result = await this.service.addGuestNote(tenantId, id, req.body, staffId);
      sendResponse(res, 201, true, 'Guest note added successfully', result);
    } catch (error) {
      next(error);
    }
  };

  deleteNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const noteId = String(req.params.noteId);
      await this.service.deleteGuestNote(tenantId, noteId);
      sendResponse(res, 200, true, 'Guest note deleted successfully', null);
    } catch (error) {
      next(error);
    }
  };

  addFamilyMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.addFamilyMember(tenantId, id, req.body);
      sendResponse(res, 201, true, 'Family member added successfully', result);
    } catch (error) {
      next(error);
    }
  };

  deleteFamilyMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const memberId = String(req.params.memberId);
      await this.service.deleteFamilyMember(tenantId, memberId);
      sendResponse(res, 200, true, 'Family member deleted successfully', null);
    } catch (error) {
      next(error);
    }
  };

  submitForm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const staffId = req.user?.id;
      const result = await this.service.submitGuestForm(tenantId, id, req.body, staffId);
      sendResponse(res, 201, true, 'Form submitted successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const guestController = new GuestController();

