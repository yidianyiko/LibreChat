const express = require('express');
const mongoose = require('mongoose');
const { CacheKeys, Constants } = require('librechat-data-provider');
const {
  createWeChatHandlers,
  createRequireWeChatBridgeAuth,
  GenerationJobManager,
  buildWeChatFallbackPreset,
  resolveWeChatRuntimePromptPrefix,
  startResumableGeneration,
  WeChatBridgeClient,
  WeChatMessageOrchestrator,
  WeChatService,
  waitForWeChatTerminalResult,
} = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const getWeChatBindingModel = () => {
  if (!mongoose.models.WeChatBinding) {
    throw new Error('WeChatBinding model is not initialized');
  }

  return mongoose.models.WeChatBinding;
};

const removeUndefinedFields = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, current]) => current !== undefined));

const shouldUnsetIlinkUserId = (update) =>
  update.status === 'unbound' && !Object.prototype.hasOwnProperty.call(update, 'ilinkUserId');

const buildBindingUpdateDocument = (userId, update) => {
  const $set = removeUndefinedFields(update);

  return {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(shouldUnsetIlinkUserId(update) ? { $unset: { ilinkUserId: 1 } } : {}),
    $setOnInsert: { userId },
  };
};

const sanitizePresetForConversation = (preset = {}) => {
  const { _id, __v, user, defaultPreset, isArchived, createdAt, updatedAt, ...rest } = preset;
  return rest;
};

const getDefaultWeChatFallbackPreset = () => {
  return buildWeChatFallbackPreset();
};

const getBridgeBaseUrl = () => process.env.WECHAT_BRIDGE_URL || 'http://localhost:3091';
const getBridgeToken = () => process.env.WECHAT_BRIDGE_INTERNAL_TOKEN || '';

const service = new WeChatService({
  findBindingByUserId: async (userId) => {
    return getWeChatBindingModel().findOne({ userId }).lean();
  },
  listUserConversations: async (userId) => {
    const { Conversation } = require('~/db/models');
    return Conversation.find({ user: userId }).lean();
  },
  getConversation: async (userId, conversationId) => {
    const { Conversation } = require('~/db/models');
    return Conversation.findOne({ user: userId, conversationId }).lean();
  },
  listConversationMessages: async (userId, conversationId) => {
    const { Message } = require('~/db/models');
    return Message.find({ user: userId, conversationId })
      .sort({ createdAt: 1 })
      .select('messageId parentMessageId createdAt isCreatedByUser')
      .lean();
  },
  getUserDefaultPreset: async (userId) => {
    const { Preset } = require('~/db/models');
    return Preset.findOne({
      user: userId,
      defaultPreset: true,
      isArchived: { $ne: true },
    })
      .sort({ updatedAt: -1 })
      .lean();
  },
  getFallbackPreset: () => getDefaultWeChatFallbackPreset(),
  createConversation: async ({ userId, conversationId, preset }) => {
    const { Conversation } = require('~/db/models');
    const sanitizedPreset = sanitizePresetForConversation(preset);
    const created = await Conversation.create({
      ...sanitizedPreset,
      conversationId,
      title: sanitizedPreset.title || 'New Chat',
      user: userId,
      endpoint: sanitizedPreset.endpoint || 'openAI',
      endpointType: sanitizedPreset.endpointType || sanitizedPreset.endpoint || 'openAI',
      model: sanitizedPreset.model || 'gpt-4o',
      isArchived: false,
    });
    return created.toObject();
  },
  upsertBinding: async (userId, update) => {
    return getWeChatBindingModel()
      .findOneAndUpdate(
        { userId },
        buildBindingUpdateDocument(userId, update),
        { new: true, upsert: true },
      )
      .lean();
  },
  storeSnapshot: async (userId, snapshot) => {
    const { getLogStores } = require('~/cache');
    const snapshotCache = getLogStores(CacheKeys.WECHAT_LIST_SNAPSHOT);
    await snapshotCache.set(userId, snapshot);
  },
  getSnapshot: async (userId) => {
    const { getLogStores } = require('~/cache');
    const snapshotCache = getLogStores(CacheKeys.WECHAT_LIST_SNAPSHOT);
    return snapshotCache.get(userId);
  },
});

