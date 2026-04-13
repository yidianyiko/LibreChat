#!/bin/bash

################################################################################
# LibreChat 部署脚本 - 本地构建 + 远程部署
#
# 功能：
#   1. 本地构建 Docker 镜像（包含前端）
#   2. 打包传输到服务器
#   3. 自动初始化远程目录（如果不存在）
#   4. 远程加载并部署
#   5. 支持回滚
#
# 使用：
#   ./deploy.sh                          # 交互式部署
#   ./deploy.sh --server 54.64.181.104    # 指定服务器 IP
#   ./deploy.sh --no-cache               # 强制重新构建（忽略 Docker 缓存）
#   ./deploy.sh --init-only              # 仅初始化远程目录，不构建
#   ./deploy.sh --rollback               # 回滚到上一版本
#   ./deploy.sh --local-test             # 本地构建并用 prod-test profile 启动（含 WeChat Bridge）
################################################################################

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量（可通过参数覆盖）
SERVER_IP="${SERVER_IP:-54.64.181.104}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SERVER_HOST="${SERVER_USER}@${SERVER_IP}"
PROJECT_DIR="/home/ubuntu/chat-web/LibreChat"
DEPLOY_DIR=".deploy"
IMAGE_NAME="librechat-local"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
IMAGE_TAG="${IMAGE_NAME}:${TIMESTAMP}"
TARBALL="${DEPLOY_DIR}/${IMAGE_NAME}-${TIMESTAMP}.tar.gz"
LAST_IMAGE_FILE="${DEPLOY_DIR}/last_image.txt"
ROLLBACK_IMAGE_FILE="${DEPLOY_DIR}/rollback_image.txt"
LAST_DEPLOYED_COMMIT_FILE="${DEPLOY_DIR}/last_deployed_commit.txt"

# 标志变量
INIT_ONLY=false
LOCAL_TEST=false
NO_CACHE=false  # 默认使用 Docker 缓存，加速构建（可用 --no-cache 强制重建）
DEPLOY_MODE="full-build"  # full-build | config-only | no-change
CHANGED_FILES=""
LOCAL_TEST_PROXY=""
LOCAL_PROXY_BRIDGE_PID=""
LOCAL_PROXY_BRIDGE_PORT="${LOCAL_PROXY_BRIDGE_PORT:-17897}"

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

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 未安装或不在 PATH 中"
        return 1
    fi
    return 0
}

# 清理函数
cleanup() {
    if [ -f "${TARBALL}" ]; then
        log_info "清理本地 tarball..."
        rm -f "${TARBALL}"
    fi
}

start_local_proxy_bridge() {
    local source_proxy="${PROXY:-}"
    if [ -z "${source_proxy}" ] && [ -f ".env" ]; then
        source_proxy=$(grep -E '^PROXY=' .env | tail -n 1 | cut -d'=' -f2-)
    fi
    if [ -z "${source_proxy}" ]; then
        LOCAL_TEST_PROXY=""
        return
    fi

    case "${source_proxy}" in
        http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
            ;;
        *)
            LOCAL_TEST_PROXY="${source_proxy}"
            log_info "本地测试使用现有代理: ${LOCAL_TEST_PROXY}"
            return
            ;;
    esac

    if ! check_command python3; then
        log_error "本地代理桥接需要 python3"
        exit 1
    fi

    local source_port
    source_port=$(printf '%s' "${source_proxy}" | sed -E 's#^[a-z]+://[^:]+:([0-9]+)$#\1#')
    if ! printf '%s' "${source_port}" | grep -Eq '^[0-9]+$'; then
        log_error "无法解析本地代理端口: ${source_proxy}"
        exit 1
    fi

    if lsof -iTCP:"${LOCAL_PROXY_BRIDGE_PORT}" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
        log_error "本地代理桥接端口已被占用: ${LOCAL_PROXY_BRIDGE_PORT}"
        exit 1
    fi

    log_info "检测到 localhost 代理，启动桥接端口 ${LOCAL_PROXY_BRIDGE_PORT} -> 127.0.0.1:${source_port}..."
    python3 -u - <<PY >/tmp/librechat-local-proxy-bridge.log 2>&1 &
import selectors
import socket

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = ${LOCAL_PROXY_BRIDGE_PORT}
TARGET_HOST = "127.0.0.1"
TARGET_PORT = ${source_port}

lsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
lsock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
lsock.bind((LISTEN_HOST, LISTEN_PORT))
lsock.listen()

