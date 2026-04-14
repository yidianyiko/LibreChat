const {
  DEFAULT_PROMPT_DATE_PLACEHOLDER,
  DEFAULT_PRESET_ID,
  DEFAULT_PRESET_CONFIG,
  buildDefaultPresetConfig,
  buildDefaultPromptText,
  buildWebsiteDefaultPromptPrefix,
  enrichWebsiteModelSpecs,
} = require('../../../../config/default-preset');

describe('default preset helpers', () => {
  it('builds the canonical default prompt text with the requested GPT-4o wording', () => {
    const prompt = buildDefaultPromptText('2026-04-14');

    expect(prompt).toContain(
      'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4o architecture.',
    );
    expect(prompt).toContain('Knowledge cutoff: 2024-06');
    expect(prompt).toContain('Current date: 2026-04-14');
    expect(prompt).toContain('Image input capabilities: Enabled');
    expect(prompt).toContain('Personality: v2');
    expect(prompt).toContain('Engage warmly yet honestly with the user.');
  });

  it('builds website and fallback preset values from the same canonical prompt text', () => {
    const promptPrefix = buildWebsiteDefaultPromptPrefix('2026-04-14');
    const preset = buildDefaultPresetConfig('2026-04-14');

    expect(promptPrefix).toBe(buildDefaultPromptText('2026-04-14'));
    expect(preset).toMatchObject({
      presetId: DEFAULT_PRESET_ID,
      title: 'GPT-4o Default',
      endpoint: 'openAI',
      model: 'gpt-4o',
      promptPrefix,
      system: promptPrefix,
    });
  });

  it('uses a runtime date placeholder in the exported default preset config', () => {
    expect(DEFAULT_PRESET_CONFIG.promptPrefix).toContain(
      `Current date: ${DEFAULT_PROMPT_DATE_PLACEHOLDER}`,
    );
    expect(DEFAULT_PRESET_CONFIG.system).toBe(DEFAULT_PRESET_CONFIG.promptPrefix);
  });

  it('enriches only the default openAI website model spec when promptPrefix is missing', () => {
    const modelSpecs = {
      prioritize: true,
      list: [
        {
          name: 'gpt-4o-default',
          label: 'GPT-4o Default',
          default: true,
          preset: {
            endpoint: 'openAI',
            model: 'gpt-4o',
          },
        },
        {
          name: 'gpt-4o-mini',
          label: 'GPT-4o Mini',
          preset: {
            endpoint: 'openAI',
            model: 'gpt-4o-mini',
          },
        },
      ],
    };

    const result = enrichWebsiteModelSpecs(modelSpecs);

    expect(result.list[0].preset.promptPrefix).toContain(
      `Current date: ${DEFAULT_PROMPT_DATE_PLACEHOLDER}`,
    );
    expect(result.list[0].preset.system).toBe(result.list[0].preset.promptPrefix);
    expect(result.list[1]).toEqual(modelSpecs.list[1]);
  });

  it('maps a default openAI website model spec system field into promptPrefix', () => {
    const modelSpecs = {
      prioritize: true,
      list: [
        {
          name: 'gpt-4o-default',
          label: 'GPT-4o Default',
          default: true,
          preset: {
            endpoint: 'openAI',
            model: 'gpt-4o',
            system: 'system-only default prompt',
          },
        },
      ],
    };

    const result = enrichWebsiteModelSpecs(modelSpecs);

    expect(result.list[0].preset.promptPrefix).toBe('system-only default prompt');
    expect(result.list[0].preset.system).toBe('system-only default prompt');
  });

  it('preserves an explicit website promptPrefix on the default openAI model spec', () => {
    const modelSpecs = {
      prioritize: true,
      list: [
        {
          name: 'gpt-4o-default',
          label: 'GPT-4o Default',
          default: true,
          preset: {
            endpoint: 'openAI',
            model: 'gpt-4o',
            promptPrefix: 'explicit prompt',
          },
        },
      ],
    };

    const result = enrichWebsiteModelSpecs(modelSpecs);

    expect(result.list[0].preset.promptPrefix).toBe('explicit prompt');
  });

  it('keeps the exported default preset config aligned with the canonical builder', () => {
    expect(DEFAULT_PRESET_CONFIG).toMatchObject(buildDefaultPresetConfig());
  });
});
