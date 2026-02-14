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
    distinct: jest.fn(),
  },
}));

const request = require('supertest');
const express = require('express');
const statsRouter = require('../stats');
const { User, Message } = require('~/db/models');

const app = express();
app.use(express.json());
app.use('/api/admin/stats', statsRouter);

describe('Admin Stats API Routes', () => {
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
      // Mock total users count
      User.countDocuments.mockImplementation((query) => {
        if (!query) {
          return Promise.resolve(100);
        }
        // Recent new users (last 7 days)
        return Promise.resolve(15);
      });

      // Mock daily registrations aggregation
      User.aggregate.mockImplementation((pipeline) => {
        // Check if this is the daily registrations query
        if (pipeline.some((stage) => stage.$match && stage.$match.createdAt)) {
          return Promise.resolve([
            {
              _id: '2026-02-10',
              providers: [
                { provider: 'local', count: 3 },
                { provider: 'google', count: 2 },
              ],
              totalCount: 5,
            },
            {
              _id: '2026-02-11',
              providers: [{ provider: 'local', count: 4 }],
              totalCount: 4,
            },
          ]);
        }
        // Registration by provider aggregation
        return Promise.resolve([
          { _id: 'local', count: 60 },
          { _id: 'google', count: 30 },
          { _id: 'github', count: 10 },
        ]);
      });

      // Mock active users
      Message.distinct
        .mockResolvedValueOnce(['user1', 'user2', 'user3', 'user4', 'user5']) // last 7 days
        .mockResolvedValueOnce([
          'user1',
          'user2',
          'user3',
          'user4',
          'user5',
          'user6',
          'user7',
          'user8',
        ]); // last 30 days

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        totalUsers: 100,
        recentNewUsers: 15,
        dailyRegistrations: [
          {
            date: '2026-02-10',
            count: 5,
            localCount: 3,
            googleCount: 2,
          },
          {
            date: '2026-02-11',
            count: 4,
            localCount: 4,
          },
        ],
        registrationByProvider: {
          local: 60,
          google: 30,
          github: 10,
        },
        activeUsers: {
          last7Days: 5,
          last30Days: 8,
        },
      });
    });

    it('should use default days parameter (30) when not provided', async () => {
      User.countDocuments.mockResolvedValue(50);
      User.aggregate.mockResolvedValue([]);
      Message.distinct.mockResolvedValue([]);

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
      Message.distinct.mockResolvedValue([]);

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
        if (pipeline.some((stage) => stage.$match && stage.$match.createdAt)) {
          return Promise.resolve([]);
        }
        // Registration by provider with null provider
        return Promise.resolve([
          { _id: 'local', count: 5 },
          { _id: null, count: 3 },
        ]);
      });
      Message.distinct.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.registrationByProvider).toEqual({
        local: 5,
        unknown: 3,
      });
    });

    it('should return empty arrays when no data exists', async () => {
      User.countDocuments.mockResolvedValue(0);
      User.aggregate.mockResolvedValue([]);
      Message.distinct.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        totalUsers: 0,
        recentNewUsers: 0,
        dailyRegistrations: [],
        registrationByProvider: {},
        activeUsers: {
          last7Days: 0,
          last30Days: 0,
        },
      });
    });
  });
});
