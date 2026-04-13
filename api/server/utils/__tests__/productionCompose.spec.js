const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function readComposeConfig(composeFilename) {
  const composePath = path.resolve(__dirname, `../../../../${composeFilename}`);
  const composeSource = fs.readFileSync(composePath, 'utf8');
  return yaml.load(composeSource);
}

function getEnvironmentMap(serviceConfig) {
  const entries = serviceConfig.environment ?? [];
  return Object.fromEntries(
    entries.map((entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return [entry, ''];
      }

      return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
    }),
  );
}

describe.each(['docker-compose.yml', 'deploy-compose.yml'])('%s WeChat bridge wiring', (composeFilename) => {
  it('requires a shared WECHAT_BRIDGE_INTERNAL_TOKEN for api and wechat-bridge', () => {
    const composeConfig = readComposeConfig(composeFilename);
    const api = composeConfig.services.api;
    const wechatBridge = composeConfig.services['wechat-bridge'];

    expect(api).toBeDefined();
    expect(wechatBridge).toBeDefined();

    const apiEnvironment = getEnvironmentMap(api);
    const bridgeEnvironment = getEnvironmentMap(wechatBridge);

    expect(apiEnvironment.WECHAT_BRIDGE_INTERNAL_TOKEN).toBe(
      '${WECHAT_BRIDGE_INTERNAL_TOKEN:?WECHAT_BRIDGE_INTERNAL_TOKEN is required}',
    );
    expect(bridgeEnvironment.WECHAT_BRIDGE_INTERNAL_TOKEN).toBe(
      '${WECHAT_BRIDGE_INTERNAL_TOKEN:?WECHAT_BRIDGE_INTERNAL_TOKEN is required}',
    );
  });
});
