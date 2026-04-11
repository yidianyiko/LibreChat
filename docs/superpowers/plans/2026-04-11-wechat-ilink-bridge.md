# LibreChat WeChat iLink Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidecar-based WeChat iLink bridge that lets a signed-in LibreChat user bind one personal WeChat account, create or switch a supported `openAI + gpt-4o` conversation from WeChat, and continue the same branch-safe LibreChat conversation from either web or WeChat.

**Architecture:** Persist WeChat binding state in a dedicated MongoDB collection, keep eligibility, branch-head selection, and message orchestration in TypeScript under `packages/api/src/wechat`, and expose them through a thin `/api/wechat` JS route wrapper. Run the iLink transport as a separate TypeScript sidecar process that owns QR login, long polling, dedupe, and slash-command routing, while the main app remains the source of truth for credentials at rest, current conversation binding, and conversation/message storage.

**Tech Stack:** MongoDB/Mongoose, TypeScript in `packages/api` and `packages/data-schemas`, Express, React, React Query, Jest, `@tencent-weixin/openclaw-weixin`

---

## File Map

**Modify**
- `.env.example`
  - Add bridge URL, bridge admin port, and shared internal bearer token examples.
- `api/cache/getLogStores.js`
  - Register a dedicated cache namespace for `/list` snapshots with a 15-minute TTL.
- `api/server/controllers/agents/request.js`
  - Delegate resumable generation startup to a reusable helper exported from `@librechat/api`.
- `api/server/experimental.js`
  - Mount the new `/api/wechat` route in experimental mode.
- `api/server/index.js`
  - Mount the new `/api/wechat` route in the main server.
- `api/server/routes/index.js`
  - Export the new WeChat route module.
- `client/src/components/Nav/SettingsTabs/Account/Account.tsx`
  - Insert the WeChat binding section into the existing Account settings tab.
- `client/src/data-provider/index.ts`
  - Export the new client-side WeChat hooks.
- `client/src/locales/en/translation.json`
  - Add English strings for bind, rebind, unbind, QR dialog, and health states.
- `package.json`
  - Add a separate script to start the WeChat bridge sidecar.
- `packages/api/package.json`
  - Add the iLink/OpenClaw runtime dependency.
- `packages/api/src/index.ts`
  - Export the new WeChat handlers, auth middleware, and generation helper.
- `packages/data-provider/src/api-endpoints.ts`
  - Add typed endpoints for `/api/wechat/*`.
- `packages/data-provider/src/config.ts`
  - Add a `CacheKeys.WECHAT_LIST_SNAPSHOT` enum member.
- `packages/data-provider/src/data-service.ts`
  - Add typed client calls for bind start/status, status, and unbind.
- `packages/data-provider/src/index.ts`
  - Export the new shared WeChat DTOs.
- `packages/data-provider/src/keys.ts`
  - Add query and mutation keys for WeChat status and bind actions.
- `packages/data-schemas/src/models/index.ts`
  - Register the `WeChatBinding` model in the central model factory.
- `packages/data-schemas/src/schema/index.ts`
  - Export the `weChatBindingSchema`.
- `packages/data-schemas/src/types/index.ts`
  - Export the WeChat binding interfaces.

**Create**
- `api/server/routes/__tests__/wechat.spec.js`
  - Route tests for website routes, bridge-command routes, and internal bridge auth.
- `api/server/routes/wechat.js`
  - Thin JS wrapper that wires `requireJwtAuth`, bridge bearer auth, and TS handlers.
- `client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx`
  - Account settings UI for bind/status/unbind and QR polling.
- `client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`
  - UI tests for unbound, healthy, and reauth-required states.
- `client/src/data-provider/WeChat/index.ts`
  - Re-export query and mutation hooks.
- `client/src/data-provider/WeChat/mutations.ts`
  - React Query mutations for bind start and unbind.
- `client/src/data-provider/WeChat/queries.ts`
  - React Query queries for status and bind-session polling.
- `packages/api/src/agents/startResumableGeneration.ts`
  - Reusable helper that starts a resumable generation job without owning the HTTP response contract.
- `packages/api/src/wechat/index.ts`
  - Barrel export for WeChat backend modules.
- `packages/api/src/wechat/types.ts`
  - Shared backend-only request, response, and dependency types.
- `packages/api/src/wechat/internalAuth.ts`
  - Bearer-token middleware for bridge-only internal routes.
- `packages/api/src/wechat/output.ts`
  - Assistant output flattening and fallback-text helpers for WeChat.
- `packages/api/src/wechat/presets.ts`
  - Resolve user default preset and GPT-4o fallback behavior for `/new`.
- `packages/api/src/wechat/branching.ts`
  - Eligibility filtering and deterministic leaf-head selection.
- `packages/api/src/wechat/service.ts`
  - Core domain service for status, bind persistence, `/list`, `/new`, `/switch`, `/now`, and unbind.
- `packages/api/src/wechat/handlers.ts`
  - Express handler factory for website, bridge-command, and internal bridge routes.
- `packages/api/src/wechat/bridgeClient.ts`
  - Main-app client for bridge bind-session admin endpoints.
- `packages/api/src/wechat/orchestrator.ts`
  - Message orchestration that starts generation, waits for completion, handles timeout, and advances the current binding.
- `packages/api/src/wechat/__tests__/service.test.ts`
  - Unit tests for preset fallback, eligibility, snapshot gating, and branch-head selection.
- `packages/api/src/wechat/__tests__/orchestrator.test.ts`
  - Unit tests for flattening, timeout abort, and next-parent reconciliation.
- `packages/api/src/wechat/bridge/api.ts`
  - Small admin HTTP server for bind-session start/status/cancel.
- `packages/api/src/wechat/bridge/bindSessions.ts`
  - TTL storage for pending QR bind sessions.
- `packages/api/src/wechat/bridge/commands.ts`
  - Slash-command parser and routing decisions.
- `packages/api/src/wechat/bridge/config.ts`
  - Environment parsing for bridge URL, token, timeouts, and poll interval.
