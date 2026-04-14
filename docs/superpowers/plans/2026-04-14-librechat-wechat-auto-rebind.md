# LibreChat WeChat Auto-Rebind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/wechat/internal/bindings/complete` silently transfer a WeChat binding from the old LibreChat owner to the new one so QR binding finishes successfully instead of failing with `E11000`.

**Architecture:** Keep the unique `ilinkUserId` constraint and move the ownership-transfer behavior into the existing `completeBinding` persistence path in `api/server/routes/wechat.js`. The route helper will clear all WeChat runtime state from the previous owner, then bind the new owner in one logical operation, while targeted tests cover the schema precondition, the route behavior, and the bridge completion regression.

**Tech Stack:** Node.js, Express, Mongoose, Jest, mongodb-memory-server

---

## File Map

- Modify: `packages/data-schemas/src/models/wechatBinding.spec.ts`
  - add a schema-level regression proving the same `ilinkUserId` can be re-used only after the previous owner is explicitly unbound and the unique field is removed
- Modify: `api/server/routes/wechat.js`
  - add helper functions for old-owner cleanup and transfer-aware `completeBinding`
  - keep `upsertBinding` unbind semantics unchanged
- Modify: `api/server/routes/__tests__/wechat.spec.js`
  - add route-level tests for transfer cleanup and same-user rebind behavior using mocked `mongoose.models.WeChatBinding`
- Modify: `packages/api/src/wechat/bridge/__tests__/main.test.ts`
  - add a regression test named around the transfer case so the bridge contract is explicit

### Task 1: Add the Schema Transfer Regression

**Files:**
- Modify: `packages/data-schemas/src/models/wechatBinding.spec.ts`
- Test: `packages/data-schemas/src/models/wechatBinding.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('allows reusing ilinkUserId after the previous owner is explicitly unbound', async () => {
    const WeChatBinding = mongoose.models.WeChatBinding;

    await WeChatBinding.create({
      userId: 'user-1',
      ilinkBotId: 'bot-1',
      botToken: 'enc-token-1',
      baseUrl: 'https://ilink.example',
      ilinkUserId: 'wechat-transfer',
      status: 'healthy',
      boundAt: new Date('2026-04-11T10:00:00.000Z'),
      currentConversation: {
        conversationId: 'convo-1',
        parentMessageId: 'msg-1',
        selectedAt: new Date('2026-04-11T10:01:00.000Z'),
        source: 'new',
      },
    });

    await WeChatBinding.findOneAndUpdate(
      { userId: 'user-1' },
      {
        $set: {
          status: 'unbound',
          ilinkBotId: null,
          botToken: null,
          baseUrl: null,
          boundAt: null,
          welcomeMessageSentAt: null,
          unhealthyAt: null,
          currentConversation: null,
          unboundAt: new Date('2026-04-11T10:05:00.000Z'),
        },
        $unset: { ilinkUserId: 1 },
      },
      { new: true },
    );

    await expect(
      WeChatBinding.create({
        userId: 'user-2',
        ilinkBotId: 'bot-2',
        botToken: 'enc-token-2',
        baseUrl: 'https://ilink.example',
        ilinkUserId: 'wechat-transfer',
        status: 'healthy',
        boundAt: new Date('2026-04-11T10:06:00.000Z'),
      }),
    ).resolves.toMatchObject({
      userId: 'user-2',
      ilinkUserId: 'wechat-transfer',
      status: 'healthy',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand`
Expected: FAIL because the new regression is not present yet.

- [ ] **Step 3: Add the regression to the spec file**

Insert the new `it(...)` block below the existing uniqueness test so the file documents both sides of the invariant:

```ts
  it('stores one binding per user and one active ilinkUserId globally', async () => {
    // existing test
  });

  it('allows reusing ilinkUserId after the previous owner is explicitly unbound', async () => {
    // new regression from Step 1
  });

  it('allows multiple bindings when ilinkUserId is omitted', async () => {
    // existing test
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand`
Expected: PASS with the new regression included.

- [ ] **Step 5: Commit**

```bash
git add packages/data-schemas/src/models/wechatBinding.spec.ts
git commit -m "test: cover wechat binding transfer precondition"
```

### Task 2: Implement Transfer-Aware `completeBinding`

**Files:**
- Modify: `api/server/routes/wechat.js`
- Modify: `api/server/routes/__tests__/wechat.spec.js`
- Test: `api/server/routes/__tests__/wechat.spec.js`

- [ ] **Step 1: Write the failing route tests**

