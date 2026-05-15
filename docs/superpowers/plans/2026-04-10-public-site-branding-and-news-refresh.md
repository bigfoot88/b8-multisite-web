# Public Site Branding and News Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public-site branding, hero banners, and news presentation media-driven from the admin so logos, icons, per-page banners, homepage rotation, and news layouts can be managed without code edits.

**Architecture:** Extend the existing SQLite-backed content model so `site_settings` owns global site chrome assets (header/footer logos, footer contact icons, route-level hero banners, homepage secondary banner) while `pages` and `news_articles` own record-level banner choices. Reuse the existing `media_assets` picker in AdminJS, resolve all public-facing assets in the repository/service layer, and keep EJS templates dumb by passing fully hydrated `logoAsset`, `bannerAsset`, `newsCoverAsset`, and pager data from `public-site-service`/`routes/public`.

**Tech Stack:** Node.js, Express, EJS, SQLite, AdminJS, vanilla CSS/JS, `node:test`, `supertest`

---

## File Map

- **Schema and persistence**
  - Modify: `src/lib/schema.sql`
  - Modify: `src/lib/migrations.js`
  - Modify: `src/repositories/site-repository.js`
  - Modify: `src/repositories/catalog-repository.js`
- **AdminJS configuration**
  - Modify: `src/admin/adminjs/resources/site-settings.js`
  - Modify: `src/admin/adminjs/resources/pages.js`
  - Modify: `src/admin/adminjs/resources/news-articles.js`
  - Modify: `src/admin/adminjs/resources/shared.js` (only if a shared media-picker description/helper prevents duplication)
- **Public-site service and routing**
  - Modify: `src/services/public-site-service.js`
  - Modify: `src/routes/public.js`
- **Public rendering**
  - Modify: `src/views/partials/public-header.ejs`
  - Modify: `src/views/partials/public-footer.ejs`
  - Modify: `src/views/partials/hero.ejs`
  - Modify: `src/views/public/home.ejs`
  - Modify: `src/views/public/news-index.ejs`
  - Modify: `src/views/public/news-detail.ejs`
  - Modify: `public/css/public.css`
  - Modify: `public/js/site.js`
- **Fixtures and regression coverage**
  - Modify: `tests/helpers/public-fixtures.js`
  - Modify: `tests/public-routing.test.js`
  - Modify: `tests/admin-adminjs-resources.test.js`
  - Modify: `tests/end-to-end-smoke.test.js`
  - Modify: `data/seeds/dma.json`
  - Modify: `data/seeds/bigfoot.json`

### Task 1: Add media-backed branding/banner fields to the schema and repositories

**Files:**
- Modify: `src/lib/schema.sql`
- Modify: `src/lib/migrations.js`
- Modify: `src/repositories/site-repository.js`
- Modify: `src/repositories/catalog-repository.js`
- Test: `tests/public-routing.test.js`

- [ ] **Step 1: Write the failing persistence/route tests**

```js
test('public frame exposes media-backed logos, route banners, and record banners', async (t) => {
  const { app } = withPublicApp(t, 'b8-branding-fields-', ({ siteRepository, catalogRepository, mediaRepository, ...rest }) => {
    seedRepresentativePublicContent({ siteRepository, catalogRepository, mediaRepository, ...rest });
    const headerLogo = mediaRepository.createAsset({ assetKey: 'dma-header-logo', siteKey: 'dma', filename: 'header-logo.png', mimeType: 'image/png', storagePath: writeUpload(rest.paths.uploadRoot, 'header-logo.png', 'logo') });
    const detailBanner = mediaRepository.createAsset({ assetKey: 'dma-news-banner', siteKey: 'dma', filename: 'news-banner.png', mimeType: 'image/png', storagePath: writeUpload(rest.paths.uploadRoot, 'news-banner.png', 'banner') });

    siteRepository.upsertSiteSettings({
      siteKey: 'dma',
      brandName: 'DMA',
      domain: 'dma.local',
      headerLogoMediaId: headerLogo.id,
      homeBannerMediaId: headerLogo.id,
      homeBannerSecondaryMediaId: detailBanner.id,
      newsBannerMediaId: detailBanner.id,
    });
  });

  const response = await request(app).get('/news/water-loss-summit').set('host', 'dma.b8water.com');
  assert.equal(response.status, 200);
  assert.match(response.text, /header-logo\.png/);
  assert.match(response.text, /news-banner\.png/);
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `node --test tests/public-routing.test.js`
Expected: FAIL because the schema/repository layer does not yet know about the new media-id columns.

- [ ] **Step 3: Implement minimal schema/migration/repository support**

```js
// src/lib/migrations.js
function ensureColumn(db, table, columnSql) {
  const [columnName] = columnSql.trim().split(/\s+/, 1);
  const columns = new Set(listTableColumns(db, table));
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnSql}`);
  }
}

ensureColumn(db, 'site_settings', 'header_logo_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'footer_logo_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'home_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'home_banner_secondary_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'about_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'products_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'solutions_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'news_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'cases_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'contact_banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'contact_phone_icon_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'contact_email_icon_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'site_settings', 'contact_address_icon_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'pages', 'banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
ensureColumn(db, 'news_articles', 'banner_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL');
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `node --test tests/public-routing.test.js`
Expected: PASS for the new persistence/render assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.sql src/lib/migrations.js src/repositories/site-repository.js src/repositories/catalog-repository.js tests/public-routing.test.js
git commit -m "feat: persist branding and banner media settings"
```

