import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import {
  ConversationFilterQuery,
  HistoryFilterQuery,
  SendMessageInput,
} from './whatsapp.types.js';

export class WhatsAppRepository {
  // ==========================================
  // 1. CONVERSATIONS
  // ==========================================

  async findConversations(tenantId: string, filters: ConversationFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WhatsAppConversationWhereInput = {
      tenantId,
    };

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { recipientNumber: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { lastMessage: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.whatsAppConversation.count({ where }),
      prisma.whatsAppConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findConversationById(tenantId: string, id: string) {
    return prisma.whatsAppConversation.findFirst({
      where: { id, tenantId },
    });
  }

  async findMessagesByConversation(tenantId: string, conversationId: string) {
    return prisma.whatsAppMessage.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async saveMessage(
    tenantId: string,
    input: SendMessageInput & {
      direction?: 'OUTGOING' | 'INCOMING';
      status?: string;
      errorDetails?: string | null;
      resolvedMessage: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Atomic Upsert Conversation for this recipient
      const conversation = await tx.whatsAppConversation.upsert({
        where: {
          tenantId_recipientNumber: {
            tenantId,
            recipientNumber: input.recipientNumber,
          },
        },
        create: {
          tenantId,
          recipientNumber: input.recipientNumber,
          recipientName: input.recipientName || null,
          lastMessage: input.resolvedMessage,
          lastMessageAt: new Date(),
          unreadCount: input.direction === 'INCOMING' ? 1 : 0,
        },
        update: {
          lastMessage: input.resolvedMessage,
          lastMessageAt: new Date(),
          ...(input.recipientName && { recipientName: input.recipientName }),
          ...(input.direction === 'INCOMING' && { unreadCount: { increment: 1 } }),
        },
      });

      // 2. Create WhatsAppMessage
      const msg = await tx.whatsAppMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: input.direction || 'OUTGOING',
          recipientNumber: input.recipientNumber,
          recipientName: input.recipientName || conversation.recipientName,
          messageContent: input.resolvedMessage,
          templateName: input.templateName || null,
          status: input.status || 'SENT',
          errorDetails: input.errorDetails || null,
          sentAt: new Date(),
          deliveredAt: input.status === 'DELIVERED' || input.status === 'READ' ? new Date() : null,
        },
      });

      return {
        message: msg,
        conversation,
      };
    });
  }

  // ==========================================
  // 2. HISTORY
  // ==========================================

  async findHistory(tenantId: string, filters: HistoryFilterQuery) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WhatsAppMessageWhereInput = {
      tenantId,
    };

    if (filters.recipientNumber) {
      where.recipientNumber = { contains: filters.recipientNumber.trim(), mode: 'insensitive' };
    }

    if (filters.status && filters.status.toLowerCase() !== 'all') {
      where.status = { equals: filters.status.trim().toUpperCase() };
    }

    if (filters.templateName && filters.templateName.toLowerCase() !== 'all') {
      where.templateName = { equals: filters.templateName.trim() };
    }

    const fromDateStr = filters.fromDate;
    const toDateStr = filters.toDate;
    if (fromDateStr || toDateStr) {
      where.createdAt = {};
      if (fromDateStr) where.createdAt.gte = new Date(fromDateStr);
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        if (toDateStr.length === 10) toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { recipientNumber: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { messageContent: { contains: search, mode: 'insensitive' } },
        { templateName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.whatsAppMessage.count({ where }),
      prisma.whatsAppMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
