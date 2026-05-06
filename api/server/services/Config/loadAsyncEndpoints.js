const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { loadServiceKey, isUserProvided } = require('@librechat/api');
const { config } = require('./EndpointService');

async function loadAsyncEndpoints() {
  let serviceKey;
  const { googleKey } = config;
  const googleUserProvides = isUserProvided(googleKey);
  const serverGoogleKey = googleUserProvides ? '' : googleKey;

  const hasServerGoogleKey = serverGoogleKey && serverGoogleKey.trim() !== '';

  if (!hasServerGoogleKey) {
    const serviceKeyPath =
      process.env.GOOGLE_SERVICE_KEY_FILE || path.join(__dirname, '../../..', 'data', 'auth.json');

    try {
      serviceKey = await loadServiceKey(serviceKeyPath);
    } catch (error) {
      logger.error('Error loading service key', error);
      serviceKey = null;
    }
  }

  const google = serviceKey || hasServerGoogleKey ? { userProvide: false } : false;

  return { google };
}

module.exports = loadAsyncEndpoints;
