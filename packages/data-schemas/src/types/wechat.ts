import type { Document } from 'mongoose';

export type WeChatBindingStatus = 'healthy' | 'reauth_required' | 'unbound';
export type WeChatBindingSource = 'new' | 'switch';

export interface ICurrentConversationBinding {
  conversationId: string;
  parentMessageId: string;
  selectedAt: Date;
  lastAdvancedAt?: Date | null;
  source: WeChatBindingSource;
}

export interface IWeChatBinding extends Document {
  userId: string;
  ilinkBotId?: string | null;
  botToken?: string | null;
  baseUrl?: string | null;
  ilinkUserId?: string;
  status: WeChatBindingStatus;
  boundAt?: Date | null;
  welcomeMessageSentAt?: Date | null;
  unhealthyAt?: Date | null;
  unboundAt?: Date | null;
  currentConversation?: ICurrentConversationBinding | null;
  createdAt?: Date;
  updatedAt?: Date;
}
