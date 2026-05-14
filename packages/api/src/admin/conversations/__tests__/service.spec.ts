import {
  getAdminConversationDetail,
  listAdminConversationUsers,
  listAdminConversations,
  listAdminConversationsForUserAnchor,
  parseListParams,
} from '../service';

const hashSalt = '12345678901234567890123456789012';

type QueryResult<T> = {
  sort: jest.Mock<QueryResult<T>, [unknown]>;
  limit: jest.Mock<QueryResult<T>, [number]>;
  lean: jest.Mock<Promise<T>, []>;
};

const makeConversation = (id: string, updatedAt: string) => ({
  _id: id,
  conversationId: `convo-${id}`,
  user: `user-${id}`,
  title: `Conversation ${id}`,
  endpoint: 'openAI',
  model: 'gpt-4',
  createdAt: '2026-05-13T00:00:00.000Z',
  updatedAt,
});

const makeMessage = (id: number) => ({
  _id: `message-${id}`,
  messageId: `message-${id}`,
  conversationId: 'convo-1',
  user: 'user-1',
  text: `Message ${id}`,
  createdAt: new Date(Date.UTC(2026, 4, 14, 0, 0, id)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 4, 14, 0, 0, id)).toISOString(),
});

const createQuery = <T>(result: T): QueryResult<T> => {
  const query: QueryResult<T> = {
    sort: jest.fn((_sort: unknown) => query),
    limit: jest.fn((_limit: number) => query),
    lean: jest.fn(() => Promise.resolve(result)),
  };

  return query;
};

type AggregateResult<T> = {
  exec: jest.Mock<Promise<T>, []>;
};

const createAggregate = <T>(result: T): AggregateResult<T> => ({
  exec: jest.fn(() => Promise.resolve(result)),
});

