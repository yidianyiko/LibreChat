const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function readComposeConfig() {
  const composePath = path.resolve(__dirname, '../../../../docker-compose.dev.yml');
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

describe('docker-compose.dev prod-test wiring', () => {
  it('starts the local wechat bridge and wires api-prod-test to it', () => {
    const composeConfig = readComposeConfig();
    const apiProdTest = composeConfig.services['api-prod-test'];
    const wechatBridgeProdTest = composeConfig.services['wechat-bridge-prod-test'];

    expect(apiProdTest).toBeDefined();
    expect(wechatBridgeProdTest).toBeDefined();

    expect(wechatBridgeProdTest.profiles).toContain('prod-test');
    expect(wechatBridgeProdTest.depends_on).toContain('api-prod-test');

    const apiEnvironment = getEnvironmentMap(apiProdTest);
    const bridgeEnvironment = getEnvironmentMap(wechatBridgeProdTest);

    expect(apiEnvironment.WECHAT_BRIDGE_URL).toBe('http://wechat-bridge-prod-test:3091');
    expect(apiEnvironment.WECHAT_BRIDGE_INTERNAL_TOKEN).toBe(
      '${WECHAT_BRIDGE_INTERNAL_TOKEN:-local-wechat-bridge-token}',
    );
    expect(bridgeEnvironment.WECHAT_BRIDGE_PORT).toBe('3091');
    expect(bridgeEnvironment.WECHAT_BRIDGE_LIBRECHAT_URL).toBe('http://api-prod-test:3080');
    expect(bridgeEnvironment.WECHAT_BRIDGE_INTERNAL_TOKEN).toBe(
      '${WECHAT_BRIDGE_INTERNAL_TOKEN:-local-wechat-bridge-token}',
    );
  });
});
