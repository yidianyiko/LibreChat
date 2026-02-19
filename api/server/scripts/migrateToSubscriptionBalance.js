const path = require('path');
const mongoose = require('mongoose');
require('module-alias')({ base: path.resolve(__dirname, '..', '..', '..', 'api') });

const { logger } = require('@librechat/data-schemas');
const { Balance } = require('~/db/models');
const connect = require(path.resolve(__dirname, '..', '..', '..', 'config', 'connect'));

/**
 * Migration script: Move tokenCredits to topupBalance
 *
 * Strategy:
 * 1. Users without subscription: tokenCredits → topupBalance
 * 2. Users with active subscription: tokenCredits → topupBalance (keep separate)
 * 3. Set subscriptionBalance = 0 for all (will be filled on next renewal)
 */
async function migrateToSubscriptionBalance() {
  try {
    logger.info('[Migration] Starting migration to dual balance system...');

    // Find all Balance documents that haven't been migrated yet
    const balancesToMigrate = await Balance.find({
      $or: [{ subscriptionBalance: { $exists: false } }, { topupBalance: { $exists: false } }],
    }).lean();

    logger.info(`[Migration] Found ${balancesToMigrate.length} balance records to migrate`);

    let migratedCount = 0;
    for (const balance of balancesToMigrate) {
      const tokenCredits = balance.tokenCredits || 0;

      await Balance.updateOne(
        { _id: balance._id },
        {
          $set: {
            subscriptionBalance: 0, // Start fresh for all users
            topupBalance: tokenCredits, // Move old credits to topup
            lastSubscriptionReset: null,
          },
        },
      );

      migratedCount++;
    }

    logger.info(`[Migration] Updated ${migratedCount} balance records`);
    logger.info('[Migration] Migration completed successfully');

    return { modifiedCount: migratedCount };
  } catch (error) {
    logger.error('[Migration] Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  connect()
    .then(async () => {
      logger.info('[Migration] Connected to MongoDB');
      await migrateToSubscriptionBalance();
      await mongoose.disconnect();
      logger.info('[Migration] Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Migration] Connection error:', error);
      process.exit(1);
    });
}

module.exports = { migrateToSubscriptionBalance };
