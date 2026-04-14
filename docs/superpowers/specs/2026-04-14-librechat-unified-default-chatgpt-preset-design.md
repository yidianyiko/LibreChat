# LibreChat Unified Default ChatGPT Preset Design

## Goal

Unify the default ChatGPT-style behavior across the website and WeChat integration so both entry points use the same baseline preset content, including:

- `You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4o architecture.`
- `Knowledge cutoff: 2024-06`
- `Current date: <dynamic date>`
- `Image input capabilities: Enabled`
- `Personality: v2`
- The shared behavioral guidance about warmth, honesty, boundaries, and professionalism.

The website must apply this content as its actual default instructions for normal chat. WeChat must also reliably include the same content on every message, not merely store it once in a fallback conversation document.

## Current State

- A global fallback preset already exists in `config/default-preset.js`, but it stores the default text in `system`.
- The website's normal OpenAI chat path effectively relies on `promptPrefix`, not `system`, for default system-style instructions.
- The website currently prefers `modelSpecs` defaults from `librechat.yaml`, and that default model spec only sets `endpoint` and `model`.
- WeChat fallback conversation creation reuses the global fallback preset, but the send path must still be checked against the actual runtime instructions path.

This creates drift:

- The website and WeChat are not guaranteed to use the same default instructions.
- The current shared default text is missing `Personality: v2`.
- The website default model spec does not currently carry the shared default instructions.

## Requirements

### Functional

- Define one canonical default ChatGPT preset text in the repo.
- The canonical text must include the exact content requested by the user.
- The date line must be generated dynamically at runtime.
- The website's default `modelSpec` preset must include the canonical default instructions in the field that the normal website chat path actually uses.
- WeChat fallback conversations must resolve to the same canonical default content.
- WeChat send behavior must reliably include the canonical default content on every message path.

### Non-Functional

- Avoid duplicating the default text across multiple files.
- Preserve the current default model choice unless the user explicitly requested a model change.
- Do not overwrite user-customized presets or user-selected conversations.
- Keep changes focused on default-resolution and message-build paths.

## Proposed Design

### 1. Canonical default preset builder

Keep a single source of truth in `config/default-preset.js`, but reshape it around an explicit builder/helper instead of a static string-only export.

The helper should produce the canonical default text with:

- the requested `GPT-4o architecture` wording,
- `Knowledge cutoff: 2024-06`,
- a dynamically generated date line,
- `Image input capabilities: Enabled`,
- `Personality: v2`,
- the requested behavioral paragraph.

The helper should return fresh content each time it is called so the date remains current.

### 2. Website default modelSpec integration

Update the default `modelSpecs` entry in `librechat.yaml` so the default preset carries the canonical website instruction field:

- use `promptPrefix` for the website default OpenAI path,
- keep the existing default model selection,
- avoid duplicating the full text in YAML by having startup config enrich the default spec preset from the canonical helper where practical; if the config loading path cannot support that cleanly, explicitly document and implement the smallest safe fallback.

The preferred implementation is runtime enrichment from the canonical helper. That avoids a second hard-coded copy and guarantees the website default tracks the same text as WeChat.

### 3. WeChat fallback and send-path enforcement

Update the WeChat default fallback preset resolution to consume the same canonical helper.

In addition, ensure the WeChat message send path passes the canonical instructions through the field that the downstream agent/runtime actually consumes. If the current runtime only honors `promptPrefix` for effective instructions, WeChat should populate that field from the canonical helper even when the stored conversation also keeps `system` for compatibility.

This requirement is stronger than "new conversation stores the right values." The send path must not depend on stale or missing fields to preserve the shared default instructions.

### 4. Backward-compatible field strategy

Because the repo currently uses both `promptPrefix` and `system` in different paths:

- website normal chat should use `promptPrefix`,
- WeChat fallback documents may retain `system`,
- WeChat runtime should also map the canonical text into the effective instructions path used by the agent stack.

This keeps existing schema expectations intact while making the actual behavior consistent.

## Data Flow

### Website

1. Startup config resolves the default model spec.
2. The default model spec preset is enriched with the canonical default instructions.
3. New website conversations inherit that preset.
4. The normal chat submission path parses the conversation and forwards `promptPrefix`.
5. The model receives the canonical default instructions.

### WeChat

1. WeChat fallback preset resolution asks for the canonical default preset.
2. New fallback conversations store the canonical default fields.
3. On message send, the runtime builds endpoint options from the active conversation.
4. The effective instructions field includes the canonical default text on every send.

## Error Handling

- If runtime enrichment cannot resolve the canonical helper, fail closed to the existing default behavior rather than sending malformed instructions.
- If a conversation already has explicit user instructions, do not override them with fallback defaults.
- Dynamic date generation must always produce a valid string; use the current existing ISO-date pattern already present in the repo.

## Testing Strategy

### Website tests

- Verify the default website model spec resolves with the canonical default instructions.
- Verify the canonical text contains `Personality: v2`.
- Verify the website default path uses `promptPrefix`, not only `system`.

### WeChat tests

- Verify fallback conversation creation still stores the canonical default content.
- Verify the WeChat send path includes the canonical instructions in the effective runtime field.
- Verify the dynamic date line is present and formatted as expected.

### Regression coverage

- Preserve current default model selection for the website.
- Preserve existing behavior for user-owned presets and custom conversations.

## Tradeoffs

### Chosen approach

Use a single canonical default-preset helper and adapt each runtime path to the field it actually consumes.

### Why this is preferred

- One text source instead of separate website and WeChat copies.
- Dynamic date stays consistent everywhere.
- Fixes the current mismatch between stored preset fields and actually effective runtime fields.

### Rejected alternatives

- Duplicating the full text in both YAML and WeChat route code.
  - Rejected because drift is almost guaranteed.
- Only updating WeChat fallback creation.
  - Rejected because it does not guarantee send-time behavior.
- Only updating website `modelSpecs` YAML.
  - Rejected because it leaves WeChat on a separate source and does not guarantee runtime alignment.

## Implementation Scope

Expected files to change:

- `config/default-preset.js`
- `librechat.yaml`
- website startup/default preset resolution code in `client/src/hooks/Config` and-or related config shaping path if needed
- `api/server/routes/wechat.js`
- targeted tests covering website default preset resolution and WeChat runtime behavior

## Success Criteria

- Website new chats default to the requested ChatGPT-style instructions.
- WeChat fallback and every WeChat send use the same requested instructions.
- `Personality: v2` appears in both paths.
- The date line is dynamic.
- The default text is maintained in one canonical source.
