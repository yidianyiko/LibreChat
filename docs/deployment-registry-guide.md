# LibreChat Registry-Based Deployment Guide

## Overview

LibreChat supports registry-based deployment using GitHub Container Registry (ghcr.io). This eliminates the need for tarball transfers and provides faster, more reliable deployments.

**Image Registry**: `ghcr.io/yidianyiko/librechat`

## Deployment Methods

This guide covers two deployment methods:

- **Method A**: Automated deployment via GitHub Actions (Recommended)
- **Method C**: Direct deployment from local machine (Fast path)

### Method Comparison

| Feature | Method A (GitHub Actions) | Method C (Direct) |
|---------|---------------------------|-------------------|
| Speed | 2-3 minutes | 1-2 minutes |
| Audit trail | Full GitHub Actions history | Local terminal only |
| Logs | Persistent in GitHub | Ephemeral |
| Best for | Production deployments | Quick fixes |
| Requirements | GitHub CLI | SSH access |

---

## Method A: Automated Deployment via GitHub Actions (Recommended)

### Overview

Trigger deployment from your local machine, and GitHub Actions handles the entire deployment process including SSH connection, image pulling, service restart, and health verification.

### Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- GitHub Secrets configured (see [Setup Guide](automated-deployment-setup.md))

### Quick Start

```bash
# Deploy latest image
./trigger-deploy.sh

# Deploy specific tag
./trigger-deploy.sh 20260212143000

# Deploy without health check (faster)
./trigger-deploy.sh --no-health-check

# View help
./trigger-deploy.sh --help
```

### What Happens During Deployment

1. **Local Script** (`trigger-deploy.sh`)
   - Verifies GitHub CLI is installed and authenticated
   - Triggers GitHub Actions workflow via API
   - Provides workflow run URL for monitoring

2. **GitHub Actions** (`deploy-to-server.yml`)
   - Sets up SSH credentials from GitHub Secrets
   - Connects to production server via SSH
   - Logs into GitHub Container Registry
   - Pulls specified Docker image
   - Transfers configuration files (librechat.yaml, nginx.conf)
   - Creates docker-compose override with new image
   - Restarts API service
   - Performs health check (unless skipped)
   - Cleans up SSH credentials

3. **Server**
   - Pulls image from `ghcr.io/yidianyiko/librechat:TAG`
   - Restarts API container with new image
   - Verifies service health

### Monitoring Deployment

**Watch deployment in real-time:**

```bash
# Start deployment
./trigger-deploy.sh

# Watch progress
gh run watch

# Or view in browser
gh workflow view deploy-to-server.yml --web
```

**Check deployment status:**

```bash
# List recent deployments
gh run list --workflow=deploy-to-server.yml --limit=5

# View specific deployment logs
gh run view RUN_ID --log

# Check service health
curl http://54.64.181.104:3080/api/health
```

### Advantages of Method A

- Full deployment audit trail in GitHub Actions
- Persistent, searchable logs
- Automated health checks
- Consistent deployment process
- Team visibility (everyone can see deployments)
- Concurrency protection (prevents simultaneous deploys)
- Easy rollback via workflow re-run

### Setup Required

Before using Method A, complete the setup process:

1. Generate SSH key
2. Add public key to server
3. Configure GitHub Secrets (SERVER_SSH_KEY, SERVER_HOST, SERVER_USER, SERVER_PROJECT_DIR)
4. Install and authenticate GitHub CLI

**Complete setup instructions**: See [Automated Deployment Setup Guide](automated-deployment-setup.md)

---

## Method C: Direct Deployment (Fast Path)

### Overview

Deploy directly from your local machine to the production server. This method is faster but provides no GitHub Actions audit trail.

### Prerequisites

- SSH access to production server (ubuntu@54.64.181.104)
- GitHub token in `~/.git-credentials` for registry authentication

### Quick Start

```bash
# Deploy latest image
./deploy-registry.sh

# Deploy specific tag
./deploy-registry.sh 20260212143000

# Rollback to previous version
./deploy-registry.sh --rollback

# Deploy to different server
./deploy-registry.sh --server IP_ADDRESS

# View help
./deploy-registry.sh --help
```

### What Happens During Deployment

1. **Pre-flight Checks**
   - Verifies GitHub token exists
   - Checks remote server environment (Docker, docker-compose)

2. **Registry Login**
   - Authenticates with ghcr.io on server using GitHub token

3. **Image Pull**
   - Pulls specified image tag from GitHub Container Registry

4. **Configuration Transfer**
   - Transfers `librechat.yaml` to server
   - Transfers `client/nginx.conf` to server

5. **Deployment**
   - Creates docker-compose override file
   - Saves current image for rollback
   - Restarts API service with new image

6. **Health Check**
   - Verifies service is responding (30 attempts, 2s intervals)
   - Shows recent logs if health check fails

### Environment Variables

Configure these variables for custom setups:

```bash
# Set custom server IP
export SERVER_IP="1.2.3.4"

# Set custom SSH user
export SERVER_USER="deploy-user"

# Then run deployment
./deploy-registry.sh
```

