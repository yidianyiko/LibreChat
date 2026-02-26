#!/bin/bash

# LibreChat 本地开发环境启动脚本
# 自动清理端口并启动热更新服务

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 端口配置
API_PORT=3080
FRONTEND_PORT=3090

echo -e "${BLUE}🚀 启动 LibreChat 本地开发环境${NC}"
echo "================================"

# 函数：终止指定端口的进程
kill_port() {
    local port=$1
    local service_name=$2

    # 查找占用端口的所有进程（可能有多个）
    local pids=$(lsof -ti:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠️  发现端口 $port 被占用 (PIDs: $pids)${NC}"
        echo -e "${YELLOW}正在终止 $service_name...${NC}"

        # 终止所有相关进程
        for pid in $pids; do
            # 尝试优雅终止
            kill $pid 2>/dev/null
        done

        # 等待最多 5 秒
        for i in {1..5}; do
            if ! lsof -ti:$port &>/dev/null; then
                echo -e "${GREEN}✓ $service_name 已停止${NC}"
                return 0
            fi
            sleep 1
        done

        # 如果优雅终止失败，强制终止所有相关进程
        pids=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$pids" ]; then
            echo -e "${YELLOW}强制终止 $service_name...${NC}"
            for pid in $pids; do
                kill -9 $pid 2>/dev/null
            done
            sleep 1
        fi

        if ! lsof -ti:$port &>/dev/null; then
            echo -e "${GREEN}✓ $service_name 已强制停止${NC}"
        else
            echo -e "${RED}✗ 无法终止端口 $port 上的进程${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✓ 端口 $port 空闲${NC}"
    fi

    return 0
}

# 函数：启动数据库服务
start_database() {
    echo ""
    echo -e "${BLUE}📦 检查数据库服务...${NC}"

    if ! docker ps | grep -q chat-mongodb; then
        echo "启动数据库服务..."
        docker compose -f docker-compose.dev.yml up -d
        echo "等待数据库启动..."
        sleep 5

        if docker ps | grep -q chat-mongodb; then
            echo -e "${GREEN}✓ 数据库服务已启动${NC}"
        else
            echo -e "${RED}✗ 数据库启动失败${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✓ 数据库服务已运行${NC}"
    fi

    return 0
}

# 函数：检查并安装依赖
check_dependencies() {
    echo ""
    echo -e "${BLUE}📥 检查依赖...${NC}"

    if [ ! -d "node_modules" ]; then
        echo "未发现 node_modules，安装 npm 依赖..."
        npm install
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ 依赖安装完成${NC}"
        else
            echo -e "${RED}✗ 依赖安装失败${NC}"
            return 1
        fi
    else
        echo "检测已安装依赖完整性..."
        if npm ls --workspaces --all --json >/tmp/librechat-npm-ls.json 2>/dev/null; then
            echo -e "${GREEN}✓ 依赖已安装且完整${NC}"
        else
            # npm ls 可能因 invalid/extraneous 返回非零，仅在 missing 依赖时才自动修复
            local has_missing=$(node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync('/tmp/librechat-npm-ls.json','utf8'));const p=d.problems||[];process.stdout.write(p.some(x=>String(x).startsWith('missing:'))?'yes':'no');}catch{process.stdout.write('yes');}")

            if [ "$has_missing" = "yes" ]; then
                echo -e "${YELLOW}⚠️  检测到缺失依赖，执行 npm install 修复...${NC}"
                npm install
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✓ 依赖修复完成${NC}"
                else
                    echo -e "${RED}✗ 依赖修复失败${NC}"
                    return 1
                fi
            else
                echo -e "${YELLOW}⚠️  检测到非缺失类依赖告警（invalid/extraneous），继续启动${NC}"
            fi
        fi
    fi

    return 0
}

# 主流程
main() {
    # 1. 清理端口
    echo ""
    echo -e "${BLUE}🧹 清理端口...${NC}"
    kill_port $API_PORT "后端 API 服务"
    kill_port $FRONTEND_PORT "前端服务"

    # 等待端口释放
    sleep 2

    # 2. 启动数据库
    start_database
    if [ $? -ne 0 ]; then
        echo -e "${RED}数据库启动失败，退出${NC}"
        exit 1
    fi

    # 3. 检查依赖
    check_dependencies
    if [ $? -ne 0 ]; then
        echo -e "${RED}依赖检查失败，退出${NC}"
        exit 1
    fi

    # 4. 构建共享包（如果需要）
    echo ""
    echo -e "${BLUE}🔨 检查共享包...${NC}"
    if ! ./scripts/check-shared-packages.sh; then
        echo "构建共享包..."
        npm run build:packages
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ 共享包构建完成${NC}"
        else
            echo -e "${RED}✗ 共享包构建失败${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ 共享包已构建${NC}"
    fi

    # 5. 启动服务
    echo ""
    echo -e "${BLUE}🚀 启动开发服务器...${NC}"
    echo ""

    # 使用 trap 确保脚本退出时清理后台进程
    trap 'echo ""; echo -e "${YELLOW}正在停止所有服务...${NC}"; kill $(jobs -p) 2>/dev/null; echo -e "${GREEN}所有服务已停止${NC}"; exit 0' INT TERM

    # 启动后端（后台）
    echo -e "${BLUE}启动后端 API (端口 $API_PORT)...${NC}"
    PORT=3080 npm run backend:dev &
    BACKEND_PID=$!

    # 等待后端启动
    sleep 3

    # 启动前端（后台）
    echo -e "${BLUE}启动前端 (端口 $FRONTEND_PORT)...${NC}"
    PORT=$FRONTEND_PORT BACKEND_PORT=$API_PORT npm run frontend:dev &
    FRONTEND_PID=$!

    # 6. 显示启动信息
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}✅ 所有服务已启动！${NC}"
    echo ""
    echo -e "${BLUE}后端 PID: $BACKEND_PID${NC}"
    echo -e "${BLUE}前端 PID: $FRONTEND_PID${NC}"
    echo ""
    echo -e "${YELLOW}访问地址：${NC}"
    echo -e "  前端: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  API:  ${GREEN}http://localhost:$API_PORT${NC}"
    echo ""
    echo -e "${YELLOW}数据库服务：${NC}"
    echo -e "  MongoDB:     ${GREEN}localhost:27017${NC}"
    echo -e "  Meilisearch: ${GREEN}localhost:7700${NC}"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""

    # 等待任一后台进程退出
    wait -n
}

# 运行主流程
main
