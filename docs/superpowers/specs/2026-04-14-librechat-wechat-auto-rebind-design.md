# LibreChat WeChat Auto-Rebind Design

## Goal

Make WeChat QR binding silently transfer ownership when the scanned WeChat account is already bound to a different LibreChat user.

After the change:

- the newly authenticated LibreChat user finishes binding successfully
- the previous LibreChat user is automatically moved to `unbound`
- the frontend bind flow stops polling and completes normally instead of remaining stuck in `pending`

## Context

The current persistence model intentionally enforces a single active binding for each WeChat account:

- [`packages/data-schemas/src/schema/wechatBinding.ts`](/data/projects/LibreChat/packages/data-schemas/src/schema/wechatBinding.ts) defines `ilinkUserId` as `unique: true`
- [`api/server/routes/wechat.js`](/data/projects/LibreChat/api/server/routes/wechat.js) currently implements `completeBinding` as a direct upsert by `userId`
- [`packages/api/src/wechat/bridge/bindStatus.ts`](/data/projects/LibreChat/packages/api/src/wechat/bridge/bindStatus.ts) treats any non-`ok` response from `/api/wechat/internal/bindings/complete` as a non-terminal bind session and leaves the session public status at `pending`

That combination causes the production failure pattern:

1. user B scans with a WeChat account already bound to user A
2. `completeBinding` attempts to write user B with user A's `ilinkUserId`
3. MongoDB raises `E11000 duplicate key error`
4. the bridge sees a failed HTTP response and keeps the bind session in `pending`
5. the website keeps polling with no visible resolution

The uniqueness rule is correct. The missing behavior is ownership transfer during bind completion.

## Scope

### In Scope

- Change the existing `completeBinding` write path to support silent ownership transfer
- Keep the existing unique index on `ilinkUserId`
- Automatically clear the old LibreChat user's WeChat runtime state when ownership transfers
- Preserve the existing frontend and bridge API contracts
- Add focused tests for transfer success and regression protection

### Out of Scope

- Adding a new transfer or admin API
- Prompting the user for confirmation before transfer
- Showing a special UI message that the binding came from another account
- Deleting old conversations or other non-WeChat user data
- Changing `bindStatus` polling semantics beyond what naturally changes when `completeBinding` returns success

## Chosen Approach

Implement transfer semantics inside the existing `completeBinding` persistence path in [`api/server/routes/wechat.js`](/data/projects/LibreChat/api/server/routes/wechat.js).

When `completeBinding` receives `{ userId, ilinkUserId, ilinkBotId, botToken, baseUrl }`, the server should treat `ilinkUserId` as the canonical owner key and reconcile any previous owner before writing the new owner.

This keeps the change at the true source of failure:

- the bridge remains a thin caller and does not gain ownership-transfer logic
- the frontend remains unchanged and benefits automatically when bind completion returns `204`
- the unique index continues protecting data integrity rather than being relaxed

## Design

### Binding Transfer Rules

`completeBinding` should follow this behavior:

1. Look up any existing binding document with the incoming `ilinkUserId`.
2. If no document exists, bind the requesting `userId` normally.
3. If the existing document belongs to the same `userId`, treat the operation as a normal rebind and refresh the binding fields.
4. If the existing document belongs to a different `userId`, automatically transfer ownership:
   - old owner becomes `unbound`
   - new owner becomes `healthy`
   - no special response payload is returned
   - the request still succeeds with `204`

### Old Owner Cleanup

When ownership transfers away from the previous owner, clear all WeChat runtime state from that old binding document:

- `status: 'unbound'`
- unset `ilinkUserId`
- set `ilinkBotId: null`
- set `botToken: null`
- set `baseUrl: null`
- set `boundAt: null`
- set `welcomeMessageSentAt: null`
- set `unhealthyAt: null`
- set `currentConversation: null`
- set `unboundAt` to the current time

This matches the agreed product behavior:

- preserve historical LibreChat conversations and account data
- remove every active WeChat association and session-like pointer from the old owner

### New Owner Write

After any necessary cleanup, write the incoming binding onto the requesting `userId`:

- `ilinkUserId`
- `ilinkBotId`
- `botToken`
- `baseUrl`
- `status: 'healthy'`
- `boundAt` to the current time
- `welcomeMessageSentAt: null`
- `unhealthyAt: null`
- `unboundAt: null`

`currentConversation` should not be overwritten during bind completion for the new owner. Existing post-bind behavior already handles conversation initialization separately.

### Atomicity

The transfer should be implemented as one logical operation, not as exception-driven retry logic.

Preferred behavior:

- run the old-owner cleanup and new-owner bind write inside a MongoDB transaction

Why:

- prevents transient uniqueness races during ownership transfer
- expresses transfer as a normal business action instead of a duplicate-key fallback path
- keeps the unique index fully enforced

If the active MongoDB configuration cannot execute transactions in the current runtime, the implementation may use the same ordered steps without changing the external contract, but the target design remains transactional transfer.

### Error Handling

- Do not remove the unique index.
- Do not add a second API.
- Do not intentionally rely on `E11000` to drive the happy path.
- If the transfer operation fails, `completeBinding` should still fail normally so the bind session does not produce a false success.

The user-visible improvement comes from making the ownership-transfer case succeed, not from hiding arbitrary persistence failures.

## File Targets

- [`api/server/routes/wechat.js`](/data/projects/LibreChat/api/server/routes/wechat.js)
  - replace the direct `completeBinding` upsert with transfer-aware persistence
  - add any local helper needed to build the old-owner cleanup update document
- [`api/server/routes/__tests__/wechat.spec.js`](/data/projects/LibreChat/api/server/routes/__tests__/wechat.spec.js)
  - add route-level coverage for successful ownership transfer
- [`packages/data-schemas/src/models/wechatBinding.spec.ts`](/data/projects/LibreChat/packages/data-schemas/src/models/wechatBinding.spec.ts)
  - extend model-level coverage so transfer expectations are explicit against the real schema
- [`packages/api/src/wechat/bridge/__tests__/main.test.ts`](/data/projects/LibreChat/packages/api/src/wechat/bridge/__tests__/main.test.ts)
  - add or adjust a regression test proving the bind session becomes `healthy` when the server now accepts a transfer case

No frontend contract changes are expected.

## Testing

### Required Coverage

- existing owner A bound to `ilinkUserId = X`, new owner B completes bind with `X`
  - request succeeds
  - owner A becomes `unbound`
  - owner A no longer has `ilinkUserId`
  - owner A has `currentConversation: null`
  - owner B becomes `healthy` with `ilinkUserId = X`
- same owner rebind with the same `ilinkUserId`
  - request succeeds
  - no extra ownership-transfer cleanup is applied to another user
- bind completion still behaves normally when `ilinkUserId` is unused
- bridge bind-session regression
  - when `/internal/bindings/complete` succeeds, public bind status advances out of `pending`

### Verification Commands

- `cd packages/data-schemas && npx jest src/models/wechatBinding.spec.ts --runInBand`
- `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
- `cd packages/api && npx jest src/wechat/bridge/__tests__/main.test.ts --runInBand`

## Acceptance Criteria

- Scanning with a WeChat account that is already bound to another LibreChat user no longer returns a duplicate-key failure.
- The previous owner is silently unbound and loses all active WeChat runtime state.
- The new owner finishes the QR binding flow successfully without special UI.
- The unique `ilinkUserId` constraint remains in place.
- The website bind polling no longer stays stuck in `pending` for this transfer case.
