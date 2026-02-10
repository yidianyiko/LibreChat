const request = require('supertest');
const express = require('express');

jest.mock('~/server/services/StripeService', () => ({
  getStripeService: jest.fn(),
}));

jest.mock('~/models/Transaction', () => ({
  createTransaction: jest.fn(),
}));

jest.mock('~/db/models', () => ({
  Transaction: {
    collection: {
      createIndex: jest.fn().mockResolvedValue('uniq_stripe_recharge_session'),
    },
  },
}));

jest.mock('~/server/middleware', () => ({
  webhookLimiter: (_req, _res, next) => next(),
  requireJwtAuth: (_req, _res, next) => next(),
  checkBan: (_req, _res, next) => next(),
}));

const { getStripeService } = require('~/server/services/StripeService');
const { createTransaction } = require('~/models/Transaction');

const rechargeRouter = require('../recharge');

function buildApp() {
  const app = express();
  // Mimic server behavior: do not JSON-parse webhook body; route uses express.raw()
  app.use((req, res, next) => {
    if (req.path === '/api/recharge/webhook') {
      return next();
    }
    return express.json()(req, res, next);
  });
  app.use('/api/recharge', rechargeRouter);
  return app;
}

describe('POST /api/recharge/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 and "Already processed" when createTransaction hits duplicate key (idempotent)', async () => {
    const mockStripeService = {
      isEnabled: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn().mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: { userId: 'u1', tierId: 'explorer' },
            payment_status: 'paid',
            amount_total: 499,
            customer_email: 't@example.com',
          },
        },
      }),
      handlePaymentSuccess: jest.fn().mockResolvedValue({
        userId: 'u1',
        tierId: 'explorer',
        credits: 5000000,
        sessionId: 'cs_test_123',
        amountTotal: 499,
      }),
    };

    getStripeService.mockReturnValue(mockStripeService);

    const dup = new Error('E11000 duplicate key error');
    dup.code = 11000;
    createTransaction.mockRejectedValueOnce(dup);

    const payload = Buffer.from(JSON.stringify({ any: 'thing' }));
    const res = await request(buildApp())
      .post('/api/recharge/webhook')
      .set('stripe-signature', 'sig')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    expect(res.body).toEqual(expect.objectContaining({ received: true }));
    expect(res.body.message).toBe('Already processed');
  });
});

