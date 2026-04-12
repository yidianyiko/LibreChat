import express from 'express';
import { createRequireWeChatBridgeAuth } from '../internalAuth';
import type { WeChatBridgeBindSession } from './bindSessions';

interface CreateWeChatBridgeApiParams {
  internalToken: string;
  createBindSession: (userId: string) => Promise<WeChatBridgeBindSession>;
  getBindSession: (bindSessionId: string) => Promise<WeChatBridgeBindSession | null>;
  cancelBindSession: (bindSessionId: string) => Promise<boolean>;
}

export function createWeChatBridgeApi(params: CreateWeChatBridgeApiParams) {
  const app = express();
  const requireBridgeAuth = createRequireWeChatBridgeAuth(params.internalToken);

  app.use(express.json());
  app.use(requireBridgeAuth);

  app.post('/bind-sessions', async (req, res) => {
    const userId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    if (userId.length === 0) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    const session = await params.createBindSession(userId);
    res.status(201).json({ data: session });
  });

  app.get('/bind-sessions/:bindSessionId', async (req, res) => {
    const session = await params.getBindSession(req.params.bindSessionId);
    if (session == null) {
      return res.status(404).json({ message: 'Bind session not found' });
    }

    res.json({ data: session });
  });

  app.delete('/bind-sessions/:bindSessionId', async (req, res) => {
    const cancelled = await params.cancelBindSession(req.params.bindSessionId);
    if (!cancelled) {
      return res.status(404).json({ message: 'Bind session not found' });
    }

    res.status(204).send();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('WeChat bridge API error', error);
    if (res.headersSent) {
      return;
    }

    res.status(500).json({ message: 'Internal bridge error' });
  });

  return app;
}
