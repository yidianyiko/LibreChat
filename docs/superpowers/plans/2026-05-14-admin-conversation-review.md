# Admin Conversation Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and verify `/api/admin/conversations`, a gated admin-only API for browsing anonymized conversation/message DTOs for product review.

**Architecture:** The current branch already contains the intended implementation files. New backend logic lives in `packages/api/src/admin/conversations/`; legacy Express code stays thin and only mounts the exported router; shared DTOs live in `packages/data-provider/src/types/admin.ts`; Mongo schema changes are limited to read-path indexes.

**Tech Stack:** TypeScript, Express, Mongoose, Jest, `jsonwebtoken`, `bcryptjs`, `express-rate-limit`, existing LibreChat admin middleware and cache helpers.

---

## Current State

This is a continuation plan, not a greenfield plan. The worktree already has uncommitted implementation and tests for the admin conversation review API. Do not recreate those files from scratch. Start by reconciling the current diff against the spec, run the focused verification commands below, and only patch failures or spec mismatches.

Expected branch: `feat/admin-conversation-review`.

Expected uncommitted file set:

- `docs/superpowers/specs/2026-05-14-admin-conversation-review-design.md`
- `docs/superpowers/plans/2026-05-14-admin-conversation-review.md`
- `packages/data-provider/src/types/admin.ts`
- `packages/data-provider/src/admin-conversations.spec.ts`
- `packages/data-provider/src/index.ts`
- `packages/data-schemas/src/schema/convo.ts`
- `packages/data-schemas/src/schema/message.ts`
- `packages/api/src/admin/index.ts`
- `packages/api/src/admin/conversations/anonymizer.ts`
- `packages/api/src/admin/conversations/config.ts`
- `packages/api/src/admin/conversations/elevatedAuth.ts`
- `packages/api/src/admin/conversations/limiter.ts`
- `packages/api/src/admin/conversations/service.ts`
- `packages/api/src/admin/conversations/transformer.ts`
- `packages/api/src/admin/conversations/unlock.ts`
- `packages/api/src/admin/conversations/index.ts`
- `packages/api/src/admin/conversations/bcryptjs.d.ts`
- `packages/api/src/admin/conversations/__tests__/*.spec.ts`
- `packages/api/src/index.ts`
- `api/server/routes/admin/conversations.js`
- `api/server/routes/admin/__tests__/conversations.spec.js`
- `api/server/routes/index.js`
- `api/server/index.js`
- `api/scripts/hash-admin-convo-password.js`
- `package.json`

## File Responsibilities

- `packages/data-provider/src/types/admin.ts`: public DTO contract. It must not expose raw user identity fields, file fields, metadata fields, or fingerprint fields.
- `packages/data-schemas/src/schema/convo.ts`: adds list-query indexes for `updatedAt`, `endpoint/model`, and `agent_id`.
- `packages/data-schemas/src/schema/message.ts`: adds ordered message lookup index by `conversationId + createdAt + _id`.
- `packages/api/src/admin/conversations/config.ts`: parses and validates required env values at router creation.
- `packages/api/src/admin/conversations/anonymizer.ts`: creates 12-hex-character HMAC anonymous user IDs.
- `packages/api/src/admin/conversations/transformer.ts`: the only DTO serialization path for conversations and messages.
- `packages/api/src/admin/conversations/service.ts`: parses list query params, rejects unsupported params, implements cursor pagination and detail reads.
- `packages/api/src/admin/conversations/elevatedAuth.ts`: creates and verifies the short-lived elevated cookie JWT.
- `packages/api/src/admin/conversations/unlock.ts`: handles function-password unlock and lock, including failed-attempt lockout.
- `packages/api/src/admin/conversations/limiter.ts`: applies per-admin subtree rate limiting.
- `packages/api/src/admin/conversations/index.ts`: wires the router.
- `api/server/routes/admin/conversations.js`: JS wrapper requiring `@librechat/api` and the Mongoose models.
- `api/scripts/hash-admin-convo-password.js`: stdin password hashing helper for operators.

## Task 1: Reconcile Spec And Diff

**Files:**

- Modify: `docs/superpowers/specs/2026-05-14-admin-conversation-review-design.md`
- Modify: `docs/superpowers/plans/2026-05-14-admin-conversation-review.md`

- [ ] **Step 1: Confirm current diff is only the admin conversation review surface**

Run:

```bash
git status --short
git diff --stat
```

Expected: every changed file is in the file set listed in "Current State". If unrelated files appear, inspect them and leave them out of this feature commit unless they are required by the admin conversation review API.

- [ ] **Step 2: Verify the spec matches the intended scope**

Run:

```bash
rg -n "bulk export|full-text|audit|anonUserId|SameSite|ADMIN_CONVERSATIONS|truncated|api/server/routes/admin/__tests__" docs/superpowers/specs/2026-05-14-admin-conversation-review-design.md
```

Expected:

- Bulk export, full-text search, audit log, PII body masking, and frontend admin panel implementation remain out of scope.
- `anonUserId` is display-only in v1; the list endpoint does not accept it.
- `SameSite=Strict` has a same-site deployment assumption.
- Detail responses include `truncated`.
- Integration test path is `api/server/routes/admin/__tests__/`.

