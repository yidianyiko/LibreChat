# Conversation Import Deduplication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent duplicate conversations when users re-import the same ChatGPT or Claude export file, by tracking original source IDs and skipping already-imported conversations.

**Architecture:** Add an `importSourceId` field to the Conversation schema that stores `{platform}:{originalId}` (e.g., `chatgpt:d6523d1e-...` or `claude:conv-123`). Before importing, batch-query existing `importSourceId` values for the user, then skip conversations whose source ID already exists. Strategy: skip duplicates (no update/overwrite). Only applies to ChatGPT and Claude imports (they have reliable original IDs). ChatbotUI and LibreChat formats are unaffected.

**Tech Stack:** Mongoose (schema + query), Node.js, Jest

---

## Design Notes

### Source ID format

`{platform}:{originalId}` in a single string field:
- ChatGPT: `chatgpt:{conv.id}` — e.g., `chatgpt:d6523d1e-7ec3-474f-a363-0e9dffdb3d93`
- Claude: `claude:{conv.uuid}` — e.g., `claude:conv-123`

### Why not separate fields?

A single `importSourceId` field with platform prefix is simpler than two fields (`importSource` + `importOriginalId`). The prefix makes values globally unique, and one sparse index is cheaper than a compound index.

### Query strategy

Before processing conversations, collect all source IDs from the import data, then do a single `Conversation.find({ user, importSourceId: { $in: [...] } })` query. Build a Set of existing IDs and skip matching conversations during iteration. This is O(1) lookup per conversation after the initial query.

### What changes

| File | Change |
|------|--------|
| `packages/data-schemas/src/schema/convo.ts` | Add `importSourceId` field with sparse index |
| `api/models/Conversation.js` | Add `getExistingImportSourceIds()` query function |
| `api/server/utils/import/importers.js` | Add dedup logic to `importChatGptConvo` and `importClaudeConvo` |
| `api/server/utils/import/importBatchBuilder.js` | Pass `importSourceId` through to conversation object |
| `api/server/utils/import/importers.spec.js` | Add dedup tests |

---

## Task 1: Add `importSourceId` field to Conversation schema

**Files:**
- Modify: `packages/data-schemas/src/schema/convo.ts:5-51`

### Step 1: Add the field and index

In `packages/data-schemas/src/schema/convo.ts`, add the `importSourceId` field to the schema definition (after `files`) and a sparse unique compound index:

```typescript
// Add to schema definition, after the `files` field:
importSourceId: {
  type: String,
},
```

Add a compound index after the existing indexes (after line 49):

```typescript
convoSchema.index({ user: 1, importSourceId: 1 }, { unique: true, sparse: true });
```

### Step 2: Rebuild data-schemas package

Run: `npm run build:data-schemas 2>&1 | tail -5`
Expected: Build succeeds

### Step 3: Commit

```bash
git add packages/data-schemas/src/schema/convo.ts
git commit -m "feat: add importSourceId field to Conversation schema for dedup"
```

---

## Task 2: Add `getExistingImportSourceIds()` query function

**Files:**
- Modify: `api/models/Conversation.js:78` (add before `module.exports`)

### Step 1: Write the failing test

Add to `api/models/Conversation.spec.js` (or create if needed). However, since the existing test infrastructure mocks Mongoose, we'll test this through the importer integration tests in Task 5. For now, just implement the function.

### Step 2: Add the query function

In `api/models/Conversation.js`, add this function before the `module.exports`:

```javascript
/**
 * Given a user ID and an array of importSourceId values, returns the subset
 * that already exist in the database. Used for deduplication during import.
 * @param {string} user - The user's ID.
 * @param {string[]} importSourceIds - Array of importSourceId values to check.
 * @returns {Promise<Set<string>>} Set of importSourceIds that already exist.
 */
const getExistingImportSourceIds = async (user, importSourceIds) => {
  if (!importSourceIds.length) {
    return new Set();
  }
  try {
    const existing = await Conversation.find(
      { user, importSourceId: { $in: importSourceIds } },
      'importSourceId',
    ).lean();
    return new Set(existing.map((c) => c.importSourceId));
  } catch (error) {
    logger.error('[getExistingImportSourceIds] Error checking existing imports', error);
    throw new Error('Error checking existing imports');
  }
};
```

