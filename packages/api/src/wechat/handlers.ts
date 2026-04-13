import type { Request, Response } from 'express';
import type { StartResumableGenerationParams } from '../agents/startResumableGeneration';
import { WeChatService } from './service';
import { WeChatBridgeClient } from './bridgeClient';

type WeChatBindingStatus = 'healthy' | 'reauth_required';

type WeChatCurrentBinding = {
  conversationId: string;
  parentMessageId: string;
  selectedAt: Date;
  lastAdvancedAt?: Date | null;
  source: 'new' | 'switch';
};

type ActiveWeChatBinding = {
  userId: string;
  ilinkUserId?: string;
  ilinkBotId?: string | null;
  botToken?: string | null;
  baseUrl?: string | null;
  status: WeChatBindingStatus;
  boundAt?: Date | null;
  welcomeMessageSentAt?: Date | null;
  unhealthyAt?: Date | null;
  currentConversation?: WeChatCurrentBinding | null;
};

type WeChatMessageResult = {
  text: string;
  nextParentMessageId: string;
  timedOut: boolean;
};

type WeChatMessageParams = {
  req: AuthenticatedRequest;
  text: string;
  conversationId: string;
  parentMessageId: string;
  endpointOption: StartResumableGenerationParams['endpointOption'];
};

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
    personalization?: {
      memories?: boolean;
    };
  };
  config?: StartResumableGenerationParams['req']['config'];
}

interface UserIdBody {
  userId?: string;
}

interface SwitchConversationBody extends UserIdBody {
  snapshotId?: string;
  index?: number;
}

interface CompleteBindingBody extends UserIdBody {
  ilinkUserId?: string;
  ilinkBotId?: string;
  botToken?: string;
  baseUrl?: string;
}

interface UpdateBindingHealthBody extends UserIdBody {
  status?: WeChatBindingStatus;
}

interface SendMessageBody extends UserIdBody {
  text?: string;
}

interface BridgeStatusResult<TData> {
  data: TData;
}

function isBridgeStatusResult(value: unknown): value is BridgeStatusResult<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

function unwrapBridgePayload(value: unknown): unknown {
  if (!isBridgeStatusResult(value)) {
    return value;
  }

  return isBridgeStatusResult(value.data) ? value.data.data : value.data;
}

interface CreateWeChatHandlersDependencies {
  service: WeChatService;
  bridgeClient: WeChatBridgeClient;
  orchestrator: {
    sendMessage: (res: Response, params: WeChatMessageParams) => Promise<WeChatMessageResult>;
  };
  listActiveBindings: () => Promise<ActiveWeChatBinding[]>;
  completeBinding: (input: {
    userId: string;
    ilinkUserId: string;
    ilinkBotId: string;
    botToken: string;
    baseUrl: string;
  }) => Promise<void>;
  updateBindingHealth: (input: {
    userId: string;
    status: WeChatBindingStatus;
  }) => Promise<void>;
  markWelcomeMessageSent: (input: {
    userId: string;
  }) => Promise<void>;
  buildMessageEndpointOption: (
    req: AuthenticatedRequest,
    conversation: {
      endpoint?: string | null;
      endpointType?: string | null;
      model?: string | null;
      iconURL?: string | null;
      spec?: string | null;
      agent_id?: string | null;
      promptPrefix?: string | null;
      temperature?: number | null;
      top_p?: number | null;
      topP?: number | null;
      topK?: number | null;
      maxOutputTokens?: number | null;
      maxTokens?: number | null;
      max_tokens?: number | null;
      presence_penalty?: number | null;
      frequency_penalty?: number | null;
      resendFiles?: boolean | null;
      imageDetail?: string | null;
      maxContextTokens?: number | null;
      reasoning_effort?: string | null;
      reasoning_summary?: string | null;
      verbosity?: string | null;
      useResponsesApi?: boolean | null;
      web_search?: boolean | null;
      disableStreaming?: boolean | null;
      fileTokenLimit?: number | null;
      promptCache?: boolean | null;
      thinking?: boolean | null;
      thinkingBudget?: number | null;
      thinkingLevel?: string | null;
      effort?: string | null;
      system?: string | null;
      resendImages?: boolean | null;
      resendFilesImages?: boolean | null;
    },
  ) => Promise<StartResumableGenerationParams['endpointOption']>;
  advanceCurrentConversation: (input: {
    userId: string;
    currentConversation: WeChatCurrentBinding;
    nextParentMessageId: string;
  }) => Promise<void>;
  getAppConfig: (
    role?: string,
  ) => Promise<NonNullable<StartResumableGenerationParams['req']['config']>>;
  getUserById: (
    userId: string,
    fieldsToSelect?: string | string[] | null,
  ) => Promise<AuthenticatedRequest['user'] | null>;
}

const SWITCH_REQUIRED_MESSAGE = '请先执行 /list';
const NO_CURRENT_CONVERSATION_MESSAGE = '请先执行 /new、/list 或 /switch';

function getAuthenticatedUserId(req: AuthenticatedRequest): string | null {
  return typeof req.user?.id === 'string' && req.user.id.length > 0 ? req.user.id : null;
}

function getBodyUserId(req: { body?: UserIdBody | null }): string | null {
  const userId = req.body?.userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

function isSwitchConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === SWITCH_REQUIRED_MESSAGE || error.message === 'SNAPSHOT_REQUIRED')
  );
}

