import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureConversationImportSourceIndex } from './utils';

describe('ensureConversationImportSourceIndex', () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    client = new MongoClient(mongoServer.getUri());
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await client.db().dropDatabase();
  });

  it('replaces the legacy sparse conversation importSourceId index with the partial string index', async () => {
    const db = client.db();
    const collection = db.collection('conversations');

    await collection.insertOne({ conversationId: 'convo-1', user: 'user-1' });
    await collection.createIndex(
      { user: 1, importSourceId: 1 },
      { name: 'user_1_importSourceId_1', unique: true, sparse: true },
    );

    await ensureConversationImportSourceIndex(db);

    const index = (await collection.indexes()).find((item) => item.name === 'user_1_importSourceId_1');

    expect(index).toMatchObject({
      name: 'user_1_importSourceId_1',
      key: { user: 1, importSourceId: 1 },
      unique: true,
      partialFilterExpression: { importSourceId: { $type: 'string' } },
    });
    expect(index).not.toHaveProperty('sparse');
  });
});