- [ ] **Step 3: Verify the plan starts from the dirty worktree**

Run:

```bash
rg -n "continuation|Do not recreate|feat/admin-conversation-review|api/server/routes/admin/__tests__" docs/superpowers/plans/2026-05-14-admin-conversation-review.md
```

Expected: the plan explicitly says this is a continuation plan and points route tests at the real test path.

## Task 2: Verify DTOs And Schema Indexes

**Files:**

- Modify: `packages/data-provider/src/types/admin.ts`
- Modify: `packages/data-provider/src/index.ts`
- Modify: `packages/data-schemas/src/schema/convo.ts`
- Modify: `packages/data-schemas/src/schema/message.ts`
- Test: `packages/data-provider/src/admin-conversations.spec.ts`

- [ ] **Step 1: Check DTO export and privacy contract**

Run:

```bash
sed -n '1,220p' packages/data-provider/src/types/admin.ts
sed -n '1,80p' packages/data-provider/src/index.ts
sed -n '1,220p' packages/data-provider/src/admin-conversations.spec.ts
```

Expected DTO shape:

```ts
export type AdminConvoListItem = {
  id: string;
  conversationId: string;
  anonUserId: string;
  title: string;
  endpoint?: string;
  model?: string;
  agent_id?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type AdminConvoDetail = AdminConvoListItem & {
  messages: AdminMessageItem[];
  truncated: boolean;
};
```

`AdminMessageItem` must use `TMessageContentParts[]` and `TMinimalFeedback`, not `unknown[]`, `Record<string, unknown>`, or raw feedback objects.

- [ ] **Step 2: Check schema indexes**

Run:

```bash
rg -n "updatedAt: -1|endpoint: 1|agent_id: 1|conversationId: 1, createdAt: 1" packages/data-schemas/src/schema/convo.ts packages/data-schemas/src/schema/message.ts
```

Expected indexes:

```ts
convoSchema.index({ updatedAt: -1, _id: -1 });
convoSchema.index({ endpoint: 1, model: 1, updatedAt: -1, _id: -1 });
convoSchema.index({ agent_id: 1, updatedAt: -1, _id: -1 });
messageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
```

- [ ] **Step 3: Run data-provider verification**

Run:

```bash
cd packages/data-provider && npx jest src/admin-conversations.spec.ts --runInBand
```

Expected: PASS. If it fails because type imports are stale, fix `packages/data-provider/src/types/admin.ts` and rerun the same command.

## Task 3: Verify Package API Units

**Files:**

- Modify: `packages/api/src/admin/conversations/config.ts`
- Modify: `packages/api/src/admin/conversations/anonymizer.ts`
- Modify: `packages/api/src/admin/conversations/transformer.ts`
- Modify: `packages/api/src/admin/conversations/service.ts`
- Modify: `packages/api/src/admin/conversations/elevatedAuth.ts`
- Modify: `packages/api/src/admin/conversations/unlock.ts`
- Modify: `packages/api/src/admin/conversations/limiter.ts`
- Test: `packages/api/src/admin/conversations/__tests__/*.spec.ts`

- [ ] **Step 1: Confirm exported function names match tests and router**

Run:

```bash
rg -n "export const|export class|export type" packages/api/src/admin/conversations
```

Expected public names include:

- `anonymizeUserId`
- `parseAdminConversationReviewConfig`
- `createElevatedConvoToken`
- `getElevatedConvoCookieOptions`
- `requireElevatedConvoAccess`
- `createAdminConvoLimiter`
- `parseListParams`
- `listAdminConversations`
- `getAdminConversationDetail`
- `toAdminConvoListItem`
- `toAdminMessageItem`
- `toAdminConvoDetail`
- `handleUnlock`
- `handleLock`
- `createAdminConvoLockoutStore`
- `createAdminConversationsRouter`

- [ ] **Step 2: Confirm config fails closed**

Run:

```bash
sed -n '1,140p' packages/api/src/admin/conversations/config.ts
```

Expected behavior:

- `ADMIN_HASH_SALT` is required and at least 32 bytes.
- `ADMIN_CONVERSATIONS_PASSWORD_HASH` is required and must match bcrypt prefix `$2a$`, `$2b$`, or `$2y$`.
- `ADMIN_CONVERSATIONS_PASSWORD_VERSION` is required and a positive integer.
- `ADMIN_CONVO_SESSION_SECRET` is required and at least 32 bytes.
- `ADMIN_CONVO_COOKIE_SECURE=false` is rejected in production.

- [ ] **Step 3: Confirm transformer is the only DTO boundary**

Run:

```bash
rg -n "res\\.json\\(.*doc|\\.json\\(conversation|\\.json\\(message|toAdminConvo|toAdminMessage" packages/api/src/admin/conversations api/server/routes/admin
```

Expected: no direct document serialization. Router responses should use service results, and service results should be built through `transformer.ts`.

- [ ] **Step 4: Run package API tests**

Run:

```bash
cd packages/api && npx jest src/admin/conversations --runInBand
```

