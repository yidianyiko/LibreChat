/* eslint-disable i18next/no-literal-string */
import { Constants } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import { shouldBlockChatViewRender } from '../chatRouteUtils';

describe('shouldBlockChatViewRender', () => {
  it('returns false when conversation is not set', () => {
    expect(shouldBlockChatViewRender(null, Constants.NEW_CONVO)).toBe(false);
  });

  it('returns false when route and state conversation IDs match', () => {
    const conversation = { conversationId: 'convo-1' } as TConversation;
    expect(shouldBlockChatViewRender(conversation, 'convo-1')).toBe(false);
  });

  it('returns true when IDs mismatch in normal navigation', () => {
    const conversation = { conversationId: 'convo-2' } as TConversation;
    expect(shouldBlockChatViewRender(conversation, 'convo-1')).toBe(true);
  });

  it('returns false during new->real conversation transition', () => {
    const conversation = { conversationId: 'convo-real-id' } as TConversation;
    expect(shouldBlockChatViewRender(conversation, Constants.NEW_CONVO)).toBe(false);
  });
});
