import { startResumableGeneration } from './startResumableGeneration';

jest.mock('../middleware', () => ({
  decrementPendingRequest: jest.fn(async () => undefined),
}));

jest.mock('../stream', () => {
  const emitter = {
    on: jest.fn(),
  };

  return {
    GenerationJobManager: {
      createJob: jest.fn(async () => ({
        abortController: new AbortController(),
        createdAt: 1,
        emitter,
        readyPromise: Promise.resolve(),
      })),
      updateMetadata: jest.fn(),
      setContentParts: jest.fn(),
      getJob: jest.fn(async () => ({ createdAt: 1 })),
      emitChunk: jest.fn(),
      emitDone: jest.fn(async () => undefined),
      completeJob: jest.fn(async () => undefined),
      getResumeState: jest.fn(async () => null),
    },
  };
});

describe('startResumableGeneration', () => {
  it('populates top-level text from text content parts before saving the final response', async () => {
    const saveMessage = jest.fn(async () => undefined);
    const sendMessage = jest.fn(async (_text: string, options) => {
      options.onStart(
        {
          messageId: 'user-message',
          conversationId: 'conversation-id',
          parentMessageId: '00000000-0000-0000-0000-000000000000',
          text: 'hello',
        },
        'response-message',
        false,
      );

      return {
        messageId: 'response-message',
        conversationId: 'conversation-id',
        parentMessageId: 'user-message',
        sender: 'Deepseek',
        text: '',
        content: [{ type: 'text', text: 'generated text' }],
        databasePromise: Promise.resolve({
          conversation: { conversationId: 'conversation-id', title: 'New Chat' },
        }),
      };
    });

    await startResumableGeneration({
      req: {
        user: { id: 'user-id' },
        body: {},
      } as never,
      initializeClient: jest.fn(async () => ({
        client: {
          sender: 'Deepseek',
          options: {},
          savedMessageIds: new Set(),
          sendMessage,
        },
      })),
      saveMessage,
      disposeClient: jest.fn(),
      text: 'hello',
      endpointOption: {
        endpoint: 'DeepSeek',
        modelOptions: { model: 'deepseek-chat' },
      },
      conversationId: 'conversation-id',
      parentMessageId: '00000000-0000-0000-0000-000000000000',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(saveMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageId: 'response-message',
        text: 'generated text',
      }),
      expect.objectContaining({
        context: 'packages/api/src/agents/startResumableGeneration.ts - resumable response end',
      }),
    );
  });
});
