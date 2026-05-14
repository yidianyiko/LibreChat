jest.mock(
  '@librechat/api',
  () => {
    const express = require('express');

    return {
      requireAdmin: jest.fn((req, _res, next) => {
        req.adminChecked = true;
        next();
      }),
      createAdminConversationsRouter: jest.fn(({ Conversation, Message }) => {
        const router = express.Router();

        router.get('/probe', (req, res) =>
          res.json({
            jwtChecked: req.jwtChecked,
            adminChecked: req.adminChecked,
            receivedConversationModel: Conversation.modelName,
            receivedMessageModel: Message.modelName,
          }),
        );

        return router;
      }),
    };
  },
  { virtual: true },
);

jest.mock('~/db/models', () => ({
  Conversation: {
    modelName: 'Conversation',
  },
  Message: {
    modelName: 'Message',
  },
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: jest.fn((req, _res, next) => {
    req.jwtChecked = true;
    next();
  }),
}));

const request = require('supertest');
const express = require('express');
const { requireAdmin } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');
const conversationsRouter = require('../conversations');

describe('admin conversations legacy wrapper', () => {
  it('wraps the package router with JWT/admin middleware and model dependencies', async () => {
    const app = express();
    app.use('/api/admin/conversations', conversationsRouter);

    const response = await request(app).get('/api/admin/conversations/probe').expect(200);

    expect(response.body).toEqual({
      jwtChecked: true,
      adminChecked: true,
      receivedConversationModel: 'Conversation',
      receivedMessageModel: 'Message',
    });
    expect(requireJwtAuth).toHaveBeenCalled();
    expect(requireAdmin).toHaveBeenCalled();
  });
});
