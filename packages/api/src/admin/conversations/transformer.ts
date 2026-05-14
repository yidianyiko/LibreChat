import { ContentTypes, feedbackTagKeySchema } from 'librechat-data-provider';
import type {
  AdminConvoDetail,
  AdminConvoListItem,
  AdminMessageItem,
  TMessageContentParts,
  TMinimalFeedback,
} from 'librechat-data-provider';

import { anonymizeUserId } from './anonymizer';

type StringIdValue = { toString(): string } | string;

type AdminConversationSource = {
  _id?: StringIdValue;
  id?: StringIdValue;
  conversationId: StringIdValue;
  user: StringIdValue;
  title?: string;
  endpoint?: string;
  model?: string;
  agent_id?: string;
  tags?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type AdminMessageSource = {
  _id?: StringIdValue;
  id?: StringIdValue;
  messageId: StringIdValue;
  conversationId: StringIdValue;
  parentMessageId?: StringIdValue;
  user: StringIdValue;
  text?: string;
  content?: unknown;
  sender?: string;
  isCreatedByUser?: boolean;
  model?: string;
  endpoint?: string;
  tokenCount?: number;
  summaryTokenCount?: number;
  finish_reason?: string;
  feedback?: unknown;
  error?: boolean;
  unfinished?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type FeedbackSource = {
  rating?: unknown;
  tag?: unknown;
  text?: unknown;
};

type FeedbackTagSource = {
  key?: unknown;
};

type UnknownDictionary = Record<string, unknown>;
type TextContentPart = Extract<TMessageContentParts, { type: ContentTypes.TEXT }>;
type ThinkContentPart = Extract<TMessageContentParts, { type: ContentTypes.THINK }>;
type ErrorContentPart = Extract<TMessageContentParts, { type: ContentTypes.ERROR }>;

const toStringId = (value: StringIdValue): string => value.toString();

const toIsoString = (value?: Date | string): string => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
};

const omitUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const isObject = (value: unknown): value is UnknownDictionary =>
  typeof value === 'object' && value !== null;

const getStringField = (source: UnknownDictionary, key: string): string | undefined => {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
};

const getFeedbackTag = (tag: unknown): string | undefined => {
  if (typeof tag === 'string') {
    return tag;
  }

  if (!isObject(tag)) {
    return undefined;
  }

  const { key } = tag as FeedbackTagSource;

  if (typeof key === 'string') {
    return key;
  }

  return undefined;
};

const normalizeFeedback = (feedback: unknown): TMinimalFeedback | undefined => {
  if (!isObject(feedback)) {
    return undefined;
  }

  const { rating, tag, text } = feedback as FeedbackSource;
  const normalizedTag = getFeedbackTag(tag);

  if (rating !== 'thumbsUp' && rating !== 'thumbsDown') {
    return undefined;
  }

  if (!normalizedTag) {
    return undefined;
  }

  const parsedTag = feedbackTagKeySchema.safeParse(normalizedTag);

  if (!parsedTag.success) {
    return undefined;
  }

  const normalizedRating: TMinimalFeedback['rating'] = rating;

  return omitUndefined({
    rating: normalizedRating,
    tag: parsedTag.data,
    text: typeof text === 'string' ? text : undefined,
  });
};

const normalizeTags = (tags: unknown): string[] | undefined => {
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const stringTags = tags.filter((tag): tag is string => typeof tag === 'string');

  if (stringTags.length === 0) {
    return undefined;
  }

  return stringTags;
};

const sanitizeContentPart = (part: unknown): TMessageContentParts | undefined => {
  if (!isObject(part)) {
    return undefined;
  }

  if (part.type === ContentTypes.TEXT) {
    const textPart: TextContentPart = omitUndefined({
      type: ContentTypes.TEXT,
      text: getStringField(part, 'text'),
    });
    return textPart;
  }

  if (part.type === ContentTypes.THINK) {
    const thinkPart: ThinkContentPart = omitUndefined({
      type: ContentTypes.THINK,
      think: getStringField(part, 'think'),
    });
    return thinkPart;
  }

  if (part.type === ContentTypes.ERROR) {
    const errorPart: ErrorContentPart = omitUndefined({
      type: ContentTypes.ERROR,
      text: getStringField(part, 'text'),
      error: getStringField(part, 'error'),
    });
    return errorPart;
  }

  return undefined;
};

const normalizeContent = (content: unknown): TMessageContentParts[] | undefined => {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const sanitized = content.reduce<TMessageContentParts[]>((parts, part) => {
    const sanitizedPart = sanitizeContentPart(part);

    if (sanitizedPart) {
      parts.push(sanitizedPart);
    }

    return parts;
  }, []);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return undefined;
};

export const toAdminConvoListItem = (
  conversation: AdminConversationSource,
  hashSalt: string,
  messageCount?: number,
): AdminConvoListItem =>
  omitUndefined({
    id: toStringId(conversation._id ?? conversation.id ?? conversation.conversationId),
    conversationId: toStringId(conversation.conversationId),
    anonUserId: anonymizeUserId(toStringId(conversation.user), hashSalt),
    title: conversation.title ?? '',
    endpoint: conversation.endpoint,
    model: conversation.model,
    agent_id: conversation.agent_id,
    tags: normalizeTags(conversation.tags),
    createdAt: toIsoString(conversation.createdAt),
    updatedAt: toIsoString(conversation.updatedAt),
    messageCount,
  });

export const toAdminMessageItem = (
  message: AdminMessageSource,
  hashSalt: string,
): AdminMessageItem =>
  omitUndefined({
    id: toStringId(message._id ?? message.id ?? message.messageId),
    messageId: toStringId(message.messageId),
    conversationId: toStringId(message.conversationId),
    parentMessageId: message.parentMessageId ? toStringId(message.parentMessageId) : undefined,
    anonUserId: anonymizeUserId(toStringId(message.user), hashSalt),
    text: message.text,
    content: normalizeContent(message.content),
    sender: message.sender,
    isCreatedByUser: message.isCreatedByUser === true,
    model: message.model,
    endpoint: message.endpoint,
    tokenCount: message.tokenCount,
    summaryTokenCount: message.summaryTokenCount,
    finish_reason: message.finish_reason,
    feedback: normalizeFeedback(message.feedback),
    error: message.error,
    unfinished: message.unfinished,
    createdAt: toIsoString(message.createdAt),
    updatedAt: toIsoString(message.updatedAt),
  });

export const toAdminConvoDetail = (
  conversation: AdminConversationSource,
  messages: AdminMessageSource[],
  hashSalt: string,
  messageCount: number,
  truncated: boolean,
): AdminConvoDetail => ({
  ...toAdminConvoListItem(conversation, hashSalt, messageCount),
  messages: messages.map((message) => toAdminMessageItem(message, hashSalt)),
  truncated,
});
