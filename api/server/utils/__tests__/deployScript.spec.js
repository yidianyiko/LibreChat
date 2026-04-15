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

  it('retains only the current image plus three rollback images for managed local and remote deploy tags', () => {
    expect(deployScriptSource).toContain('ROLLBACK_IMAGE_RETENTION_COUNT=3');
    expect(deployScriptSource).toContain('cleanup_local_images()');
    expect(deployScriptSource).toContain('cleanup_remote_images()');
    expect(deployScriptSource).toContain('grep -E "^${IMAGE_NAME}:[0-9]{14}$"');
    expect(deployScriptSource).toContain('cleanup_remote_images "${IMAGE_TAG}"');
    expect(deployScriptSource).toContain('cleanup_local_images "${IMAGE_TAG}"');
  });

  it('bootstraps the MongoDB replica set and waits for a writable primary in both local and remote deploy flows', () => {
    expect(deployScriptSource).toContain('bootstrap_local_mongo_replica_set()');
    expect(deployScriptSource).toContain('bootstrap_remote_mongo_replica_set()');
    expect(deployScriptSource).toContain("rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongodb:27017' }] })");
    expect(deployScriptSource).toContain('db.hello().isWritablePrimary');
    expect(deployScriptSource).toContain('bootstrap_remote_mongo_replica_set "${PROJECT_DIR}"');
    expect(deployScriptSource).toContain('bootstrap_local_mongo_replica_set');
  });
});
