const DEFAULT_BIND_SESSION_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BINDING_REFRESH_INTERVAL_MS = 30 * 1000;
const DEFAULT_LONG_POLL_TIMEOUT_MS = 35 * 1000;

export interface WeChatBridgeConfig {
  port: number;
  librechatBaseUrl: string;
  internalToken: string;
  pollIntervalMs: number;
  dedupeTtlMs: number;
  bindSessionTtlMs: number;
  bindingRefreshIntervalMs: number;
  longPollTimeoutMs: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getWeChatBridgeConfig(): WeChatBridgeConfig {
  return {
    port: parseNumber(process.env.WECHAT_BRIDGE_PORT, 3091),
    librechatBaseUrl: process.env.WECHAT_BRIDGE_LIBRECHAT_URL || 'http://localhost:3080',
    internalToken: process.env.WECHAT_BRIDGE_INTERNAL_TOKEN || '',
    pollIntervalMs: parseNumber(process.env.WECHAT_BRIDGE_POLL_INTERVAL_MS, 1500),
    dedupeTtlMs: parseNumber(process.env.WECHAT_BRIDGE_DEDUPE_TTL_MS, 10 * 60 * 1000),
    bindSessionTtlMs: parseNumber(process.env.WECHAT_BRIDGE_BIND_SESSION_TTL_MS, DEFAULT_BIND_SESSION_TTL_MS),
    bindingRefreshIntervalMs: parseNumber(
      process.env.WECHAT_BRIDGE_BINDING_REFRESH_INTERVAL_MS,
      DEFAULT_BINDING_REFRESH_INTERVAL_MS,
    ),
    longPollTimeoutMs: parseNumber(
      process.env.WECHAT_BRIDGE_LONG_POLL_TIMEOUT_MS,
      DEFAULT_LONG_POLL_TIMEOUT_MS,
    ),
  };
}
