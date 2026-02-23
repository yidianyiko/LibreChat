const { logger } = require('@librechat/data-schemas');
const { ViolationTypes } = require('librechat-data-provider');
const { createAutoRefillTransaction } = require('./Transaction');
const { logViolation } = require('~/cache');
const { getMultiplier } = require('./tx');
const { Balance } = require('~/db/models');

function isInvalidDate(date) {
  return isNaN(date);
}

/**
 * Simple check method that calculates token cost and returns balance info.
 * The auto-refill logic has been moved to balanceMethods.js to prevent circular dependencies.
 */
const checkBalanceRecord = async function ({
  user,
  model,
  endpoint,
  valueKey,
  tokenType,
  amount,
  endpointTokenConfig,
}) {
  const multiplier = getMultiplier({ valueKey, tokenType, model, endpoint, endpointTokenConfig });
  const tokenCost = amount * multiplier;

  // Retrieve the balance record
  let record = await Balance.findOne({ user }).lean();
  if (!record) {
    logger.debug('[Balance.check] No balance record found for user', { user });
    return {
      canSpend: false,
      balance: 0,
      tokenCost,
    };
  }
  let balance = record.tokenCredits;

  logger.debug('[Balance.check] Initial state', {
    user,
    model,
    endpoint,
    valueKey,
    tokenType,
    amount,
    balance,
    multiplier,
    endpointTokenConfig: !!endpointTokenConfig,
  });

  // Only perform auto-refill if spending would bring the balance to 0 or below
  if (balance - tokenCost <= 0 && record.autoRefillEnabled && record.refillAmount > 0) {
    const lastRefillDate = new Date(record.lastRefill);
    const now = new Date();
    if (
      isInvalidDate(lastRefillDate) ||
      now >=
        addIntervalToDate(lastRefillDate, record.refillIntervalValue, record.refillIntervalUnit)
    ) {
      try {
        /** @type {{ rate: number, user: string, balance: number, transaction: import('@librechat/data-schemas').ITransaction}} */
        const result = await createAutoRefillTransaction({
          user: user,
          tokenType: 'credits',
          context: 'autoRefill',
          rawAmount: record.refillAmount,
        });
        balance = result.balance;
      } catch (error) {
        logger.error('[Balance.check] Failed to record transaction for auto-refill', error);
      }
    }
  }

  logger.debug('[Balance.check] Token cost', { tokenCost });
  return { canSpend: balance >= tokenCost, balance, tokenCost };
};

/**
 * Adds a time interval to a given date.
 * @param {Date} date - The starting date.
 * @param {number} value - The numeric value of the interval.
 * @param {'seconds'|'minutes'|'hours'|'days'|'weeks'|'months'} unit - The unit of time.
 * @returns {Date} A new Date representing the starting date plus the interval.
 */
const addIntervalToDate = (date, value, unit) => {
  const result = new Date(date);
  switch (unit) {
    case 'seconds':
      result.setSeconds(result.getSeconds() + value);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + value);
      break;
    case 'hours':
      result.setHours(result.getHours() + value);
      break;
    case 'days':
      result.setDate(result.getDate() + value);
      break;
    case 'weeks':
      result.setDate(result.getDate() + value * 7);
      break;
    case 'months':
      result.setMonth(result.getMonth() + value);
      break;
    default:
      break;
  }
  return result;
};

/**
 * Checks the balance for a user and determines if they can spend a certain amount.
 * If the user cannot spend the amount, it logs a violation and denies the request.
 *
 * @async
 * @function
 * @param {Object} params - The function parameters.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {Express.Response} params.res - The Express response object.
 * @param {Object} params.txData - The transaction data.
 * @param {string} params.txData.user - The user ID or identifier.
 * @param {('prompt' | 'completion')} params.txData.tokenType - The type of token.
 * @param {number} params.txData.amount - The amount of tokens.
 * @param {string} params.txData.model - The model name or identifier.
 * @param {string} [params.txData.endpointTokenConfig] - The token configuration for the endpoint.
 * @returns {Promise<boolean>} Throws error if the user cannot spend the amount.
 * @throws {Error} Throws an error if there's an issue with the balance check.
 */
