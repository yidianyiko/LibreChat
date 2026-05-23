import crypto from 'node:crypto';
import openclawWeixinPackage from '@tencent-weixin/openclaw-weixin/package.json';

const DEFAULT_LOGIN_BASE_URL = 'https://ilinkai.weixin.qq.com';
const DEFAULT_LOGIN_BOT_TYPE = '3';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const TEXT_ITEM_TYPE = 1;
const BOT_MESSAGE_TYPE = 2;
const MESSAGE_STATE_FINISH = 2;
const DEFAULT_BOT_AGENT = 'OpenClaw';
const BOT_AGENT_MAX_LEN = 256;

interface OpenClawWeixinPackage {
  version?: string;
  ilink_appid?: string;
}

interface BaseInfo {
  channel_version: string;
  bot_agent: string;
}

const openclawWeixinMetadata = openclawWeixinPackage as OpenClawWeixinPackage;
const ilinkAppId = openclawWeixinMetadata.ilink_appid ?? 'bot';
const channelVersion = openclawWeixinMetadata.version ?? 'unknown';

interface RequestOptions {
  baseUrl: string;
  body?: Record<string, unknown>;
  botToken?: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  timeoutMs?: number;
}

export interface OpenClawTextItem {
  text?: string;
}

export interface OpenClawVoiceItem {
  text?: string;
}

export interface OpenClawMessageItem {
  type?: number;
  text_item?: OpenClawTextItem;
  voice_item?: OpenClawVoiceItem;
}

export interface OpenClawInboundMessage {
  seq?: number;
  message_id?: number;
  client_id?: string;
  from_user_id?: string;
  to_user_id?: string;
  create_time_ms?: number;
  update_time_ms?: number;
  context_token?: string;
  item_list?: OpenClawMessageItem[];
}

export interface OpenClawGetUpdatesResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: OpenClawInboundMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

export interface OpenClawQrLoginSession {
  qrcode: string;
  qrCodeDataUrl: string;
  currentApiBaseUrl: string;
}

export interface OpenClawQrStatus {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired' | 'scaned_but_redirect';
  botToken?: string;
  ilinkBotId?: string;
  baseUrl?: string;
  ilinkUserId?: string;
  redirectHost?: string;
}

function ensureTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function randomWechatUin(): string {
  const value = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(value), 'utf-8').toString('base64');
}

function buildClientVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number.parseInt(part, 10));

  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

function sanitizeBotAgent(raw: string | undefined): string {
  if (raw == null || raw.trim().length === 0) {
    return DEFAULT_BOT_AGENT;
  }

  const productPattern = /^[A-Za-z0-9_.-]{1,32}\/[A-Za-z0-9_.+-]{1,32}$/;
  const commentPattern = /^[\x20-\x27\x2A-\x7E]{1,64}$/;
  const tokens = raw.trim().split(/\s+/);
  const accepted: string[] = [];
  let pendingProduct: string | null = null;

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.startsWith('(') && !token.endsWith(')')) {
      let comment = token;
      while (index + 1 < tokens.length && !comment.endsWith(')')) {
        index++;
        comment += ` ${tokens[index]}`;
      }

      if (pendingProduct != null && comment.startsWith('(') && comment.endsWith(')')) {
        const innerComment = comment.slice(1, -1);
        if (commentPattern.test(innerComment)) {
          accepted.push(`${pendingProduct} (${innerComment})`);
          pendingProduct = null;
          continue;
        }
      }
    } else if (token.startsWith('(') && token.endsWith(')')) {
      const innerComment = token.slice(1, -1);
      if (pendingProduct != null && commentPattern.test(innerComment)) {
        accepted.push(`${pendingProduct} (${innerComment})`);
        pendingProduct = null;
        continue;
      }
    }

    if (pendingProduct != null) {
      accepted.push(pendingProduct);
      pendingProduct = null;
    }

    if (productPattern.test(token)) {
      pendingProduct = token;
    }
  }

  if (pendingProduct != null) {
    accepted.push(pendingProduct);
  }

  const result: string[] = [];
  let byteLength = 0;
  for (const token of accepted) {
    const nextLength = byteLength + (result.length === 0 ? 0 : 1) + Buffer.byteLength(token);
    if (nextLength > BOT_AGENT_MAX_LEN) {
      break;
    }

    result.push(token);
    byteLength = nextLength;
  }

  return result.length > 0 ? result.join(' ') : DEFAULT_BOT_AGENT;
}

function buildBaseInfo(): BaseInfo {
  return {
    channel_version: channelVersion,
    bot_agent: sanitizeBotAgent(process.env.WECHAT_BRIDGE_BOT_AGENT),
  };
}

function addBaseInfo(body?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (body == null) {
    return undefined;
  }

  return {
    ...body,
    base_info: buildBaseInfo(),
  };
}

