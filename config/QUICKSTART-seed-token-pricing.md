# Token Pricing 快速部署指南

## 一键部署脚本

```bash
#!/bin/bash
# 在服务器上运行此脚本

echo "=== Token Pricing Database Seeding ==="
echo ""

# 1. 确保在正确的目录
cd /path/to/LibreChat  # 修改为你的实际路径

# 2. 拉取最新代码
echo "Pulling latest code..."
git pull origin main

# 3. 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# 4. 构建 packages（如果需要）
if [ ! -d "packages/data-schemas/dist" ]; then
    echo "Building packages..."
    npm run build:packages
fi

# 5. 预览导入（可选）
echo ""
echo "Preview mode (dry-run):"
node config/seed-token-pricing.js --dry-run

# 6. 确认后执行
echo ""
read -p "Continue with actual import? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    node config/seed-token-pricing.js
    echo ""
    echo "✅ Import completed!"

    # 7. 验证
    echo ""
    echo "Verifying import..."
    docker exec chat-mongodb mongosh LibreChat --quiet --eval "print('Total records:', db.tokenpricings.countDocuments())"
fi
```

## 快速命令参考

### 基本使用
```bash
# 预览（不修改数据库）
node config/seed-token-pricing.js --dry-run

# 执行导入
node config/seed-token-pricing.js

# 强制更新已存在的记录
node config/seed-token-pricing.js --force

# 清空后重新导入
node config/seed-token-pricing.js --clear
```

### 验证导入
```bash
# 检查记录总数（应该是 210）
docker exec chat-mongodb mongosh LibreChat --quiet --eval "db.tokenpricings.countDocuments()"

# 查看提供商分布
docker exec -i chat-mongodb mongosh LibreChat --quiet --eval "
db.tokenpricings.aggregate([
  { \$group: { _id: '\$provider', count: { \$sum: 1 } } },
  { \$sort: { count: -1 } }
]).forEach(doc => print(doc._id + ':', doc.count))
"

# 查看特定模型（例如 gpt-4o）
docker exec chat-mongodb mongosh LibreChat --quiet --eval "
db.tokenpricings.findOne({modelPattern: 'gpt-4o'})
"
```

### 备份与恢复
```bash
# 备份当前价格配置
docker exec chat-mongodb mongoexport \
  --db=LibreChat \
  --collection=tokenpricings \
  --out=/tmp/token-pricing-$(date +%Y%m%d).json

# 复制到主机
docker cp chat-mongodb:/tmp/token-pricing-$(date +%Y%m%d).json ./backups/

# 恢复备份
docker cp ./backups/token-pricing-20260216.json chat-mongodb:/tmp/restore.json
docker exec chat-mongodb mongoimport \
  --db=LibreChat \
  --collection=tokenpricings \
  --drop \
  --file=/tmp/restore.json
```

## 故障排除

### 问题: 脚本报错 "Cannot find module"
```bash
# 解决方案：安装依赖并构建
npm install
npm run build:packages
```

### 问题: MongoDB 连接失败
```bash
# 检查 MongoDB 是否运行
docker ps | grep mongo

# 检查连接字符串
echo $MONGO_URI

# 启动 MongoDB（如果未运行）
docker compose up -d mongodb
```

### 问题: 记录已存在
```bash
# 选项 1: 使用 --force 更新
node config/seed-token-pricing.js --force

# 选项 2: 清空后重新导入
node config/seed-token-pricing.js --clear
```

### 问题: 缓存未刷新
```bash
# 重启 API 服务
docker compose restart api

# 或者手动触发缓存刷新（通过 API）
curl -X POST http://localhost:3080/api/admin/token-pricing/cache/refresh \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 导入后检查清单

- [ ] MongoDB 中有 210 条记录
- [ ] 各提供商数据完整（Meta: 44, Moonshot: 28, OpenAI: 26...）
- [ ] Web 界面可访问 `/d/token-pricing`
- [ ] 模型选择器显示费率信息
- [ ] 长上下文定价正常（claude-opus-4-6）

## 预期结果

```
================================================================================
Summary:
================================================================================
Total records:    210
Inserted:         210
Updated:          0
Skipped:          0
Errors:           0
================================================================================

Invalidating and reloading cache...
✓ Cache reloaded

✓ Disconnected from MongoDB

✓ Seeding completed successfully
```

## 提供商分布（210 条记录）

| 提供商 | 数量 | 主要模型 |
|--------|------|----------|
| Meta | 44 | Llama 2/3/3.1/3.2/3.3 |
| Moonshot | 28 | Kimi K2/K2.5 |
| OpenAI | 26 | GPT-4o, GPT-5, O1, O3 |
| Alibaba | 22 | Qwen 2.5/3 |
| Anthropic | 17 | Claude 2/3/3.5/4 |
| Google | 17 | Gemini 1.5/2.0/2.5 |
| xAI | 17 | Grok 2/3/4 |
| Mistral | 13 | Mistral/Mixtral |
| AWS | 7 | Nova, Titan |
| Zhipu | 7 | GLM-4 |
| DeepSeek | 5 | DeepSeek R1/V3 |
| Cohere | 4 | Command R |
| AI21 | 3 | J2, Jamba |

## 支持

- 完整文档: `config/README-seed-token-pricing.md`
- 详细报告: `SEED-REPORT.md`
- 脚本源码: `config/seed-token-pricing.js`

---

**创建时间**: 2026-02-16
**适用版本**: LibreChat v0.8.2+
