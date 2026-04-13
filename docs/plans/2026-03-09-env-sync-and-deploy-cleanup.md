# Env Sync & Deploy Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `.env` drift between local and server, fix active production bugs, and make `deploy.sh` the single source of truth for keeping environments in sync.

**Architecture:** Move all environment-specific variables (domain, log path, proxy, CORS origins) into `docker-compose.yml`'s `environment:` section so they are git-tracked and auto-synced by `deploy.sh`. The `.env` file becomes a pure shared-secrets file — identical on both sides — and `deploy.sh` syncs it on every deploy. Local dev (`npm run backend:dev`) reads `.env` directly and gets the local-specific values, which are harmlessly overridden inside Docker by `docker-compose environment:`.

**Tech Stack:** bash, docker-compose v2, dotenv (Node.js default: does NOT override already-set process env vars)

---

## Context: What We Discovered

Running `docker inspect LibreChat` on the server revealed:
- Active compose files: `docker-compose.yml` + `.deploy/override.yml` only
- `docker-compose.local.yml` on server: **never used** (dead code for New-API integration)
- `meilisearch`: **not running** (MEILI_MASTER_KEY commented out — intentional)

Active production bugs confirmed in container env:
- `SESSION_EXPIRY=1000 * 60 * 15` — string, not a number, session expiry is broken
- `REFRESH_TOKEN_EXPIRY=(1000 * 60 * 60 * 24) * 7` — same issue
- Stripe `EXPLORER` and `ARTISAN` price IDs are **swapped** between local and server

---

## How docker-compose env precedence works

```
env_file: .env          →  injects all vars (lower priority)
environment: KEY=value  →  overrides specific vars (higher priority)
volumes: .env:/app/.env →  file mounted inside container; dotenv.config()
                            does NOT override already-set process env vars
                            (Node.js dotenv default behaviour)
```

The existing `MONGO_URI` override proves this works: `.env` has `mongodb://127.0.0.1:27017` but the container correctly uses `mongodb://mongodb:27017`.

---

## Task 1: Fix Critical Session Expiry Bug on Server (SSH direct fix)

**Files:** `/home/ubuntu/chat-web/LibreChat/.env` (server only)

This is a live production bug. Fix it now via SSH before anything else.

**Step 1: SSH into server and edit `.env`**

```bash
ssh ubuntu@54.64.181.104
cd /home/ubuntu/chat-web/LibreChat
nano .env   # or vim
```

Change:
```
SESSION_EXPIRY=1000 * 60 * 15
REFRESH_TOKEN_EXPIRY=(1000 * 60 * 60 * 24) * 7
```
To:
```
SESSION_EXPIRY=900000
REFRESH_TOKEN_EXPIRY=604800000
```

**Step 2: Restart the API container to pick up the new values**

```bash
sudo docker-compose -f docker-compose.yml -f .deploy/override.yml up -d api
```

**Step 3: Verify the fix inside the container**

```bash
sudo docker exec LibreChat printenv SESSION_EXPIRY
# Expected: 900000
sudo docker exec LibreChat printenv REFRESH_TOKEN_EXPIRY
# Expected: 604800000
```

**Step 4: Exit server**

```bash
exit
```

No commit needed — this is a server-side file change only. The fix will be permanent once Task 5 aligns both `.env` files.

---

## Task 2: Confirm Stripe Price IDs ⚠️ USER ACTION REQUIRED

The two price IDs are **swapped** between local and server. This means users subscribing to Explorer get billed for Artisan and vice versa.

**Current state:**

| Variable | Local `.env` | Server `.env` |
|---|---|---|
| `STRIPE_PRICE_EXPLORER_MONTHLY` | `price_1Sy7KeKVcjllrBpOgi3n3uSl` | `price_1Sy7CYKVcjllrBpOpmylivkp` |
| `STRIPE_PRICE_ARTISAN_MONTHLY` | `price_1Sy7CYKVcjllrBpOpmylivkp` | `price_1Sy7KeKVcjllrBpOgi3n3uSl` |

**Step 1: Check Stripe Dashboard**

Go to Stripe Dashboard → Products. Find the Explorer Monthly and Artisan Monthly products and note their Price IDs.

**Step 2: Determine which `.env` is correct**

