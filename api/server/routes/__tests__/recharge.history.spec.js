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
    find: jest.fn(),
  },
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
  checkBan: (_req, _res, next) => next(),
  webhookLimiter: (_req, _res, next) => next(),
}));

const { Transaction } = require('~/db/models');
const rechargeRouter = require('../recharge');

function buildQueryChain(result) {
  return {
    sort: () => ({
      limit: () => ({
        lean: async () => result,
      }),
    }),
  };
}

describe('GET /api/recharge/history', () => {
  it('returns stripe recharge transactions using schema-correct fields', async () => {
    const txDocs = [
      {
        _id: 'tx1',
        user: 'test-user-id',
        tokenType: 'credits',
        context: 'stripe_recharge',
        rawAmount: 5000000,
        metadata: { amountPaid: 499, currency: 'usd', tierId: 'explorer', sessionId: 'cs_1' },
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
      },
    ];

    Transaction.find.mockReturnValue(buildQueryChain(txDocs));

    const app = express();
    app.use(express.json());
    app.use('/api/recharge', rechargeRouter);

    const res = await request(app).get('/api/recharge/history?limit=1').expect(200);

    expect(Transaction.find).toHaveBeenCalledWith({
      user: 'test-user-id',
      tokenType: 'credits',
      context: 'stripe_recharge',
    });

    expect(res.body).toEqual({
      history: [
        {
          id: 'tx1',
          credits: 5000000,
          amount: 499,
          currency: 'usd',
          tierId: 'explorer',
          sessionId: 'cs_1',
          createdAt: txDocs[0].createdAt.toISOString(),
        },
      ],
    });
  });
});
