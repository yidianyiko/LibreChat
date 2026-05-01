const express = require('express');
const { requireAdmin } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { User, Message, Conversation, Transaction } = require('~/db/models');
const { defaultRate, getMultiplier, getValueKey, tokenValues } = require('~/models/tx');
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

const getStripeRechargeQuery = (startDate) => ({
  createdAt: { $gte: startDate },
  context: 'stripe_recharge',
  tokenType: 'credits',
});

const sumPaymentTotals = (items) => ({
  totalCredits: items[0]?.totalCredits ?? 0,
  totalAmountPaid: items[0]?.totalAmountPaid ?? 0,
});

const sumFinancialRechargeTotals = (items) => ({
  totalCreditsSold: items[0]?.totalCreditsSold ?? 0,
  totalRechargeRevenue: items[0]?.totalRechargeRevenue ?? 0,
});

const sumFinancialUsageTotals = (items) => ({
  totalUsageCredits: items[0]?.totalUsageCredits ?? 0,
});

const getRateValue = (rates, type) => {
  const rate = rates?.[type];
  return typeof rate === 'number' ? rate : defaultRate;
};

const buildFinancials = ({ rechargeTotals, usageTotals }) => {
  const { totalCreditsSold, totalRechargeRevenue } = sumFinancialRechargeTotals(rechargeTotals);
  const { totalUsageCredits } = sumFinancialUsageTotals(usageTotals);
  const centsPerCredit = divide(totalRechargeRevenue, totalCreditsSold);
  const userUsageCharged = Math.min(
    totalRechargeRevenue,
    Math.round(totalUsageCredits * centsPerCredit),
  );

  return {
    totalRechargeRevenue,
    userUsageCharged,
    unusedPaidBalance: Math.max(totalRechargeRevenue - userUsageCharged, 0),
    totalCreditsSold,
    totalUsageCredits,
    centsPerCredit,
  };
};

const buildPricingRows = (usageByModel) =>
  usageByModel.map(({ _id, count }) => {
    const model = getBucketKey(_id);
    const valueKey = getValueKey(model);
    const costRates = valueKey ? tokenValues[valueKey] : null;
    const costPrompt = getRateValue(costRates, 'prompt');
    const costCompletion = getRateValue(costRates, 'completion');
    const userPrompt = getMultiplier({ model, tokenType: 'prompt' });
    const userCompletion = getMultiplier({ model, tokenType: 'completion' });

    return {
      model,
      usageCount: count,
      cost: {
        prompt: costPrompt,
        completion: costCompletion,
      },
      user: {
        prompt: userPrompt,
        completion: userCompletion,
      },
      markup: {
        prompt: divide(userPrompt, costPrompt),
        completion: divide(userCompletion, costCompletion),
      },
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
      paymentsLast1Day,
      paymentsLast7Days,
      paymentsLast30Days,
      payingUsersLast7Days,
      payingUsersLast30Days,
      paymentTotalsLast7Days,
      paymentTotalsLast30Days,
      paymentsByTier,
      financialRechargeTotals,
      financialUsageTotals,
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
      Transaction.countDocuments(getStripeRechargeQuery(last1Day)),
      Transaction.countDocuments(getStripeRechargeQuery(last7Days)),
      Transaction.countDocuments(getStripeRechargeQuery(last30Days)),
      Transaction.distinct('user', getStripeRechargeQuery(last7Days)),
      Transaction.distinct('user', getStripeRechargeQuery(last30Days)),
      Transaction.aggregate([
        {
          $match: getStripeRechargeQuery(last7Days),
        },
        {
          $group: {
            _id: null,
            totalCredits: { $sum: '$rawAmount' },
            totalAmountPaid: { $sum: '$metadata.amountPaid' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: getStripeRechargeQuery(last30Days),
        },
        {
          $group: {
            _id: null,
            totalCredits: { $sum: '$rawAmount' },
            totalAmountPaid: { $sum: '$metadata.amountPaid' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: getStripeRechargeQuery(last30Days),
        },
        {
          $group: {
            _id: '$metadata.tierId',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1, _id: 1 },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            context: 'stripe_recharge',
            tokenType: 'credits',
          },
        },
        {
          $group: {
            _id: null,
            totalCreditsSold: { $sum: '$rawAmount' },
            totalRechargeRevenue: { $sum: '$metadata.amountPaid' },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            tokenType: { $in: ['prompt', 'completion'] },
            tokenValue: { $lt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalUsageCredits: { $sum: { $multiply: ['$tokenValue', -1] } },
          },
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

    const usageDaily = Array.from(dailyUsageMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const paymentTotals7Days = sumPaymentTotals(paymentTotalsLast7Days);
    const paymentTotals30Days = sumPaymentTotals(paymentTotalsLast30Days);
    const financials = buildFinancials({
      rechargeTotals: financialRechargeTotals,
      usageTotals: financialUsageTotals,
    });
    const pricingRows = buildPricingRows(usageByModel);

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
      payments: {
        payments: {
          last1Day: paymentsLast1Day,
          last7Days: paymentsLast7Days,
          last30Days: paymentsLast30Days,
        },
        payingUsers: {
          last7Days: payingUsersLast7Days.length,
          last30Days: payingUsersLast30Days.length,
        },
        creditsSold: {
          last7Days: paymentTotals7Days.totalCredits,
          last30Days: paymentTotals30Days.totalCredits,
        },
        revenue: {
          last7Days: paymentTotals7Days.totalAmountPaid,
          last30Days: paymentTotals30Days.totalAmountPaid,
        },
        byTier: toDistributionBuckets(paymentsByTier),
      },
      financials,
      pricing: {
        modelRates: pricingRows,
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
