const fs = require('fs');
const path = require('path');

describe('deploy.sh remote override generation', () => {
  const deployScriptPath = path.resolve(__dirname, '../../../../deploy.sh');
  const deployScriptSource = fs.readFileSync(deployScriptPath, 'utf8');

  it('pins both api and wechat-bridge services to the built image in override.yml', () => {
    expect(deployScriptSource).toContain('services:');
    expect(deployScriptSource).toContain('  api:');
    expect(deployScriptSource).toContain('    image: ${IMAGE_TAG}');
    expect(deployScriptSource).toContain('  wechat-bridge:');
  });

  it('restarts both api and wechat-bridge for deploy and rollback paths', () => {
    const matches =
      deployScriptSource.match(
        /sudo docker-compose -f docker-compose\.yml -f \.deploy\/override\.yml up -d api wechat-bridge/g,
      ) ?? [];
    expect(matches).toHaveLength(2);
  });

  it('bootstraps WECHAT_BRIDGE_INTERNAL_TOKEN before syncing .env to the server', () => {
    expect(deployScriptSource).toContain('ensure_wechat_bridge_internal_token()');
    expect(deployScriptSource).toContain('WECHAT_BRIDGE_INTERNAL_TOKEN=');
    expect(deployScriptSource).toContain('已生成 WECHAT_BRIDGE_INTERNAL_TOKEN 并写入 .env');
    expect(deployScriptSource).toContain('ensure_wechat_bridge_internal_token\n    if [ -f ".env" ]; then');
  });
});
