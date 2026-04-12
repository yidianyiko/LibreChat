import { Constants } from 'librechat-data-provider';
import { isEligibleWeChatConversation, selectLatestLeafHead } from '../branching';
import { resolveWeChatPreset } from '../presets';
import { WeChatService } from '../service';
import type { WeChatServiceDependencies } from '../types';

function createDependencies(
  overrides: Partial<WeChatServiceDependencies> = {},
): WeChatServiceDependencies {
  return {
    findBindingByUserId: jest.fn(async () => null),
    listUserConversations: jest.fn(async () => []),
    getConversation: jest.fn(async () => null),
    listConversationMessages: jest.fn(async () => []),
    getUserDefaultPreset: jest.fn(async () => null),
    getFallbackPreset: jest.fn(() => ({ endpoint: 'openAI', model: 'gpt-4o', title: 'GPT-4o' })),
    createConversation: jest.fn(async ({ userId, conversationId }) => ({
      conversationId,
      user: userId,
      endpoint: 'openAI',
      model: 'gpt-4o',
    })),
    upsertBinding: jest.fn(async () => null),
    storeSnapshot: jest.fn(async () => undefined),
    getSnapshot: jest.fn(async () => null),
    ...overrides,
  };
}

describe('WeChat service helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('accepts only owner-owned openAI gpt-4o conversations that are not archived or expired', () => {
    expect(
      isEligibleWeChatConversation(
        {
          user: 'user-1',
          endpointType: 'openAI',
          endpoint: 'openAI',
          model: 'gpt-4o',
          isArchived: false,
          expiredAt: null,
        },
        'user-1',
      ),
    ).toBe(true);

    expect(
      isEligibleWeChatConversation(
        {
          user: 'user-1',
          endpointType: 'openAI',
          endpoint: 'openAI',
          model: 'gpt-4o-2024-11-20',
          isArchived: false,
          expiredAt: null,
        },
        'user-1',
      ),
    ).toBe(true);

    expect(
      isEligibleWeChatConversation(
        {
          user: 'other-user',
          endpointType: 'openAI',
          endpoint: 'openAI',
          model: 'gpt-4o',
          isArchived: false,
          expiredAt: null,
        },
        'user-1',
      ),
    ).toBe(false);
  });

  it('falls back to the built-in GPT-4o preset when the user default preset is not eligible', async () => {
    const resolved = await resolveWeChatPreset({
      getUserDefaultPreset: async () => ({ endpoint: 'anthropic', model: 'claude-sonnet-4' }),
      fallbackPreset: { endpoint: 'openAI', model: 'gpt-4o', title: 'GPT-4o Default' },
    });

    expect(resolved.model).toBe('gpt-4o');
    expect(resolved.endpoint).toBe('openAI');
  });

  it('keeps an openAI GPT-4o family preset when the user default preset uses a dated GPT-4o variant', async () => {
    const resolved = await resolveWeChatPreset({
      getUserDefaultPreset: async () => ({
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o-2024-11-20',
      }),
      fallbackPreset: { endpoint: 'openAI', model: 'gpt-4o', title: 'GPT-4o Default' },
    });

    expect(resolved.model).toBe('gpt-4o-2024-11-20');
    expect(resolved.endpoint).toBe('openAI');
  });

  it('returns the no-parent sentinel when a conversation has no messages', () => {
    expect(selectLatestLeafHead([])).toBe(Constants.NO_PARENT);
  });

  it('stores a list snapshot containing only eligible conversations', async () => {
    const deps = createDependencies({
      listUserConversations: jest.fn(async () => [
        {
          conversationId: 'convo-1',
          user: 'user-1',
          endpointType: 'openAI',
          model: 'gpt-4o',
          isArchived: false,
          expiredAt: null,
        },
        {
          conversationId: 'convo-2',
          user: 'user-1',
          endpointType: 'anthropic',
          model: 'claude-sonnet-4',
          isArchived: false,
          expiredAt: null,
        },
      ]),
    });
    const service = new WeChatService(deps);

    const result = await service.listEligibleConversations('user-1');

    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].conversationId).toBe('convo-1');
    expect(deps.storeSnapshot).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        snapshotId: result.snapshotId,
        conversationIds: ['convo-1'],
        createdAt: expect.any(Date),
      }),
    );
  });

  it('requires a valid list snapshot before switching conversations', async () => {
    const deps = createDependencies();
    const service = new WeChatService(deps);

    await expect(
      service.switchConversation('user-1', { snapshotId: 'missing-snapshot', index: 1 }),
    ).rejects.toThrow('请先执行 /list');
  });

  it('rejects switching when snapshotId is missing', async () => {
    const deps = createDependencies();
    const service = new WeChatService(deps);

    await expect(service.switchConversation('user-1', { snapshotId: '', index: 1 })).rejects.toThrow(
      '请先执行 /list',
    );
  });

  it('rejects switching when the latest snapshotId does not match', async () => {
    const deps = createDependencies({
      getSnapshot: jest.fn(async () => ({
        snapshotId: 'snapshot-1',
        conversationIds: ['convo-1'],
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
      })),
    });
    const service = new WeChatService(deps);

    await expect(
      service.switchConversation('user-1', { snapshotId: 'stale-snapshot', index: 1 }),
    ).rejects.toThrow('请先执行 /list');
  });

  it('rejects switching when the snapshot is expired', async () => {
    const deps = createDependencies({
      getSnapshot: jest.fn(async () => ({
        snapshotId: 'snapshot-1',
        conversationIds: ['convo-1'],
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
        expiresAt: new Date('2026-04-12T00:00:01.000Z'),
      })),
    });
    const service = new WeChatService(deps);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-12T00:00:02.000Z'));

    await expect(
      service.switchConversation('user-1', { snapshotId: 'snapshot-1', index: 1 }),
    ).rejects.toThrow('请先执行 /list');

    jest.useRealTimers();
  });

  it('rejects switching when the selected index is out of range', async () => {
    const deps = createDependencies({
      getSnapshot: jest.fn(async () => ({
        snapshotId: 'snapshot-1',
        conversationIds: ['convo-1'],
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
      })),
    });
    const service = new WeChatService(deps);

    await expect(
      service.switchConversation('user-1', { snapshotId: 'snapshot-1', index: 2 }),
    ).rejects.toThrow('请先执行 /list');
  });

  it('selects the latest assistant leaf when switching from a valid snapshot', async () => {
    const deps = createDependencies({
      getSnapshot: jest.fn(async () => ({
        snapshotId: 'snapshot-1',
        conversationIds: ['convo-1'],
        createdAt: new Date('2026-04-12T00:00:00.000Z'),
      })),
      getConversation: jest.fn(async () => ({
        conversationId: 'convo-1',
        user: 'user-1',
        endpointType: 'openAI',
        model: 'gpt-4o',
        isArchived: false,
        expiredAt: null,
      })),
      listConversationMessages: jest.fn(async () => [
        {
          messageId: 'assistant-leaf',
          parentMessageId: 'root',
          createdAt: new Date('2026-04-12T00:10:00.000Z'),
          isCreatedByUser: false,
        },
        {
          messageId: 'user-leaf',
          parentMessageId: 'root',
          createdAt: new Date('2026-04-12T00:10:00.000Z'),
          isCreatedByUser: true,
        },
        {
          messageId: 'root',
          parentMessageId: Constants.NO_PARENT,
          createdAt: new Date('2026-04-12T00:00:00.000Z'),
          isCreatedByUser: true,
        },
      ]),
    });
    const service = new WeChatService(deps);

    const result = await service.switchConversation('user-1', {
      snapshotId: 'snapshot-1',
      index: 1,
    });

    expect(result.parentMessageId).toBe('assistant-leaf');
    expect(deps.upsertBinding).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        currentConversation: expect.objectContaining({
          conversationId: 'convo-1',
          parentMessageId: 'assistant-leaf',
          source: 'switch',
        }),
      }),
    );
  });

  it('unbinds without writing ilinkUserId back as null', async () => {
    const deps = createDependencies({
      findBindingByUserId: jest.fn(async () => null),
    });
    const service = new WeChatService(deps);

    await service.unbind('user-1');

    expect(deps.upsertBinding).toHaveBeenCalledWith(
      'user-1',
      expect.not.objectContaining({
        ilinkUserId: null,
      }),
    );
    expect(deps.upsertBinding).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        ilinkBotId: null,
        botToken: null,
        baseUrl: null,
        status: 'unbound',
        boundAt: null,
        unhealthyAt: null,
        unboundAt: expect.any(Date),
        currentConversation: null,
      }),
    );
  });
});
