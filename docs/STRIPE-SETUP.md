# Stripe Integration Setup Guide

## Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (get from https://dashboard.stripe.com/test/webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Setup Steps

### 1. Create Stripe Account
- Sign up at https://dashboard.stripe.com/register
- Activate test mode (use test mode for development)

### 2. Get API Keys
- Go to: https://dashboard.stripe.com/test/apikeys
- Copy "Publishable key" -> `STRIPE_PUBLISHABLE_KEY`
- Click "Reveal test key" -> Copy "Secret key" -> `STRIPE_SECRET_KEY`

### 3. Configure Webhook
- Go to: https://dashboard.stripe.com/test/webhooks
- Click "Add endpoint"
- Endpoint URL: `http://localhost:3080/api/recharge/webhook`
- Events to send: Select `checkout.session.completed`
- Click "Add endpoint"
- Copy "Signing secret" -> `STRIPE_WEBHOOK_SECRET`

### 4. Test Payment Flow
1. Start backend: `npm run backend:dev`
2. Start frontend: `npm run frontend:dev`
3. Navigate to http://localhost:3090/recharge
4. Select a pricing tier
5. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
6. Complete payment
7. Verify credits added to account

## Test Card Numbers

Stripe provides test cards for different scenarios:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`

All test cards use:
- Any future expiration date
- Any 3-digit CVC
- Any billing postal code

## Production Deployment

For production:
1. Switch to live mode in Stripe Dashboard
2. Get live API keys (starts with `sk_live_` and `pk_live_`)
3. Update webhook URL to production domain
4. Update `.env` with live keys
5. Never commit API keys to git

## Troubleshooting

**Webhook not receiving events:**
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3080/api/recharge/webhook`
- Check webhook signature is correct
- Verify endpoint is publicly accessible (use ngrok for local testing)

**Payment not adding credits:**
- Check backend logs for webhook errors
- Verify `createTransaction` is working
- Check MongoDB for transaction records
