# Subscription System Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] All tests passing (`npm run test:all`)
- [ ] ESLint checks passing (`npm run lint`)
- [ ] TypeScript compilation successful (`npm run build:packages`)
- [ ] No console.errors or TODOs in production code

### Stripe Configuration
- [ ] Live Stripe account created
- [ ] 3 subscription products created in live mode (Explorer, Artisan, Elite monthly)
- [ ] 3 monthly Price IDs documented and added to .env
- [ ] Webhook endpoint added in live mode
- [ ] Webhook signing secret added to .env
- [ ] Test mode thoroughly tested with all flows

### Database
- [ ] Backup production database
- [ ] Run migration script on staging: `npm run migrate:subscription-balance`
- [ ] Verify migration results on staging
- [ ] Plan rollback strategy if migration fails

### Environment Variables
- [ ] `STRIPE_SECRET_KEY` set to live key (`sk_live_xxx`)
- [ ] `STRIPE_WEBHOOK_SECRET` set to live webhook secret
- [ ] `STRIPE_PRICE_EXPLORER_MONTHLY`, `STRIPE_PRICE_ARTISAN_MONTHLY`, `STRIPE_PRICE_ELITE_MONTHLY` set to live Price IDs
- [ ] `DOMAIN_CLIENT` and `DOMAIN_SERVER` set correctly
- [ ] All variables documented in .env.example

## Deployment

### Step 1: Database Migration
```bash
# On production server
npm run migrate:subscription-balance

# Verify results
mongosh
> use LibreChat
> db.balances.findOne()
# Should have subscriptionBalance and topupBalance fields
```

### Step 2: Code Deployment
```bash
# Deploy new code
git pull origin main
npm install
npm run build:packages
npm run frontend

# Restart server
pm2 restart librechat
# OR
docker compose restart
```

### Step 3: Webhook Verification
```bash
# Check webhook is reachable (should return 400, not 404/500)
curl -X POST https://yourdomain.com/api/recharge/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Step 4: Smoke Tests
- [ ] Visit /recharge page (loads without errors)
- [ ] GET /api/recharge/pricing (returns 3 tiers)
- [ ] Click "Subscribe" button (redirects to Stripe)
- [ ] Complete test subscription in live mode
- [ ] Verify webhook received in Stripe Dashboard
- [ ] Verify user subscription status updated
- [ ] Verify subscription balance credited
- [ ] Purchase topup as subscriber
- [ ] Verify topup balance credited
- [ ] Make AI request (credits deducted correctly)
- [ ] Cancel subscription (scheduled for period end)
- [ ] Resume subscription (cancel reverted)

## Post-Deployment

### Monitoring
- [ ] Set up Stripe webhook monitoring (Dashboard → Webhooks → Logs)
- [ ] Monitor API logs for subscription-related errors
- [ ] Set up alerts for failed payments (`invoice.payment_failed`)
- [ ] Monitor balance deduction logic

### User Communication
- [ ] Email existing users about new subscription system
- [ ] Update pricing page on website
- [ ] Prepare FAQ for common questions
- [ ] Train support team on new system

### Documentation
- [ ] Update customer-facing docs
- [ ] Document admin procedures (refunds, manual balance adjustments)
- [ ] Create runbook for common issues

## Rollback Plan

If critical issues occur:

1. **Disable subscriptions temporarily** — set `STRIPE_SECRET_KEY=` to empty in .env and restart
2. **Revert database migration:**
   ```bash
   mongorestore --uri="mongodb://..." ./backup-before-migration
   ```
3. **Revert code:**
   ```bash
   git revert <commit-hash>
   npm install && npm run build:packages
   pm2 restart librechat
   ```
4. **Notify users** via status page

## Success Criteria

- [ ] Zero failed subscription creations
- [ ] 100% webhook delivery success rate
- [ ] No duplicate credit grants
- [ ] All subscription renewals processing correctly
- [ ] No user complaints about billing
- [ ] Balance deductions working correctly
- [ ] Upgrade/downgrade flows working

## Common Issues

### Webhook Not Received
1. Check Stripe Dashboard → Webhooks → Logs
2. Verify endpoint URL is correct
3. Test with `stripe trigger` command
4. Check firewall/security group settings

### Credits Not Granted
1. Check webhook delivery status
2. Verify `invoice.payment_succeeded` event subscribed
3. Check logs for `resetSubscriptionBalance` errors
4. Verify `STRIPE_WEBHOOK_SECRET` is correct

### Topup Not Working
1. Verify user has active subscription (`subscriptionStatus: active`)
2. Verify `stripeCustomerId` is set on user record
3. Check `STRIPE_PRICE_*_TOPUP` env vars are set

### Balance Not Deducting Correctly
1. Check `deductBalance` method in `api/models/balanceMethods.js`
2. Verify both `subscriptionBalance` and `topupBalance` fields exist
3. Run migration if fields are missing
