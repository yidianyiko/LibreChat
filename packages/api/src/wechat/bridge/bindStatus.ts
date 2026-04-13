import { getWeChatWelcomeMessage } from './commands';
import type { WeChatBridgeBindSession, WeChatBindSessions } from './bindSessions';
import { sendOpenClawTextMessage } from './openclawClient';
import { pollOpenClawQrLogin } from './openclawClient';

export interface ResolveBindSessionParams {
  bindSessionId: string;
  bindSessions: WeChatBindSessions;
  fetchImpl?: typeof fetch;
  internalToken: string;
  librechatBaseUrl: string;
  logError?: (message: string, error: unknown) => void;
  pollQrLogin?: typeof pollOpenClawQrLogin;
  runtime: {
    refreshBindings: () => Promise<void>;
  };
  sendTextMessage?: typeof sendOpenClawTextMessage;
  statusTimeoutMs: number;
}

export interface CreateBindSessionStatusResolverParams
  extends Omit<ResolveBindSessionParams, 'bindSessionId'> {
  logError?: (message: string, error: unknown) => void;
  resolveBindSessionFn?: (params: ResolveBindSessionParams) => Promise<WeChatBridgeBindSession | null>;
}

function buildCompleteBindingRequest(params: {
  internalToken: string;
  librechatBaseUrl: string;
  userId: string;
  ilinkUserId: string;
  ilinkBotId: string;
  botToken: string;
  baseUrl: string;
}) {
  return {
    url: new URL('/api/wechat/internal/bindings/complete', params.librechatBaseUrl).toString(),
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.internalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: params.userId,
        ilinkUserId: params.ilinkUserId,
        ilinkBotId: params.ilinkBotId,
        botToken: params.botToken,
        baseUrl: params.baseUrl,
      }),
    } satisfies RequestInit,
  };
}

function getCurrentSession(
  bindSessions: WeChatBindSessions,
  bindSessionId: string,
): WeChatBridgeBindSession | null {
  return bindSessions.getSession(bindSessionId);
}

function buildCreateConversationRequest(params: {
  internalToken: string;
  librechatBaseUrl: string;
  userId: string;
}) {
  return {
    url: new URL('/api/wechat/conversations/new', params.librechatBaseUrl).toString(),
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.internalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: params.userId,
      }),
    } satisfies RequestInit,
  };
}

export async function resolveBindSession(
  params: ResolveBindSessionParams,
): Promise<WeChatBridgeBindSession | null> {
  const session = params.bindSessions.getInternalSession(params.bindSessionId);
  if (session == null) {
    return null;
  }

  if (session.status !== 'pending') {
    return getCurrentSession(params.bindSessions, params.bindSessionId);
  }

  const pollQrLogin = params.pollQrLogin ?? pollOpenClawQrLogin;
  const fetchImpl = params.fetchImpl ?? fetch;
  const sendTextMessage = params.sendTextMessage ?? sendOpenClawTextMessage;

  try {
    const status = await pollQrLogin({
      qrcode: session.qrcode,
      baseUrl: session.currentApiBaseUrl,
      timeoutMs: params.statusTimeoutMs,
    });

    if (status.status === 'scaned_but_redirect' && status.redirectHost != null) {
      params.bindSessions.updatePendingSession(params.bindSessionId, {
        currentApiBaseUrl: `https://${status.redirectHost}`,
      });
      return getCurrentSession(params.bindSessions, params.bindSessionId);
    }

    if (status.status === 'expired') {
      params.bindSessions.markExpired(params.bindSessionId);
      return getCurrentSession(params.bindSessions, params.bindSessionId);
    }

    if (
      status.status !== 'confirmed' ||
      status.botToken == null ||
      status.ilinkBotId == null ||
      status.ilinkUserId == null
    ) {
      return getCurrentSession(params.bindSessions, params.bindSessionId);
    }

    const updatedBaseUrl = status.baseUrl ?? session.currentApiBaseUrl;
    const request = buildCompleteBindingRequest({
      internalToken: params.internalToken,
      librechatBaseUrl: params.librechatBaseUrl,
      userId: session.userId,
      ilinkUserId: status.ilinkUserId,
      ilinkBotId: status.ilinkBotId,
      botToken: status.botToken,
      baseUrl: updatedBaseUrl,
    });
    const response = await fetchImpl(request.url, request.init);

    if (!response.ok) {
      return getCurrentSession(params.bindSessions, params.bindSessionId);
    }

    params.bindSessions.markHealthy(params.bindSessionId, {
      ilinkBotId: status.ilinkBotId,
      botToken: status.botToken,
      baseUrl: updatedBaseUrl,
      ilinkUserId: status.ilinkUserId,
    });

    await params.runtime.refreshBindings();

    try {
      const createConversationRequest = buildCreateConversationRequest({
        internalToken: params.internalToken,
        librechatBaseUrl: params.librechatBaseUrl,
        userId: session.userId,
      });
      const createConversationResponse = await fetchImpl(
        createConversationRequest.url,
        createConversationRequest.init,
      );

      if (!createConversationResponse.ok) {
        throw new Error('Failed to create WeChat default conversation');
      }

      await sendTextMessage({
        baseUrl: updatedBaseUrl,
        botToken: status.botToken,
        toUserId: status.ilinkUserId,
        text: getWeChatWelcomeMessage(),
      });
    } catch (error) {
      params.logError?.('Failed to initialize WeChat default conversation', error);
    }

    return getCurrentSession(params.bindSessions, params.bindSessionId);
  } catch {
    return getCurrentSession(params.bindSessions, params.bindSessionId);
  }
}

export function createBindSessionStatusResolver(
  params: CreateBindSessionStatusResolverParams,
) {
  return async (bindSessionId: string): Promise<WeChatBridgeBindSession | null> => {
    try {
      const resolveFn = params.resolveBindSessionFn ?? resolveBindSession;
      return await resolveFn({
        bindSessionId,
        bindSessions: params.bindSessions,
        internalToken: params.internalToken,
        librechatBaseUrl: params.librechatBaseUrl,
        logError: params.logError,
        pollQrLogin: params.pollQrLogin,
        fetchImpl: params.fetchImpl,
        runtime: params.runtime,
        sendTextMessage: params.sendTextMessage,
        statusTimeoutMs: params.statusTimeoutMs,
      });
    } catch (error) {
      params.logError?.('Failed to resolve bind session status', error);
      return params.bindSessions.getSession(bindSessionId);
    }
  };
}
