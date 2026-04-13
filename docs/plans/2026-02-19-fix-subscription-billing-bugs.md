# Fix Subscription Billing Bugs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two critical subscription bugs: (1) tier upgrades charge users immediately without confirmation, and (2) subscription credits are never granted (tokenCredits stuck at initial value).

**Architecture:** Problem 1 is a single-line config change + new preview endpoint + frontend confirmation dialog. Problem 2 is a chain of 3 bugs: (A) invoice.subscription null during webhook handling (already has fallback), (B) MongoDB optimistic lock query fails on documents missing `subscriptionBalance`/`topupBalance` fields (the core bug), (C) tokenCredits never updated (symptom of B). Fix B and verify A's fallback works.

**Tech Stack:** Node.js/Express backend, Stripe API, MongoDB/Mongoose, React frontend, Jest tests

---

## Bug Analysis Summary

| Bug | File | Line | Root Cause |
|-----|------|------|------------|
| Upgrade charges immediately | `StripeService.js` | 483 | `proration_behavior: 'always_invoice'` |
| invoice.subscription null | `SubscriptionWebhookHandler.js` | 187-211 | Already has fallback + checkout fallback at line 98 |
| Optimistic lock fails on missing fields | `balanceMethods.js` | 199-203 | `{subscriptionBalance: 0}` doesn't match docs where field is absent |
| tokenCredits never updated | `balanceMethods.js` | 191 | Symptom of optimistic lock failure above |

---

## Task 1: Fix MongoDB Optimistic Lock for Missing Balance Fields

This is the **core bug** preventing credits from ever being granted. When a Balance document was created before the dual-balance fields were added, `subscriptionBalance` and `topupBalance` don't exist in the document. The optimistic lock query `{subscriptionBalance: 0, topupBalance: 0}` fails because MongoDB treats missing fields as `null`, not `0`.

**Files:**
- Modify: `api/models/balanceMethods.js:199-206` (updateDualBalance optimistic lock)
- Modify: `api/models/balanceMethods.js:298-303` (deductBalance optimistic lock)
- Test: `api/models/__tests__/balanceMethods.spec.js`

### Step 1: Write failing test for updateDualBalance with missing fields

Add to `api/models/__tests__/balanceMethods.spec.js`, inside the `updateDualBalance` describe block:

```javascript
it('should handle balance documents missing subscriptionBalance and topupBalance fields', async () => {
  const userId = new mongoose.Types.ObjectId();
  // Simulate a legacy balance document created before dual-balance fields were added
  await Balance.collection.insertOne({
    user: userId,
    tokenCredits: 10,
    // Note: no subscriptionBalance or topupBalance fields
  });

  const result = await updateDualBalance({
    user: userId,
    incrementValue: 5000000,
    balanceType: 'subscription',
  });

  expect(result.subscriptionBalance).toBe(5000000);
  expect(result.topupBalance).toBe(0);
  expect(result.tokenCredits).toBe(5000000);
});
```

