#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://54.64.181.104:3080';
const NO_PARENT = '00000000-0000-0000-0000-000000000000';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 LibreChatProductionSmoke/1.0';

const baseUrl = (process.env.PRODUCTION_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const endpoint = process.env.PRODUCTION_SMOKE_ENDPOINT || 'openAI';
const endpointType = process.env.PRODUCTION_SMOKE_ENDPOINT_TYPE || endpoint;
const model = process.env.PRODUCTION_SMOKE_MODEL || 'gpt-4o-2024-11-20';
const spec = process.env.PRODUCTION_SMOKE_SPEC || model;
const expectedMarker = process.env.PRODUCTION_SMOKE_EXPECTED || 'DEPLOY_SMOKE_OK';
const timeoutMs = Number(process.env.PRODUCTION_SMOKE_TIMEOUT_MS || 90_000);

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `deploy-smoke-${runId}@example.com`;
const password = `DeploySmoke!${Date.now()}aA1`;
const username = `deploy_smoke_${Date.now()}`;
const cookies = new Map();

let token = '';
let cleanupStatus = 'not-started';
let conversationId = '';
let responseText = '';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function saveCookies(headers) {
  const setCookie =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : [];

  for (const raw of setCookie) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    if (index > 0) {
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function extractText(message) {
  let text = message?.text || '';
  if (!Array.isArray(message?.content)) {
    return text;
  }

  for (const part of message.content) {
    if (typeof part?.text === 'string') {
      text += part.text;
    }
    if (typeof part?.text?.value === 'string') {
      text += part.text.value;
    }
    if (part?.type && typeof part?.[part.type] === 'string') {
      text += part[part.type];
    }
    if (part?.type && typeof part?.[part.type]?.value === 'string') {
      text += part[part.type].value;
    }
  }

  return text;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json, text/event-stream, */*',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookieHeader() ? { cookie: cookieHeader() } : {}),
      ...(options.headers || {}),
    },
  });

  saveCookies(response.headers);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const redactedBody = typeof body === 'string' ? body.slice(0, 500) : body;
    throw new Error(
      `${options.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(redactedBody)}`,
    );
  }

  return body;
}

async function readSSE(streamId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('SSE timeout')), timeoutMs);

  try {
    const response = await fetch(
      `${baseUrl}/api/agents/chat/stream/${encodeURIComponent(streamId)}`,
      {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/event-stream',
          authorization: `Bearer ${token}`,
          ...(cookieHeader() ? { cookie: cookieHeader() } : {}),
        },
        signal: controller.signal,
      },
    );

    if (!response.ok || !response.body) {
      throw new Error(`SSE stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const events = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLines = raw
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart());

        if (!dataLines.length) {
          continue;
        }

        const data = JSON.parse(dataLines.join('\n'));
        events.push(data);

        if (data.type && typeof data.text === 'string') {
          responseText += data.text;
        }
        if (data.message && typeof data.text === 'string') {
          responseText += data.text;
        }
        if (data.final != null) {
          if (data.responseMessage) {
            responseText = extractText(data.responseMessage) || responseText;
          }
          if (data.conversation?.conversationId) {
            conversationId = data.conversation.conversationId;
          }
          return { events, final: data };
        }
      }
    }

    return { events, final: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function cleanup() {
  if (!token) {
    return;
  }

  try {
    await request('/api/user/delete', { method: 'DELETE', body: '{}' });
    cleanupStatus = 'deleted-test-user';
  } catch (error) {
    cleanupStatus = `cleanup-failed: ${error.message}`;
  }
}

async function main() {
  try {
    await request('/api/config');

    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Deploy Smoke Test',
        username,
        email,
        password,
        confirm_password: password,
      }),
    });

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    token = login.token;
    if (!token) {
      throw new Error('Login did not return a token');
    }

    await request('/api/user/terms/accept', { method: 'POST', body: '{}' });

    const sentText = `Production deploy smoke test. Reply with exactly: ${expectedMarker}`;
    const userMessageId = crypto.randomUUID();
    const started = await request(`/api/agents/chat/${encodeURIComponent(endpoint)}`, {
      method: 'POST',
      body: JSON.stringify({
        text: sentText,
        sender: 'User',
        clientTimestamp: new Date().toISOString().slice(0, 19),
        isCreatedByUser: true,
        parentMessageId: NO_PARENT,
        conversationId: null,
        messageId: userMessageId,
        responseMessageId: null,
        overrideParentMessageId: null,
        endpoint,
        endpointType,
        model,
        key: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        modelDisplayLabel: endpoint,
        spec,
        isTemporary: false,
        isRegenerate: false,
        isContinued: false,
        useMemoryAgent: false,
      }),
    });

    const streamId = started.streamId;
    conversationId = started.conversationId || streamId;
    if (!streamId || !conversationId) {
      throw new Error(`Chat start did not return stream identifiers: ${JSON.stringify(started)}`);
    }

    const sse = await readSSE(streamId);
    if (!sse.final) {
      throw new Error('SSE stream ended without final event');
    }
    const expectedPattern = new RegExp(escapeRegExp(expectedMarker), 'i');

    if (!expectedPattern.test(responseText)) {
      throw new Error(`Assistant response missing expected marker: ${responseText.slice(0, 300)}`);
    }

    const messages = await request(`/api/messages/${encodeURIComponent(conversationId)}`);
    const list = Array.isArray(messages) ? messages : messages?.messages;
    const hasUserMessage = (list || []).some(
      (message) => message.messageId === userMessageId || extractText(message).includes(sentText),
    );
    const hasAssistantMessage = (list || []).some(
      (message) =>
        message.messageId !== userMessageId &&
        message.isCreatedByUser === false &&
        expectedPattern.test(extractText(message)),
    );

    if (!hasUserMessage || !hasAssistantMessage) {
      throw new Error('Persisted messages did not include both user and assistant smoke messages');
    }

    console.log(`production_smoke_base_url=${baseUrl}`);
    console.log(`chat_start_ok=true stream_id=${streamId} conversation_id=${conversationId}`);
    console.log(`sse_final_ok=true event_count=${sse.events.length}`);
    console.log(`messages_persisted_ok=true message_count=${list?.length ?? 'unknown'}`);
  } finally {
    await cleanup();
    console.log(`cleanup_status=${cleanupStatus}`);
  }
}

main().catch((error) => {
  console.error(`production_smoke_failed=${error.stack || error.message}`);
  process.exit(1);
});
