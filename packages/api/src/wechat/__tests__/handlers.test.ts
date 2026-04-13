import type { Request, Response } from 'express';
import { createWeChatHandlers } from '../handlers';

type MockResponse = Response & {
  body?: unknown;
  statusCode: number;
};

function createMockResponse(): MockResponse {
  const response = {
    body: undefined,
    statusCode: 200,
    json(body: unknown) {
      response.body = body;
      return response;
    },
    send(body?: unknown) {
      response.body = body;
      return response;
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
  };

  return response as unknown as MockResponse;
}

function createDependencies() {
  return {
    service: {
      getStatus: jest.fn(),
      unbind: jest.fn(),
      listEligibleConversations: jest.fn(),
      createConversation: jest.fn(),
      switchConversation: jest.fn(),
      getCurrentConversation: jest.fn(),
    },
    bridgeClient: {
      startBindSession: jest.fn(),
      getBindSession: jest.fn(),
      cancelBindSession: jest.fn(),
    },
    orchestrator: {
      sendMessage: jest.fn(),
    },
    listActiveBindings: jest.fn(async () => []),
    completeBinding: jest.fn(async () => undefined),
    updateBindingHealth: jest.fn(async () => undefined),
    markWelcomeMessageSent: jest.fn(async () => undefined),
    buildMessageEndpointOption: jest.fn(async () => ({
      endpoint: 'openAI',
      modelOptions: { model: 'gpt-4o' },
    })),
    advanceCurrentConversation: jest.fn(async () => undefined),
    getAppConfig: jest.fn(async () => ({ endpoints: { openAI: {} } })),
    getUserById: jest.fn(async () => ({
      id: 'user-1',
      role: 'USER',
      personalization: {
        memories: true,
      },
    })),
  };
}

describe('createWeChatHandlers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a flattened bind session payload from the bridge client', async () => {
    const deps = createDependencies();
    deps.bridgeClient.startBindSession.mockResolvedValue({
      data: {
        data: {
          bindSessionId: 'bind-session-1',
          qrCodeDataUrl: 'https://example.com/qr.png',
          expiresAt: '2026-04-12T00:00:00.000Z',
        },
      },
    });
    const handlers = createWeChatHandlers(deps);
    const req = { user: { id: 'user-1' } } as Request & { user: { id: string } };
    const res = createMockResponse();

    await handlers.startBind(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      bindSessionId: 'bind-session-1',
      qrCodeDataUrl: 'https://example.com/qr.png',
      expiresAt: '2026-04-12T00:00:00.000Z',
    });
  });


  it('lists conversations from the query string when the GET request has no body', async () => {
    const deps = createDependencies();
    deps.service.listEligibleConversations.mockResolvedValue({
      snapshotId: 'snapshot-1',
      conversations: [],
    });
    const handlers = createWeChatHandlers(deps);
    const req = {
      query: { userId: 'user-1' },
    } as unknown as Request<unknown, unknown, { userId?: string }, { userId?: string }>;
    const res = createMockResponse();

    await handlers.listConversations(req, res);

    expect(deps.service.listEligibleConversations).toHaveBeenCalledWith('user-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      snapshotId: 'snapshot-1',
      conversations: [],
    });
  });

  it('loads the current conversation from the query string when the GET request has no body', async () => {
    const deps = createDependencies();
    deps.service.getCurrentConversation.mockResolvedValue(null);
    const handlers = createWeChatHandlers(deps);
    const req = {
      query: { userId: 'user-1' },
    } as unknown as Request<unknown, unknown, { userId?: string }, { userId?: string }>;
    const res = createMockResponse();

    await handlers.getCurrentConversation(req, res);

    expect(deps.service.getCurrentConversation).toHaveBeenCalledWith('user-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });


  it('hydrates req.user from the stored user before sending a bridge message', async () => {
    const deps = createDependencies();
    deps.service.getCurrentConversation.mockResolvedValue({
      conversationId: 'convo-1',
      parentMessageId: 'parent-1',
      source: 'new',
      selectedAt: new Date('2026-04-12T00:00:00.000Z'),
      lastAdvancedAt: null,
      conversation: {
        conversationId: 'convo-1',
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o',
      },
    });
    deps.orchestrator.sendMessage.mockResolvedValue({
      text: 'reply',
      nextParentMessageId: 'parent-2',
      timedOut: false,
    });
    const handlers = createWeChatHandlers(deps);
    const req = {
      body: {
        userId: 'user-1',
        text: 'hello',
      },
    } as unknown as Request<unknown, unknown, { userId?: string; text?: string }> & {
      user?: { id: string };
    };
    const res = createMockResponse();

    await handlers.sendMessage(req, res);

    expect(deps.getUserById).toHaveBeenCalledWith('user-1', 'role personalization');
    expect(req.user).toEqual({
      id: 'user-1',
      role: 'USER',
      personalization: {
        memories: true,
      },
    });
    expect(deps.buildMessageEndpointOption).toHaveBeenCalledWith(
      expect.objectContaining({
        user: {
          id: 'user-1',
          role: 'USER',
          personalization: {
            memories: true,
          },
        },
      }),
      expect.objectContaining({ conversationId: 'convo-1' }),
    );
    expect(deps.orchestrator.sendMessage).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        req: expect.objectContaining({
          user: {
            id: 'user-1',
            role: 'USER',
            personalization: {
              memories: true,
            },
          },
        }),
      }),
    );
  });

  it('hydrates req.config before building the endpoint option for internal messages', async () => {
    const deps = createDependencies();
    deps.service.getCurrentConversation.mockResolvedValue({
      conversationId: 'convo-1',
      parentMessageId: 'parent-1',
      source: 'new',
      selectedAt: new Date('2026-04-12T00:00:00.000Z'),
      lastAdvancedAt: null,
      conversation: {
        conversationId: 'convo-1',
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o',
      },
    });
    deps.orchestrator.sendMessage.mockResolvedValue({
      text: 'reply',
      nextParentMessageId: 'parent-2',
      timedOut: false,
    });
    const handlers = createWeChatHandlers(deps);
    const req = {
      body: {
        userId: 'user-1',
        text: 'hello',
      },
    } as unknown as Request<unknown, unknown, { userId?: string; text?: string }> & {
      config?: { endpoints?: { openAI?: object } };
      user?: { id: string; role?: string };
    };
    const res = createMockResponse();

    await handlers.sendMessage(req, res);

    expect(deps.getAppConfig).toHaveBeenCalledWith('USER');
    expect(req.config).toEqual({ endpoints: { openAI: {} } });
    expect(deps.buildMessageEndpointOption).toHaveBeenCalledWith(
      expect.objectContaining({ config: { endpoints: { openAI: {} } } }),
      expect.objectContaining({ conversationId: 'convo-1' }),
    );
  });

  it('returns a flattened bind status payload from the bridge client', async () => {
    const deps = createDependencies();
    deps.bridgeClient.getBindSession.mockResolvedValue({
      data: {
        data: {
          bindSessionId: 'bind-session-1',
          qrCodeDataUrl: 'https://example.com/qr.png',
          status: 'pending',
        },
      },
    });
    const handlers = createWeChatHandlers(deps);
    const req = {
      params: { bindSessionId: 'bind-session-1' },
      user: { id: 'user-1' },
    } as Request<{ bindSessionId: string }> & { user: { id: string } };
    const res = createMockResponse();

    await handlers.getBindStatus(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      bindSessionId: 'bind-session-1',
      qrCodeDataUrl: 'https://example.com/qr.png',
      status: 'pending',
    });
  });
});