def handle(client):
    try:
        upstream = socket.create_connection((TARGET_HOST, TARGET_PORT), timeout=10)
    except Exception:
        client.close()
        return

    selector = selectors.DefaultSelector()
    sockets = [client, upstream]
    for sock in sockets:
        sock.setblocking(False)

    selector.register(client, selectors.EVENT_READ, upstream)
    selector.register(upstream, selectors.EVENT_READ, client)
    open_sockets = 2

    try:
        while open_sockets > 0:
            events = selector.select(timeout=10)
            if not events:
                continue
            for key, _ in events:
                source = key.fileobj
                target = key.data
                try:
                    data = source.recv(65536)
                except Exception:
                    data = b""

                if data:
                    try:
                        target.sendall(data)
                    except Exception:
                        data = b""

                if not data:
                    try:
                        selector.unregister(source)
                    except Exception:
                        pass
                    try:
                        target.shutdown(socket.SHUT_WR)
                    except Exception:
                        pass
                    open_sockets -= 1
    finally:
        selector.close()
        for sock in sockets:
            try:
                sock.close()
            except Exception:
                pass

while True:
    client, _ = lsock.accept()
    import threading
    threading.Thread(target=handle, args=(client,), daemon=True).start()
PY
    LOCAL_PROXY_BRIDGE_PID=$!
    sleep 1

    if ! kill -0 "${LOCAL_PROXY_BRIDGE_PID}" 2>/dev/null; then
        log_error "本地代理桥接启动失败"
        if [ -f /tmp/librechat-local-proxy-bridge.log ]; then
            cat /tmp/librechat-local-proxy-bridge.log
        fi
        exit 1
    fi

    LOCAL_TEST_PROXY="http://host.docker.internal:${LOCAL_PROXY_BRIDGE_PORT}"
    log_success "本地测试代理已桥接为 ${LOCAL_TEST_PROXY}"
}

stop_local_proxy_bridge() {
    if [ -n "${LOCAL_PROXY_BRIDGE_PID}" ] && kill -0 "${LOCAL_PROXY_BRIDGE_PID}" 2>/dev/null; then
        kill "${LOCAL_PROXY_BRIDGE_PID}" 2>/dev/null || true
        wait "${LOCAL_PROXY_BRIDGE_PID}" 2>/dev/null || true
    fi
    LOCAL_PROXY_BRIDGE_PID=""
}

stop_local_test_services() {
    log_info "停止 prod-test 容器..."
    docker compose -f docker-compose.dev.yml --profile prod-test down >/dev/null 2>&1 || true
    stop_local_proxy_bridge
}

# 陷阱处理
trap cleanup EXIT INT TERM

################################################################################
# 功能函数
################################################################################

# 检查本地环境
check_local_env() {
    log_info "检查本地环境..."

    if ! check_command docker; then
        log_error "Docker 未安装或未运行"
        exit 1
    fi

    if ! check_command ssh; then
        log_error "SSH 未安装"
        exit 1
    fi

    if ! check_command scp; then
        log_error "SCP 未安装"
        exit 1
    fi

    if ! check_command git; then
        log_error "Git 未安装"
        exit 1
    fi

    log_success "本地环境检查通过"
}

print_changed_files() {
    if [ -z "${CHANGED_FILES}" ]; then
        log_info "未检测到代码或配置变更"
        return
    fi

    echo "变更文件列表:"
    printf '%s\n' "${CHANGED_FILES}" | sed 's/^/  - /'
}

is_config_only_change() {
    local file
    while IFS= read -r file; do
        [ -z "${file}" ] && continue
        case "${file}" in
            librechat.yaml|client/nginx.conf|docker-compose.yml|docker-compose.override.yml)
                ;;
            *)
                return 1
                ;;
        esac
    done <<< "${CHANGED_FILES}"
    return 0
}