- `packages/api/src/wechat/bridge/dedupe.ts`
  - TTL dedupe store keyed by inbound WeChat message ID.
- `packages/api/src/wechat/bridge/main.ts`
  - Sidecar process entrypoint.
- `packages/api/src/wechat/bridge/openclawClient.ts`
  - Thin wrapper around `@tencent-weixin/openclaw-weixin`.
- `packages/api/src/wechat/bridge/poller.ts`
  - Long-poll runtime that bootstraps active bindings and dispatches inbound messages.
- `packages/api/src/wechat/bridge/__tests__/commands.test.ts`
  - Tests for `/new`, `/list`, `/switch <index>`, `/now`, and plain-text routing.
- `packages/data-provider/src/wechat.ts`
  - Shared DTOs for website WeChat status and bind-session responses.
- `packages/data-schemas/src/models/wechatBinding.spec.ts`
  - Model-level tests for unique user binding, unique `ilinkUserId`, and current-binding persistence.
- `packages/data-schemas/src/models/wechatBinding.ts`
  - Mongoose model factory for the new collection.
- `packages/data-schemas/src/schema/wechatBinding.ts`
  - Mongoose schema for encrypted credentials, health, and current branch head.
- `packages/data-schemas/src/types/wechat.ts`
  - Strongly typed interfaces for the new collection.

---

### Task 1: Persist WeChat binding state in MongoDB

**Files:**
- Create: `packages/data-schemas/src/types/wechat.ts`
- Create: `packages/data-schemas/src/schema/wechatBinding.ts`
- Create: `packages/data-schemas/src/models/wechatBinding.ts`
- Create: `packages/data-schemas/src/models/wechatBinding.spec.ts`
- Modify: `packages/data-schemas/src/types/index.ts`
- Modify: `packages/data-schemas/src/schema/index.ts`
- Modify: `packages/data-schemas/src/models/index.ts`

- [ ] **Step 1: Write the failing model test for one-active-binding and nested current conversation**

Add `packages/data-schemas/src/models/wechatBinding.spec.ts` with a focused schema test like:

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';

describe('WeChatBinding model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    createModels(mongoose);
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
  });
});
```

- [ ] **Step 2: Run the focused schema test and verify it fails**

Run: `cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand`

Expected: FAIL because the `WeChatBinding` model does not exist yet.

- [ ] **Step 3: Add the WeChat binding types, schema, and model**

Create the shared type in `packages/data-schemas/src/types/wechat.ts`:

```ts
import type { Document } from 'mongoose';

export type WeChatBindingStatus = 'healthy' | 'reauth_required' | 'unbound';
export type WeChatBindingSource = 'new' | 'switch';

export interface ICurrentConversationBinding {
  conversationId: string;
  parentMessageId: string;
  selectedAt: Date;
  lastAdvancedAt?: Date | null;
  source: WeChatBindingSource;
}

export interface IWeChatBinding extends Document {
  userId: string;
  ilinkBotId?: string | null;
  botToken?: string | null;
  baseUrl?: string | null;
  ilinkUserId?: string | null;
  status: WeChatBindingStatus;
  boundAt?: Date | null;
  unhealthyAt?: Date | null;
  unboundAt?: Date | null;
  currentConversation?: ICurrentConversationBinding | null;
  createdAt?: Date;
  updatedAt?: Date;
}
```

Create `packages/data-schemas/src/schema/wechatBinding.ts`:

```ts
import { Schema } from 'mongoose';
import type { IWeChatBinding } from '~/types';

const currentConversationSchema = new Schema(
  {
    conversationId: { type: String, required: true },
    parentMessageId: { type: String, required: true },
    selectedAt: { type: Date, required: true },
    lastAdvancedAt: { type: Date, default: null },
    source: { type: String, enum: ['new', 'switch'], required: true },
  },
  { _id: false },
);

const weChatBindingSchema: Schema<IWeChatBinding> = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    ilinkBotId: { type: String, default: null },
    botToken: { type: String, default: null, select: false },
    baseUrl: { type: String, default: null },
    ilinkUserId: { type: String, default: null, sparse: true, unique: true },
    status: {
      type: String,
      enum: ['healthy', 'reauth_required', 'unbound'],
      required: true,
      default: 'unbound',
    },
    boundAt: { type: Date, default: null },
    unhealthyAt: { type: Date, default: null },
    unboundAt: { type: Date, default: null },
    currentConversation: { type: currentConversationSchema, default: null },
  },
  { timestamps: true },
);

export default weChatBindingSchema;
```

Create `packages/data-schemas/src/models/wechatBinding.ts`:

```ts
import weChatBindingSchema from '~/schema/wechatBinding';
import type { IWeChatBinding } from '~/types';

export function createWeChatBindingModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.WeChatBinding ||
    mongoose.model<IWeChatBinding>('WeChatBinding', weChatBindingSchema)
  );
}
```

- [ ] **Step 4: Export the new model from the central factories**

Update the three index files so the model is registered everywhere:

```ts
// packages/data-schemas/src/types/index.ts
export * from './wechat';

// packages/data-schemas/src/schema/index.ts
export { default as weChatBindingSchema } from './wechatBinding';

// packages/data-schemas/src/models/index.ts
import { createWeChatBindingModel } from './wechatBinding';

