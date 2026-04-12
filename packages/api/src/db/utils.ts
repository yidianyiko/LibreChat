import { logger } from '@librechat/data-schemas';
import type { mongo } from 'mongoose';

const conversationsCollectionName = 'conversations';
const conversationImportSourceIndexName = 'user_1_importSourceId_1';
const conversationImportSourceIndexKey = { user: 1, importSourceId: 1 } as const;
const conversationImportSourcePartialFilterExpression = {
  importSourceId: { $type: 'string' },
} as const;

type MongoIndexDescription = Awaited<ReturnType<mongo.Collection['indexes']>>[number];
type ImportSourceIdTypeFilter = { $type?: string };
type ConversationImportSourcePartialFilter = { importSourceId?: ImportSourceIdTypeFilter };

function isCurrentConversationImportSourceIndex(index: MongoIndexDescription): boolean {
  const partialFilterExpression = index.partialFilterExpression as
    | ConversationImportSourcePartialFilter
    | undefined;

  return (
    index.name === conversationImportSourceIndexName &&
    index.unique === true &&
    index.sparse !== true &&
    partialFilterExpression?.importSourceId?.$type === 'string'
  );
}

/**
 * Ensures that a collection exists in the database.
 * For DocumentDB compatibility, it tries multiple approaches.
 * @param db - The MongoDB database instance
 * @param collectionName - The name of the collection to ensure exists
 */
export async function ensureCollectionExists(db: mongo.Db, collectionName: string): Promise<void> {
  try {
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      await db.createCollection(collectionName);
      logger.info(`Created collection: ${collectionName}`);
    } else {
      logger.debug(`Collection already exists: ${collectionName}`);
    }
  } catch (error) {
    logger.error(`Failed to check/create "${collectionName}" collection:`, error);
    try {
      await db.collection(collectionName).findOne({}, { projection: { _id: 1 } });
    } catch (createError) {
      logger.error(`Could not ensure collection ${collectionName} exists:`, createError);
    }
  }
}

export async function ensureConversationImportSourceIndex(db: mongo.Db): Promise<void> {
  await ensureCollectionExists(db, conversationsCollectionName);

  const collection = db.collection(conversationsCollectionName);
  const existingIndex = (await collection.indexes()).find(
    (index) => index.name === conversationImportSourceIndexName,
  );

  if (existingIndex != null && isCurrentConversationImportSourceIndex(existingIndex)) {
    logger.debug('Conversation importSourceId index is up to date');
    return;
  }

  if (existingIndex != null) {
    logger.info('Replacing legacy conversation importSourceId index');
    await collection.dropIndex(conversationImportSourceIndexName);
  } else {
    logger.info('Creating conversation importSourceId index');
  }

  await collection.createIndex(conversationImportSourceIndexKey, {
    name: conversationImportSourceIndexName,
    unique: true,
    partialFilterExpression: conversationImportSourcePartialFilterExpression,
  });
}

/**
 * Ensures that all required collections exist for the permission system.
 * This includes aclentries, groups, accessroles, and any other collections
 * needed for migrations and permission checks.
 * @param db - The MongoDB database instance
 */
export async function ensureRequiredCollectionsExist(db: mongo.Db): Promise<void> {
  const requiredCollections = [
    'aclentries',
    'groups',
    'accessroles',
    'agents',
    'promptgroups',
    'projects',
  ];

  logger.debug('Ensuring required collections exist for permission system');

  for (const collectionName of requiredCollections) {
    await ensureCollectionExists(db, collectionName);
  }

  logger.debug('All required collections have been checked/created');
}
