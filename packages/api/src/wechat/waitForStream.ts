import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import type { FinalEvent } from '../types/events';

type WeChatJobStatus = 'running' | 'complete' | 'error' | 'aborted' | undefined;

type WaitForWeChatJob = {
  status?: WeChatJobStatus;
  error?: string | null;
  finalEvent?: string | null;
};

type WaitForWeChatResumeState = {
  aggregatedContent?: TMessageContentParts[];
  responseMessageId?: string | null;
};

type WaitForWeChatSubscription = {
  unsubscribe: () => void;
};

export type WeChatTimeoutResult = {
  type: 'timeout';
  reconciledParentMessageId?: string | null;
};

export type WeChatDoneResult = {
  type: 'done';
  aggregatedContent: TMessageContentParts[];
  responseMessageId: string;
};

export type WeChatTerminalResult = WeChatTimeoutResult | WeChatDoneResult;

type WaitForWeChatTerminalParams = {
  streamId: string;
  timeoutMs: number;
  noParentMessageId: string;
  getJob: (streamId: string) => Promise<WaitForWeChatJob | undefined>;
  getJobStatus: (streamId: string) => Promise<WeChatJobStatus>;
  getResumeState: (streamId: string) => Promise<WaitForWeChatResumeState | null>;
  subscribe?: (
    streamId: string,
    onDone: (event: FinalEvent) => void,
    onError: (error: string) => void,
  ) => Promise<WaitForWeChatSubscription | null>;
  sleep?: (ms: number) => Promise<void>;
};

function hasAggregatedContent(
  resumeState: WaitForWeChatResumeState | null,
): resumeState is WaitForWeChatResumeState & { aggregatedContent: TMessageContentParts[] } {
  return (resumeState?.aggregatedContent?.length ?? 0) > 0;
}

function toDoneResult(
  resumeState: WaitForWeChatResumeState & { aggregatedContent: TMessageContentParts[] },
  noParentMessageId: string,
): WeChatDoneResult {
  return {
    type: 'done',
    aggregatedContent: resumeState.aggregatedContent,
    responseMessageId: resumeState.responseMessageId ?? noParentMessageId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createTextFallbackContent(text: string): TMessageContentParts[] {
  const part: TMessageContentParts = {
    type: ContentTypes.TEXT,
    text,
  };

  return [part];
}

function parseFinalEventInput(value: string | FinalEvent | null | undefined): FinalEvent | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) && parsed.final === true ? (parsed as FinalEvent) : null;
  } catch {
    return null;
  }
}

function getDoneResultFromFinalEvent(
  finalEvent: string | FinalEvent | null | undefined,
  noParentMessageId: string,
): WeChatDoneResult | null {
  const parsed = parseFinalEventInput(finalEvent);
  if (!parsed || !isRecord(parsed.responseMessage)) {
    return null;
  }

  const responseText =
    typeof parsed.responseMessage.text === 'string' ? parsed.responseMessage.text.trim() : '';
  const aggregatedContent = Array.isArray(parsed.responseMessage.content)
    ? (parsed.responseMessage.content as TMessageContentParts[])
    : responseText.length > 0
      ? createTextFallbackContent(responseText)
      : [];

  return {
    type: 'done',
    aggregatedContent,
    responseMessageId:
      typeof parsed.responseMessage.messageId === 'string' && parsed.responseMessage.messageId.length > 0
        ? parsed.responseMessage.messageId
        : noParentMessageId,
  };
}

export async function waitForWeChatTerminalResult(
  params: WaitForWeChatTerminalParams,
): Promise<WeChatTerminalResult> {
  const sleep = params.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutAt = Date.now() + params.timeoutMs;
  let latestResumeResult: WeChatDoneResult | null = null;
  let latestFinalEventResult: WeChatDoneResult | null = null;
  let subscriptionResult: WeChatDoneResult | null = null;
  let subscriptionError: Error | null = null;
  let unsubscribe: (() => void) | null = null;

  try {
    if (params.subscribe) {
      const subscription = await params.subscribe(
        params.streamId,
        (event) => {
          subscriptionResult = getDoneResultFromFinalEvent(event, params.noParentMessageId);
        },
        (error) => {
          subscriptionError = new Error(error);
        },
      );
      unsubscribe = subscription?.unsubscribe ?? null;
    }

    while (Date.now() < timeoutAt) {
      if (subscriptionError) {
        throw subscriptionError;
      }

      if (subscriptionResult) {
        return subscriptionResult;
      }

      const job = await params.getJob(params.streamId);
      const status = job?.status ?? (await params.getJobStatus(params.streamId));
      const resumeState = await params.getResumeState(params.streamId);

      if (status === 'error' || status === 'aborted') {
        throw new Error(job?.error || 'Generation failed');
      }

      if (hasAggregatedContent(resumeState)) {
        latestResumeResult = toDoneResult(resumeState, params.noParentMessageId);
      }

      const finalEventResult = getDoneResultFromFinalEvent(job?.finalEvent, params.noParentMessageId);
      if (finalEventResult) {
        latestFinalEventResult = finalEventResult;
      }

      if (status === 'complete') {
        return (
          subscriptionResult ??
          latestFinalEventResult ??
          latestResumeResult ?? {
            type: 'done',
            aggregatedContent: [],
            responseMessageId: params.noParentMessageId,
          }
        );
      }

      if (job == null && status === undefined) {
        if (subscriptionResult) {
          return subscriptionResult;
        }

        if (hasAggregatedContent(resumeState)) {
          return toDoneResult(resumeState, params.noParentMessageId);
        }

        if (latestFinalEventResult) {
          return latestFinalEventResult;
        }

        if (latestResumeResult) {
          return latestResumeResult;
        }
      }

      await sleep(250);
    }

    if (subscriptionError) {
      throw subscriptionError;
    }

    if (subscriptionResult) {
      return subscriptionResult;
    }

    const resumeState = await params.getResumeState(params.streamId);
    return {
      type: 'timeout',
      reconciledParentMessageId:
        resumeState?.responseMessageId ??
        latestFinalEventResult?.responseMessageId ??
        latestResumeResult?.responseMessageId ??
        null,
    };
  } finally {
    unsubscribe?.();
  }
}
