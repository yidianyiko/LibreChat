import type {
  AdminConvoDetail,
  AdminConvoListItem,
  AdminConvoUserListItem,
} from 'librechat-data-provider';

import { anonymizeUserId } from './anonymizer';
import { toAdminConvoDetail, toAdminConvoListItem } from './transformer';

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

type QueryValue = string | string[] | undefined;

type CursorPayload = {
  updatedAt: string;
  id: string;
};

type DateRangeFilter = {
  $gte?: Date;
  $lte?: Date;
  $lt?: Date;
};

type StringFilter = string | { $in: string[] };

type CursorClause = { updatedAt: { $lt: Date } } | { updatedAt: Date; _id: { $lt: string } };

type ConversationListFilter = {
  user?: StringIdValue;
  endpoint?: StringFilter;
  model?: StringFilter;
  agent_id?: StringFilter;
  updatedAt?: DateRangeFilter;
  $or?: CursorClause[];
};

type SortSpec = {
  updatedAt?: -1;
  createdAt?: -1;
  _id: -1;
};

type LeanQuery<T> = {
  sort(sort: SortSpec): LeanQuery<T>;
  limit(limit: number): LeanQuery<T>;
  lean(): Promise<T>;
};

type LeanOnlyQuery<T> = {
  lean(): Promise<T>;
};

type AggregateQuery<T> = {
  exec(): Promise<T>;
};

type ConversationListModel = {
  find(filter: ConversationListFilter): LeanQuery<AdminConversationSource[]>;
};

type ConversationDetailModel = {
  findOne(filter: { conversationId: string }): LeanOnlyQuery<AdminConversationSource | null>;
};

type AdminConversationUserAggregateRow = {
  user: StringIdValue;
  anchorConversationId: StringIdValue;
  conversationCount: number;
  latestUpdatedAt: Date | string;
};

type ConversationUserModel = {
  aggregate(pipeline: unknown[]): AggregateQuery<AdminConversationUserAggregateRow[]>;
};

type MessageModel = {
  find(filter: { conversationId: string }): LeanQuery<AdminMessageSource[]>;
};

type ListModels = {
  Conversation: ConversationListModel;
};

type DetailModels = {
  Conversation: ConversationDetailModel;
  Message: MessageModel;
};

type UserListModels = {
  Conversation: ConversationUserModel;
};

type UserConversationModels = {
  Conversation: ConversationListModel & ConversationDetailModel;
};

export type AdminConversationListParams = {
  cursor?: CursorPayload;
  limit: number;
  endpoint?: string[];
  model?: string[];
  agentId?: string[];
  from?: Date;
  to?: Date;
};

export type AdminConversationListResult = {
  items: AdminConvoListItem[];
  nextCursor: string | null;
};

export type AdminConversationUserListResult = {
  items: AdminConvoUserListItem[];
};

const SUPPORTED_LIST_PARAMS = new Set([
  'cursor',
  'limit',
  'endpoint',
  'model',
  'agentId',
  'from',
  'to',
]);
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const DETAIL_MESSAGE_LIMIT = 1001;
const DETAIL_RENDER_LIMIT = 1000;
const ADMIN_USER_LIST_LIMIT = 200;
const ADMIN_USER_CONVERSATION_LIMIT = 200;

export class AdminConversationInvalidRequestError extends Error {
  code = 'invalid_request' as const;

  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AdminConversationInvalidRequestError';
  }
}

const invalidRequest = (message: string): AdminConversationInvalidRequestError =>
  new AdminConversationInvalidRequestError(message);

const firstValue = (value: QueryValue): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const arrayValue = (value: QueryValue): string[] | undefined => {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }

  return undefined;
};

const parseDate = (value: string, paramName: string): Date => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw invalidRequest(`Invalid ${paramName}`);
  }

  return date;
};

const toIsoDate = (value: Date | string | undefined): string => {
  if (!value) {
    throw invalidRequest('Cursor source is missing updatedAt');
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toStringId = (value: StringIdValue | undefined): string => {
  if (!value) {
    throw invalidRequest('Cursor source is missing id');
  }

  return value.toString();
};

const isCursorPayload = (value: unknown): value is CursorPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { updatedAt?: unknown; id?: unknown };

  return typeof candidate.updatedAt === 'string' && typeof candidate.id === 'string';
};

const encodeCursor = (cursor: CursorPayload): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');

const decodeCursor = (cursor: string): CursorPayload => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as unknown;

    if (!isCursorPayload(decoded)) {
      throw invalidRequest('Invalid cursor');
    }

    parseDate(decoded.updatedAt, 'cursor.updatedAt');

    return decoded;
  } catch (error) {
    if (error instanceof AdminConversationInvalidRequestError) {
      throw error;
    }

    throw invalidRequest('Invalid cursor');
  }
};

export const parseListParams = (query: Record<string, QueryValue>): AdminConversationListParams => {
  const unsupportedParam = Object.keys(query).find((key) => !SUPPORTED_LIST_PARAMS.has(key));

  if (unsupportedParam) {
    throw invalidRequest(`Unsupported query parameter: ${unsupportedParam}`);
  }

  const rawLimit = firstValue(query.limit);
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    throw invalidRequest('Invalid limit');
  }

  const rawCursor = firstValue(query.cursor);
  const rawFrom = firstValue(query.from);
  const rawTo = firstValue(query.to);

  return {
    limit: Math.min(parsedLimit, MAX_LIMIT),
    cursor: rawCursor ? decodeCursor(rawCursor) : undefined,
    endpoint: arrayValue(query.endpoint),
    model: arrayValue(query.model),
    agentId: arrayValue(query.agentId),
    from: rawFrom ? parseDate(rawFrom, 'from') : undefined,
    to: rawTo ? parseDate(rawTo, 'to') : undefined,
  };
};

