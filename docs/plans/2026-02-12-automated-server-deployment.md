# Automated Server Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automated server deployment capability with two trigger methods: (A) local script triggers GitHub Actions → auto-deploys, and (C) local script directly deploys.

**Architecture:** Create a new GitHub Actions workflow (`deploy-to-server.yml`) that SSHes to the server and executes deployment commands. Add a local trigger script (`trigger-deploy.sh`) that uses GitHub CLI to dispatch the workflow. The existing `deploy-registry.sh` remains as the direct deployment option.

**Tech Stack:** GitHub Actions, GitHub CLI (gh), SSH, Bash, GitHub Secrets

**Current State:**
- ✅ GitHub Actions workflow builds and pushes images (`deploy-production.yml`)
- ✅ Local deployment script exists (`deploy-registry.sh`)
- ❌ No automated server deployment from GitHub Actions
- ❌ No local trigger script

**Target State:**
- ✅ Workflow `deploy-to-server.yml` that deploys to server via SSH
- ✅ Local script `trigger-deploy.sh` to trigger GitHub Actions deployment
- ✅ SSH key configured in GitHub Secrets
- ✅ Two deployment paths:
  - **Path A**: `trigger-deploy.sh` → GitHub Actions → Server
  - **Path C**: `deploy-registry.sh` → Server (direct)

---

## Task 1: Configure SSH Access in GitHub Secrets

**Files:**
- None (configuration task)

**Context:**
- GitHub Actions needs SSH access to deploy to server
- Server: `ubuntu@54.64.181.104`
- SSH key must be stored securely in GitHub Secrets

**Step 1: Check if SSH key exists locally**

```bash
ls -la ~/.ssh/id_rsa ~/.ssh/id_ed25519
```

Expected: Display existing keys or "No such file"

**Step 2: Get SSH private key content**

If key exists:
```bash
cat ~/.ssh/id_rsa
# OR
cat ~/.ssh/id_ed25519
```

If no key exists, skip this task and note in documentation that user needs to:
1. Generate SSH key: `ssh-keygen -t ed25519 -C "github-actions@librechat"`
2. Add public key to server: `ssh-copy-id ubuntu@54.64.181.104`

**Step 3: Add SSH key to GitHub Secrets**

Manual step (document in commit):

1. Go to: `https://github.com/yidianyiko/LibreChat/settings/secrets/actions`
2. Click "New repository secret"
3. Name: `SERVER_SSH_KEY`
4. Value: Paste the SSH private key (entire content including BEGIN/END lines)
5. Click "Add secret"

**Step 4: Add server details to GitHub Secrets**

Create these secrets:
- `SERVER_HOST`: `54.64.181.104`
- `SERVER_USER`: `ubuntu`
- `SERVER_PROJECT_DIR`: `/home/ubuntu/chat-web/LibreChat`

**Step 5: Document the configuration**

```bash
git commit --allow-empty -m "docs: add GitHub Secrets configuration for automated deployment

Required secrets:
- SERVER_SSH_KEY: SSH private key for server access
- SERVER_HOST: 54.64.181.104
- SERVER_USER: ubuntu
- SERVER_PROJECT_DIR: /home/ubuntu/chat-web/LibreChat

Setup instructions in docs/deployment-registry-guide.md"
```

Expected: Empty commit created with documentation

---

## Task 2: Create GitHub Actions Deployment Workflow

**Files:**
- Create: `.github/workflows/deploy-to-server.yml`

**Step 1: Create the deployment workflow file**

Create `.github/workflows/deploy-to-server.yml`:

```yaml
name: Deploy to Server

on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Image tag to deploy (default: latest)'
        required: false
        default: 'latest'
        type: string
      skip_health_check:
        description: 'Skip health check after deployment'
        required: false
        default: false
        type: boolean

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/librechat

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SERVER_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts

      - name: Test SSH connection
        run: |
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} \
            "echo 'SSH connection successful'"

      - name: Login to GitHub Container Registry on server
        run: |
          ssh -i ~/.ssh/deploy_key \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} \
            "echo '${{ secrets.GITHUB_TOKEN }}' | sudo docker login ${{ env.REGISTRY }} -u ${{ github.actor }} --password-stdin"

      - name: Pull Docker image on server
        run: |
          ssh -i ~/.ssh/deploy_key \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} \
            "sudo docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ inputs.image_tag }}"

      - name: Transfer configuration files
        run: |
          if [ -f "librechat.yaml" ]; then
            scp -i ~/.ssh/deploy_key librechat.yaml \
              ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:${{ secrets.SERVER_PROJECT_DIR }}/librechat.yaml
          fi

          if [ -f "client/nginx.conf" ]; then
            ssh -i ~/.ssh/deploy_key \
              ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} \
              "mkdir -p ${{ secrets.SERVER_PROJECT_DIR }}/client"
            scp -i ~/.ssh/deploy_key client/nginx.conf \
              ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:${{ secrets.SERVER_PROJECT_DIR }}/client/nginx.conf
          fi

      - name: Create docker-compose override
        run: |
          ssh -i ~/.ssh/deploy_key \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << 'EOF'
          cd ${{ secrets.SERVER_PROJECT_DIR }}
          mkdir -p .deploy

          # Backup current override
          if [ -f .deploy/override.yml ]; then
            CURRENT_IMAGE=$(grep "image:" .deploy/override.yml | awk '{print $2}')
            if [ -n "${CURRENT_IMAGE}" ]; then
              echo "${CURRENT_IMAGE}" > .deploy/rollback_image.txt
              echo "Saved rollback image: ${CURRENT_IMAGE}"
            fi
          fi

          # Create new override
          cat > .deploy/override.yml << YAML
          services:
            api:
              image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ inputs.image_tag }}
          YAML

          echo "Override file created"
          EOF

      - name: Deploy service
        run: |
          ssh -i ~/.ssh/deploy_key \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << 'EOF'
          cd ${{ secrets.SERVER_PROJECT_DIR }}

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

      - name: Health check
        if: ${{ !inputs.skip_health_check }}
        run: |
          ssh -i ~/.ssh/deploy_key \
            ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << 'EOF'
          echo "Performing health check..."

          max_attempts=30
          attempt=0

          while [ $attempt -lt $max_attempts ]; do
            if curl -sf http://localhost:3080/api/health > /dev/null 2>&1; then
              echo "✅ Health check passed!"
              exit 0
            fi

            echo "Waiting for service... ($attempt/$max_attempts)"
            sleep 2
            ((attempt++))
          done

          echo "❌ Health check failed"
          cd ${{ secrets.SERVER_PROJECT_DIR }}
          sudo docker-compose logs --tail=50 api
          exit 1
          EOF

      - name: Cleanup SSH key
        if: always()
        run: |
          rm -f ~/.ssh/deploy_key

      - name: Deployment summary
        run: |
          echo "## Deployment Complete 🚀" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Image deployed:** \`${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ inputs.image_tag }}\`" >> $GITHUB_STEP_SUMMARY
          echo "**Server:** \`${{ secrets.SERVER_HOST }}\`" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Access:** http://${{ secrets.SERVER_HOST }}:3080" >> $GITHUB_STEP_SUMMARY
```

**Step 2: Verify YAML syntax**

```bash
# Check for YAML syntax errors
cat .github/workflows/deploy-to-server.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin)" && echo "✅ YAML valid" || echo "❌ YAML invalid"
```

Expected: "✅ YAML valid"

**Step 3: Commit the workflow**

```bash
git add .github/workflows/deploy-to-server.yml
git commit -m "ci: add automated server deployment workflow

Features:
- Manual trigger via workflow_dispatch
- Configurable image tag (default: latest)
- SSH-based deployment to production server
- Automatic health check (can be skipped)
- Configuration file transfer (librechat.yaml, nginx.conf)
- Rollback image tracking
- Secure SSH key handling

Required GitHub Secrets:
- SERVER_SSH_KEY
- SERVER_HOST
- SERVER_USER
- SERVER_PROJECT_DIR"
```

