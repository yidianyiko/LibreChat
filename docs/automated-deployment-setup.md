# Automated Server Deployment Setup Guide

## Overview

This guide explains how to set up automated server deployment using GitHub Actions. After setup, you can trigger deployments from your local machine using a simple script that orchestrates the entire deployment process through GitHub Actions.

## Architecture

```
┌─────────────────┐
│ Local Machine   │
│                 │
│ trigger-deploy  │
│     .sh         │
└────────┬────────┘
         │ gh workflow run
         ▼
┌──────────────────────────────────┐
│ GitHub Actions                   │
│ (deploy-to-server.yml)           │
│                                  │
│ 1. Setup SSH credentials         │
│ 2. Login to ghcr.io             │
│ 3. SSH to server                │
│ 4. Pull Docker image            │
│ 5. Transfer config files        │
│ 6. Create docker-compose        │
│    override                     │
│ 7. Deploy service               │
│ 8. Health check                 │
└────────┬─────────────────────────┘
         │ SSH connection
         ▼
┌──────────────────────────────────┐
│ Production Server                │
│ (54.64.181.104)                 │
│                                  │
│ /home/ubuntu/chat-web/LibreChat │
│                                  │
│ - Pull ghcr.io image            │
│ - Restart API container         │
│ - Verify health                 │
└──────────────────────────────────┘
```

## Prerequisites

Before setting up automated deployment, ensure you have:

- **GitHub Admin Access**: Repository admin privileges to manage secrets
- **SSH Access**: Ability to SSH into production server (ubuntu@54.64.181.104)
- **GitHub CLI**: Install `gh` command-line tool locally
- **Docker Access**: Server has Docker and docker-compose installed

## Setup Steps

### 1. Generate SSH Key (if not exists)

Check if you already have an SSH key:

```bash
ls -la ~/.ssh/id_rsa ~/.ssh/id_ed25519
```

If you don't have a key, generate one (Ed25519 is recommended):

```bash
# Generate Ed25519 key (modern, secure)
ssh-keygen -t ed25519 -C "github-actions@librechat"

# OR generate RSA key (for older systems)
ssh-keygen -t rsa -b 4096 -C "github-actions@librechat"
```

When prompted:
- **File location**: Press Enter to use default location
- **Passphrase**: Leave empty for GitHub Actions (or use if deploying manually only)

### 2. Add Public Key to Server

Copy your public key to the production server:

```bash
# Copy public key to server
ssh-copy-id ubuntu@54.64.181.104

# If ssh-copy-id is not available:
cat ~/.ssh/id_ed25519.pub | ssh ubuntu@54.64.181.104 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Test the SSH connection:

```bash
ssh ubuntu@54.64.181.104 "echo 'SSH connection successful'"
```

Expected output: `SSH connection successful`

### 3. Add SSH Key to GitHub Secrets

**Step 3.1: Get your private key content**

```bash
# For Ed25519 key
cat ~/.ssh/id_ed25519

# For RSA key
cat ~/.ssh/id_rsa
```

Copy the ENTIRE output, including the `-----BEGIN` and `-----END` lines.

**Step 3.2: Add secrets to GitHub**

1. Navigate to your repository on GitHub
2. Go to: **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add the following secrets one by one:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `SERVER_SSH_KEY` | Content of `~/.ssh/id_ed25519` (entire file) | Private SSH key for server access |
| `SERVER_HOST` | `54.64.181.104` | Production server IP address |
| `SERVER_USER` | `ubuntu` | SSH username on server |
| `SERVER_PROJECT_DIR` | `/home/ubuntu/chat-web/LibreChat` | Project directory on server |

**Important Notes:**
- Include the entire private key, including BEGIN/END markers
- Do NOT add quotes around the key content
- Each secret should be added separately
- Verify there are no extra spaces or line breaks

### 4. Install GitHub CLI

The GitHub CLI (`gh`) is required to trigger workflows from your local machine.

**macOS:**
```bash
brew install gh
```

**Linux (Debian/Ubuntu):**
```bash
# Add GitHub CLI repository
type -p curl >/dev/null || (sudo apt update && sudo apt install curl -y)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

# Install
sudo apt update
sudo apt install gh
```

**Linux (Fedora/CentOS/RHEL):**
```bash
sudo dnf install gh
```

**Windows:**
```bash
# Using winget
winget install --id GitHub.cli

