import { logger } from '@librechat/data-schemas';
import { WeChatBridgeRuntime } from '../poller';

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('WeChatBridgeRuntime', () => {
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
});
