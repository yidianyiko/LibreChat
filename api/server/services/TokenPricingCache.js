const { logger } = require('~/config');

/**
 * In-memory cache for token pricing records from MongoDB.
 *
 * Pattern matching follows the same convention as tx.js:
 * records are stored sorted by modelPattern length DESC so that
 * more specific patterns (e.g. "gpt-4o-mini") are checked before
 * shorter ones (e.g. "gpt-4o") when using `includes()`.
 */
class TokenPricingCache {
  constructor() {
    /** @type {Array<{modelPattern: string, inputRate: number, outputRate: number, longContextThreshold?: number, longContextInputRate?: number, longContextOutputRate?: number}>} */
    this._records = [];
    this._loaded = false;
    this._loadPromise = null;
  }

  /**
   * Load all active pricing records from the database.
   * Safe to call multiple times — concurrent calls share the same promise.
   */
  async load() {
    if (this._loadPromise) {
      return this._loadPromise;
    }

    this._loadPromise = this._doLoad();
    try {
      await this._loadPromise;
    } finally {
      this._loadPromise = null;
    }
  }

  async _doLoad() {
    try {
      const { TokenPricing } = require('~/db/models');
      const records = await TokenPricing.find({ isActive: true }).lean();
      // Sort by pattern length DESC for most-specific-first matching
      records.sort((a, b) => b.modelPattern.length - a.modelPattern.length);
      this._records = records;
      this._loaded = true;
      logger.info(`[TokenPricingCache] Loaded ${records.length} pricing records from database`);
    } catch (error) {
      logger.error('[TokenPricingCache] Failed to load pricing from database:', error);
      this._records = [];
      this._loaded = true; // Mark loaded even on error to avoid retry loops
    }
  }

  /**
   * Find the matching record for a model name.
   * Uses `includes()` matching, most-specific-first (longest pattern first).
   * @param {string} modelName
   * @returns {object|null}
   */
  _findRecord(modelName) {
    if (!modelName || !this._loaded) {
      return null;
    }
    for (const record of this._records) {
      if (modelName.includes(record.modelPattern)) {
        return record;
      }
    }
    return null;
  }

  /**
   * Get rate synchronously (returns null if cache not loaded or model not found).
   * @param {string} modelName
   * @returns {{prompt: number, completion: number}|null}
   */
  getRate(modelName) {
    const record = this._findRecord(modelName);
    if (!record) {
      return null;
    }
    return { prompt: record.inputRate, completion: record.outputRate };
  }

  /**
   * Get rate with auto-load if needed.
   * @param {string} modelName
   * @returns {Promise<{prompt: number, completion: number}|null>}
   */
  async getRateAsync(modelName) {
    if (!this._loaded) {
      await this.load();
    }
    return this.getRate(modelName);
  }

  /**
   * Get premium (long-context) rate if applicable.
   * @param {string} modelName
   * @param {'prompt'|'completion'} tokenType
   * @param {number} inputTokenCount
   * @returns {number|null}
   */
  getPremiumRate(modelName, tokenType, inputTokenCount) {
    if (inputTokenCount == null) {
      return null;
    }
    const record = this._findRecord(modelName);
    if (!record || !record.longContextThreshold) {
      return null;
    }
    if (inputTokenCount <= record.longContextThreshold) {
      return null;
    }
    if (tokenType === 'prompt') {
      return record.longContextInputRate ?? null;
    }
    if (tokenType === 'completion') {
      return record.longContextOutputRate ?? null;
    }
    return null;
  }

  /** Clear the cache. Next access will require a reload. */
  invalidate() {
    this._records = [];
    this._loaded = false;
    this._loadPromise = null;
    logger.info('[TokenPricingCache] Cache invalidated');
  }

  /** @returns {boolean} */
  isLoaded() {
    return this._loaded;
  }

  /** Get all records (for admin API). */
  getAll() {
    return this._records;
  }
}

// Singleton
const tokenPricingCache = new TokenPricingCache();

module.exports = { TokenPricingCache, tokenPricingCache };
