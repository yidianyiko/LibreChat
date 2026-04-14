import { QueryClient } from '@tanstack/react-query';
import { Constants, QueryKeys } from 'librechat-data-provider';
import type { InfiniteData } from '@tanstack/react-query';
import type { TConversation } from 'librechat-data-provider';
import type { ConversationCursorData } from '~/utils';
import { getConvoTitle, isRootMessageId } from '../useEventHandlers';

describe('useEventHandlers helpers', () => {
  test('isRootMessageId treats nullish and NO_PARENT values as root messages', () => {
    expect(isRootMessageId(null)).toBe(true);
    expect(isRootMessageId(undefined)).toBe(true);
    expect(isRootMessageId(Constants.NO_PARENT)).toBe(true);
    expect(isRootMessageId('message-123')).toBe(false);
  });

  test('getConvoTitle keeps the current title for root messages with null parent ids', () => {
    const queryClient = new QueryClient();

    expect(
      getConvoTitle({
        parentId: null,
        queryClient,
        currentTitle: 'New Chat',
        conversationId: 'convo-1',
      }),
    ).toBe('New Chat');
  });

  test('getConvoTitle falls back to cached conversation titles for non-root replies', () => {
    const queryClient = new QueryClient();
    const cachedConversation = {
      conversationId: 'convo-1',
      title: 'Saved Title',
      updatedAt: '2026-04-14T00:00:00.000Z',
    } as TConversation;

    queryClient.setQueryData<InfiniteData<ConversationCursorData>>([QueryKeys.allConversations], {
      pages: [{ conversations: [cachedConversation], nextCursor: null }],
      pageParams: [],
    });

    expect(
      getConvoTitle({
        parentId: 'message-123',
        queryClient,
        currentTitle: 'New Chat',
        conversationId: 'convo-1',
      }),
    ).toBe('Saved Title');
  });
});
