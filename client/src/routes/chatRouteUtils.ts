import { Constants } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';

/**
 * During first-message creation, conversation state may switch from "new" to a real ID
 * before the URL updates from /c/new. Keep ChatView mounted for that transition only.
 */
export function shouldBlockChatViewRender(
  conversation: TConversation | null | undefined,
  routeConversationId: string | undefined,
): boolean {
  if (!conversation || !routeConversationId) {
    return false;
  }

  if (conversation.conversationId === routeConversationId) {
    return false;
  }

  const isNewToRealTransition =
    routeConversationId === Constants.NEW_CONVO &&
    conversation.conversationId != null &&
    conversation.conversationId !== '' &&
    conversation.conversationId !== Constants.NEW_CONVO;

  return !isNewToRealTransition;
}