Export it in `module.exports`:

```javascript
module.exports = {
  getExistingImportSourceIds,
  getConvoFiles,
  // ... rest of existing exports
```

### Step 3: Commit

```bash
git add api/models/Conversation.js
git commit -m "feat: add getExistingImportSourceIds query for import dedup"
```

---

## Task 3: Pass `importSourceId` through ImportBatchBuilder

**Files:**
- Modify: `api/server/utils/import/importBatchBuilder.js:36-41,77-93`

### Step 1: Update `startConversation` to accept `importSourceId`

In `importBatchBuilder.js`, modify `startConversation`:

```javascript
/**
 * Starts a new conversation in the batch.
 * @param {string} [endpoint=EModelEndpoint.openAI] - The endpoint for the conversation.
 * @param {string} [importSourceId] - Original source ID for deduplication (e.g., "chatgpt:abc123").
 * @returns {void}
 */
startConversation(endpoint, importSourceId) {
  this.endpoint = endpoint || EModelEndpoint.openAI;
  this.conversationId = uuidv4();
  this.lastMessageId = Constants.NO_PARENT;
  this.importSourceId = importSourceId || undefined;
}
```

### Step 2: Update `finishConversation` to include `importSourceId`

In the `finishConversation` method, add `importSourceId` to the convo object:

```javascript
finishConversation(title, createdAt, originalConvo = {}) {
  const convo = {
    ...originalConvo,
    user: this.requestUserId,
    conversationId: this.conversationId,
    title: title || 'Imported Chat',
    createdAt: createdAt,
    updatedAt: createdAt,
    overrideTimestamp: true,
    endpoint: this.endpoint,
    model: originalConvo.model ?? openAISettings.model.default,
  };
  if (this.importSourceId) {
    convo.importSourceId = this.importSourceId;
  }
  convo._id && delete convo._id;
  this.conversations.push(convo);

  return { conversation: convo, messages: this.messages };
}
```

### Step 3: Commit

```bash
git add api/server/utils/import/importBatchBuilder.js
git commit -m "feat: pass importSourceId through ImportBatchBuilder"
```

---

## Task 4: Add dedup logic to ChatGPT and Claude importers

**Files:**
- Modify: `api/server/utils/import/importers.js:1-7,289-303,114-183`

### Step 1: Import the query function

At the top of `importers.js`, add the import:

```javascript
const { getExistingImportSourceIds } = require('~/models/Conversation');
```

### Step 2: Add dedup to `importChatGptConvo`

Replace the `importChatGptConvo` function (lines 289-303):

```javascript
async function importChatGptConvo(
  jsonData,
  requestUserId,
  builderFactory = createImportBatchBuilder,
) {
  try {
    // Build source IDs for dedup lookup
    const sourceIds = jsonData
      .filter((conv) => conv.id)
      .map((conv) => `chatgpt:${conv.id}`);
    const existingIds = await getExistingImportSourceIds(requestUserId, sourceIds);

    const importBatchBuilder = builderFactory(requestUserId);
    let skipped = 0;
    for (const conv of jsonData) {
      const sourceId = conv.id ? `chatgpt:${conv.id}` : null;
      if (sourceId && existingIds.has(sourceId)) {
        skipped++;
        continue;
      }
      processConversation(conv, importBatchBuilder, requestUserId, sourceId);
    }
    await importBatchBuilder.saveBatch();
    if (skipped > 0) {
      logger.info(
        `user: ${requestUserId} | ChatGPT import: skipped ${skipped} duplicate conversation(s)`,
      );
    }
  } catch (error) {
    logger.error(`user: ${requestUserId} | Error creating conversation from imported file`, error);
  }
}
```

### Step 3: Update `processConversation` to accept and pass `importSourceId`

Modify the `processConversation` function signature (line 314) to accept `importSourceId`:

