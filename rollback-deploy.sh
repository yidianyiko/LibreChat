#!/bin/bash
################################################################################
# LibreChat 回退部署脚本
#
# 功能：
#   1. 切换 API 服务到指定镜像 librechat-local:20260218172529
#   2. 备份并更新 docker-compose override 文件
#   3. 重启 API 服务并验证
#   4. 清理今天 (2/19) 部署的旧镜像
#
# 使用：
#   ./rollback-deploy.sh
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

TARGET_IMAGE="librechat-local:20260218172529"
CLEANUP_TAGS=("20260219212706" "20260219211309" "20260219203547")

# 日志函数
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo "======================================"
echo "  LibreChat 回退部署"
echo "======================================"
echo "服务器: ${SERVER_IP}"
echo "目标镜像: ${TARGET_IMAGE}"
echo "======================================"
echo ""

# Step 1: 验证目标镜像存在
log_info "验证目标镜像是否存在..."

IMAGE_EXISTS=$(ssh "${SERVER_HOST}" "sudo docker images --format '{{.Repository}}:{{.Tag}}' | grep -Fq '${TARGET_IMAGE}' && echo 'yes' || echo 'no'")

if [ "${IMAGE_EXISTS}" != "yes" ]; then
    log_error "目标镜像 ${TARGET_IMAGE} 在服务器上不存在"
    exit 1
fi

log_success "镜像验证通过: ${TARGET_IMAGE}"

# Step 2: 备份 override 并创建新的，然后重启服务
log_info "开始回退部署..."

ssh "${SERVER_HOST}" bash << EOF
    set -e

    cd "${PROJECT_DIR}"
    mkdir -p .deploy

    # 备份现有的 override 文件
    if [ -f .deploy/override.yml ]; then
        BACKUP_FILE=".deploy/override.yml.backup.\$(date +%Y%m%d%H%M%S)"
        echo "[INFO] 备份现有 override 文件到: \${BACKUP_FILE}"
        cp .deploy/override.yml "\${BACKUP_FILE}"
    fi

    # 创建新的 override 文件
    echo "[INFO] 创建 docker-compose override 文件..."
    cat > .deploy/override.yml << YAML
services:
  api:
    image: ${TARGET_IMAGE}
YAML

    echo "[INFO] Override 文件内容："
    cat .deploy/override.yml

    echo ""
    echo "[INFO] 重启 API 服务..."
    sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api

    echo ""
    echo "[INFO] 等待服务启动（5秒）..."
    sleep 5

    echo ""
    echo "[INFO] 检查服务状态..."
    sudo docker-compose ps

    echo ""
    echo "[INFO] 查看最近的日志..."
    sudo docker-compose logs --tail=30 api
EOF

if [ $? -ne 0 ]; then
    log_error "回退部署失败"
    exit 1
fi

log_success "服务已切换到 ${TARGET_IMAGE}"

# Step 3: 清理今天部署的旧镜像
echo ""
log_info "清理今天 (2/19) 部署的旧镜像..."

for TAG in "${CLEANUP_TAGS[@]}"; do
    FULL_IMAGE="librechat-local:${TAG}"
    log_info "删除镜像: ${FULL_IMAGE}"

    ssh "${SERVER_HOST}" "sudo docker rmi ${FULL_IMAGE} 2>&1" && \
        log_success "已删除: ${FULL_IMAGE}" || \
        log_warning "删除失败（可能不存在或仍被引用）: ${FULL_IMAGE}"
done

# Step 4: 显示最终状态
echo ""
log_info "清理后的镜像列表："
ssh "${SERVER_HOST}" "sudo docker images librechat-local --format 'table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}'"

echo ""
log_success "======================================"
log_success "  回退部署完成！"
log_success "======================================"
echo ""
echo "当前运行镜像: ${TARGET_IMAGE}"
echo ""
echo "下一步："
echo "1. 访问 https://keep4oforever.com 验证服务是否正常"
echo ""
echo "常用命令："
echo "  查看日志: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose logs -f api'"
echo "  重启服务: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose restart api'"
echo "  查看状态: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose ps'"
echo ""
