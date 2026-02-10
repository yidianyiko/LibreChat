#!/bin/bash
################################################################################
# LibreChat 远程部署完成脚本 - 通过 SSH 完成剩余步骤
#
# 功能：
#   1. 传输 finish-deploy.sh 到服务器
#   2. 在服务器上执行部署完成脚本
#
# 使用：
#   在本地执行：
#   ./remote-finish-deploy.sh [镜像标签]
################################################################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SERVER_IP="${SERVER_IP:-54.64.181.104}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SERVER_HOST="${SERVER_USER}@${SERVER_IP}"
PROJECT_DIR="/home/ubuntu/chat-web/LibreChat"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "服务器: ${SERVER_IP}"
log_info "项目目录: ${PROJECT_DIR}"

# 传输脚本到服务器
log_info "传输部署脚本到服务器..."
scp finish-deploy.sh "${SERVER_HOST}:/tmp/finish-deploy.sh"
log_success "脚本传输成功"

# 在服务器上执行脚本
log_info "在服务器上执行部署脚本..."
ssh "${SERVER_HOST}" bash << EOF
    set -e
    chmod +x /tmp/finish-deploy.sh
    /tmp/finish-deploy.sh $1
EOF

log_success "远程部署完成！"
