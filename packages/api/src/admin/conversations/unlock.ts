import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { AdminConversationReviewConfig } from './config';
import { parseAdminConversationReviewConfig } from './config';
import {
  ADMIN_CONVO_COOKIE_NAME,
  ADMIN_CONVO_COOKIE_PATH,
  createElevatedConvoToken,
  getElevatedConvoCookieOptions,
} from './elevatedAuth';

const AUTHENTICATION_REQUIRED = { error: 'authentication_required' };
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

type LockoutEntry = {
  attempts: number[];
};

export type AdminConvoLockoutStore = {
  isLocked(adminId: string, now?: number): boolean;
  recordFailure(adminId: string, now?: number): void;
  reset(adminId: string): void;
};

export const createAdminConvoLockoutStore = (): AdminConvoLockoutStore => {
  const entries = new Map<string, LockoutEntry>();

  const prune = (adminId: string, now: number): LockoutEntry => {
    const entry = entries.get(adminId) ?? { attempts: [] };
    const cutoff = now - LOCKOUT_WINDOW_MS;
    entry.attempts = entry.attempts.filter((attempt) => attempt > cutoff);
    entries.set(adminId, entry);
    return entry;
  };

  return {
    isLocked(adminId: string, now = Date.now()): boolean {
      return prune(adminId, now).attempts.length >= LOCKOUT_MAX_ATTEMPTS;
    },
    recordFailure(adminId: string, now = Date.now()): void {
      const entry = prune(adminId, now);
      entry.attempts = [...entry.attempts, now];
      entries.set(adminId, entry);
    },
    reset(adminId: string): void {
      entries.delete(adminId);
    },
  };
};

const defaultLockoutStore = createAdminConvoLockoutStore();

const getAdminId = (req: ServerRequest): string | null => {
  const userId = req.user?._id;
  if (userId == null) {
    return null;
  }

  return userId.toString();
};

const getPassword = (req: ServerRequest): string | null => {
  const body = req.body as { password?: unknown } | undefined;
  return typeof body?.password === 'string' ? body.password : null;
};

const reject = (res: Response) => res.status(401).json(AUTHENTICATION_REQUIRED);

export const handleUnlock =
  (
    config: AdminConversationReviewConfig = parseAdminConversationReviewConfig(),
    lockoutStore: AdminConvoLockoutStore = defaultLockoutStore,
  ) =>
  async (req: ServerRequest, res: Response) => {
    const adminId = getAdminId(req);
    const password = getPassword(req);

    if (!adminId || !password || lockoutStore.isLocked(adminId)) {
      return reject(res);
    }

    const passwordMatches = await bcrypt.compare(password, config.passwordHash);
    if (!passwordMatches) {
      lockoutStore.recordFailure(adminId);
      return reject(res);
    }

    lockoutStore.reset(adminId);
    res.cookie(
      ADMIN_CONVO_COOKIE_NAME,
      createElevatedConvoToken(config, adminId),
      getElevatedConvoCookieOptions(config),
    );
    return res.status(200).json({ ok: true });
  };

export const handleLock =
  (config?: AdminConversationReviewConfig) => (_req: ServerRequest, res: Response) => {
    res.clearCookie(ADMIN_CONVO_COOKIE_NAME, {
      httpOnly: true,
      path: ADMIN_CONVO_COOKIE_PATH,
      sameSite: 'strict',
      secure: config?.secureCookie,
    });
    return res.status(204).send();
  };
