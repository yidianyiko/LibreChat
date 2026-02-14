const express = require('express');
const { requireAdmin } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { User, Message } = require('~/db/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

/**
 * GET /api/admin/stats
 * Returns admin statistics: total users, daily registrations, provider distribution, active users
 * Query params:
 *   - days: number of days to query (default: 30)
 */
router.get('/', requireJwtAuth, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Total users count
    const totalUsers = await User.countDocuments();

    // 2. Recent new users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const recentNewUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    // 3. Daily registrations with provider breakdown
    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            provider: '$provider',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          providers: {
            $push: {
              provider: '$_id.provider',
              count: '$count',
            },
          },
          totalCount: { $sum: '$count' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Transform to frontend format
    const dailyRegistrationsFormatted = dailyRegistrations.map((day) => {
      const result = {
        date: day._id,
        count: day.totalCount,
      };

      // Add provider-specific counts
      day.providers.forEach((p) => {
        result[`${p.provider}Count`] = p.count;
      });

      return result;
    });

    // 4. Registration by provider (total)
    const registrationByProvider = await User.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
        },
      },
    ]);

    const providerDistribution = {};
    registrationByProvider.forEach((item) => {
      providerDistribution[item._id || 'unknown'] = item.count;
    });

    // 5. Active users (users who sent messages in time ranges)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const activeUsersLast7Days = await Message.distinct('user', {
      createdAt: { $gte: last7Days },
    });

    const activeUsersLast30Days = await Message.distinct('user', {
      createdAt: { $gte: last30Days },
    });

    res.json({
      totalUsers,
      recentNewUsers,
      dailyRegistrations: dailyRegistrationsFormatted,
      registrationByProvider: providerDistribution,
      activeUsers: {
        last7Days: activeUsersLast7Days.length,
        last30Days: activeUsersLast30Days.length,
      },
    });
  } catch (error) {
    logger.error('[/api/admin/stats] Error fetching admin stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

module.exports = router;
