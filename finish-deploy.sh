#!/bin/bash
################################################################################
# LibreChat 部署完成脚本 - 完成镜像加载后的剩余步骤
#
# 功能：
#   1. 创建 docker-compose override 文件
#   2. 重启 API 服务
#   3. 显示服务状态和日志
#
# 使用：
#   在服务器上执行：
#   ./finish-deploy.sh <镜像标签>
#   或自动使用最新镜像：
#   ./finish-deploy.sh
################################################################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_DIR="/home/ubuntu/chat-web/LibreChat"
IMAGE_NAME="librechat-local"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取镜像标签
if [ -n "$1" ]; then
    IMAGE_TAG="$1"
    log_info "使用指定的镜像标签: ${IMAGE_TAG}"
else
    # 自动获取最新的 librechat-local 镜像
    log_info "自动检测最新的 librechat-local 镜像..."
    IMAGE_TAG=$(sudo docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${IMAGE_NAME}:" | head -1)

    if [ -z "${IMAGE_TAG}" ]; then
        log_error "未找到 librechat-local 镜像"
        log_info "请先加载镜像或指定镜像标签"
        exit 1
    fi

    log_success "找到最新镜像: ${IMAGE_TAG}"
fi

# 检查镜像是否存在（使用 -F 固定字符串匹配）
if ! sudo docker images --format "{{.Repository}}:{{.Tag}}" | grep -Fq "${IMAGE_TAG}"; then
    log_error "镜像 ${IMAGE_TAG} 不存在"
    log_info "可用的镜像："
    sudo docker images | grep librechat-local
    exit 1
fi

log_success "镜像验证通过: ${IMAGE_TAG}"

# 切换到项目目录
cd "${PROJECT_DIR}" || {
    log_error "项目目录不存在: ${PROJECT_DIR}"
    exit 1
}

log_info "项目目录: ${PROJECT_DIR}"

# 创建 .deploy 目录
mkdir -p .deploy

# 备份现有的 override 文件
if [ -f .deploy/override.yml ]; then
    BACKUP_FILE=".deploy/override.yml.backup.$(date +%Y%m%d%H%M%S)"
    log_info "备份现有 override 文件到: ${BACKUP_FILE}"
    cp .deploy/override.yml "${BACKUP_FILE}"
fi

# 创建新的 override 文件
log_info "创建 docker-compose override 文件..."
cat > .deploy/override.yml << EOF
services:
  api:
    image: ${IMAGE_TAG}
EOF

log_success "Override 文件创建成功"

# 显示 override 内容
log_info "Override 文件内容："
cat .deploy/override.yml

echo ""
log_info "重启 API 服务..."

# 重启 API 服务
sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api

log_success "服务重启命令已执行"

echo ""
log_info "等待服务启动（5秒）..."
sleep 5

echo ""
log_info "检查服务状态..."
sudo docker-compose ps

echo ""
log_info "查看最近的日志..."
sudo docker-compose logs --tail=30 api

echo ""
log_success "======================================"
log_success "  部署完成！"
log_success "======================================"
echo ""
echo "下一步："
echo "1. 访问 https://keep4oforever.com 验证服务是否正常"
echo "2. 测试上传 200MB 文件，验证分块上传功能"
echo "3. 观察是否显示 'Uploading batch X of Y'"
echo ""
echo "常用命令："
echo "  查看日志: sudo docker-compose logs -f api"
echo "  重启服务: sudo docker-compose restart api"
echo "  查看状态: sudo docker-compose ps"
echo ""
