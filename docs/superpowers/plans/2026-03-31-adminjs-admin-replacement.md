# AdminJS Admin Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom `/admin` backend with AdminJS while preserving the existing SQLite data model, public site behavior, and local-media workflow.

**Architecture:** Keep the public Express/EJS site on the existing `better-sqlite3` repository layer and build the new AdminJS backend behind a temporary staging mount first (for example `/admin-next`). After resources, auth, uploads, and multisite behavior are verified, switch the final mount to `/admin` and remove the legacy backend. Use a separate AdminJS integration layer with Sequelize models mapped onto the current SQLite schema, plus a dedicated session store and site-aware resource hooks.

**Tech Stack:** Node.js 22, Express 5, AdminJS, `@adminjs/express`, `@adminjs/sequelize`, `@adminjs/rich-text`, `@adminjs/upload`, `sequelize`, `sqlite3`, `express-session`, `connect-sqlite3`, `better-sqlite3`, SQLite WAL, Node test runner, supertest.

---

## File Structure

**Create**
- `src/admin/adminjs/index.js` — creates the AdminJS instance and authenticated router
- `src/admin/adminjs/auth.js` — AdminJS authentication bridge against `admins.password_hash`
- `src/admin/adminjs/databases.js` — Sequelize connections for `app.db`, `content.db`, and `sessions.db`
- `src/admin/adminjs/site-context.js` — current-site resolution and shared `before` hooks
- `src/admin/adminjs/resources/build-resources.js` — assembles all AdminJS resources
- `src/admin/adminjs/resources/shared.js` — shared property/action helpers for multisite content resources
- `src/admin/adminjs/resources/site-settings.js`
- `src/admin/adminjs/resources/media-assets.js`
- `src/admin/adminjs/resources/pages.js`
- `src/admin/adminjs/resources/products.js`
- `src/admin/adminjs/resources/solutions.js`
- `src/admin/adminjs/resources/news-articles.js`
- `src/admin/adminjs/resources/case-studies.js`
- `src/admin/adminjs/resources/navigation-items.js`
- `src/admin/adminjs/resources/site-sections.js`
- `src/admin/adminjs/component-loader.js` — AdminJS custom component loader
- `src/admin/adminjs/components/site-switcher.jsx` — site switch control for `dma` / `bigfoot`
- `tests/admin-adminjs-auth.test.js` — AdminJS login/session coverage
- `tests/admin-adminjs-resources.test.js` — resource list/edit/site-scope coverage
- `tests/admin-adminjs-media.test.js` — media upload + public reachability coverage

**Modify**
- `package.json` — add AdminJS/Sequelize/session dependencies
- `src/app.js` — remove old admin router mounts and mount AdminJS router
- `src/server.js` — unchanged unless bootstrap needs explicit async init; prefer leaving untouched
- `tests/public-routing.test.js` — only if public behavior needs a regression assertion after admin swap
- `tests/helpers/login-as-admin.js` — update helper if old form flow changes

**Delete**
- `src/routes/admin-auth.js`
- `src/routes/admin-dashboard.js`
- `src/routes/admin-sites.js`
- `src/routes/admin-sections.js`
- `src/routes/admin-navigation.js`
- `src/routes/admin-pages.js`
- `src/routes/admin-catalog.js`
- `src/routes/admin-news.js`
- `src/routes/admin-cases.js`
- `src/routes/admin-media.js`
- `src/routes/admin-shared.js`
- `src/views/admin/`
- `src/lib/session.js`

---

### Task 1: Add AdminJS dependencies and bootstrap skeleton

**Files:**
- Modify: `package.json`
- Modify: `src/app.js`
- Create: `src/admin/adminjs/index.js`
- Create: `src/admin/adminjs/databases.js`
- Test: `tests/admin-adminjs-auth.test.js`

- [ ] **Step 1: Write the failing test**

Add a new test asserting `GET /admin-next/login` returns an AdminJS login page while the legacy `/admin/login` page remains unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-adminjs-auth.test.js`

Expected: FAIL because `/admin-next/login` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add the new dependencies to `package.json` (including `@adminjs/upload`), create `src/admin/adminjs/index.js` and `src/admin/adminjs/databases.js`, enable `PRAGMA journal_mode=WAL` on every Sequelize SQLite connection, and mount a placeholder authenticated AdminJS router at `/admin-next` without disturbing the legacy `/admin` routes.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-adminjs-auth.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json src/app.js src/admin/adminjs/index.js src/admin/adminjs/databases.js tests/admin-adminjs-auth.test.js
git commit -m "feat: bootstrap AdminJS admin"
```

