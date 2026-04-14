/**
 * Global default preset configuration
 * Replicates the ChatGPT GPT-4o experience
 */

const DEFAULT_PRESET_ID = 'global-default-gpt4o';
const DEFAULT_PROMPT_DATE_PLACEHOLDER = '{{current_date_ymd}}';

const DEFAULT_PRESET_STATIC_FIELDS = Object.freeze({
  presetId: DEFAULT_PRESET_ID,
  title: 'GPT-4o Default',
  defaultPreset: true,
  order: 0,
  endpoint: 'openAI',
  model: 'gpt-4o',
  temperature: 1.0,
  top_p: 1.0,
  frequency_penalty: 0,
  presence_penalty: 0,
  maxTokens: 4096,
  resendImages: false,
  imageDetail: 'auto',
});

function getDefaultPromptDate(date = new Date()) {
  return typeof date === 'string' ? date : date.toISOString().split('T')[0];
}

function getPromptText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function buildDefaultPromptText(date = DEFAULT_PROMPT_DATE_PLACEHOLDER) {
  const currentDate = typeof date === 'string' ? date : getDefaultPromptDate(date);

  return `You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4o architecture.
Knowledge cutoff: 2024-06
Current date: ${currentDate}

Image input capabilities: Enabled
Personality: v2
Engage warmly yet honestly with the user. Be direct; avoid ungrounded or sycophantic flattery. Respect the user's personal boundaries, fostering interactions that encourage independence rather than emotional dependency on the chatbot. Maintain professionalism and grounded honesty that best represents OpenAI and its values.`;
}

function buildWebsiteDefaultPromptPrefix(date) {
  return buildDefaultPromptText(date);
}

function buildDefaultPresetConfig(date = DEFAULT_PROMPT_DATE_PLACEHOLDER) {
  const promptText = buildDefaultPromptText(date);

  return {
    ...DEFAULT_PRESET_STATIC_FIELDS,
    promptPrefix: promptText,
    system: promptText,
  };
}

function enrichWebsiteModelSpecs(modelSpecs) {
  if (!modelSpecs?.list?.length) {
    return modelSpecs;
  }

  const canonicalPrompt = buildWebsiteDefaultPromptPrefix();
  let hasChanges = false;
  const list = modelSpecs.list.map((spec) => {
    const promptPrefix = getPromptText(spec?.preset?.promptPrefix);
    const system = getPromptText(spec?.preset?.system);
    const shouldInject =
      spec?.default === true && spec?.preset?.endpoint === 'openAI' && promptPrefix == null;

    if (!shouldInject) {
      return spec;
    }

    hasChanges = true;
    const nextPromptPrefix = system ?? canonicalPrompt;

    return {
      ...spec,
      preset: {
        ...spec.preset,
        promptPrefix: nextPromptPrefix,
        system: system ?? nextPromptPrefix,
      },
    };
  });

  return hasChanges ? { ...modelSpecs, list } : modelSpecs;
}

const GPT4O_SYSTEM_PROMPT = buildDefaultPromptText(DEFAULT_PROMPT_DATE_PLACEHOLDER);
const DEFAULT_PRESET_CONFIG = buildDefaultPresetConfig(DEFAULT_PROMPT_DATE_PLACEHOLDER);

module.exports = {
  DEFAULT_PRESET_ID,
  DEFAULT_PROMPT_DATE_PLACEHOLDER,
  DEFAULT_PRESET_CONFIG,
  GPT4O_SYSTEM_PROMPT,
  buildDefaultPresetConfig,
  buildDefaultPromptText,
  buildWebsiteDefaultPromptPrefix,
  enrichWebsiteModelSpecs,
  getDefaultPromptDate,
};
