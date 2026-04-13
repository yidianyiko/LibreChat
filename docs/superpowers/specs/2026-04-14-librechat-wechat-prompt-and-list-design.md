# LibreChat WeChat Prompt And List Design

## Goal

Fix two gaps in the WeChat channel:

- WeChat fallback conversations should still inherit the default GPT-4o tone/system prompt instead of sending requests with no default tone guidance.
- `/list` should show only the 10 most recently updated eligible conversations so the command stays short and useful inside WeChat.

## Scope

### In Scope

- WeChat fallback preset resolution when the user's default preset is not eligible for the channel
- Preserving default tone fields during fallback conversation creation
- Limiting `/list` output to the 10 most recent eligible conversations
- Focused Jest coverage for the new fallback and listing behavior

### Out Of Scope

- Changing `/switch` syntax
- Adding a WeChat-only custom prompt
- Changing model support rules for the WeChat channel
- Changing website preset editing UX

## Design

### Prompt Inheritance

The WeChat service already prefers the user's default preset when it is an `openAI` `gpt-4o` family preset. That behavior stays unchanged.

When the user's default preset is missing or ineligible, the WeChat fallback should stop returning a hand-written minimal object and instead return the global default GPT-4o preset configuration. This keeps the existing supported model while also carrying the repo's default `system` prompt and any other safe default tone fields already defined in `config/default-preset.js`.

This means WeChat conversations created from fallback now persist the same baseline prompt behavior as the rest of the default GPT-4o experience, instead of creating a conversation with model-only settings.

### Recent Conversation Listing

`/list` should remain restricted to conversations that are already eligible for WeChat continuation, but it should sort those conversations by descending `updatedAt` before storing the switch snapshot and formatting the reply. After sorting, the service should keep only the first 10 conversations.

This keeps the snapshot order aligned with what the user sees in WeChat, so `/switch 1` still maps to the most recent listed conversation.

### Error Handling

- If a conversation has no usable `updatedAt`, treat it as older than conversations with valid timestamps.
- If fewer than 10 eligible conversations exist, return the full eligible set.
- No new user-facing error messages are needed.

## Files

- `config/default-preset.js`
  - existing global default preset source; reused as the fallback source of truth
- `api/server/routes/wechat.js`
  - replace the inline minimal WeChat fallback preset with a clone of the global default GPT-4o preset
- `packages/api/src/wechat/service.ts`
  - sort eligible conversations by recency and cap `/list` snapshots/results at 10
- `api/server/routes/__tests__/wechat.spec.js`
  - verify fallback conversation creation keeps the default system prompt
- `packages/api/src/wechat/__tests__/service.test.ts`
  - verify `/list` returns and snapshots only the 10 most recent eligible conversations

## Testing

- Add a failing route-level test proving WeChat fallback conversation creation persists the default prompt fields.
- Add a failing service-level test proving `/list` is sorted by recency and capped at 10 items.
- Run focused Jest suites for the changed route and service behavior.