### Rollback Procedure

If deployment fails or introduces issues:

```bash
# Automatic rollback to previous version
./deploy-registry.sh --rollback
```

The script saves the previous image tag automatically in `.deploy/rollback_image.txt` on the server.

### Advantages of Method C

- Faster deployment (1-2 minutes)
- No GitHub CLI required
- Works when GitHub Actions is unavailable
- Direct control and immediate feedback
- Useful for emergency fixes

### When to Use Method C

- Quick bug fixes requiring immediate deployment
- Development/staging environment deployments
- Emergency rollbacks when GitHub is unavailable
- Personal development iterations
- When audit trail is not required

---

## Configuration Files

Both deployment methods automatically transfer updated configuration files:

### librechat.yaml

Main application configuration file:

```yaml
# API endpoints, model configurations, feature flags
# Location on server: /home/ubuntu/chat-web/LibreChat/librechat.yaml
```

### client/nginx.conf

Nginx reverse proxy configuration (if using deploy-compose.yml):

```nginx
# Reverse proxy settings for client container
# Location on server: /home/ubuntu/chat-web/LibreChat/client/nginx.conf
```

**To update configurations:**

1. Edit files locally
2. Run deployment script (files are transferred automatically)
3. Service restarts with new configuration

---

## Image Tags

Both methods support deploying specific image tags:

### Tag Format

Tags use timestamp format: `YYYYMMDDHHmmss`

Example: `20260212143000` = February 12, 2026, 14:30:00 UTC

### Finding Available Tags

**Option 1: GitHub CLI**

```bash
gh api /user/packages/container/librechat/versions | jq '.[].metadata.container.tags[]'
```

**Option 2: GitHub Web UI**

Navigate to: https://github.com/users/yidianyiko/packages/container/librechat

**Option 3: Docker API**

```bash
curl -s https://ghcr.io/v2/yidianyiko/librechat/tags/list | jq
```

### Deploying Specific Tags

```bash
# Method A
./trigger-deploy.sh 20260212143000

# Method C
./deploy-registry.sh 20260212143000
```

### Latest Tag

The `latest` tag always points to the most recent successful build from the main branch:

```bash
# Deploy latest (default)
./trigger-deploy.sh
./deploy-registry.sh
```

---

## Server Architecture

### Current Setup

```
Production Server (54.64.181.104)
├── /home/ubuntu/chat-web/LibreChat/
│   ├── docker-compose.yml          # Main compose file
│   ├── .env                        # Environment variables
│   ├── librechat.yaml              # App configuration
│   ├── .deploy/
│   │   ├── override.yml            # Image override
│   │   └── rollback_image.txt      # Previous image tag
│   ├── client/
│   │   └── nginx.conf              # Nginx config
│   ├── data-node/                  # MongoDB data
│   ├── uploads/                    # User uploads
│   ├── logs/                       # Application logs
│   └── images/                     # Public images
```

### Docker Compose Override

Both deployment methods use docker-compose override files to specify image versions:

**docker-compose.yml** (base configuration):
```yaml
services:
  api:
    build: .
    # Other service configuration...
```

**.deploy/override.yml** (deployment override):
```yaml
services:
  api:
    image: ghcr.io/yidianyiko/librechat:20260212143000
```

**Deployment command**:
```bash
sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api
```

This approach allows:
- Version-pinned deployments
- Easy rollbacks
- No modification of base docker-compose.yml
- Consistent deployment process

---

## Troubleshooting

### Common Issues

#### GitHub CLI Issues (Method A)

**Problem**: "command not found: gh"

**Solution**:
```bash
# macOS
brew install gh

# Linux
sudo apt install gh
```

**Problem**: "Not authenticated with GitHub"

**Solution**:
```bash
gh auth login
```

#### SSH Issues (Both Methods)

**Problem**: "Permission denied (publickey)"

**Solution**:
```bash
# Verify SSH key is added to server
ssh-copy-id ubuntu@54.64.181.104

# Test connection
ssh ubuntu@54.64.181.104 "echo 'test'"
```

**Problem**: "Connection timeout"

**Solution**:
- Verify server IP is correct: `54.64.181.104`
- Check firewall rules allow SSH (port 22)
- Ensure server is running: `ping 54.64.181.104`

#### Image Pull Issues

**Problem**: "pull access denied"

**Solution**:
```bash
# Verify GitHub token is in ~/.git-credentials
cat ~/.git-credentials | grep github.com

# Re-authenticate if needed
gh auth login
```

**Problem**: "image not found"

**Solution**:
```bash
# Verify image exists
gh api /user/packages/container/librechat/versions | jq '.[].metadata.container.tags[]'

# Ensure image tag is correct
./trigger-deploy.sh latest
```

#### Service Issues

**Problem**: "Health check failed"