export function createWeChatHandlers(deps: CreateWeChatHandlersDependencies) {
  async function hydrateBridgeUser(
    req: AuthenticatedRequest,
    userId: string,
  ): Promise<NonNullable<AuthenticatedRequest['user']>> {
    if (
      req.user?.id === userId &&
      req.user.role != null &&
      req.user.personalization != null
    ) {
      return req.user;
    }

    const storedUser = await deps.getUserById(userId, 'role personalization');
    req.user = {
      id: userId,
      role: storedUser?.role,
      personalization: storedUser?.personalization,
    };
    return req.user;
  }

  async function getStatus(req: AuthenticatedRequest, res: Response) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json(await deps.service.getStatus(userId));
  }

  async function startBind(req: AuthenticatedRequest, res: Response) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const started = await deps.bridgeClient.startBindSession({ userId });
    res.status(201).json(unwrapBridgePayload(started));
  }

  async function getBindStatus(
    req: Request<{ bindSessionId: string }> & AuthenticatedRequest,
    res: Response,
  ) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await deps.bridgeClient.getBindSession(req.params.bindSessionId);
    res.json(unwrapBridgePayload(result));
  }

  async function unbind(req: AuthenticatedRequest, res: Response) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await deps.service.unbind(userId);
    res.status(204).send();
  }

  async function getActiveBindings(_req: Request, res: Response) {
    const bindings = await deps.listActiveBindings();
    res.json({ bindings });
  }

  async function completeBinding(
    req: Request<unknown, unknown, CompleteBindingBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req);
    const { ilinkUserId, ilinkBotId, botToken, baseUrl } = req.body;

    if (!userId || !ilinkUserId || !ilinkBotId || !botToken || !baseUrl) {
      return res.status(400).json({ message: 'Missing binding fields' });
    }

    await deps.completeBinding({
      userId,
      ilinkUserId,
      ilinkBotId,
      botToken,
      baseUrl,
    });

    res.status(204).send();
  }

  async function updateBindingHealth(
    req: Request<unknown, unknown, UpdateBindingHealthBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req);
    const { status } = req.body;

    if (!userId || (status !== 'healthy' && status !== 'reauth_required')) {
      return res.status(400).json({ message: 'Invalid binding health update' });
    }

    await deps.updateBindingHealth({ userId, status });
    res.status(204).send();
  }

  async function markWelcomeMessageSent(
    req: Request<unknown, unknown, UserIdBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req);
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    await deps.markWelcomeMessageSent({ userId });
    res.status(204).send();
  }

  async function listConversations(
    req: Request<unknown, unknown, UserIdBody, UserIdBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req) ?? (typeof req.query.userId === 'string' ? req.query.userId : null);
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    res.json(await deps.service.listEligibleConversations(userId));
  }

  async function createConversation(
    req: Request<unknown, unknown, UserIdBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req);
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    res.status(201).json(await deps.service.createConversation(userId));
  }

  async function switchConversation(
    req: Request<unknown, unknown, SwitchConversationBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req);
    const { snapshotId, index } = req.body;

    if (!userId || !snapshotId || !Number.isInteger(index) || index == null) {
      return res.status(400).json({ message: 'Invalid switch request' });
    }

    try {
      res.json(
        await deps.service.switchConversation(userId, {
          snapshotId,
          index,
        }),
      );
    } catch (error) {
      if (isSwitchConflictError(error)) {
        return res.status(409).json({ message: SWITCH_REQUIRED_MESSAGE });
      }

      throw error;
    }
  }

  async function getCurrentConversation(
    req: Request<unknown, unknown, UserIdBody, UserIdBody>,
    res: Response,
  ) {
    const userId = getBodyUserId(req) ?? (typeof req.query.userId === 'string' ? req.query.userId : null);
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    res.json(await deps.service.getCurrentConversation(userId));
  }

  async function sendMessage(
    req: Request<unknown, unknown, SendMessageBody> & AuthenticatedRequest,
    res: Response,
  ) {
    const userId = getBodyUserId(req);
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';

    if (!userId || text.length === 0) {
      return res.status(400).json({ message: 'Missing message payload' });
    }

    const currentConversation = await deps.service.getCurrentConversation(userId);
    if (!currentConversation) {
      return res.status(409).json({ message: NO_CURRENT_CONVERSATION_MESSAGE });
    }

    const bridgeUser = await hydrateBridgeUser(req, userId);
    if (!req.config) {
      req.config = await deps.getAppConfig(bridgeUser.role);
    }

    req.body = {
      ...req.body,
      endpoint: currentConversation.conversation.endpoint ?? 'openAI',
      endpointType:
        currentConversation.conversation.endpointType ??
        currentConversation.conversation.endpoint ??
        'openAI',
      model: currentConversation.conversation.model ?? 'gpt-4o',
      conversationId: currentConversation.conversationId,
      parentMessageId: currentConversation.parentMessageId,
      text,
    };

    const endpointOption = await deps.buildMessageEndpointOption(req, currentConversation.conversation);
    req.body = {
      ...req.body,
      endpointOption,
    };

    const result = await deps.orchestrator.sendMessage(res, {
      req,
      text,
      conversationId: currentConversation.conversationId,
      parentMessageId: currentConversation.parentMessageId,
      endpointOption,
    });

    await deps.advanceCurrentConversation({
      userId,
      currentConversation: {
        conversationId: currentConversation.conversationId,
        parentMessageId: currentConversation.parentMessageId,
        selectedAt: currentConversation.selectedAt,
        lastAdvancedAt: currentConversation.lastAdvancedAt,
        source: currentConversation.source,
      },
      nextParentMessageId: result.nextParentMessageId,
    });

    res.json({
      conversationId: currentConversation.conversationId,
      parentMessageId: result.nextParentMessageId,
      text: result.text,
      timedOut: result.timedOut,
    });
  }

  return {
    getStatus,
    startBind,
    getBindStatus,
    unbind,
    getActiveBindings,
    completeBinding,
    updateBindingHealth,
    markWelcomeMessageSent,
    listConversations,
    createConversation,
    switchConversation,
    getCurrentConversation,
    sendMessage,
  };
}
