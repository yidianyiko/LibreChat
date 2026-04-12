export type TWeChatBindingStatus = 'unbound' | 'healthy' | 'reauth_required';

export type TWeChatCurrentConversation = {
  conversationId: string;
  parentMessageId: string;
};

export type TWeChatStatusResponse = {
  status: TWeChatBindingStatus;
  hasBinding: boolean;
  ilinkUserId?: string;
  currentConversation?: TWeChatCurrentConversation | null;
};

export type TWeChatBindStartResponse = {
  bindSessionId: string;
  qrCodeDataUrl: string;
  expiresAt: string;
};

export type TWeChatBindSessionStatus =
  | 'pending'
  | 'healthy'
  | 'expired'
  | 'cancelled'
  | 'reauth_required';

export type TWeChatBindStatusResponse = {
  status: TWeChatBindSessionStatus;
  bindSessionId: string;
  qrCodeDataUrl?: string;
  expiresAt?: string;
};