function buildHeaders(botToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    'X-WECHAT-UIN': randomWechatUin(),
    'iLink-App-Id': ilinkAppId,
    'iLink-App-ClientVersion': String(buildClientVersion(channelVersion)),
  };

  if (botToken != null && botToken.trim().length > 0) {
    headers.Authorization = `Bearer ${botToken.trim()}`;
  }

  return headers;
}

async function requestJson<TResponse>({
  baseUrl,
  body,
  botToken,
  endpoint,
  method = 'POST',
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: RequestOptions): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const payload = body == null ? undefined : JSON.stringify(addBaseInfo(body));

  try {
    const response = await fetch(new URL(endpoint, ensureTrailingSlash(baseUrl)).toString(), {
      method,
      headers: buildHeaders(botToken),
      body: payload,
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${endpoint} failed with ${response.status}: ${raw}`);
    }

    return raw.length > 0 ? (JSON.parse(raw) as TResponse) : ({} as TResponse);
  } finally {
    clearTimeout(timeout);
  }
}

export async function startOpenClawQrLogin(params?: {
  botType?: string;
  timeoutMs?: number;
}): Promise<OpenClawQrLoginSession> {
  const botType = params?.botType ?? DEFAULT_LOGIN_BOT_TYPE;
  const response = await requestJson<{
    qrcode: string;
    qrcode_img_content: string;
  }>({
    baseUrl: DEFAULT_LOGIN_BASE_URL,
    body: {
      local_token_list: [],
    },
    endpoint: `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`,
    timeoutMs: params?.timeoutMs,
  });

  return {
    qrcode: response.qrcode,
    qrCodeDataUrl: response.qrcode_img_content,
    currentApiBaseUrl: DEFAULT_LOGIN_BASE_URL,
  };
}

export async function pollOpenClawQrLogin(params: {
  qrcode: string;
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<OpenClawQrStatus> {
  const response = await requestJson<{
    status: OpenClawQrStatus['status'];
    bot_token?: string;
    ilink_bot_id?: string;
    baseurl?: string;
    ilink_user_id?: string;
    redirect_host?: string;
  }>({
    baseUrl: params.baseUrl ?? DEFAULT_LOGIN_BASE_URL,
    endpoint: `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(params.qrcode)}`,
    method: 'GET',
    timeoutMs: params.timeoutMs,
  });

  return {
    status: response.status,
    botToken: response.bot_token,
    ilinkBotId: response.ilink_bot_id,
    baseUrl: response.baseurl,
    ilinkUserId: response.ilink_user_id,
    redirectHost: response.redirect_host,
  };
}

export async function getOpenClawUpdates(params: {
  baseUrl: string;
  botToken: string;
  cursor?: string;
  timeoutMs?: number;
}): Promise<OpenClawGetUpdatesResponse> {
  return requestJson<OpenClawGetUpdatesResponse>({
    baseUrl: params.baseUrl,
    botToken: params.botToken,
    endpoint: 'ilink/bot/getupdates',
    timeoutMs: params.timeoutMs,
    body: {
      get_updates_buf: params.cursor ?? '',
    },
  });
}

export async function sendOpenClawTextMessage(params: {
  baseUrl: string;
  botToken: string;
  toUserId: string;
  contextToken?: string;
  text: string;
  timeoutMs?: number;
}): Promise<void> {
  await requestJson({
    baseUrl: params.baseUrl,
    botToken: params.botToken,
    endpoint: 'ilink/bot/sendmessage',
    timeoutMs: params.timeoutMs,
    body: {
      msg: {
        from_user_id: '',
        to_user_id: params.toUserId,
        client_id: crypto.randomUUID(),
        message_type: BOT_MESSAGE_TYPE,
        message_state: MESSAGE_STATE_FINISH,
        context_token: params.contextToken,
        item_list: [
          {
            type: TEXT_ITEM_TYPE,
            text_item: {
              text: params.text,
            },
          },
        ],
      },
    },
  });
}

export async function getOpenClawConfig(params: {
  baseUrl: string;
  botToken: string;
  ilinkUserId: string;
  contextToken?: string;
  timeoutMs?: number;
}): Promise<{
  ret?: number;
  errmsg?: string;
  typing_ticket?: string;
}> {
  return requestJson({
    baseUrl: params.baseUrl,
    botToken: params.botToken,
    endpoint: 'ilink/bot/getconfig',
    timeoutMs: params.timeoutMs,
    body: {
      ilink_user_id: params.ilinkUserId,
      context_token: params.contextToken,
    },
  });
}

export async function sendOpenClawTyping(params: {
  baseUrl: string;
  botToken: string;
  ilinkUserId: string;
  typingTicket: string;
  status?: number;
  timeoutMs?: number;
}): Promise<void> {
  await requestJson({
    baseUrl: params.baseUrl,
    botToken: params.botToken,
    endpoint: 'ilink/bot/sendtyping',
    timeoutMs: params.timeoutMs,
    body: {
      ilink_user_id: params.ilinkUserId,
      typing_ticket: params.typingTicket,
      status: params.status ?? 1,
    },
  });
}
