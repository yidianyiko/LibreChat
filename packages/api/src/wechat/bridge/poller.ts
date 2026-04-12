import { parseWeChatCommand, formatWeChatConversationList, formatWeChatCurrentConversation, getNoCurrentConversationMessage, splitWeChatReply } from './commands';
import { InboundMessageDedupe } from './dedupe';
import {
  getOpenClawUpdates,
  sendOpenClawTextMessage,
  type OpenClawInboundMessage,
  type OpenClawMessageItem,
} from './openclawClient';

type ActiveWeChatBinding = {
  userId: string;
  ilinkUserId?: string;
  ilinkBotId?: string | null;
  botToken?: string | null;
  baseUrl?: string | null;
  status: 'healthy' | 'reauth_required';
};

type ConversationSummary = {
  conversationId: string;
  title?: string | null;
  updatedAt?: Date | string | null;
};

type CurrentConversationResponse = {
  conversationId: string;
  parentMessageId: string;
  selectedAt: Date | string;
  lastAdvancedAt?: Date | string | null;
  source: 'new' | 'switch';
  conversation: ConversationSummary;
};

type MessageResponse = {
  conversationId: string;
  parentMessageId: string;
  text: string;
  timedOut: boolean;
};

type ListConversationResponse = {
  snapshotId: string;
  conversations: ConversationSummary[];
};

interface WeChatBridgeRuntimeParams {
  librechatBaseUrl: string;
  internalToken: string;
  pollIntervalMs: number;
  dedupeTtlMs: number;
  bindingRefreshIntervalMs: number;
  longPollTimeoutMs: number;
}