Add these tests near the existing WeChat route persistence tests:

```js
  it('transfers an ilink binding to the new owner and clears the old owner state', async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(async () => undefined),
    };
    const startSession = jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    const oldOwner = {
      userId: 'user-old',
      ilinkUserId: 'wechat-transfer',
      currentConversation: {
        conversationId: 'convo-1',
        parentMessageId: 'msg-1',
        selectedAt: new Date('2026-04-11T10:01:00.000Z'),
        source: 'switch',
      },
    };
    const findOneLean = jest.fn(async () => oldOwner);
    const oldOwnerUpdate = { lean: jest.fn(async () => ({ userId: 'user-old', status: 'unbound' })) };
    const newOwnerUpdate = {
      lean: jest.fn(async () => ({ userId: 'user-new', ilinkUserId: 'wechat-transfer', status: 'healthy' })),
    };
    const findOne = jest.fn(() => ({ lean: findOneLean }));
    const findOneAndUpdate = jest
      .fn()
      .mockReturnValueOnce(oldOwnerUpdate)
      .mockReturnValueOnce(newOwnerUpdate);
    mongoose.models.WeChatBinding = { findOne, findOneAndUpdate };

    await capturedWeChatHandlerDeps.completeBinding({
      userId: 'user-new',
      ilinkUserId: 'wechat-transfer',
      ilinkBotId: 'bot-2',
      botToken: 'token-2',
      baseUrl: 'https://redirect.example.com',
    });

    expect(startSession).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith(
      { ilinkUserId: 'wechat-transfer' },
      null,
      { session },
    );
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { userId: 'user-old' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'unbound',
          ilinkBotId: null,
          botToken: null,
          baseUrl: null,
          boundAt: null,
          welcomeMessageSentAt: null,
          unhealthyAt: null,
          currentConversation: null,
          unboundAt: expect.any(Date),
        }),
        $unset: { ilinkUserId: 1 },
      }),
      expect.objectContaining({ session }),
    );
    expect(findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { userId: 'user-new' },
      expect.objectContaining({
        $set: expect.objectContaining({
          ilinkUserId: 'wechat-transfer',
          ilinkBotId: 'bot-2',
          botToken: 'token-2',
          baseUrl: 'https://redirect.example.com',
          status: 'healthy',
          welcomeMessageSentAt: null,
          unhealthyAt: null,
          unboundAt: null,
        }),
        $setOnInsert: { userId: 'user-new' },
      }),
      expect.objectContaining({ session, upsert: true }),
    );
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('rebinds the same owner without clearing another user', async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(async () => undefined),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    const findOneLean = jest.fn(async () => ({
      userId: 'user-1',
      ilinkUserId: 'wechat-transfer',
    }));
    const findOne = jest.fn(() => ({ lean: findOneLean }));
    const findOneAndUpdate = jest.fn(() => ({
      lean: jest.fn(async () => ({ userId: 'user-1', ilinkUserId: 'wechat-transfer', status: 'healthy' })),
    }));
    mongoose.models.WeChatBinding = { findOne, findOneAndUpdate };

    await capturedWeChatHandlerDeps.completeBinding({
      userId: 'user-1',
      ilinkUserId: 'wechat-transfer',
      ilinkBotId: 'bot-1',
      botToken: 'token-1',
      baseUrl: 'https://redirect.example.com',
    });

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          ilinkUserId: 'wechat-transfer',
          status: 'healthy',
        }),
      }),
      expect.objectContaining({ session, upsert: true }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
Expected: FAIL because `completeBinding` currently does one direct upsert and never clears an old owner.

- [ ] **Step 3: Implement the minimal transfer-aware helper**

Add helper functions above the `handlers` definition in `api/server/routes/wechat.js`:

```js
const buildTransferredBindingReset = () => ({
  $set: {
    ilinkBotId: null,
    botToken: null,
    baseUrl: null,
    status: 'unbound',
    boundAt: null,
    welcomeMessageSentAt: null,
    unhealthyAt: null,
    unboundAt: new Date(),
    currentConversation: null,
  },
  $unset: { ilinkUserId: 1 },
});

const buildCompletedBindingUpdate = ({ userId, ilinkUserId, ilinkBotId, botToken, baseUrl }) => ({
  $set: {
    ilinkUserId,
    ilinkBotId,
    botToken,
    baseUrl,
    status: 'healthy',
    boundAt: new Date(),
    welcomeMessageSentAt: null,
    unhealthyAt: null,
    unboundAt: null,
  },
  $setOnInsert: { userId },
});

