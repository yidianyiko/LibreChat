import { logger } from '@librechat/data-schemas';
import { WeChatBridgeRuntime } from '../poller';
import { sendOpenClawTextMessage } from '../openclawClient';

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('../openclawClient', () => ({
  getOpenClawUpdates: jest.fn(),
  sendOpenClawTextMessage: jest.fn(async () => undefined),
}));

type ActiveWeChatBinding = {
  userId: string;
  ilinkUserId: string;
  botToken: string;
  baseUrl: string;
  status: 'healthy';
};

type LibreChatClientMock = {
  getCurrentConversation: jest.Mock<Promise<null>, [string]>;
  createConversation: jest.Mock<Promise<{ conversationId: string }>, [string]>;
  sendMessage: jest.Mock<
    Promise<{
      conversationId: string;
      parentMessageId: string;
      text: string;
      timedOut: boolean;
    }>,
    [string, string]
  >;
};

type TestRuntime = WeChatBridgeRuntime & {
  handlePlainText: (
    binding: ActiveWeChatBinding,
    peerUserId: string,
    contextToken: string | undefined,
    text: string,
  ) => Promise<void>;
  librechatClient: LibreChatClientMock;
};

describe('WeChatBridgeRuntime', () => {
  const mockSendOpenClawTextMessage = sendOpenClawTextMessage as jest.MockedFunction<
    typeof sendOpenClawTextMessage
  >;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('logs and keeps scheduling refreshes when a periodic binding refresh fails', async () => {
    const runtime = new WeChatBridgeRuntime({
      librechatBaseUrl: 'http://localhost:3080',
      internalToken: 'internal-token',
      pollIntervalMs: 100,
      dedupeTtlMs: 1_000,
      bindingRefreshIntervalMs: 1_000,
      longPollTimeoutMs: 1_000,
    });
    const error = new Error('connect ECONNREFUSED 127.0.0.1:3080');
    const refreshSpy = jest
      .spyOn(runtime, 'refreshBindings')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);

    await runtime.start();

    await jest.advanceTimersByTimeAsync(1_000);

    expect(refreshSpy).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('[WeChatBridgeRuntime] Binding refresh failed', error);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(refreshSpy).toHaveBeenCalledTimes(3);

    await runtime.stop();
  });

  it('auto-creates a default conversation before forwarding plain text when no current conversation exists', async () => {
    const runtime = new WeChatBridgeRuntime({
      librechatBaseUrl: 'http://localhost:3080',
      internalToken: 'internal-token',
      pollIntervalMs: 100,
      dedupeTtlMs: 1_000,
      bindingRefreshIntervalMs: 1_000,
      longPollTimeoutMs: 1_000,
    }) as TestRuntime;

    runtime.librechatClient = {
      getCurrentConversation: jest.fn(async () => null),
      createConversation: jest.fn(async () => ({ conversationId: 'conversation-1' })),
      sendMessage: jest.fn(async () => ({
        conversationId: 'conversation-1',
        parentMessageId: 'message-1',
        text: 'assistant reply',
        timedOut: false,
      })),
    };

    await runtime.handlePlainText(
      {
        userId: 'user-1',
        ilinkUserId: 'ilink-user',
        botToken: 'bot-token',
        baseUrl: 'https://redirect.example.com',
        status: 'healthy',
      },
      'ilink-user',
      'context-1',
      'hello',
    );

    expect(runtime.librechatClient.getCurrentConversation).toHaveBeenCalledWith('user-1');
    expect(runtime.librechatClient.createConversation).toHaveBeenCalledWith('user-1');
    expect(runtime.librechatClient.sendMessage).toHaveBeenCalledWith('user-1', 'hello');
    expect(mockSendOpenClawTextMessage).toHaveBeenCalledWith({
      baseUrl: 'https://redirect.example.com',
      botToken: 'bot-token',
      contextToken: 'context-1',
      text: 'assistant reply',
      toUserId: 'ilink-user',
    });
  });
});