detect_deploy_mode() {
    log_info "检测变更范围，选择部署模式..."

    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        log_warning "当前目录不是 Git 仓库，回退到全量构建模式"
        DEPLOY_MODE="full-build"
        return
    fi

    local base_commit=""
    if [ -f "${LAST_DEPLOYED_COMMIT_FILE}" ]; then
        base_commit=$(cat "${LAST_DEPLOYED_COMMIT_FILE}")
    fi

    if [ -n "${base_commit}" ] && git cat-file -e "${base_commit}^{commit}" 2>/dev/null; then
        CHANGED_FILES=$(
            {
                git diff --name-only "${base_commit}..HEAD"
                git diff --name-only --cached
                git diff --name-only
            } | sort -u | sed '/^$/d'
        )
        log_info "对比基线提交: ${base_commit}"
    else
        log_warning "未找到可用的上次部署提交记录，使用全量构建模式"
        DEPLOY_MODE="full-build"
        return
    fi

    if [ -z "${CHANGED_FILES}" ]; then
        DEPLOY_MODE="no-change"
        log_info "与上次部署相比无变更"
        return
    fi

    print_changed_files

    if is_config_only_change; then
        DEPLOY_MODE="config-only"
        log_info "仅检测到配置文件变更，跳过镜像重建"
    else
        DEPLOY_MODE="full-build"
        log_info "检测到代码/依赖变更，执行镜像构建部署"
    fi
}

# 检查远程环境
check_remote_env() {
    log_info "检查远程环境..."

    ssh "${SERVER_HOST}" bash -s << 'EOF'
        set -e

        # 检查 docker-compose 是否存在
        if ! command -v docker-compose &> /dev/null; then
            echo "错误: 服务器上未安装 docker-compose"
            exit 1
        fi

        # 检查 Docker 是否运行
        if ! sudo docker ps &> /dev/null; then
            echo "错误: 服务器上 Docker 未运行"
            exit 1
        fi

        # 检查 sudo 权限
        if ! sudo -n true 2>/dev/null; then
            echo "错误: 需要 sudo 免密权限"
            exit 1
        fi

        echo "远程环境检查通过"
EOF

    if [ $? -ne 0 ]; then
        log_error "远程环境检查失败"
        exit 1
    fi

    log_success "远程环境检查通过"
}

# 初始化远程目录
init_remote_directory() {
    log_info "初始化远程项目目录..."

    ssh "${SERVER_HOST}" bash -s -- "${PROJECT_DIR}" << 'EOF'
        set -e
        PROJECT_DIR=$1

        echo "检查项目目录: ${PROJECT_DIR}"

        # 创建项目目录
        if [ ! -d "${PROJECT_DIR}" ]; then
            echo "创建项目目录..."
            sudo mkdir -p "${PROJECT_DIR}"
            sudo chown ${USER}:${USER} "${PROJECT_DIR}"
            echo "项目目录已创建"
        else
            echo "项目目录已存在"
        fi

        # 创建必要的子目录
        mkdir -p "${PROJECT_DIR}/data-node"
        mkdir -p "${PROJECT_DIR}/meili_data_v1.12"
        mkdir -p "${PROJECT_DIR}/uploads"
        mkdir -p "${PROJECT_DIR}/logs"
        mkdir -p "${PROJECT_DIR}/images"
        mkdir -p "${PROJECT_DIR}/.deploy"

        echo "子目录创建完成"
EOF

    if [ $? -ne 0 ]; then
        log_error "初始化目录失败"
        exit 1
    fi

    log_success "远程目录初始化完成"
}

