import { GenerationJobManager } from '../stream';
import type {
  StartResumableGenerationParams,
  StartResumableGenerationResult,
} from '../agents/startResumableGeneration';
import { flattenWeChatText } from './output';

type WeChatStartParams = Omit<StartResumableGenerationParams, 'disposeClient' | 'saveMessage'>;

type WeChatTimeoutResult = {
  type: 'timeout';
  reconciledParentMessageId?: string | null;
};

type WeChatDoneResult = {
  type: 'done';
  aggregatedContent: Array<Record<string, unknown>>;
  responseMessageId: string;
};

type WeChatTerminalResult = WeChatTimeoutResult | WeChatDoneResult;

export interface WeChatMessageOrchestratorDependencies {
  startResumableGeneration: (params: WeChatStartParams) => Promise<StartResumableGenerationResult>;
  initializeClient: StartResumableGenerationParams['initializeClient'];
  addTitle?: StartResumableGenerationParams['addTitle'];
  waitForStream: (streamId: string, timeoutMs: number) => Promise<WeChatTerminalResult>;
}

type SendWeChatMessageParams = {
  req: StartResumableGenerationParams['req'];
  text: string;
  conversationId: string;
  parentMessageId: string;
  endpointOption: StartResumableGenerationParams['endpointOption'];
};

export class WeChatMessageOrchestrator {
  constructor(private deps: WeChatMessageOrchestratorDependencies) {}

  async sendMessage(params: SendWeChatMessageParams) {
    const started = await this.deps.startResumableGeneration({
      req: params.req,
      initializeClient: this.deps.initializeClient,
      addTitle: this.deps.addTitle,
      text: params.text,
      endpointOption: params.endpointOption,
      conversationId: params.conversationId,
      parentMessageId: params.parentMessageId,
      isContinued: true,
    });

    const terminal = await this.deps.waitForStream(started.streamId, 90_000);
    if (terminal.type === 'timeout') {
      await GenerationJobManager.abortJob(started.streamId);
      return {
        text: '本次回复超时，请稍后重试',
        nextParentMessageId: terminal.reconciledParentMessageId ?? params.parentMessageId,
        timedOut: true,
      };
    }

    return {
      text: flattenWeChatText(terminal.aggregatedContent),
      nextParentMessageId: terminal.responseMessageId,
      timedOut: false,
    };
  }
}
