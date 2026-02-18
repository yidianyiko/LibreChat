# Subscription System Testing Checklist

## Setup
- [ ] Stripe test keys configured in .env
- [ ] Stripe Products and Prices created (6 total: 3 monthly + 3 topup)
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Database migration run successfully (`npm run migrate:subscription-balance`)

## Subscription Flow
- [ ] Create subscription (Explorer tier)
- [ ] Verify webhook received (customer.subscription.created)
- [ ] Verify webhook received (invoice.payment_succeeded)
- [ ] Verify user updated with subscription details
- [ ] Verify subscription balance credited (5,000,000 credits)
- [ ] Verify transaction recorded

## Topup Flow
- [ ] Attempt topup as non-subscriber (should return 403)
- [ ] Subscribe first
- [ ] Purchase topup as subscriber (should succeed)
- [ ] Verify topup balance credited
- [ ] Verify transaction recorded
- [ ] Verify subscription balance unchanged

## Balance Deduction
- [ ] Make AI request
- [ ] Verify deduction from subscription balance first
- [ ] Deplete subscription balance
- [ ] Make another request
- [ ] Verify deduction from topup balance

## Subscription Management
- [ ] Cancel subscription at period end
- [ ] Verify cancelAtPeriodEnd flag set
- [ ] Verify still usable until period end
- [ ] Resume canceled subscription
- [ ] Verify cancelAtPeriodEnd flag cleared

## Tier Changes
- [ ] Upgrade from Explorer to Artisan
- [ ] Verify proration charge
- [ ] Verify subscription balance reset to new tier amount
- [ ] Downgrade from Artisan to Explorer
- [ ] Verify change scheduled for next period

## Renewal
- [ ] Wait for subscription renewal (or trigger manually in Stripe)
- [ ] Verify invoice.payment_succeeded webhook
- [ ] Verify subscription balance reset to tier amount
- [ ] Verify old unused credits cleared

## Error Cases
- [ ] Payment failure (use test card 4000000000000341)
- [ ] Verify subscriptionStatus set to past_due
- [ ] Verify no credits granted
- [ ] Duplicate webhook delivery (send same event twice)
- [ ] Verify idempotency (no duplicate credit grants)

## Stripe CLI Testing Commands

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3080/api/recharge/webhook

# In another terminal, trigger test events:
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger checkout.session.completed
```
