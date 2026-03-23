jest.mock('@librechat/api', () => ({
  requireAdmin: (req, res, next) => {
    if (req.headers.authorization === 'Bearer admin-token') {
      req.user = { id: 'admin-id', email: 'admin@test.com', role: 'ADMIN' };
      next();
    } else {
      res.status(403).json({ error: 'Admin privileges required' });
    }
  },
}));

jest.mock('~/db/models', () => ({
  User: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
  Message: {
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
  },
  Conversation: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

const request = require('supertest');
const express = require('express');
const statsRouter = require('../stats');
const { User, Message, Conversation } = require('~/db/models');

const app = express();
app.use(express.json());
app.use('/api/admin/stats', statsRouter);

describe('Admin Stats API Routes', () => {
  const getWindowDays = (query) => {
    const date = query?.createdAt?.$gte;
    if (!(date instanceof Date)) {
      return 0;
    }

    const now = Date.now();
    const diffMs = now - date.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/stats', () => {
    it('should return 403 when user is not admin', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .expect(403);

      expect(response.body.error).toBe('Admin privileges required');
    });

    it('should return statistics when user is admin', async () => {
      User.countDocuments.mockImplementation((query) => {
        const windowDays = getWindowDays(query);
        if (windowDays === 0) {
          return Promise.resolve(100);
        }

        if (windowDays <= 1) {
          return Promise.resolve(2);
        }

        if (windowDays <= 7) {
          return Promise.resolve(15);
        }

        if (windowDays <= 30) {
          return Promise.resolve(40);
        }

        return Promise.resolve(0);
      });

      User.aggregate.mockImplementation((pipeline) => {
        const groupStage = pipeline.find((stage) => stage.$group != null)?.$group;
        if (groupStage?._id?.date != null && groupStage?._id?.provider != null) {
          return Promise.resolve([
            {
              _id: '2026-02-10',
              providers: [
                { key: 'local', count: 3 },
                { key: 'google', count: 2 },
              ],
              total: 5,
            },
            {
              _id: '2026-02-11',
              providers: [{ key: 'local', count: 4 }],
              total: 4,
            },
          ]);
        }

        return Promise.resolve([
          { _id: 'local', count: 60 },
          { _id: 'google', count: 30 },
          { _id: 'github', count: 10 },
        ]);
      });

      Message.countDocuments.mockImplementation((query) => {
        const windowDays = getWindowDays(query);
        if (query?.isCreatedByUser === false && query?.error === true && windowDays <= 7) {
          return Promise.resolve(9);
        }

        if (query?.isCreatedByUser === false && query?.['feedback.rating'] === 'thumbsDown' && windowDays <= 7) {
          return Promise.resolve(3);
        }

        if (query?.isCreatedByUser === false && query?.feedback?.$exists === true && windowDays <= 7) {
          return Promise.resolve(12);
        }

        if (query?.isCreatedByUser === false && windowDays <= 7) {
          return Promise.resolve(90);
        }

        if (windowDays <= 1) {
          return Promise.resolve(25);
        }

        if (windowDays <= 7) {
          return Promise.resolve(120);
        }

        if (windowDays <= 30) {
          return Promise.resolve(420);
        }

        return Promise.resolve(0);
      });

      Message.distinct
        .mockImplementation((_field, query) => {
          const windowDays = getWindowDays(query);

          if (windowDays <= 1) {
            return Promise.resolve(['user1', 'user2', 'user3', 'user4']);
          }

          if (windowDays <= 7) {
            return Promise.resolve(['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8']);
          }

          if (windowDays <= 30) {
            return Promise.resolve(
              Array.from({ length: 20 }, (_, index) => `user${index + 1}`),
            );
          }

          return Promise.resolve([]);
        });

      Message.aggregate.mockImplementation((pipeline) => {
        const firstGroup = pipeline.find((stage) => stage.$group != null)?.$group;
        if (firstGroup?._id?.date != null && firstGroup?._id?.user != null) {
          return Promise.resolve([
            {
              _id: '2026-02-10',
              activeUsers: 5,
              messages: 32,
              errors: 2,
            },
            {
              _id: '2026-02-11',
              activeUsers: 6,
              messages: 28,
              errors: 1,
            },
          ]);
        }

        if (firstGroup?._id === '$endpoint') {
          return Promise.resolve([
            { _id: 'openAI', count: 70 },
            { _id: 'agents', count: 50 },
          ]);
        }

        if (firstGroup?._id === '$model') {
          return Promise.resolve([
            { _id: 'gpt-4o', count: 55 },
            { _id: 'claude-sonnet-4', count: 30 },
          ]);
        }

        return Promise.resolve([]);
      });

      Conversation.countDocuments.mockImplementation((query) => {
        const windowDays = getWindowDays(query);
        if (windowDays <= 1) {
          return Promise.resolve(6);
        }

        if (windowDays <= 7) {
          return Promise.resolve(32);
        }

        if (windowDays <= 30) {
          return Promise.resolve(110);
        }

        return Promise.resolve(0);
      });

      Conversation.aggregate.mockResolvedValue([
        { _id: '2026-02-10', conversations: 7 },
        { _id: '2026-02-11', conversations: 5 },
      ]);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        overview: {
          totalUsers: 100,
          newUsers: {
            last1Day: 2,
            last7Days: 15,
            last30Days: 40,
          },
          activeUsers: {
            last1Day: 4,
            last7Days: 8,
            last30Days: 20,
          },
          messages: {
            last1Day: 25,
            last7Days: 120,
            last30Days: 420,
          },
          conversations: {
            last1Day: 6,
            last7Days: 32,
            last30Days: 110,
          },
          activeRateLast7Days: 0.08,
          messagesPerActiveUserLast7Days: 15,
          errorRateLast7Days: 0.1,
          negativeFeedbackRateLast7Days: 0.25,
        },
        registration: {
          daily: [
            {
              date: '2026-02-10',
              total: 5,
              providers: [
                { key: 'local', count: 3 },
                { key: 'google', count: 2 },
              ],
            },
            {
              date: '2026-02-11',
              total: 4,
              providers: [{ key: 'local', count: 4 }],
            },
          ],
          byProvider: [
            { key: 'local', label: 'local', count: 60 },
            { key: 'google', label: 'google', count: 30 },
            { key: 'github', label: 'github', count: 10 },
          ],
        },
        usage: {
          daily: [
            {
              date: '2026-02-10',
              activeUsers: 5,
              messages: 32,
              conversations: 7,
              errors: 2,
            },
            {
              date: '2026-02-11',
              activeUsers: 6,
              messages: 28,
              conversations: 5,
              errors: 1,
            },
          ],
          byEndpoint: [
            { key: 'openAI', label: 'openAI', count: 70 },
            { key: 'agents', label: 'agents', count: 50 },
          ],
          byModel: [
            { key: 'gpt-4o', label: 'gpt-4o', count: 55 },
            { key: 'claude-sonnet-4', label: 'claude-sonnet-4', count: 30 },
          ],
        },
        quality: {
          errorsLast7Days: 9,
          assistantMessagesLast7Days: 90,
          feedbackCountLast7Days: 12,
          negativeFeedbackCountLast7Days: 3,
        },
      });
    });

    it('should use default days parameter (30) when not provided', async () => {
      User.countDocuments.mockResolvedValue(50);
      User.aggregate.mockResolvedValue([]);
      Conversation.countDocuments.mockResolvedValue(0);
      Conversation.aggregate.mockResolvedValue([]);
      Message.countDocuments.mockResolvedValue(0);
      Message.distinct.mockResolvedValue([]);
      Message.aggregate.mockResolvedValue([]);

      await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      // Verify aggregate was called (which uses the days parameter)
      expect(User.aggregate).toHaveBeenCalled();
      const aggregateCall = User.aggregate.mock.calls[0][0];
      expect(aggregateCall[0].$match.createdAt).toBeDefined();
    });

    it('should use custom days parameter when provided', async () => {
      User.countDocuments.mockResolvedValue(50);
      User.aggregate.mockResolvedValue([]);
      Conversation.countDocuments.mockResolvedValue(0);
      Conversation.aggregate.mockResolvedValue([]);
      Message.countDocuments.mockResolvedValue(0);
      Message.distinct.mockResolvedValue([]);
      Message.aggregate.mockResolvedValue([]);

      await request(app)
        .get('/api/admin/stats?days=7')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(User.aggregate).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      User.countDocuments.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to fetch statistics',
        message: 'Database connection failed',
      });
    });

    it('should handle null provider values correctly', async () => {
      User.countDocuments.mockResolvedValue(10);
      User.aggregate.mockImplementation((pipeline) => {
        const groupStage = pipeline.find((stage) => stage.$group != null)?.$group;
        if (groupStage?._id?.date != null && groupStage?._id?.provider != null) {
          return Promise.resolve([]);
        }

        return Promise.resolve([
          { _id: 'local', count: 5 },
          { _id: null, count: 3 },
        ]);
      });
      Conversation.countDocuments.mockResolvedValue(0);
      Conversation.aggregate.mockResolvedValue([]);
      Message.countDocuments.mockResolvedValue(0);
      Message.distinct.mockResolvedValue([]);
      Message.aggregate.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.registration.byProvider).toEqual([
        { key: 'local', label: 'local', count: 5 },
        { key: 'unknown', label: 'unknown', count: 3 },
      ]);
    });

    it('should return empty arrays when no data exists', async () => {
      User.countDocuments.mockResolvedValue(0);
      User.aggregate.mockResolvedValue([]);
      Conversation.countDocuments.mockResolvedValue(0);
      Conversation.aggregate.mockResolvedValue([]);
      Message.countDocuments.mockResolvedValue(0);
      Message.distinct.mockResolvedValue([]);
      Message.aggregate.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        overview: {
          totalUsers: 0,
          newUsers: {
            last1Day: 0,
            last7Days: 0,
            last30Days: 0,
          },
          activeUsers: {
            last1Day: 0,
            last7Days: 0,
            last30Days: 0,
          },
          messages: {
            last1Day: 0,
            last7Days: 0,
            last30Days: 0,
          },
          conversations: {
            last1Day: 0,
            last7Days: 0,
            last30Days: 0,
          },
          activeRateLast7Days: 0,
          messagesPerActiveUserLast7Days: 0,
          errorRateLast7Days: 0,
          negativeFeedbackRateLast7Days: 0,
        },
        registration: {
          daily: [],
          byProvider: [],
        },
        usage: {
          daily: [],
          byEndpoint: [],
          byModel: [],
        },
        quality: {
          errorsLast7Days: 0,
          assistantMessagesLast7Days: 0,
          feedbackCountLast7Days: 0,
          negativeFeedbackCountLast7Days: 0,
        },
      });
    });
  });
});
