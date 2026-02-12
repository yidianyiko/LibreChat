#!/bin/bash

################################################################################
# LibreChat Deployment Trigger Script
#
# Triggers GitHub Actions to build and deploy to server
#
# Usage:
#   ./trigger-deploy.sh                    # Deploy latest
#   ./trigger-deploy.sh 20260212143000     # Deploy specific tag
#   ./trigger-deploy.sh --no-health-check  # Skip health check
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
IMAGE_TAG="latest"
SKIP_HEALTH_CHECK="false"
WORKFLOW_FILE="deploy-to-server.yml"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check GitHub CLI
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed"
        log_info "Install: https://cli.github.com"
        log_info "  macOS: brew install gh"
        log_info "  Linux: sudo apt install gh"
        exit 1
    fi
    log_success "GitHub CLI found"
}

# Check authentication
check_gh_auth() {
    if ! gh auth status &> /dev/null; then
        log_error "Not authenticated with GitHub"
        log_info "Run: gh auth login"
        exit 1
    fi
    log_success "GitHub authentication verified"
}

# Trigger workflow
trigger_workflow() {
    log_info "Triggering deployment workflow..."
    log_info "Image tag: ${IMAGE_TAG}"
    log_info "Skip health check: ${SKIP_HEALTH_CHECK}"

    # Trigger workflow dispatch
    local run_url=$(gh workflow run "${WORKFLOW_FILE}" \
        -f image_tag="${IMAGE_TAG}" \
        -f skip_health_check="${SKIP_HEALTH_CHECK}" \
        2>&1)

    if [ $? -ne 0 ]; then
        log_error "Failed to trigger workflow"
        echo "${run_url}"
        exit 1
    fi

    log_success "Workflow triggered successfully"

    # Wait a moment for the run to appear
    sleep 2

    # Get the latest run
    log_info "Fetching workflow run details..."
    local run_id=$(gh run list --workflow="${WORKFLOW_FILE}" --limit=1 --json databaseId --jq '.[0].databaseId')

    if [ -n "${run_id}" ]; then
        local run_url="https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/runs/${run_id}"
        log_success "Workflow started: ${run_url}"

        echo ""
        echo "======================================"
        echo "  Deployment Triggered"
        echo "======================================"
        echo ""
        echo "Workflow: ${WORKFLOW_FILE}"
        echo "Image: ghcr.io/yidianyiko/librechat:${IMAGE_TAG}"
        echo "Run URL: ${run_url}"
        echo ""
        echo "Options:"
        echo "  1. Watch logs: gh run watch ${run_id}"
        echo "  2. View in browser: ${run_url}"
        echo ""
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [options] [image-tag]"
    echo ""
    echo "Options:"
    echo "  --no-health-check    Skip health check after deployment"
    echo "  --help, -h           Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy latest"
    echo "  $0 20260212143000           # Deploy specific tag"
    echo "  $0 --no-health-check        # Deploy without health check"
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-health-check)
            SKIP_HEALTH_CHECK="true"
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            IMAGE_TAG="$1"
            shift
            ;;
    esac
done

# Main
main() {
    echo "======================================"
    echo "  LibreChat Deployment Trigger"
    echo "======================================"
    echo ""

    check_gh_cli
    check_gh_auth
    trigger_workflow
}

main
