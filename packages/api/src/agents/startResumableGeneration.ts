import crypto from 'node:crypto';
import { logger } from '@librechat/data-schemas';
import { Constants } from 'librechat-data-provider';
import type { TFile, TMessage, TMessageContentParts } from 'librechat-data-provider';
import type { ServerRequest } from '~/types';
import { decrementPendingRequest } from '../middleware';
import { GenerationJobManager } from '../stream';
import { buildMessageFiles, sanitizeMessageForTransmit } from '../utils/message';

type StartResumableGenerationBody = {
  files?: Array<{ file_id?: string }>;
  agent_id?: string;
};

type StartResumableGenerationRequest = ServerRequest & {
  user: NonNullable<ServerRequest['user']>;
  body: StartResumableGenerationBody;
  _resumableStreamId?: string;
};

type ResumableEndpointOption = {
  endpoint?: string | null;
  modelOptions?: { model?: string | null };
  model_parameters?: { model?: string | null };
};

type SaveMessageOptions = {
  context: string;
};

type UserMessageMeta = {
  messageId: string;
  parentMessageId?: string | null;
  conversationId?: string | null;
  text?: string | null;
};

type SavedMessage = Partial<TMessage> & {
  messageId: string;
  conversationId?: string | null;
  parentMessageId?: string | null;
  content?: TMessageContentParts[];
  user?: string;
  endpoint?: string | null;
  model?: string | null;
  sender?: string;
  unfinished?: boolean;
  error?: boolean;
  isCreatedByUser?: boolean;
  agent_id?: string;
};

type ConversationRecord = {
  conversationId?: string | null;
  title?: string | null;
};

type ClientResponse = Partial<TMessage> & {
  messageId: string;
  conversationId?: string | null;
  endpoint?: string | null;
  databasePromise?: Promise<{
    conversation?: ConversationRecord;
  }>;
};

type ProgressResponseShim = {
  write: () => true;
  end: () => void;
  headersSent: boolean;
  writableEnded: boolean;
};

type SendMessageOptions = {
  user: string;
  onStart: (userMessage: SavedMessage, responseMessageId: string, isNewConversation: boolean) => void;
  getReqData: (data?: { userMessage?: SavedMessage }) => void;
  isContinued?: boolean;
  isRegenerate?: boolean;
  editedContent?: unknown;
  conversationId: string;
  parentMessageId?: string | null;
  abortController: AbortController;
  overrideParentMessageId?: string | null;
  isEdited: boolean;
  userMCPAuthMap?: Record<string, Record<string, string>>;
  responseMessageId?: string | null;
  progressOptions: {
    res: ProgressResponseShim;
  };
};

type ResumableAgentClient = {
  sender?: string;
  contentParts?: TMessageContentParts[];
  skipSaveUserMessage?: boolean;
  savedMessageIds?: Set<string>;
  options: {
    attachments?: Partial<TFile>[];
    titleConvo?: boolean;
  };
  sendMessage: (text: string, options: SendMessageOptions) => Promise<ClientResponse>;
};

type InitializeClientArgs = {
  req: StartResumableGenerationRequest;
  endpointOption: ResumableEndpointOption;
  signal: AbortSignal;
};

type InitializeClientResult = {
  client: ResumableAgentClient;
  userMCPAuthMap?: Record<string, Record<string, string>>;
};

type AddTitleArgs = {
  text: string;
  response: ClientResponse;
  client: ResumableAgentClient;
};

export interface StartResumableGenerationParams {
  req: StartResumableGenerationRequest;
  initializeClient: (args: InitializeClientArgs) => Promise<InitializeClientResult>;
  addTitle?: (req: StartResumableGenerationRequest, args: AddTitleArgs) => Promise<void>;
  saveMessage: (
    req: StartResumableGenerationRequest,
    message: SavedMessage,
    options: SaveMessageOptions,
  ) => Promise<unknown>;
  disposeClient: (client: ResumableAgentClient) => void;
  text: string;
  endpointOption: ResumableEndpointOption;
  conversationId?: string | null;
  parentMessageId?: string | null;
  isContinued?: boolean;
  isRegenerate?: boolean;
  editedContent?: unknown;
  overrideParentMessageId?: string | null;
  responseMessageId?: string | null;
}

export interface StartResumableGenerationResult {
  streamId: string;
  conversationId: string;
  job: Awaited<ReturnType<typeof GenerationJobManager.createJob>>;
}