describe('admin conversation service', () => {
  it('caps requested list limit at 50', () => {
    expect(parseListParams({ limit: '99' }).limit).toBe(50);
  });

  it('defaults list limit to 25', () => {
    expect(parseListParams({}).limit).toBe(25);
  });

  it('rejects skip pagination', () => {
    expect(() => parseListParams({ skip: '1' })).toThrow(
      expect.objectContaining({ code: 'invalid_request' }),
    );
  });

  it('rejects anonUserId filtering', () => {
    expect(() => parseListParams({ anonUserId: 'abcdef123456' })).toThrow(
      expect.objectContaining({ code: 'invalid_request' }),
    );
  });

  it('round-trips opaque cursors through the public list service boundary', async () => {
    const firstPageRows = [
      makeConversation('c', '2026-05-14T00:02:00.000Z'),
      makeConversation('b', '2026-05-14T00:01:00.000Z'),
      makeConversation('a', '2026-05-14T00:00:00.000Z'),
    ];
    const secondPageRows = [makeConversation('0', '2026-05-13T23:59:00.000Z')];
    const firstQuery = createQuery(firstPageRows);
    const secondQuery = createQuery(secondPageRows);
    const models = {
      Conversation: {
        find: jest.fn().mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery),
      },
    };

    const firstPage = await listAdminConversations(models, { limit: 2 }, hashSalt);

    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const parsedCursorParams = parseListParams({ cursor: firstPage.nextCursor ?? undefined });

    await listAdminConversations(models, parsedCursorParams, hashSalt);

    expect(models.Conversation.find).toHaveBeenNthCalledWith(2, {
      $or: [
        { updatedAt: { $lt: new Date('2026-05-14T00:01:00.000Z') } },
        { updatedAt: new Date('2026-05-14T00:01:00.000Z'), _id: { $lt: 'b' } },
      ],
    });
  });

  it('passes endpoint, model, agent, and date filters to the conversation model', async () => {
    const conversationQuery = createQuery([]);
    const models = {
      Conversation: {
        find: jest.fn(() => conversationQuery),
      },
    };

    await listAdminConversations(
      models,
      parseListParams({
        endpoint: ['openAI', 'anthropic'],
        model: ['gpt-4', 'gpt-5.5'],
        agentId: ['agent-1', 'agent-2'],
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-14T00:00:00.000Z',
      }),
      hashSalt,
    );

    expect(models.Conversation.find).toHaveBeenCalledWith({
      endpoint: { $in: ['openAI', 'anthropic'] },
      model: { $in: ['gpt-4', 'gpt-5.5'] },
      agent_id: { $in: ['agent-1', 'agent-2'] },
      updatedAt: {
        $gte: new Date('2026-05-01T00:00:00.000Z'),
        $lte: new Date('2026-05-14T00:00:00.000Z'),
      },
    });
  });

  it('lists conversations with one extra row used as next cursor', async () => {
    const rows = [
      makeConversation('c', '2026-05-14T00:02:00.000Z'),
      makeConversation('b', '2026-05-14T00:01:00.000Z'),
      makeConversation('a', '2026-05-14T00:00:00.000Z'),
    ];
    const conversationQuery = createQuery(rows);
    const models = {
      Conversation: {
        find: jest.fn(() => conversationQuery),
      },
    };

    const result = await listAdminConversations(models, { limit: 2 }, hashSalt);

    expect(models.Conversation.find).toHaveBeenCalledWith({});
    expect(conversationQuery.sort).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 });
    expect(conversationQuery.limit).toHaveBeenCalledWith(3);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.conversationId)).toEqual(['convo-c', 'convo-b']);
    expect(parseListParams({ cursor: result.nextCursor ?? undefined })).toMatchObject({
      cursor: { updatedAt: '2026-05-14T00:01:00.000Z', id: 'b' },
    });
  });

  it('normalizes invalid direct caller limits before querying and slicing', async () => {
    const rows = [
      makeConversation('b', '2026-05-14T00:01:00.000Z'),
      makeConversation('a', '2026-05-14T00:00:00.000Z'),
    ];
    const conversationQuery = createQuery(rows);
    const models = {
      Conversation: {
        find: jest.fn(() => conversationQuery),
      },
    };

    const result = await listAdminConversations(models, { limit: 0 }, hashSalt);

    expect(conversationQuery.limit).toHaveBeenCalledWith(2);
    expect(result.items).toHaveLength(1);
    expect(parseListParams({ cursor: result.nextCursor ?? undefined })).toMatchObject({
      cursor: { updatedAt: '2026-05-14T00:01:00.000Z', id: 'b' },
    });
  });

  it('returns latest 1000 messages in ascending render order and marks truncated', async () => {
    const conversation = makeConversation('1', '2026-05-14T00:00:00.000Z');
    const descendingMessages = Array.from({ length: 1001 }, (_, index) =>
      makeMessage(1001 - index),
    );
    const conversationQuery = createQuery(conversation);
    const messageQuery = createQuery(descendingMessages);
    const models = {
      Conversation: {
        findOne: jest.fn(() => conversationQuery),
      },
      Message: {
        find: jest.fn(() => messageQuery),
      },
    };

    const result = await getAdminConversationDetail(models, 'convo-1', hashSalt);

    expect(models.Conversation.findOne).toHaveBeenCalledWith({ conversationId: 'convo-1' });
    expect(models.Message.find).toHaveBeenCalledWith({ conversationId: 'convo-1' });
    expect(messageQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(messageQuery.limit).toHaveBeenCalledWith(1001);
    expect(result?.truncated).toBe(true);
    expect(result?.messages).toHaveLength(1000);
    expect(result?.messages[0].messageId).toBe('message-2');
    expect(result?.messages[999].messageId).toBe('message-1001');
  });

  it('returns null when no conversation exists', async () => {
    const conversationQuery = createQuery(null);
    const models = {
      Conversation: {
        findOne: jest.fn(() => conversationQuery),
      },
      Message: {
        find: jest.fn(),
      },
    };

    await expect(getAdminConversationDetail(models, 'missing-convo', hashSalt)).resolves.toBeNull();
    expect(models.Message.find).not.toHaveBeenCalled();
  });

  it('lists anonymous users grouped by raw owner without exposing raw owner ids', async () => {
    const aggregateResult = createAggregate([
      {
        user: 'raw-user-1',
        anchorConversationId: 'convo-latest-user-1',
        conversationCount: 3,
        latestUpdatedAt: new Date('2026-05-14T00:03:00.000Z'),
      },
      {
        user: 'raw-user-2',
        anchorConversationId: 'convo-latest-user-2',
        conversationCount: 1,
        latestUpdatedAt: '2026-05-13T00:00:00.000Z',
      },
    ]);
    const models = {
      Conversation: {
        aggregate: jest.fn(() => aggregateResult),
      },
    };

    const result = await listAdminConversationUsers(models, hashSalt);

    expect(models.Conversation.aggregate).toHaveBeenCalledWith([
      { $sort: { updatedAt: -1, _id: -1 } },
      {
        $group: {
          _id: '$user',
          anchorConversationId: { $first: '$conversationId' },
          conversationCount: { $sum: 1 },
          latestUpdatedAt: { $first: '$updatedAt' },
        },
      },
      { $sort: { latestUpdatedAt: -1, _id: 1 } },
      { $limit: 200 },
      {
        $project: {
          _id: 0,
          user: '$_id',
          anchorConversationId: 1,
          conversationCount: 1,
          latestUpdatedAt: 1,
        },
      },
    ]);
    expect(result.items).toEqual([
      {
        anonUserId: expect.any(String),
        anchorConversationId: 'convo-latest-user-1',
        conversationCount: 3,
        latestUpdatedAt: '2026-05-14T00:03:00.000Z',
      },
      {
        anonUserId: expect.any(String),
        anchorConversationId: 'convo-latest-user-2',
        conversationCount: 1,
        latestUpdatedAt: '2026-05-13T00:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('raw-user');
  });

  it('lists conversations for the raw owner resolved from an anchor conversation', async () => {
    const anchorQuery = createQuery(makeConversation('anchor', '2026-05-14T00:03:00.000Z'));
    const listQuery = createQuery([
      makeConversation('b', '2026-05-14T00:02:00.000Z'),
      makeConversation('a', '2026-05-14T00:01:00.000Z'),
    ]);
    const models = {
      Conversation: {
        findOne: jest.fn(() => anchorQuery),
        find: jest.fn(() => listQuery),
      },
    };

    const result = await listAdminConversationsForUserAnchor(models, 'convo-anchor', hashSalt);

    expect(models.Conversation.findOne).toHaveBeenCalledWith({ conversationId: 'convo-anchor' });
    expect(models.Conversation.find).toHaveBeenCalledWith({ user: 'user-anchor' });
    expect(listQuery.sort).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 });
    expect(listQuery.limit).toHaveBeenCalledWith(200);
    expect(result?.items.map((item) => item.conversationId)).toEqual(['convo-b', 'convo-a']);
  });

  it('returns null when listing conversations for a missing user anchor', async () => {
    const anchorQuery = createQuery(null);
    const models = {
      Conversation: {
        findOne: jest.fn(() => anchorQuery),
        find: jest.fn(),
      },
    };

    await expect(
      listAdminConversationsForUserAnchor(models, 'missing-anchor', hashSalt),
    ).resolves.toBeNull();
    expect(models.Conversation.find).not.toHaveBeenCalled();
  });
});
