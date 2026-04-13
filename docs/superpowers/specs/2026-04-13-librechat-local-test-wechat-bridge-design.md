# LibreChat Local Test WeChat Bridge Design

## Goal

Make `./deploy.sh --local-test` start the same local production-style stack needed for manual WeChat testing, so a developer can open `http://localhost:3080`, bind WeChat, and exercise the bridge flow end-to-end without starting extra services manually.

## Scope

### In Scope

- Change the existing `--local-test` path so it starts the local WeChat bridge by default
- Wire the local production-test API container to the local production-test bridge container
- Keep the bridge internal to Docker networking while exposing the website at `http://localhost:3080`
- Update local-test log streaming so bridge startup and runtime failures are visible
- Add focused regression coverage that locks the `prod-test` compose wiring in place

### Out of Scope

- Adding a new CLI flag such as `--local-test-wechat`
- Changing remote deployment behavior
- Changing the website WeChat binding UI or backend bridge logic
- Exposing the bridge port directly on the host machine
- Adding new environment variables beyond the existing `WECHAT_BRIDGE_*` set

## Design

### Local Test Stack

`./deploy.sh --local-test` should continue to build `librechat-local:test`, then start the `prod-test` profile from `docker-compose.dev.yml`. The difference is that `prod-test` will now include:

- `api-prod-test`
- `wechat-bridge-prod-test`
- `mongodb`
- `meilisearch`

This keeps the entrypoint unchanged for developers while making the local production-style environment capable of manual WeChat verification.

### Compose Wiring

`docker-compose.dev.yml` will define a new `wechat-bridge-prod-test` service with these properties:

- image: `librechat-local:test`
- profile: `prod-test`
- depends on `api-prod-test`
- shares `.env` and `./logs`
- runs `require('/app/packages/api/dist/index.js').startWeChatBridge()`
- does not publish host ports

`api-prod-test` will gain:

- `WECHAT_BRIDGE_URL=http://wechat-bridge-prod-test:3091`

`wechat-bridge-prod-test` will gain:

- `WECHAT_BRIDGE_PORT=3091`
- `WECHAT_BRIDGE_LIBRECHAT_URL=http://api-prod-test:3080`

This mirrors the production split while keeping the local host surface limited to the main web app.

### Script Behavior

`deploy.sh` should keep using `docker compose -f docker-compose.dev.yml --profile prod-test up -d`, but its local-test messaging and log following should reflect the larger stack:

- startup text should state that the local production-test environment now includes the WeChat bridge
- `logs -f` should follow both `api-prod-test` and `wechat-bridge-prod-test`
- existing cleanup behavior should remain unchanged, so Ctrl+C still tears down the local-test stack cleanly

### Testing Strategy

Test-first coverage should prove the compose contract before implementation:

1. add a focused regression test that inspects `docker-compose.dev.yml`
2. assert that the `prod-test` profile includes `wechat-bridge-prod-test`
3. assert that `api-prod-test` sets `WECHAT_BRIDGE_URL` to the bridge service
4. assert that `wechat-bridge-prod-test` sets `WECHAT_BRIDGE_LIBRECHAT_URL` back to `api-prod-test`

After the regression test goes red and the compose changes go green, run a real `./deploy.sh --local-test` smoke check and verify:

- `LibreChat-prod-test` is up
- `wechat-bridge-prod-test` is up
- `http://localhost:3080` returns success

## Files

- `docker-compose.dev.yml`
  - add the local `wechat-bridge-prod-test` service and API bridge wiring
- `deploy.sh`
  - update local-test messaging and log following for the bridge-enabled stack
- `tests` or existing shell-oriented test location
  - add a focused regression test for the `prod-test` compose wiring

## Risks

- If the bridge depends on secrets missing from local `.env`, the stack may boot but binding will still fail at runtime
- If the regression test is too tied to YAML formatting instead of resolved config, harmless reformatting could cause noise
- If the bridge service name differs from the API env wiring, local bind start will silently point at a dead URL

## Acceptance Criteria

- Running `./deploy.sh --local-test` starts a local API container and a local WeChat bridge container without any extra flags
- The API container is configured to call the local bridge service instead of `localhost:3091`
- The bridge container is configured to call back into the local API container instead of host `localhost`
- Local-test logs show both app and bridge output
- A developer can use the existing website WeChat bind flow on `http://localhost:3080` and manually continue testing from there
