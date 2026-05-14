import { ContentTypes } from 'librechat-data-provider';

import { toAdminConvoDetail, toAdminConvoListItem, toAdminMessageItem } from '../transformer';
import { anonymizeUserId } from '../anonymizer';

const hashSalt = '12345678901234567890123456789012';

const highRiskKeys = [
  'user',
  'email',
  'name',
  'username',
  'openidId',
  'files',
  'attachments',
  'metadata',
  'iconURL',
  'conversationSignature',
  'clientId',
  'invocationId',
  'thread_id',
];

describe('admin conversation DTO transformers', () => {
  const conversation = {
    _id: { toString: () => 'mongo-convo-id' },
    conversationId: 'convo-1',
    user: 'raw-user-id',
    title: 'Support request',
    endpoint: 'openAI',
    model: 'gpt-4',
    agent_id: 'agent-1',
    tags: ['billing'],
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: '2026-05-01T10:05:00.000Z',
    email: 'user@example.com',
    name: 'Raw User',
    username: 'raw-user',
    openidId: 'openid-1',
    files: [{ file_id: 'file-1' }],
    attachments: [{ id: 'attachment-1' }],
    metadata: { ip: '127.0.0.1' },
    iconURL: 'https://example.com/icon.png',
    conversationSignature: 'signature',
    clientId: 'client-1',
    invocationId: 'invocation-1',
    thread_id: 'thread-1',
  };

  const message = {
    _id: { toString: () => 'mongo-message-id' },
    messageId: 'message-1',
    conversationId: 'convo-1',
    parentMessageId: 'parent-1',
    user: 'raw-user-id',
    text: 'Hello',
    content: [{ type: 'text', text: 'Hello' }],
    sender: 'User',
    isCreatedByUser: true,
    model: 'gpt-4',
    endpoint: 'openAI',
    tokenCount: 12,
    summaryTokenCount: 3,
    finish_reason: 'stop',
    feedback: {
      rating: 'thumbsDown',
      tag: { key: 'not_helpful', label: 'Not helpful' },
      text: 'Too vague',
      extra: 'drop-me',
    },
    error: false,
    unfinished: false,
    createdAt: new Date('2026-05-01T10:01:00.000Z'),
    updatedAt: '2026-05-01T10:02:00.000Z',
    email: 'user@example.com',
    name: 'Raw User',
    username: 'raw-user',
    openidId: 'openid-1',
    files: [{ file_id: 'file-1' }],
    attachments: [{ id: 'attachment-1' }],
    metadata: { ip: '127.0.0.1' },
    iconURL: 'https://example.com/icon.png',
    conversationSignature: 'signature',
    clientId: 'client-1',
    invocationId: 'invocation-1',
    thread_id: 'thread-1',
  };

  it('maps a conversation to the whitelisted list DTO', () => {
    expect(toAdminConvoListItem(conversation, hashSalt, 2)).toEqual({
      id: 'mongo-convo-id',
      conversationId: 'convo-1',
      anonUserId: anonymizeUserId('raw-user-id', hashSalt),
      title: 'Support request',
      endpoint: 'openAI',
      model: 'gpt-4',
      agent_id: 'agent-1',
      tags: ['billing'],
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:05:00.000Z',
      messageCount: 2,
    });
  });

  it('does not serialize raw user ids or high-risk keys', () => {
    const detail = toAdminConvoDetail(conversation, [message], hashSalt, 1, true);
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain('raw-user-id');
    expect(serialized).not.toContain('user@example.com');
    highRiskKeys.forEach((key) => {
      expect(serialized).not.toContain(`"${key}"`);
    });
  });

  it('preserves message feedback as minimal feedback only', () => {
    expect(toAdminMessageItem(message, hashSalt).feedback).toEqual({
      rating: 'thumbsDown',
      tag: 'not_helpful',
      text: 'Too vague',
    });
  });

  it('omits feedback with invalid tag values', () => {
    expect(
      toAdminMessageItem(
        {
          ...message,
          feedback: {
            rating: 'thumbsDown',
            tag: { key: 'not_a_real_tag' },
            text: 'Invalid tag text',
          },
        },
        hashSalt,
      ).feedback,
    ).toBeUndefined();
  });

  it('maps detail DTO messages and truncated flag', () => {
    const detail = toAdminConvoDetail(conversation, [message], hashSalt, 1, true);

    expect(detail.truncated).toBe(true);
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]).toMatchObject({
      id: 'mongo-message-id',
      messageId: 'message-1',
      conversationId: 'convo-1',
    });
  });

  it('sanitizes nested content to safe textual parts only', () => {
    const dto = toAdminMessageItem(
      {
        ...message,
        content: [
          {
            type: ContentTypes.TEXT,
            text: 'Safe answer',
            metadata: { leaked: 'nested-metadata' },
            clientId: 'nested-client-id',
            thread_id: 'nested-thread-id',
            image_file: { file_id: 'nested-image-file-id' },
          },
          {
            type: ContentTypes.THINK,
            think: 'Safe reasoning',
            tool_call: { id: 'nested-tool-call-id' },
          },
          {
            type: ContentTypes.ERROR,
            text: 'Safe error text',
            error: 'Safe error code',
            files: [{ id: 'nested-file-id' }],
          },
          {
            type: ContentTypes.IMAGE_FILE,
            image_file: { file_id: 'dropped-image-file-id' },
          },
          {
            type: ContentTypes.TOOL_CALL,
            tool_call: { id: 'dropped-tool-call-id' },
          },
          {
            type: ContentTypes.VIDEO_URL,
            video_url: { url: 'https://example.com/video.mp4' },
          },
          {
            type: ContentTypes.INPUT_AUDIO,
            input_audio: { data: 'audio-payload' },
          },
          {
            type: ContentTypes.AGENT_UPDATE,
            update: { runId: 'agent-update-payload' },
          },
        ],
      },
      hashSalt,
    );

    expect(dto.content).toEqual([
      { type: ContentTypes.TEXT, text: 'Safe answer' },
      { type: ContentTypes.THINK, think: 'Safe reasoning' },
      { type: ContentTypes.ERROR, text: 'Safe error text', error: 'Safe error code' },
    ]);

    const serialized = JSON.stringify(dto);
    [
      'metadata',
      'clientId',
      'thread_id',
      'image_file',
      'tool_call',
      'video_url',
      'input_audio',
      'nested-metadata',
      'nested-client-id',
      'nested-thread-id',
      'nested-image-file-id',
      'nested-tool-call-id',
      'nested-file-id',
      'dropped-image-file-id',
      'dropped-tool-call-id',
      'agent-update-payload',
    ].forEach((unsafeValue) => {
      expect(serialized).not.toContain(unsafeValue);
    });
  });
});
