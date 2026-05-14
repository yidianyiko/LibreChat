import type { AdminConvoDetail, AdminConvoListItem, AdminMessageItem } from './index';
import { adminConvoDetailKeys, adminConvoListItemKeys, adminMessageItemKeys } from './index';
import { ContentTypes } from './types/runs';

test('admin conversation DTO keys are exported through the package barrel', () => {
  const listItem: AdminConvoListItem = {
    id: 'mongo-id',
    conversationId: 'convo-1',
    anonUserId: 'abcdef123456',
    title: 'Need help',
    endpoint: 'openAI',
    model: 'gpt-5.5',
    agent_id: 'agent-1',
    tags: ['analysis'],
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:01:00.000Z',
    messageCount: 2,
  };
  const message: AdminMessageItem = {
    id: 'message-mongo-id',
    messageId: 'message-1',
    conversationId: 'convo-1',
    parentMessageId: 'parent-1',
    anonUserId: 'abcdef123456',
    text: 'hello',
    content: [{ type: ContentTypes.TEXT, text: 'hello' }],
    sender: 'User',
    isCreatedByUser: true,
    model: 'gpt-5.5',
    endpoint: 'openAI',
    tokenCount: 4,
    summaryTokenCount: 0,
    finish_reason: 'stop',
    feedback: { rating: 'thumbsUp', tag: 'accurate_reliable', text: 'useful' },
    error: false,
    unfinished: false,
    createdAt: '2026-05-14T00:00:02.000Z',
    updatedAt: '2026-05-14T00:00:03.000Z',
  };
  const detail: AdminConvoDetail = { ...listItem, messages: [message], truncated: false };

  expect(detail.messages[0].anonUserId).toBe('abcdef123456');
  expect(Object.keys(listItem).sort()).toEqual([...adminConvoListItemKeys].sort());
  expect(Object.keys(message).sort()).toEqual([...adminMessageItemKeys].sort());
  expect(Object.keys(detail).sort()).toEqual([...adminConvoDetailKeys].sort());
});
