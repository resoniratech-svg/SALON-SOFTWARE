import { WhatsAppRepository } from './whatsapp.repository.js';
import {
  ConversationFilterQuery,
  HistoryFilterQuery,
  SendMessageInput,
} from './whatsapp.types.js';

export class WhatsAppService {
  constructor(private repository: WhatsAppRepository = new WhatsAppRepository()) {}

  async getConversations(tenantId: string, filters: ConversationFilterQuery) {
    return this.repository.findConversations(tenantId, filters);
  }

  async getMessagesByConversation(tenantId: string, conversationId: string) {
    return this.repository.findMessagesByConversation(tenantId, conversationId);
  }

  async getHistory(tenantId: string, filters: HistoryFilterQuery) {
    return this.repository.findHistory(tenantId, filters);
  }

  async sendMessage(tenantId: string, input: SendMessageInput) {
    let resolvedMessage = input.messageContent || '';

    // If template specified, compile template string
    if (input.templateName) {
      const vars = input.templateVariables || (input as any).templateParams || {};
      resolvedMessage = this.compileTemplate(input.templateName, vars);
    }

    // Determine status (Simulate real provider validation: invalid format or test failure numbers fail)
    let status = input.status || 'SENT';
    let errorDetails: string | null = input.errorDetails || null;

    if (input.recipientNumber.startsWith('+00') || input.recipientNumber.includes('0000000') || input.recipientNumber === '9999999999') {
      status = input.status || 'UNDELIVERABLE';
      errorDetails = input.errorDetails || 'Message Undeliverable.';
    }

    return this.repository.saveMessage(tenantId, {
      ...input,
      resolvedMessage,
      status,
      errorDetails,
    });
  }

  compileTemplate(templateName: string, variables: Record<string, any>): string {
    switch (templateName) {
      case 'referral_reward_percentage':
        return `Hello! Your referral code is ${variables.code || variables.referral_code || 'SLKAqh'}. Share it with friends and family to earn ${variables.percentage || variables.discount_percentage || '10.00'} % of reward on their first visit!`;
      case 'salon_transaction_invoice_1':
        return `Dear ${variables.name || 'Valued Guest'}, thank you for visiting ${variables.salonName || variables.companyName || 'our salon'}! Your invoice ${variables.invoiceNumber || 'INV-2026-001'} for ₹${variables.amount || '0.00'} has been generated.`;
      case 'salon_service_feedback_1':
        return `Hi ${variables.name || 'Guest'}, thank you for choosing ${variables.salonName || variables.companyName || 'our salon'}! We would love your feedback on your service experience today.`;
      default:
        return variables.text || `Template message: ${templateName}`;
    }
  }
}

export const whatsappService = new WhatsAppService();
