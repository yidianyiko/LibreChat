import { waitForWeChatTerminalResult } from '../waitForStream';

describe('waitForWeChatTerminalResult', () => {
  it('does not return early when aggregated content is still growing', async () => {
    let attempt = 0;

    const result = await waitForWeChatTerminalResult({
      streamId: 'stream-1',
      timeoutMs: 1000,
      noParentMessageId: 'no-parent',
      getJob: async () => {
        attempt += 1;

        if (attempt < 3) {
          return { status: 'running' };
        }

        return undefined;
      },
      getJobStatus: async () => undefined,
      getResumeState: async () => {
        if (attempt === 1) {
          return {
            responseMessageId: 'response-1',
            aggregatedContent: [{ type: 'text', text: '本地链路' }],
          };
        }

        if (attempt === 2) {
          return {
            responseMessageId: 'response-1',
            aggregatedContent: [{ type: 'text', text: '本地链路正常。' }],
          };
        }

        return null;
      },
      sleep: async () => undefined,
    });

    expect(result).toEqual({
      type: 'done',
      responseMessageId: 'response-1',
      aggregatedContent: [{ type: 'text', text: '本地链路正常。' }],
    });
    expect(attempt).toBe(3);
  });

  it('returns the final done event even when resume state never accumulates content', async () => {
    let emitDone;

    const resultPromise = waitForWeChatTerminalResult({
      streamId: 'stream-1',
      timeoutMs: 1000,
      noParentMessageId: 'no-parent',
      getJob: async () => ({ status: 'running' }),
      getJobStatus: async () => 'running',
      getResumeState: async () => null,
      subscribe: async (_streamId, onDone) => {
        emitDone = onDone;
        return { unsubscribe: () => undefined };
      },
      sleep: async () => {
        emitDone?.({
          final: true,
          responseMessage: {
            messageId: 'response-1',
            content: [{ type: 'text', text: 'done from final event' }],
          },
        });
      },
    });

    await expect(resultPromise).resolves.toEqual({
      type: 'done',
      responseMessageId: 'response-1',
      aggregatedContent: [{ type: 'text', text: 'done from final event' }],
    });
  });

  it('waits for aggregated content when only the response message id is available at first', async () => {
    let attempt = 0;

    const result = await waitForWeChatTerminalResult({
      streamId: 'stream-1',
      timeoutMs: 1000,
      noParentMessageId: 'no-parent',
      getJob: async () => undefined,
      getJobStatus: async () => undefined,
      getResumeState: async () => {
        attempt += 1;

        return attempt === 1
          ? { responseMessageId: 'response-1', aggregatedContent: [] }
          : {
              responseMessageId: 'response-1',
              aggregatedContent: [{ type: 'text', text: 'done later' }],
            };
      },
      sleep: async () => undefined,
    });

    expect(result).toEqual({
      type: 'done',
      responseMessageId: 'response-1',
      aggregatedContent: [{ type: 'text', text: 'done later' }],
    });
    expect(attempt).toBeGreaterThanOrEqual(2);
  });

  it('returns done when resumeState already has the response after the job record is gone', async () => {
    const result = await waitForWeChatTerminalResult({
      streamId: 'stream-1',
      timeoutMs: 1000,
      noParentMessageId: 'no-parent',
      getJob: async () => undefined,
      getJobStatus: async () => undefined,
      getResumeState: async () => ({
        responseMessageId: 'response-1',
        aggregatedContent: [{ type: 'text', text: 'done' }],
      }),
      sleep: async () => undefined,
    });

    expect(result).toEqual({
      type: 'done',
      responseMessageId: 'response-1',
      aggregatedContent: [{ type: 'text', text: 'done' }],
    });
  });
});