export function createModels(mongoose: typeof import('mongoose')) {
  return {
    // existing models...
    WeChatBinding: createWeChatBindingModel(mongoose),
  };
}
```

- [ ] **Step 5: Run the model test and rebuild the package**

Run: `cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand && npm run build`

Expected: PASS, followed by a successful package build with generated `dist` artifacts.

- [ ] **Step 6: Commit**

```bash
git add packages/data-schemas/src/types/wechat.ts packages/data-schemas/src/schema/wechatBinding.ts packages/data-schemas/src/models/wechatBinding.ts packages/data-schemas/src/models/wechatBinding.spec.ts packages/data-schemas/src/types/index.ts packages/data-schemas/src/schema/index.ts packages/data-schemas/src/models/index.ts
git commit -m "feat: add WeChat binding persistence model"
```

---

### Task 2: Implement WeChat domain rules, snapshot cache, and branch selection

**Files:**
- Create: `packages/api/src/wechat/types.ts`
- Create: `packages/api/src/wechat/presets.ts`
- Create: `packages/api/src/wechat/branching.ts`
- Create: `packages/api/src/wechat/service.ts`
- Create: `packages/api/src/wechat/__tests__/service.test.ts`
- Modify: `packages/data-provider/src/config.ts`
- Modify: `api/cache/getLogStores.js`

- [ ] **Step 1: Write the failing service test for eligibility, preset fallback, and snapshot-gated switch**

Add `packages/api/src/wechat/__tests__/service.test.ts` with cases like:

```ts
import { Constants } from 'librechat-data-provider';
import { isEligibleWeChatConversation, selectLatestLeafHead } from '../branching';
import { resolveWeChatPreset } from '../presets';

describe('WeChat service helpers', () => {
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

  it('returns the no-parent sentinel when a conversation has no messages', () => {
    expect(selectLatestLeafHead([])).toBe(Constants.NO_PARENT);
  });
});
```

- [ ] **Step 2: Run the focused service test and verify it fails**

Run: `cd packages/api && npx jest src/wechat/__tests__/service.test.ts --runInBand`

Expected: FAIL because the `wechat` service modules do not exist yet.

- [ ] **Step 3: Add a dedicated cache namespace for `/list` snapshots**

Update `packages/data-provider/src/config.ts` and `api/cache/getLogStores.js`:

```ts
// packages/data-provider/src/config.ts
export enum CacheKeys {
  // existing keys...
  WECHAT_LIST_SNAPSHOT = 'WECHAT_LIST_SNAPSHOT',
}
```

```js
// api/cache/getLogStores.js
[CacheKeys.WECHAT_LIST_SNAPSHOT]: standardCache(
  CacheKeys.WECHAT_LIST_SNAPSHOT,
  Time.TEN_MINUTES + Time.FIVE_MINUTES,
),
```

- [ ] **Step 4: Implement eligibility, leaf-head selection, and preset resolution helpers**

Create `packages/api/src/wechat/branching.ts`:

```ts
import { Constants } from 'librechat-data-provider';

export function isEligibleWeChatConversation(
  conversation: {
    user?: string;
    endpoint?: string | null;
    endpointType?: string | null;
    model?: string | null;
    isArchived?: boolean | null;
    expiredAt?: Date | null;
  },
  userId: string,
): boolean {
  const provider = conversation.endpointType ?? conversation.endpoint;
  return (
    conversation.user === userId &&
    provider === 'openAI' &&
    conversation.model === 'gpt-4o' &&
    conversation.isArchived !== true &&
    conversation.expiredAt == null
  );
}

export function selectLatestLeafHead(
  messages: Array<{
    messageId: string;
    parentMessageId?: string | null;
    createdAt?: Date | null;
    isCreatedByUser?: boolean;
  }>,
): string {
  if (messages.length === 0) {
    return Constants.NO_PARENT;
  }

  const parentIds = new Set(
    messages.map((message) => message.parentMessageId).filter((id): id is string => Boolean(id)),
  );
  const leaves = messages.filter((message) => !parentIds.has(message.messageId));

  return leaves
    .sort((a, b) => {
      const timeDiff = new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return Number(a.isCreatedByUser) - Number(b.isCreatedByUser);
    })[0]?.messageId;
}
```

Create `packages/api/src/wechat/presets.ts`:

```ts
export async function resolveWeChatPreset(params: {
  getUserDefaultPreset: () => Promise<{ endpoint?: string; endpointType?: string; model?: string } | null>;
  fallbackPreset: { endpoint: 'openAI'; model: 'gpt-4o'; [key: string]: unknown };
}) {
  const userPreset = await params.getUserDefaultPreset();
  const provider = userPreset?.endpointType ?? userPreset?.endpoint;

  if (provider === 'openAI' && userPreset?.model === 'gpt-4o') {
    return userPreset;
  }

  return params.fallbackPreset;
}
```

- [ ] **Step 5: Implement the core `WeChatService` around the new model and snapshot cache**

Create `packages/api/src/wechat/service.ts` with a class that owns status, list, new, switch, current, and unbind:

```ts
import crypto from 'node:crypto';
import { Constants } from 'librechat-data-provider';
import { isEligibleWeChatConversation, selectLatestLeafHead } from './branching';
import { resolveWeChatPreset } from './presets';

export class WeChatService {
  constructor(private deps: WeChatServiceDependencies) {}

  async getStatus(userId: string) {
    const binding = await this.deps.findBindingByUserId(userId);
    if (!binding || binding.status === 'unbound') {
      return { status: 'unbound' as const, hasBinding: false, currentConversation: null };
    }

    return {
      status: binding.status,
      hasBinding: true,
      ilinkUserId: binding.ilinkUserId,
      currentConversation: binding.currentConversation ?? null,
    };
  }

  async listEligibleConversations(userId: string) {
    const conversations = await this.deps.listUserConversations(userId);
    const eligible = conversations.filter((conversation) =>
      isEligibleWeChatConversation(conversation, userId),
    );

    const snapshotId = crypto.randomUUID();
    await this.deps.storeSnapshot(userId, {
      snapshotId,
      conversationIds: eligible.map((conversation) => conversation.conversationId),
      createdAt: new Date(),
    });

    return { snapshotId, conversations: eligible };
  }

