# Subscription System

LibreChat supports a Stripe-based subscription model that provides users with monthly credit allocations and the ability to purchase permanent topup credits.

## Overview

The subscription system uses a **dual balance pool** architecture:

- **Subscription Balance** — Monthly credits that reset each billing period. Consumed first.
- **Topup Balance** — Permanent credits purchased separately. Consumed after subscription balance is depleted.

### Pricing Tiers

| Tier | Price/month | Monthly Credits |
|------|------------|-----------------|
| Explorer | $4.99 | 5,000,000 (~150 GPT-4o msgs) |
| Artisan | $14.99 | 15,000,000 (~700 GPT-4o msgs) |
| Elite | $34.99 | 35,000,000 (~2,000 GPT-4o msgs) |

Topup packages match the subscription tiers and can only be purchased by active subscribers.

## Architecture

### Balance Deduction Order

1. Subscription balance is checked first
2. If insufficient, topup balance is used
3. If both are insufficient, the request is blocked

### Key Files

**Backend:**
- `api/server/services/StripeService.js` — Stripe API wrapper, pricing tiers, checkout session creation
- `api/server/services/SubscriptionWebhookHandler.js` — Handles all Stripe webhook events
- `api/server/routes/recharge.js` — REST API endpoints
- `api/models/balanceMethods.js` — Dual balance read/write methods
- `api/server/scripts/migrateToSubscriptionBalance.js` — One-time migration script

**Frontend:**
- `client/src/components/Recharge/RechargePage.tsx` — Main subscription/topup UI
- `client/src/hooks/Subscriptions.ts` — React Query hooks for subscription state

**Packages:**
- `packages/data-schemas/src/schema/user.ts` — Subscription fields on User model
- `packages/data-schemas/src/schema/balance.ts` — Dual balance fields
- `packages/data-provider/src/data-service.ts` — API client functions

## Environment Variables

Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription price IDs (create in Stripe Dashboard - recurring monthly)
STRIPE_PRICE_EXPLORER_MONTHLY=price_...
STRIPE_PRICE_ARTISAN_MONTHLY=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...
```

**Note:** Topup purchases use dynamic pricing and do not require pre-created Price IDs.

## Stripe Product Setup

Create 3 subscription products in the Stripe Dashboard:

### Subscription Products (recurring monthly)

1. **Explorer Monthly** — $4.99/month
   - Mode: `subscription`
   - Price ID → `STRIPE_PRICE_EXPLORER_MONTHLY`

2. **Artisan Monthly** — $14.99/month
   - Mode: `subscription`
   - Price ID → `STRIPE_PRICE_ARTISAN_MONTHLY`

3. **Elite Monthly** — $34.99/month
   - Mode: `subscription`
   - Price ID → `STRIPE_PRICE_ELITE_MONTHLY`

**Note:** Topup purchases use `price_data` (dynamic pricing) — no pre-created Price objects needed.

## Webhook Configuration

Configure in Stripe Dashboard → Webhooks → Add endpoint:

**URL:** `https://yourdomain.com/api/recharge/webhook`

**Events to subscribe:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## API Endpoints

