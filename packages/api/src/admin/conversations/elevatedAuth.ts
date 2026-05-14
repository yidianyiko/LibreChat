import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
import type { ServerRequest } from '~/types/http';
import type { AdminConversationReviewConfig } from './config';
import { parseAdminConversationReviewConfig } from './config';

export const ADMIN_CONVO_COOKIE_NAME = 'lc_admin_convo';
export const ADMIN_CONVO_COOKIE_PATH = '/api/admin/conversations';
export const ADMIN_CONVO_SESSION_MAX_AGE_MS = 15 * 60 * 1000;

const ADMIN_CONVO_SCOPE = 'admin.conversations';
const AUTHENTICATION_REQUIRED = { error: 'authentication_required' };

type AdminConvoJwtPayload = JwtPayload & {
  scope: string;
  adminId: string;
  pwVersion: number;
};

export const createElevatedConvoToken = (
  config: AdminConversationReviewConfig,
  adminId: string,
): string =>
  jwt.sign(
    {
      scope: ADMIN_CONVO_SCOPE,
      adminId,
      pwVersion: config.passwordVersion,
    },
    config.sessionSecret,
    { expiresIn: '15m' },
  );

export const getElevatedConvoCookieOptions = (config: AdminConversationReviewConfig) => ({
  httpOnly: true,
  maxAge: ADMIN_CONVO_SESSION_MAX_AGE_MS,
  path: ADMIN_CONVO_COOKIE_PATH,
  sameSite: 'strict' as const,
  secure: config.secureCookie,
});

const getAdminId = (req: ServerRequest): string | null => {
  const userId = req.user?._id;
  if (userId == null) {
    return null;
  }

  return userId.toString();
};

const getCookie = (req: ServerRequest): string | null => {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[ADMIN_CONVO_COOKIE_NAME] ?? null;
};

const verifyElevatedConvoToken = (
  token: string,
  config: AdminConversationReviewConfig,
): AdminConvoJwtPayload | null => {
  try {
    const payload = jwt.verify(token, config.sessionSecret);
    return isAdminConvoJwtPayload(payload) ? payload : null;
  } catch {
    return null;
  }
};

const isAdminConvoJwtPayload = (payload: string | JwtPayload): payload is AdminConvoJwtPayload =>
  typeof payload !== 'string' &&
  typeof payload.scope === 'string' &&
  typeof payload.adminId === 'string' &&
  typeof payload.pwVersion === 'number';

const reject = (res: Response) => res.status(401).json(AUTHENTICATION_REQUIRED);

export const requireElevatedConvoAccess =
  (config: AdminConversationReviewConfig = parseAdminConversationReviewConfig()) =>
  (req: ServerRequest, res: Response, next: NextFunction) => {
    const token = getCookie(req);
    const adminId = getAdminId(req);

    if (!token || !adminId) {
      return reject(res);
    }

    const payload = verifyElevatedConvoToken(token, config);
    if (
      !payload ||
      payload.scope !== ADMIN_CONVO_SCOPE ||
      payload.pwVersion !== config.passwordVersion ||
      payload.adminId !== adminId
    ) {
      return reject(res);
    }

    return next();
  };
