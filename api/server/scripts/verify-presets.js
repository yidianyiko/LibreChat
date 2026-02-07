const path = require('path');
const mongoose = require('mongoose');
require('module-alias')({ base: path.resolve(__dirname, '..', '..', '..', 'api') });
const connect = require(path.resolve(__dirname, '..', '..', '..', 'config', 'connect'));
const { Preset } = require('@librechat/data-schemas').createModels(mongoose);

(async () => {
  try {
    await connect();
    const presets = await Preset.find({ defaultPreset: true }).lean();
    console.log('\n=== 默认预设列表 ===\n');
    presets.forEach((preset, index) => {
      console.log(`预设 ${index + 1}:`);
      console.log(`  - 标题: ${preset.title}`);
      console.log(`  - 模型: ${preset.model}`);
      console.log(`  - Endpoint: ${preset.endpoint}`);
      console.log(`  - Temperature: ${preset.temperature}`);
      console.log(`  - Top P: ${preset.top_p}`);
      console.log(`  - Max Tokens: ${preset.maxTokens}`);
      console.log(`  - 系统提示词长度: ${preset.system ? preset.system.length : 0} 字符`);
      console.log(`  - 默认预设: ${preset.defaultPreset}`);
      console.log(`  - 用户 ID: ${preset.user}`);
      console.log('');
    });
    console.log(`总计: ${presets.length} 个默认预设\n`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
