jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

const Stripe = require('stripe');
const { StripeService } = require('./StripeService');

describe('StripeService.createCheckoutSession', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, STRIPE_SECRET_KEY: 'sk_test_123' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('creates a one-time payment checkout session (no recurring, mode=payment)', async () => {
    const service = new StripeService();

    // For mocked constructors, `mock.instances` is the `this` value, while
    // `mock.results[i].value` is the object returned by our mockImplementation.
    const stripeInstance = Stripe.mock.results[0].value;
    stripeInstance.checkout.sessions.create.mockResolvedValue({ id: 'cs_test_1' });

    await service.createCheckoutSession({
      userId: 'user_1',
      userEmail: 'user@example.com',
      tierId: 'explorer',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    const callArg = stripeInstance.checkout.sessions.create.mock.calls[0][0];
    expect(callArg.mode).toBe('payment');
    expect(callArg.line_items[0].price_data.recurring).toBeUndefined();
  });
});