```javascript
function processConversation(conv, importBatchBuilder, requestUserId, importSourceId) {
```

Update the `startConversation` call (line 315) to pass it:

```javascript
importBatchBuilder.startConversation(EModelEndpoint.openAI, importSourceId);
```

No other changes needed in `processConversation` — `finishConversation` already picks up `importSourceId` from the builder.

### Step 4: Add dedup to `importClaudeConvo`

Replace the `importClaudeConvo` function (lines 114-183):

```javascript
async function importClaudeConvo(
  jsonData,
  requestUserId,
  builderFactory = createImportBatchBuilder,
) {
  try {
    // Build source IDs for dedup lookup
    const sourceIds = jsonData
      .filter((conv) => conv.uuid)
      .map((conv) => `claude:${conv.uuid}`);
    const existingIds = await getExistingImportSourceIds(requestUserId, sourceIds);

    const importBatchBuilder = builderFactory(requestUserId);
    let skipped = 0;

    for (const conv of jsonData) {
      const sourceId = conv.uuid ? `claude:${conv.uuid}` : null;
      if (sourceId && existingIds.has(sourceId)) {
        skipped++;
        continue;
      }

      importBatchBuilder.startConversation(EModelEndpoint.anthropic, sourceId);

      let lastMessageId = Constants.NO_PARENT;
      let lastTimestamp = null;

      for (const msg of conv.chat_messages || []) {
        const isCreatedByUser = msg.sender === 'human';
        const messageId = uuidv4();

        const { textContent, thinkingContent } = extractClaudeContent(msg);

        if (!textContent && !thinkingContent) {
          continue;
        }

        const messageTime = msg.created_at || conv.created_at;
        let createdAt = messageTime ? new Date(messageTime) : new Date();

        if (lastTimestamp && createdAt <= lastTimestamp) {
          createdAt = new Date(lastTimestamp.getTime() + 1);
        }
        lastTimestamp = createdAt;

        const message = {
          messageId,
          parentMessageId: lastMessageId,
          text: textContent,
          sender: isCreatedByUser ? 'user' : 'Claude',
          isCreatedByUser,
          user: requestUserId,
          endpoint: EModelEndpoint.anthropic,
          createdAt,
        };

        if (thinkingContent && !isCreatedByUser) {
          message.content = [
            { type: 'think', think: thinkingContent },
            { type: 'text', text: textContent },
          ];
        }

        importBatchBuilder.saveMessage(message);
        lastMessageId = messageId;
      }

      const createdAt = conv.created_at ? new Date(conv.created_at) : new Date();
      importBatchBuilder.finishConversation(conv.name || 'Imported Claude Chat', createdAt);
    }

    await importBatchBuilder.saveBatch();
    if (skipped > 0) {
      logger.info(
        `user: ${requestUserId} | Claude import: skipped ${skipped} duplicate conversation(s)`,
      );
    }
  } catch (error) {
    logger.error(`user: ${requestUserId} | Error creating conversation from Claude file`, error);
  }
}
```

### Step 5: Commit

```bash
git add api/server/utils/import/importers.js
git commit -m "feat: add conversation-level dedup for ChatGPT and Claude imports"
```

---

## Task 5: Add dedup tests

**Files:**
- Modify: `api/server/utils/import/importers.spec.js`

### Step 1: Update mocks

At the top of `importers.spec.js`, update the Conversation mock (line 17-19) to include the new function:

```javascript
jest.mock('~/models/Conversation', () => ({
  bulkSaveConvos: jest.fn(),
  getExistingImportSourceIds: jest.fn().mockResolvedValue(new Set()),
}));
```

Add the import for the new function after the existing imports:

```javascript
const { getExistingImportSourceIds } = require('~/models/Conversation');
```

### Step 2: Write ChatGPT dedup tests

Add a new `describe` block after the existing ChatGPT tests (before the LibreChat tests):