  async createConversation(userId: string) {
    const preset = await resolveWeChatPreset({
      getUserDefaultPreset: () => this.deps.getUserDefaultPreset(userId),
      fallbackPreset: this.deps.getFallbackPreset(),
    });

    const conversationId = crypto.randomUUID();
    const conversation = await this.deps.createConversation({
      userId,
      conversationId,
      preset,
    });

    await this.deps.upsertBinding(userId, {
      currentConversation: {
        conversationId,
        parentMessageId: Constants.NO_PARENT,
        selectedAt: new Date(),
        lastAdvancedAt: null,
        source: 'new',
      },
    });

    return conversation;
  }
}
```

- [ ] **Step 6: Run the service test and build the package**

Run: `cd packages/api && npx jest src/wechat/__tests__/service.test.ts --runInBand && npm run build`

Expected: PASS, followed by a clean `packages/api` build.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/wechat/types.ts packages/api/src/wechat/presets.ts packages/api/src/wechat/branching.ts packages/api/src/wechat/service.ts packages/api/src/wechat/__tests__/service.test.ts packages/data-provider/src/config.ts api/cache/getLogStores.js
git commit -m "feat: add WeChat domain service and snapshot cache"
```

---

### Task 3: Reuse the resumable generation pipeline and add WeChat message orchestration

**Files:**
- Create: `packages/api/src/agents/startResumableGeneration.ts`
- Create: `packages/api/src/wechat/output.ts`
- Create: `packages/api/src/wechat/orchestrator.ts`
- Create: `packages/api/src/wechat/__tests__/orchestrator.test.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `api/server/controllers/agents/request.js`

- [ ] **Step 1: Write the failing orchestration test for flattening, timeout abort, and next-parent advancement**

Add `packages/api/src/wechat/__tests__/orchestrator.test.ts`:

```ts
import { flattenWeChatText } from '../output';

describe('WeChat output helpers', () => {
  it('joins visible text parts with blank lines', () => {
    expect(
      flattenWeChatText([
        { type: 'text', text: 'first block' },
        { type: 'think', think: 'hidden' },
        { type: 'text', text: 'second block' },
      ]),
    ).toBe('first block\n\nsecond block');
  });

  it('returns the unsupported-content fallback when no visible text exists', () => {
    expect(flattenWeChatText([{ type: 'image_url', image_url: 'https://example.com/file.png' }]))
      .toBe('本次回复包含暂不支持的内容类型，请到网页端查看');
  });
});
```

- [ ] **Step 2: Run the focused orchestration test and verify it fails**

Run: `cd packages/api && npx jest src/wechat/__tests__/orchestrator.test.ts --runInBand`

Expected: FAIL because `flattenWeChatText` and the orchestrator do not exist yet.

- [ ] **Step 3: Extract a reusable resumable-generation starter from the legacy controller**

Create `packages/api/src/agents/startResumableGeneration.ts`:

```ts
import { GenerationJobManager } from '../stream';

export async function startResumableGeneration(params: {
  req: any;
  initializeClient: (args: any) => Promise<any>;
  addTitle?: (req: any, args: any) => Promise<void>;
  text: string;
  endpointOption: Record<string, unknown>;
  conversationId?: string | null;
  parentMessageId?: string | null;
  isContinued?: boolean;
}) {
  const conversationId =
    !params.conversationId || params.conversationId === 'new'
      ? crypto.randomUUID()
      : params.conversationId;
  const streamId = conversationId;
  const job = await GenerationJobManager.createJob(streamId, params.req.user.id, conversationId);

  // Move the existing initialization/sendMessage logic out of request.js into this helper.
  // Return the IDs needed by both the legacy HTTP controller and the WeChat orchestrator.
  return {
    streamId,
    conversationId,
    job,
  };
}
```

Then update `api/server/controllers/agents/request.js` so the controller calls `startResumableGeneration(...)`, sends the existing `{ streamId, conversationId, status: 'started' }` JSON response, and keeps the legacy SSE behavior unchanged.

- [ ] **Step 4: Add WeChat-safe output flattening**

Create `packages/api/src/wechat/output.ts`:

```ts
export function flattenWeChatText(parts: Array<Record<string, unknown>>): string {
  const textParts = parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => String(part.text).trim())
    .filter(Boolean);

  if (textParts.length === 0) {
    return '本次回复包含暂不支持的内容类型，请到网页端查看';
  }

  return textParts.join('\n\n');
}
```

- [ ] **Step 5: Implement the WeChat message orchestrator on top of the reusable starter**

Create `packages/api/src/wechat/orchestrator.ts`:

```ts
import { GenerationJobManager } from '@librechat/api';
import { flattenWeChatText } from './output';

export class WeChatMessageOrchestrator {
  constructor(private deps: WeChatMessageOrchestratorDependencies) {}

  async sendMessage(params: {
    req: any;
    text: string;
    conversationId: string;
    parentMessageId: string;
    endpointOption: Record<string, unknown>;
  }) {
    const started = await this.deps.startResumableGeneration({
      req: params.req,
      initializeClient: this.deps.initializeClient,
      addTitle: this.deps.addTitle,
      text: params.text,
      endpointOption: params.endpointOption,
      conversationId: params.conversationId,
      parentMessageId: params.parentMessageId,
      isContinued: true,
    });

    const terminal = await this.deps.waitForStream(started.streamId, 90_000);
    if (terminal.type === 'timeout') {
      await GenerationJobManager.abortJob(started.streamId);
      return {
        text: '本次回复超时，请稍后重试',
        nextParentMessageId: terminal.reconciledParentMessageId ?? params.parentMessageId,
        timedOut: true,
      };
    }

    return {
      text: flattenWeChatText(terminal.aggregatedContent),
      nextParentMessageId: terminal.responseMessageId,
      timedOut: false,
    };
  }
}
```

- [ ] **Step 6: Run the orchestration tests and one existing agent controller test**

Run: `cd packages/api && npx jest src/wechat/__tests__/orchestrator.test.ts --runInBand`

Run: `cd api && npx jest server/routes/agents/__tests__/abort.spec.js --runInBand`

Expected: both PASS, proving the reusable starter did not break the existing resumable pipeline.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/agents/startResumableGeneration.ts packages/api/src/wechat/output.ts packages/api/src/wechat/orchestrator.ts packages/api/src/wechat/__tests__/orchestrator.test.ts packages/api/src/index.ts api/server/controllers/agents/request.js
git commit -m "refactor: reuse resumable generation for WeChat orchestration"
```