const runWithWeChatBindingSession = async (operation) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await operation(session);
    });
  } finally {
    await session.endSession();
  }
};
```

Then replace the existing `completeBinding` implementation with:

```js
  completeBinding: async ({ userId, ilinkUserId, ilinkBotId, botToken, baseUrl }) => {
    const WeChatBinding = getWeChatBindingModel();

    await runWithWeChatBindingSession(async (session) => {
      const existingBinding = await WeChatBinding.findOne(
        { ilinkUserId },
        null,
        { session },
      ).lean();

      if (existingBinding?.userId && existingBinding.userId !== userId) {
        await WeChatBinding.findOneAndUpdate(
          { userId: existingBinding.userId },
          buildTransferredBindingReset(),
          { new: true, session },
        ).lean();
      }

      await WeChatBinding.findOneAndUpdate(
        { userId },
        buildCompletedBindingUpdate({
          userId,
          ilinkUserId,
          ilinkBotId,
          botToken,
          baseUrl,
        }),
        { new: true, upsert: true, session },
      ).lean();
    });
  },
```

- [ ] **Step 4: Run the route test to verify it passes**

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
Expected: PASS with the two new transfer cases.

- [ ] **Step 5: Re-run the schema regression to verify no route helper broke shared semantics**

Run: `cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/server/routes/wechat.js api/server/routes/__tests__/wechat.spec.js
git commit -m "feat: auto-transfer wechat bindings on rebind"
```

### Task 3: Make the Bridge Regression Explicit

**Files:**
- Modify: `packages/api/src/wechat/bridge/__tests__/main.test.ts`
- Test: `packages/api/src/wechat/bridge/__tests__/main.test.ts`

- [ ] **Step 1: Write the failing bridge regression**

Add this test beside the other success-path `resolveBindSession` tests:

```ts
  it('marks the bind session healthy when LibreChat accepts a transfer-case completion', async () => {
    const bindSessions = new WeChatBindSessions(5 * 60 * 1000);
    const session = bindSessions.createSession({
      userId: 'user-new',
      qrcode: 'qr-code-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      currentApiBaseUrl: 'https://ilinkai.weixin.qq.com',
    });
    const runtime = {
      refreshBindings: jest.fn(async () => undefined),
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: true, status: 201 });

    const result = await resolveBindSession({
      bindSessionId: session.bindSessionId,
      bindSessions,
      internalToken: 'internal-token',
      librechatBaseUrl: 'http://127.0.0.1:3081',
      runtime,
      fetchImpl,
      pollQrLogin: jest.fn(async () => ({
        status: 'confirmed',
        botToken: 'bot-token',
        ilinkBotId: 'bot-id',
        ilinkUserId: 'wechat-transfer',
        baseUrl: 'https://redirect.example.com',
      })),
    });

    expect(result).toEqual(
      expect.objectContaining({
        bindSessionId: session.bindSessionId,
        status: 'healthy',
      }),
    );
    expect(runtime.refreshBindings).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/main.test.ts --runInBand`
Expected: FAIL because the new regression is not in the file yet.

- [ ] **Step 3: Add the regression with no production-code changes**

Insert the new `it(...)` block immediately after the existing successful completion test so the bridge contract is documented in test names.

```ts
  it('marks the bind session healthy and refreshes runtime bindings when confirmation succeeds', async () => {
    // existing success test
  });

  it('marks the bind session healthy when LibreChat accepts a transfer-case completion', async () => {
    // new regression from Step 1
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/main.test.ts --runInBand`
Expected: PASS with both success-path tests.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/wechat/bridge/__tests__/main.test.ts
git commit -m "test: document bridge transfer bind success"
```

## Self-Review Checklist

- Spec coverage:
  - old owner cleanup is implemented and verified in Task 2
  - `currentConversation` reset is verified in Task 2
  - unique-index precondition remains explicit in Task 1
  - bind session no longer remains pending for the transfer case is documented in Task 3
- Placeholder scan:
  - no `TODO` / `TBD` placeholders
  - all commands are explicit
  - all touched files are named exactly
- Type and API consistency:
  - `completeBinding` stays in `api/server/routes/wechat.js`
  - route tests call `capturedWeChatHandlerDeps.completeBinding(...)`
  - bridge regression still exercises `resolveBindSession(...)`

## Execution Mode

User explicitly requested subagent execution in a worktree. Execute this plan with `superpowers:subagent-driven-development`, using the worktree at `/data/projects/LibreChat/.worktrees/wechat-auto-rebind-transfer`.