### Step 2: Run test to verify it fails

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npx jest api/models/__tests__/balanceMethods.spec.js --testNamePattern="missing subscriptionBalance" --no-coverage`

Expected: FAIL — the optimistic lock retries 10 times and throws "Failed to update balance"

### Step 3: Fix optimistic lock query in updateDualBalance

In `api/models/balanceMethods.js`, replace lines 197-207 (the conditional update block inside `if (currentBalanceDoc)`):

```javascript
// Old code (lines 197-207):
if (currentBalanceDoc) {
  // Conditional update with optimistic locking
  updatedBalance = await Balance.findOneAndUpdate(
    {
      user: user,
      subscriptionBalance: currentSubBalance,
      topupBalance: currentTopupBalance,
    },
    updatePayload,
    { new: true },
  ).lean();

// New code:
if (currentBalanceDoc) {
  // Conditional update with optimistic locking
  // Use $in: [value, null] when value is 0 to match documents where the field
  // is missing (legacy docs created before dual-balance fields were added)
  const subQuery = currentSubBalance === 0
    ? { $in: [0, null] }
    : currentSubBalance;
  const topupQuery = currentTopupBalance === 0
    ? { $in: [0, null] }
    : currentTopupBalance;

  updatedBalance = await Balance.findOneAndUpdate(
    {
      user: user,
      subscriptionBalance: subQuery,
      topupBalance: topupQuery,
    },
    updatePayload,
    { new: true },
  ).lean();
```

**Why `$in: [0, null]`:** In MongoDB, querying `{field: null}` matches documents where the field is `null` or missing entirely. So `$in: [0, null]` matches all three cases: field is `0`, field is `null`, or field doesn't exist.

### Step 4: Fix the same pattern in deductBalance

In `api/models/balanceMethods.js`, replace lines 298-303 (the optimistic lock query inside `deductBalance`):

```javascript
// Old code (lines 298-306):
const updatedBalance = await Balance.findOneAndUpdate(
  {
    user: user,
    subscriptionBalance: currentSubBalance,
    topupBalance: currentTopupBalance,
  },
  updatePayload,
  { new: true },
).lean();

// New code:
const subQuery = currentSubBalance === 0
  ? { $in: [0, null] }
  : currentSubBalance;
const topupQuery = currentTopupBalance === 0
  ? { $in: [0, null] }
  : currentTopupBalance;

const updatedBalance = await Balance.findOneAndUpdate(
  {
    user: user,
    subscriptionBalance: subQuery,
    topupBalance: topupQuery,
  },
  updatePayload,
  { new: true },
).lean();
```

### Step 5: Write failing test for deductBalance with missing fields

Add to `api/models/__tests__/balanceMethods.spec.js`, inside the `deductBalance` describe block:

```javascript
it('should handle balance documents missing subscriptionBalance and topupBalance fields', async () => {
  const userId = new mongoose.Types.ObjectId();
  // Legacy document: only has tokenCredits, no sub/topup fields
  await Balance.collection.insertOne({
    user: userId,
    tokenCredits: 100,
  });

  // Deducting should fail with insufficient balance since both pools are 0/missing
  await expect(
    deductBalance({
      user: userId,
      amount: 50,
    }),
  ).rejects.toThrow('Insufficient balance');
});
```

### Step 6: Run all balanceMethods tests

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npx jest api/models/__tests__/balanceMethods.spec.js --no-coverage`

Expected: ALL PASS — both new tests and all existing tests pass

### Step 7: Commit

```bash
git add api/models/balanceMethods.js api/models/__tests__/balanceMethods.spec.js
git commit -m "fix(balance): handle missing subscriptionBalance/topupBalance in optimistic lock

MongoDB query {subscriptionBalance: 0} does not match documents where the field
is absent (legacy docs created before dual-balance). Use $in: [0, null] to match
missing, null, or zero values.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Upgrade Preview Endpoint (Proration Estimate)

Instead of silently charging users on upgrade, add an endpoint that returns the prorated cost so the frontend can show a confirmation dialog.

**Files:**
- Modify: `api/server/services/StripeService.js` (add preview method)
- Modify: `api/server/routes/recharge.js` (add preview endpoint)
- Test: `api/server/services/__tests__/StripeService.spec.js` (if exists, or create)

### Step 1: Add `previewSubscriptionChange` method to StripeService

In `api/server/services/StripeService.js`, add before the `updateSubscriptionTier` method (before line 461):

```javascript
/**
 * Preview the cost of changing subscription tier (proration preview)
 * @param {string} subscriptionId - Current Stripe Subscription ID
 * @param {string} newTierId - Target tier ID
 * @returns {Promise<Object>} Preview with prorated amount
 */
async previewSubscriptionChange(subscriptionId, newTierId) {
  if (!this.enabled) {
    throw new Error('Stripe service is not enabled');
  }

  const newTier = this.getPricingTierById(newTierId);
  if (!newTier || !newTier.subscriptionPriceId) {
    throw new Error(`Invalid pricing tier: ${newTierId}`);
  }

  const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

  // Create a preview invoice to see what would be charged
  const invoice = await this.stripe.invoices.retrieveUpcoming({
    customer: subscription.customer,
    subscription: subscriptionId,
    subscription_items: [
      {
        id: subscription.items.data[0].id,
        price: newTier.subscriptionPriceId,
      },
    ],
    subscription_proration_behavior: 'always_invoice',
  });

  return {
    proratedAmount: invoice.amount_due, // in cents
    currency: invoice.currency,
    immediateCharge: invoice.amount_due > 0,
    newTierPrice: newTier.price,
    newTierName: newTier.name,
    newTierCredits: newTier.credits,
    periodEnd: new Date(subscription.current_period_end * 1000),
  };
}
```

### Step 2: Add preview endpoint to recharge routes

In `api/server/routes/recharge.js`, add before the `change-subscription-tier` route (before line 459):

```javascript
/**
 * POST /api/recharge/preview-subscription-change
 * Preview the prorated cost of changing subscription tier
 * Body: { newTierId: string }
 */
router.post('/preview-subscription-change', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const { newTierId } = req.body;
    const userId = req.user.id;

    if (!newTierId) {
      return res.status(400).json({ message: 'Missing required parameter: newTierId' });
    }

    const user = await User.findById(userId);
    if (!user || !user.subscriptionId) {
      return res.status(400).json({ message: 'No active subscription found' });
    }

    if (user.subscriptionStatus !== 'active') {
      return res.status(400).json({ message: 'Subscription is not active' });
    }

    if (user.subscriptionTier === newTierId) {
      return res.status(400).json({ message: 'You are already subscribed to this tier' });
    }

    const stripeService = getStripeService();
    if (!stripeService.isEnabled()) {
      return res.status(503).json({ message: 'Stripe service is not configured' });
    }

    const preview = await stripeService.previewSubscriptionChange(user.subscriptionId, newTierId);
    res.json(preview);
  } catch (error) {
    logger.error('[Recharge API] Error previewing subscription change:', error);
    res.status(500).json({
      message: 'Failed to preview subscription change',
      error: error.message,
    });
  }
});
```

### Step 3: Run backend tests to verify no regressions

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npm run test:api -- --no-coverage`