export async function startResumableGeneration(
  params: StartResumableGenerationParams,
): Promise<StartResumableGenerationResult> {
  const conversationId =
    !params.conversationId || params.conversationId === 'new'
      ? crypto.randomUUID()
      : params.conversationId;
  const streamId = conversationId;
  const userId = params.req.user.id;

  logger.debug('[startResumableGeneration] Creating job', {
    streamId,
    conversationId,
    reqConversationId: params.conversationId,
    userId,
  });

  const job = await GenerationJobManager.createJob(streamId, userId, conversationId);
  const jobCreatedAt = job.createdAt;
  params.req._resumableStreamId = streamId;

  let client: ResumableAgentClient | null = null;
  let partialResponseSaved = false;

  job.emitter.on('allSubscribersLeft', async (aggregatedContent: TMessageContentParts[]) => {
    if (partialResponseSaved || !aggregatedContent || aggregatedContent.length === 0) {
      return;
    }

    const resumeState = await GenerationJobManager.getResumeState(streamId);
    if (!resumeState?.userMessage) {
      logger.debug('[startResumableGeneration] No user message to save partial response for');
      return;
    }

    partialResponseSaved = true;
    const responseConversationId = resumeState.conversationId || conversationId;

    try {
      const partialMessage: SavedMessage = {
        messageId: resumeState.responseMessageId || `${resumeState.userMessage.messageId}_`,
        conversationId: responseConversationId,
        parentMessageId: resumeState.userMessage.messageId,
        sender: client?.sender ?? 'AI',
        content: aggregatedContent,
        unfinished: true,
        error: false,
        isCreatedByUser: false,
        user: userId,
        endpoint: params.endpointOption.endpoint,
        model:
          params.endpointOption.modelOptions?.model ??
          params.endpointOption.model_parameters?.model ??
          null,
      };

      if (params.req.body.agent_id) {
        partialMessage.agent_id = params.req.body.agent_id;
      }

      await params.saveMessage(params.req, partialMessage, {
        context:
          'packages/api/src/agents/startResumableGeneration.ts - partial response on disconnect',
      });

      logger.debug(
        `[startResumableGeneration] Saved partial response for ${streamId}, content parts: ${aggregatedContent.length}`,
      );
    } catch (error) {
      logger.error('[startResumableGeneration] Error saving partial response:', error);
      partialResponseSaved = false;
    }
  });

  const startGeneration = async () => {
    try {
      const initialized = await params.initializeClient({
        req: params.req,
        endpointOption: params.endpointOption,
        signal: job.abortController.signal,
      });

      if (job.abortController.signal.aborted) {
        await GenerationJobManager.completeJob(streamId, 'Request aborted during initialization');
        await decrementPendingRequest(userId);
        return;
      }

      client = initialized.client;

      if (client.sender) {
        GenerationJobManager.updateMetadata(streamId, { sender: client.sender });
      }

      if (client.contentParts) {
        GenerationJobManager.setContentParts(streamId, client.contentParts);
      }

      let userMessage: SavedMessage | undefined;

      const getReqData = (data: { userMessage?: SavedMessage } = {}) => {
        if (data.userMessage) {
          userMessage = data.userMessage;
        }
      };

      try {
        await Promise.race([job.readyPromise, new Promise((resolve) => setTimeout(resolve, 100))]);
      } catch (waitError) {
        logger.warn(
          `[startResumableGeneration] Error waiting for subscriber: ${
            waitError instanceof Error ? waitError.message : String(waitError)
          }`,
        );
      }

      try {
        const onStart = (userMsg: SavedMessage, responseMessageId: string) => {
          userMessage = userMsg;

          const meta: UserMessageMeta = {
            messageId: userMsg.messageId,
            parentMessageId: userMsg.parentMessageId,
            conversationId: userMsg.conversationId,
            text: typeof userMsg.text === 'string' ? userMsg.text : null,
          };

          GenerationJobManager.updateMetadata(streamId, {
            responseMessageId,
            userMessage: meta,
          });

          GenerationJobManager.emitChunk(streamId, {
            created: true,
            message: userMessage,
            streamId,
          });
        };

        const response = await client.sendMessage(params.text, {
          user: userId,
          onStart,
          getReqData,
          isContinued: params.isContinued,
          isRegenerate: params.isRegenerate,
          editedContent: params.editedContent,
          conversationId,
          parentMessageId: params.parentMessageId,
          abortController: job.abortController,
          overrideParentMessageId: params.overrideParentMessageId,
          isEdited: Boolean(params.editedContent),
          userMCPAuthMap: initialized.userMCPAuthMap,
          responseMessageId: params.responseMessageId,
          progressOptions: {
            res: {
              write: () => true,
              end: () => {},
              headersSent: false,
              writableEnded: false,
            },
          },
        });

        const messageId = response.messageId;
        response.endpoint = params.endpointOption.endpoint;

        const databasePromise = response.databasePromise;
        delete response.databasePromise;

        if (!databasePromise) {
          throw new Error('Missing databasePromise from resumable agent response');
        }

        const { conversation: conversationData = {} } = await databasePromise;
        const conversation: ConversationRecord = { ...conversationData };
        conversation.title =
          !conversation.title && conversation.title !== 'New Chat'
            ? null
            : conversation.title || 'New Chat';

        if (params.req.body.files && Array.isArray(client.options.attachments) && userMessage) {
          const files = buildMessageFiles(params.req.body.files, client.options.attachments);
          if (files.length > 0) {
            userMessage.files = files;
          }
          delete userMessage.image_urls;
        }

        const wasAbortedBeforeComplete = job.abortController.signal.aborted;
        const isNewConversation = !params.conversationId || params.conversationId === 'new';
        const shouldGenerateTitle =
          Boolean(params.addTitle) &&
          params.parentMessageId === Constants.NO_PARENT &&
          isNewConversation &&
          !wasAbortedBeforeComplete;

        if (!client.skipSaveUserMessage && userMessage) {
          await params.saveMessage(params.req, userMessage, {
            context:
              'packages/api/src/agents/startResumableGeneration.ts - resumable user message',
          });
        }

        if (client.savedMessageIds && !client.savedMessageIds.has(messageId)) {
          await params.saveMessage(
            params.req,
            { ...response, user: userId, unfinished: wasAbortedBeforeComplete },
            {
              context:
                'packages/api/src/agents/startResumableGeneration.ts - resumable response end',
            },
          );
        }

        const currentJob = await GenerationJobManager.getJob(streamId);
        const jobWasReplaced = !currentJob || currentJob.createdAt !== jobCreatedAt;

        if (jobWasReplaced) {
          logger.debug('[startResumableGeneration] Skipping FINAL emit - job was replaced', {
            streamId,
            originalCreatedAt: jobCreatedAt,
            currentCreatedAt: currentJob?.createdAt,
          });
          await decrementPendingRequest(userId);
          return;
        }

        const finalEvent = {
          final: true,
          conversation,
          title: conversation.title,
          requestMessage: sanitizeMessageForTransmit(userMessage),
          responseMessage: {
            ...response,
            ...(wasAbortedBeforeComplete ? { unfinished: true } : {}),
          },
        };

        logger.debug(
          `[startResumableGeneration] Emitting ${
            wasAbortedBeforeComplete ? 'ABORTED FINAL' : 'FINAL'
          } event`,
          {
            streamId,
            wasAbortedBeforeComplete,
            userMessageId: userMessage?.messageId,
            responseMessageId: response.messageId,
            conversationId: conversation.conversationId,
          },
        );

        await GenerationJobManager.emitDone(streamId, finalEvent);
        await GenerationJobManager.completeJob(
          streamId,
          wasAbortedBeforeComplete ? 'Request aborted' : undefined,
        );
        await decrementPendingRequest(userId);

        if (shouldGenerateTitle && params.addTitle) {
          params
            .addTitle(params.req, {
              text: params.text,
              response,
              client,
            })
            .catch((error) => {
              logger.error('[startResumableGeneration] Error in title generation', error);
            })
            .finally(() => {
              if (client) {
                params.disposeClient(client);
              }
            });
          return;
        }

        if (client) {
          params.disposeClient(client);
        }
      } catch (error) {
        const wasAborted =
          job.abortController.signal.aborted ||
          (error instanceof Error && error.message.includes('abort'));

        if (wasAborted) {
          logger.debug(`[startResumableGeneration] Generation aborted for ${streamId}`);
        } else {
          logger.error(`[startResumableGeneration] Generation error for ${streamId}:`, error);
          await GenerationJobManager.emitError(
            streamId,
            error instanceof Error ? error.message : 'Generation failed',
          );
          await GenerationJobManager.completeJob(
            streamId,
            error instanceof Error ? error.message : 'Generation failed',
          );
        }

        await decrementPendingRequest(userId);

        if (client) {
          params.disposeClient(client);
        }
      }
    } catch (error) {
      logger.error('[startResumableGeneration] Initialization error:', error);
      await GenerationJobManager.emitError(
        streamId,
        error instanceof Error ? error.message : 'Failed to start generation',
      );
      await GenerationJobManager.completeJob(
        streamId,
        error instanceof Error ? error.message : 'Failed to start generation',
      );
      await decrementPendingRequest(userId);

      if (client) {
        params.disposeClient(client);
      }
    }
  };

  startGeneration().catch(async (error) => {
    logger.error(
      `[startResumableGeneration] Unhandled error in background generation: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    await GenerationJobManager.completeJob(
      streamId,
      error instanceof Error ? error.message : 'Unhandled generation error',
    );
    await decrementPendingRequest(userId);
  });

  return {
    streamId,
    conversationId,
    job,
  };
}
