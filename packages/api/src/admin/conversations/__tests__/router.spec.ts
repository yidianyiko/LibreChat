import express from 'express';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type { Server } from 'http';

import { createAdminConversationsRouter } from '../index';

const hashSalt = '12345678901234567890123456789012';
const sessionSecret = 'abcdefghijklmnopqrstuvwxyz123456';

type QueryResult<T> = {
  sort: jest.Mock<QueryResult<T>, [unknown]>;
  limit: jest.Mock<QueryResult<T>, [number]>;
  lean: jest.Mock<Promise<T>, []>;
};

type LeanOnlyResult<T> = {
  lean: jest.Mock<Promise<T>, []>;
};

type ConversationModelStub = {
  find: jest.Mock<QueryResult<ReturnType<typeof makeConversation>[]>, [unknown]>;
  findOne: jest.Mock<LeanOnlyResult<ReturnType<typeof makeConversation> | null>, [unknown]>;
  aggregate: jest.Mock<AggregateResult<AdminUserAggregateRow[]>, [unknown[]]>;
};

type MessageModelStub = {
  find: jest.Mock<QueryResult<ReturnType<typeof makeMessage>[]>, [unknown]>;
};

type TestRequest = Parameters<RequestHandler>[0] & {
  cookies?: Record<string, string>;
  user?: { _id: string };
};

type TestResponse = {
  status: number;
  body: AdminRouterResponse | undefined;
  headers: Headers;
};

type AdminRouterResponse =
  | { error: string }
  | {
      items: Array<{
        anonUserId: string;
        anchorConversationId: string;
        conversationCount: number;
        latestUpdatedAt: string;
        user?: string;
      }>;
    }
  | {
      items: Array<{
        anonUserId: string;
        conversationId: string;
        user?: string;
      }>;
      nextCursor: string | null;
    }
  | {
      conversationId: string;
      messages: Array<{
        anonUserId: string;
        messageId: string;
        text?: string;
        files?: unknown;
        attachments?: unknown;
        metadata?: unknown;
        clientId?: unknown;
        thread_id?: unknown;
      }>;
    };

type AdminUserAggregateRow = {
  user: string;
  anchorConversationId: string;
  conversationCount: number;
  latestUpdatedAt: string;
};

const createQuery = <T>(result: T): QueryResult<T> => {
  const query: QueryResult<T> = {
    sort: jest.fn((_sort: unknown) => query),
    limit: jest.fn((_limit: number) => query),
    lean: jest.fn(() => Promise.resolve(result)),
  };

  return query;
};

const createLeanQuery = <T>(result: T): LeanOnlyResult<T> => ({
  lean: jest.fn(() => Promise.resolve(result)),
});

type AggregateResult<T> = {
  exec: jest.Mock<Promise<T>, []>;
};

const createAggregate = <T>(result: T): AggregateResult<T> => ({
  exec: jest.fn(() => Promise.resolve(result)),
});

const makeConversation = () => ({
  _id: 'mongo-convo-1',
  conversationId: 'convo-1',
  user: 'raw-user-id',
  title: 'Support conversation',
  endpoint: 'openAI',
  model: 'gpt-4o',
  files: ['raw-file'],
  createdAt: '2026-05-14T00:00:00.000Z',
  updatedAt: '2026-05-14T00:01:00.000Z',
});

const makeMessage = () => ({
  _id: 'mongo-message-1',
  messageId: 'message-1',
  conversationId: 'convo-1',
  user: 'raw-user-id',
  text: 'Hello',
  files: ['raw-file'],
  attachments: [{ type: 'file' }],
  metadata: { debug: true },
  clientId: 'client-1',
  thread_id: 'thread-1',
  createdAt: '2026-05-14T00:00:30.000Z',
  updatedAt: '2026-05-14T00:00:30.000Z',
});

const createModels = () => ({
  Conversation: {
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
  } as ConversationModelStub,
  Message: {
    find: jest.fn(),
  } as MessageModelStub,
});

const createElevatedCookie = (adminId = 'admin-user') => {
  const token = jwt.sign(
    {
      scope: 'admin.conversations',
      adminId,
      pwVersion: 1,
    },
    sessionSecret,
    { expiresIn: '15m' },
  );

  return `lc_admin_convo=${token}`;
};

const parseCookies: RequestHandler = (req, _res, next) => {
  const cookieHeader = req.headers.cookie;
  const cookies =
    typeof cookieHeader === 'string'
      ? Object.fromEntries(
          cookieHeader
            .split(';')
            .map((entry) => entry.trim().split('='))
            .filter(([name, value]) => name && value),
        )
      : {};

  (req as TestRequest).cookies = cookies;
  next();
};

const createApp = (models: ReturnType<typeof createModels>, userId = 'admin-user') => {
  const app = express();
  app.use(express.json());
  app.use(parseCookies);
  app.use((req, _res, next) => {
    (req as TestRequest).user = { _id: userId };
    next();
  });
  app.use('/', createAdminConversationsRouter(models));
  return app;
};

const listen = (app: ReturnType<typeof createApp>): Promise<{ server: Server; baseUrl: string }> =>
  new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected an ephemeral TCP port');
      }

      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const requestJson = async (
  app: ReturnType<typeof createApp>,
  path: string,
  init: RequestInit = {},
): Promise<TestResponse> => {
  const { server, baseUrl } = await listen(app);

  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();

    return {
      status: response.status,
      body: text ? (JSON.parse(text) as AdminRouterResponse) : undefined,
      headers: response.headers,
    };
  } finally {
    await closeServer(server);
  }
};