### Task 2: Bridge authentication and session storage

**Files:**
- Create: `src/admin/adminjs/auth.js`
- Modify: `src/admin/adminjs/index.js`
- Modify: `src/admin/adminjs/databases.js`
- Test: `tests/admin-adminjs-auth.test.js`

- [ ] **Step 1: Write the failing test**

Add tests covering:
- successful login by **username**
- successful login by **email**
- inactive admin rejection
- logout clears session
- session cookie is issued with `HttpOnly` and `SameSite=Lax`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-adminjs-auth.test.js`

Expected: FAIL because authentication still uses placeholder behavior.

- [ ] **Step 3: Write minimal implementation**

Implement `authenticate()` in `src/admin/adminjs/auth.js`, allow login by username or email, configure `express-session` + `connect-sqlite3` to use `sessions.db`, and make the AdminJS router issue `httpOnly` / `sameSite: 'lax'` cookies while enforcing the `is_active` check.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-adminjs-auth.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminjs/auth.js src/admin/adminjs/index.js src/admin/adminjs/databases.js tests/admin-adminjs-auth.test.js
git commit -m "feat: wire AdminJS auth to admins table"
```

### Task 3: Model existing SQLite schema in Sequelize

**Files:**
- Modify: `src/admin/adminjs/databases.js`
- Create: `src/admin/adminjs/resources/shared.js`
- Create: `src/admin/adminjs/resources/build-resources.js`
- Create: `src/admin/adminjs/resources/site-settings.js`
- Create: `src/admin/adminjs/resources/media-assets.js`
- Create: `src/admin/adminjs/resources/pages.js`
- Create: `src/admin/adminjs/resources/products.js`
- Create: `src/admin/adminjs/resources/solutions.js`
- Create: `src/admin/adminjs/resources/news-articles.js`
- Create: `src/admin/adminjs/resources/case-studies.js`
- Create: `src/admin/adminjs/resources/navigation-items.js`
- Create: `src/admin/adminjs/resources/site-sections.js`
- Test: `tests/admin-adminjs-resources.test.js`

- [ ] **Step 1: Write the failing test**

Add a resource smoke test asserting an authenticated admin can load list pages for:
- `site_settings`
- `media_assets`
- `pages`
- `products`
- `solutions`
- `news_articles`
- `case_studies`
- `navigation_items`
- `site_sections`

Also assert the `site_settings` resource does **not** expose AdminJS New/Delete actions.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-adminjs-resources.test.js`

Expected: FAIL because resources are not yet defined.

- [ ] **Step 3: Write minimal implementation**

Create Sequelize models for the mapped tables, register the AdminJS Sequelize adapter, expose the nine resources with correct labels and field visibility, disable New/Delete on `site_settings`, and configure `publish_state` as an explicit enum with `draft`, `published`, and `archived`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-adminjs-resources.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminjs/databases.js src/admin/adminjs/resources tests/admin-adminjs-resources.test.js
git commit -m "feat: expose existing content tables in AdminJS"
```

### Task 4: Enforce multisite scope and safe delete behavior

**Files:**
- Create: `src/admin/adminjs/site-context.js`
- Modify: `src/admin/adminjs/index.js`
- Modify: `src/admin/adminjs/resources/shared.js`
- Modify: `src/admin/adminjs/resources/pages.js`
- Modify: `src/admin/adminjs/resources/products.js`
- Modify: `src/admin/adminjs/resources/solutions.js`
- Modify: `src/admin/adminjs/resources/news-articles.js`
- Modify: `src/admin/adminjs/resources/case-studies.js`
- Modify: `src/admin/adminjs/resources/navigation-items.js`
- Modify: `src/admin/adminjs/resources/site-sections.js`
- Test: `tests/admin-adminjs-resources.test.js`

- [ ] **Step 1: Write the failing test**

