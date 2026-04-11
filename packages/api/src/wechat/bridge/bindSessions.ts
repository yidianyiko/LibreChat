import crypto from 'node:crypto';

export type WeChatBridgeBindSessionStatus =
  | 'pending'
  | 'healthy'
  | 'expired'
  | 'cancelled'
  | 'reauth_required';

interface InternalBindSession {
  bindSessionId: string;
  userId: string;
  qrcode: string;
  qrCodeDataUrl: string;
  status: WeChatBridgeBindSessionStatus;
  currentApiBaseUrl: string;
  createdAt: Date;
  expiresAt: Date;
  ilinkBotId?: string;
  botToken?: string;
  baseUrl?: string;
  ilinkUserId?: string;
}

export interface WeChatBridgeBindSession {
  bindSessionId: string;
  userId: string;
  qrCodeDataUrl: string;
  status: WeChatBridgeBindSessionStatus;
  expiresAt: string;
  createdAt: string;
}

function toPublicSession(session: InternalBindSession): WeChatBridgeBindSession {
  return {
    bindSessionId: session.bindSessionId,
    userId: session.userId,
    qrCodeDataUrl: session.qrCodeDataUrl,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  };
}

export class WeChatBindSessions {
  private sessions = new Map<string, InternalBindSession>();

  constructor(private readonly ttlMs: number) {}

  private purgeExpired() {
    const now = Date.now();
    for (const [bindSessionId, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now && session.status === 'pending') {
        session.status = 'expired';
      }

      if (session.expiresAt.getTime() + this.ttlMs <= now) {
        this.sessions.delete(bindSessionId);
      }
    }
  }

  createSession(input: {
    userId: string;
    qrcode: string;
    qrCodeDataUrl: string;
    currentApiBaseUrl: string;
  }): WeChatBridgeBindSession {
    this.purgeExpired();

    const createdAt = new Date();
    const session: InternalBindSession = {
      bindSessionId: crypto.randomUUID(),
      userId: input.userId,
      qrcode: input.qrcode,
      qrCodeDataUrl: input.qrCodeDataUrl,
      status: 'pending',
      currentApiBaseUrl: input.currentApiBaseUrl,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + this.ttlMs),
    };

    this.sessions.set(session.bindSessionId, session);
    return toPublicSession(session);
  }

  getSession(bindSessionId: string): WeChatBridgeBindSession | null {
    const session = this.getInternalSession(bindSessionId);
    return session == null ? null : toPublicSession(session);
  }

  getInternalSession(bindSessionId: string): InternalBindSession | null {
    this.purgeExpired();
    return this.sessions.get(bindSessionId) ?? null;
  }

  updatePendingSession(
    bindSessionId: string,
    update: Partial<Pick<InternalBindSession, 'currentApiBaseUrl' | 'status'>>,
  ): WeChatBridgeBindSession | null {
    const session = this.getInternalSession(bindSessionId);
    if (session == null) {
      return null;
    }

    Object.assign(session, update);
    return toPublicSession(session);
  }

  markHealthy(
    bindSessionId: string,
    input: {
      ilinkBotId: string;
      botToken: string;
      baseUrl: string;
      ilinkUserId: string;
    },
  ): WeChatBridgeBindSession | null {
    const session = this.getInternalSession(bindSessionId);
    if (session == null) {
      return null;
    }

    session.status = 'healthy';
    session.ilinkBotId = input.ilinkBotId;
    session.botToken = input.botToken;
    session.baseUrl = input.baseUrl;
    session.ilinkUserId = input.ilinkUserId;
    return toPublicSession(session);
  }

  markExpired(bindSessionId: string): WeChatBridgeBindSession | null {
    const session = this.getInternalSession(bindSessionId);
    if (session == null) {
      return null;
    }

    session.status = 'expired';
    return toPublicSession(session);
  }

  cancelSession(bindSessionId: string): WeChatBridgeBindSession | null {
    const session = this.getInternalSession(bindSessionId);
    if (session == null) {
      return null;
    }

    session.status = 'cancelled';
    return toPublicSession(session);
  }
}