interface PollerHandle {
  stop: () => void;
  signature: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMessageText(itemList?: OpenClawMessageItem[]): string {
  if (itemList == null) {
    return '';
  }

  for (const item of itemList) {
    if (item.type === 1 && item.text_item?.text != null) {
      return String(item.text_item.text).trim();
    }

    if (item.type === 3 && item.voice_item?.text != null) {
      return String(item.voice_item.text).trim();
    }
  }

  return '';
}

function getMessageId(message: OpenClawInboundMessage): string {
  if (message.message_id != null) {
    return String(message.message_id);
  }

  if (message.client_id != null) {
    return message.client_id;
  }

  return `${message.from_user_id ?? 'unknown'}:${message.create_time_ms ?? Date.now()}`;
}

class LibreChatWeChatClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
  ) {}

  private async request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.internalToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 204) {
      return undefined as TResponse;
    }

    const raw = await response.text();
    if (!response.ok) {
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { message?: string };
        message = parsed.message ?? raw;
      } catch {
        // ignore json parse failures
      }

      throw new Error(message);
    }

    return raw.length > 0 ? (JSON.parse(raw) as TResponse) : (undefined as TResponse);
  }

  fetchActiveBindings(): Promise<{ bindings: ActiveWeChatBinding[] }> {
    return this.request('/api/wechat/internal/bindings/active', { method: 'GET' });
  }

  async completeBinding(input: {
    userId: string;
    ilinkUserId: string;
    ilinkBotId: string;
    botToken: string;
    baseUrl: string;
  }): Promise<void> {
    await this.request('/api/wechat/internal/bindings/complete', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateBindingHealth(input: {
    userId: string;
    status: 'healthy' | 'reauth_required';
  }): Promise<void> {
    await this.request('/api/wechat/internal/bindings/health', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listConversations(userId: string): Promise<ListConversationResponse> {
    return this.request(`/api/wechat/conversations?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
    });
  }

  createConversation(userId: string): Promise<ConversationSummary> {
    return this.request('/api/wechat/conversations/new', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  switchConversation(userId: string, snapshotId: string, index: number): Promise<{
    conversationId: string;
    parentMessageId: string;
    conversation: ConversationSummary;
  }> {
    return this.request('/api/wechat/conversations/switch', {
      method: 'POST',
      body: JSON.stringify({ userId, snapshotId, index }),
    });
  }

  getCurrentConversation(userId: string): Promise<CurrentConversationResponse | null> {
    return this.request(`/api/wechat/conversations/current?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
    });
  }

  sendMessage(userId: string, text: string): Promise<MessageResponse> {
    return this.request('/api/wechat/messages', {
      method: 'POST',
      body: JSON.stringify({ userId, text }),
    });
  }
}

export class WeChatBridgeRuntime {
  private readonly dedupe: InboundMessageDedupe;
  private readonly librechatClient: LibreChatWeChatClient;
  private readonly listSnapshots = new Map<string, string>();
  private readonly pollers = new Map<string, PollerHandle>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: WeChatBridgeRuntimeParams) {
    this.dedupe = new InboundMessageDedupe(config.dedupeTtlMs);
    this.librechatClient = new LibreChatWeChatClient(
      config.librechatBaseUrl,
      config.internalToken,
    );
  }

  async start(): Promise<void> {
    try {
      await this.refreshBindings();
    } catch {
      // The bridge admin API should still boot even when LibreChat is temporarily unavailable.
    }
    this.refreshTimer = setInterval(() => {
      void this.refreshBindings();
    }, this.config.bindingRefreshIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.refreshTimer != null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    for (const handle of this.pollers.values()) {
      handle.stop();
    }

    this.pollers.clear();
  }

  async refreshBindings(): Promise<void> {
    const { bindings } = await this.librechatClient.fetchActiveBindings();
    const activeUsers = new Set<string>();

    for (const binding of bindings) {
      if (
        binding.userId.length === 0 ||
        binding.status !== 'healthy' ||
        binding.ilinkUserId == null ||
        binding.botToken == null ||
        binding.baseUrl == null
      ) {
        continue;
      }

      activeUsers.add(binding.userId);
      this.ensurePoller(binding);
    }

    for (const [userId, handle] of this.pollers.entries()) {
      if (activeUsers.has(userId)) {
        continue;
      }

      handle.stop();
      this.pollers.delete(userId);
      this.listSnapshots.delete(userId);
    }
  }

  private ensurePoller(binding: ActiveWeChatBinding) {
    const signature = [binding.ilinkUserId, binding.baseUrl, binding.botToken].join(':');
    const existing = this.pollers.get(binding.userId);
    if (existing?.signature === signature) {
      return;
    }

    if (existing != null) {
      existing.stop();
    }

    const state = { stopped: false };
    this.pollers.set(binding.userId, {
      signature,
      stop: () => {
        state.stopped = true;
      },
    });

    void this.runPoller(binding, state);
  }

  private async runPoller(binding: ActiveWeChatBinding, state: { stopped: boolean }) {
    let cursor = '';
    let timeoutMs = this.config.longPollTimeoutMs;

    while (!state.stopped) {
      try {
        const response = await getOpenClawUpdates({
          baseUrl: binding.baseUrl ?? '',
          botToken: binding.botToken ?? '',
          cursor,
          timeoutMs,
        });

        if (response.errcode === -14) {
          await this.librechatClient.updateBindingHealth({
            userId: binding.userId,
            status: 'reauth_required',
          });
          state.stopped = true;
          return;
        }

        cursor = response.get_updates_buf ?? cursor;
        timeoutMs = response.longpolling_timeout_ms ?? timeoutMs;

        for (const message of response.msgs ?? []) {
          if (state.stopped) {
            return;
          }

          await this.handleInboundMessage(binding, message);
        }
      } catch {
        await sleep(this.config.pollIntervalMs);
      }
    }
  }

  private async handleInboundMessage(binding: ActiveWeChatBinding, message: OpenClawInboundMessage) {
    const peerUserId = message.from_user_id?.trim();
    if (peerUserId == null || peerUserId.length === 0 || peerUserId !== binding.ilinkUserId) {
      return;
    }

    const dedupeKey = `${binding.userId}:${getMessageId(message)}`;
    if (this.dedupe.seenBefore(dedupeKey)) {
      return;
    }

    const text = extractMessageText(message.item_list);
    if (text.length === 0) {
      await this.sendReply(binding, peerUserId, message.context_token, '暂不支持该消息类型，请发送文本消息。');
      return;
    }

    const command = parseWeChatCommand(text);
    if (command != null) {
      await this.handleCommand(binding, peerUserId, message.context_token, command);
      return;
    }

    await this.handlePlainText(binding, peerUserId, message.context_token, text);
  }

  private async handleCommand(
    binding: ActiveWeChatBinding,
    peerUserId: string,
    contextToken: string | undefined,
    command: ReturnType<typeof parseWeChatCommand>,
  ) {
    if (command == null) {
      return;
    }

    try {
      switch (command.name) {
        case 'new': {
          const conversation = await this.librechatClient.createConversation(binding.userId);
          this.listSnapshots.delete(binding.userId);
          await this.sendReply(
            binding,
            peerUserId,
            contextToken,
            `已创建新对话：${conversation.title?.trim() || '未命名对话'}`,
          );
          return;
        }
        case 'list': {
          const result = await this.librechatClient.listConversations(binding.userId);
          this.listSnapshots.set(binding.userId, result.snapshotId);
          await this.sendReply(
            binding,
            peerUserId,
            contextToken,
            formatWeChatConversationList(result.conversations),
          );
          return;
        }
        case 'switch': {
          const snapshotId = this.listSnapshots.get(binding.userId);
          if (snapshotId == null) {
            await this.sendReply(binding, peerUserId, contextToken, '请先执行 /list');
            return;
          }

          const result = await this.librechatClient.switchConversation(
            binding.userId,
            snapshotId,
            command.index,
          );
          await this.sendReply(
            binding,
            peerUserId,
            contextToken,
            `已切换到对话：${result.conversation.title?.trim() || '未命名对话'}`,
          );
          return;
        }
        case 'now': {
          const current = await this.librechatClient.getCurrentConversation(binding.userId);
          await this.sendReply(
            binding,
            peerUserId,
            contextToken,
            current == null
              ? getNoCurrentConversationMessage()
              : formatWeChatCurrentConversation({
                  conversationId: current.conversationId,
                  title: current.conversation.title,
                  updatedAt: current.conversation.updatedAt ?? current.lastAdvancedAt ?? current.selectedAt,
                }),
          );
        }
      }
    } catch (error) {
      const messageText =
        error instanceof Error && error.message === '请先执行 /list'
          ? error.message
          : '操作失败，请稍后重试。';
      await this.sendReply(binding, peerUserId, contextToken, messageText);
    }
  }

  private async handlePlainText(
    binding: ActiveWeChatBinding,
    peerUserId: string,
    contextToken: string | undefined,
    text: string,
  ) {
    try {
      const current = await this.librechatClient.getCurrentConversation(binding.userId);
      if (current == null) {
        await this.sendReply(binding, peerUserId, contextToken, getNoCurrentConversationMessage());
        return;
      }

      const response = await this.librechatClient.sendMessage(binding.userId, text);
      await this.sendReply(binding, peerUserId, contextToken, response.text);
    } catch {
      await this.sendReply(binding, peerUserId, contextToken, '消息发送失败，请稍后重试。');
    }
  }

  private async sendReply(
    binding: ActiveWeChatBinding,
    peerUserId: string,
    contextToken: string | undefined,
    text: string,
  ) {
    for (const chunk of splitWeChatReply(text)) {
      await sendOpenClawTextMessage({
        baseUrl: binding.baseUrl ?? '',
        botToken: binding.botToken ?? '',
        toUserId: peerUserId,
        contextToken,
        text: chunk,
      });
    }
  }
}
