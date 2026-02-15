const Stripe = require('stripe');
const { logger } = require('~/config');

// Stripe 一次性充值价格配置
// 充值套餐：Explorer / Artisan / Elite
// credits 字段定义每个套餐对应的单次充值积分
const PRICING_TIERS = [
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'The Minimalist Alternative - 150 Premium GPT-4o msgs, 2,000 Base 4o-mini msgs',
    price: 499, // $4.99 (单位：美分)
    credits: 5000000, // 500万积分
  },
  {
    id: 'artisan',
    name: 'Artisan',
    description: 'The Creator\'s Safe Haven - 700 Premium GPT-4o msgs, 15,000 Base 4o-mini msgs',
    price: 1499, // $14.99
    credits: 15000000, // 1500万积分
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'The Power Productivity Hub - 2,000 Premium GPT-4o msgs, Unlimited Base 4o-mini msgs',
    price: 3499, // $34.99
    credits: 35000000, // 3500万积分
  },
];

class StripeService {
  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      logger.warn('[StripeService] STRIPE_SECRET_KEY not configured - Stripe features disabled');
      this.stripe = null;
      this.enabled = false;
      return;
    }

    try {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });
      this.enabled = true;
      logger.info('[StripeService] Initialized successfully');
    } catch (error) {
      logger.error('[StripeService] Initialization failed:', error);
      this.stripe = null;
      this.enabled = false;
    }
  }

  /**
   * 检查 Stripe 是否已启用
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * 获取所有价格套餐
   */
  getPricingTiers() {
    return PRICING_TIERS;
  }

  /**
   * 根据 ID 获取价格套餐
   */
  getPricingTierById(tierId) {
    return PRICING_TIERS.find(tier => tier.id === tierId);
  }

  /**
   * 创建 Stripe Checkout Session
   * @param {string} userId - 用户 ID
   * @param {string} userEmail - 用户邮箱
   * @param {string} tierId - 价格套餐 ID
   * @param {string} successUrl - 支付成功后的跳转地址
   * @param {string} cancelUrl - 支付取消后的跳转地址
   */
  async createCheckoutSession({ userId, userEmail, tierId, successUrl, cancelUrl }) {
    if (!this.enabled) {
      throw new Error('Stripe service is not enabled');
    }

    const pricingTier = this.getPricingTierById(tierId);
    if (!pricingTier) {
      throw new Error(`Invalid pricing tier: ${tierId}`);
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card', 'alipay', 'wechat_pay'],
        payment_method_options: {
          wechat_pay: {
            client: 'web',
          },
        },
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pricingTier.name,
                description: pricingTier.description,
              },
              unit_amount: pricingTier.price,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: userEmail,
        client_reference_id: userId,
        metadata: {
          userId: userId,
          tierId: tierId,
        },
      });

      logger.info(`[StripeService] Created checkout session for user ${userId}, tier ${tierId}`);
      return session;
    } catch (error) {
      logger.error('[StripeService] Failed to create checkout session:', error);
      throw error;
    }
  }

  /**
   * 验证 Webhook 签名
   * @param {string} payload - 请求体原始字符串
   * @param {string} signature - Stripe-Signature 请求头
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.enabled) {
      throw new Error('Stripe service is not enabled');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return event;
    } catch (error) {
      logger.error('[StripeService] Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * 处理支付成功事件
   * @param {object} session - Stripe Checkout Session 对象
   * @returns {object} 包含验证后的支付信息和计算的积分
   * @throws {Error} 如果验证失败
   */
  async handlePaymentSuccess(session) {
    const { userId, tierId } = session.metadata || {};

    // 1. 验证必要的 metadata 字段
    if (!userId || !tierId) {
      logger.error('[StripeService] Missing required metadata in session:', {
        sessionId: session.id,
        hasUserId: !!userId,
        hasTierId: !!tierId,
      });
      throw new Error('Invalid session metadata: missing userId or tierId');
    }

    // 2. 验证 tierId 是否存在于定价配置中
    const pricingTier = this.getPricingTierById(tierId);
    if (!pricingTier) {
      logger.error('[StripeService] Invalid tierId in session metadata:', {
        sessionId: session.id,
        tierId,
        validTierIds: PRICING_TIERS.map(t => t.id),
      });
      throw new Error(`Invalid pricing tier: ${tierId}`);
    }

    // 3. 验证支付状态
    if (session.payment_status !== 'paid') {
      logger.warn('[StripeService] Session payment not completed:', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
      throw new Error(`Payment not completed: status is ${session.payment_status}`);
    }

    // 5. 验证支付金额是否匹配定价（防止价格篡改）
    const expectedAmount = pricingTier.price;
    // 注意：对于订阅，amount_total 可能包含税费等，我们检查是否 >= 预期价格
    if (session.amount_total < expectedAmount) {
      logger.error('[StripeService] Amount mismatch:', {
        sessionId: session.id,
        expected: expectedAmount,
        actual: session.amount_total,
      });
      throw new Error('Payment amount does not match expected price');
    }

    // 6. 从服务端配置计算积分（不信任 metadata 中的 credits）
    const credits = pricingTier.credits;

    logger.info(`[StripeService] Payment validated successfully:`, {
      sessionId: session.id,
      userId,
      tierId,
      credits,
      amountTotal: session.amount_total,
    });

    return {
      userId,
      tierId,
      credits,  // 服务端计算的积分
      sessionId: session.id,
      subscriptionId: session.subscription,
      amountTotal: session.amount_total,
      customerEmail: session.customer_email,
    };
  }

  /**
   * 获取支付记录（从 Stripe）
   * @param {string} userId - 用户 ID
   * @param {number} limit - 返回记录数量
   */
  async getPaymentHistory(userId, limit = 10) {
    if (!this.enabled) {
      throw new Error('Stripe service is not enabled');
    }

    try {
      // 查找用户的所有成功的 checkout sessions
      const sessions = await this.stripe.checkout.sessions.list({
        limit: limit,
      });

      // 过滤出属于该用户的记录
      const userSessions = sessions.data.filter(
        session => session.metadata?.userId === userId && session.status === 'complete'
      );

      return userSessions.map(session => ({
        sessionId: session.id,
        tierId: session.metadata.tierId,
        subscriptionId: session.subscription,
        amount: session.amount_total,
        currency: session.currency,
        status: session.status,
        createdAt: new Date(session.created * 1000),
      }));
    } catch (error) {
      logger.error('[StripeService] Failed to get payment history:', error);
      throw error;
    }
  }
}

// 单例模式
let stripeServiceInstance = null;

function getStripeService() {
  if (!stripeServiceInstance) {
    stripeServiceInstance = new StripeService();
  }
  return stripeServiceInstance;
}

module.exports = {
  StripeService,
  getStripeService,
  PRICING_TIERS,
};
