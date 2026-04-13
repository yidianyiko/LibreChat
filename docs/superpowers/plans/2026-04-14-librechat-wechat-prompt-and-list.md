# LibreChat WeChat Prompt And List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WeChat fallback conversations inherit the global default GPT-4o prompt behavior and make `/list` return only the 10 most recent eligible conversations.

**Architecture:** Keep the existing WeChat flow intact. Change fallback preset resolution at the route boundary so newly created WeChat conversations persist the repo's default GPT-4o configuration, then tighten conversation listing inside the TypeScript WeChat service so sorting and snapshot order stay consistent with `/switch`.

**Tech Stack:** Node.js, Express, TypeScript, Jest, Mongoose models

---

### Task 1: Lock In `/list` Recency And Limit Behavior

**Files:**
- Modify: `packages/api/src/wechat/__tests__/service.test.ts`
- Modify: `packages/api/src/wechat/service.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('stores only the 10 most recent eligible conversations in snapshot order', async () => {
    const deps = createDependencies({
      listUserConversations: jest.fn(async () =>
        Array.from({ length: 12 }, (_, index) => ({
          conversationId: `convo-${index + 1}`,
          user: 'user-1',
          endpointType: 'openAI',
          model: 'gpt-4o',
          isArchived: false,
          expiredAt: null,
          updatedAt: new Date(`2026-04-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
        })),
      ),
    });
    const service = new WeChatService(deps);

    const result = await service.listEligibleConversations('user-1');

    expect(result.conversations).toHaveLength(10);
    expect(result.conversations.map((conversation) => conversation.conversationId)).toEqual([
      'convo-12',
      'convo-11',
      'convo-10',
      'convo-9',
      'convo-8',
      'convo-7',
      'convo-6',
      'convo-5',
      'convo-4',
      'convo-3',
    ]);
    expect(deps.storeSnapshot).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        conversationIds: [
          'convo-12',
          'convo-11',
          'convo-10',
          'convo-9',
          'convo-8',
          'convo-7',
          'convo-6',
          'convo-5',
          'convo-4',
          'convo-3',
        ],
      }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && npx jest src/wechat/__tests__/service.test.ts --runInBand`
Expected: FAIL because the service currently returns every eligible conversation in original query order.

- [ ] **Step 3: Write minimal implementation**

```ts
const MAX_WECHAT_LIST_CONVERSATIONS = 10;

function getConversationUpdatedAt(value?: Date | null): number {
  return value instanceof Date ? value.getTime() : 0;
}

async listEligibleConversations(userId: string) {
  const conversations = await this.deps.listUserConversations(userId);
  const eligibleConversations = conversations
    .filter((conversation) => isEligibleWeChatConversation(conversation, userId))
    .sort((left, right) => getConversationUpdatedAt(right.updatedAt) - getConversationUpdatedAt(left.updatedAt))
    .slice(0, MAX_WECHAT_LIST_CONVERSATIONS);

  const snapshotId = crypto.randomUUID();
  await this.deps.storeSnapshot(userId, {
    snapshotId,
    conversationIds: eligibleConversations.map((conversation) => conversation.conversationId),
    createdAt: new Date(),
  });

  return { snapshotId, conversations: eligibleConversations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api && npx jest src/wechat/__tests__/service.test.ts --runInBand`
Expected: PASS with the new recency-ordered 10-item snapshot assertion green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/wechat/service.ts packages/api/src/wechat/__tests__/service.test.ts
git commit -m "fix: limit wechat conversation list to recent items"
```

### Task 2: Lock In WeChat Fallback Prompt Inheritance

**Files:**
- Modify: `api/server/routes/__tests__/wechat.spec.js`
- Modify: `api/server/routes/wechat.js`

- [ ] **Step 1: Write the failing test**

```js
  it('uses the global default preset fields for WeChat fallback conversations', async () => {
    mockConversationCreate.mockResolvedValue({
      toObject: () => ({ conversationId: 'convo-1', title: 'GPT-4o Default' }),
    });

    await capturedWeChatServiceDeps.createConversation({
      userId: 'user-1',
      conversationId: 'convo-1',
      preset: capturedWeChatServiceDeps.getFallbackPreset(),
    });

    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'openAI',
        model: 'gpt-4o',
        title: 'GPT-4o Default',
        system: expect.stringContaining('Engage warmly yet honestly with the user.'),
      }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
Expected: FAIL because the inline fallback currently omits `system`.

- [ ] **Step 3: Write minimal implementation**

```js
const path = require('path');
const {
  DEFAULT_PRESET_CONFIG,
} = require(path.resolve(__dirname, '..', '..', '..', 'config', 'default-preset'));

const cloneDefaultPreset = () => ({
  ...DEFAULT_PRESET_CONFIG,
});

// ...
  getFallbackPreset: () => cloneDefaultPreset(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
Expected: PASS with the fallback conversation retaining `system` and default title/model.

- [ ] **Step 5: Commit**

```bash
git add api/server/routes/wechat.js api/server/routes/__tests__/wechat.spec.js
git commit -m "fix: reuse default preset for wechat fallback"
```

### Task 3: Regression Verification

**Files:**
- Test: `packages/api/src/wechat/__tests__/service.test.ts`
- Test: `api/server/routes/__tests__/wechat.spec.js`
- Optional review: `git diff -- packages/api/src/wechat/service.ts api/server/routes/wechat.js`

- [ ] **Step 1: Run focused Jest coverage**

Run: `cd /data/projects/LibreChat && npm exec --workspaces=false -- jest api/server/routes/__tests__/wechat.spec.js packages/api/src/wechat/__tests__/service.test.ts --runInBand`
Expected: PASS for both suites.

- [ ] **Step 2: Review the final diff**

```bash
git diff -- packages/api/src/wechat/service.ts api/server/routes/wechat.js api/server/routes/__tests__/wechat.spec.js packages/api/src/wechat/__tests__/service.test.ts
```

Expected: Only the WeChat fallback preset and recent-10 listing changes appear.

- [ ] **Step 3: Commit**

```bash
git add api/server/routes/wechat.js api/server/routes/__tests__/wechat.spec.js packages/api/src/wechat/service.ts packages/api/src/wechat/__tests__/service.test.ts docs/superpowers/specs/2026-04-14-librechat-wechat-prompt-and-list-design.md docs/superpowers/plans/2026-04-14-librechat-wechat-prompt-and-list.md
git commit -m "fix: improve wechat prompt inheritance and list output"
```