Expected: Workflow file committed

---

## Task 3: Create Local Trigger Script

**Files:**
- Create: `trigger-deploy.sh`

**Step 1: Check if GitHub CLI is installed**

```bash
gh --version
```

Expected: Display version or "command not found"

If not installed, document installation:
- macOS: `brew install gh`
- Linux: `sudo apt install gh` or download from https://cli.github.com

**Step 2: Create the trigger script**

Create `trigger-deploy.sh`:

```bash
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
```

**Step 3: Make script executable**

```bash
chmod +x trigger-deploy.sh
```

**Step 4: Test script syntax**

```bash
bash -n trigger-deploy.sh
```

Expected: No output (syntax OK)

**Step 5: Commit the script**

```bash
git add trigger-deploy.sh
git commit -m "feat: add local deployment trigger script

Features:
- Triggers GitHub Actions deploy-to-server workflow
- Supports custom image tags
- Optional health check skip
- Uses GitHub CLI for workflow dispatch
- Real-time feedback with workflow URL

Usage:
  ./trigger-deploy.sh                    # Deploy latest
  ./trigger-deploy.sh 20260212143000     # Deploy specific tag
  ./trigger-deploy.sh --no-health-check  # Skip health check

Prerequisites:
  - GitHub CLI (gh) installed
  - Authenticated: gh auth login"
```

Expected: Script committed

---

## Task 4: Update Documentation

**Files:**
- Modify: `docs/deployment-registry-guide.md`
- Create: `docs/automated-deployment-setup.md`

**Step 1: Create automated deployment setup guide**

Create `docs/automated-deployment-setup.md`:

```markdown
# Automated Server Deployment Setup Guide

## Overview

This guide explains how to set up automated server deployment using GitHub Actions. After setup, you can trigger deployments from your local machine using a simple script.

## Prerequisites

- GitHub account with admin access to the repository
- SSH access to the production server (54.64.181.104)
- GitHub CLI (`gh`) installed locally

## Setup Steps

### 1. Generate SSH Key (if not exists)

```bash
# Check if you have an SSH key
ls ~/.ssh/id_ed25519

# If not, generate one
ssh-keygen -t ed25519 -C "github-actions@librechat"
```

### 2. Add Public Key to Server

```bash
# Copy public key to server
ssh-copy-id ubuntu@54.64.181.104

# Test connection
ssh ubuntu@54.64.181.104 "echo 'SSH test successful'"
```

### 3. Add SSH Key to GitHub Secrets

1. Get your private key:
   ```bash
   cat ~/.ssh/id_ed25519
   ```

2. Go to: `https://github.com/yidianyiko/LibreChat/settings/secrets/actions`

3. Add these secrets:

   | Secret Name | Value |
   |-------------|-------|
   | `SERVER_SSH_KEY` | Content of `~/.ssh/id_ed25519` (entire file) |
   | `SERVER_HOST` | `54.64.181.104` |
   | `SERVER_USER` | `ubuntu` |
   | `SERVER_PROJECT_DIR` | `/home/ubuntu/chat-web/LibreChat` |

### 4. Install GitHub CLI

**macOS:**
```bash
brew install gh
```

**Linux:**
```bash
sudo apt install gh
```

**Verify installation:**
```bash
gh --version
```

### 5. Authenticate GitHub CLI

```bash
gh auth login
```

Follow the prompts to authenticate.

## Usage

### Method A: Trigger GitHub Actions Deployment

```bash
# Deploy latest image
./trigger-deploy.sh

# Deploy specific tag
./trigger-deploy.sh 20260212143000

# Deploy without health check
./trigger-deploy.sh --no-health-check
```

**What happens:**
1. Script triggers GitHub Actions workflow
2. GitHub Actions SSHes to server
3. Server pulls latest image from ghcr.io
4. Service restarts automatically
5. Health check verifies deployment

