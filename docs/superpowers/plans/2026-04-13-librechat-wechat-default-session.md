# LibreChat WeChat Default Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WeChat bindings feel immediately usable by auto-creating the default current conversation on bind success, sending a first welcome message after each bind/rebind, and lazily creating a conversation for plain-text cold starts that still lack a current conversation.

**Architecture:** Keep all changes inside the TypeScript WeChat bridge layer. Extend the bind-success resolver with best-effort post-bind side effects, expose the welcome text from bridge command helpers, and update plain-text handling to auto-create a current conversation only when none exists. Preserve existing command semantics and storage contracts.

**Tech Stack:** TypeScript, Jest, Express-side bridge callbacks, existing WeChat bridge transport helpers

---

### Task 1: Add bind-success regression coverage

**Files:**
- Modify: `packages/api/src/wechat/bridge/__tests__/main.test.ts`
- Modify: `packages/api/src/wechat/bridge/bindStatus.ts`
- Modify: `packages/api/src/wechat/bridge/commands.ts`

- [ ] **Step 1: Write the failing test**

Append a focused regression to `packages/api/src/wechat/bridge/__tests__/main.test.ts` that boots the bridge with mocked QR status + mocked LibreChat admin fetches, then asserts bind success triggers both default conversation creation and welcome delivery:

```ts
it('creates a default conversation and sends the first welcome message after bind success', async () => {
  // Arrange: successful bind confirmation and healthy bind-session lookup
  // Assert: POST /api/wechat/internal/bindings/complete
  // Assert: POST /api/wechat/conversations/new
  // Assert: sendOpenClawTextMessage receives the approved welcome text
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/main.test.ts --runInBand`
Expected: `FAIL` because bind success currently refreshes runtime bindings only and never initializes a conversation or sends the welcome text.

- [ ] **Step 3: Write the minimal implementation**

Update `packages/api/src/wechat/bridge/commands.ts` to export the approved welcome message:

```ts
const WECHAT_WELCOME_MESSAGE =
  'hi, 终于可以在微信上也和你聊天啦！如果你想创建一个新对话，可以试试在对话框输入 /new, 如果想找到之前的对话可以先输入 /list，再输入你想继续的某条对话，比如 /switch 1';

export function getWeChatWelcomeMessage(): string {
  return WECHAT_WELCOME_MESSAGE;
}
```

Update `packages/api/src/wechat/bridge/bindStatus.ts` so the healthy path performs best-effort post-bind initialization:

```ts
params.bindSessions.markHealthy(...);
await params.runtime.refreshBindings();

try {
  await createDefaultConversation(...);
  await params.sendTextMessage?.({
    baseUrl: updatedBaseUrl,
    botToken: status.botToken,
    toUserId: status.ilinkUserId,
    text: getWeChatWelcomeMessage(),
  });
} catch (error) {
  params.logError?.('Failed to initialize WeChat default conversation', error);
}
```
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/main.test.ts --runInBand`
Expected: `PASS`

### Task 2: Add cold-start plain-text regression coverage

**Files:**
- Modify: `packages/api/src/wechat/bridge/__tests__/poller.test.ts`
- Modify: `packages/api/src/wechat/bridge/poller.ts`

- [ ] **Step 1: Write the failing test**

Add a regression to `packages/api/src/wechat/bridge/__tests__/poller.test.ts` that stubs the internal LibreChat bridge client so:

- `getCurrentConversation(userId)` returns `null`
- `createConversation(userId)` succeeds
- `sendMessage(userId, text)` returns a reply

The assertion should prove a plain text inbound message causes `createConversation` and then `sendMessage`, without sending the old “please run /new” guidance.

```ts
it('auto-creates a default conversation before forwarding plain text when no current conversation exists', async () => {
  expect(createConversation).toHaveBeenCalledWith('user-1');
  expect(sendMessage).toHaveBeenCalledWith('user-1', 'hello');
  expect(sendReply).toHaveBeenCalledWith(expect.stringContaining('assistant reply'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/poller.test.ts --runInBand`
Expected: `FAIL` because the bridge currently replies with the no-current-conversation guidance instead of creating a conversation.

- [ ] **Step 3: Write the minimal implementation**

Update `packages/api/src/wechat/bridge/poller.ts`:

```ts
let current = await this.librechatClient.getCurrentConversation(binding.userId);
if (current == null) {
  await this.librechatClient.createConversation(binding.userId);
}

const response = await this.librechatClient.sendMessage(binding.userId, text);
await this.sendReply(binding, peerUserId, contextToken, response.text);
```

Keep command handling unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/poller.test.ts --runInBand`
Expected: `PASS`

### Task 3: Run focused verification

**Files:**
- Test: `packages/api/src/wechat/bridge/__tests__/main.test.ts`
- Test: `packages/api/src/wechat/bridge/__tests__/poller.test.ts`
- Test: `packages/api/src/wechat/bridge/__tests__/commands.test.ts`
- Test: `packages/api/src/wechat/__tests__/service.test.ts`
- Test: `packages/api/src/wechat/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Run the full focused bridge verification**

Run:

```bash
cd packages/api && npx jest \
  src/wechat/bridge/__tests__/main.test.ts \
  src/wechat/bridge/__tests__/poller.test.ts \
  src/wechat/bridge/__tests__/commands.test.ts \
  src/wechat/__tests__/service.test.ts \
  src/wechat/__tests__/orchestrator.test.ts \
  --runInBand
```

Expected: all suites pass

- [ ] **Step 2: Review the diff**

Run:

```bash
git diff -- packages/api/src/wechat/bridge/bindStatus.ts \
  packages/api/src/wechat/bridge/commands.ts \
  packages/api/src/wechat/bridge/poller.ts \
  packages/api/src/wechat/bridge/__tests__/main.test.ts \
  packages/api/src/wechat/bridge/__tests__/poller.test.ts
```

Expected: diff is limited to the new welcome/default-session flow and its tests.