### Task 2: Expose the new branding/banner fields in AdminJS

**Files:**
- Modify: `src/admin/adminjs/resources/site-settings.js`
- Modify: `src/admin/adminjs/resources/pages.js`
- Modify: `src/admin/adminjs/resources/news-articles.js`
- Test: `tests/admin-adminjs-resources.test.js`

- [ ] **Step 1: Write failing AdminJS resource tests**

```js
test('site settings and content resources expose media picker fields for logos, icons, and banners', async (t) => {
  const siteSettingsShowResponse = await agent.get('/admin-next/resources/site_settings/records/dma/show');
  assert.match(siteSettingsShowResponse.text, /header_logo_media_id/);
  assert.match(siteSettingsShowResponse.text, /footer_logo_media_id/);
  assert.match(siteSettingsShowResponse.text, /home_banner_secondary_media_id/);

  const pageEditResponse = await agent.get(`/admin-next/resources/pages/records/${pageId}/edit`);
  assert.match(pageEditResponse.text, /banner_media_id/);

  const newsEditResponse = await agent.get(`/admin-next/resources/news_articles/records/${newsId}/edit`);
  assert.match(newsEditResponse.text, /hero_media_id/);
  assert.match(newsEditResponse.text, /banner_media_id/);
});
```

- [ ] **Step 2: Run the AdminJS resource test file**

Run: `node --test tests/admin-adminjs-resources.test.js`
Expected: FAIL because the resource definitions do not yet declare the new properties.

- [ ] **Step 3: Add media-picker properties and user-facing labels**

```js
// src/admin/adminjs/resources/site-settings.js
properties: {
  header_logo_media_id: buildMediaPickerProperty({ description: '站点头部 Logo。' }),
  footer_logo_media_id: buildMediaPickerProperty({ description: '站点底部 Logo。' }),
  home_banner_media_id: buildMediaPickerProperty({ description: '首页轮播图（第一张）。' }),
  home_banner_secondary_media_id: buildMediaPickerProperty({ description: '首页轮播图（第二张）。' }),
  news_banner_media_id: buildMediaPickerProperty({ description: '新闻列表页 banner。' }),
  contact_phone_icon_media_id: buildMediaPickerProperty({ description: '底部联系电话图标。' }),
  // ...
}

// src/admin/adminjs/resources/news-articles.js
propertyOverrides: {
  hero_media_id: buildMediaPickerProperty({ description: '新闻封面图（用于首页/列表卡片）。' }),
  banner_media_id: buildMediaPickerProperty({ description: '新闻详情页顶部 banner。' }),
}
```

- [ ] **Step 4: Run the AdminJS resource tests again**