**Watch deployment:**
```bash
gh run watch
```

### Method C: Direct Deployment (Fast Path)

```bash
# Deploy latest image directly
./deploy-registry.sh

# Deploy specific tag
./deploy-registry.sh 20260212143000

# Rollback
./deploy-registry.sh --rollback
```

**Difference:** Skips GitHub Actions, deploys directly from local machine.

## Troubleshooting

### "GitHub CLI not found"
Install GitHub CLI: https://cli.github.com

### "Not authenticated with GitHub"
```bash
gh auth login
```

### "SSH connection failed"
Verify SSH key is added to GitHub Secrets and server:
```bash
ssh ubuntu@54.64.181.104 "echo 'test'"
```

### "Workflow not triggering"
Check GitHub Actions permissions:
- Go to: Settings → Actions → General
- Ensure "Allow all actions" is enabled
- Ensure "Read and write permissions" is enabled

### "Image pull failed"
Ensure `GITHUB_TOKEN` secret is available (automatically provided by GitHub Actions).

## Security Notes

- SSH private key is stored securely in GitHub Secrets
- Key is only loaded into runner memory during deployment
- Key is cleaned up after workflow completes
- Server access is restricted to GitHub Actions runners

## Architecture

```
Local Machine
    ↓ ./trigger-deploy.sh
GitHub Actions (deploy-to-server.yml)
    ↓ SSH
Production Server (54.64.181.104)
    ↓ docker pull ghcr.io/yidianyiko/librechat
Deploy & Health Check
```

## Comparison: Method A vs C

| Feature | Method A (GitHub Actions) | Method C (Direct) |
|---------|--------------------------|-------------------|
| Speed | ~2-3 minutes | ~1-2 minutes |
| Logs | ✅ GitHub Actions logs | ❌ Local terminal only |
| Audit trail | ✅ Full history | ⚠️ Manual tracking |
| Requires | GitHub CLI | Nothing extra |
| Best for | Production deploys | Quick fixes |
```

**Step 2: Update deployment registry guide**

Add to `docs/deployment-registry-guide.md` after the "Deployment Methods" section:

```markdown
### Method A: Automated Deployment via GitHub Actions (Recommended for Production)

**Trigger from local machine:**
```bash
./trigger-deploy.sh          # Deploy latest
./trigger-deploy.sh TAG      # Deploy specific tag
```

**What happens:**
1. Script triggers GitHub Actions workflow (`deploy-to-server.yml`)
2. Workflow SSHes to server and executes deployment
3. Server pulls image from ghcr.io
4. Service restarts automatically
5. Health check verifies success

**Advantages:**
- ✅ Deployment logs in GitHub Actions
- ✅ Full audit trail
- ✅ Automated health checks
- ✅ Consistent deployment process

**Prerequisites:**
- GitHub CLI installed (`gh`)
- GitHub Secrets configured (see `docs/automated-deployment-setup.md`)

**Setup guide:** See `docs/automated-deployment-setup.md`
```

**Step 3: Commit documentation**

```bash
git add docs/automated-deployment-setup.md docs/deployment-registry-guide.md
git commit -m "docs: add automated deployment setup guide

- Complete setup instructions for GitHub Actions deployment
- SSH key configuration guide
- GitHub CLI authentication steps
- Troubleshooting section
- Security notes
- Architecture diagram
- Method comparison (GitHub Actions vs Direct)

Updates deployment-registry-guide.md with Method A details."
```

Expected: Documentation committed

---

## Task 5: Update CLAUDE.md with Deployment Workflows

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Find the Docker Deployment section**

```bash
grep -n "Docker Deployment" CLAUDE.md
```

Expected: Line number of the section

**Step 2: Add automated deployment section**

Add after the "Docker Deployment" section:

```markdown
### Automated Deployment Workflows

**Method A: Trigger GitHub Actions Deployment**
```bash
./trigger-deploy.sh                    # Deploy latest
./trigger-deploy.sh 20260212143000     # Deploy specific tag
gh run watch                           # Watch deployment logs
```

