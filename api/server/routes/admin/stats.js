const express = require('express');
const { requireAdmin } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { User, Message, Conversation } = require('~/db/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const clampDays = (value) => Math.min(Math.max(parseInt(value, 10) || 30, 1), 365);

const getStartOfDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const divide = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);

const getBucketKey = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'unknown';
  }

  return value;
};

const toDistributionBuckets = (items) =>
  items.map(({ _id, count }) => {
    const key = getBucketKey(_id);
    return {
      key,
      label: key,
      count,
    };
  });

/**
 * GET /api/admin/stats
 * Returns admin statistics: growth, usage, and quality metrics
 * Query params:
 *   - days: number of days to query (default: 30)
 */
router.get('/', requireJwtAuth, requireAdmin, async (req, res) => {
  try {
    const days = clampDays(req.query.days);
    const startDate = getStartOfDaysAgo(days);
    const last1Day = getStartOfDaysAgo(1);
    const last7Days = getStartOfDaysAgo(7);
    const last30Days = getStartOfDaysAgo(30);

    const [
      totalUsers,
      newUsersLast1Day,
      newUsersLast7Days,
      newUsersLast30Days,
      activeUsersLast1Day,
      activeUsersLast7Days,
      activeUsersLast30Days,
      messagesLast1Day,
      messagesLast7Days,
      messagesLast30Days,
      conversationsLast1Day,
      conversationsLast7Days,
      conversationsLast30Days,
      assistantMessagesLast7Days,
      errorsLast7Days,
      feedbackCountLast7Days,
      negativeFeedbackCountLast7Days,
      dailyRegistrations,
      registrationByProvider,
      dailyUsage,
      dailyConversationCounts,
      usageByEndpoint,
      usageByModel,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: last1Day } }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      User.countDocuments({ createdAt: { $gte: last30Days } }),
      Message.distinct('user', { createdAt: { $gte: last1Day } }),
      Message.distinct('user', { createdAt: { $gte: last7Days } }),
      Message.distinct('user', { createdAt: { $gte: last30Days } }),
      Message.countDocuments({ createdAt: { $gte: last1Day } }),
      Message.countDocuments({ createdAt: { $gte: last7Days } }),
      Message.countDocuments({ createdAt: { $gte: last30Days } }),
      Conversation.countDocuments({ createdAt: { $gte: last1Day } }),
      Conversation.countDocuments({ createdAt: { $gte: last7Days } }),
      Conversation.countDocuments({ createdAt: { $gte: last30Days } }),
      Message.countDocuments({
        createdAt: { $gte: last7Days },
        isCreatedByUser: false,
      }),
      Message.countDocuments({
        createdAt: { $gte: last7Days },
        isCreatedByUser: false,
        error: true,
      }),
      Message.countDocuments({
        createdAt: { $gte: last7Days },
        isCreatedByUser: false,
        feedback: { $exists: true },
      }),
      Message.countDocuments({
        createdAt: { $gte: last7Days },
        isCreatedByUser: false,
        'feedback.rating': 'thumbsDown',
      }),
      User.aggregate([
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
                key: '$_id.provider',
                count: '$count',
              },
            },
            total: { $sum: '$count' },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: '$provider',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1, _id: 1 },
        },
      ]),
      Message.aggregate([
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
              user: '$user',
            },
            messages: { $sum: 1 },
            errors: {
              $sum: {
                $cond: [{ $eq: ['$error', true] }, 1, 0],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            activeUsers: { $sum: 1 },
            messages: { $sum: '$messages' },
            errors: { $sum: '$errors' },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
      Conversation.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            conversations: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
      Message.aggregate([
        {
          $match: {
            createdAt: { $gte: last7Days },
          },
        },
        {
          $group: {
            _id: '$endpoint',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1, _id: 1 },
        },
      ]),
      Message.aggregate([
        {
          $match: {
            createdAt: { $gte: last7Days },
            model: { $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: '$model',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1, _id: 1 },
        },
        {
          $limit: 10,
        },
      ]),
    ]);

    const dailyUsageMap = new Map();
    for (const day of dailyUsage) {
      dailyUsageMap.set(day._id, {
        date: day._id,
        activeUsers: day.activeUsers,
        messages: day.messages,
        conversations: 0,
        errors: day.errors,
      });
    }

    for (const day of dailyConversationCounts) {
      const existing = dailyUsageMap.get(day._id);
      if (existing != null) {
        existing.conversations = day.conversations;
        continue;
      }

      dailyUsageMap.set(day._id, {
        date: day._id,
        activeUsers: 0,
        messages: 0,
        conversations: day.conversations,
        errors: 0,
      });
    }

    const registrationDaily = dailyRegistrations.map((day) => ({
      date: day._id,
      total: day.total,
      providers: day.providers.map((provider) => ({
        key: getBucketKey(provider.key),
        count: provider.count,
      })),
    }));

    const usageDaily = Array.from(dailyUsageMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      overview: {
        totalUsers,
        newUsers: {
          last1Day: newUsersLast1Day,
          last7Days: newUsersLast7Days,
          last30Days: newUsersLast30Days,
        },
        activeUsers: {
          last1Day: activeUsersLast1Day.length,
          last7Days: activeUsersLast7Days.length,
          last30Days: activeUsersLast30Days.length,
        },
        messages: {
          last1Day: messagesLast1Day,
          last7Days: messagesLast7Days,
          last30Days: messagesLast30Days,
        },
        conversations: {
          last1Day: conversationsLast1Day,
          last7Days: conversationsLast7Days,
          last30Days: conversationsLast30Days,
        },
        activeRateLast7Days: divide(activeUsersLast7Days.length, totalUsers),
        messagesPerActiveUserLast7Days: divide(messagesLast7Days, activeUsersLast7Days.length),
        errorRateLast7Days: divide(errorsLast7Days, assistantMessagesLast7Days),
        negativeFeedbackRateLast7Days: divide(
          negativeFeedbackCountLast7Days,
          feedbackCountLast7Days,
        ),
      },
      registration: {
        daily: registrationDaily,
        byProvider: toDistributionBuckets(registrationByProvider),
      },
      usage: {
        daily: usageDaily,
        byEndpoint: toDistributionBuckets(usageByEndpoint),
        byModel: toDistributionBuckets(usageByModel),
      },
      quality: {
        errorsLast7Days,
        assistantMessagesLast7Days,
        feedbackCountLast7Days,
        negativeFeedbackCountLast7Days,
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
