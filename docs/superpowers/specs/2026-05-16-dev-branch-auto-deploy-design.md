# Dev Branch Auto-Deploy Design

**Date:** 2026-05-16

**Goal:** Automatically deploy the test server website whenever `dev` is pushed to GitHub, using SSH to update `/opt/b8-multisite-web/` and restart the existing `b8-multisite` systemd service.

## Scope

This feature covers only the test server deployment path for the `dev` branch.

Included:

- GitHub Actions workflow triggered by pushes to `dev`
- SSH-based deployment to `8.142.93.198`
- Syncing the checked-out repository on the server at `/opt/b8-multisite-web/`
- Installing production dependencies on the server
- Restarting the `b8-multisite` systemd service
- Updating deployment docs with the required secrets and server steps

Excluded:

- Production deployment
- Manual release approval gates
- Database migration tooling beyond what the app already does at startup
- Blue/green or canary infrastructure

## Recommended Approach

Use a single GitHub Actions workflow for `push` events on `dev`. The workflow should:

1. run repository tests in GitHub-hosted CI,
2. SSH into the test server,
3. update the working tree in `/opt/b8-multisite-web/` from `origin/dev`,
4. install production dependencies with `npm ci --omit=dev`,
5. restart `b8-multisite`,
6. optionally verify the site with a local `curl` check on the server.

This matches the existing systemd deployment model documented in `docs/deployment/alicloud.md` and avoids a separate webhook service.

## Files to Change

- Create: `.github/workflows/dev-deploy.yml`
- Create: `scripts/deploy-test-server.sh`
- Modify: `docs/deployment/alicloud.md`

## Architecture

The workflow owns orchestration; the shell script owns server-side deployment steps. The workflow stays small and declarative, while the script keeps the server commands reusable and easy to test over SSH.

The server remains the source of truth for runtime state. The repository on the server is updated with `git fetch origin dev` and `git reset --hard origin/dev`, which preserves ignored runtime data in `data/` and uploaded assets under `public/uploads/`.

## Secret and Environment Contract

GitHub repository secrets:

- `DEPLOY_HOST` = `8.142.93.198`
- `DEPLOY_PORT` = `22`
- `DEPLOY_USER` = SSH user, either `root` or `b8admin`
- `DEPLOY_SSH_KEY` = private key with access to the server
- `DEPLOY_KNOWN_HOSTS` = pinned host key for the server
- `DEPLOY_PATH` = `/opt/b8-multisite-web`
- `DEPLOY_SERVICE` = `b8-multisite`

The workflow must not hard-code credentials. It should fail clearly if any required secret is missing.

## Deployment Flow

1. Workflow starts on `push` to `dev`.
2. CI runs `npm ci` and `npm test`.
3. If CI passes, the workflow opens an SSH session to the server.
4. The server script:
   - `cd /opt/b8-multisite-web`
   - `git fetch origin dev`
   - `git reset --hard origin/dev`
   - `npm ci --omit=dev`
   - `sudo systemctl restart b8-multisite`
5. The script performs a lightweight verification:
   - `curl -fsS http://127.0.0.1:3008/`
6. The workflow exits non-zero if any step fails.

## Error Handling

- Missing secrets: fail the workflow before connecting to the server.
- SSH failure: stop deployment immediately and surface the SSH error.
- Git reset failure: do not continue to dependency install or restart.
- Package install failure: do not restart the service.
- Restart failure: fail the workflow and leave the server logs intact for inspection.
- Verification failure: treat as deployment failure even if restart succeeded.

## Testing Strategy

The implementation should be verified at three levels:

- Workflow syntax: the YAML should load without invalid keys or unsupported expressions.
- Script behavior: the deployment script should be runnable over SSH and clearly log each phase.
- End-to-end deploy: pushing to `dev` should trigger the workflow and update the server.

The repo should also keep the existing application tests passing, since the deploy pipeline is only safe if `npm test` remains green.

## Rollback

Rollback is intentionally simple: SSH to the server, reset `/opt/b8-multisite-web` to the last successful deployment commit SHA recorded in the GitHub Actions run, run `npm ci --omit=dev`, and restart `b8-multisite`.

Because the server keeps ignored runtime data outside version control, a rollback should not delete the SQLite database or uploaded assets.

## Success Criteria

- A push to `dev` triggers the workflow automatically.
- The workflow updates `/opt/b8-multisite-web/` on the test server.
- The `b8-multisite` service restarts successfully.
- The site responds on `http://8.142.93.198:3008/`.
- Failed tests or failed server commands block deployment.
