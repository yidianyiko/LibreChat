# Stripe Integration Setup Guide

## Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Secret Key (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...

# Webhook Secret (get from https://dashboard.stripe.com/test/webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription Price IDs (recurring monthly - must be pre-created in Stripe Dashboard)
STRIPE_PRICE_EXPLORER_MONTHLY=price_...
STRIPE_PRICE_ARTISAN_MONTHLY=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...
```

## Setup Steps

### 1. Create Stripe Account
- Sign up at https://dashboard.stripe.com/register
- Activate test mode (use test mode for development)

### 2. Get API Keys
- Go to: https://dashboard.stripe.com/test/apikeys
- Copy "Secret key" → `STRIPE_SECRET_KEY`

### 3. Create Subscription Products and Prices

Create 3 subscription products in the Stripe Dashboard (Products → Add product):

**Subscription products (recurring monthly):**

| Product | Price | Billing | Env var |
|---------|-------|---------|---------|
| Explorer Monthly | $4.99 | Monthly | `STRIPE_PRICE_EXPLORER_MONTHLY` |
| Artisan Monthly | $14.99 | Monthly | `STRIPE_PRICE_ARTISAN_MONTHLY` |
| Elite Monthly | $34.99 | Monthly | `STRIPE_PRICE_ELITE_MONTHLY` |

Copy each Price ID (starts with `price_`) to the corresponding env var.

**Note:** Topup purchases use dynamic pricing (`price_data`) and do not require pre-created Price objects.

### 4. Configure Webhook

- Go to: https://dashboard.stripe.com/test/webhooks
- Click "Add endpoint"
- Endpoint URL: `https://yourdomain.com/api/recharge/webhook`
  - Local development: use Stripe CLI (see below)
- Events to subscribe:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Copy "Signing secret" → `STRIPE_WEBHOOK_SECRET`

### 5. Run Database Migration

If upgrading an existing installation:

```bash
MONGO_URI=mongodb://localhost:27017/LibreChat npm run migrate:subscription-balance
```

This migrates existing balances to the dual balance system.

### 6. Test the Flow

1. Start backend: `npm run backend:dev`
2. Start frontend: `npm run frontend:dev`
3. Forward webhooks: `stripe listen --forward-to localhost:3080/api/recharge/webhook`
4. Navigate to http://localhost:3090/recharge
5. Subscribe to a tier using test card `4242 4242 4242 4242`
6. Verify subscription balance credited in account

## Local Development with Stripe CLI

```bash
# Install
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3080/api/recharge/webhook

# Trigger test events manually
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

## Test Card Numbers

| Scenario | Card Number |
|----------|-------------|
| Success | `4242 4242 4242 4242` |
| Payment failure | `4000 0000 0000 0341` |
| Decline | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |

All test cards: any future expiration date, any 3-digit CVC, any postal code.

## Production Deployment

1. Switch to live mode in Stripe Dashboard
2. Get live API keys (starts with `sk_live_`)
3. Create live products and prices (separate from test mode)
4. Update webhook URL to production domain
5. Update `.env` with live keys
6. Never commit API keys to git

## Documentation

For full subscription system documentation, see `docs/features/subscription-system.md`.

## Troubleshooting

**Webhook not receiving events:**
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3080/api/recharge/webhook`
- Check webhook signature is correct in `.env`
- Verify all 6 events are subscribed in Dashboard

**Subscription balance not credited:**
- Check that `invoice.payment_succeeded` event is listed in webhook config
- Check backend logs for webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret

**Topup returns 403:**
- User must have an active subscription before purchasing topup
- Check `subscriptionStatus` is `active` in user record

**Price IDs not found:**
- Ensure all 6 `STRIPE_PRICE_*` env vars are set
- Verify price IDs exist in Stripe Dashboard (test mode vs live mode)
