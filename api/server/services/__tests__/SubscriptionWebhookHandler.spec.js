const { SubscriptionWebhookHandler } = require('../SubscriptionWebhookHandler');

// Mock dependencies
jest.mock('~/db/models', () => ({
  User: {
    findByIdAndUpdate: jest.fn(),
  },
  Balance: {},
  Transaction: {
    findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
  },
}));

jest.mock('~/models/Transaction', () => ({
  createTransaction: jest.fn(),
}));

jest.mock('~/models/balanceMethods', () => ({
  resetSubscriptionBalance: jest.fn(),
  updateDualBalance: jest.fn(),
}));

jest.mock('../StripeService', () => ({
  getStripeService: jest.fn(() => ({
    enabled: true,
    stripe: {
      subscriptions: {
        retrieve: jest.fn(),
      },
    },
    getPricingTierById: jest.fn((tierId) => {
      const tiers = {
        explorer: { id: 'explorer', credits: 5000000 },
        artisan: { id: 'artisan', credits: 15000000 },
        elite: { id: 'elite', credits: 35000000 },
      };
      return tiers[tierId] || null;
    }),
  })),
}));

const { User } = require('~/db/models');
const { createTransaction } = require('~/models/Transaction');
const { resetSubscriptionBalance, updateDualBalance } = require('~/models/balanceMethods');

describe('SubscriptionWebhookHandler', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new SubscriptionWebhookHandler();
  });

  describe('handleSubscriptionCreated', () => {
    it('should update user with subscription details', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        metadata: { userId: 'user123', tierId: 'explorer' },
        created: 1234567890,
        current_period_start: 1234567890,
        current_period_end: 1237159890,
        cancel_at_period_end: false,
      };

      User.findByIdAndUpdate.mockResolvedValue({});

      await handler.handleSubscriptionCreated(subscription);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        subscriptionId: 'sub_123',
        subscriptionStatus: 'active',
        subscriptionTier: 'explorer',
        subscriptionStartDate: new Date(1234567890000),
        currentPeriodStart: new Date(1234567890000),
        currentPeriodEnd: new Date(1237159890000),
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_123',
      });
    });

    it('should throw if userId or tierId missing', async () => {
      const subscription = {
        id: 'sub_123',
        metadata: {},
      };

      await expect(handler.handleSubscriptionCreated(subscription)).rejects.toThrow(
        'Missing userId or tierId',
      );
    });
  });

  describe('handleInvoicePaymentSucceeded', () => {
    it('should grant subscription credits', async () => {
      const invoice = {
        subscription: 'sub_123',
        id: 'in_123',
        amount_paid: 499,
        currency: 'usd',
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

      await handler.handleInvoicePaymentSucceeded(invoice);

      expect(resetSubscriptionBalance).toHaveBeenCalledWith({
        user: 'user123',
        newSubscriptionBalance: 5000000, // Explorer tier credits
      });

      expect(createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user123',
          context: 'subscription_charge',
          balanceType: 'subscription',
        }),
      );
    });

    it('should skip non-subscription invoices', async () => {
      const invoice = { id: 'in_123' }; // No subscription field

      const result = await handler.handleInvoicePaymentSucceeded(invoice);

      expect(result.message).toBe('Not a subscription invoice');
      expect(resetSubscriptionBalance).not.toHaveBeenCalled();
    });
  });

  describe('grantTopupCredits', () => {
    it('should add credits to topup balance', async () => {
      updateDualBalance.mockResolvedValue({});
      createTransaction.mockResolvedValue({});

      await handler.grantTopupCredits('user123', 'artisan', 'cs_123', 1499);

      expect(updateDualBalance).toHaveBeenCalledWith({
        user: 'user123',
        incrementValue: 15000000, // Artisan tier credits
        balanceType: 'topup',
      });

      expect(createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'subscription_topup',
          balanceType: 'topup',
        }),
      );
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('should clear subscription fields on user', async () => {
      const subscription = {
        metadata: { userId: 'user123' },
      };

      User.findByIdAndUpdate.mockResolvedValue({});

      await handler.handleSubscriptionDeleted(subscription);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        subscriptionStatus: 'canceled',
        subscriptionId: null,
        subscriptionTier: null,
        cancelAtPeriodEnd: false,
      });
    });
  });

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
});
