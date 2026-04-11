import { Constants } from 'librechat-data-provider';
import type { WeChatConversation, WeChatConversationMessage } from './types';

export function isEligibleWeChatConversation(
  conversation: Pick<
    WeChatConversation,
    'user' | 'endpoint' | 'endpointType' | 'model' | 'isArchived' | 'expiredAt'
  >,
  userId: string,
): boolean {
  const provider = conversation.endpointType ?? conversation.endpoint;

  return (
    conversation.user === userId &&
    provider === 'openAI' &&
    conversation.model === 'gpt-4o' &&
    conversation.isArchived !== true &&
    conversation.expiredAt == null
  );
}

function compareLeafPriority(
  currentBest: WeChatConversationMessage | undefined,
  candidate: WeChatConversationMessage,
): number {
  if (!currentBest) {
    return 1;
  }

  const candidateTime = candidate.createdAt?.getTime() ?? 0;
  const currentBestTime = currentBest.createdAt?.getTime() ?? 0;

  if (candidateTime !== currentBestTime) {
    return candidateTime > currentBestTime ? 1 : -1;
  }

  if (candidate.isCreatedByUser === currentBest.isCreatedByUser) {
    return 0;
  }

  return candidate.isCreatedByUser === false ? 1 : -1;
}

export function selectLatestLeafHead(messages: WeChatConversationMessage[]): string {
  if (messages.length === 0) {
    return Constants.NO_PARENT;
  }

  const parentIds = new Set<string>();
  for (const message of messages) {
    if (message.parentMessageId && message.parentMessageId !== Constants.NO_PARENT) {
      parentIds.add(message.parentMessageId);
    }
  }

  let bestLeaf: WeChatConversationMessage | undefined;

  for (const message of messages) {
    if (parentIds.has(message.messageId)) {
      continue;
    }

    if (compareLeafPriority(bestLeaf, message) >= 0) {
      bestLeaf = message;
    }
  }

  return bestLeaf?.messageId ?? Constants.NO_PARENT;
}