```javascript
describe('importChatGptConvo deduplication', () => {
  it('should skip conversations that already exist by importSourceId', async () => {
    const jsonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '__data__', 'chatgpt-export.json'), 'utf8'),
    );
    const requestUserId = 'user-dedup-test';

    // Simulate that the first conversation already exists
    const firstConvId = jsonData[0].id;
    getExistingImportSourceIds.mockResolvedValueOnce(
      new Set([`chatgpt:${firstConvId}`]),
    );

    const importBatchBuilder = new ImportBatchBuilder(requestUserId);
    jest.spyOn(importBatchBuilder, 'startConversation');
    jest.spyOn(importBatchBuilder, 'saveBatch').mockResolvedValue();

    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId, () => importBatchBuilder);

    // Should have started fewer conversations than total in the file
    const totalConvos = jsonData.length;
    expect(importBatchBuilder.startConversation).toHaveBeenCalledTimes(totalConvos - 1);
  });

  it('should skip all conversations when all already exist', async () => {
    const jsonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '__data__', 'chatgpt-export.json'), 'utf8'),
    );
    const requestUserId = 'user-dedup-test';

    // Simulate all conversations already exist
    const allSourceIds = new Set(jsonData.map((conv) => `chatgpt:${conv.id}`));
    getExistingImportSourceIds.mockResolvedValueOnce(allSourceIds);

    const importBatchBuilder = new ImportBatchBuilder(requestUserId);
    jest.spyOn(importBatchBuilder, 'startConversation');
    jest.spyOn(importBatchBuilder, 'saveBatch').mockResolvedValue();

    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId, () => importBatchBuilder);

    expect(importBatchBuilder.startConversation).not.toHaveBeenCalled();
  });

  it('should import all conversations when none exist yet', async () => {
    const jsonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '__data__', 'chatgpt-export.json'), 'utf8'),
    );
    const requestUserId = 'user-dedup-test';

    // No existing imports
    getExistingImportSourceIds.mockResolvedValueOnce(new Set());

    const importBatchBuilder = new ImportBatchBuilder(requestUserId);
    jest.spyOn(importBatchBuilder, 'startConversation');
    jest.spyOn(importBatchBuilder, 'saveBatch').mockResolvedValue();

    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId, () => importBatchBuilder);

    expect(importBatchBuilder.startConversation).toHaveBeenCalledTimes(jsonData.length);
  });

  it('should store importSourceId in conversation via startConversation', async () => {
    const jsonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '__data__', 'chatgpt-export.json'), 'utf8'),
    );
    const requestUserId = 'user-dedup-test';
    getExistingImportSourceIds.mockResolvedValueOnce(new Set());

    const importBatchBuilder = new ImportBatchBuilder(requestUserId);
    jest.spyOn(importBatchBuilder, 'startConversation');
    jest.spyOn(importBatchBuilder, 'saveBatch').mockResolvedValue();

    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId, () => importBatchBuilder);

    // Verify importSourceId was passed for the first conversation
    const firstCall = importBatchBuilder.startConversation.mock.calls[0];
    expect(firstCall[0]).toBe(EModelEndpoint.openAI);
    expect(firstCall[1]).toBe(`chatgpt:${jsonData[0].id}`);
  });
});
```

### Step 3: Write Claude dedup tests

Add a new `describe` block after the existing Claude tests:

