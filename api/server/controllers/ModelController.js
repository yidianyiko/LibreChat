const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { loadDefaultModels, loadConfigModels } = require('~/server/services/Config');
const { getValueKey, getMultiplier } = require('~/models/tx');
const { getLogStores } = require('~/cache');

/**
 * @param {ServerRequest} req
 * @returns {Promise<TModelsConfig>} The models config.
 */
const getModelsConfig = async (req) => {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  let modelsConfig = await cache.get(CacheKeys.MODELS_CONFIG);
  if (!modelsConfig) {
    modelsConfig = await loadModels(req);
  }

  return modelsConfig;
};

/**
 * Loads the models from the config.
 * @param {ServerRequest} req - The Express request object.
 * @returns {Promise<TModelsConfig>} The models config.
 */
async function loadModels(req) {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  const cachedModelsConfig = await cache.get(CacheKeys.MODELS_CONFIG);
  if (cachedModelsConfig) {
    return cachedModelsConfig;
  }
  const defaultModelsConfig = await loadDefaultModels(req);
  const customModelsConfig = await loadConfigModels(req);

  const modelConfig = { ...defaultModelsConfig, ...customModelsConfig };

  await cache.set(CacheKeys.MODELS_CONFIG, modelConfig);
  return modelConfig;
}

async function modelController(req, res) {
  try {
    const modelConfig = await loadModels(req);
    res.send(modelConfig);
  } catch (error) {
    logger.error('Error fetching models:', error);
    res.status(500).send({ error: error.message });
  }
}

async function modelRatesController(req, res) {
  try {
    // Ensure DB pricing cache is loaded
    const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
    if (!tokenPricingCache.isLoaded()) {
      await tokenPricingCache.load();
    }

    const modelConfig = await loadModels(req);
    /** @type {Record<string, Record<string, { prompt: number, completion: number }>>} */
    const rates = {};

    for (const [endpoint, models] of Object.entries(modelConfig ?? {})) {
      if (!Array.isArray(models) || models.length === 0) {
        continue;
      }

      rates[endpoint] = {};
      for (const model of models) {
        if (typeof model !== 'string' || model.length === 0) {
          continue;
        }

        const valueKey = getValueKey(model, endpoint);
        if (!valueKey) {
          continue;
        }

        rates[endpoint][model] = {
          prompt: getMultiplier({ model, endpoint, tokenType: 'prompt' }),
          completion: getMultiplier({ model, endpoint, tokenType: 'completion' }),
        };
      }
    }

    res.send(rates);
  } catch (error) {
    logger.error('Error fetching model rates:', error);
    res.status(500).send({ error: error.message });
  }
}

module.exports = { modelController, modelRatesController, loadModels, getModelsConfig };
