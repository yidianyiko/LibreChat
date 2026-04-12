import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';

describe('Conversation model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    createModels(mongoose);
    await mongoose.models.Conversation.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await mongoose.models.Conversation.deleteMany({});
  });

  it('allows multiple conversations for the same user when importSourceId is omitted', async () => {
    const Conversation = mongoose.models.Conversation;

    await Conversation.create({
      conversationId: 'convo-1',
      user: 'user-1',
      endpoint: 'openAI',
      endpointType: 'openAI',
      model: 'gpt-4o-2024-11-20',
      title: 'First',
    });

    await expect(
      Conversation.create({
        conversationId: 'convo-2',
        user: 'user-1',
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o-2024-11-20',
        title: 'Second',
      }),
    ).resolves.toMatchObject({
      conversationId: 'convo-2',
      user: 'user-1',
    });
  });

  it('still rejects duplicate importSourceId values for the same user', async () => {
    const Conversation = mongoose.models.Conversation;

    await Conversation.create({
      conversationId: 'convo-3',
      user: 'user-1',
      endpoint: 'openAI',
      endpointType: 'openAI',
      model: 'gpt-4o-2024-11-20',
      title: 'Imported one',
      importSourceId: 'chatgpt:123',
    });

    await expect(
      Conversation.create({
        conversationId: 'convo-4',
        user: 'user-1',
        endpoint: 'openAI',
        endpointType: 'openAI',
        model: 'gpt-4o-2024-11-20',
        title: 'Imported duplicate',
        importSourceId: 'chatgpt:123',
      }),
    ).rejects.toThrow(/duplicate key/i);
  });
});
