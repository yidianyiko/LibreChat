import crypto from 'node:crypto';
import { Constants } from 'librechat-data-provider';
import { isEligibleWeChatConversation, selectLatestLeafHead } from './branching';
import { resolveWeChatPreset } from './presets';
import type {
  SwitchWeChatConversationParams,
  WeChatCurrentConversation,
  WeChatServiceDependencies,
} from './types';

const INVALID_SWITCH_MESSAGE = '请先执行 /list';
const NO_PARENT_MESSAGE_ID = Constants.NO_PARENT as string;

export class WeChatService {
  private deps: WeChatServiceDependencies;

  constructor(deps: WeChatServiceDependencies) {
    this.deps = deps;
  }

  async getStatus(userId: string) {
    const binding = await this.deps.findBindingByUserId(userId);
    if (!binding || binding.status === 'unbound') {
      return { status: 'unbound' as const, hasBinding: false, currentConversation: null };
    }

    return {
      status: binding.status,
      hasBinding: true,
      ilinkUserId: binding.ilinkUserId,
      currentConversation: binding.currentConversation ?? null,
    };
  }

  async listEligibleConversations(userId: string) {
    const conversations = await this.deps.listUserConversations(userId);
    const eligibleConversations = conversations.filter((conversation) =>
      isEligibleWeChatConversation(conversation, userId),
    );

    const snapshotId = crypto.randomUUID();
    await this.deps.storeSnapshot(userId, {
      snapshotId,
      conversationIds: eligibleConversations.map((conversation) => conversation.conversationId),
      createdAt: new Date(),
    });

    return { snapshotId, conversations: eligibleConversations };
  }

  async createConversation(userId: string) {
    const preset = await resolveWeChatPreset({
      getUserDefaultPreset: () => this.deps.getUserDefaultPreset(userId),
      fallbackPreset: this.deps.getFallbackPreset(),
    });

    const conversationId = crypto.randomUUID();
    const conversation = await this.deps.createConversation({
      userId,
      conversationId,
      preset,
    });

    await this.deps.upsertBinding(userId, {
      currentConversation: {
        conversationId,
        parentMessageId: NO_PARENT_MESSAGE_ID,
        selectedAt: new Date(),
        lastAdvancedAt: null,
        source: 'new',
      },
    });

    return conversation;
  }

  async switchConversation(userId: string, params: SwitchWeChatConversationParams) {
    const conversationId = await this.resolveSwitchConversationId(userId, params);
    const conversation = await this.deps.getConversation(userId, conversationId);

    if (!conversation || !isEligibleWeChatConversation(conversation, userId)) {
      throw new Error(INVALID_SWITCH_MESSAGE);
    }

    const messages = await this.deps.listConversationMessages(userId, conversationId);
    const parentMessageId = selectLatestLeafHead(messages);

    await this.deps.upsertBinding(userId, {
      currentConversation: {
        conversationId,
        parentMessageId,
        selectedAt: new Date(),
        lastAdvancedAt: null,
        source: 'switch',
      },
    });

    return { conversation, conversationId, parentMessageId };
  }

  async getCurrentConversation(userId: string): Promise<WeChatCurrentConversation | null> {
    const binding = await this.deps.findBindingByUserId(userId);
    const currentConversation = binding?.currentConversation;

    if (!currentConversation) {
      return null;
    }

    const conversation = await this.deps.getConversation(userId, currentConversation.conversationId);
    if (!conversation || !isEligibleWeChatConversation(conversation, userId)) {
      await this.deps.upsertBinding(userId, { currentConversation: null });
      return null;
    }

    return {
      conversation,
      conversationId: currentConversation.conversationId,
      parentMessageId: currentConversation.parentMessageId,
      source: currentConversation.source,
      selectedAt: currentConversation.selectedAt,
      lastAdvancedAt: currentConversation.lastAdvancedAt,
    };
  }

  async unbind(userId: string) {
    await this.deps.upsertBinding(userId, {
      ilinkBotId: null,
      botToken: null,
      baseUrl: null,
      status: 'unbound',
      boundAt: null,
      unhealthyAt: null,
      unboundAt: new Date(),
      currentConversation: null,
    });

    return this.getStatus(userId);
  }

  private async resolveSwitchConversationId(
    userId: string,
    params: SwitchWeChatConversationParams,
  ): Promise<string> {
    if (!params.snapshotId) {
      throw new Error(INVALID_SWITCH_MESSAGE);
    }

    const snapshot = await this.deps.getSnapshot(userId);
    if (
      !snapshot ||
      snapshot.snapshotId !== params.snapshotId ||
      (snapshot.expiresAt != null && snapshot.expiresAt.getTime() <= Date.now())
    ) {
      throw new Error(INVALID_SWITCH_MESSAGE);
    }

    const conversationId = snapshot.conversationIds[params.index - 1];
    if (!conversationId) {
      throw new Error(INVALID_SWITCH_MESSAGE);
    }

    return conversationId;
  }
}
