const test = require('node:test');
const assert = require('node:assert/strict');

test('crawler inventory extracts product/news links and asset urls from sample html', async () => {
  const { buildInventoryFromHtml, buildRedirects } = await import('../scripts/crawl-site.mjs');
  const inventory = await buildInventoryFromHtml('tests/fixtures/crawl-sample.html');
  const redirects = buildRedirects('dma', 'https://example.com', inventory.pages);

  assert.equal(inventory.pages.includes('/news'), true);
  assert.equal(inventory.assets.some((item) => item.includes('.png')), true);
  assert.equal(inventory.assets.some((item) => item.includes('lazy-banner.png')), true);
  assert.equal(inventory.assets.includes('https://example.com/assets/site.css'), true);
  assert.equal(inventory.assets.includes('https://example.com/assets/site.js'), true);
  assert.equal(inventory.downloads.some((item) => item.url.endsWith('.pdf')), true);
  assert.equal(inventory.pages.includes('/col.jsp?m526pageno=2'), false);
  assert.equal(inventory.pages.includes('/assets/site.css'), false);
  assert.equal(inventory.pages.includes('/assets/site.js'), false);
  assert.equal(redirects.some((item) => item.sourcePath === '/news'), false);
  assert.equal(redirects.every((item) => item.statusCode === 301), true);
});

test('crawlSite fails when the required start page cannot be fetched', async () => {
  const { crawlSite } = await import('../scripts/crawl-site.mjs');

  await assert.rejects(
    () => crawlSite({
      siteKey: 'dma',
      baseUrl: 'http://127.0.0.1:9',
      maxPages: 1,
    }),
    /fetch|required page|curl|ECONNREFUSED/i,
  );
});