All endpoints require authentication (`requireJwtAuth`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/recharge/pricing` | Get pricing tiers + user subscription status |
| POST | `/api/recharge/create-subscription` | Create Stripe Checkout for subscription |
| POST | `/api/recharge/create-topup` | Create Stripe Checkout for topup (subscribers only) |
| GET | `/api/recharge/subscription-status` | Get current subscription + balance info |
| POST | `/api/recharge/cancel-subscription` | Cancel subscription at period end |
| POST | `/api/recharge/resume-subscription` | Resume a canceled subscription |
| POST | `/api/recharge/change-subscription-tier` | Upgrade or downgrade tier |
| POST | `/api/recharge/webhook` | Stripe webhook receiver (no auth) |

### Request/Response Examples

**GET /api/recharge/subscription-status**
```json
{
  "subscriptionStatus": "active",
  "subscriptionTier": "explorer",
  "subscriptionBalance": 4850000,
  "topupBalance": 15000000,
  "currentPeriodEnd": "2026-03-18T00:00:00.000Z",
  "cancelAtPeriodEnd": false
}
```

**POST /api/recharge/create-subscription**
```json
{ "tierId": "explorer" }
```
Returns: `{ "url": "https://checkout.stripe.com/..." }`

**POST /api/recharge/create-topup**
```json
{ "tierId": "artisan" }
```
Returns: `{ "url": "https://checkout.stripe.com/..." }`

## Subscription Lifecycle

### New Subscription

1. User selects tier → `POST /create-subscription`
2. Backend creates Stripe Checkout Session (subscription mode)
3. User redirected to Stripe Checkout
4. On payment: `checkout.session.completed` → ignored for subscriptions (handled by invoice events)
5. `customer.subscription.created` → user document updated with subscription details
6. `invoice.payment_succeeded` → subscription balance reset to tier amount, transaction recorded

### Monthly Renewal

1. Stripe charges card automatically
2. `invoice.payment_succeeded` → `resetSubscriptionBalance()` called
3. Old unused subscription credits are cleared; new allocation granted
4. Topup balance is untouched

### Topup Purchase

1. User clicks "Buy Topup" → `POST /create-topup`
2. Backend verifies active subscription + `stripeCustomerId` exists
3. Stripe Checkout Session created (payment mode)
4. `checkout.session.completed` with `metadata.type = 'topup'` → `grantTopupCredits()` called
5. Topup balance incremented (permanent, never reset)

### Cancel Subscription

1. `POST /cancel-subscription`
2. `cancelAtPeriodEnd` set to `true` on user document
3. Subscription remains usable until `currentPeriodEnd`
4. At period end: `customer.subscription.deleted` → subscription fields cleared

### Resume Subscription

1. `POST /resume-subscription`
2. Stripe `cancel_at_period_end` set to `false`
3. `cancelAtPeriodEnd` cleared on user document

### Tier Changes

**Upgrade (immediate):** Charged pro-rata immediately, subscription balance reset to new tier amount.

**Downgrade:** Scheduled for next billing period, no immediate charge.

## Database Schema

### User Model Fields

```
stripeCustomerId     String  Stripe customer ID
subscriptionId       String  Active subscription ID
subscriptionStatus   Enum    active|canceled|past_due|incomplete|trialing|paused
subscriptionTier     Enum    explorer|artisan|elite
subscriptionStartDate Date
currentPeriodStart   Date
currentPeriodEnd     Date
cancelAtPeriodEnd    Boolean
```

### Balance Model Fields

```
subscriptionBalance  Number  Monthly credits (resets on renewal)
topupBalance         Number  Permanent credits (never reset)
lastSubscriptionReset Date   Timestamp of last reset
tokenCredits         Number  Legacy field (preserved for backward compat)
```

### Transaction Model Fields

```
balanceType  Enum  subscription|topup|legacy  Which pool was affected
context      Enum  subscription_charge|subscription_topup|...
```

## Database Migration

For existing deployments, run the migration to initialize dual balance fields:

```bash
MONGO_URI=mongodb://localhost:27017/LibreChat npm run migrate:subscription-balance
```

This sets `subscriptionBalance: 0` and `topupBalance: tokenCredits` for all existing balance records, preserving existing credits as topup balance.

## Testing

### Unit Tests

```bash
# Webhook handler tests
cd api && npm test -- server/services/__tests__/SubscriptionWebhookHandler.spec.js

# Balance method tests
cd api && npm test -- models/__tests__/balanceMethods.spec.js
```

### Local Webhook Testing with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3080/api/recharge/webhook

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

### Test Cards

| Scenario | Card Number |
|----------|-------------|
| Success | `4242 4242 4242 4242` |
| Payment failure | `4000 0000 0000 0341` |
| Decline | `4000 0000 0000 0002` |

### Manual Testing Checklist

See `docs/plans/subscription-testing-checklist.md` for a complete step-by-step testing guide.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Payment failure | `subscriptionStatus` set to `past_due`, no credits granted |
| Topup without subscription | HTTP 403 returned |
| Duplicate webhook | Idempotent — no duplicate credits |
| Missing userId in metadata | Error logged, event skipped |

## Frontend Integration

Import subscription hooks from `~/hooks/Subscriptions`:

```typescript
import {
  useGetSubscriptionStatus,
  useCreateSubscription,
  useCreateTopup,
  useCancelSubscription,
  useResumeSubscription,
  useChangeSubscriptionTier,
} from '~/hooks/Subscriptions';

// Get current status
const { data: status } = useGetSubscriptionStatus();

// Create subscription
const createSub = useCreateSubscription();
await createSub.mutateAsync('explorer');

// Cancel subscription
const cancel = useCancelSubscription();
await cancel.mutateAsync();
```

All mutations automatically invalidate the `subscriptionStatus` query cache on success.