# OR using Chocolatey
choco install gh
```

**Verify installation:**
```bash
gh --version
```

Expected output: `gh version X.XX.X (YYYY-MM-DD)`

### 5. Authenticate GitHub CLI

Authenticate the GitHub CLI with your GitHub account:

```bash
gh auth login
```

Follow the interactive prompts:
1. **What account do you want to log into?** → `GitHub.com`
2. **What is your preferred protocol?** → `HTTPS` (recommended)
3. **Authenticate Git with your GitHub credentials?** → `Yes`
4. **How would you like to authenticate?** → `Login with a web browser` (easiest)

Copy the one-time code and press Enter to open the browser. Paste the code and authorize the GitHub CLI.

Verify authentication:
```bash
gh auth status
```

Expected output:
```
✓ Logged in to github.com as your-username (oauth_token)
✓ Git operations for github.com configured to use https protocol.
✓ Token: *******************
```

## Usage

Once setup is complete, you have two deployment methods available:

### Method A: Trigger GitHub Actions Deployment (Recommended for Production)

Use the `trigger-deploy.sh` script to trigger deployment through GitHub Actions:

```bash
# Deploy latest image
./trigger-deploy.sh

# Deploy specific tag
./trigger-deploy.sh 20260212143000

# Deploy without health check (faster, but no verification)
./trigger-deploy.sh --no-health-check

# View help
./trigger-deploy.sh --help
```

**What happens during deployment:**

1. **Script execution** (`trigger-deploy.sh`)
   - Verifies GitHub CLI is installed and authenticated
   - Triggers the `deploy-to-server.yml` workflow via GitHub API
   - Provides workflow run URL for monitoring

2. **GitHub Actions execution** (`deploy-to-server.yml`)
   - Checks out repository code
   - Sets up SSH credentials from GitHub Secrets
   - Logs into GitHub Container Registry on server
   - Pulls specified Docker image to server
   - Transfers configuration files (librechat.yaml, nginx.conf)
   - Creates docker-compose override with new image tag
   - Restarts API service
   - Performs health check (unless skipped)
   - Cleans up SSH credentials

3. **Server execution**
   - Pulls latest image from `ghcr.io/yidianyiko/librechat:TAG`
   - Stops old API container
   - Starts new API container with updated image
   - Verifies service health

**Watch deployment logs:**

```bash
# Watch the latest workflow run
gh run watch

# Watch specific run
gh run watch RUN_ID

# View completed run logs
gh run view RUN_ID --log
```

**Check deployment status:**

```bash
# List recent workflow runs
gh run list --workflow=deploy-to-server.yml --limit=5

# View workflow details in browser
gh workflow view deploy-to-server.yml --web
```

### Method C: Direct Deployment (Fast Path)

Use the `deploy-registry.sh` script to deploy directly from your local machine:

```bash
# Deploy latest image
./deploy-registry.sh

# Deploy specific tag
./deploy-registry.sh 20260212143000

# Rollback to previous version
./deploy-registry.sh --rollback

# Deploy to different server
./deploy-registry.sh --server 1.2.3.4

# View help
./deploy-registry.sh --help
```

**Differences from Method A:**

- **Speed**: Faster (~1-2 minutes vs 2-3 minutes)
- **Logs**: Only in local terminal (no GitHub Actions history)
- **Audit trail**: Manual tracking required
- **Requirements**: Direct SSH access from local machine
- **Best for**: Quick fixes, emergency deployments, development iterations

## Troubleshooting

### GitHub CLI Issues

**Problem: "command not found: gh"**

Solution: Install GitHub CLI following step 4 above.

**Problem: "Not authenticated with GitHub"**

Solution:
```bash
gh auth login
```

Follow the prompts to authenticate.

**Problem: "Insufficient permissions to trigger workflow"**

Solution:
1. Verify your GitHub account has write access to the repository
2. Check GitHub Actions permissions:
   - Go to: **Settings** → **Actions** → **General**
   - Ensure "Allow all actions" is enabled
   - Ensure "Read and write permissions" is enabled for workflows

### SSH Connection Issues

**Problem: "Permission denied (publickey)"**

Solution:
```bash
# Verify SSH key is added to server
ssh-copy-id ubuntu@54.64.181.104

# Test connection manually
ssh ubuntu@54.64.181.104 "echo 'test'"

# Check if key is in GitHub Secrets (should show masked value)
gh secret list
```

**Problem: "Host key verification failed"**

Solution:
```bash
# Add server to known_hosts
ssh-keyscan -H 54.64.181.104 >> ~/.ssh/known_hosts
```

### Workflow Issues

**Problem: "Workflow not found"**

Solution:
```bash
# List available workflows
gh workflow list