const checkBalance = async ({ req, res, txData }) => {
  const { canSpend, balance, tokenCost } = await checkBalanceRecord(txData);
  if (canSpend) {
    return true;
  }

  const type = ViolationTypes.TOKEN_BALANCE;
  const errorMessage = {
    type,
    balance,
    tokenCost,
    promptTokens: txData.amount,
  };

  if (txData.generations && txData.generations.length > 0) {
    errorMessage.generations = txData.generations;
  }

  await logViolation(req, res, type, errorMessage, 0);
  throw new Error(JSON.stringify(errorMessage));
};

/**
 * Updates user balance with dual balance pool support
 * @param {Object} params
 * @param {string} params.user - User ID
 * @param {number} params.incrementValue - Value to add (positive) or subtract (negative)
 * @param {string} params.balanceType - 'subscription' or 'topup'
 * @param {Object} [params.setValues] - Additional fields to set
 * @returns {Promise<Object>} Updated balance document
 */
async function updateDualBalance({ user, incrementValue, balanceType, setValues }) {
  let maxRetries = 10;
  let delay = 50;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const currentBalanceDoc = await Balance.findOne({ user }).lean();
      const currentSubBalance = currentBalanceDoc?.subscriptionBalance || 0;
      const currentTopupBalance = currentBalanceDoc?.topupBalance || 0;

      // Calculate new balances
      let newSubBalance = currentSubBalance;
      let newTopupBalance = currentTopupBalance;

      if (balanceType === 'subscription') {
        newSubBalance = Math.max(0, currentSubBalance + incrementValue);
      } else if (balanceType === 'topup') {
        newTopupBalance = Math.max(0, currentTopupBalance + incrementValue);
      } else {
        throw new Error(`Invalid balanceType: ${balanceType}`);
      }

      const updatePayload = {
        $set: {
          subscriptionBalance: newSubBalance,
          topupBalance: newTopupBalance,
          // Also update legacy tokenCredits for backward compatibility
          tokenCredits: newSubBalance + newTopupBalance,
          ...(setValues || {}),
        },
      };

      let updatedBalance = null;
      if (currentBalanceDoc) {
        // Conditional update with optimistic locking
        // Use $in: [value, null] when value is 0 to match documents where the field
        // is missing (legacy docs created before dual-balance fields were added)
        const subQuery = currentSubBalance === 0
          ? { $in: [0, null] }
          : currentSubBalance;
        const topupQuery = currentTopupBalance === 0
          ? { $in: [0, null] }
          : currentTopupBalance;

        updatedBalance = await Balance.findOneAndUpdate(
          {
            user: user,
            subscriptionBalance: subQuery,
            topupBalance: topupQuery,
          },
          updatePayload,
          { new: true },
        ).lean();

        if (updatedBalance) {
          return updatedBalance;
        }
        lastError = new Error(`Concurrency conflict for user ${user} on attempt ${attempt}`);
      } else {
        // Upsert for new user
        updatedBalance = await Balance.findOneAndUpdate({ user: user }, updatePayload, {
          upsert: true,
          new: true,
        }).lean();

        if (updatedBalance) {
          return updatedBalance;
        }
        lastError = new Error(`Upsert race condition for user ${user} on attempt ${attempt}`);
      }
    } catch (error) {
      logger.error(`[updateDualBalance] Error during attempt ${attempt} for user ${user}:`, error);
      lastError = error;
    }

    if (attempt < maxRetries) {
      const jitter = Math.random() * delay * 0.5;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      delay = Math.min(delay * 2, 2000);
    }
  }

  logger.error(`[updateDualBalance] Failed after ${maxRetries} attempts for user ${user}`);
  throw lastError || new Error(`Failed to update balance for user ${user}`);
}

/**
 * Deducts from user balance with priority: subscription first, then topup
 * @param {Object} params
 * @param {string} params.user - User ID
 * @param {number} params.amount - Amount to deduct (positive number)
 * @returns {Promise<Object>} Updated balance and deduction details
 */
