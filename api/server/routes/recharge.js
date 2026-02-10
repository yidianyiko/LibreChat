const express = require('express');
const { requireJwtAuth, checkBan, webhookLimiter } = require('~/server/middleware');
const { getStripeService } = require('~/server/services/StripeService');
const { logger } = require('~/config');
const { createTransaction } = require('~/models/Transaction');
const { Transaction } = require('~/db/models');

const router = express.Router();

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

    res.json({
      enabled: true,
      tiers: pricingTiers,
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
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}`;
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

      // 验证 webhook 签名
      const event = stripeService.verifyWebhookSignature(req.body, signature);

      logger.info(`[Recharge Webhook] Received event: ${event.type}`);

      // 处理 checkout.session.completed 事件
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // 数据库级别幂等性检查 - 检查是否已处理过此 session
        const existingTransaction = await Transaction.findOne({
          'metadata.sessionId': session.id,
          context: 'stripe_recharge',
        }).lean();

        if (existingTransaction) {
          logger.warn(`[Recharge Webhook] Session ${session.id} already processed, skipping`);
          return res.json({ received: true, message: 'Already processed' });
        }

        // 提取并验证支付信息（服务端计算 credits）
        const paymentInfo = await stripeService.handlePaymentSuccess(session);
        const { userId, credits, sessionId, amountTotal, tierId } = paymentInfo;

        if (!credits || credits <= 0) {
          logger.error(`[Recharge Webhook] Invalid credits value: ${credits}`);
          return res.status(400).json({ received: false, error: 'Invalid credits value' });
        }

        logger.info(
          `[Recharge Webhook] Processing payment for user ${userId}: ${credits} credits (tier: ${tierId})`,
        );

        // 使用 createTransaction 添加额度并记录交易（会自动更新余额）
        const result = await createTransaction({
          user: userId,
          tokenType: 'credits',
          context: 'stripe_recharge',
          rawAmount: credits,
          balance: { enabled: true },
          metadata: {
            sessionId,
            amountPaid: amountTotal,
            currency: 'usd',
            tierId: tierId,
          },
        });

        if (!result?.balance) {
          logger.error(`[Recharge Webhook] Failed to update balance for user ${userId}`);
          return res.status(500).json({ received: false, error: 'Failed to update balance' });
        }

        logger.info(
          `[Recharge Webhook] Successfully added ${credits} credits to user ${userId}, new balance: ${result.balance}`,
        );
      }

      res.json({ received: true });
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
      action: 'recharge',
      context: 'stripe_recharge',
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      history: transactions.map((tx) => ({
        id: tx._id,
        credits: tx.tokenCredits,
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
    const credits = parseInt(session.metadata?.credits || '0', 10);

    res.json({
      sessionId,
      paymentStatus: session.payment_status,
      isPaid,
      credits,
      tierId: session.metadata?.tierId,
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
