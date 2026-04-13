# 2026-04-13 Upstream Selective Sync

## Summary

This branch selectively backports low-risk, high-value upstream fixes from `upstream/main` into the local `main` line without attempting a full upstream merge.

The full merge evaluation showed that a direct sync would be expensive and conflict-heavy across agents, navigation, chat input, and `data-schemas`. Instead of merging all of `upstream/main`, this branch pulls in focused fixes that are useful for the current product and architecture.

## Included Commits

These commits are included on top of local `main`:

- `64e6aa113` `fix: Alias Mimetype text/x-markdown to text/markdown`
- `842607329` `fix: Restore Primary Action Button Visibility in Light Mode`
- `13a9d7b1c` `fix: Use Resolved Provider for Agent Token Lookup on Custom Endpoints`
- `cb9f4323d` `fix: Properly Restore Draft Text When Switching Conversations`
- `a5cc2e077` `fix: Respect supportedMimeTypes Config in File Picker Accept Filter`
- `4670c5e72` `fix: Prevent @librechat/client useLocalize from Overwriting Host App Language State`
- `c77dffdf9` `test: align agent initialize expectation with local reserve ratio`
- `9ade466a7` `feat: Model-Aware Bedrock Document Size Validation`
- `226a051f1` `fix: Route Unrecognized File Types via supportedMimeTypes Config`
- `cb3457b44` `fix: Resolve User-Provided API Key in Agents API Flow`
- `fa67e0080` `fix: MCP Tool Misclassification from Action Delimiter Collision`
- `00d8ea139` `fix: Sandpack ExternalResources for Static HTML Artifact Previews`
- `2538904e0` `fix: Message Icon Flickering from Context-Triggered Re-renders`
- `19c0ca963` `refactor: Fast-Fail MCP Tool Discovery on 401 for Non-OAuth Servers`
- `47944ef9f` `fix: Invalidate Message Cache on Stream 404 Instead of Showing Error`
- `742c92837` `fix: Snapshot Options to Prevent Mid-Await Client Disposal Crash`
- `4b1ff1daf` `fix: Resolve MeiliSearch Startup Sync Failure from Model Loading Order`
- `f7565a99d` `fix: Robust MCP OAuth Detection in Tool-Call Flow`
- `6ae7366fc` `fix: add optional MessagesView fallbacks for search tool UI`
- `2e8ab59b7` `fix: Specify Explicit Primary Key for Meilisearch Document Operations`
- `2061baf5f` `fix: pass recursionLimit to OpenAI-compatible agents API`
- `9c41f8075` `fix: backport config schema and account deletion guards`

## Local Adaptations

Some upstream fixes were integrated with small local adjustments instead of a literal cherry-pick:

- `c77dffdf9` adjusts the agents initialize test to match the current branch's local reserve-ratio behavior.
- `6ae7366fc` brings in the search-tool UI fallback needed by the current branch without replacing the existing `ToolCallInfo` path.
- `2061baf5f` ports the OpenAI-compatible agents `recursionLimit` fix into the current JS/TS split instead of depending on upstream files that are not present locally.
- `9c41f8075` combines two approved low-cost follow-ups:
  - nested `addParams` support in config schema, while keeping `web_search` constrained to boolean
  - hiding the delete-account UI when `ALLOW_ACCOUNT_DELETION=false`, while preserving local admin override behavior

## Why We Stopped Here

The remaining upstream work was evaluated and intentionally not included:

- Full `upstream/main` merge remains too expensive for this branch because the diff still hits local hotspots in agents, nav, chat input, routes, and `data-schemas`.
- `8ed0bcf5` MCP OAuth client-registration reuse was trial-applied successfully enough to show it is technically mergeable, but it was skipped because the current deployment does not use MCP.
- `452af50e` Redis event sequence atomization was skipped because there is no active multi-replica SSE ordering issue to solve.
- `1a83f36c` model-spec pinning was skipped because the feature is not currently needed.
- The remaining multi-tenant, System Grants, DB-backed config, admin API, and large sidebar/prompts refactors are upgrade projects, not low-risk selective sync candidates.

## Verification Used During Backport

Representative verification commands that were run while building this branch:

- `npm run build:data-provider`
- `cd packages/data-provider && npx jest src/config.spec.ts --ci`
- `cd client && npx jest src/components/Nav/SettingsTabs/Account/__tests__/Account.spec.tsx --ci`
- `cd api && npx jest server/routes/__tests__/config.allowAccountDeletion.spec.js --ci`
- `cd packages/api && npx jest src/agents/__tests__/initialize.test.ts --ci`
- `cd packages/api && npx jest src/mcp/__tests__ --ci`
- `cd client && npx jest src/hooks/Input/useAutoSave.spec.ts --ci`
- `npm run build:client`

## Merge Intent

This branch is intended to merge cleanly back into local `main` as a selective-sync batch, while leaving the larger upstream rebase or merge for a dedicated future effort.