# 传输配置文件
transfer_config_files() {
    log_info "传输配置文件到服务器..."

    ssh "${SERVER_HOST}" bash -s -- "${PROJECT_DIR}" << 'EOF'
        set -e
        PROJECT_DIR=$1

        # 检查是否需要传输 docker-compose.yml
        if [ ! -f "${PROJECT_DIR}/docker-compose.yml" ]; then
            echo "需要 docker-compose.yml 文件"
            exit 1
        fi

        # 检查 librechat.yaml 文件
        if [ ! -f "${PROJECT_DIR}/librechat.yaml" ]; then
            if [ -f "${PROJECT_DIR}/librechat.example.yaml" ]; then
                echo "创建 librechat.yaml 从示例文件..."
                cp "${PROJECT_DIR}/librechat.example.yaml" "${PROJECT_DIR}/librechat.yaml"
            else
                echo "警告: librechat.yaml 不存在"
            fi
        fi

        echo "配置文件检查完成"
EOF

    local check_result=$?

    if [ ${check_result} -ne 0 ]; then
        log_warning "配置文件检查发现问题，尝试传输..."

        # 传输必要的文件
        if [ -f "docker-compose.yml" ]; then
            scp docker-compose.yml "${SERVER_HOST}:${PROJECT_DIR}/"
            log_success "已传输 docker-compose.yml"
        fi

        if [ -f "librechat.example.yaml" ] && ! ssh "${SERVER_HOST}" "[ -f ${PROJECT_DIR}/librechat.yaml ]"; then
            scp librechat.example.yaml "${SERVER_HOST}:${PROJECT_DIR}/librechat.yaml"
            log_success "已创建 librechat.yaml"
        fi
    fi

    # 每次部署都同步 docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        scp docker-compose.yml "${SERVER_HOST}:${PROJECT_DIR}/docker-compose.yml"
        log_success "已同步 docker-compose.yml"
    else
        log_warning "本地 docker-compose.yml 不存在，跳过同步"
    fi

    # 每次部署都同步 .env
    # 安全：docker-compose.yml environment: 节会覆盖所有环境特定变量
    # (DOMAIN, LOG_DIR, PROXY, CORS)，所以本地的 localhost 值不会影响生产
    if [ -f ".env" ]; then
        scp .env "${SERVER_HOST}:${PROJECT_DIR}/.env"
        log_success "已同步 .env"
    else
        log_warning "本地 .env 不存在，跳过同步"
    fi

    # 每次部署都同步 librechat.yaml
    if [ -f "librechat.yaml" ]; then
        scp librechat.yaml "${SERVER_HOST}:${PROJECT_DIR}/librechat.yaml"
        log_success "已同步 librechat.yaml"
    else
        log_warning "本地 librechat.yaml 不存在，跳过同步"
    fi

    if [ -f "client/nginx.conf" ]; then
        scp client/nginx.conf "${SERVER_HOST}:${PROJECT_DIR}/client/nginx.conf"
        log_success "已同步 nginx.conf"
    else
        log_warning "本地 client/nginx.conf 不存在，跳过同步"
    fi

    log_success "配置文件传输完成"
}

# 检查现有服务
check_existing_services() {
    log_info "检查现有服务状态..."

    ssh "${SERVER_HOST}" bash -s << 'EOF'
        echo "=== 运行中的容器 ==="
        sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep -E "chat-mongodb|chat-meilisearch|vectordb|rag_api|LibreChat" || echo "未找到相关容器"

        echo ""
        echo "=== Docker Volumes ==="
        sudo docker volume ls | grep librechat || echo "未找到相关 volumes"

        echo ""
        echo "=== Docker Networks ==="
        sudo docker network ls | grep librechat || echo "未找到相关网络"
EOF

    log_success "服务状态检查完成"
}

# 构建 Docker 镜像
build_image() {
    log_info "开始构建 Docker 镜像: ${IMAGE_TAG}"

    # 构建选项
    local BUILD_OPTS="-f Dockerfile.multi --target api-build"
    if [ "${NO_CACHE}" = "true" ]; then
        log_warning "使用 --no-cache 强制重新构建所有层"
        BUILD_OPTS="${BUILD_OPTS} --no-cache"
    fi

    log_info "这可能需要几分钟..."

    if docker build ${BUILD_OPTS} -t "${IMAGE_TAG}" .; then
        log_success "镜像构建成功"
    else
        log_error "镜像构建失败"
        exit 1
    fi
}

# 导出镜像
export_image() {
    log_info "导出镜像到 tarball: ${TARBALL}"

    mkdir -p "${DEPLOY_DIR}"

    if docker save "${IMAGE_TAG}" | gzip > "${TARBALL}"; then
        local size=$(du -h "${TARBALL}" | cut -f1)
        log_success "镜像导出成功 (大小: ${size})"
    else
        log_error "镜像导出失败"
        exit 1
    fi
}

# 传输到服务器
transfer_image() {
    log_info "传输镜像到服务器 ${SERVER_IP}..."

    if scp "${TARBALL}" "${SERVER_HOST}:/tmp/"; then
        log_success "传输成功"
    else
        log_error "传输失败"
        exit 1
    fi
}

