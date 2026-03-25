const { createAdminCatalogRouter } = require('./admin-catalog');

function createAdminCasesRouter() {
  return createAdminCatalogRouter({
    collectionKey: 'cases',
    pathSegment: 'cases',
    pageTitle: '案例管理',
    pageDescription: '维护案例标题、摘要、正文与发布状态。',
    listView: '../admin/lists/cases',
    formView: '../admin/forms/case',
    emptyRecord: {
      id: null,
      slug: '',
      title: '',
      summary: '',
      bodyHtml: '',
      attachmentMediaId: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 100,
      publishState: 'draft',
    },
  });
}

module.exports = {
  createAdminCasesRouter,
};
