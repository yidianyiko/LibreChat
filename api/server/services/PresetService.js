const crypto = require('crypto');
const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { savePreset, getPresets } = require('~/models');
const {
  DEFAULT_PRESET_CONFIG,
  DEFAULT_PRESET_ID,
} = require(path.resolve(__dirname, '..', '..', '..', 'config', 'default-preset'));

/**
 * 为用户创建默认预设
 * @param {string} userId - 用户 ID
 * @returns {Promise<Object|null>} 创建的预设对象，如果已存在则返回 null
 */
const createDefaultPresetForUser = async (userId) => {
  try {
    // 检查用户是否已有默认预设
    const existingPresets = await getPresets(userId);
    const hasDefaultPreset = existingPresets.some(
      (preset) => preset.presetId === DEFAULT_PRESET_ID || preset.defaultPreset === true,
    );

    if (hasDefaultPreset) {
      logger.info(
        `[PresetService] User ${userId} already has a default preset, skipping creation`,
      );
      return null;
    }

    // 创建预设数据
    const presetData = {
      ...DEFAULT_PRESET_CONFIG,
      // 为每个用户生成唯一的 presetId（避免冲突）
      presetId: `${DEFAULT_PRESET_ID}-${crypto.randomUUID().slice(0, 8)}`,
    };

    // 保存预设
    const savedPreset = await savePreset(userId, presetData);

    logger.info(`[PresetService] Successfully created default preset for user ${userId}`);
    return savedPreset;
  } catch (error) {
    logger.error(`[PresetService] Error creating default preset for user ${userId}:`, error);
    throw error;
  }
};

/**
 * 批量为多个用户创建默认预设
 * @param {string[]} userIds - 用户 ID 数组
 * @returns {Promise<Object>} 包含成功和失败统计的对象
 */
const createDefaultPresetsForUsers = async (userIds) => {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const userId of userIds) {
    try {
      const preset = await createDefaultPresetForUser(userId);
      if (preset === null) {
        results.skipped++;
      } else {
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId,
        error: error.message,
      });
    }
  }

  return results;
};

module.exports = {
  createDefaultPresetForUser,
  createDefaultPresetsForUsers,
};