Once confirmed, the correct mapping goes into the local `.env` in Task 4. The wrong side will be corrected when `.env` is synced in Task 5.

---

## Task 3: Add Env-Specific Vars to `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

This is the core architectural change. After this, `.env` can be safely synced from local to server because Docker Compose will override all environment-specific values before the container starts.

**Step 1: Read current `docker-compose.yml`**

```bash
cat docker-compose.yml
```

**Step 2: Add to `api` service `environment:` section**

Open `docker-compose.yml` and extend the `environment:` block of the `api` service:

```yaml
    environment:
      - HOST=0.0.0.0
      - MONGO_URI=mongodb://mongodb:27017/LibreChat
      - MEILI_HOST=http://meilisearch:7700
      - RAG_PORT=${RAG_PORT:-8000}
      - RAG_API_URL=http://rag_api:${RAG_PORT:-8000}
      # --- Production overrides (override whatever .env says) ---
      - DOMAIN_CLIENT=https://keep4oforever.com
      - DOMAIN_SERVER=https://keep4oforever.com
      - LIBRECHAT_LOG_DIR=/app/logs
      - PROXY=
      - CORS_ALLOWED_ORIGINS=https://keep4oforever.com
      - SSE_ALLOWED_ORIGINS=https://keep4oforever.com
```

**Why each var:**
- `DOMAIN_CLIENT/SERVER` — local `.env` has `localhost:3090/3080`; production needs the real domain
- `LIBRECHAT_LOG_DIR` — local `.env` has `./logs`; inside container must be `/app/logs`
- `PROXY=` — local `.env` has `http://127.0.0.1:7897`; on server this proxy doesn't exist and would break all OpenAI calls
- `CORS_ALLOWED_ORIGINS/SSE_ALLOWED_ORIGINS` — local `.env` has `localhost:3090`; production needs the real domain

**Step 3: Verify the yaml is valid**

```bash
docker-compose config --quiet && echo "YAML valid"
# Expected: YAML valid
```

**Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: pin production env-specific vars in docker-compose to prevent .env drift"
```

---

## Task 4: Align Local `.env` with Server

**Files:** `.env` (local only — not committed to git)

The goal is to make local `.env` the canonical source of truth. After this task, syncing it to the server will be correct and complete.

**Step 1: Add vars that server has but local is missing**

Open local `.env` and add to the auth section (after `ALLOW_REGISTRATION`):

```
ALLOW_PASSWORD_RESET=true
ALLOW_UNVERIFIED_EMAIL_LOGIN=true
```

**Step 2: Verify SESSION_EXPIRY format in local `.env`**

Local should already have the correct numeric values:
```
SESSION_EXPIRY=900000
REFRESH_TOKEN_EXPIRY=604800000
```

**Step 3: Fix Stripe Price IDs in local `.env`** (after Task 2 confirms which is correct)

Update to the confirmed correct mapping from Stripe Dashboard.

**Step 4: Verify the complete shared variable set matches between both sides**

Run this to see what the server currently has (post Task 1 fix):
```bash
ssh ubuntu@54.64.181.104 "sudo docker exec LibreChat printenv" | sort > /tmp/server-env.txt
```

Cross-reference against local `.env` to confirm all shared variables are now identical.

---

## Task 5: Update `deploy.sh` to Sync `.env`

**Files:**
- Modify: `deploy.sh`

Now that docker-compose overrides all env-specific vars, `.env` is safe to sync. This makes `deploy.sh` the single tool needed to keep environments in sync.

**Step 1: Find the `transfer_config_files` function**

In `deploy.sh`, locate the section that ends with:
```bash
    log_success "配置文件传输完成"
```

**Step 2: Add `.env` sync block before the final log line**

Add after the `nginx.conf` sync block:

```bash
    # Sync .env — safe because docker-compose.yml environment: overrides
    # all env-specific vars (DOMAIN, LOG_DIR, PROXY, CORS origins).
    # See: Task 3 in docs/plans/2026-03-09-env-sync-and-deploy-cleanup.md
    if [ -f ".env" ]; then
        scp .env "${SERVER_HOST}:${PROJECT_DIR}/.env"
        log_success "已同步 .env"
    else
        log_warning "本地 .env 不存在，跳过同步"
    fi
