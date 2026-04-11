import type { Express } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWeChatBridgeApi } from './api';
import { WeChatBindSessions } from './bindSessions';
import { getWeChatBridgeConfig } from './config';
import { pollOpenClawQrLogin, startOpenClawQrLogin } from './openclawClient';
import { WeChatBridgeRuntime } from './poller';

const QR_STATUS_TIMEOUT_MS = 1500;

export interface WeChatBridgeServer {
  app: Express;
  close: () => Promise<void>;
  runtime: WeChatBridgeRuntime;
  server: http.Server;
}

function isExecutedDirectly() {
  const entry = process.argv[1];
  if (entry == null) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(entry);
}

export async function startWeChatBridge(): Promise<WeChatBridgeServer> {
  const config = getWeChatBridgeConfig();
  const bindSessions = new WeChatBindSessions(config.bindSessionTtlMs);
  const runtime = new WeChatBridgeRuntime({
    librechatBaseUrl: config.librechatBaseUrl,
    internalToken: config.internalToken,
    pollIntervalMs: config.pollIntervalMs,
    dedupeTtlMs: config.dedupeTtlMs,
    bindingRefreshIntervalMs: config.bindingRefreshIntervalMs,
    longPollTimeoutMs: config.longPollTimeoutMs,
  });

  await runtime.start();

  const app = createWeChatBridgeApi({
    internalToken: config.internalToken,
    createBindSession: async (userId) => {
      const qrLogin = await startOpenClawQrLogin({
        timeoutMs: config.pollIntervalMs,
      });

      return bindSessions.createSession({
        userId,
        qrcode: qrLogin.qrcode,
        qrCodeDataUrl: qrLogin.qrCodeDataUrl,
        currentApiBaseUrl: qrLogin.currentApiBaseUrl,
      });
    },
    getBindSession: async (bindSessionId) => {
      const session = bindSessions.getInternalSession(bindSessionId);
      if (session == null) {
        return null;
      }

      if (session.status !== 'pending') {
        return bindSessions.getSession(bindSessionId);
      }

      const status = await pollOpenClawQrLogin({
        qrcode: session.qrcode,
        baseUrl: session.currentApiBaseUrl,
        timeoutMs: QR_STATUS_TIMEOUT_MS,
      });

      if (status.status === 'scaned_but_redirect' && status.redirectHost != null) {
        bindSessions.updatePendingSession(bindSessionId, {
          currentApiBaseUrl: `https://${status.redirectHost}`,
        });
      } else if (status.status === 'expired') {
        bindSessions.markExpired(bindSessionId);
      } else if (
        status.status === 'confirmed' &&
        status.botToken != null &&
        status.ilinkBotId != null &&
        status.ilinkUserId != null
      ) {
        const updatedBaseUrl = status.baseUrl ?? session.currentApiBaseUrl;
        const response = await fetch(
          new URL('/api/wechat/internal/bindings/complete', config.librechatBaseUrl).toString(),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.internalToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: session.userId,
              ilinkUserId: status.ilinkUserId,
              ilinkBotId: status.ilinkBotId,
              botToken: status.botToken,
              baseUrl: updatedBaseUrl,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to complete binding: ${response.status}`);
        }

        bindSessions.markHealthy(bindSessionId, {
          ilinkBotId: status.ilinkBotId,
          botToken: status.botToken,
          baseUrl: updatedBaseUrl,
          ilinkUserId: status.ilinkUserId,
        });
        await runtime.refreshBindings();
      }

      return bindSessions.getSession(bindSessionId);
    },
    cancelBindSession: async (bindSessionId) => bindSessions.cancelSession(bindSessionId) != null,
  });

  const server = await new Promise<http.Server>((resolve) => {
    const instance = app.listen(config.port, () => {
      resolve(instance);
    });
  });

  const close = async () => {
    await runtime.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error != null) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  };

  return {
    app,
    close,
    runtime,
    server,
  };
}

if (isExecutedDirectly()) {
  void startWeChatBridge();
}