describe('createAdminConversationsRouter', () => {
  beforeEach(() => {
    process.env.ADMIN_HASH_SALT = hashSalt;
    process.env.ADMIN_CONVERSATIONS_PASSWORD_HASH =
      '$2a$12$8E4BkH4h1q3w5w5w5w5w5eGSGTh/9dFJUXaKlRuz5NDO7xXub8UyS';
    process.env.ADMIN_CONVERSATIONS_PASSWORD_VERSION = '1';
    process.env.ADMIN_CONVO_SESSION_SECRET = sessionSecret;
    process.env.ADMIN_CONVO_COOKIE_SECURE = 'false';
    process.env.NODE_ENV = 'test';
  });

  it('returns 401 when the admin has not unlocked conversation review', async () => {
    const models = createModels();
    const response = await requestJson(createApp(models), '/');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'authentication_required' });
    expect(models.Conversation.find).not.toHaveBeenCalled();
  });

  it('lists conversations with anonymized ids and no raw user field', async () => {
    const models = createModels();
    models.Conversation.find.mockReturnValue(createQuery([makeConversation()]));

    const response = await requestJson(createApp(models), '/', {
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('items');
    if (!response.body || !('items' in response.body)) {
      throw new Error('Expected list response');
    }
    expect(response.body.nextCursor).toBeNull();
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        conversationId: 'convo-1',
        anonUserId: expect.any(String),
      }),
    );
    expect(response.body.items[0].anonUserId).not.toBe('raw-user-id');
    expect(response.body.items[0]).not.toHaveProperty('user');
  });

  it('returns detail messages without raw attachment and client metadata fields', async () => {
    const models = createModels();
    models.Conversation.findOne.mockReturnValue(createLeanQuery(makeConversation()));
    models.Message.find.mockReturnValue(createQuery([makeMessage()]));

    const response = await requestJson(createApp(models), '/convo-1', {
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('messages');
    if (!response.body || !('messages' in response.body)) {
      throw new Error('Expected detail response');
    }
    expect(response.body.conversationId).toBe('convo-1');
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.messages[0]).toEqual(
      expect.objectContaining({
        messageId: 'message-1',
        text: 'Hello',
        anonUserId: expect.any(String),
      }),
    );
    expect(response.body.messages[0]).not.toHaveProperty('files');
    expect(response.body.messages[0]).not.toHaveProperty('attachments');
    expect(response.body.messages[0]).not.toHaveProperty('metadata');
    expect(response.body.messages[0]).not.toHaveProperty('clientId');
    expect(response.body.messages[0]).not.toHaveProperty('thread_id');
  });

  it('returns not_found when the detail conversation is missing', async () => {
    const models = createModels();
    models.Conversation.findOne.mockReturnValue(createLeanQuery(null));

    const response = await requestJson(createApp(models), '/missing-convo', {
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(models.Message.find).not.toHaveBeenCalled();
  });

  it('clears the elevated conversation cookie when locking', async () => {
    const models = createModels();
    const response = await requestJson(createApp(models), '/lock', {
      method: 'POST',
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('lc_admin_convo=;');
  });

  it('returns invalid_request for unsupported list query parameters', async () => {
    const models = createModels();
    const response = await requestJson(createApp(models), '/?skip=1', {
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_request' });
    expect(models.Conversation.find).not.toHaveBeenCalled();
  });

  it('lists anonymous user groups after unlock', async () => {
    const models = createModels();
    models.Conversation.aggregate.mockReturnValue(
      createAggregate([
        {
          user: 'raw-user-id',
          anchorConversationId: 'convo-1',
          conversationCount: 2,
          latestUpdatedAt: '2026-05-14T00:01:00.000Z',
        },
      ]),
    );

    const response = await requestJson(createApp(models), '/users', {
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('items');
    if (!response.body || !('items' in response.body)) {
      throw new Error('Expected users response');
    }
    expect(response.body.items[0]).toEqual({
      anonUserId: expect.any(String),
      anchorConversationId: 'convo-1',
      conversationCount: 2,
      latestUpdatedAt: '2026-05-14T00:01:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toContain('raw-user-id');
  });

  it('lists conversations for a selected anonymous user anchor', async () => {
    const models = createModels();
    models.Conversation.findOne.mockReturnValue(createLeanQuery(makeConversation()));
    models.Conversation.find.mockReturnValue(createQuery([makeConversation()]));

    const response = await requestJson(createApp(models), '/users/convo-1/conversations', {
      headers: { Cookie: createElevatedCookie() },
    });

    expect(response.status).toBe(200);
    expect(models.Conversation.findOne).toHaveBeenCalledWith({ conversationId: 'convo-1' });
    expect(models.Conversation.find).toHaveBeenCalledWith({ user: 'raw-user-id' });
    expect(response.body).toHaveProperty('items');
    if (!response.body || !('items' in response.body)) {
      throw new Error('Expected user conversations response');
    }
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        anonUserId: expect.any(String),
        conversationId: 'convo-1',
      }),
    );
    expect(response.body.items[0]).not.toHaveProperty('user');
  });
});
