import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ServerRequest } from '~/types/http';

import { parseAdminConversationReviewConfig } from './config';
import { requireElevatedConvoAccess } from './elevatedAuth';
import { createAdminConvoLimiter } from './limiter';
import {
  AdminConversationInvalidRequestError,
  getAdminConversationDetail,
  listAdminConversationUsers,
  listAdminConversations,
  listAdminConversationsForUserAnchor,
  parseListParams,
} from './service';
import { handleLock, handleUnlock } from './unlock';

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

type AdminConversationUserAggregateRow = {
  user: StringIdValue;
  anchorConversationId: StringIdValue;
  conversationCount: number;
  latestUpdatedAt: Date | string;
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

type ConversationListFilter = {
  user?: StringIdValue;
  endpoint?: string | { $in: string[] };
  model?: string | { $in: string[] };
  agent_id?: string | { $in: string[] };
  updatedAt?: {
    $gte?: Date;
    $lte?: Date;
    $lt?: Date;
  };
  $or?: ({ updatedAt: { $lt: Date } } | { updatedAt: Date; _id: { $lt: string } })[];
};

type AdminConversationModels = {
  Conversation: {
    find(filter: ConversationListFilter): LeanQuery<AdminConversationSource[]>;
    findOne(filter: { conversationId: string }): LeanOnlyQuery<AdminConversationSource | null>;
    aggregate(pipeline: unknown[]): { exec(): Promise<AdminConversationUserAggregateRow[]> };
  };
  Message: {
    find(filter: { conversationId: string }): LeanQuery<AdminMessageSource[]>;
  };
};

type AdminConversationQueryValue = string | string[] | undefined;

const INVALID_REQUEST = { error: 'invalid_request' };
const NOT_FOUND = { error: 'not_found' };
const INTERNAL_ERROR = { error: 'internal_error' };

const normalizeQuery = (query: Request['query']): Record<string, AdminConversationQueryValue> =>
  Object.entries(query).reduce<Record<string, AdminConversationQueryValue>>(
    (params, [key, value]) => {
      if (typeof value === 'string' || value === undefined) {
        return {
          ...params,
          [key]: value,
        };
      }

      if (
        Array.isArray(value) &&
        value.every((entry): entry is string => typeof entry === 'string')
      ) {
        return {
          ...params,
          [key]: value,
        };
      }

      throw new AdminConversationInvalidRequestError(`Invalid ${key}`);
    },
    {},
  );

const sendError = (res: Response, error: unknown) => {
  if (error instanceof AdminConversationInvalidRequestError) {
    return res.status(400).json(INVALID_REQUEST);
  }

  return res.status(500).json(INTERNAL_ERROR);
};

const asRequestHandler =
  (
    handler: (
      req: ServerRequest,
      res: Response,
      next: NextFunction,
    ) => Promise<Response | void> | Response | void,
  ): RequestHandler =>
  (req, res, next) => {
    void handler(req as ServerRequest, res, next);
  };

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<Response | void>): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (res.headersSent) {
        return next(error);
      }

      sendError(res, error);
    }
  };

export const createAdminConversationsRouter = (models: AdminConversationModels) => {
  const router = express.Router();
  const config = parseAdminConversationReviewConfig();
  const requireUnlocked = requireElevatedConvoAccess(config);

  router.use(createAdminConvoLimiter());
  router.post(
    '/unlock',
    asyncRoute((req, res) => handleUnlock(config)(req as ServerRequest, res)),
  );
  router.post('/lock', asRequestHandler(handleLock(config)));
  router.get(
    '/users',
    asRequestHandler(requireUnlocked),
    asyncRoute(async (_req, res) => {
      const result = await listAdminConversationUsers(models, config.hashSalt);

      return res.status(200).json(result);
    }),
  );
  router.get(
    '/users/:anchorConversationId/conversations',
    asRequestHandler(requireUnlocked),
    asyncRoute(async (req, res) => {
      const result = await listAdminConversationsForUserAnchor(
        models,
        req.params.anchorConversationId,
        config.hashSalt,
      );

      if (!result) {
        return res.status(404).json(NOT_FOUND);
      }

      return res.status(200).json(result);
    }),
  );
  router.get(
    '/',
    asRequestHandler(requireUnlocked),
    asyncRoute(async (req, res) => {
      const result = await listAdminConversations(
        models,
        parseListParams(normalizeQuery(req.query)),
        config.hashSalt,
      );

      return res.status(200).json(result);
    }),
  );
  router.get(
    '/:conversationId',
    asRequestHandler(requireUnlocked),
    asyncRoute(async (req, res) => {
      const result = await getAdminConversationDetail(
        models,
        req.params.conversationId,
        config.hashSalt,
      );

      if (!result) {
        return res.status(404).json(NOT_FOUND);
      }

      return res.status(200).json(result);
    }),
  );

  return router;
};

export * from './anonymizer';
export * from './config';
export * from './elevatedAuth';
export * from './limiter';
export * from './service';
export * from './transformer';
export * from './unlock';
