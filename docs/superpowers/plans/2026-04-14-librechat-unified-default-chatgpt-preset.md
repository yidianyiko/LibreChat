# LibreChat Unified Default ChatGPT Preset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the website default chat path and the WeChat integration use one canonical ChatGPT-style default preset with dynamic date support and guaranteed runtime delivery.

**Architecture:** Centralize the canonical default preset text in `config/default-preset.js`, then adapt each entry path to the field it actually consumes. The website startup config will enrich the default model spec with `promptPrefix`, while the WeChat runtime will continue to support fallback conversation creation and also guarantee the effective runtime prompt is present on send.

**Tech Stack:** Node.js, CommonJS, TypeScript, Jest, React hook startup config, Express route wiring, `@librechat/api` WeChat helpers

---

## File Map

- Modify: `config/default-preset.js`
  - Canonical default prompt builder, dynamic date helper, reusable website and WeChat preset builders.
- Create: `api/server/services/__tests__/default-preset.spec.js`
  - Direct unit coverage for canonical prompt text and dynamic config builders.
- Modify: `packages/data-schemas/src/app/specs.ts`
  - Enrich default website model specs with canonical `promptPrefix`.
- Create: `packages/data-schemas/src/app/specs.spec.ts`
  - Unit coverage for model spec enrichment behavior.
- Modify: `packages/api/src/wechat/presets.ts`
  - Shared WeChat preset/runtime fallback resolution logic.
- Modify: `packages/api/src/wechat/__tests__/service.test.ts`
  - Unit coverage for WeChat preset/runtime fallback behavior.
- Modify: `api/server/routes/wechat.js`
  - Route-level fallback builder and send-path runtime prompt enforcement.
- Modify: `api/server/routes/__tests__/wechat.spec.js`
  - Regression coverage for fallback conversation creation and route runtime prompt mapping.

### Task 1: Build Canonical Default Preset Helpers

**Files:**
- Modify: `config/default-preset.js`
- Create: `api/server/services/__tests__/default-preset.spec.js`

- [ ] **Step 1: Write the failing helper tests**

```js
const {
  buildDefaultPromptText,
  buildDefaultPresetConfig,
  buildWebsiteDefaultPromptPrefix,
} = require('../../../../config/default-preset');

describe('default preset helpers', () => {
  it('builds the canonical prompt text with Personality: v2 and GPT-4o architecture wording', () => {
    const prompt = buildDefaultPromptText('2026-04-14');

    expect(prompt).toContain('based on the GPT-4o architecture.');
    expect(prompt).toContain('Knowledge cutoff: 2024-06');
    expect(prompt).toContain('Current date: 2026-04-14');
    expect(prompt).toContain('Personality: v2');
  });

  it('builds a website promptPrefix and WeChat-compatible preset config from the same canonical text', () => {
    const preset = buildDefaultPresetConfig('2026-04-14');

    expect(buildWebsiteDefaultPromptPrefix('2026-04-14')).toBe(preset.promptPrefix);
    expect(preset.system).toBe(preset.promptPrefix);
    expect(preset.model).toBe('gpt-4o');
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `cd api && npx jest server/services/__tests__/default-preset.spec.js --runInBand`
Expected: `FAIL` because the new helper exports do not exist yet.

- [ ] **Step 3: Implement the canonical helper exports**

```js
function getDefaultPromptDate(date = new Date()) {
  return typeof date === 'string' ? date : date.toISOString().split('T')[0];
}

function buildDefaultPromptText(date) {
  const currentDate = getDefaultPromptDate(date);
  return `You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4o architecture.
Knowledge cutoff: 2024-06
Current date: ${currentDate}

Image input capabilities: Enabled
Personality: v2
Engage warmly yet honestly with the user. Be direct; avoid ungrounded or sycophantic flattery. Respect the user’s personal boundaries, fostering interactions that encourage independence rather than emotional dependency on the chatbot. Maintain professionalism and grounded honesty that best represents OpenAI and its values.`;
}