Expected: PASS. If a test fails, patch only the files listed in this task, rerun this same command, and then rerun the affected downstream route test in Task 4.

## Task 4: Verify Express Integration

**Files:**

- Modify: `packages/api/src/admin/conversations/index.ts`
- Modify: `packages/api/src/admin/index.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `api/server/routes/admin/conversations.js`
- Modify: `api/server/routes/index.js`
- Modify: `api/server/index.js`
- Test: `api/server/routes/admin/__tests__/conversations.spec.js`

- [ ] **Step 1: Confirm the JS wrapper stays thin**

Run:

```bash
sed -n '1,80p' api/server/routes/admin/conversations.js
```

Expected wrapper shape:

```js
const express = require('express');
const { createAdminConversationsRouter, requireAdmin } = require('@librechat/api');
const { Conversation, Message } = require('~/db/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth, requireAdmin, createAdminConversationsRouter({ Conversation, Message }));

module.exports = router;
```

- [ ] **Step 2: Confirm the route is exported and mounted**

Run:

```bash
rg -n "adminConversations|/api/admin/conversations" api/server/routes/index.js api/server/index.js packages/api/src/index.ts packages/api/src/admin/index.ts
```

Expected:

- `api/server/routes/index.js` exports `adminConversations`.
- `api/server/index.js` mounts `app.use('/api/admin/conversations', routes.adminConversations)`.
- `packages/api/src/index.ts` exports `./admin`.
- `packages/api/src/admin/index.ts` exports `./conversations`.

- [ ] **Step 3: Run route integration test**

Run:

```bash
cd api && npx jest server/routes/admin/__tests__/conversations.spec.js --runInBand
```

Expected: PASS. This wrapper test must prove JWT/admin middleware runs before the package router and that the wrapper passes the `Conversation` and `Message` models into `createAdminConversationsRouter`. Locked reads, anonymous list payloads, detail payload privacy, unsupported-query rejection, and lock clearing are covered by `packages/api/src/admin/conversations/__tests__/router.spec.ts`.

## Task 5: Verify Operator Hash Script

**Files:**

- Modify: `api/scripts/hash-admin-convo-password.js`
- Modify: `package.json`

- [ ] **Step 1: Confirm script registration**

Run:

```bash
node -e "const p=require('./package.json'); console.log(p.scripts['admin:hash-convo-password'])"
```

Expected:

```text
node api/scripts/hash-admin-convo-password.js
```

- [ ] **Step 2: Verify script behavior**

Run:

```bash
printf 'correct horse battery staple\n' | npm run admin:hash-convo-password --silent
printf '\n' | npm run admin:hash-convo-password --silent
```

Expected:

- First command prints exactly one bcrypt hash line beginning with `$2a$12$`, `$2b$12$`, or `$2y$12$`.
- Second command exits nonzero and does not print a hash.

## Task 6: Final Verification

**Files:**

- Modify only files touched by Tasks 1-5 if verification exposes issues.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd packages/data-provider && npx jest src/admin-conversations.spec.ts --runInBand
cd packages/api && npx jest src/admin/conversations --runInBand
cd api && npx jest server/routes/admin/__tests__/conversations.spec.js --runInBand
```

Expected: all commands pass.

- [ ] **Step 2: Run build and formatting checks**

Run:

```bash
npm run build:data-provider
npx prettier --check docs/superpowers/specs/2026-05-14-admin-conversation-review-design.md docs/superpowers/plans/2026-05-14-admin-conversation-review.md packages/data-provider/src/types/admin.ts packages/data-provider/src/admin-conversations.spec.ts packages/api/src/admin/conversations api/server/routes/admin/conversations.js api/server/routes/admin/__tests__/conversations.spec.js api/scripts/hash-admin-convo-password.js
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Run privacy and scope checks**

Run:

```bash
rg -n "res\\.json\\(.*doc|res\\.json\\(.*conversation|res\\.json\\(.*message|skip|anonUserId|bulk|export|Meili|audit" packages/api/src/admin/conversations api/server/routes/admin docs/superpowers/specs/2026-05-14-admin-conversation-review-design.md
```

Expected:

- No direct Mongoose document JSON response.
- `skip` is rejected by tests or unsupported-param logic.
- `anonUserId` appears only as DTO/display output and spec language explaining why it is not accepted as a v1 query param.
- Bulk export, Meili search, and audit trail remain documented as non-goals or deferred items, with no mounted route.

- [ ] **Step 4: Commit when verification is green**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-05-14-admin-conversation-review-design.md docs/superpowers/plans/2026-05-14-admin-conversation-review.md packages/data-provider/src/types/admin.ts packages/data-provider/src/admin-conversations.spec.ts packages/data-provider/src/index.ts packages/data-schemas/src/schema/convo.ts packages/data-schemas/src/schema/message.ts packages/api/src/admin packages/api/src/index.ts api/server/routes/admin/conversations.js api/server/routes/admin/__tests__/conversations.spec.js api/server/routes/index.js api/server/index.js api/scripts/hash-admin-convo-password.js package.json
git commit -m "feat: add admin conversation review API"
```

Expected: commit succeeds and contains only this feature's files.