```javascript
describe('importClaudeConvo deduplication', () => {
  it('should skip conversations that already exist by importSourceId', async () => {
    const jsonData = [
      {
        uuid: 'conv-existing',
        name: 'Already Imported',
        created_at: '2025-01-15T10:00:00.000Z',
        chat_messages: [
          {
            uuid: 'msg-1',
            sender: 'human',
            created_at: '2025-01-15T10:00:01.000Z',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      },
      {
        uuid: 'conv-new',
        name: 'New Conversation',
        created_at: '2025-01-15T11:00:00.000Z',
        chat_messages: [
          {
            uuid: 'msg-2',
            sender: 'human',
            created_at: '2025-01-15T11:00:01.000Z',
            content: [{ type: 'text', text: 'Hi there' }],
          },
        ],
      },
    ];

    const requestUserId = 'user-claude-dedup';

    // First conversation already exists
    getExistingImportSourceIds.mockResolvedValueOnce(
      new Set(['claude:conv-existing']),
    );

    const importBatchBuilder = new ImportBatchBuilder(requestUserId);
    jest.spyOn(importBatchBuilder, 'startConversation');
    jest.spyOn(importBatchBuilder, 'saveMessage');
    jest.spyOn(importBatchBuilder, 'saveBatch').mockResolvedValue();

    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId, () => importBatchBuilder);

    // Only the new conversation should be imported
    expect(importBatchBuilder.startConversation).toHaveBeenCalledTimes(1);
    expect(importBatchBuilder.saveMessage).toHaveBeenCalledTimes(1);

    const savedMsg = importBatchBuilder.saveMessage.mock.calls[0][0];
    expect(savedMsg.text).toBe('Hi there');
  });

  it('should store importSourceId in conversation via startConversation', async () => {
    const jsonData = [
      {
        uuid: 'conv-456',
        name: 'Test',
        created_at: '2025-01-15T10:00:00.000Z',
        chat_messages: [
          {
            uuid: 'msg-1',
            sender: 'human',
            created_at: '2025-01-15T10:00:01.000Z',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      },
    ];

    const requestUserId = 'user-claude-dedup';
    getExistingImportSourceIds.mockResolvedValueOnce(new Set());

    const importBatchBuilder = new ImportBatchBuilder(requestUserId);
    jest.spyOn(importBatchBuilder, 'startConversation');
    jest.spyOn(importBatchBuilder, 'saveBatch').mockResolvedValue();

    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId, () => importBatchBuilder);

    expect(importBatchBuilder.startConversation).toHaveBeenCalledWith(
      EModelEndpoint.anthropic,
      'claude:conv-456',
    );
  });
});
```

### Step 4: Run tests to verify they pass

Run: `cd api && npm test -- server/utils/import/importers.spec.js --no-coverage 2>&1 | tail -30`
Expected: All tests pass, including new dedup tests

### Step 5: Commit

```bash
git add api/server/utils/import/importers.spec.js
git commit -m "test: add conversation dedup tests for ChatGPT and Claude imports"
```

---

## Task 6: Add ImportBatchBuilder tests for importSourceId

**Files:**
- Modify: `api/server/utils/import/importers.spec.js` (add near existing builder tests, or in a new block)

### Step 1: Write tests for ImportBatchBuilder importSourceId passthrough

Add within the existing test file:

```javascript
describe('ImportBatchBuilder importSourceId', () => {
  it('should include importSourceId in finished conversation when provided', () => {
    const builder = new ImportBatchBuilder('user-123');
    builder.startConversation(EModelEndpoint.openAI, 'chatgpt:abc-123');
    builder.addUserMessage('Hello');
    const { conversation } = builder.finishConversation('Test', new Date());

    expect(conversation.importSourceId).toBe('chatgpt:abc-123');
  });

  it('should not include importSourceId when not provided', () => {
    const builder = new ImportBatchBuilder('user-123');
    builder.startConversation(EModelEndpoint.openAI);
    builder.addUserMessage('Hello');
    const { conversation } = builder.finishConversation('Test', new Date());

    expect(conversation.importSourceId).toBeUndefined();
  });
});
```

### Step 2: Run tests to verify

Run: `cd api && npm test -- server/utils/import/importers.spec.js --no-coverage 2>&1 | tail -30`
Expected: All tests pass

### Step 3: Commit

```bash
git add api/server/utils/import/importers.spec.js
git commit -m "test: add ImportBatchBuilder importSourceId passthrough tests"
```

---

## Task 7: Build packages and run full test suite

### Step 1: Rebuild data-schemas

Run: `npm run build:data-schemas 2>&1 | tail -5`
Expected: Build succeeds

### Step 2: Run all import-related tests

Run: `cd api && npm test -- server/utils/import/ --no-coverage 2>&1 | tail -30`
Expected: All tests pass

### Step 3: Run full API test suite

Run: `npm run test:api 2>&1 | tail -20`
Expected: No regressions

### Step 4: Commit (if any build artifacts changed)

```bash
git status
# Only commit if there are meaningful changes
```