Run: `node --test tests/admin-adminjs-resources.test.js`
Expected: PASS with the new fields visible in the resource payload/UI HTML.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminjs/resources/site-settings.js src/admin/adminjs/resources/pages.js src/admin/adminjs/resources/news-articles.js tests/admin-adminjs-resources.test.js
git commit -m "feat: expose branding and banner media fields in admin"
```

### Task 3: Make public header/footer branding and hero panels image-driven

**Files:**
- Modify: `src/services/public-site-service.js`
- Modify: `src/routes/public.js`
- Modify: `src/views/partials/public-header.ejs`
- Modify: `src/views/partials/public-footer.ejs`
- Modify: `src/views/partials/hero.ejs`
- Modify: `public/css/public.css`
- Modify: `public/js/site.js`
- Test: `tests/public-routing.test.js`

- [ ] **Step 1: Write failing public-route tests for image logos, footer icons, and home hero rotation**

```js
assert.match(home.text, /site-brand__image/);
assert.match(home.text, /data-hero-slider/);
assert.match(home.text, /contact-list__icon-image/);
assert.match(home.text, /background-image:\s*url\(&quot;\/media\/home-banner-1\.png&quot;\)/);
assert.match(home.text, /background-image:\s*url\(&quot;\/media\/home-banner-2\.png&quot;\)/);
```

- [ ] **Step 2: Run the targeted public-route tests**

Run: `node --test tests/public-routing.test.js`
Expected: FAIL because the current templates still render text logos, emoji icons, and a single gradient hero background.

- [ ] **Step 3: Implement service, route, template, CSS, and JS changes**

```js
// src/services/public-site-service.js
function buildSiteChrome(site) {
  const assets = mediaRepository.findByIds([
    site.headerLogoMediaId,
    site.footerLogoMediaId,
    site.homeBannerMediaId,
    site.homeBannerSecondaryMediaId,
    site.aboutBannerMediaId,
    site.productsBannerMediaId,
    site.solutionsBannerMediaId,
    site.newsBannerMediaId,
    site.casesBannerMediaId,
    site.contactBannerMediaId,
    site.contactPhoneIconMediaId,
    site.contactEmailIconMediaId,
    site.contactAddressIconMediaId,
  ].filter(Boolean));

  return {
    headerLogoAsset: assetMap.get(site.headerLogoMediaId) || null,
    footerLogoAsset: assetMap.get(site.footerLogoMediaId) || null,
    homeHeroSlides: [site.homeBannerMediaId, site.homeBannerSecondaryMediaId].filter(Boolean).map((id) => assetMap.get(id)).filter(Boolean),
    contactIcons: {
      phone: assetMap.get(site.contactPhoneIconMediaId) || null,
      email: assetMap.get(site.contactEmailIconMediaId) || null,
      address: assetMap.get(site.contactAddressIconMediaId) || null,
    },
  };
}
```

- [ ] **Step 4: Run the public-route tests again**

Run: `node --test tests/public-routing.test.js`
Expected: PASS with image logos, footer icons, and a two-slide homepage hero rendered in the markup.

- [ ] **Step 5: Commit**

```bash
git add src/services/public-site-service.js src/routes/public.js src/views/partials/public-header.ejs src/views/partials/public-footer.ejs src/views/partials/hero.ejs public/css/public.css public/js/site.js tests/public-routing.test.js
git commit -m "feat: render public branding and hero banners from media assets"
```

### Task 4: Redesign home/news cards and add 10-item pagination on the news index

**Files:**
- Modify: `src/services/public-site-service.js`
- Modify: `src/routes/public.js`
- Modify: `src/views/public/home.ejs`
- Modify: `src/views/public/news-index.ejs`
- Modify: `public/css/public.css`
- Test: `tests/public-routing.test.js`

- [ ] **Step 1: Write failing tests for the new news-card layout and pager**

```js
const newsIndex = await request(app).get('/news?page=2').set('host', 'dma.b8water.com');
assert.equal(newsIndex.status, 200);
assert.match(newsIndex.text, /news-list-card__cover/);
assert.match(newsIndex.text, /pagination/);
assert.match(newsIndex.text, /page=2/);
assert.doesNotMatch(home.text, /<li[\s\S]*第四篇新闻/);
```

- [ ] **Step 2: Run the public-route tests to confirm failure**

Run: `node --test tests/public-routing.test.js`
Expected: FAIL because the current news list has no cover column or pager and the home/news templates do not enforce the new DOM structure.

- [ ] **Step 3: Implement paginated route/service data and two-column card markup**

```js
// src/routes/public.js
router.get('/news', (req, res) => {
  const pageNumber = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const page = publicSiteService.getNewsPage(req.site, { page: pageNumber, pageSize: 10 });
  return renderPage(req, res, 'public/news-index', {
    articles: page.articles,
    pagination: page.pagination,
  });
});