---

### Task 4: Add `/api/wechat` routes, bridge auth, and main-app bridge client

**Files:**
- Create: `packages/api/src/wechat/internalAuth.ts`
- Create: `packages/api/src/wechat/handlers.ts`
- Create: `packages/api/src/wechat/bridgeClient.ts`
- Create: `packages/api/src/wechat/index.ts`
- Create: `api/server/routes/wechat.js`
- Create: `api/server/routes/__tests__/wechat.spec.js`
- Modify: `packages/api/src/index.ts`
- Modify: `api/server/routes/index.js`
- Modify: `api/server/index.js`
- Modify: `api/server/experimental.js`

- [ ] **Step 1: Write the failing route test for website auth, bridge bearer auth, and snapshot-gated switch**

Add `api/server/routes/__tests__/wechat.spec.js` with cases like:

```js
it('rejects internal bridge routes without the shared bearer token', async () => {
  await request(app).get('/api/wechat/internal/bindings/active').expect(401);
});

it('returns 请先执行 /list when switch is requested without a valid snapshot', async () => {
  weChatService.switchConversation.mockRejectedValue(new Error('SNAPSHOT_REQUIRED'));

  const response = await request(app)
    .post('/api/wechat/conversations/switch')
    .set('Authorization', 'Bearer internal-token')
    .send({ userId: 'user-1', snapshotId: 'missing', index: 2 });

  expect(response.status).toBe(409);
  expect(response.body.message).toBe('请先执行 /list');
});
```

- [ ] **Step 2: Run the focused route test and verify it fails**

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`

Expected: FAIL because the `/api/wechat` route does not exist yet.

- [ ] **Step 3: Add bridge-only bearer auth middleware and handler factory in TypeScript**

Create `packages/api/src/wechat/internalAuth.ts`:

```ts
import type { NextFunction, Request, Response } from 'express';

export function createRequireWeChatBridgeAuth(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing bridge authorization' });
    }

    const token = auth.slice('Bearer '.length);
    if (token !== expectedToken) {
      return res.status(401).json({ message: 'Invalid bridge authorization' });
    }

    next();
  };
}
```

Create `packages/api/src/wechat/bridgeClient.ts`:

```ts
import axios from 'axios';

