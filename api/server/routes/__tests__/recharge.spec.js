const request = require('supertest');
const express = require('express');
const rechargeRouter = require('../recharge');
const { getStripeService } = require('~/server/services/StripeService');

jest.mock('~/server/services/StripeService');
jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
  checkBan: (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/recharge', rechargeRouter);

describe('Recharge API Routes', () => {
  let mockStripeService;

  beforeEach(() => {
    mockStripeService = {
      isEnabled: jest.fn().mockReturnValue(true),
      getPricingTiers: jest.fn().mockReturnValue([
        {
          id: 'tier_5',
          name: '$5 套餐',
          credits: 5000000,
          price: 500,
          discount: 0,
        },
      ]),
      createCheckoutSession: jest.fn().mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      }),
    };

    getStripeService.mockReturnValue(mockStripeService);
  });

  describe('GET /api/recharge/pricing', () => {
    it('should return pricing tiers when Stripe is enabled', async () => {
      const response = await request(app)
        .get('/api/recharge/pricing')
        .expect(200);

      expect(response.body).toEqual({
        enabled: true,
        tiers: expect.arrayContaining([
          expect.objectContaining({
            id: 'tier_5',
            credits: 5000000,
          }),
        ]),
      });
    });

    it('should return 503 when Stripe is not enabled', async () => {
      mockStripeService.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get('/api/recharge/pricing')
        .expect(503);

      expect(response.body.enabled).toBe(false);
    });
  });

  describe('POST /api/recharge/create-checkout-session', () => {
    it('should create checkout session successfully', async () => {
      mockStripeService.getPricingTierById = jest.fn().mockReturnValue({
        id: 'tier_5',
        credits: 5000000,
      });

      const response = await request(app)
        .post('/api/recharge/create-checkout-session')
        .send({ tierId: 'tier_5' })
        .expect(200);

      expect(response.body).toEqual({
        sessionId: 'cs_test_123',
        url: expect.stringContaining('checkout.stripe.com'),
      });

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          userEmail: 'test@example.com',
          tierId: 'tier_5',
        }),
      );
    });

    it('should return 400 when tierId is missing', async () => {
      const response = await request(app)
        .post('/api/recharge/create-checkout-session')
        .send({})
        .expect(400);

      expect(response.body.message).toContain('tierId');
    });

    it('should return 400 when tier is invalid', async () => {
      mockStripeService.getPricingTierById = jest.fn().mockReturnValue(null);

      const response = await request(app)
        .post('/api/recharge/create-checkout-session')
        .send({ tierId: 'invalid_tier' })
        .expect(400);

      expect(response.body.message).toContain('Invalid pricing tier');
    });
  });
});