const addStringFilter = (
  filter: ConversationListFilter,
  key: 'endpoint' | 'model' | 'agent_id',
  values: string[] | undefined,
): ConversationListFilter => {
  if (!values || values.length === 0) {
    return filter;
  }

  return {
    ...filter,
    [key]: values.length === 1 ? values[0] : { $in: values },
  };
};

const buildListQuery = (params: AdminConversationListParams): ConversationListFilter => {
  const dateFilter = {
    ...(params.from ? { $gte: params.from } : {}),
    ...(params.to ? { $lte: params.to } : {}),
  };

  const filter = addStringFilter(
    addStringFilter(addStringFilter({}, 'endpoint', params.endpoint), 'model', params.model),
    'agent_id',
    params.agentId,
  );

  const cursorDate = params.cursor ? new Date(params.cursor.updatedAt) : undefined;

  return {
    ...filter,
    ...(Object.keys(dateFilter).length > 0 ? { updatedAt: dateFilter } : {}),
    ...(params.cursor && cursorDate
      ? {
          $or: [
            { updatedAt: { $lt: cursorDate } },
            { updatedAt: cursorDate, _id: { $lt: params.cursor.id } },
          ],
        }
      : {}),
  };
};

const normalizeListLimit = (limit: number): number => {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

export const listAdminConversations = async (
  models: ListModels,
  params: AdminConversationListParams,
  hashSalt: string,
): Promise<AdminConversationListResult> => {
  const effectiveLimit = normalizeListLimit(params.limit);
  const rows = await models.Conversation.find(buildListQuery(params))
    .sort({ updatedAt: -1, _id: -1 })
    .limit(effectiveLimit + 1)
    .lean();
  const pageRows = rows.slice(0, effectiveLimit);
  const nextCursor =
    rows.length > effectiveLimit
      ? encodeCursor({
          updatedAt: toIsoDate(pageRows[pageRows.length - 1]?.updatedAt),
          id: toStringId(pageRows[pageRows.length - 1]?._id ?? pageRows[pageRows.length - 1]?.id),
        })
      : null;

  return {
    items: pageRows.map((conversation) => toAdminConvoListItem(conversation, hashSalt)),
    nextCursor,
  };
};

const toAdminConvoUserListItem = (
  row: AdminConversationUserAggregateRow,
  hashSalt: string,
): AdminConvoUserListItem => ({
  anonUserId: anonymizeUserId(toStringId(row.user), hashSalt),
  anchorConversationId: toStringId(row.anchorConversationId),
  conversationCount: row.conversationCount,
  latestUpdatedAt: toIsoDate(row.latestUpdatedAt),
});

export const listAdminConversationUsers = async (
  models: UserListModels,
  hashSalt: string,
): Promise<AdminConversationUserListResult> => {
  const rows = await models.Conversation.aggregate([
    { $sort: { updatedAt: -1, _id: -1 } },
    {
      $group: {
        _id: '$user',
        anchorConversationId: { $first: '$conversationId' },
        conversationCount: { $sum: 1 },
        latestUpdatedAt: { $first: '$updatedAt' },
      },
    },
    { $sort: { latestUpdatedAt: -1, _id: 1 } },
    { $limit: ADMIN_USER_LIST_LIMIT },
    {
      $project: {
        _id: 0,
        user: '$_id',
        anchorConversationId: 1,
        conversationCount: 1,
        latestUpdatedAt: 1,
      },
    },
  ]).exec();

  return {
    items: rows.map((row) => toAdminConvoUserListItem(row, hashSalt)),
  };
};

export const listAdminConversationsForUserAnchor = async (
  models: UserConversationModels,
  anchorConversationId: string,
  hashSalt: string,
): Promise<AdminConversationListResult | null> => {
  const anchor = await models.Conversation.findOne({ conversationId: anchorConversationId }).lean();

  if (!anchor) {
    return null;
  }

  const rows = await models.Conversation.find({ user: anchor.user })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(ADMIN_USER_CONVERSATION_LIMIT)
    .lean();

  return {
    items: rows.map((conversation) => toAdminConvoListItem(conversation, hashSalt)),
    nextCursor: null,
  };
};

export const getAdminConversationDetail = async (
  models: DetailModels,
  conversationId: string,
  hashSalt: string,
): Promise<AdminConvoDetail | null> => {
  const conversation = await models.Conversation.findOne({ conversationId }).lean();

  if (!conversation) {
    return null;
  }

  const rows = await models.Message.find({ conversationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(DETAIL_MESSAGE_LIMIT)
    .lean();
  const truncated = rows.length > DETAIL_RENDER_LIMIT;
  const renderMessages = rows.slice(0, DETAIL_RENDER_LIMIT).reverse();

  return toAdminConvoDetail(
    conversation,
    renderMessages,
    hashSalt,
    renderMessages.length,
    truncated,
  );
};
