const { createAdminCatalogRouter } = require('./admin-catalog');

function createAdminNewsRouter() {
  return createAdminCatalogRouter({
    collectionKey: 'news',
    pathSegment: 'news',
    pageTitle: '新闻管理',
    pageDescription: '维护新闻资讯、摘要、正文与发布时间。',
    listView: '../admin/lists/news',
    formView: '../admin/forms/news',
    emptyRecord: {
      id: null,
      slug: '',
      title: '',
      summary: '',
      bodyHtml: '',
      heroMediaId: '',
      heroAsset: null,
      seoTitle: '',
      seoDescription: '',
      sortOrder: 100,
      publishState: 'draft',
    },
  });
}

module.exports = {
  createAdminNewsRouter,
};
