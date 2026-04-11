import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';

describe('WeChatBinding model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    createModels(mongoose);
    await mongoose.models.WeChatBinding.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await mongoose.models.WeChatBinding.deleteMany({});
  });

  it('stores one binding per user and one active ilinkUserId globally', async () => {
    const WeChatBinding = mongoose.models.WeChatBinding;

    await WeChatBinding.create({
      userId: 'user-1',
      ilinkBotId: 'bot-1',
      botToken: 'enc-token-1',
      baseUrl: 'https://ilink.example',
      ilinkUserId: 'wechat-1',
      status: 'healthy',
      boundAt: new Date('2026-04-11T10:00:00.000Z'),
      currentConversation: {
        conversationId: 'convo-1',
        parentMessageId: 'msg-1',
        selectedAt: new Date('2026-04-11T10:01:00.000Z'),
        lastAdvancedAt: new Date('2026-04-11T10:02:00.000Z'),
        source: 'switch',
      },
    });

    const stored = await WeChatBinding.findOne({ userId: 'user-1' });
    expect(stored?.currentConversation).toMatchObject({
      conversationId: 'convo-1',
      parentMessageId: 'msg-1',
      source: 'switch',
    });
    expect(stored?.currentConversation?.selectedAt).toEqual(new Date('2026-04-11T10:01:00.000Z'));
    expect(stored?.currentConversation?.lastAdvancedAt).toEqual(
      new Date('2026-04-11T10:02:00.000Z'),
    );

    await expect(
      WeChatBinding.create({
        userId: 'user-2',
        ilinkBotId: 'bot-2',
        botToken: 'enc-token-2',
        baseUrl: 'https://ilink.example',
        ilinkUserId: 'wechat-1',
        status: 'healthy',
        boundAt: new Date('2026-04-11T10:03:00.000Z'),
      }),
    ).rejects.toThrow(/duplicate key/i);

    await expect(
      WeChatBinding.create({
        userId: 'user-1',
        ilinkBotId: 'bot-3',
        botToken: 'enc-token-3',
        baseUrl: 'https://ilink.example',
        ilinkUserId: 'wechat-2',
        status: 'healthy',
        boundAt: new Date('2026-04-11T10:04:00.000Z'),
      }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('allows multiple bindings when ilinkUserId is omitted', async () => {
    const WeChatBinding = mongoose.models.WeChatBinding;

    await WeChatBinding.create({
      userId: 'user-3',
      ilinkBotId: 'bot-3',
      botToken: 'enc-token-3',
      baseUrl: 'https://ilink.example',
      status: 'unbound',
      boundAt: new Date('2026-04-11T10:05:00.000Z'),
    });

    await WeChatBinding.create({
      userId: 'user-4',
      ilinkBotId: 'bot-4',
      botToken: 'enc-token-4',
      baseUrl: 'https://ilink.example',
      status: 'unbound',
      boundAt: new Date('2026-04-11T10:06:00.000Z'),
    });

    const omittedBindings = await WeChatBinding.find({
      userId: { $in: ['user-3', 'user-4'] },
      ilinkUserId: { $exists: false },
    });

    expect(omittedBindings).toHaveLength(2);
  });
});
