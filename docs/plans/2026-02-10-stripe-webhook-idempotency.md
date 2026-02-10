# Stripe Webhook Idempotency Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Stripe webhook duplicate delivery handling by removing in-memory idempotency (which can permanently block retries) and adding database-level idempotency that is safe under concurrency.

**Architecture:** Rely on a unique MongoDB index on `(context, metadata.sessionId)` to guarantee only one recharge transaction per Stripe Checkout Session. Treat duplicate key errors as "already processed". Remove the process-local `processedSessions` Set so retries are not blocked across failures/restarts.

**Tech Stack:** Node.js, Express, Jest, Mongoose models from `@librechat/data-schemas`.

---

### Task 1: Add failing unit test for StripeService duplicate session handling

**Files:**
- Create: `api/server/services/__tests__/StripeService.spec.js`

**Step 1: Write the failing test**

```js
const { StripeService } = require('../StripeService');

describe('StripeService.handlePaymentSuccess', () => {
  it('does not permanently block retries for the same session id (no in-memory idempotency)', async () => {
    const service = new StripeService();
    const session = {
      id: 'cs_test_same',
      metadata: { userId: 'u1', tierId: 'explorer' },
      payment_status: 'paid',
      amount_total: 499,
      customer_email: 't@example.com',
      subscription: null,
    };

    await expect(service.handlePaymentSuccess(session)).resolves.toBeTruthy();
    await expect(service.handlePaymentSuccess(session)).resolves.toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd api && npm test -- api/server/services/__tests__/StripeService.spec.js`

Expected: FAIL on the second call with an "already processed" error (current behavior).

**Step 3: (No production code yet)**

---

### Task 2: Add failing webhook test for duplicate key handling

**Files:**
- Create: `api/server/routes/__tests__/recharge.webhook.spec.js`

**Step 1: Write the failing test**

Test intent: When `createTransaction()` throws a Mongo duplicate key error (`code: 11000`), webhook should return HTTP 200 with `{ received: true, message: 'Already processed' }` (and not 400).

**Step 2: Run test to verify it fails**

Run: `cd api && npm test -- api/server/routes/__tests__/recharge.webhook.spec.js`

Expected: FAIL because current code does a pre-check or returns 400 on error.

---

### Task 3: Implement minimal production changes

**Files:**
- Modify: `api/server/services/StripeService.js`
- Modify: `api/server/routes/recharge.js`

**Step 1: Remove process-local idempotency**
- Delete `processedSessions` Set usage and checks from `handlePaymentSuccess()`.

**Step 2: Ensure a unique DB constraint exists for Stripe recharge session id**
- Add a one-time index initializer for `Transaction`:
  - Keys: `{ context: 1, 'metadata.sessionId': 1 }`
  - Options: `{ unique: true, partialFilterExpression: { 'metadata.sessionId': { $exists: true } }, name: 'uniq_stripe_recharge_session' }`
- Call it at the start of webhook processing.

**Step 3: Make webhook handler concurrency-safe**
- Remove the `findOne()` pre-check for existing transactions.
- Attempt `createTransaction()` directly.
- If error is duplicate key (`err.code === 11000`): return `{ received: true, message: 'Already processed' }`.

**Step 4: Run tests**

Run:
- `cd api && npm test -- api/server/services/__tests__/StripeService.spec.js`
- `cd api && npm test -- api/server/routes/__tests__/recharge.webhook.spec.js`

Expected: PASS.

---

### Task 4: (Optional) Add docs note about DB index requirement

**Files:**
- Modify (optional): `docs/STRIPE-SETUP.md`

Add a short note: webhook idempotency depends on the unique index; index is created automatically on first webhook request.

