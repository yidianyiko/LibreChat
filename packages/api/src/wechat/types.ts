import type {
  ICurrentConversationBinding,
  WeChatBindingStatus,
  WeChatBindingSource,
} from '@librechat/data-schemas';

export interface WeChatConversation {
  conversationId: string;
  title?: string | null;
  user?: string;
  endpoint?: string | null;
  endpointType?: string | null;
  model?: string | null;
  isArchived?: boolean | null;
  expiredAt?: Date | null;
  updatedAt?: Date | null;
}

export interface WeChatConversationMessage {
  messageId: string;
  parentMessageId?: string | null;
  createdAt?: Date | null;
  isCreatedByUser?: boolean;
}

export interface WeChatPreset {
  presetId?: string | null;
  endpoint?: string | null;
  endpointType?: string | null;
  model?: string | null;
  title?: string | null;
  promptPrefix?: string | null;
  system?: string | null;
}

export interface WeChatFallbackPreset extends WeChatPreset {
  endpoint: 'openAI';
  model: 'gpt-4o';
}

export interface WeChatListSnapshot {
  snapshotId: string;
  conversationIds: string[];
  createdAt: Date;
  expiresAt?: Date | null;
}

export interface WeChatBindingRecord {
  userId: string;
  ilinkUserId?: string;
  status: WeChatBindingStatus;
  welcomeMessageSentAt?: Date | null;
  currentConversation?: ICurrentConversationBinding | null;
}

export interface WeChatBindingUpdate {
  ilinkBotId?: string | null;
  botToken?: string | null;
  baseUrl?: string | null;
  ilinkUserId?: string;
  status?: WeChatBindingStatus;
  boundAt?: Date | null;
  welcomeMessageSentAt?: Date | null;
  unhealthyAt?: Date | null;
  unboundAt?: Date | null;
  currentConversation?: ICurrentConversationBinding | null;
}

export interface CreateWeChatConversationParams<TPreset extends WeChatPreset = WeChatPreset> {
  userId: string;
  conversationId: string;
  preset: TPreset;
}

export interface ResolveWeChatPresetParams<
  TPreset extends WeChatPreset,
  TFallbackPreset extends WeChatFallbackPreset,
> {
  getUserDefaultPreset: () => Promise<TPreset | null>;
  fallbackPreset: TFallbackPreset;
}

export interface SwitchWeChatConversationParams {
  snapshotId: string;
  index: number;
}

export interface WeChatCurrentConversation {
  conversation: WeChatConversation;
  conversationId: string;
  parentMessageId: string;
  source: WeChatBindingSource;
  selectedAt: Date;
  lastAdvancedAt?: Date | null;
}

export interface WeChatServiceDependencies<TPreset extends WeChatPreset = WeChatFallbackPreset> {
  findBindingByUserId: (userId: string) => Promise<WeChatBindingRecord | null>;
  listUserConversations: (userId: string) => Promise<WeChatConversation[]>;
  getConversation: (userId: string, conversationId: string) => Promise<WeChatConversation | null>;
  listConversationMessages: (
    userId: string,
    conversationId: string,
  ) => Promise<WeChatConversationMessage[]>;
  getUserDefaultPreset: (userId: string) => Promise<TPreset | null>;
  getFallbackPreset: () => TPreset;
  createConversation: (
    params: CreateWeChatConversationParams<TPreset>,
  ) => Promise<WeChatConversation>;
  upsertBinding: (
    userId: string,
    update: WeChatBindingUpdate,
  ) => Promise<WeChatBindingRecord | null>;
  storeSnapshot: (userId: string, snapshot: WeChatListSnapshot) => Promise<void>;
  getSnapshot: (userId: string) => Promise<WeChatListSnapshot | null>;
}
