import { WeChatBindSessions } from '../bindSessions';
import { createBindSessionStatusResolver, resolveBindSession } from '../bindStatus';

describe('resolveBindSession', () => {
  it('keeps the bind session pending when QR status polling fails transiently', async () => {
    const bindSessions = new WeChatBindSessions(5 * 60 * 1000);
    const session = bindSessions.createSession({
      userId: 'user-1',
      qrcode: 'qr-code-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      currentApiBaseUrl: 'https://ilinkai.weixin.qq.com',
    });
    const runtime = {
      refreshBindings: jest.fn(async () => undefined),
    };

    const result = await resolveBindSession({
      bindSessionId: session.bindSessionId,
      bindSessions,
      internalToken: 'internal-token',
      librechatBaseUrl: 'http://127.0.0.1:3081',
      runtime,
      fetchImpl: jest.fn(),
      pollQrLogin: jest.fn(async () => {
        throw new Error('AbortError');
      }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        bindSessionId: session.bindSessionId,
        status: 'pending',
      }),
    );
    expect(runtime.refreshBindings).not.toHaveBeenCalled();
  });

  it('keeps the bind session pending when writing the confirmed binding back to LibreChat fails', async () => {
    const bindSessions = new WeChatBindSessions(5 * 60 * 1000);
    const session = bindSessions.createSession({
      userId: 'user-1',
      qrcode: 'qr-code-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      currentApiBaseUrl: 'https://ilinkai.weixin.qq.com',
    });
    const runtime = {
      refreshBindings: jest.fn(async () => undefined),
    };
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 500 }));

    const result = await resolveBindSession({
      bindSessionId: session.bindSessionId,
      bindSessions,
      internalToken: 'internal-token',
      librechatBaseUrl: 'http://127.0.0.1:3081',
      runtime,
      fetchImpl,
      pollQrLogin: jest.fn(async () => ({
        status: 'confirmed',
        botToken: 'bot-token',
        ilinkBotId: 'bot-id',
        ilinkUserId: 'ilink-user',
        baseUrl: 'https://redirect.example.com',
      })),
    });

    expect(result).toEqual(
      expect.objectContaining({
        bindSessionId: session.bindSessionId,
        status: 'pending',
      }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(runtime.refreshBindings).not.toHaveBeenCalled();
  });


  it('returns the last public bind session when the resolver throws unexpectedly', async () => {
    const bindSessions = new WeChatBindSessions(5 * 60 * 1000);
    const session = bindSessions.createSession({
      userId: 'user-1',
      qrcode: 'qr-code-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      currentApiBaseUrl: 'https://ilinkai.weixin.qq.com',
    });
    const logError = jest.fn();
    const resolver = createBindSessionStatusResolver({
      bindSessions,
      internalToken: 'internal-token',
      librechatBaseUrl: 'http://127.0.0.1:3081',
      runtime: { refreshBindings: jest.fn(async () => undefined) },
      statusTimeoutMs: 5000,
      resolveBindSessionFn: jest.fn(async () => {
        throw new Error('boom');
      }),
      logError,
    });

    const result = await resolver(session.bindSessionId);

    expect(result).toEqual(
      expect.objectContaining({
        bindSessionId: session.bindSessionId,
        status: 'pending',
      }),
    );
    expect(logError).toHaveBeenCalledWith('Failed to resolve bind session status', expect.any(Error));
  });

  it('marks the bind session healthy and refreshes runtime bindings when confirmation succeeds', async () => {
    const bindSessions = new WeChatBindSessions(5 * 60 * 1000);
    const session = bindSessions.createSession({
      userId: 'user-1',
      qrcode: 'qr-code-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      currentApiBaseUrl: 'https://ilinkai.weixin.qq.com',
    });
    const runtime = {
      refreshBindings: jest.fn(async () => undefined),
    };

    const result = await resolveBindSession({
      bindSessionId: session.bindSessionId,
      bindSessions,
      internalToken: 'internal-token',
      librechatBaseUrl: 'http://127.0.0.1:3081',
      runtime,
      fetchImpl: jest.fn(async () => ({ ok: true, status: 204 })),
      pollQrLogin: jest.fn(async () => ({
        status: 'confirmed',
        botToken: 'bot-token',
        ilinkBotId: 'bot-id',
        ilinkUserId: 'ilink-user',
        baseUrl: 'https://redirect.example.com',
      })),
    });

    expect(result).toEqual(
      expect.objectContaining({
        bindSessionId: session.bindSessionId,
        status: 'healthy',
      }),
    );
    expect(runtime.refreshBindings).toHaveBeenCalledTimes(1);
  });

  it('creates a default conversation and sends the first welcome message after bind success', async () => {
    const bindSessions = new WeChatBindSessions(5 * 60 * 1000);
    const session = bindSessions.createSession({
      userId: 'user-1',
      qrcode: 'qr-code-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      currentApiBaseUrl: 'https://ilinkai.weixin.qq.com',
    });
    const runtime = {
      refreshBindings: jest.fn(async () => undefined),
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const sendTextMessage = jest.fn(async () => undefined);

    const result = await resolveBindSession({
      bindSessionId: session.bindSessionId,
      bindSessions,
      internalToken: 'internal-token',
      librechatBaseUrl: 'http://127.0.0.1:3081',
      runtime,
      fetchImpl,
      sendTextMessage,
      pollQrLogin: jest.fn(async () => ({
        status: 'confirmed',
        botToken: 'bot-token',
        ilinkBotId: 'bot-id',
        ilinkUserId: 'ilink-user',
        baseUrl: 'https://redirect.example.com',
      })),
    });

    expect(result).toEqual(
      expect.objectContaining({
        bindSessionId: session.bindSessionId,
        status: 'healthy',
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3081/api/wechat/conversations/new',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1' }),
      }),
    );
    expect(sendTextMessage).toHaveBeenCalledWith({
      baseUrl: 'https://redirect.example.com',
      botToken: 'bot-token',
      toUserId: 'ilink-user',
      text: 'hi, 终于可以在微信上也和你聊天啦！如果你想创建一个新对话，可以试试在对话框输入 /new, 如果想找到之前的对话可以先输入 /list，再输入你想继续的某条对话，比如 /switch 1',
    });
  });
});