```

**Step 3: Remove the old `.env.example` fallback logic** in `transfer_config_files`

The block starting with `if [ ! -f "${PROJECT_DIR}/.env" ]` that copies from `.env.example` is no longer needed — we now actively sync `.env`. Remove it from the remote SSH heredoc:

```bash
        # 检查 .env 文件  ← remove this entire block (lines ~281-289)
        if [ ! -f "${PROJECT_DIR}/.env" ]; then
            if [ -f "${PROJECT_DIR}/.env.example" ]; then
                ...
            fi
        fi
```

**Step 4: Do a dry-run deploy to verify**

```bash
./deploy.sh --init-only
# Expected: completes without error, check server has updated .env
```

Verify the server's `.env` now has correct `SESSION_EXPIRY=900000`:
```bash
ssh ubuntu@54.64.181.104 "grep SESSION_EXPIRY /home/ubuntu/chat-web/LibreChat/.env"
# Expected: SESSION_EXPIRY=900000
```

**Step 5: Commit**

```bash
git add deploy.sh
git commit -m "feat: sync .env on every deploy (safe: docker-compose overrides env-specific vars)"
```

---

## Task 6: Full Deploy Verification

**Step 1: Run a full deploy**

```bash
./deploy.sh
```

**Step 2: Verify all critical env vars in production container**

```bash
ssh ubuntu@54.64.181.104 "sudo docker exec LibreChat printenv" | grep -E "SESSION_EXPIRY|REFRESH_TOKEN|DOMAIN_CLIENT|DOMAIN_SERVER|PROXY|CORS_ALLOWED|LOG_DIR|STRIPE_PRICE"
```

Expected:
```
SESSION_EXPIRY=900000
REFRESH_TOKEN_EXPIRY=604800000
DOMAIN_CLIENT=https://keep4oforever.com
DOMAIN_SERVER=https://keep4oforever.com
PROXY=
CORS_ALLOWED_ORIGINS=https://keep4oforever.com
LIBRECHAT_LOG_DIR=/app/logs
STRIPE_PRICE_EXPLORER_MONTHLY=<confirmed correct ID>
STRIPE_PRICE_ARTISAN_MONTHLY=<confirmed correct ID>
```

**Step 3: Smoke test**

- Open https://keep4oforever.com — app loads
- Log in — session works (session expiry was broken before)
- Google OAuth — still works (DOMAIN didn't change for OAuth callback since `GOOGLE_CALLBACK_URL=/oauth/google/callback` is relative)

---

## Task 7: Clean Up Dead Files on Server

**Step 1: Remove unused `docker-compose.local.yml` from server**

This file was created for New-API integration but has never been referenced in any deploy command.

```bash
ssh ubuntu@54.64.181.104 "rm /home/ubuntu/chat-web/LibreChat/docker-compose.local.yml"
```

**Step 2: Verify nothing broke**

```bash
ssh ubuntu@54.64.181.104 "sudo docker ps"
# Expected: all 4 containers still running
```

---

## Summary of What Changes

| What | Before | After |
|---|---|---|
| `.env` sync | Never synced, drifts manually | Synced on every deploy |
| `SESSION_EXPIRY` | `"1000 * 60 * 15"` (broken string) | `900000` (correct ms) |
| `REFRESH_TOKEN_EXPIRY` | `"(1000 * 60 * 60 * 24) * 7"` (broken) | `604800000` (correct ms) |
| Stripe price IDs | Swapped | Correct |
| `DOMAIN_CLIENT` on server | In `.env` (manual, drifts) | In `docker-compose.yml` (auto-synced) |
| `PROXY` on server | Missing (if synced would break OpenAI) | Explicitly cleared in compose |
| `docker-compose.local.yml` | Dead code on server | Removed |

## Order of Execution

1. **Task 1** — Immediate (fix live bug, no deploy needed)
2. **Task 2** — User action (check Stripe Dashboard, 2 min)
3. **Task 3** — Code change + commit
4. **Task 4** — Local `.env` edit (no commit, gitignored)
5. **Task 5** — Code change + commit (depends on Task 3 & 4)
6. **Task 6** — Full deploy + verification (depends on all above)
7. **Task 7** — Cleanup (independent, can do anytime)
