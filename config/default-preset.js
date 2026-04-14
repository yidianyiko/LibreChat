const path = require('path');

const {
  DEFAULT_PRESET_ID,
  DEFAULT_PROMPT_DATE_PLACEHOLDER,
  DEFAULT_PRESET_CONFIG,
  GPT4O_SYSTEM_PROMPT,
  buildDefaultPresetConfig,
  buildDefaultPromptText,
  buildWebsiteDefaultPromptPrefix,
  enrichWebsiteModelSpecs,
  getDefaultPromptDate,
} = require(path.resolve(__dirname, '..', 'packages', 'data-provider', 'dist', 'index.js'));

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