async function deductBalance({ user, amount }) {
  if (amount <= 0) {
    throw new Error('Deduction amount must be positive');
  }

  let maxRetries = 10;
  let delay = 50;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const currentBalanceDoc = await Balance.findOne({ user }).lean();
      const currentSubBalance = currentBalanceDoc?.subscriptionBalance || 0;
      const currentTopupBalance = currentBalanceDoc?.topupBalance || 0;

      let remainingToDeduct = amount;
      let newSubBalance = currentSubBalance;
      let newTopupBalance = currentTopupBalance;
      let deductedFromSub = 0;
      let deductedFromTopup = 0;

      // Priority 1: Deduct from subscription balance
      if (remainingToDeduct > 0 && currentSubBalance > 0) {
        deductedFromSub = Math.min(currentSubBalance, remainingToDeduct);
        newSubBalance = currentSubBalance - deductedFromSub;
        remainingToDeduct -= deductedFromSub;
      }

      // Priority 2: Deduct from topup balance
      if (remainingToDeduct > 0 && currentTopupBalance > 0) {
        deductedFromTopup = Math.min(currentTopupBalance, remainingToDeduct);
        newTopupBalance = currentTopupBalance - deductedFromTopup;
        remainingToDeduct -= deductedFromTopup;
      }

      // Check if user has sufficient balance
      if (remainingToDeduct > 0) {
        throw new Error(
          `Insufficient balance: requested ${amount}, available ${currentSubBalance + currentTopupBalance}`,
        );
      }

      const updatePayload = {
        $set: {
          subscriptionBalance: newSubBalance,
          topupBalance: newTopupBalance,
          tokenCredits: newSubBalance + newTopupBalance,
        },
      };

      const subQuery = currentSubBalance === 0
        ? { $in: [0, null] }
        : currentSubBalance;
      const topupQuery = currentTopupBalance === 0
        ? { $in: [0, null] }
        : currentTopupBalance;

      const updatedBalance = await Balance.findOneAndUpdate(
        {
          user: user,
          subscriptionBalance: subQuery,
          topupBalance: topupQuery,
        },
        updatePayload,
        { new: true },
      ).lean();

      if (updatedBalance) {
        return {
          balance: updatedBalance,
          deductedFromSub,
          deductedFromTopup,
          totalDeducted: deductedFromSub + deductedFromTopup,
        };
      }

      lastError = new Error(`Concurrency conflict for user ${user} on attempt ${attempt}`);
    } catch (error) {
      logger.error(`[deductBalance] Error during attempt ${attempt} for user ${user}:`, error);
      lastError = error;
    }

    if (attempt < maxRetries) {
      const jitter = Math.random() * delay * 0.5;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      delay = Math.min(delay * 2, 2000);
    }
  }

  logger.error(`[deductBalance] Failed after ${maxRetries} attempts for user ${user}`);
  throw lastError || new Error(`Failed to deduct balance for user ${user}`);
}

/**
 * Resets subscription balance to a specific value (for monthly reset).
 * Uses $set directly to avoid delta-calculation race conditions.
 * @param {Object} params
 * @param {string} params.user - User ID
 * @param {number} params.newSubscriptionBalance - New subscription balance value
 * @returns {Promise<Object>} Updated balance document
 */
async function resetSubscriptionBalance({ user, newSubscriptionBalance }) {
  const currentBalance = await Balance.findOne({ user }).lean();
  const currentTopupBalance = currentBalance?.topupBalance || 0;

  const result = await Balance.findOneAndUpdate(
    { user },
    {
      $set: {
        subscriptionBalance: newSubscriptionBalance,
        tokenCredits: newSubscriptionBalance + currentTopupBalance,
        lastSubscriptionReset: new Date(),
      },
    },
    { upsert: true, new: true },
  ).lean();

  logger.info(
    `[resetSubscriptionBalance] Reset subscription balance for user ${user} to ${newSubscriptionBalance}`,
  );
  return result;
}

module.exports = {
  checkBalance,
  updateDualBalance,
  deductBalance,
  resetSubscriptionBalance,
};