const bridgeClient = new WeChatBridgeClient(getBridgeBaseUrl(), getBridgeToken());

const waitForStream = async (streamId, timeoutMs) =>
  waitForWeChatTerminalResult({
    streamId,
    timeoutMs,
    noParentMessageId: Constants.NO_PARENT,
    getJob: (id) => GenerationJobManager.getJob(id),
    getJobStatus: (id) => GenerationJobManager.getJobStatus(id),
    getResumeState: (id) => GenerationJobManager.getResumeState(id),
    subscribe: (id, onDone, onError) =>
      GenerationJobManager.subscribe(id, () => undefined, onDone, onError),
  });

const responseShim = () => ({
  headersSent: false,
  writableEnded: false,
  write: () => true,
  end: () => undefined,
  setHeader: () => undefined,
  getHeader: () => undefined,
  flushHeaders: () => undefined,
  on: () => undefined,
  once: () => undefined,
  removeListener: () => undefined,
});

const orchestrator = {
  sendMessage: async (resOrParams, maybeParams) => {
    const hasResponse = maybeParams != null;
    const res = hasResponse ? resOrParams : responseShim();
    const params = hasResponse ? maybeParams : resOrParams;

    const instance = new WeChatMessageOrchestrator({
      startResumableGeneration: (orchestratorParams) =>
        {
          const { saveMessage } = require('~/models');
          const { disposeClient } = require('~/server/cleanup');
          return startResumableGeneration({
            ...orchestratorParams,
            saveMessage,
            disposeClient,
          });
        },
      initializeClient: (args) =>
        {
          const { initializeClient } = require('~/server/services/Endpoints/agents');
          return initializeClient({
            ...args,
            res,
          });
        },
      addTitle: (req, args) => {
        const addTitle = require('~/server/services/Endpoints/agents/title');
        return addTitle(req, args);
      },
      waitForStream,
    });

    return instance.sendMessage(params);
  },
};

