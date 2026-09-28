export interface SendMessageInput {
  recipientNumber: string;
  recipientName?: string | null;
  messageContent?: string;
  templateName?: string | null;
  templateVariables?: Record<string, any>;
  templateParams?: Record<string, any>;
  conversationId?: string | null;
  status?: string;
  errorDetails?: string | null;
}

export interface HistoryFilterQuery {
  page?: number;
  limit?: number;
  recipientNumber?: string;
  search?: string;
  status?: string;
  templateName?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ConversationFilterQuery {
  page?: number;
  limit?: number;
  search?: string;
}