# Verify workflow file exists
ls .github/workflows/deploy-to-server.yml

# If missing, ensure code is pushed to main branch
git push origin main
```

**Problem: "SSH connection failed in workflow"**

Solution:
1. Verify `SERVER_SSH_KEY` secret contains the complete private key
2. Ensure the key has been added to the server's `authorized_keys`
3. Check server firewall allows SSH connections
4. View workflow logs for detailed error:
   ```bash
   gh run view --log
   ```

### Image Pull Issues

**Problem: "Error response from daemon: pull access denied"**

Solution:
1. Verify GitHub Container Registry authentication:
   ```bash
   # On server
   echo "$GITHUB_TOKEN" | sudo docker login ghcr.io -u USERNAME --password-stdin
   ```

2. Ensure image exists and is accessible:
   ```bash
   # List available images
   gh api /user/packages/container/librechat/versions
   ```

3. Check image visibility (should be public or accessible with token):
   - Go to: **Packages** → **librechat** → **Package settings**
   - Verify visibility settings

### Health Check Issues

**Problem: "Health check failed after deployment"**

Solution:
```bash
# SSH to server and check logs
ssh ubuntu@54.64.181.104
cd /home/ubuntu/chat-web/LibreChat
sudo docker-compose logs --tail=100 api

# Check if service is running
sudo docker-compose ps

# Test health endpoint manually
curl -v http://localhost:3080/api/health

# Check for port conflicts
sudo netstat -tlnp | grep 3080
```

**Problem: "Service starts but immediately crashes"**

Solution:
1. Check environment variables in `.env` file
2. Verify MongoDB connection:
   ```bash
   sudo docker-compose logs mongodb
   ```
3. Check for missing dependencies or configuration files
4. Review API logs for startup errors

### Common Error Messages

**"gh: command not found"**
- Install GitHub CLI (see step 4)

**"authentication required"**
- Run `gh auth login` to authenticate

**"repository not found"**
- Verify you're in the correct repository directory
- Check remote URL: `git remote -v`

**"secret SERVER_SSH_KEY not found"**
- Add SSH key to GitHub Secrets (see step 3)

**"connection timeout"**
- Verify server IP address is correct
- Check server firewall rules
- Ensure SSH service is running on server

## Security Considerations

### SSH Key Security

- **Storage**: Private key is stored encrypted in GitHub Secrets
- **Access**: Only accessible to GitHub Actions runners during workflow execution
- **Lifecycle**: Key is loaded into memory, used, and immediately deleted after workflow
- **Rotation**: Rotate SSH keys periodically (recommended: every 90 days)

### Best Practices

1. **Use Ed25519 keys**: More secure and faster than RSA
2. **No passphrase for automation**: Required for GitHub Actions (key is protected by GitHub Secrets encryption)
3. **Separate keys**: Use different SSH keys for different purposes (personal, automation, etc.)
4. **Key rotation**: Set calendar reminder to rotate keys quarterly
5. **Audit access**: Review GitHub Actions logs regularly

### What GitHub Can Access

- **SSH Key**: Encrypted at rest, only decrypted in runner memory
- **Server Access**: Limited to actions defined in workflow
- **Repository Code**: Full read access during workflow
- **Secrets**: Masked in logs, never displayed in plain text

### What GitHub Cannot Access

- **Other GitHub Secrets**: Each secret is isolated
- **Server Root Access**: Limited to SSH user permissions (ubuntu)
- **Database Contents**: No direct database access from workflow
- **Environment Files**: Not transferred unless explicitly configured

### Monitoring and Auditing

**View deployment history:**
```bash
# List all deployment runs
gh run list --workflow=deploy-to-server.yml

# View specific run details
gh run view RUN_ID

# Download run logs for audit
gh run view RUN_ID --log > deployment-RUN_ID.log
```

**Check secret updates:**
```bash
# List all secrets (values are masked)
gh secret list

