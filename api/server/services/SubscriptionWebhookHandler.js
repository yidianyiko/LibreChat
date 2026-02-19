const { logger } = require('~/config');
const { getStripeService } = require('./StripeService');
const { User } = require('~/db/models');
const { createTransaction } = require('~/models/Transaction');
const { updateDualBalance, resetSubscriptionBalance } = require('~/models/balanceMethods');

/**
 * Safely convert a Unix timestamp to a Date object.
 * Returns undefined (rather than Invalid Date) if the value is missing or NaN.
 * @param {number|null|undefined} unixTs
 * @returns {Date|undefined}
 */
function toSafeDate(unixTs) {
  if (!unixTs && unixTs !== 0) return undefined;
  const d = new Date(unixTs * 1000);
  return isNaN(d.getTime()) ? undefined : d;
}

class SubscriptionWebhookHandler {
  constructor() {
    this.stripeService = getStripeService();
  }

  /**
   * Main webhook event router
   * @param {Object} event - Stripe webhook event
   */
  async handleEvent(event) {
    logger.info(`[SubscriptionWebhook] Processing event: ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(event.data.object);

        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(event.data.object);

        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(event.data.object);

        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event.data.object);

        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event.data.object);

        case 'checkout.session.completed':
          return await this.handleCheckoutSessionCompleted(event.data.object);

        default:
          logger.info(`[SubscriptionWebhook] Unhandled event type: ${event.type}`);
          return { received: true, message: 'Event type not handled' };
      }
    } catch (error) {
      logger.error(`[SubscriptionWebhook] Error handling ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle checkout.session.completed
   * This fires for both subscription and one-time topup purchases
   */
  async handleCheckoutSessionCompleted(session) {
    const userId = session.metadata?.userId || session.client_reference_id;
    const tierId = session.metadata?.tierId;
    const isTopup = session.metadata?.type === 'topup';

    if (!userId || !tierId) {
      throw new Error('Missing userId or tierId in session metadata');
    }

    // Update user with Stripe customer ID if not already set
    if (session.customer) {
      await User.findByIdAndUpdate(userId, {
        stripeCustomerId: session.customer,
      });
    }

    // For subscriptions, the actual credit granting happens in invoice.payment_succeeded
    // For topups, grant credits immediately
    if (isTopup && session.payment_status === 'paid') {
      return await this.grantTopupCredits(userId, tierId, session.id, session.amount_total);
    }

    return { received: true, message: 'Checkout session processed' };
  }

  /**
   * Handle customer.subscription.created
   */
  async handleSubscriptionCreated(subscription) {
    const userId = subscription.metadata?.userId;
    const tierId = subscription.metadata?.tierId;

    if (!userId || !tierId) {
      throw new Error('Missing userId or tierId in subscription metadata');
    }

    await User.findByIdAndUpdate(userId, {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionTier: tierId,
      subscriptionStartDate: toSafeDate(subscription.created),
      currentPeriodStart: toSafeDate(subscription.current_period_start),
      currentPeriodEnd: toSafeDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: subscription.customer,
    });

    logger.info(`[SubscriptionWebhook] Subscription created for user ${userId}, tier ${tierId}`);
    return { received: true, message: 'Subscription created' };
  }

  /**
   * Handle customer.subscription.updated
   */
  async handleSubscriptionUpdated(subscription) {
    const userId = subscription.metadata?.userId;
    const tierId = subscription.metadata?.tierId;

    if (!userId) {
      throw new Error('Missing userId in subscription metadata');
    }

    const updateData = {
      subscriptionStatus: subscription.status,
      currentPeriodStart: toSafeDate(subscription.current_period_start),
      currentPeriodEnd: toSafeDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    // If tier changed (upgrade/downgrade), update tier
    if (tierId) {
      updateData.subscriptionTier = tierId;
    }

    await User.findByIdAndUpdate(userId, updateData);

    logger.info(`[SubscriptionWebhook] Subscription updated for user ${userId}`);
    return { received: true, message: 'Subscription updated' };
  }

  /**
   * Handle customer.subscription.deleted
   */
  async handleSubscriptionDeleted(subscription) {
    const userId = subscription.metadata?.userId;

    if (!userId) {
      throw new Error('Missing userId in subscription metadata');
    }

    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: 'canceled',
      subscriptionId: null,
      subscriptionTier: null,
      cancelAtPeriodEnd: false,
    });

    logger.info(`[SubscriptionWebhook] Subscription deleted for user ${userId}`);
    return { received: true, message: 'Subscription deleted' };
  }

  /**
   * Handle invoice.payment_succeeded
   * This is where we grant monthly subscription credits
   */
  async handleInvoicePaymentSucceeded(invoice) {
    // Skip if not a subscription invoice
    if (!invoice.subscription) {
      logger.info(
        `[SubscriptionWebhook] invoice.payment_succeeded skipped - no subscription linked (invoiceId: ${invoice.id}, billing_reason: ${invoice.billing_reason})`,
      );
      return { received: true, message: 'Not a subscription invoice' };
    }

    const subscription = await this.stripeService.stripe.subscriptions.retrieve(
      invoice.subscription,
    );
    const userId = subscription.metadata?.userId;
    const tierId = subscription.metadata?.tierId;

    if (!userId || !tierId) {
      throw new Error('Missing userId or tierId in subscription metadata');
    }

    // Get tier credits
    const pricingTier = this.stripeService.getPricingTierById(tierId);
    if (!pricingTier) {
      throw new Error(`Invalid pricing tier: ${tierId}`);
    }

    // Reset subscription balance to monthly allowance
    await resetSubscriptionBalance({
      user: userId,
      newSubscriptionBalance: pricingTier.credits,
    });

    // Record transaction
    await createTransaction({
      user: userId,
      tokenType: 'credits',
      context: 'subscription_charge',
      rawAmount: pricingTier.credits,
      balanceType: 'subscription',
      balance: { enabled: false }, // We already updated balance manually
      metadata: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        tierId: tierId,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        periodStart: toSafeDate(subscription.current_period_start),
        periodEnd: toSafeDate(subscription.current_period_end),
      },
    });

    logger.info(
      `[SubscriptionWebhook] Granted ${pricingTier.credits} subscription credits to user ${userId}`,
    );
    return { received: true, message: 'Subscription credits granted' };
  }