// src/views/public/home.ejs
<% latestNews.slice(0, 3).forEach((article) => { %>
  <article class="news-list-card">
    <a class="news-list-card__cover" href="<%= sitePath('/news/' + article.slug) %>">
      <% if (article.coverAsset?.publicUrl) { %><img src="<%= article.coverAsset.publicUrl %>" alt="<%= article.coverAsset.altText || article.title %>" /><% } %>
    </a>
    <div class="news-list-card__body">...</div>
  </article>
<% }) %>
```

- [ ] **Step 4: Run the public-route tests again**

Run: `node --test tests/public-routing.test.js`
Expected: PASS with home limited to three stories and `/news` paginating at ten items per page.

- [ ] **Step 5: Commit**

```bash
git add src/services/public-site-service.js src/routes/public.js src/views/public/home.ejs src/views/public/news-index.ejs public/css/public.css tests/public-routing.test.js
git commit -m "feat: redesign news cards and paginate news index"
```

### Task 5: Separate news-detail banners from covers and lock in seeded regression coverage

**Files:**
- Modify: `src/views/public/news-detail.ejs`
- Modify: `src/services/public-site-service.js`
- Modify: `src/routes/public.js`
- Modify: `tests/helpers/public-fixtures.js`
- Modify: `tests/end-to-end-smoke.test.js`
- Modify: `data/seeds/dma.json`
- Modify: `data/seeds/bigfoot.json`

- [ ] **Step 1: Write failing regression assertions for centered titles, hidden summary, and independent banner selection**

```js
const newsDetail = await request(app).get('/news/water-loss-summit').set('host', 'dma.b8water.com');
assert.match(newsDetail.text, /article-header__title--centered/);
assert.doesNotMatch(newsDetail.text, /article-header__summary/);
assert.match(newsDetail.text, /dma-news-detail-banner\.png/);
assert.doesNotMatch(newsDetail.text, /dma-news-cover-only\.png[\s\S]*article-header__cover-img/);
```

- [ ] **Step 2: Run the narrow regression files**

Run: `node --test tests/public-routing.test.js tests/end-to-end-smoke.test.js`
Expected: FAIL because detail pages still reuse the cover image path and still render the summary paragraph.

- [ ] **Step 3: Implement the detail-page split and update fixtures/seeds**

```js
// src/services/public-site-service.js
return {
  ...record,
  coverAsset: record.heroMediaId ? assets.get(record.heroMediaId) || null : null,
  bannerAsset: record.bannerMediaId ? assets.get(record.bannerMediaId) || null : null,
};

// src/views/public/news-detail.ejs
<% const bannerAsset = article?.bannerAsset || article?.coverAsset || null; %>
<div class="article-header__meta article-header__meta--centered">
  <h1 class="article-header__title article-header__title--centered"><%= article.title %></h1>
</div>
```

- [ ] **Step 4: Run the smoke/regression suite**

Run: `node --test tests/public-routing.test.js tests/end-to-end-smoke.test.js tests/admin-adminjs-resources.test.js`
Expected: PASS with seeded content exercising logos, hero slides, news covers, pagination, and detail banners.

- [ ] **Step 5: Commit**

```bash
git add src/views/public/news-detail.ejs src/services/public-site-service.js src/routes/public.js tests/helpers/public-fixtures.js tests/end-to-end-smoke.test.js data/seeds/dma.json data/seeds/bigfoot.json
git commit -m "feat: separate news detail banners from covers"
```

## Notes and Implementation Constraints

- Reuse the repository layer for all new fields; do not query SQLite directly from routes or EJS.
- Preserve multisite scoping for every new media reference and validate that selected assets belong to the current site or are global assets.
- Keep a safe fallback path: if no custom logo or icon is selected, continue rendering the current text/emoji fallback instead of leaving empty UI.
- Homepage rotation should not require a frontend framework; implement it as a small vanilla-JS slider that rotates only when at least two images exist.
- News pagination should preserve existing site-prefix behavior (`/dma/news?page=2`) via `sitePath()` rather than hand-built links.
- Seed updates should include at least two homepage banner images per site so the deployed demo site visibly exercises the carousel.

## Deployment status

- Synced to the remote test server at `http://8.142.93.198:8088/`.
- Verified on the remote server:
  - public home now renders site logos, a 2+ image hero slider, and image-backed footer contact icons;
  - news index renders cover-left/card-right items and paginates at 10 items per page;
  - news detail uses the dedicated banner, centers the title, and hides the summary block;
  - AdminJS site settings and news/pages edit forms expose the new media fields.
