const express = require('express');
const { requireJwtAuth, checkBan, webhookLimiter } = require('~/server/middleware');
const { getStripeService } = require('~/server/services/StripeService');
const { SubscriptionWebhookHandler } = require('~/server/services/SubscriptionWebhookHandler');
const { logger } = require('~/config');
const { createTransaction } = require('~/models/Transaction');
const { Transaction, User, Balance } = require('~/db/models');

const router = express.Router();

let ensureStripeRechargeIndexPromise;
async function ensureStripeRechargeIndex() {
  if (!ensureStripeRechargeIndexPromise) {
    ensureStripeRechargeIndexPromise = Transaction.collection
      .createIndex(
        { context: 1, 'metadata.sessionId': 1 },
        {
          name: 'uniq_stripe_recharge_session',
          unique: true,
          partialFilterExpression: { 'metadata.sessionId': { $exists: true } },
        },
      )
      .catch((err) => {
        // Don't cache a rejection; allow the next webhook delivery to retry index creation.
        ensureStripeRechargeIndexPromise = null;
        throw err;
      });
  }
  return ensureStripeRechargeIndexPromise;
}

/**
 * GET /api/recharge/pricing
 * 获取所有价格套餐
 */
router.get('/pricing', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe payment service is not configured',
        enabled: false,
      });
    }

    const pricingTiers = stripeService.getPricingTiers();

    // Get user's subscription status
    const user = await User.findById(req.user.id);
    const hasActiveSubscription = user?.subscriptionStatus === 'active';

    res.json({
      enabled: true,
      tiers: pricingTiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        price: tier.price,
        credits: tier.credits,
        // Don't expose Stripe Price IDs to frontend
      })),
      userSubscription: {
        hasActiveSubscription,
        currentTier: user?.subscriptionTier || null,
        status: user?.subscriptionStatus || null,
      },
    });
  } catch (error) {
    logger.error('[Recharge API] Error fetching pricing:', error);
    res.status(500).json({
      message: 'Failed to fetch pricing information',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/create-checkout-session
 * 创建 Stripe Checkout Session
 * Body: { tierId: string }
 */
router.post('/create-checkout-session', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const { tierId } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!tierId) {
      return res.status(400).json({
        message: 'Missing required parameter: tierId',
      });
    }

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe payment service is not configured',
      });
    }

    // 验证价格套餐是否存在
    const pricingTier = stripeService.getPricingTierById(tierId);
    if (!pricingTier) {
      return res.status(400).json({
        message: `Invalid pricing tier: ${tierId}`,
      });
    }

    // 构建成功和取消的跳转地址
    const baseUrl = process.env.DOMAIN_CLIENT || 'http://localhost:3080';
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}&type=topup`;
    const cancelUrl = `${baseUrl}/recharge/cancel`;

    // 创建 Checkout Session
    const session = await stripeService.createCheckoutSession({
      userId,
      userEmail,
      tierId,
      successUrl,
      cancelUrl,
    });

    logger.info(`[Recharge API] Created checkout session for user ${userId}:`, session.id);

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('[Recharge API] Error creating checkout session:', error);
    res.status(500).json({
      message: 'Failed to create checkout session',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/create-subscription
 * Create Stripe Subscription Checkout Session
 * Body: { tierId: string }
 */
router.post('/create-subscription', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const { tierId } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!tierId) {
      return res.status(400).json({
        message: 'Missing required parameter: tierId',
      });
    }

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe payment service is not configured',
      });
    }

    // Check if user already has an active subscription
    const user = await User.findById(userId);
    if (user.subscriptionStatus === 'active') {
      return res.status(400).json({
        message: 'You already have an active subscription. Please cancel or upgrade instead.',
      });
    }

    // Verify tier exists
    const pricingTier = stripeService.getPricingTierById(tierId);
    if (!pricingTier) {
      return res.status(400).json({
        message: `Invalid pricing tier: ${tierId}`,
      });
    }

    // Build redirect URLs
    const baseUrl = process.env.DOMAIN_CLIENT || 'http://localhost:3080';
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`;
    const cancelUrl = `${baseUrl}/recharge/cancel`;

    // Create subscription checkout session
    const session = await stripeService.createSubscriptionCheckoutSession({
      userId,
      userEmail,
      tierId,
      successUrl,
      cancelUrl,
      stripeCustomerId: user.stripeCustomerId, // Pass existing customer ID if available
    });

    logger.info(
      `[Recharge API] Created subscription checkout session for user ${userId}:`,
      session.id,
    );

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('[Recharge API] Error creating subscription checkout session:', error);
    res.status(500).json({
      message: 'Failed to create subscription checkout session',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/create-topup
 * Create Stripe Topup Checkout Session (subscription users only)
 * Body: { tierId: string }
 */
router.post('/create-topup', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const { tierId } = req.body;
    const userId = req.user.id;

    if (!tierId) {
      return res.status(400).json({
        message: 'Missing required parameter: tierId',
      });
    }

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe payment service is not configured',
      });
    }

    // Check if user has active subscription
    const user = await User.findById(userId);
    if (user.subscriptionStatus !== 'active') {
      return res.status(403).json({
        message:
          'Topup purchases are only available to active subscribers. Please subscribe first.',
      });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        message: 'Stripe customer ID not found. Please contact support.',
      });
    }

    // Verify tier exists
    const pricingTier = stripeService.getPricingTierById(tierId);
    if (!pricingTier) {
      return res.status(400).json({
        message: `Invalid pricing tier: ${tierId}`,
      });
    }

    // Build redirect URLs
    const baseUrl = process.env.DOMAIN_CLIENT || 'http://localhost:3080';
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}&type=topup`;
    const cancelUrl = `${baseUrl}/recharge/cancel`;

    // Create topup checkout session
    const session = await stripeService.createTopupCheckoutSession({
      userId,
      stripeCustomerId: user.stripeCustomerId,
      tierId,
      successUrl,
      cancelUrl,
    });

    logger.info(`[Recharge API] Created topup checkout session for user ${userId}:`, session.id);

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('[Recharge API] Error creating topup checkout session:', error);
    res.status(500).json({
      message: 'Failed to create topup checkout session',
      error: error.message,
    });
  }
});

/**
 * GET /api/recharge/subscription-status
 * Get current user's subscription status
 */
router.get('/subscription-status', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      'subscriptionStatus subscriptionTier subscriptionId currentPeriodEnd cancelAtPeriodEnd',
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    // Get balance info
    const balance = await Balance.findOne({ user: userId }).lean();

    res.json({
      subscriptionStatus: user.subscriptionStatus || null,
      subscriptionTier: user.subscriptionTier || null,
      subscriptionId: user.subscriptionId || null,
      currentPeriodEnd: user.currentPeriodEnd || null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
      subscriptionBalance: balance?.subscriptionBalance || 0,
      topupBalance: balance?.topupBalance || 0,
      totalBalance: (balance?.subscriptionBalance || 0) + (balance?.topupBalance || 0),
    });
  } catch (error) {
    logger.error('[Recharge API] Error fetching subscription status:', error);
    res.status(500).json({
      message: 'Failed to fetch subscription status',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/cancel-subscription
 * Cancel subscription at period end
 */
router.post('/cancel-subscription', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || !user.subscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found',
      });
    }

    if (user.subscriptionStatus !== 'active') {
      return res.status(400).json({
        message: 'Subscription is not active',
      });
    }

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe service is not configured',
      });
    }

    // Cancel subscription at period end
    const subscription = await stripeService.cancelSubscriptionAtPeriodEnd(user.subscriptionId);

    // Update user record
    await User.findByIdAndUpdate(userId, {
      cancelAtPeriodEnd: true,
    });

    logger.info(
      `[Recharge API] User ${userId} canceled subscription ${user.subscriptionId} at period end`,
    );

    res.json({
      message: 'Subscription will be canceled at the end of the current billing period',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
  } catch (error) {
    logger.error('[Recharge API] Error canceling subscription:', error);
    res.status(500).json({
      message: 'Failed to cancel subscription',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/resume-subscription
 * Resume a subscription that was scheduled for cancellation
 */
router.post('/resume-subscription', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || !user.subscriptionId) {
      return res.status(400).json({
        message: 'No subscription found',
      });
    }

    if (!user.cancelAtPeriodEnd) {
      return res.status(400).json({
        message: 'Subscription is not scheduled for cancellation',
      });
    }

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe service is not configured',
      });
    }

    // Resume subscription
    await stripeService.resumeSubscription(user.subscriptionId);

    // Update user record
    await User.findByIdAndUpdate(userId, {
      cancelAtPeriodEnd: false,
    });

    logger.info(`[Recharge API] User ${userId} resumed subscription ${user.subscriptionId}`);

    res.json({
      message: 'Subscription has been resumed',
    });
  } catch (error) {
    logger.error('[Recharge API] Error resuming subscription:', error);
    res.status(500).json({
      message: 'Failed to resume subscription',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/change-subscription-tier
 * Upgrade or downgrade subscription tier
 * Body: { newTierId: string }
 */
router.post('/change-subscription-tier', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const { newTierId } = req.body;
    const userId = req.user.id;

    if (!newTierId) {
      return res.status(400).json({
        message: 'Missing required parameter: newTierId',
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.subscriptionId) {
      return res.status(400).json({
        message: 'No active subscription found',
      });
    }

    if (user.subscriptionStatus !== 'active') {
      return res.status(400).json({
        message: 'Subscription is not active',
      });
    }

    if (user.subscriptionTier === newTierId) {
      return res.status(400).json({
        message: 'You are already subscribed to this tier',
      });
    }

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe service is not configured',
      });
    }

    // Verify new tier exists
    const newTier = stripeService.getPricingTierById(newTierId);
    if (!newTier) {
      return res.status(400).json({
        message: `Invalid pricing tier: ${newTierId}`,
      });
    }

    // Update subscription tier in Stripe
    const subscription = await stripeService.updateSubscriptionTier(user.subscriptionId, newTierId);

    // Update user record
    await User.findByIdAndUpdate(userId, {
      subscriptionTier: newTierId,
    });

    logger.info(`[Recharge API] User ${userId} changed subscription tier to ${newTierId}`);

    res.json({
      message: 'Subscription tier updated successfully',
      newTier: newTierId,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
  } catch (error) {
    logger.error('[Recharge API] Error changing subscription tier:', error);
    res.status(500).json({
      message: 'Failed to change subscription tier',
      error: error.message,
    });
  }
});

/**
 * POST /api/recharge/webhook
 * Stripe Webhook 端点
 * 处理支付成功事件
 */
router.post(
  '/webhook',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
      const stripeService = getStripeService();

      if (!stripeService.isEnabled()) {
        logger.error('[Recharge Webhook] Stripe service is not enabled');
        return res.status(503).send('Stripe service not configured');
      }

      // Verify webhook signature
      const event = stripeService.verifyWebhookSignature(req.body, signature);

      logger.info(`[Recharge Webhook] Received event: ${event.type}`);

      // Use webhook handler to process event
      const webhookHandler = new SubscriptionWebhookHandler();
      const result = await webhookHandler.handleEvent(event);

      res.json(result);
    } catch (error) {
      logger.error('[Recharge Webhook] Error processing webhook:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  },
);

/**
 * GET /api/recharge/history
 * 获取用户的充值记录
 */
router.get('/history', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // 从数据库获取交易记录
    const transactions = await Transaction.find({
      user: userId,
      tokenType: 'credits',
      context: 'stripe_recharge',
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      history: transactions.map((tx) => ({
        id: tx._id,
        credits: tx.rawAmount,
        amount: tx.metadata?.amountPaid || 0,
        currency: tx.metadata?.currency || 'usd',
        tierId: tx.metadata?.tierId,
        sessionId: tx.metadata?.sessionId,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    logger.error('[Recharge API] Error fetching recharge history:', error);
    res.status(500).json({
      message: 'Failed to fetch recharge history',
      error: error.message,
    });
  }
});

/**
 * GET /api/recharge/verify-session/:sessionId
 * 验证支付会话状态（用户支付成功后前端调用）
 */
router.get('/verify-session/:sessionId', requireJwtAuth, checkBan, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const stripeService = getStripeService();

    if (!stripeService.isEnabled()) {
      return res.status(503).json({
        message: 'Stripe payment service is not configured',
      });
    }

    // 从 Stripe 获取会话信息
    const session = await stripeService.stripe.checkout.sessions.retrieve(sessionId);

    // 验证会话是否属于当前用户
    if (session.metadata?.userId !== userId) {
      return res.status(403).json({
        message: 'Session does not belong to current user',
      });
    }

    // 检查支付状态
    const isPaid = session.payment_status === 'paid';
    const tierId = session.metadata?.tierId;
    const tier = tierId ? stripeService.getPricingTierById(tierId) : null;
    const credits = tier?.credits ?? 0;

    res.json({
      sessionId,
      paymentStatus: session.payment_status,
      isPaid,
      credits,
      tierId,
      amountTotal: session.amount_total,
    });
  } catch (error) {
    logger.error('[Recharge API] Error verifying session:', error);
    res.status(500).json({
      message: 'Failed to verify payment session',
      error: error.message,
    });
  }
});

module.exports = router;