# View when secrets were last updated
gh api repos/:owner/:repo/actions/secrets
```

## Comparison: Method A vs Method C

| Feature | Method A (GitHub Actions) | Method C (Direct) |
|---------|---------------------------|-------------------|
| **Speed** | 2-3 minutes | 1-2 minutes |
| **Audit trail** | Full GitHub Actions history | Manual terminal logs |
| **Logs** | Persistent, searchable | Ephemeral, local only |
| **Rollback** | Via GitHub Actions | Via script flag |
| **Health check** | Automated (optional) | Automated (always) |
| **SSH requirement** | GitHub Actions → Server | Local → Server |
| **GitHub CLI** | Required | Not required |
| **Internet dependency** | High (GitHub + GHCR) | Medium (GHCR only) |
| **Best for** | Production deployments | Quick fixes, iterations |
| **Team visibility** | High (everyone can see) | Low (individual deploys) |
| **Failure debugging** | GitHub Actions logs | Local terminal output |
| **Concurrent deploys** | Prevented by concurrency | Possible (not recommended) |

### When to Use Method A

- Production deployments that need audit trail
- Team environments where visibility is important
- Scheduled or automated deployments
- When deployment logs should be persistent
- When multiple team members deploy

### When to Use Method C

- Quick bug fixes that need immediate deployment
- Development/staging environment deployments
- Emergency rollbacks
- When GitHub Actions is unavailable
- Personal development iterations

## Advanced Usage

### Custom Image Tags

Both methods support deploying specific image tags:

```bash
# Method A: Deploy specific build
./trigger-deploy.sh 20260212143000

# Method C: Deploy specific build
./deploy-registry.sh 20260212143000
```

**Tag format**: `YYYYMMDDHHmmss` (timestamp of build)

**Find available tags:**
```bash
# List recent images
gh api /user/packages/container/librechat/versions | jq '.[].metadata.container.tags[]'

# OR check GitHub Container Registry
# https://github.com/users/yidianyiko/packages/container/librechat
```

### Skip Health Check

For faster deployments when you're confident the service will start correctly:

```bash
# Method A only
./trigger-deploy.sh --no-health-check

# Method C always performs health check
```

**Warning**: Skipping health check may result in deploying a broken service. Use only when:
- You've tested the image thoroughly
- You're deploying a configuration-only change
- You have monitoring alerts configured

### Rollback Procedure

If a deployment fails or introduces issues:

**Option 1: Rollback via deploy-registry.sh**
```bash
./deploy-registry.sh --rollback
```

**Option 2: Manual rollback**
```bash
# SSH to server
ssh ubuntu@54.64.181.104

# Check rollback image
cd /home/ubuntu/chat-web/LibreChat
cat .deploy/rollback_image.txt

# Deploy previous image
./deploy-registry.sh $(cat .deploy/rollback_image.txt)
```

**Option 3: Deploy specific known-good tag**
```bash
./trigger-deploy.sh 20260212120000
```

### Configuration File Updates

Both deployment methods automatically transfer updated configuration files:

**Transferred files:**
- `librechat.yaml` → Server config directory
- `client/nginx.conf` → Server client directory

**To update configurations:**
1. Edit files locally
2. Run deployment script (files will be transferred automatically)
3. Service restarts with new configuration

### Monitoring Deployment

**Real-time monitoring (Method A):**
```bash
# Start deployment
./trigger-deploy.sh

# In another terminal, watch logs
gh run watch

# OR view in browser
gh workflow view deploy-to-server.yml --web
```

**Post-deployment verification:**
```bash
# Check service health
curl http://54.64.181.104:3080/api/health

# Check service status
ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && sudo docker-compose ps"

# View recent logs
ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && sudo docker-compose logs --tail=50 api"
```

## Next Steps

After completing setup:

1. **Test deployment**: Run a test deployment to verify everything works
   ```bash
   ./trigger-deploy.sh
   gh run watch
   ```

2. **Bookmark workflow URL**: Save for quick access
   ```bash
   gh workflow view deploy-to-server.yml --web
   ```

3. **Document team processes**: Share this guide with team members

4. **Set up monitoring**: Configure alerts for deployment failures

5. **Schedule key rotation**: Add calendar reminder for SSH key rotation

## Additional Resources

- **GitHub CLI Documentation**: https://cli.github.com/manual/
- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **GitHub Secrets Documentation**: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **SSH Key Management**: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

## Support

If you encounter issues not covered in this guide:

1. Check GitHub Actions logs: `gh run view --log`
2. Check server logs: `ssh ubuntu@54.64.181.104 "cd /home/ubuntu/chat-web/LibreChat && sudo docker-compose logs --tail=100 api"`
3. Review deployment architecture comparison: `docs/deployment-architecture-comparison.md`
4. Contact DevOps team or open GitHub issue