Add tests asserting:
- first login defaults to `dma`
- switching to `bigfoot` changes list results
- deleting a content record sets `deleted_at` instead of removing the row

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-adminjs-resources.test.js`

Expected: FAIL because resources are not yet site-filtered and delete still uses AdminJS defaults.

- [ ] **Step 3: Write minimal implementation**

Implement session-backed current-site resolution, inject site-scoped `where` clauses in resource hooks, add a `/admin/switch-site` helper route, and override delete actions for all soft-delete resources.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-adminjs-resources.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminjs/index.js src/admin/adminjs/site-context.js src/admin/adminjs/resources tests/admin-adminjs-resources.test.js
git commit -m "feat: add site-scoped AdminJS resources"
```

### Task 5: Restore rich text and media management in AdminJS

**Files:**
- Modify: `src/admin/adminjs/index.js`
- Modify: `src/admin/adminjs/resources/media-assets.js`
- Modify: `src/admin/adminjs/resources/pages.js`
- Modify: `src/admin/adminjs/resources/products.js`
- Modify: `src/admin/adminjs/resources/solutions.js`
- Modify: `src/admin/adminjs/resources/news-articles.js`
- Modify: `src/admin/adminjs/resources/case-studies.js`
- Modify: `src/admin/adminjs/resources/site-sections.js`
- Test: `tests/admin-adminjs-media.test.js`

- [ ] **Step 1: Write the failing test**

Add tests asserting:
- HTML fields render with the AdminJS rich-text editor
- media upload creates a `media_assets` row for the active site
- uploaded assets remain reachable through the existing `/media/:assetKey` public route

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-adminjs-media.test.js`

Expected: FAIL because rich-text and AdminJS upload integration are not configured yet.

- [ ] **Step 3: Write minimal implementation**

Register `@adminjs/rich-text`, wire `@adminjs/upload` onto the `media_assets` resource, store files under `public/uploads`, and ensure content resources reference existing media IDs cleanly.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-adminjs-media.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminjs/index.js src/admin/adminjs/resources tests/admin-adminjs-media.test.js
git commit -m "feat: add AdminJS rich text and media workflow"
```

### Task 6: Add site switcher UI and remove legacy admin surface

**Files:**
- Create: `src/admin/adminjs/component-loader.js`
- Create: `src/admin/adminjs/components/site-switcher.jsx`
- Modify: `src/admin/adminjs/index.js`
- Delete: `src/routes/admin-*.js`
- Delete: `src/views/admin/`
- Delete: `src/lib/session.js`
- Test: `tests/admin-adminjs-resources.test.js`

- [ ] **Step 1: Write the failing test**

Add an assertion that the AdminJS interface shows both `DMA` and `bigfoot` site-switch affordances and that legacy admin EJS markers are absent from `/admin`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin-adminjs-resources.test.js`

Expected: FAIL because the custom component and legacy cleanup are not complete.

- [ ] **Step 3: Write minimal implementation**

Add the custom site-switcher component, expose it in the AdminJS branding/layout config, then remove the old custom admin route/view/session files once all `/admin` traffic is served by AdminJS.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin-adminjs-resources.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminjs src/app.js tests/admin-adminjs-resources.test.js
git rm src/routes/admin-*.js src/lib/session.js
git rm -r src/views/admin
git commit -m "refactor: remove legacy admin implementation"
```

### Task 7: Full verification and deployment readiness

**Files:**
- Modify: `docs/superpowers/specs/2026-03-31-adminjs-admin-replacement-design.md` (only if implementation differs materially)
- Test: `tests/admin-adminjs-auth.test.js`
- Test: `tests/admin-adminjs-resources.test.js`
- Test: `tests/admin-adminjs-media.test.js`
- Test: `npm test`

- [ ] **Step 1: Run focused admin tests**

Run:
- `node --test tests/admin-adminjs-auth.test.js`
- `node --test tests/admin-adminjs-resources.test.js`
- `node --test tests/admin-adminjs-media.test.js`

Expected: all PASS.

- [ ] **Step 2: Run full regression suite**

Run: `npm test`

Expected: all tests PASS with no new warnings.

- [ ] **Step 3: Manually verify key flows**

Check:
- `/admin-next/login`
- create/edit/delete draft content in both sites
- upload media and load the asset publicly
- content created or edited through AdminJS renders correctly on the public site
- public site pages still render correctly

- [ ] **Step 4: Commit final integration**

```bash
git add -A
git commit -m "feat: replace legacy admin with AdminJS"
```
