import { Request, Response, NextFunction } from 'express';
import { enquiriesService, EnquiriesService } from './enquiries.service.js';
import {
  createEnquirySchema,
  createFollowUpSchema,
  createReferralSchema,
  enquiryQuerySchema,
  referralQuerySchema,
  updateEnquirySchema,
  updateFollowUpSchema,
  updateReferralSchema,
} from './enquiries.dto.js';
import { BadRequestError } from '../../utils/app-error.js';

export class EnquiriesController {
  constructor(private service: EnquiriesService = enquiriesService) {}

  private getTenantId(req: Request): string {
    const tenantId = (
      req.effectiveTenantId ||
      req.tenantId ||
      req.user?.tenantId ||
      (req.user?.isSuperAdmin
        ? (req.headers['x-tenant-id'] || req.headers['x-impersonate-tenant-id'])
        : undefined)
    ) as string;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }
    return tenantId;
  }

  getEnquiries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = enquiryQuerySchema.parse({
        ...req.query,
        ...(req.query.from && { fromDate: req.query.from }),
        ...(req.query.to && { toDate: req.query.to }),
        ...(req.query.startDate && { fromDate: req.query.startDate }),
        ...(req.query.endDate && { toDate: req.query.endDate }),
      });
      const result = await this.service.getEnquiries(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'Enquiries retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getEnquiryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getEnquiryById(tenantId, id);
      if (!result) {
        res.status(404).json({ success: false, message: 'Enquiry not found' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Enquiry retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createEnquiry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = createEnquirySchema.parse(req.body);
      const result = await this.service.createEnquiry(tenantId, input, req.user?.id);
      res.status(201).json({
        success: true,
        message: 'Enquiry created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateEnquiry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateEnquirySchema.parse(req.body);
      const result = await this.service.updateEnquiry(tenantId, id, input, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Enquiry updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateFollowUpSchema.parse(req.body);
      if (!input.followUpDate) {
        throw new BadRequestError('Follow-up date is required');
      }
      const result = await this.service.updateFollowUp(tenantId, id, input.followUpDate, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Follow-up date updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = createFollowUpSchema.parse(req.body);
      const result = await this.service.createFollowUp(tenantId, id, input, req.user?.id);
      res.status(201).json({
        success: true,
        message: 'Follow-up added successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getFollowUps(tenantId, id);
      res.status(200).json({
        success: true,
        message: 'Follow-ups retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateFollowUpItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const followUpId = String(req.params.followUpId);
      const input = updateFollowUpSchema.parse(req.body);
      const result = await this.service.updateFollowUpItem(tenantId, followUpId, input);
      res.status(200).json({
        success: true,
        message: 'Follow-up record updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getEnquiryHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.getEnquiryHistory(tenantId, id);
      res.status(200).json({
        success: true,
        message: 'Enquiry audit history retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteEnquiry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteEnquiry(tenantId, id);
      res.status(200).json({
        success: true,
        message: 'Enquiry deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // -------------------------------------------------------------
  // Referrals & Referral Dashboard
  // -------------------------------------------------------------

  getReferralDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = referralQuerySchema.parse({
        ...req.query,
        ...(req.query.from && { fromDate: req.query.from }),
        ...(req.query.to && { toDate: req.query.to }),
        ...(req.query.startDate && { fromDate: req.query.startDate }),
        ...(req.query.endDate && { toDate: req.query.endDate }),
      });
      const result = await this.service.getReferralDashboard(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'Referral dashboard metrics retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getReferrals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = referralQuerySchema.parse({
        ...req.query,
        ...(req.query.from && { fromDate: req.query.from }),
        ...(req.query.to && { toDate: req.query.to }),
        ...(req.query.startDate && { fromDate: req.query.startDate }),
        ...(req.query.endDate && { toDate: req.query.endDate }),
      });
      const result = await this.service.getReferrals(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'Referrals retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = createReferralSchema.parse(req.body);
      const result = await this.service.createReferral(tenantId, input);
      res.status(201).json({
        success: true,
        message: 'Referral created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const input = updateReferralSchema.parse(req.body);
      const result = await this.service.updateReferral(tenantId, id, input);
      res.status(200).json({
        success: true,
        message: 'Referral updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = String(req.params.id);
      const result = await this.service.deleteReferral(tenantId, id);
      res.status(200).json({
        success: true,
        message: 'Referral deleted successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const enquiriesController = new EnquiriesController();