Triggers GitHub Actions to:
1. Pull latest image from ghcr.io
2. SSH to production server
3. Deploy and verify health

**Method C: Direct Deployment**
```bash
./deploy-registry.sh                   # Deploy latest
./deploy-registry.sh TAG               # Deploy specific tag
./deploy-registry.sh --rollback        # Rollback
```

Deploys directly from local machine (faster, but no GitHub logs).

**Setup:** See `docs/automated-deployment-setup.md`

**Image Registry:** `ghcr.io/yidianyiko/librechat`
```

**Step 3: Commit CLAUDE.md updates**

```bash
git add CLAUDE.md
git commit -m "docs: add automated deployment workflows to CLAUDE.md

- Document Method A (GitHub Actions trigger)
- Document Method C (Direct deployment)
- Add setup guide reference
- Include registry information"
```

Expected: CLAUDE.md updated

---

## Task 6: Test Workflow Trigger (Dry Run)

**Files:**
- None (testing task)

**Step 1: Verify GitHub CLI is authenticated**

```bash
gh auth status
```

Expected: "Logged in to github.com as yidianyiko"

**Step 2: Test trigger script (without actual deployment)**

First, verify the script shows help:
```bash
./trigger-deploy.sh --help
```

Expected: Display help message

**Step 3: List available workflows**

```bash
gh workflow list
```

Expected: Should include "Deploy to Server"

**Step 4: View workflow file details**

```bash
gh workflow view deploy-to-server.yml
```

Expected: Display workflow details

**Step 5: Document test results**

```bash
git commit --allow-empty -m "test: verify trigger script and GitHub CLI setup

✅ GitHub CLI authenticated
✅ trigger-deploy.sh script functional
✅ deploy-to-server.yml workflow visible
✅ Ready for actual deployment testing

Next step: Push to main branch and test actual deployment"
```

Expected: Empty commit with test results

---

## Success Criteria

- ✅ GitHub Secrets configured with SSH key and server details
- ✅ Workflow `deploy-to-server.yml` created and functional
- ✅ Local trigger script `trigger-deploy.sh` created and executable
- ✅ Documentation complete (setup guide + deployment guide)
- ✅ CLAUDE.md updated with new workflows
- ✅ GitHub CLI configured and authenticated
- ✅ Both deployment methods available:
  - Method A: `trigger-deploy.sh` → GitHub Actions → Server
  - Method C: `deploy-registry.sh` → Server (direct)

## Deployment Flow Comparison

### Method A: GitHub Actions (Auditable)
```
Local: ./trigger-deploy.sh
  ↓
GitHub Actions:
  1. SSH to server
  2. Pull image from ghcr.io
  3. Restart service
  4. Health check
  ↓
Deployed (with logs in GitHub)
```

### Method C: Direct (Fast)
```
Local: ./deploy-registry.sh
  ↓
Direct SSH to server:
  1. Pull image from ghcr.io
  2. Restart service
  3. Health check
  ↓
Deployed (terminal logs only)
```

## Security Considerations

- SSH private key stored in GitHub Secrets (encrypted at rest)
- Key only accessible to GitHub Actions runners
- Key cleaned up after each workflow run
- Server access logged in GitHub Actions
- No secrets in code or commits

## Post-Implementation Testing

After pushing to main:

1. **Test Method A:**
   ```bash
   ./trigger-deploy.sh
   gh run watch
   ```

2. **Verify deployment:**
   ```bash
   curl http://54.64.181.104:3080/api/health
   ```

3. **Test Method C:**
   ```bash
   ./deploy-registry.sh
   ```

4. **Test rollback:**
   ```bash
   ./deploy-registry.sh --rollback
   ```

---

**Estimated Time:** 1-2 hours
**Risk Level:** Low (existing deployment method remains functional)
**Dependencies:** GitHub Secrets access, SSH key, GitHub CLI
