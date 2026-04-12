import type { Express } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWeChatBridgeApi } from './api';
import { WeChatBindSessions } from './bindSessions';
import { getWeChatBridgeConfig } from './config';
import { startOpenClawQrLogin } from './openclawClient';
import { createBindSessionStatusResolver } from './bindStatus';
import { WeChatBridgeRuntime } from './poller';

const QR_STATUS_TIMEOUT_MS = 5000;

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

  const getBindSession = createBindSessionStatusResolver({
    bindSessions,
    internalToken: config.internalToken,
    librechatBaseUrl: config.librechatBaseUrl,
    runtime,
    statusTimeoutMs: QR_STATUS_TIMEOUT_MS,
    logError: (message, error) => {
      console.error(message, error);
    },
  });

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
    getBindSession,
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
