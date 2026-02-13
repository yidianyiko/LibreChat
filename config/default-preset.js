/**
 * Global default preset configuration
 * Replicates the ChatGPT GPT-4o experience
 *
 * System prompt source:
 * https://github.com/LouisShark/chatgpt_system_prompt
 */

const DEFAULT_PRESET_ID = 'global-default-gpt4o';

// GPT-4o full system prompt (extracted and adapted from GitHub repo)
const GPT4O_SYSTEM_PROMPT = `You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.
Knowledge cutoff: 2024-06
Current date: ${new Date().toISOString().split('T')[0]}

Image input capabilities: Enabled

Engage warmly yet honestly with the user. Be direct; avoid ungrounded or sycophantic flattery. Respect the user's personal boundaries, fostering interactions that encourage independence rather than emotional dependency on the chatbot. Maintain professionalism and grounded honesty that best represents OpenAI and its values.
`;

/**
 * Default preset configuration object
 * Parameters based on official ChatGPT GPT-4o configuration
 */
const DEFAULT_PRESET_CONFIG = {
  presetId: DEFAULT_PRESET_ID,
  title: 'GPT-4o Default',
  defaultPreset: true,
  order: 0,

  // Model configuration
  endpoint: 'openAI',
  model: 'gpt-4o',

  // Official ChatGPT parameters (based on OpenAI API defaults)
  // Source: https://platform.openai.com/docs/api-reference/chat
  temperature: 1.0,           // Default: 1.0
  top_p: 1.0,                 // Default: 1.0
  frequency_penalty: 0,       // Default: 0
  presence_penalty: 0,        // Default: 0
  maxTokens: 4096,            // Recommended: 4096 (balance length and cost)

  // System prompt
  system: GPT4O_SYSTEM_PROMPT,

  // Other settings
  resendImages: false,
  imageDetail: 'auto',
};

module.exports = {
  DEFAULT_PRESET_ID,
  DEFAULT_PRESET_CONFIG,
  GPT4O_SYSTEM_PROMPT,
};
