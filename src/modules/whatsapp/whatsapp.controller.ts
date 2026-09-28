import { Request, Response, NextFunction } from 'express';
import { whatsappService, WhatsAppService } from './whatsapp.service.js';
import {
  conversationQuerySchema,
  historyQuerySchema,
  sendMessageSchema,
} from './whatsapp.dto.js';
import { BadRequestError } from '../../utils/app-error.js';

export class WhatsAppController {
  constructor(private service: WhatsAppService = whatsappService) {}

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

  getConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = conversationQuerySchema.parse(req.query);
      const result = await this.service.getConversations(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'WhatsApp conversations retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const conversationId = String(req.params.id);
      const messages = await this.service.getMessagesByConversation(tenantId, conversationId);
      res.status(200).json({
        success: true,
        message: 'Conversation messages retrieved successfully',
        data: messages,
      });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const input = sendMessageSchema.parse(req.body);
      const result = await this.service.sendMessage(tenantId, input);
      res.status(201).json({
        success: true,
        message: result.message.status === 'FAILED' ? 'Message sending failed: Undeliverable' : 'Message sent successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const query = historyQuerySchema.parse({
        ...req.query,
        ...(req.query.startDate && { fromDate: req.query.startDate }),
        ...(req.query.endDate && { toDate: req.query.endDate }),
      });
      const result = await this.service.getHistory(tenantId, query);
      res.status(200).json({
        success: true,
        message: 'WhatsApp message history retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const whatsappController = new WhatsAppController();
