import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { limiterCache } from '~/cache/cacheFactory';
import { removePorts } from '~/utils/ports';

type AdminConvoLimiterUser = {
  _id?: { toString(): string } | string;
  id?: string;
};

type AdminConvoLimiterRequest = Request & {
  user?: AdminConvoLimiterUser;
};

const getAdminConvoLimiterKey = (req: Request): string => {
  const user = (req as AdminConvoLimiterRequest).user;
  const userId = user?._id?.toString() ?? user?.id;

  if (userId) {
    return userId;
  }

  return removePorts(req) ?? 'unknown';
};

export const createAdminConvoLimiter = () =>
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: getAdminConvoLimiterKey,
    store: limiterCache('admin_convo_limiter'),
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited' }),
  });
