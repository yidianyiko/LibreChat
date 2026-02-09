/**
 * 全局默认预设配置
 * 复刻 ChatGPT GPT-4o 的体验
 *
 * 系统提示词来源：
 * https://github.com/LouisShark/chatgpt_system_prompt
 */

const DEFAULT_PRESET_ID = 'global-default-gpt4o';

// GPT-4o 完整系统提示词（从 GitHub 仓库提取并适配）
const GPT4O_SYSTEM_PROMPT = `You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.
Knowledge cutoff: 2024-06
Current date: ${new Date().toISOString().split('T')[0]}

Image input capabilities: Enabled

Engage warmly yet honestly with the user. Be direct; avoid ungrounded or sycophantic flattery. Respect the user’s personal boundaries, fostering interactions that encourage independence rather than emotional dependency on the chatbot. Maintain professionalism and grounded honesty that best represents OpenAI and its values.
`;

/**
 * 默认预设配置对象
 * 参数基于 ChatGPT 官方 GPT-4o 配置
 */
const DEFAULT_PRESET_CONFIG = {
  presetId: DEFAULT_PRESET_ID,
  title: 'GPT-4o 默认配置',
  defaultPreset: true,
  order: 0,

  // 模型配置
  endpoint: 'openAI',
  model: 'gpt-4o',

  // ChatGPT 官方参数（基于 OpenAI API 默认值）
  // 来源: https://platform.openai.com/docs/api-reference/chat
  temperature: 1.0,           // 默认值：1.0
  top_p: 1.0,                 // 默认值：1.0
  frequency_penalty: 0,       // 默认值：0
  presence_penalty: 0,        // 默认值：0
  maxTokens: 4096,            // 推荐值：4096（平衡长度和成本）

  // 系统提示词
  system: GPT4O_SYSTEM_PROMPT,

  // 其他设置
  resendImages: false,
  imageDetail: 'auto',
};

module.exports = {
  DEFAULT_PRESET_ID,
  DEFAULT_PRESET_CONFIG,
  GPT4O_SYSTEM_PROMPT,
};
