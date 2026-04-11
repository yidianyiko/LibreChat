import type { NextFunction, Request, Response } from 'express';

export function createRequireWeChatBridgeAuth(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing bridge authorization' });
    }

    const token = auth.slice('Bearer '.length);
    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({ message: 'Invalid bridge authorization' });
    }

    next();
  };
}
