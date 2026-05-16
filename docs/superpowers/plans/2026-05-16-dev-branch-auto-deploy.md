# Dev Branch Auto-Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically deploy the test server site whenever `dev` is pushed to GitHub, by syncing `/opt/b8-multisite-web/` over SSH and restarting `b8-multisite`.

**Architecture:** Keep CI orchestration in one GitHub Actions workflow and keep the server-side deployment logic in one Bash script. The workflow runs repository tests first, then opens an SSH session to the test server, streams the deploy script into `bash -s`, and lets the script perform the reset/install/restart/verify sequence. This avoids a separate webhook service and keeps the server contract explicit.

**Tech Stack:** GitHub Actions, Bash, OpenSSH, systemd, Node.js 22, `node:test`, existing `npm test` suite.

---

## File Structure

**Create**
- `.github/workflows/dev-deploy.yml` — `push` trigger for `dev`, CI + SSH deploy job, secret wiring
- `scripts/deploy-test-server.sh` — server-side deploy script that updates `/opt/b8-multisite-web/` and restarts `b8-multisite`
- `tests/deploy-workflow.test.js` — file-content assertions for the workflow and deploy script

**Modify**
- `docs/deployment/alicloud.md` — document the new auto-deploy flow, required GitHub secrets, and rollback path

---

### Task 1: Add the server deploy script and guardrail test

**Files:**
- Create: `scripts/deploy-test-server.sh`
- Create: `tests/deploy-workflow.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/deploy-workflow.test.js` with these assertions:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('deploy script contains the server-side deploy sequence', () => {
  const script = readFileSync('scripts/deploy-test-server.sh', 'utf8');
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /cd "\$DEPLOY_PATH"/);
  assert.match(script, /git fetch origin dev/);
  assert.match(script, /git reset --hard origin\/dev/);
  assert.match(script, /npm ci --omit=dev/);
  assert.match(script, /systemctl restart "\$DEPLOY_SERVICE"/);
  assert.match(script, /curl -fsS http:\/\/127\.0\.0\.1:3008\//);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/deploy-workflow.test.js
```

Expected: FAIL because `scripts/deploy-test-server.sh` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/deploy-test-server.sh` as a strict Bash script that expects these environment variables: `DEPLOY_PATH`, `DEPLOY_SERVICE`, and `DEPLOY_PORT`. The script should:

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${DEPLOY_SERVICE:?DEPLOY_SERVICE is required}"
: "${DEPLOY_PORT:=3008}"

cd "$DEPLOY_PATH"
git fetch origin dev
git reset --hard origin/dev
npm ci --omit=dev
sudo systemctl restart "$DEPLOY_SERVICE"
curl -fsS "http://127.0.0.1:${DEPLOY_PORT}/" >/dev/null
echo "deployment complete"
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/deploy-workflow.test.js
bash -n scripts/deploy-test-server.sh
```

Expected: PASS for the test and no syntax errors from `bash -n`.

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy-test-server.sh tests/deploy-workflow.test.js
git commit -m "feat: add test server deploy script"
```

### Task 2: Add the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/dev-deploy.yml`
- Modify: `tests/deploy-workflow.test.js`

- [ ] **Step 1: Extend the failing test**

Add workflow assertions to `tests/deploy-workflow.test.js`:

```js
test('workflow triggers on dev and deploys over ssh', () => {
  const workflow = readFileSync('.github/workflows/dev-deploy.yml', 'utf8');
  assert.match(workflow, /on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- dev/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /ssh-agent|ssh -o/);
  assert.match(workflow, /scripts\/deploy-test-server\.sh/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/deploy-workflow.test.js
```

Expected: FAIL because `.github/workflows/dev-deploy.yml` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `.github/workflows/dev-deploy.yml` with a single `deploy-dev` job that:

```yaml
name: dev-deploy

on:
  push:
    branches:
      - dev

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.9.0
          cache: npm
      - run: npm ci
      - run: npm test
      - name: Start SSH agent
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
          printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key ~/.ssh/known_hosts
          eval "$(ssh-agent -s)"
          ssh-add ~/.ssh/deploy_key
      - name: Deploy to test server
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_PORT: ${{ secrets.DEPLOY_PORT }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}
          DEPLOY_SERVICE: ${{ secrets.DEPLOY_SERVICE }}
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" 'DEPLOY_PATH="$DEPLOY_PATH" DEPLOY_SERVICE="$DEPLOY_SERVICE" DEPLOY_PORT=3008 bash -s' < scripts/deploy-test-server.sh
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/deploy-workflow.test.js
```

Expected: PASS, with the workflow file containing the required `dev` trigger, CI, and SSH deploy steps.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/dev-deploy.yml tests/deploy-workflow.test.js
git commit -m "feat: add dev branch deployment workflow"
```

### Task 3: Update deployment documentation

**Files:**
- Modify: `docs/deployment/alicloud.md`

- [ ] **Step 1: Write the doc change**

Add a new section that says the test server can now be updated automatically from GitHub Actions, and record the required repository secrets:

```md
## 12. Dev 分支自动部署

当 `dev` 分支推送到 GitHub 时，仓库中的 GitHub Actions 会自动通过 SSH 更新测试服务器。

### 需要配置的 GitHub Secrets

- `DEPLOY_HOST`：`8.142.93.198`
- `DEPLOY_PORT`：`22`
- `DEPLOY_USER`：`root` 或 `b8admin`
- `DEPLOY_SSH_KEY`：可登录测试服务器的私钥
- `DEPLOY_KNOWN_HOSTS`：测试服务器的主机指纹
- `DEPLOY_PATH`：`/opt/b8-multisite-web`
- `DEPLOY_SERVICE`：`b8-multisite`

### 更新流程

1. Push 到 `dev`
2. GitHub Actions 先执行 `npm ci` 和 `npm test`
3. 测试通过后通过 SSH 进入服务器
4. 在 `/opt/b8-multisite-web` 执行 `git fetch origin dev` 和 `git reset --hard origin/dev`
5. 执行 `npm ci --omit=dev`
6. 重启 `b8-multisite`
7. 使用 `curl -fsS http://127.0.0.1:3008/` 做本机健康检查

### 回滚

如果本次部署有问题，重新 SSH 到服务器，把工作区 reset 到上一次成功部署的 commit SHA，然后重新执行 `npm ci --omit=dev` 和 `sudo systemctl restart b8-multisite`。
```

- [ ] **Step 2: Review the edited section**

Open the updated doc and confirm the new section still matches the existing `systemd` service name, port `3008`, and deployment path `/opt/b8-multisite-web/`.

- [ ] **Step 3: Commit**

```bash
git add docs/deployment/alicloud.md
git commit -m "docs: add dev branch auto deploy instructions"
```

### Task 4: Verify the full deployment pipeline

**Files:**
- Test: `tests/deploy-workflow.test.js`
- Modify: none

- [ ] **Step 1: Run the focused test**

Run:

```bash
node --test tests/deploy-workflow.test.js
bash -n scripts/deploy-test-server.sh
```

Expected: PASS.

- [ ] **Step 2: Run the repository regression suite**

Run:

```bash
npm test
```

Expected: PASS with no new failures.

- [ ] **Step 3: Commit the final integration**

```bash
git add -A
git commit -m "feat: enable dev branch auto deployment"
```