**Solution**:
```bash
# SSH to server and check logs
ssh ubuntu@54.64.181.104
cd /home/ubuntu/chat-web/LibreChat
sudo docker-compose logs --tail=100 api

# Check service status
sudo docker-compose ps

# Test health endpoint
curl -v http://localhost:3080/api/health
```

**Problem**: "Service starts then crashes"

**Solution**:
1. Check environment variables in `.env`
2. Verify MongoDB is running: `sudo docker-compose ps mongodb`
3. Check for port conflicts: `sudo netstat -tlnp | grep 3080`
4. Review startup logs for errors

### Debug Commands

```bash
# View deployment logs (Method A)
gh run view --log

# View server logs
ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && sudo docker-compose logs --tail=100 api"

# Check running containers
ssh ubuntu@54.64.181.104 "sudo docker ps"

# Check docker-compose status
ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && sudo docker-compose ps"

# View current image
ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && cat .deploy/override.yml"

# View rollback image
ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && cat .deploy/rollback_image.txt"
```

---

## Advanced Usage

### Custom Server Configuration

For deploying to different servers:

```bash
# Method C with custom server
SERVER_IP="1.2.3.4" SERVER_USER="ubuntu" ./deploy-registry.sh

# Or use command-line flags
./deploy-registry.sh --server 1.2.3.4
```

### Skip Health Check (Method A only)

For faster deployments when you're confident:

```bash
./trigger-deploy.sh --no-health-check
```

**Warning**: Use only when you've thoroughly tested the image. Skipping health check may result in deploying a broken service.

### Concurrent Deployments

**Method A**: Prevented by GitHub Actions concurrency groups (safe)

**Method C**: Possible but not recommended (can cause race conditions)

If multiple deployments are needed:
1. Use Method A to leverage concurrency protection
2. Or ensure only one person deploys at a time with Method C

### Emergency Procedures

**Scenario 1: GitHub Actions is down**

Use Method C for direct deployment:
```bash
./deploy-registry.sh
```

**Scenario 2: Bad deployment needs immediate rollback**

```bash
# Fast rollback via Method C
./deploy-registry.sh --rollback

# Or deploy known-good version
./deploy-registry.sh 20260212120000
```

**Scenario 3: Server is unresponsive**

```bash
# SSH to server
ssh ubuntu@54.64.181.104

# Check Docker status
sudo systemctl status docker

# Restart Docker if needed
sudo systemctl restart docker

# Restart all services
cd /home/ubuntu/chat-web/LibreChat
sudo docker-compose restart
```

---

## Security Considerations

### SSH Key Management

- Private keys are stored encrypted in GitHub Secrets
- Keys are only loaded during workflow execution
- Keys are automatically cleaned up after deployment
- Rotate SSH keys every 90 days (recommended)

### Registry Authentication

- GitHub tokens are used for registry authentication
- Tokens are automatically managed by GitHub Actions
- For local deployment, tokens are read from `~/.git-credentials`
- Never commit tokens to repository

### Best Practices

1. **Use Method A for production**: Provides full audit trail
2. **Limit server access**: Only authorized users should have SSH access
3. **Monitor deployments**: Review GitHub Actions logs regularly
4. **Test before deploying**: Deploy to staging first when possible
5. **Keep secrets updated**: Rotate keys and tokens periodically
6. **Review permissions**: Ensure GitHub Secrets have appropriate access controls

---

## CI/CD Integration

### Automated Builds

Images are automatically built and pushed to ghcr.io by the production workflow:

**Workflow**: `.github/workflows/deploy-production.yml`

**Trigger**: Push to `main` branch or manual workflow dispatch

**Output**: `ghcr.io/yidianyiko/librechat:latest` and `ghcr.io/yidianyiko/librechat:TIMESTAMP`

### Full CI/CD Pipeline

```
Code Change
    ↓
Push to main branch
    ↓
GitHub Actions: deploy-production.yml
    ├─ Build Docker image (multi-stage)
    ├─ Push to ghcr.io with timestamp tag
    └─ Tag as latest
    ↓
Trigger deployment (manual)
    ├─ Method A: ./trigger-deploy.sh
    └─ Method C: ./deploy-registry.sh
    ↓
Production Server
    ├─ Pull image from ghcr.io
    ├─ Restart API service
    └─ Verify health
```

### Future Enhancements

Potential improvements to the deployment process:

- Automatic deployment on successful build (optional)
- Blue-green deployment support
- Canary deployments
- Automated rollback on health check failure
- Slack/Discord notifications
- Deployment metrics and monitoring

---

## Additional Resources

- **Automated Deployment Setup**: [docs/automated-deployment-setup.md](automated-deployment-setup.md)
- **Deployment Architecture Comparison**: [docs/deployment-architecture-comparison.md](deployment-architecture-comparison.md)
- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **GitHub Container Registry**: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **Docker Compose Documentation**: https://docs.docker.com/compose/

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review GitHub Actions logs: `gh run view --log`
3. Check server logs: `ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && sudo docker-compose logs"`
4. Contact DevOps team or open GitHub issue

---

**Last Updated**: 2026-02-12
**Maintained By**: DevOps Team