# 在服务器上加载镜像
load_image_on_server() {
    log_info "在服务器上加载镜像..."

    # 使用 -T 禁用伪终端分配，避免 sudo 挂起
    ssh -T "${SERVER_HOST}" bash << EOF
        set -e
        TIMESTAMP="${TIMESTAMP}"
        IMAGE_NAME="${IMAGE_NAME}"
        PROJECT_DIR="${PROJECT_DIR}"
        TARBALL="/tmp/\${IMAGE_NAME}-\${TIMESTAMP}.tar.gz"
        IMAGE_TAG="\${IMAGE_NAME}:\${TIMESTAMP}"

        echo "加载镜像: \${IMAGE_TAG}"

        # 加载镜像并显示结果
        if sudo docker load < "\${TARBALL}" 2>&1; then
            echo "Docker load 命令执行成功"
        else
            echo "Docker load 命令失败"
            exit 1
        fi

        # 验证镜像是否存在
        if sudo docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^\${IMAGE_TAG}\$"; then
            echo "镜像验证成功: \${IMAGE_TAG}"
        else
            echo "警告: 镜像验证失败"
            exit 1
        fi

        # 清理远程 tarball
        rm -f "\${TARBALL}"
        echo "清理完成"

        echo "镜像加载成功"
EOF

    if [ $? -ne 0 ]; then
        log_error "远程加载镜像失败"
        exit 1
    fi

    log_success "镜像加载成功"
}

# 创建 override 文件
create_override() {
    log_info "创建 docker-compose override 文件..."

    ssh "${SERVER_HOST}" bash -s -- "${TIMESTAMP}" "${IMAGE_NAME}" "${PROJECT_DIR}" << 'EOF'
        set -e
        TIMESTAMP=$1
        IMAGE_NAME=$2
        PROJECT_DIR=$3
        IMAGE_TAG="${IMAGE_NAME}:${TIMESTAMP}"
        OVERRIDE_DIR="${PROJECT_DIR}/.deploy"
        OVERRIDE_FILE="${OVERRIDE_DIR}/override.yml"

        mkdir -p "${OVERRIDE_DIR}"

        # 保存当前镜像到 rollback 文件（如果存在）
        CURRENT_OVERRIDE="${OVERRIDE_DIR}/override.yml"
        if [ -f "${CURRENT_OVERRIDE}" ]; then
            CURRENT_IMAGE=$(grep "image:" "${CURRENT_OVERRIDE}" | awk '{print $2}')
            if [ -n "${CURRENT_IMAGE}" ]; then
                echo "${CURRENT_IMAGE}" > "${OVERRIDE_DIR}/rollback_image.txt"
                echo "已保存当前镜像用于回滚: ${CURRENT_IMAGE}"
            fi
        else
            # 如果没有 override，说明使用的是默认镜像
            echo "ghcr.io/danny-avila/librechat-dev:latest" > "${OVERRIDE_DIR}/rollback_image.txt"
            echo "已保存默认镜像用于回滚"
        fi

        # 创建新的 override 文件
        cat > "${OVERRIDE_FILE}" << YAML
services:
  api:
    image: ${IMAGE_TAG}
YAML

        echo "Override 文件创建成功: ${OVERRIDE_FILE}"
EOF

    if [ $? -ne 0 ]; then
        log_error "创建 override 文件失败"
        exit 1
    fi

    log_success "Override 文件创建成功"
}

# 部署服务
deploy_service() {
    local mode="${1:-normal}"

    if [ "${mode}" = "restart-only" ]; then
        log_info "仅重启 LibreChat API / WeChat Bridge 服务（跳过镜像构建）..."
    else
        log_info "部署 LibreChat API / WeChat Bridge 服务..."
    fi

    ssh "${SERVER_HOST}" bash -s -- "${PROJECT_DIR}" << 'EOF'
        set -e
        PROJECT_DIR=$1
        cd "${PROJECT_DIR}"

        echo "使用 docker-compose 重启 api / wechat-bridge 服务..."
        if [ -f ".deploy/override.yml" ]; then
            sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api wechat-bridge
        else
            echo "未找到 .deploy/override.yml，使用默认 docker-compose.yml"
            sudo docker-compose -f docker-compose.yml up -d api wechat-bridge
        fi

        echo "等待服务启动..."
        sleep 10

        echo "检查服务状态..."
        sudo docker-compose ps

        verify_container() {
            local container_name=$1
            local status
            local restart_count
            status=$(sudo docker inspect -f '{{.State.Status}}' "${container_name}" 2>/dev/null || echo "missing")
            restart_count=$(sudo docker inspect -f '{{.RestartCount}}' "${container_name}" 2>/dev/null || echo "999")
            echo "${container_name}: status=${status}, restarts=${restart_count}"

            if [ "${status}" != "running" ]; then
                echo "容器未处于 running 状态: ${container_name}"
                return 1
            fi

            if [ "${restart_count}" -ne 0 ]; then
                echo "容器发生了重启: ${container_name}"
                return 1
            fi

            return 0
        }

        verify_container LibreChat
        verify_container LibreChat-WeChat-Bridge

        # 显示最近日志
        echo ""
        echo "=== 最近的日志 ==="
        sudo docker-compose logs --tail=20 api wechat-bridge
EOF

    if [ $? -ne 0 ]; then
        log_error "部署失败"
        exit 1
    fi

    log_success "部署成功！"
}

