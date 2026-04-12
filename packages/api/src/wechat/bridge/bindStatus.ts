import type { WeChatBridgeBindSession, WeChatBindSessions } from './bindSessions';
import { pollOpenClawQrLogin } from './openclawClient';

export interface ResolveBindSessionParams {
  bindSessionId: string;
  bindSessions: WeChatBindSessions;
  fetchImpl?: typeof fetch;
  internalToken: string;
  librechatBaseUrl: string;
  pollQrLogin?: typeof pollOpenClawQrLogin;
  runtime: {
    refreshBindings: () => Promise<void>;
  };
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
        pollQrLogin: params.pollQrLogin,
        fetchImpl: params.fetchImpl,
        runtime: params.runtime,
        statusTimeoutMs: params.statusTimeoutMs,
      });
    } catch (error) {
      params.logError?.('Failed to resolve bind session status', error);
      return params.bindSessions.getSession(bindSessionId);
    }
  };
}