const handlers = createWeChatHandlers({
  service,
  bridgeClient,
  orchestrator,
  listActiveBindings: async () => {
    return getWeChatBindingModel()
      .find({
        status: { $in: ['healthy', 'reauth_required'] },
        ilinkUserId: { $exists: true, $ne: null },
        botToken: { $ne: null },
        baseUrl: { $ne: null },
      })
      .select('+botToken')
      .lean();
  },
  completeBinding: async ({ userId, ilinkUserId, ilinkBotId, botToken, baseUrl }) => {
    await getWeChatBindingModel().findOneAndUpdate(
      { userId },
      {
        $set: {
          ilinkUserId,
          ilinkBotId,
          botToken,
          baseUrl,
          status: 'healthy',
          boundAt: new Date(),
          welcomeMessageSentAt: null,
          unhealthyAt: null,
          unboundAt: null,
        },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
  },
  updateBindingHealth: async ({ userId, status }) => {
    await getWeChatBindingModel().findOneAndUpdate(
      { userId },
      {
        $set: {
          status,
          unhealthyAt: status === 'reauth_required' ? new Date() : null,
        },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
  },
  markWelcomeMessageSent: async ({ userId }) => {
    await getWeChatBindingModel().findOneAndUpdate(
      { userId },
      {
        $set: {
          welcomeMessageSentAt: new Date(),
        },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
  },
  buildMessageEndpointOption: async (req, conversation) => {
    const { buildOptions } = require('~/server/services/Endpoints/agents');
    const runtimePromptPrefix = resolveWeChatRuntimePromptPrefix(conversation);
    const runtimeSystemPrompt =
      conversation.system != null || conversation.promptPrefix != null
        ? resolveWeChatRuntimePromptPrefix({
            promptPrefix: conversation.system ?? conversation.promptPrefix ?? undefined,
          })
        : undefined;

    return buildOptions(
      req,
      conversation.endpoint || 'openAI',
      removeUndefinedFields({
        agent_id: conversation.agent_id || undefined,
        iconURL: conversation.iconURL || undefined,
        spec: conversation.spec || undefined,
        model: conversation.model || 'gpt-4o',
        temperature: conversation.temperature ?? undefined,
        top_p: conversation.top_p ?? undefined,
        topP: conversation.topP ?? undefined,
        topK: conversation.topK ?? undefined,
        maxOutputTokens: conversation.maxOutputTokens ?? undefined,
        maxTokens: conversation.maxTokens ?? undefined,
        max_tokens: conversation.max_tokens ?? undefined,
        presence_penalty: conversation.presence_penalty ?? undefined,
        frequency_penalty: conversation.frequency_penalty ?? undefined,
        resendFiles: conversation.resendFiles ?? undefined,
        imageDetail: conversation.imageDetail ?? undefined,
        maxContextTokens: conversation.maxContextTokens ?? undefined,
        reasoning_effort: conversation.reasoning_effort ?? undefined,
        reasoning_summary: conversation.reasoning_summary ?? undefined,
        verbosity: conversation.verbosity ?? undefined,
        useResponsesApi: conversation.useResponsesApi ?? undefined,
        web_search: conversation.web_search ?? undefined,
        disableStreaming: conversation.disableStreaming ?? undefined,
        fileTokenLimit: conversation.fileTokenLimit ?? undefined,
        promptCache: conversation.promptCache ?? undefined,
        thinking: conversation.thinking ?? undefined,
        thinkingBudget: conversation.thinkingBudget ?? undefined,
        thinkingLevel: conversation.thinkingLevel ?? undefined,
        effort: conversation.effort ?? undefined,
        promptPrefix: runtimePromptPrefix,
        system: runtimeSystemPrompt,
        resendImages: conversation.resendImages ?? undefined,
      }),
      conversation.endpointType || undefined,
    );
  },
  getAppConfig: async (role) => {
    const { getAppConfig } = require('~/server/services/Config');
    return getAppConfig({ role });
  },
  getUserById: async (userId, fieldsToSelect) => {
    const { getUserById } = require('~/models');
    return getUserById(userId, fieldsToSelect);
  },
  advanceCurrentConversation: async ({ userId, currentConversation, nextParentMessageId }) => {
    await getWeChatBindingModel().findOneAndUpdate(
      { userId },
      {
        $set: {
          currentConversation: {
            conversationId: currentConversation.conversationId,
            parentMessageId: nextParentMessageId,
            selectedAt: currentConversation.selectedAt,
            lastAdvancedAt: new Date(),
            source: currentConversation.source,
          },
        },
      },
    );
  },
});

const requireBridgeAuth = createRequireWeChatBridgeAuth(getBridgeToken());

router.get('/status', requireJwtAuth, handlers.getStatus);
router.post('/bind/start', requireJwtAuth, handlers.startBind);
router.get('/bind/status/:bindSessionId', requireJwtAuth, handlers.getBindStatus);
router.delete('/bind', requireJwtAuth, handlers.unbind);

router.get('/internal/bindings/active', requireBridgeAuth, handlers.getActiveBindings);
router.post('/internal/bindings/complete', requireBridgeAuth, handlers.completeBinding);
router.post('/internal/bindings/health', requireBridgeAuth, handlers.updateBindingHealth);
router.post('/internal/bindings/welcome', requireBridgeAuth, handlers.markWelcomeMessageSent);

router.get('/conversations', requireBridgeAuth, handlers.listConversations);
router.post('/conversations/new', requireBridgeAuth, handlers.createConversation);
router.post('/conversations/switch', requireBridgeAuth, handlers.switchConversation);
router.get('/conversations/current', requireBridgeAuth, handlers.getCurrentConversation);
router.post('/messages', requireBridgeAuth, handlers.sendMessage);

module.exports = router;
