const express = require('express');
const request = require('supertest');

jest.mock('~/server/controllers/ModelController', () => ({
  modelController: jest.fn((req, res) => res.status(200).json({ openAI: ['gpt-4o'] })),
  modelRatesController: jest.fn((req, res) => res.status(200).json({ openAI: {} })),
}));

jest.mock('~/server/middleware/', () => ({
  optionalJwtAuth: (req, res, next) => next(),
  requireJwtAuth: () => {
    throw new Error('requireJwtAuth should not be used for models route');
  },
}));

describe('Models Routes (guest access)', () => {
  let app;

  beforeAll(() => {
    const modelsRouter = require('../models');
    app = express();
    app.use('/api/models', modelsRouter);
  });

  it('allows unauthenticated access', async () => {
    const response = await request(app).get('/api/models');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ openAI: ['gpt-4o'] });
  });
});