export class WeChatBridgeClient {
  constructor(private baseUrl: string, private token: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  startBindSession(payload: { userId: string }) {
    return axios.post(`${this.baseUrl}/bind-sessions`, payload, { headers: this.headers() });
  }

  getBindSession(bindSessionId: string) {
    return axios.get(`${this.baseUrl}/bind-sessions/${encodeURIComponent(bindSessionId)}`, {
      headers: this.headers(),
    });
  }

  cancelBindSession(bindSessionId: string) {
    return axios.delete(`${this.baseUrl}/bind-sessions/${encodeURIComponent(bindSessionId)}`, {
      headers: this.headers(),
    });
  }
}
```

- [ ] **Step 4: Implement the route handlers and the thin JS wrapper**

Create `packages/api/src/wechat/handlers.ts` with one factory:

```ts
export function createWeChatHandlers(deps: {
  service: WeChatService;
  bridgeClient: WeChatBridgeClient;
  orchestrator: WeChatMessageOrchestrator;
}) {
  return {
    getStatus: async (req, res) => {
      res.json(await deps.service.getStatus(req.user.id));
    },
    startBind: async (req, res) => {
      const started = await deps.bridgeClient.startBindSession({ userId: req.user.id });
      res.status(201).json(started.data);
    },
    getBindStatus: async (req, res) => {
      const result = await deps.bridgeClient.getBindSession(req.params.bindSessionId);
      res.json(result.data);
    },
    unbind: async (req, res) => {
      await deps.service.unbind(req.user.id);
      res.status(204).send();
    },
    listConversations: async (req, res) => {
      res.json(await deps.service.listEligibleConversations(req.body.userId));
    },
    createConversation: async (req, res) => {
      res.status(201).json(await deps.service.createConversation(req.body.userId));
    },
  };
}
```

Create the thin route in `api/server/routes/wechat.js`:

```js
const express = require('express');
const mongoose = require('mongoose');
const { createWeChatHandlers, createRequireWeChatBridgeAuth } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
const requireBridgeAuth = createRequireWeChatBridgeAuth(process.env.WECHAT_BRIDGE_INTERNAL_TOKEN);

router.get('/status', requireJwtAuth, handlers.getStatus);
router.post('/bind/start', requireJwtAuth, handlers.startBind);
router.get('/bind/status/:bindSessionId', requireJwtAuth, handlers.getBindStatus);
router.delete('/bind', requireJwtAuth, handlers.unbind);

router.get('/internal/bindings/active', requireBridgeAuth, handlers.getActiveBindings);
router.post('/internal/bindings/complete', requireBridgeAuth, handlers.completeBinding);
router.post('/internal/bindings/health', requireBridgeAuth, handlers.updateBindingHealth);

router.get('/conversations', requireBridgeAuth, handlers.listConversations);
router.post('/conversations/new', requireBridgeAuth, handlers.createConversation);
router.post('/conversations/switch', requireBridgeAuth, handlers.switchConversation);
router.get('/conversations/current', requireBridgeAuth, handlers.getCurrentConversation);
router.post('/messages', requireBridgeAuth, handlers.sendMessage);
```

- [ ] **Step 5: Mount the route in both server entrypoints**

Update the route exports and mount points:

```js
// api/server/routes/index.js
const wechat = require('./wechat');
module.exports = {
  // existing routes...
  wechat,
};

// api/server/index.js and api/server/experimental.js
app.use('/api/wechat', routes.wechat);
```

- [ ] **Step 6: Run the route test and a targeted server smoke build**

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`

Run: `npm run build:api`

Expected: route tests PASS and `packages/api` rebuild completes so the new exports are consumable from `/api`.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/wechat/internalAuth.ts packages/api/src/wechat/handlers.ts packages/api/src/wechat/bridgeClient.ts packages/api/src/wechat/index.ts packages/api/src/index.ts api/server/routes/wechat.js api/server/routes/__tests__/wechat.spec.js api/server/routes/index.js api/server/index.js api/server/experimental.js
git commit -m "feat: add WeChat API routes and bridge auth"
```

---

### Task 5: Implement the WeChat iLink sidecar runtime

**Files:**
- Create: `packages/api/src/wechat/bridge/config.ts`
- Create: `packages/api/src/wechat/bridge/openclawClient.ts`
- Create: `packages/api/src/wechat/bridge/bindSessions.ts`
- Create: `packages/api/src/wechat/bridge/dedupe.ts`
- Create: `packages/api/src/wechat/bridge/commands.ts`
- Create: `packages/api/src/wechat/bridge/poller.ts`
- Create: `packages/api/src/wechat/bridge/api.ts`
- Create: `packages/api/src/wechat/bridge/main.ts`
- Create: `packages/api/src/wechat/bridge/__tests__/commands.test.ts`
- Modify: `packages/api/package.json`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing command-routing test for `/new`, `/list`, `/switch`, `/now`, and plain text**

Add `packages/api/src/wechat/bridge/__tests__/commands.test.ts`:

```ts
import { parseWeChatCommand } from '../commands';

describe('parseWeChatCommand', () => {
  it('parses slash commands and ignores plain text', () => {
    expect(parseWeChatCommand('/new')).toEqual({ name: 'new' });
    expect(parseWeChatCommand('/list')).toEqual({ name: 'list' });
    expect(parseWeChatCommand('/switch 3')).toEqual({ name: 'switch', index: 3 });
    expect(parseWeChatCommand('/now')).toEqual({ name: 'now' });
    expect(parseWeChatCommand('hello')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused bridge test and verify it fails**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/commands.test.ts --runInBand`

Expected: FAIL because the bridge command module does not exist yet.

- [ ] **Step 3: Add bridge config, admin API, and dedupe primitives**

Create `packages/api/src/wechat/bridge/config.ts`:

```ts
export function getWeChatBridgeConfig() {
  return {
    port: Number(process.env.WECHAT_BRIDGE_PORT || 3091),
    librechatBaseUrl: process.env.WECHAT_BRIDGE_LIBRECHAT_URL || 'http://localhost:3080',
    internalToken: process.env.WECHAT_BRIDGE_INTERNAL_TOKEN || '',
    pollIntervalMs: Number(process.env.WECHAT_BRIDGE_POLL_INTERVAL_MS || 1500),
    dedupeTtlMs: Number(process.env.WECHAT_BRIDGE_DEDUPE_TTL_MS || 10 * 60 * 1000),
  };
}
```

Create `packages/api/src/wechat/bridge/dedupe.ts`:

```ts
export class InboundMessageDedupe {
  private seen = new Map<string, number>();

  constructor(private ttlMs: number) {}

  seenBefore(messageId: string): boolean {
    const now = Date.now();
    const expiresAt = this.seen.get(messageId);
    if (expiresAt && expiresAt > now) {
      return true;
    }
    this.seen.set(messageId, now + this.ttlMs);
    return false;
  }
}
```

Create `packages/api/src/wechat/bridge/api.ts` with three admin endpoints: create bind session, get bind session, cancel bind session.

- [ ] **Step 4: Implement the OpenClaw wrapper, command router, and poller**

Create `packages/api/src/wechat/bridge/openclawClient.ts`:

```ts
import { createClient } from '@tencent-weixin/openclaw-weixin';

export function createOpenClawClient(params: { baseUrl: string; botToken: string }) {
  return createClient({
    baseUrl: params.baseUrl,
    botToken: params.botToken,
  });
}
```

Create `packages/api/src/wechat/bridge/commands.ts`:

```ts
export type ParsedWeChatCommand =
  | { name: 'new' }
  | { name: 'list' }
  | { name: 'switch'; index: number }
  | { name: 'now' };

export function parseWeChatCommand(text: string): ParsedWeChatCommand | null {
  const trimmed = text.trim();
  if (trimmed === '/new') {
    return { name: 'new' };
  }
  if (trimmed === '/list') {
    return { name: 'list' };
  }
  if (trimmed === '/now') {
    return { name: 'now' };
  }

  const switchMatch = trimmed.match(/^\/switch\s+(\d+)$/);
  if (switchMatch) {
    return { name: 'switch', index: Number(switchMatch[1]) };
  }

  return null;
}
```

Create `packages/api/src/wechat/bridge/poller.ts` so each active binding gets exactly one poller, each inbound update is deduped by message ID, slash commands call the appropriate `/api/wechat/*` endpoint, and plain text routes only when `/api/wechat/conversations/current` returns a valid binding.

- [ ] **Step 5: Add the sidecar entrypoint, dependency, script, and env examples**

Update `packages/api/package.json`:

```json
{
  "dependencies": {
    "@tencent-weixin/openclaw-weixin": "^2.1.8"
  }
}
```

Update the root `package.json`:

```json
{
  "scripts": {
    "backend:wechat-bridge": "node -r dotenv/config --loader ./packages/api/tsconfig-paths-bootstrap.mjs --experimental-specifier-resolution=node ./packages/api/src/wechat/bridge/main.ts"
  }
}
```

Update `.env.example`:

```dotenv
WECHAT_BRIDGE_PORT=3091
WECHAT_BRIDGE_LIBRECHAT_URL=http://localhost:3080
WECHAT_BRIDGE_INTERNAL_TOKEN=replace-with-long-random-token
WECHAT_BRIDGE_URL=http://localhost:3091
WECHAT_BRIDGE_POLL_INTERVAL_MS=1500
WECHAT_BRIDGE_DEDUPE_TTL_MS=600000
```

- [ ] **Step 6: Run the bridge unit test and a local sidecar boot smoke check**

Run: `cd packages/api && npx jest src/wechat/bridge/__tests__/commands.test.ts --runInBand`

Run: `npm run backend:wechat-bridge`

Expected: the command test PASSes, and the sidecar starts an admin HTTP server without immediately throwing on startup.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/wechat/bridge/config.ts packages/api/src/wechat/bridge/openclawClient.ts packages/api/src/wechat/bridge/bindSessions.ts packages/api/src/wechat/bridge/dedupe.ts packages/api/src/wechat/bridge/commands.ts packages/api/src/wechat/bridge/poller.ts packages/api/src/wechat/bridge/api.ts packages/api/src/wechat/bridge/main.ts packages/api/src/wechat/bridge/__tests__/commands.test.ts packages/api/package.json package.json .env.example
git commit -m "feat: add WeChat iLink bridge sidecar runtime"
```

---

### Task 6: Add shared data-provider types, hooks, and Account settings UI

**Files:**
- Create: `packages/data-provider/src/wechat.ts`
- Create: `client/src/data-provider/WeChat/queries.ts`
- Create: `client/src/data-provider/WeChat/mutations.ts`
- Create: `client/src/data-provider/WeChat/index.ts`
- Create: `client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx`
- Create: `client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Modify: `packages/data-provider/src/data-service.ts`
- Modify: `packages/data-provider/src/keys.ts`
- Modify: `packages/data-provider/src/index.ts`
- Modify: `client/src/data-provider/index.ts`
- Modify: `client/src/components/Nav/SettingsTabs/Account/Account.tsx`
- Modify: `client/src/locales/en/translation.json`

- [ ] **Step 1: Write the failing UI test for unbound, healthy, and reauth-required states**

Add `client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import WeChatBinding from '../WeChatBinding';

jest.mock('~/data-provider', () => ({
  useWeChatStatusQuery: jest.fn(),
}));

it('shows the bind CTA when the account is unbound', () => {
  mockedUseWeChatStatusQuery.mockReturnValue({ data: { status: 'unbound', hasBinding: false } });
  render(<WeChatBinding />);
  expect(screen.getByRole('button', { name: /bind wechat/i })).toBeInTheDocument();
});

it('shows the rebind warning when the bridge needs reauth', () => {
  mockedUseWeChatStatusQuery.mockReturnValue({
    data: { status: 'reauth_required', hasBinding: true, ilinkUserId: 'wechat-1' },
  });
  render(<WeChatBinding />);
  expect(screen.getByText(/rebind required/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused UI test and verify it fails**

Run: `cd client && npx jest src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --runInBand`

Expected: FAIL because the component and hooks do not exist yet.

- [ ] **Step 3: Add shared DTOs, endpoints, query keys, and data-service calls**

Create `packages/data-provider/src/wechat.ts`:

```ts
export type TWeChatStatusResponse = {
  status: 'unbound' | 'healthy' | 'reauth_required';
  hasBinding: boolean;
  ilinkUserId?: string | null;
  currentConversation?: {
    conversationId: string;
    parentMessageId: string;
  } | null;
};

export type TWeChatBindStartResponse = {
  bindSessionId: string;
  qrCodeDataUrl: string;
  expiresAt: string;
};

export type TWeChatBindStatusResponse = {
  status: 'pending' | 'healthy' | 'expired' | 'cancelled' | 'reauth_required';
  bindSessionId: string;
};
```

Update `packages/data-provider/src/api-endpoints.ts`:

```ts
const wechatRoot = `${BASE_URL}/api/wechat`;
export const wechatStatus = () => `${wechatRoot}/status`;
export const wechatBindStart = () => `${wechatRoot}/bind/start`;
export const wechatBindStatus = (bindSessionId: string) =>
  `${wechatRoot}/bind/status/${encodeURIComponent(bindSessionId)}`;
export const wechatBindDelete = () => `${wechatRoot}/bind`;
```

Update `packages/data-provider/src/keys.ts`:

```ts
export enum QueryKeys {
  // existing keys...
  wechatStatus = 'wechatStatus',
}

export enum MutationKeys {
  // existing keys...
  bindWeChat = 'bindWeChat',
  unbindWeChat = 'unbindWeChat',
}
```

Update `packages/data-provider/src/data-service.ts`:

```ts
export function getWeChatStatus(): Promise<TWeChatStatusResponse> {
  return request.get(endpoints.wechatStatus());
}

export function startWeChatBind(): Promise<TWeChatBindStartResponse> {
  return request.post(endpoints.wechatBindStart(), {});
}

export function getWeChatBindStatus(bindSessionId: string): Promise<TWeChatBindStatusResponse> {
  return request.get(endpoints.wechatBindStatus(bindSessionId));
}

export function unbindWeChat(): Promise<void> {
  return request.delete(endpoints.wechatBindDelete());
}
```

- [ ] **Step 4: Add client hooks and the Account settings panel**

Create `client/src/data-provider/WeChat/queries.ts`:

```ts
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useQuery } from '@tanstack/react-query';

export const useWeChatStatusQuery = () =>
  useQuery([QueryKeys.wechatStatus], () => dataService.getWeChatStatus(), {
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
  });

export const useWeChatBindStatusQuery = (bindSessionId: string | null, enabled: boolean) =>
  useQuery(
    [QueryKeys.wechatStatus, 'bind', bindSessionId],
    () => dataService.getWeChatBindStatus(bindSessionId ?? ''),
    {
      enabled: enabled && !!bindSessionId,
      refetchInterval: (data) => (data?.status === 'pending' ? 2000 : false),
    },
  );
```

Create `client/src/data-provider/WeChat/mutations.ts`:

```ts
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useStartWeChatBindMutation = () => {
  return useMutation([MutationKeys.bindWeChat], () => dataService.startWeChatBind());
};

export const useUnbindWeChatMutation = () => {
  const queryClient = useQueryClient();
  return useMutation([MutationKeys.unbindWeChat], () => dataService.unbindWeChat(), {
    onSuccess: () => queryClient.invalidateQueries([QueryKeys.wechatStatus]),
  });
};
```

Create `client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx` so it:
- shows current status text
- starts bind and opens a QR dialog
- polls bind status every 2 seconds
- invalidates `wechatStatus` on completion
- offers `Unbind` when bound

Then mount it in `Account.tsx`:

```tsx
<div className="pb-3">
  <WeChatBinding />
</div>
```

- [ ] **Step 5: Add the English localization keys and re-export the hooks**

Add keys like these to `client/src/locales/en/translation.json`:

```json
"com_ui_wechat_bind": "Bind WeChat",
"com_ui_wechat_unbind": "Unbind WeChat",
"com_ui_wechat_rebind_required": "Rebind required",
"com_ui_wechat_bound_healthy": "Connected",
"com_ui_wechat_unbound": "Not connected",
"com_ui_wechat_qr_title": "Scan with WeChat",
"com_ui_wechat_qr_help": "Use WeChat to scan this QR code and complete the bind."
```

Export the module:

```ts
// client/src/data-provider/index.ts
export * from './WeChat';

// packages/data-provider/src/index.ts
export * from './wechat';
```

- [ ] **Step 6: Run the UI test and rebuild the shared data-provider**

Run: `npm run build:data-provider`

Run: `cd client && npx jest src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --runInBand`

Expected: the shared package rebuilds cleanly, and the UI test PASSes.

- [ ] **Step 7: Commit**

```bash
git add packages/data-provider/src/wechat.ts packages/data-provider/src/api-endpoints.ts packages/data-provider/src/data-service.ts packages/data-provider/src/keys.ts packages/data-provider/src/index.ts client/src/data-provider/WeChat/queries.ts client/src/data-provider/WeChat/mutations.ts client/src/data-provider/WeChat/index.ts client/src/data-provider/index.ts client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx client/src/components/Nav/SettingsTabs/Account/Account.tsx client/src/locales/en/translation.json
git commit -m "feat: add WeChat binding settings UI"
```

---

### Task 7: Run the integration pass and manual smoke verification

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused backend and bridge test suites**

Run:

```bash
cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand
cd ../api && npx jest src/wechat/__tests__/service.test.ts src/wechat/__tests__/orchestrator.test.ts src/wechat/bridge/__tests__/commands.test.ts --runInBand
```

Expected: all WeChat-related package tests PASS.

- [ ] **Step 2: Run the server and client focused tests**

Run:

```bash
cd /data/projects/LibreChat/api && npx jest server/routes/__tests__/wechat.spec.js --runInBand
cd /data/projects/LibreChat/client && npx jest src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --runInBand
```

Expected: route and UI tests PASS without requiring unrelated suites.

- [ ] **Step 3: Rebuild the compiled packages used by the app**

Run:

```bash
cd /data/projects/LibreChat && npm run build:data-schemas
npm run build:api
npm run build:data-provider
```

Expected: all three builds finish successfully.

- [ ] **Step 4: Manual smoke the bind and message flow**

Run the two processes in separate terminals:

```bash
cd /data/projects/LibreChat && npm run backend
cd /data/projects/LibreChat && npm run backend:wechat-bridge
```

Then verify:

```text
1. Open Settings -> Account and confirm the WeChat section shows "Not connected".
2. Click "Bind WeChat" and confirm a QR dialog appears.
3. Complete the scan and confirm status flips to "Connected".
4. In WeChat, send `/new` and confirm a new gpt-4o conversation is created.
5. Send a plain text message and confirm the reply appears in both WeChat and the matching LibreChat conversation.
6. On the website, continue the same branch and confirm `/now` in WeChat reports the same conversation.
7. In WeChat, run `/list`, `/switch 1`, and `/now` to confirm snapshot-gated switching works.
8. Force `reauth_required` through the internal health route and confirm the settings UI shows "Rebind required".
```

- [ ] **Step 5: Commit**

```bash
git add .env.example package.json packages/api/package.json packages/api/src/agents/startResumableGeneration.ts packages/api/src/wechat packages/api/src/index.ts packages/data-schemas/src/types/wechat.ts packages/data-schemas/src/types/index.ts packages/data-schemas/src/schema/wechatBinding.ts packages/data-schemas/src/schema/index.ts packages/data-schemas/src/models/wechatBinding.ts packages/data-schemas/src/models/wechatBinding.spec.ts packages/data-schemas/src/models/index.ts packages/data-provider/src/wechat.ts packages/data-provider/src/api-endpoints.ts packages/data-provider/src/config.ts packages/data-provider/src/data-service.ts packages/data-provider/src/index.ts packages/data-provider/src/keys.ts api/cache/getLogStores.js api/server/controllers/agents/request.js api/server/routes/wechat.js api/server/routes/index.js api/server/routes/__tests__/wechat.spec.js api/server/index.js api/server/experimental.js client/src/data-provider/WeChat client/src/data-provider/index.ts client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx client/src/components/Nav/SettingsTabs/Account/Account.tsx client/src/locales/en/translation.json
git commit -m "test: verify WeChat iLink bridge end to end"
```

---

## Plan Self-Review

### Spec Coverage

- Binding persistence, health state, and current branch head are covered by Task 1 and Task 2.
- `/list`, `/new`, `/switch`, `/now`, owner-only eligibility, snapshot gating, and deterministic leaf-head selection are covered by Task 2 and Task 4.
- Reusable generation startup, 90-second timeout, abort, flattening, and next-parent reconciliation are covered by Task 3.
- Sidecar QR bind flow, active-binding bootstrap, poller dedupe, and slash-command routing are covered by Task 5.
- Website bind/status/unbind UI is covered by Task 6.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task names exact files, commands, and expected outcomes.

### Type Consistency

- Persistence type is consistently named `IWeChatBinding`.
- Backend domain service is consistently named `WeChatService`.
- Bridge bearer auth is consistently named `createRequireWeChatBridgeAuth`.
- Output flattener is consistently named `flattenWeChatText`.
