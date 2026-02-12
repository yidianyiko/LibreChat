#!/bin/bash

################################################################################
# LibreChat Registry-Based Deployment Script
#
# Features:
#   - Pull images from GitHub Container Registry
#   - No tarball transfer needed
#   - Single-step deployment
#   - Support for specific tags or latest
#
# Usage:
#   ./deploy-registry.sh                    # Deploy latest
#   ./deploy-registry.sh 20260212143000     # Deploy specific tag
#   ./deploy-registry.sh --rollback         # Rollback to previous version
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SERVER_IP="${SERVER_IP:-54.64.181.104}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SERVER_HOST="${SERVER_USER}@${SERVER_IP}"
PROJECT_DIR="/home/ubuntu/chat-web/LibreChat"

# Registry configuration
GITHUB_USER="yidianyiko"
REGISTRY="ghcr.io"
IMAGE_BASE="${REGISTRY}/${GITHUB_USER}/librechat"

# Get GitHub token from git-credentials
GITHUB_TOKEN=$(grep "github.com" ~/.git-credentials 2>/dev/null | sed 's/.*:\([^@]*\)@.*/\1/' || echo "")

# Flags
ROLLBACK=false
IMAGE_TAG="latest"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check GitHub token
check_github_token() {
    if [ -z "${GITHUB_TOKEN}" ]; then
        log_error "GitHub token not found in ~/.git-credentials"
        log_info "Please ensure you have authenticated with GitHub"
        exit 1
    fi
    log_success "GitHub token found"
}

# Check remote environment
check_remote_env() {
    log_info "Checking remote environment..."

    ssh "${SERVER_HOST}" bash << 'EOF'
        if ! command -v docker-compose &> /dev/null; then
            echo "ERROR: docker-compose not installed"
            exit 1
        fi

        if ! sudo docker ps &> /dev/null; then
            echo "ERROR: Docker not running"
            exit 1
        fi

        echo "Remote environment OK"
EOF

    if [ $? -ne 0 ]; then
        log_error "Remote environment check failed"
        exit 1
    fi

    log_success "Remote environment check passed"
}

# Login to registry on server
registry_login_on_server() {
    log_info "Logging into GitHub Container Registry on server..."

    ssh "${SERVER_HOST}" bash << EOF
        echo "${GITHUB_TOKEN}" | sudo docker login ${REGISTRY} -u ${GITHUB_USER} --password-stdin
EOF

    if [ $? -ne 0 ]; then
        log_error "Registry login failed"
        exit 1
    fi

    log_success "Registry login successful"
}

# Pull image on server
pull_image_on_server() {
    local image_tag=$1
    local full_image="${IMAGE_BASE}:${image_tag}"

    log_info "Pulling image: ${full_image}"

    ssh "${SERVER_HOST}" bash << EOF
        sudo docker pull "${full_image}"
EOF

    if [ $? -ne 0 ]; then
        log_error "Image pull failed"
        exit 1
    fi

    log_success "Image pulled successfully"
}

# Transfer configuration files
transfer_config_files() {
    log_info "Transferring configuration files..."

    if [ -f "librechat.yaml" ]; then
        scp librechat.yaml "${SERVER_HOST}:${PROJECT_DIR}/librechat.yaml"
        log_success "Transferred librechat.yaml"
    fi

    if [ -f "client/nginx.conf" ]; then
        ssh "${SERVER_HOST}" "mkdir -p ${PROJECT_DIR}/client"
        scp client/nginx.conf "${SERVER_HOST}:${PROJECT_DIR}/client/nginx.conf"
        log_success "Transferred nginx.conf"
    fi
}

# Create override file
create_override() {
    local image_tag=$1
    local full_image="${IMAGE_BASE}:${image_tag}"

    log_info "Creating docker-compose override..."

    ssh "${SERVER_HOST}" bash << EOF
        PROJECT_DIR="${PROJECT_DIR}"
        cd "\${PROJECT_DIR}"

        mkdir -p .deploy

        # Backup current override if exists
        if [ -f .deploy/override.yml ]; then
            CURRENT_IMAGE=\$(grep "image:" .deploy/override.yml | awk '{print \$2}')
            if [ -n "\${CURRENT_IMAGE}" ]; then
                echo "\${CURRENT_IMAGE}" > .deploy/rollback_image.txt
                echo "Saved rollback image: \${CURRENT_IMAGE}"
            fi
        fi

        # Create new override
        cat > .deploy/override.yml << YAML
services:
  api:
    image: ${full_image}
YAML

        echo "Override file created"
EOF

    log_success "Override file created"
}

