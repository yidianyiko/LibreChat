const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

let capturedWeChatServiceDeps;

const mockConversationCreate = jest.fn();
const mockPresetLean = jest.fn();
const mockPresetSort = jest.fn(() => ({ lean: mockPresetLean }));
const mockPresetFindOne = jest.fn(() => ({ sort: mockPresetSort }));

jest.mock('~/db/models', () => ({
  Conversation: { create: mockConversationCreate },
  Preset: { findOne: mockPresetFindOne },
}));

const mockWeChatService = {
  getStatus: jest.fn(),
  unbind: jest.fn(),
  listEligibleConversations: jest.fn(),
  createConversation: jest.fn(),
  switchConversation: jest.fn(),
  getCurrentConversation: jest.fn(),
};

const mockWeChatBridgeClient = {
  startBindSession: jest.fn(),
  getBindSession: jest.fn(),
  cancelBindSession: jest.fn(),
};

const mockWeChatOrchestrator = {
  sendMessage: jest.fn(),
};

jest.mock('@librechat/api', () => ({
  WeChatService: jest.fn((deps) => {
    capturedWeChatServiceDeps = deps;
    return mockWeChatService;
  }),
  WeChatBridgeClient: jest.fn(() => mockWeChatBridgeClient),
  WeChatMessageOrchestrator: jest.fn(() => mockWeChatOrchestrator),
  startResumableGeneration: jest.fn(),
  createWeChatHandlers: jest.fn((deps) => ({
    getStatus: async (req, res) => res.json(await deps.service.getStatus(req.user.id)),
    startBind: async (req, res) => {
      const result = await deps.bridgeClient.startBindSession({ userId: req.user.id });
      res.status(201).json(result.data);
    },
    getBindStatus: async (req, res) => {
      const result = await deps.bridgeClient.getBindSession(req.params.bindSessionId);
      res.json(result.data);
    },
    unbind: async (req, res) => {
      await deps.service.unbind(req.user.id);
      res.status(204).send();
    },
    getActiveBindings: async (_req, res) => res.json({ bindings: [] }),
    completeBinding: async (_req, res) => res.status(204).send(),
    updateBindingHealth: async (_req, res) => res.status(204).send(),
    markWelcomeMessageSent: async (_req, res) => res.status(204).send(),
    listConversations: async (req, res) =>
      res.json(await deps.service.listEligibleConversations(req.body.userId)),
    createConversation: async (req, res) =>
      res.status(201).json(await deps.service.createConversation(req.body.userId)),
    switchConversation: async (req, res) => {
      try {
        const result = await deps.service.switchConversation(req.body.userId, {
          snapshotId: req.body.snapshotId,
          index: req.body.index,
        });
        res.json(result);
      } catch (error) {
        if (error.message === 'SNAPSHOT_REQUIRED') {
          return res.status(409).json({ message: '请先执行 /list' });
        }

        throw error;
      }
    },
    getCurrentConversation: async (req, res) =>
      res.json(await deps.service.getCurrentConversation(req.query.userId ?? req.body.userId)),
    sendMessage: async (req, res) =>
      res.json(
        await deps.orchestrator.sendMessage({
          req,
          text: req.body.text,
          conversationId: req.body.conversationId,
          parentMessageId: req.body.parentMessageId,
          endpointOption: req.body.endpointOption,
        }),
      ),
  })),
  createRequireWeChatBridgeAuth: jest.fn((expectedToken) => (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing bridge authorization' });
    }

    const token = auth.slice('Bearer '.length);
    if (token !== expectedToken) {
      return res.status(401).json({ message: 'Invalid bridge authorization' });
    }

    next();
  }),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: 'website-user-1' };
    next();
  },
}));

describe('/api/wechat routes', () => {
  let app;

  beforeAll(() => {
    process.env.WECHAT_BRIDGE_INTERNAL_TOKEN = 'internal-token';
    const router = require('../wechat');
    app = express();
    app.use(express.json());
    app.use('/api/wechat', router);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete mongoose.models.WeChatBinding;
  });

  it('rejects internal bridge routes without the shared bearer token', async () => {
    await request(app).get('/api/wechat/internal/bindings/active').expect(401);
  });

  it('returns 请先执行 /list when switch is requested without a valid snapshot', async () => {
    mockWeChatService.switchConversation.mockRejectedValue(new Error('SNAPSHOT_REQUIRED'));

    const response = await request(app)
      .post('/api/wechat/conversations/switch')
      .set('Authorization', 'Bearer internal-token')
      .send({ userId: 'user-1', snapshotId: 'missing', index: 2 });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('请先执行 /list');
  });

  it('strips preset metadata before creating a new WeChat conversation', async () => {
    mockConversationCreate.mockResolvedValue({
      toObject: () => ({ conversationId: 'convo-1', title: 'Preset Title' }),
    });

    await capturedWeChatServiceDeps.createConversation({
      userId: 'user-1',
      conversationId: 'convo-1',
      preset: {
        _id: 'preset-id',
        user: 'user-1',
        defaultPreset: true,
        isArchived: false,
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        __v: 0,
        title: 'Preset Title',
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o',
      },
    });

    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({
        _id: 'preset-id',
        user: 'user-1',
        defaultPreset: true,
        __v: 0,
      }),
    );
    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'convo-1',
        user: 'user-1',
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o',
        title: 'Preset Title',
      }),
    );
  });

  it('unsets ilinkUserId when unbind persistence omits it', async () => {
    const lean = jest.fn().mockResolvedValue({});
    const findOneAndUpdate = jest.fn(() => ({ lean }));
    mongoose.models.WeChatBinding = { findOneAndUpdate };

    await capturedWeChatServiceDeps.upsertBinding('user-1', {
      ilinkBotId: null,
      botToken: null,
      baseUrl: null,
      status: 'unbound',
      boundAt: null,
      unhealthyAt: null,
      unboundAt: new Date('2026-04-11T12:00:00.000Z'),
      currentConversation: null,
    });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $unset: { ilinkUserId: 1 },
        $setOnInsert: { userId: 'user-1' },
      }),
      { new: true, upsert: true },
    );
  });
});