# 保存镜像信息
save_image_info() {
    log_info "保存镜像信息..."

    echo "${IMAGE_TAG}" > "${LAST_IMAGE_FILE}"
    echo "${TIMESTAMP}" >> "${LAST_IMAGE_FILE}"

    log_success "镜像信息已保存到 ${LAST_IMAGE_FILE}"
}

save_deployed_commit() {
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        return
    fi

    mkdir -p "${DEPLOY_DIR}"

    local current_commit
    current_commit=$(git rev-parse HEAD 2>/dev/null || true)
    if [ -z "${current_commit}" ]; then
        return
    fi
    echo "${current_commit}" > "${LAST_DEPLOYED_COMMIT_FILE}"
    log_success "已记录部署提交: ${current_commit}"
}

# 本地生产镜像测试
local_test() {
    local LOCAL_TAG="librechat-local:test"

    echo "======================================"
    echo "  LibreChat 本地生产镜像测试"
    echo "======================================"
    echo ""

    if ! check_command docker; then
        log_error "Docker 未安装或未运行"
        exit 1
    fi

    local BUILD_OPTS="-f Dockerfile.multi --target api-build"
    if [ "${NO_CACHE}" = "true" ]; then
        log_warning "使用 --no-cache 强制重新构建所有层"
        BUILD_OPTS="${BUILD_OPTS} --no-cache"
    fi

    log_info "构建镜像: ${LOCAL_TAG}..."
    if docker build ${BUILD_OPTS} -t "${LOCAL_TAG}" .; then
        log_success "镜像构建成功: ${LOCAL_TAG}"
    else
        log_error "镜像构建失败"
        exit 1
    fi

    start_local_proxy_bridge

    local vite_pids
    vite_pids=$(lsof -ti :3090 2>/dev/null || true)
    if [ -n "${vite_pids}" ]; then
        log_warning "检测到遗留的 Vite dev 进程占用 3090，正在清理 (PID: ${vite_pids})..."
        kill ${vite_pids} 2>/dev/null || true
        sleep 1
    fi

    log_info "清理遗留 prod-test 容器..."
    docker compose -f docker-compose.dev.yml --profile prod-test down 2>/dev/null || true

    log_info "后台启动 prod-test 生产容器（端口 3080，包含 WeChat Bridge）..."
    LOCAL_TEST_PROXY="${LOCAL_TEST_PROXY}" docker compose -f docker-compose.dev.yml --profile prod-test up -d

    trap 'stop_local_test_services; exit 0' EXIT INT TERM

    log_info "等待后端就绪..."
    sleep 5

    log_success "本地生产测试环境已启动"
    echo "访问地址: http://localhost:3080"
    echo "说明: 此入口使用与正式部署一致的生产前端构建产物，并默认带起本地 WeChat Bridge"
    echo "说明: 不再启动 Vite dev (3090)"
    echo "按 Ctrl+C 可停止本地测试容器"
    echo ""

    docker compose -f docker-compose.dev.yml --profile prod-test logs -f api-prod-test wechat-bridge-prod-test
}

# 回滚功能
rollback() {
    log_warning "开始回滚..."

    if [ ! -f "${ROLLBACK_IMAGE_FILE}" ]; then
        log_error "回滚镜像文件不存在: ${ROLLBACK_IMAGE_FILE}"
        log_info "请确保已经成功部署过一次"
        exit 1
    fi

    ROLLBACK_IMAGE=$(cat "${ROLLBACK_IMAGE_FILE}")
    log_info "回滚到镜像: ${ROLLBACK_IMAGE}"

    ssh "${SERVER_HOST}" bash -s -- "${ROLLBACK_IMAGE}" "${PROJECT_DIR}" << 'EOF'
        set -e
        ROLLBACK_IMAGE=$1
        PROJECT_DIR=$2
        OVERRIDE_DIR="${PROJECT_DIR}/.deploy"
        OVERRIDE_FILE="${OVERRIDE_DIR}/override.yml"

        cd "${PROJECT_DIR}"

        if ! sudo docker images | grep -q "${ROLLBACK_IMAGE}"; then
            echo "错误: 回滚镜像不存在: ${ROLLBACK_IMAGE}"
            exit 1
        fi

        cat > "${OVERRIDE_FILE}" << YAML
services:
  api:
    image: ${ROLLBACK_IMAGE}
YAML

        echo "回滚 override 文件创建成功"

        echo "重启服务..."
        sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api

        echo "等待服务启动..."
        sleep 5

        echo "检查服务状态..."
        sudo docker-compose ps

        echo ""
        echo "=== 最近的日志 ==="
        sudo docker-compose logs --tail=20 api

        echo "回滚完成"
EOF

    log_success "回滚成功！"
}