# Deploy service
deploy_service() {
    log_info "Deploying LibreChat API service..."

    ssh "${SERVER_HOST}" bash << EOF
        PROJECT_DIR="${PROJECT_DIR}"
        cd "\${PROJECT_DIR}"

        echo "Restarting API service..."
        sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api

        echo "Waiting for service to start..."
        sleep 5

        echo "Checking service status..."
        sudo docker-compose ps

        echo ""
        echo "=== Recent logs ==="
        sudo docker-compose logs --tail=20 api
EOF

    if [ $? -ne 0 ]; then
        log_error "Deployment failed"
        exit 1
    fi

    log_success "Deployment successful"
}

# Health check
health_check() {
    log_info "Performing health check..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if ssh "${SERVER_HOST}" "curl -sf http://localhost:3080/api/health > /dev/null 2>&1"; then
            log_success "Health check passed!"
            return 0
        fi

        log_info "Waiting for service... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_error "Health check failed - service may not be healthy"
    ssh "${SERVER_HOST}" "cd ${PROJECT_DIR} && sudo docker-compose logs --tail=50 api"
    return 1
}

# Rollback
rollback() {
    log_warning "Starting rollback..."

    local rollback_image=$(ssh "${SERVER_HOST}" "cat ${PROJECT_DIR}/.deploy/rollback_image.txt 2>/dev/null")

    if [ -z "${rollback_image}" ]; then
        log_error "No rollback image found"
        exit 1
    fi

    log_info "Rolling back to: ${rollback_image}"

    ssh "${SERVER_HOST}" bash << EOF
        PROJECT_DIR="${PROJECT_DIR}"
        cd "\${PROJECT_DIR}"

        cat > .deploy/override.yml << YAML
services:
  api:
    image: ${rollback_image}
YAML

        sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api
        sleep 5
        sudo docker-compose ps
EOF

    log_success "Rollback complete!"
}

# Main function
main() {
    echo "======================================"
    echo "  LibreChat Registry Deployment"
    echo "======================================"
    echo "Server: ${SERVER_IP}"
    echo "Image: ${IMAGE_BASE}:${IMAGE_TAG}"
    echo "======================================"
    echo ""

    check_github_token
    check_remote_env
    registry_login_on_server
    pull_image_on_server "${IMAGE_TAG}"
    transfer_config_files
    create_override "${IMAGE_TAG}"
    deploy_service

    if health_check; then
        echo ""
        log_success "======================================"
        log_success "  Deployment Complete!"
        log_success "======================================"
        echo ""
        echo "Image deployed: ${IMAGE_BASE}:${IMAGE_TAG}"
        echo "Access: http://${SERVER_IP}:3080"
        echo ""
        echo "Useful commands:"
        echo "  View logs: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose logs -f api'"
        echo "  Restart: ssh ${SERVER_HOST} 'cd ${PROJECT_DIR} && sudo docker-compose restart api'"
        echo "  Rollback: $0 --rollback"
        echo ""
    else
        log_warning "Deployment completed but health check failed"
        log_info "Please check logs manually"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --rollback|-r)
            ROLLBACK=true
            shift
            ;;
        --server|-s)
            SERVER_IP="$2"
            SERVER_HOST="${SERVER_USER}@${SERVER_IP}"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options] [image-tag]"
            echo ""
            echo "Options:"
            echo "  --rollback, -r      Rollback to previous version"
            echo "  --server, -s IP     Specify server IP"
            echo "  --help, -h          Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                      # Deploy latest"
            echo "  $0 20260212143000       # Deploy specific tag"
            echo "  $0 --rollback           # Rollback"
            exit 0
            ;;
        *)
            IMAGE_TAG="$1"
            shift
            ;;
    esac
done

# Execute
if [ "${ROLLBACK}" = "true" ]; then
    rollback
else
    main
fi