function buildDefaultPresetConfig(date) {
  const prompt = buildDefaultPromptText(date);
  return {
    ...STATIC_DEFAULT_PRESET_FIELDS,
    promptPrefix: prompt,
    system: prompt,
  };
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `cd api && npx jest server/services/__tests__/default-preset.spec.js --runInBand`
Expected: `PASS`

- [ ] **Step 5: Commit the shared helper change**

```bash
git add config/default-preset.js api/server/services/__tests__/default-preset.spec.js
git commit -m "refactor: centralize default chatgpt preset helpers"
```

### Task 2: Enrich Website Default Model Specs With Canonical PromptPrefix

**Files:**
- Modify: `packages/data-schemas/src/app/specs.ts`
- Create: `packages/data-schemas/src/app/specs.spec.ts`

- [ ] **Step 1: Write the failing model spec enrichment test**

```ts
import { processModelSpecs } from './specs';

describe('processModelSpecs', () => {
  it('adds the canonical promptPrefix to the default openAI model spec when it is missing', () => {
    const result = processModelSpecs(
      undefined,
      {
        prioritize: true,
        list: [
          {
            name: 'gpt-4o-2024-11-20',
            default: true,
            preset: { endpoint: 'openAI', model: 'gpt-4o-2024-11-20' },
          },
        ],
      },
      undefined,
    );

    expect(result?.list[0].preset?.promptPrefix).toContain('Personality: v2');
    expect(result?.list[0].preset?.promptPrefix).toContain('Current date:');
  });
});
```

- [ ] **Step 2: Run the model spec test to verify it fails**

Run: `cd packages/data-schemas && npx jest src/app/specs.spec.ts --runInBand`
Expected: `FAIL` because `processModelSpecs` does not enrich the default preset yet.

- [ ] **Step 3: Implement default spec enrichment**

```ts
const shouldInjectWebsiteDefaultPrompt = Boolean(
  spec.default === true &&
  currentEndpoint === EModelEndpoint.openAI &&
  spec.preset?.promptPrefix == null,
);

modelSpecs.push({
  ...spec,
  preset: shouldInjectWebsiteDefaultPrompt
    ? {
        ...spec.preset,
        promptPrefix: buildWebsiteDefaultPromptPrefix(),
      }
    : spec.preset,
});
```

- [ ] **Step 4: Run the model spec test to verify it passes**

Run: `cd packages/data-schemas && npx jest src/app/specs.spec.ts --runInBand`
Expected: `PASS`

- [ ] **Step 5: Commit the website default-spec change**

```bash
git add packages/data-schemas/src/app/specs.ts packages/data-schemas/src/app/specs.spec.ts
git commit -m "feat: inject canonical prompt into default model spec"
```

### Task 3: Guarantee WeChat Runtime Prompt Delivery

**Files:**
- Modify: `packages/api/src/wechat/presets.ts`
- Modify: `packages/api/src/wechat/__tests__/service.test.ts`
- Modify: `api/server/routes/wechat.js`
- Modify: `api/server/routes/__tests__/wechat.spec.js`

- [ ] **Step 1: Write the failing WeChat tests**

```ts
it('falls back to the canonical preset promptPrefix when the conversation only has system text', async () => {
  const resolved = await resolveWeChatPreset({
    getUserDefaultPreset: async () => null,
    fallbackPreset: {
      endpoint: 'openAI',
      model: 'gpt-4o',
      promptPrefix: 'canonical',
      system: 'canonical',
      title: 'GPT-4o Default',
    },
  });

  expect(resolved.promptPrefix).toBe('canonical');
});
```

```js
it('maps canonical fallback instructions into promptPrefix for WeChat runtime sends', async () => {
  const endpointOption = capturedRouteDeps.buildMessageEndpointOption(
    {},
    { endpoint: 'openAI', model: 'gpt-4o', system: DEFAULT_PRESET_CONFIG.system },
  );

  expect(endpointOption.model_parameters.promptPrefix).toBe(DEFAULT_PRESET_CONFIG.promptPrefix);
});
```

- [ ] **Step 2: Run the WeChat tests to verify they fail**

Run: `cd packages/api && npx jest src/wechat/__tests__/service.test.ts --runInBand`
Expected: `FAIL`

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
Expected: `FAIL`

- [ ] **Step 3: Implement WeChat fallback/runtime enforcement**

```ts
export function ensureWeChatRuntimePrompt<T extends { promptPrefix?: string | null; system?: string | null }>(
  preset: T,
  fallbackPrompt: string,
): T {
  if (preset.promptPrefix) {
    return preset;
  }

  return {
    ...preset,
    promptPrefix: preset.system ?? fallbackPrompt,
  };
}
```

```js
const fallbackPromptPrefix = buildWebsiteDefaultPromptPrefix();
const runtimeConversation = ensureWeChatRuntimePrompt(conversation, fallbackPromptPrefix);

return buildOptions(req, runtimeConversation.endpoint || 'openAI', {
  ...runtimeConversation,
  promptPrefix: runtimeConversation.promptPrefix || fallbackPromptPrefix,
});
```

- [ ] **Step 4: Run the WeChat tests to verify they pass**

Run: `cd packages/api && npx jest src/wechat/__tests__/service.test.ts --runInBand`
Expected: `PASS`

Run: `cd api && npx jest server/routes/__tests__/wechat.spec.js --runInBand`
Expected: `PASS`

- [ ] **Step 5: Commit the WeChat runtime fix**

```bash
git add packages/api/src/wechat/presets.ts packages/api/src/wechat/__tests__/service.test.ts api/server/routes/wechat.js api/server/routes/__tests__/wechat.spec.js
git commit -m "fix: unify wechat runtime default prompt delivery"
```

### Task 4: Integration Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the targeted verification suite**

Run: `cd /data/projects/LibreChat && npm exec --workspaces=false -- jest api/server/services/__tests__/default-preset.spec.js api/server/routes/__tests__/wechat.spec.js packages/data-schemas/src/app/specs.spec.ts packages/api/src/wechat/__tests__/service.test.ts --runInBand`
Expected: all targeted tests pass.

- [ ] **Step 2: Inspect the final diff**

Run: `git diff -- config/default-preset.js packages/data-schemas/src/app/specs.ts packages/api/src/wechat/presets.ts api/server/routes/wechat.js`
Expected: only the canonical default preset, website default spec enrichment, and WeChat runtime prompt enforcement changes appear.

- [ ] **Step 3: Commit any final integration adjustments**

```bash
git add config/default-preset.js packages/data-schemas/src/app/specs.ts packages/api/src/wechat/presets.ts api/server/routes/wechat.js api/server/services/__tests__/default-preset.spec.js packages/data-schemas/src/app/specs.spec.ts packages/api/src/wechat/__tests__/service.test.ts api/server/routes/__tests__/wechat.spec.js
git commit -m "feat: unify default chatgpt preset across website and wechat"
```
