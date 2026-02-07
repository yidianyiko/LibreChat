#!/usr/bin/env node

/**
 * 数据迁移脚本：为所有现有用户创建默认预设
 *
 * 使用方法：
 *   node api/server/scripts/create-default-presets.js
 *
 * 或通过 npm script:
 *   npm run create-default-presets
 */

const path = require('path');
const mongoose = require('mongoose');
require('module-alias')({ base: path.resolve(__dirname, '..', '..', '..', 'api') });

const { User } = require('@librechat/data-schemas').createModels(mongoose);
const { createDefaultPresetsForUsers } = require('~/server/services/PresetService');
const { logger } = require('@librechat/data-schemas');
const connect = require(path.resolve(__dirname, '..', '..', '..', 'config', 'connect'));

async function main() {
  try {
    logger.info('[create-default-presets] Starting migration...');

    // 连接数据库
    await connect();
    logger.info('[create-default-presets] Database connected');

    // 获取所有用户
    const users = await User.find({}).select('_id email username').lean();
    logger.info(`[create-default-presets] Found ${users.length} users`);

    if (users.length === 0) {
      logger.info('[create-default-presets] No users found, exiting');
      process.exit(0);
    }

    // 提取用户 ID
    const userIds = users.map((user) => user._id.toString());

    // 批量创建预设
    logger.info('[create-default-presets] Creating default presets...');
    const results = await createDefaultPresetsForUsers(userIds);

    // 输出结果
    logger.info('[create-default-presets] Migration completed:');
    logger.info(`  - Success: ${results.success}`);
    logger.info(`  - Skipped: ${results.skipped} (already have default preset)`);
    logger.info(`  - Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      logger.error('[create-default-presets] Errors encountered:');
      results.errors.forEach((err) => {
        logger.error(`  User ${err.userId}: ${err.error}`);
      });
    }

    logger.info('[create-default-presets] Done!');
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    logger.error('[create-default-presets] Fatal error:', error);
    process.exit(1);
  }
}

// 运行主函数
main();
