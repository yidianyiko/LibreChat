import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function createRequireWeChatBridgeAuth(expectedToken: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Missing bridge authorization' });
      return;
    }

    const token = auth.slice('Bearer '.length);
    if (!expectedToken || token !== expectedToken) {
      res.status(401).json({ message: 'Invalid bridge authorization' });
      return;
    }

    next();
  };
}
