# Token Pricing Seeding Script

## 概述

`seed-token-pricing.js` 脚本用于将 `api/models/tx.js` 中硬编码的所有模型费率批量导入到 MongoDB 的 `TokenPricing` 集合中。

这使得你可以：
- 将硬编码的价格同步到数据库
- 在服务器上快速初始化价格数据
- 统一管理所有模型的费率

## 使用方法

### 基本用法

```bash
# 预览将要导入的数据（推荐首次运行）
node config/seed-token-pricing.js --dry-run

# 执行实际导入（跳过已存在的记录）
node config/seed-token-pricing.js

# 强制更新所有记录（包括已存在的）
node config/seed-token-pricing.js --force

# 清空数据库后重新导入
node config/seed-token-pricing.js --clear
```

### 选项说明

| 选项 | 说明 |
|------|------|
| `--dry-run` | 模拟运行，不实际修改数据库 |
| `--force` | 强制更新已存在的记录 |
| `--clear` | 导入前清空所有现有记录 |

## 工作流程

1. **连接数据库** - 使用 `MONGO_URI` 环境变量连接
2. **准备数据** - 从 `tx.js` 读取所有模型费率
3. **自动分类** - 根据模型名称自动推断提供商
4. **批量导入** - 逐个插入或更新记录
5. **刷新缓存** - 自动重新加载 `TokenPricingCache`

## 数据结构

脚本会为每个模型创建如下记录：

```javascript
{
  modelPattern: "gpt-4o",           // 模型名称匹配模式
  provider: "openai",               // 提供商（自动推断）
  inputRate: 2.5,                   // 输入费率（$/1M tokens）
  outputRate: 10.0,                 // 输出费率（$/1M tokens）
  longContextThreshold: 200000,     // 长上下文阈值（可选）
  longContextInputRate: 10.0,       // 长上下文输入费率（可选）
  longContextOutputRate: 37.5,      // 长上下文输出费率（可选）
  isActive: true                    // 是否启用
}
```

## 提供商映射

脚本会根据模型名称自动推断提供商：

| 模型前缀 | 提供商 |
|----------|--------|
| `gpt-`, `o1`, `o3`, `o4` | openai |
| `claude-` | anthropic |
| `gemini-`, `gemma-` | google |
| `grok` | xai |
| `mistral`, `mixtral`, `codestral` | mistral |
| `deepseek` | deepseek |
| `kimi`, `moonshot` | moonshot |
| `command` | cohere |
| `qwen`, `qwq` | alibaba |
| `glm` | zhipu |
| `llama` | meta |
| `nova-`, `titan-` | aws |
| `j2-`, `jamba` | ai21 |

## 输出示例

```
================================================================================
Token Pricing Seeding Script
================================================================================

Connecting to MongoDB: mongodb://127.0.0.1:27017/LibreChat
✓ Connected to MongoDB

Prepared 180 pricing records

Processing records...

  ✓ Inserted: gpt-4o (openai)
  ✓ Inserted: claude-opus-4-6 (anthropic) [Long Context]
  ✓ Inserted: gemini-2.5-flash (google)
  - Skip: gpt-4o-mini (openai) - already exists
  ...

================================================================================
Summary:
================================================================================
Total records:    180
Inserted:         175
Updated:          0
Skipped:          5
Errors:           0
================================================================================

Invalidating and reloading cache...
✓ Cache reloaded

✓ Disconnected from MongoDB

✓ Seeding completed successfully
```

## 服务器部署步骤

### 1. 上传脚本到服务器

```bash
# 通过 git 部署（推荐）
git pull origin main

# 或手动上传
scp config/seed-token-pricing.js user@server:/path/to/LibreChat/config/
```

### 2. 在服务器上运行

```bash
# SSH 连接到服务器
ssh user@server

# 进入 LibreChat 目录
cd /path/to/LibreChat

# 确保依赖已安装
npm install

# 预览导入（推荐）
node config/seed-token-pricing.js --dry-run

# 执行导入
node config/seed-token-pricing.js

# 查看结果
# 应该看到 "✓ Seeding completed successfully"
```

### 3. 验证导入结果

访问管理面板 `https://your-domain.com/d/token-pricing` 查看导入的费率。

或通过 MongoDB 查询：

```bash
# 连接到 MongoDB
docker exec -it chat-mongodb mongosh LibreChat

# 查看导入的记录数
db.tokenpricing.countDocuments()

# 查看部分记录
db.tokenpricing.find().limit(5).pretty()

# 按提供商统计
db.tokenpricing.aggregate([
  { $group: { _id: "$provider", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

## 环境变量

脚本使用以下环境变量：

```bash
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat  # MongoDB 连接字符串（可选，默认值）
```

如果需要连接到远程数据库，请设置环境变量：

```bash
export MONGO_URI="mongodb://username:password@host:27017/LibreChat"
node config/seed-token-pricing.js
```

## 常见问题

### Q: 脚本会覆盖我手动设置的价格吗？

A: 默认不会。脚本会跳过已存在的记录。如果需要覆盖，使用 `--force` 选项。

### Q: 可以多次运行吗？

A: 可以。脚本是幂等的，多次运行是安全的。

### Q: 导入后立即生效吗？

A: 是的。脚本会自动刷新 `TokenPricingCache`，新的费率立即生效。

### Q: 如何只更新特定模型的价格？

A: 使用 Admin Panel 的 UI 界面（`/d/token-pricing`）手动编辑更高效。

### Q: 脚本失败了怎么办？

A: 检查：
1. MongoDB 是否正在运行
2. `MONGO_URI` 是否正确
3. 网络连接是否正常
4. 是否有足够的磁盘空间

## 后续维护

导入初始数据后，建议：

1. **使用 Admin Panel 管理** - 通过 Web 界面管理价格更直观
2. **定期备份** - 备份 `tokenpricing` 集合
3. **版本控制** - 导出为 JSON 并纳入版本控制（可选）

```bash
# 导出当前价格配置
mongoexport --db=LibreChat --collection=tokenpricing --out=token-pricing-backup.json

# 导入备份
mongoimport --db=LibreChat --collection=tokenpricing --file=token-pricing-backup.json
```

## 技术细节

### 数据来源

- `bedrockValues` - AWS Bedrock 模型价格
- `tokenValues` - OpenAI、Anthropic、Google 等主流模型价格
- `premiumTokenValues` - 长上下文定价（如 Claude Opus 4.6）

### 模式匹配

脚本使用 `includes()` 匹配，支持模糊匹配：
- `gpt-4o` 匹配 `gpt-4o-2024-05-13`
- `claude-3-sonnet` 匹配 `claude-3-sonnet-20240229`

### 数据优先级

导入的数据会成为**高优先级**费率源：

```
1. endpointTokenConfig（librechat.yaml 自定义）
2. TokenPricing（数据库，本脚本导入）⬅️ 这里
3. tokenValues（tx.js 硬编码）
4. defaultRate（6.0 兜底）
```
