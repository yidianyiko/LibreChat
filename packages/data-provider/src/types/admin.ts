import type { TMessageContentParts } from './assistants';
import type { TMinimalFeedback } from '../feedback';

export const adminConvoListItemKeys = [
  'id',
  'conversationId',
  'anonUserId',
  'title',
  'endpoint',
  'model',
  'agent_id',
  'tags',
  'createdAt',
  'updatedAt',
  'messageCount',
] as const;

export const adminMessageItemKeys = [
  'id',
  'messageId',
  'conversationId',
  'parentMessageId',
  'anonUserId',
  'text',
  'content',
  'sender',
  'isCreatedByUser',
  'model',
  'endpoint',
  'tokenCount',
  'summaryTokenCount',
  'finish_reason',
  'feedback',
  'error',
  'unfinished',
  'createdAt',
  'updatedAt',
] as const;

export const adminConvoDetailKeys = [...adminConvoListItemKeys, 'messages', 'truncated'] as const;

export const adminConvoUserListItemKeys = [
  'anonUserId',
  'anchorConversationId',
  'conversationCount',
  'latestUpdatedAt',
] as const;

export type AdminConvoUserListItem = {
  anonUserId: string;
  anchorConversationId: string;
  conversationCount: number;
  latestUpdatedAt: string;
};

export type AdminConvoUserListResponse = {
  items: AdminConvoUserListItem[];
};

export type AdminConvoListItem = {
  id: string;
  conversationId: string;
  anonUserId: string;
  title: string;
  endpoint?: string;
  model?: string;
  agent_id?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type AdminMessageItem = {
  id: string;
  messageId: string;
  conversationId: string;
  parentMessageId?: string;
  anonUserId: string;
  text?: string;
  content?: TMessageContentParts[];
  sender?: string;
  isCreatedByUser: boolean;
  model?: string;
  endpoint?: string;
  tokenCount?: number;
  summaryTokenCount?: number;
  finish_reason?: string;
  feedback?: TMinimalFeedback;
  error?: boolean;
  unfinished?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminConvoDetail = AdminConvoListItem & {
  messages: AdminMessageItem[];
  truncated: boolean;
};

export type AdminConvoListResponse = {
  items: AdminConvoListItem[];
  nextCursor: string | null;
};
