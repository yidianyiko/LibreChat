import { Constants } from 'librechat-data-provider';
import { GenerationJobManager } from '../../stream';
import { flattenWeChatText } from '../output';
import {
  WeChatMessageOrchestrator,
  type WeChatMessageOrchestratorDependencies,
} from '../orchestrator';

jest.mock('../../stream', () => ({
  GenerationJobManager: {
    abortJob: jest.fn(async () => undefined),
  },
}));

function createDependencies(
  overrides: Partial<WeChatMessageOrchestratorDependencies> = {},
): WeChatMessageOrchestratorDependencies {
  return {
    startResumableGeneration: jest.fn(async () => ({
      streamId: 'stream-1',
      conversationId: 'conversation-1',
      job: { streamId: 'stream-1' },
    })),
    initializeClient: jest.fn(async () => ({
      client: {
        sendMessage: jest.fn(),
      },
    })),
    addTitle: jest.fn(async () => undefined),
    waitForStream: jest.fn(async () => ({
      type: 'done',
      aggregatedContent: [
        { type: 'text', text: 'first block' },
        { type: 'think', think: 'hidden' },
        { type: 'text', text: 'second block' },
      ],
      responseMessageId: 'response-1',
    })),
    ...overrides,
  };
}

describe('WeChat output helpers', () => {
  it('joins visible text parts with blank lines', () => {
    expect(
      flattenWeChatText([
        { type: 'text', text: 'first block' },
        { type: 'think', think: 'hidden' },
        { type: 'text', text: 'second block' },
      ]),
    ).toBe('first block\n\nsecond block');
  });

  it('returns the unsupported-content fallback when no visible text exists', () => {
    expect(flattenWeChatText([{ type: 'image_url', image_url: 'https://example.com/file.png' }])).toBe(
      '本次回复包含暂不支持的内容类型，请到网页端查看',
    );
  });
});

describe('WeChatMessageOrchestrator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('aborts timed out streams and prefers the reconciled parent message id', async () => {
    const deps = createDependencies({
      waitForStream: jest.fn(async () => ({
        type: 'timeout',
        reconciledParentMessageId: 'assistant-parent-2',
      })),
    });
    const orchestrator = new WeChatMessageOrchestrator(deps);

    const result = await orchestrator.sendMessage({
      req: {
        user: { id: 'user-1' },
        body: {},
      },
      text: 'hello',
      conversationId: 'conversation-1',
      parentMessageId: 'assistant-parent-1',
      endpointOption: { endpoint: 'openAI', modelOptions: { model: 'gpt-4o' } },
    });

    expect(deps.startResumableGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'hello',
        conversationId: 'conversation-1',
        parentMessageId: 'assistant-parent-1',
        isContinued: true,
      }),
    );
    expect(deps.waitForStream).toHaveBeenCalledWith('stream-1', 90_000);
    expect(GenerationJobManager.abortJob).toHaveBeenCalledWith('stream-1');
    expect(result).toEqual({
      text: '本次回复超时，请稍后重试',
      nextParentMessageId: 'assistant-parent-2',
      timedOut: true,
    });
  });

  it('flattens terminal content and advances to the response message id', async () => {
    const deps = createDependencies();
    const orchestrator = new WeChatMessageOrchestrator(deps);

    const result = await orchestrator.sendMessage({
      req: {
        user: { id: 'user-1' },
        body: {},
      },
      text: 'continue',
      conversationId: 'conversation-1',
      parentMessageId: Constants.NO_PARENT,
      endpointOption: { endpoint: 'openAI', modelOptions: { model: 'gpt-4o' } },
    });

    expect(result).toEqual({
      text: 'first block\n\nsecond block',
      nextParentMessageId: 'response-1',
      timedOut: false,
    });
  });
});
