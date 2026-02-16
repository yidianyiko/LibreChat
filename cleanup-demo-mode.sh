#!/bin/bash
# 清理所有 Demo Mode 相关代码

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║  Cleaning Demo Mode Code                          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# 1. 删除 demo mode 工具文件
echo "📝 Step 1: Removing demo mode utility files..."
rm -f client/src/utils/demoMode.ts
rm -f packages/data-provider/src/demo.ts
echo "   ✓ Removed demoMode.ts and demo.ts"

# 2. 删除测试和诊断文件
echo ""
echo "📝 Step 2: Removing test and diagnostic files..."
rm -f test-rates-automated.js
rm -f browser-diagnostic.js
rm -f test-model-rates-debug.js
rm -f fix-model-rates.sh
rm -f MODEL-RATES-INVESTIGATION.md
rm -f client/src/hooks/useDebugModelRates.ts
rm -f client/src/debug-model-rates.ts
rm -f fix-rates-cache.js
rm -f test-rate-display.js
rm -f verify-rates-simple.js
rm -f fix-useGetModelRatesQuery.js
echo "   ✓ Removed diagnostic files"

# 3. 备份将要修改的文件
echo ""
echo "📝 Step 3: Backing up files before modification..."
mkdir -p .backup-demo-cleanup
cp client/src/main.jsx .backup-demo-cleanup/
cp client/src/data-provider/queries.ts .backup-demo-cleanup/
cp packages/data-provider/src/react-query/react-query-service.ts .backup-demo-cleanup/
cp client/src/hooks/AuthContext.tsx .backup-demo-cleanup/
cp client/src/hooks/Files/useFileMap.ts .backup-demo-cleanup/
cp client/src/data-provider/Endpoints/queries.ts .backup-demo-cleanup/
cp client/src/data-provider/Messages/queries.ts .backup-demo-cleanup/
echo "   ✓ Backups created in .backup-demo-cleanup/"

echo ""
echo "✅ Demo mode files cleaned!"
echo ""
echo "Next steps:"
echo "  1. Run: npm run build:packages"
echo "  2. Run: npm run frontend:dev"
echo "  3. Test in browser"
echo ""
echo "If you need to rollback, backups are in: .backup-demo-cleanup/"
