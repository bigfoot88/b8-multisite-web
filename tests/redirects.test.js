const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { withPublicApp } = require('./helpers/public-fixtures');

test('legacy redirects resolve before public content rendering and stay site-scoped', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-redirects-');

  const newsRedirect = await request(app)
    .get('/nd.jsp?id=111')
    .set('host', 'dma.b8water.com');
  assert.equal(newsRedirect.status, 301);
  assert.equal(newsRedirect.headers.location, '/news/water-loss-summit');
  assert.doesNotMatch(newsRedirect.text, /不应在重定向前显示/);

  const contactRedirect = await request(app)
    .get('/old-contact')
    .set('host', 'dma.b8water.com');
  assert.equal(contactRedirect.status, 302);
  assert.equal(contactRedirect.headers.location, '/contact');

  const otherSite = await request(app)
    .get('/nd.jsp?id=111')
    .set('host', 'www.chinabigfoot.com');
  assert.equal(otherSite.status, 404);
  assert.match(otherSite.text, /未找到相关页面/);
});