Expected: ALL PASS

### Step 4: Commit

```bash
git add api/server/services/StripeService.js api/server/routes/recharge.js
git commit -m "feat(recharge): add subscription change preview endpoint

New POST /api/recharge/preview-subscription-change returns prorated cost
before the user commits to a tier change. Uses Stripe's upcoming invoice
API to calculate the exact charge amount.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Add Frontend Confirmation Dialog for Tier Changes

The frontend currently calls the tier change endpoint directly. Add a confirmation step that shows the prorated cost.

**Files:**
- Find and modify: The component that calls `change-subscription-tier` (search for `change-subscription-tier` in `client/src/`)
- Create if needed: A confirmation dialog component

### Step 1: Find the frontend component that triggers tier changes

Run: `grep -rn "change-subscription-tier" client/src/` to locate the component.

### Step 2: Add API call to preview endpoint

In the data-provider or directly in the component, add a function:

```typescript
const previewSubscriptionChange = async (newTierId: string) => {
  const response = await fetch('/api/recharge/preview-subscription-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newTierId }),
  });
  if (!response.ok) {
    throw new Error('Failed to preview subscription change');
  }
  return response.json();
};
```

### Step 3: Add confirmation dialog before executing tier change

When user clicks upgrade:
1. Call preview endpoint to get prorated cost
2. Show dialog: "Upgrading to {tierName} will charge ${proratedAmount/100} now. Your new monthly rate will be ${newTierPrice/100}/month with {credits} credits. Confirm?"
3. Only call `change-subscription-tier` if user confirms

**Implementation details depend on the exact component found in Step 1.** The engineer should:
- Find the click handler that calls `POST /api/recharge/change-subscription-tier`
- Insert a preview call + confirmation dialog before the actual tier change call
- Handle loading/error states for the preview request

### Step 4: Test manually

1. Log in as a user with an active subscription
2. Click to change tier
3. Verify: a confirmation dialog appears showing the prorated amount
4. Click cancel → no charge
5. Click confirm → tier changes

### Step 5: Commit

```bash
git add client/src/
git commit -m "feat(recharge): add confirmation dialog for subscription tier changes

Shows prorated cost before charging. User must explicitly confirm the
upgrade/downgrade before any payment is processed.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Verify Webhook Credit Granting Works End-to-End

After fixing Task 1 (optimistic lock), verify the full chain works: webhook → resetSubscriptionBalance → tokenCredits updated.

**Files:**
- Test: `api/server/services/__tests__/SubscriptionWebhookHandler.spec.js`

### Step 1: Add integration-style test for the full credit grant flow

The existing test at line 92-126 of `SubscriptionWebhookHandler.spec.js` mocks `resetSubscriptionBalance`. We need to verify the real function works when called. The balanceMethods tests from Task 1 already cover this, but add one more test to the webhook spec to verify the flow with the fallback path:

Add to `SubscriptionWebhookHandler.spec.js`:

```javascript
describe('handleInvoicePaymentSucceeded - subscription ID resolution', () => {
  it('should resolve subscription from line items when invoice.subscription is null', async () => {
    const invoice = {
      id: 'in_123',
      subscription: null, // Bug A: null subscription field
      billing_reason: 'subscription_create',
      amount_paid: 499,
      currency: 'usd',
      lines: {
        data: [
          {
            subscription: 'sub_123', // Available in line items
            parent: { subscription: 'sub_123' },
          },
        ],
      },
    };

    const subscription = {
      id: 'sub_123',
      metadata: { userId: 'user123', tierId: 'explorer' },
      current_period_start: 1234567890,
      current_period_end: 1237159890,
    };

    handler.stripeService.stripe.subscriptions.retrieve.mockResolvedValue(subscription);
    resetSubscriptionBalance.mockResolvedValue({});
    createTransaction.mockResolvedValue({});

    const result = await handler.handleInvoicePaymentSucceeded(invoice);

    expect(result.message).toBe('Subscription credits granted');
    expect(handler.stripeService.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    expect(resetSubscriptionBalance).toHaveBeenCalledWith({
      user: 'user123',
      newSubscriptionBalance: 5000000,
    });
  });
});
```

### Step 2: Run webhook handler tests

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npx jest api/server/services/__tests__/SubscriptionWebhookHandler.spec.js --no-coverage`

Expected: ALL PASS

### Step 3: Commit

```bash
git add api/server/services/__tests__/SubscriptionWebhookHandler.spec.js
git commit -m "test(webhook): add test for subscription ID resolution from line items

Verifies the fallback path when invoice.subscription is null but
subscription ID is available in line items.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add Data Migration Script for Existing Balance Documents

Existing balance documents in production may lack `subscriptionBalance` and `topupBalance` fields. While the code fix in Task 1 handles this at runtime, a one-time migration ensures data consistency.

**Files:**
- Create: `config/migrate-balance-fields.js`

### Step 1: Write the migration script

```javascript
#!/usr/bin/env node
/**
 * Migration: Add subscriptionBalance and topupBalance fields to existing Balance documents.
 *
 * Existing documents created before the dual-balance system may lack these fields.
 * This script initializes them to 0 for documents that don't have them.
 *
 * Usage: node config/migrate-balance-fields.js
 * Requires: MONGO_URI environment variable
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function migrate() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('balances');

  // Find documents missing the new fields
  const result = await collection.updateMany(
    {
      $or: [
        { subscriptionBalance: { $exists: false } },
        { topupBalance: { $exists: false } },
      ],
    },
    {
      $set: {
        subscriptionBalance: 0,
        topupBalance: 0,
      },
    },
  );

  console.log(`Updated ${result.modifiedCount} balance documents`);
  await mongoose.disconnect();
  console.log('Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

### Step 2: Test locally (if local MongoDB available)

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && node config/migrate-balance-fields.js`

Expected: "Updated N balance documents" and "Migration complete"

### Step 3: Commit

```bash
git add config/migrate-balance-fields.js
git commit -m "chore: add migration script for dual-balance fields

Initializes subscriptionBalance and topupBalance to 0 on existing
Balance documents that were created before the dual-balance system.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Run Full Test Suite and Verify

### Step 1: Run all tests

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npm run test:api -- --no-coverage`

Expected: ALL PASS

### Step 2: Run linter

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npm run lint`

Expected: No new lint errors

### Step 3: Build packages (verify no type errors)

Run: `cd /home/ydyk/workspace/refers/AWS-server/LibreChat && npm run build:packages`

Expected: Successful build

---

## Deployment Checklist

After all tasks are complete and merged:

1. **Run migration on production:**
   ```bash
   ssh -i AWS.pem ubuntu@57.180.42.152
   cd /path/to/LibreChat
   node config/migrate-balance-fields.js
   ```

2. **Deploy new code** (see CLAUDE.md for deployment steps)

3. **Verify in production:**
   - Check a user's balance document has `subscriptionBalance` and `topupBalance` fields
   - Trigger a test subscription payment via Stripe test mode
   - Verify `tokenCredits` updates correctly
   - Verify tier change shows confirmation dialog with prorated amount
