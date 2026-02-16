# Token Pricing 数据填充完成报告

## 执行摘要

✅ 已成功将 210 条模型费率记录从硬编码配置导入到 MongoDB 数据库

## 导入统计

### 总体数据
- **总记录数**: 210
- **插入成功**: 210
- **更新记录**: 0
- **跳过记录**: 0
- **失败记录**: 0

### 按提供商分布
| 提供商 | 模型数量 |
|--------|---------|
| Meta (Llama) | 44 |
| Moonshot (Kimi) | 28 |
| OpenAI | 26 |
| Alibaba (Qwen) | 22 |
| Anthropic (Claude) | 17 |
| Google (Gemini/Gemma) | 17 |
| xAI (Grok) | 17 |
| Mistral | 13 |
| AWS (Nova/Titan) | 7 |
| Zhipu (GLM) | 7 |
| DeepSeek | 5 |
| Cohere | 4 |
| AI21 | 3 |

## 示例数据

### OpenAI 模型
```json
{
  "modelPattern": "gpt-4o",
  "provider": "openai",
  "inputRate": 2.5,
  "outputRate": 10.0
}
```

### 长上下文定价示例
```json
{
  "modelPattern": "claude-opus-4-6",
  "provider": "anthropic",
  "inputRate": 5.0,
  "outputRate": 25.0,
  "longContextThreshold": 200000,
  "longContextInputRate": 10.0,
  "longContextOutputRate": 37.5
}
```

## 验证结果

✅ MongoDB 连接成功
✅ 数据插入成功
✅ TokenPricingCache 已刷新
✅ 集合 `tokenpricings` 包含 210 条记录

## 文件清单

1. **脚本文件**
   - `config/seed-token-pricing.js` - 数据填充脚本

2. **文档文件**
   - `config/README-seed-token-pricing.md` - 完整使用指南

3. **Git 提交记录**
   ```
   e7e0da3 feat: add seed-token-pricing script to populate DB from hardcoded rates
   b9de15f fix: update seed-token-pricing to use correct module-alias pattern
   3556f58 docs: add comprehensive guide for seed-token-pricing script
   ```

## 服务器部署清单

准备在服务器上运行时，按以下步骤操作：

### 1. 部署代码
```bash
# SSH 到服务器
ssh user@your-server

# 进入项目目录
cd /path/to/LibreChat

# 拉取最新代码
git pull origin main

# 安装依赖（如果尚未安装）
npm install

# 构建 packages（如果尚未构建）
npm run build:packages
```

### 2. 运行脚本
```bash
# 预览将导入的数据（推荐）
node config/seed-token-pricing.js --dry-run

# 执行实际导入
node config/seed-token-pricing.js

# 如果需要更新已存在的记录
node config/seed-token-pricing.js --force
```

### 3. 验证结果
```bash
# 连接到 MongoDB
docker exec -it chat-mongodb mongosh LibreChat

# 查询记录总数
db.tokenpricings.countDocuments()
# 应返回: 210

# 查看部分记录
db.tokenpricings.find().limit(5).pretty()

# 按提供商统计
db.tokenpricings.aggregate([
  { $group: { _id: "$provider", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

### 4. Web 界面验证
访问 `https://your-domain.com/d/token-pricing` 查看导入的费率。

## 后续维护建议

1. **使用 Admin Panel 管理** - 所有后续的价格更新建议通过 Web 界面进行
2. **定期备份** - 定期导出 `tokenpricings` 集合作为备份
3. **价格监控** - 关注各大 AI 提供商的价格变动，及时更新

### 数据库备份命令
```bash
# 导出当前价格配置
docker exec chat-mongodb mongoexport \
  --db=LibreChat \
  --collection=tokenpricings \
  --out=/tmp/token-pricing-backup.json

# 从容器复制到主机
docker cp chat-mongodb:/tmp/token-pricing-backup.json ./backups/

# 恢复备份
docker cp ./backups/token-pricing-backup.json chat-mongodb:/tmp/
docker exec chat-mongodb mongoimport \
  --db=LibreChat \
  --collection=tokenpricings \
  --file=/tmp/token-pricing-backup.json
```

## 技术说明

### 优先级顺序
导入的数据库费率具有**高优先级**，查询顺序为：

1. `endpointTokenConfig` - librechat.yaml 自定义配置
2. **`TokenPricing` - 数据库（本次导入）** ⬅️ 这里
3. `tokenValues` - tx.js 硬编码
4. `defaultRate` - 默认费率 (6.0)

### 缓存机制
- `TokenPricingCache` 在服务器启动时自动加载
- Admin API 修改后自动刷新缓存
- 脚本导入后也会自动刷新缓存

### 模式匹配
使用 `includes()` 匹配，支持模糊匹配：
- `gpt-4o` 可以匹配 `gpt-4o-2024-05-13`
- `claude-3-sonnet` 可以匹配 `claude-3-sonnet-20240229`

## 常见问题

**Q: 如何更新单个模型的价格？**
A: 访问 `/d/token-pricing` 使用 Web 界面编辑

**Q: 脚本可以重复运行吗？**
A: 可以。默认会跳过已存在的记录

**Q: 如何覆盖已有数据？**
A: 使用 `--force` 选项：`node config/seed-token-pricing.js --force`

**Q: 如何清空后重新导入？**
A: 使用 `--clear` 选项：`node config/seed-token-pricing.js --clear`

## 完成时间

- **脚本创建**: 2026-02-16
- **数据导入**: 2026-02-16 18:13:33
- **验证完成**: 2026-02-16 18:13:33

---

**状态**: ✅ 完成
**环境**: 开发环境 (本地)
**下一步**: 部署到生产服务器