# 主流程
main() {
    echo "======================================"
    echo "  LibreChat 部署脚本"
    echo "======================================"
    echo "服务器: ${SERVER_IP}"
    echo "项目目录: ${PROJECT_DIR}"
    echo "镜像标签: ${IMAGE_TAG}"
    echo "======================================"
    echo ""

    check_local_env
    check_remote_env
    init_remote_directory
    check_existing_services

    if [ "${INIT_ONLY}" = "true" ]; then
        log_info "仅初始化模式，跳过构建和部署"
        transfer_config_files
        log_success "初始化完成！请配置 .env 文件后重新运行"
        exit 0
    fi

    detect_deploy_mode
    transfer_config_files
    case "${DEPLOY_MODE}" in
        config-only)
            deploy_service "restart-only"
            save_deployed_commit
            ;;
        no-change)
            log_warning "无变更需要部署，跳过服务重启"
            ;;
        *)
            build_image
            export_image
            transfer_image
            load_image_on_server
            create_override
            deploy_service
            save_image_info
            save_deployed_commit
            ;;
    esac

    echo ""
    log_success "======================================"
    log_success "  部署完成！"
    log_success "======================================"
    echo ""
    echo "访问地址: http://${SERVER_IP}:3080"
    echo ""
    echo "常用命令:"
    echo "  查看日志: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose logs -f api'"
    echo "  重启服务: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose restart api'"
    echo "  回滚版本: $0 --rollback"
    echo ""
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --server|-s)
            SERVER_IP="$2"
            SERVER_HOST="${SERVER_USER}@${SERVER_IP}"
            shift 2
            ;;
        --user|-u)
            SERVER_USER="$2"
            SERVER_HOST="${SERVER_USER}@${SERVER_IP}"
            shift 2
            ;;
        --local-test|-l)
            LOCAL_TEST=true
            shift
            ;;
        --init-only)
            INIT_ONLY=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --use-cache)
            NO_CACHE=false
            shift
            ;;
        --rollback|-r)
            ROLLBACK=true
            shift
            ;;
        --help|-h)
            echo "使用方法:"
            echo "  $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --server, -s <IP>    服务器 IP 地址 (默认: 54.64.181.104)"
            echo "  --user, -u <USER>    SSH 用户名 (默认: ubuntu)"
            echo "  --local-test, -l     本地构建并启动 prod-test 生产容器（含 WeChat Bridge，访问 http://localhost:3080）"
            echo "  --init-only          仅初始化远程目录，不构建镜像"
            echo "  --no-cache           强制重新构建所有 Docker 层（忽略缓存）"
            echo "  --use-cache          允许复用 Docker 缓存层（推荐日常部署）"
            echo "  --rollback, -r       回滚到上一版本"
            echo "  --help, -h           显示此帮助"
            echo ""
            echo "环境变量:"
            echo "  SERVER_IP           服务器 IP 地址"
            echo "  SERVER_USER         SSH 用户名"
            echo ""
            echo "示例:"
            echo "  $0                           # 完整部署流程"
            echo "  $0 --local-test              # 本地生产镜像测试（含 WeChat Bridge）"
            echo "  $0 --local-test --no-cache   # 强制重建后本地测试（含 WeChat Bridge）"
            echo "  $0 --no-cache                # 强制重新构建并部署"
            echo "  $0 --init-only               # 仅初始化目录"
            echo "  $0 --server 1.2.3.4          # 指定服务器"
            echo "  $0 --rollback                # 回滚版本"
            exit 0
            ;;
        *)
            log_error "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 执行
if [ "${ROLLBACK}" = "true" ]; then
    rollback
elif [ "${LOCAL_TEST}" = "true" ]; then
    local_test
else
    main
fi