  /**
   * Handle invoice.payment_failed
   */
  async handleInvoicePaymentFailed(invoice) {
    if (!invoice.subscription) {
      return { received: true, message: 'Not a subscription invoice' };
    }

    const subscription = await this.stripeService.stripe.subscriptions.retrieve(
      invoice.subscription,
    );
    const userId = subscription.metadata?.userId;

    if (!userId) {
      throw new Error('Missing userId in subscription metadata');
    }

    // Update user status to past_due
    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: 'past_due',
    });

    logger.warn(
      `[SubscriptionWebhook] Payment failed for user ${userId}, subscription ${subscription.id}`,
    );
    return { received: true, message: 'Payment failure recorded' };
  }

  /**
   * Grant topup credits to user
   */
  async grantTopupCredits(userId, tierId, sessionId, amountPaid) {
    const pricingTier = this.stripeService.getPricingTierById(tierId);
    if (!pricingTier) {
      throw new Error(`Invalid pricing tier: ${tierId}`);
    }

    // Add to topup balance
    await updateDualBalance({
      user: userId,
      incrementValue: pricingTier.credits,
      balanceType: 'topup',
    });

    // Record transaction
    await createTransaction({
      user: userId,
      tokenType: 'credits',
      context: 'subscription_topup',
      rawAmount: pricingTier.credits,
      balanceType: 'topup',
      balance: { enabled: false }, // We already updated balance manually
      metadata: {
        sessionId,
        tierId,
        amountPaid,
        currency: 'usd',
      },
    });

    logger.info(
      `[SubscriptionWebhook] Granted ${pricingTier.credits} topup credits to user ${userId}`,
    );
    return { received: true, message: 'Topup credits granted' };
  }
}

module.exports = { SubscriptionWebhookHandler };
