const express = require('express');

const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function createAdminNavigationRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/:siteKey/navigation', requireKnownSite, (req, res) => {
    const items = req.app.locals.siteRepository.listNavigation(req.params.siteKey);
    const editId = req.query.edit ? Number.parseInt(req.query.edit, 10) : null;
    const item = editId ? req.app.locals.siteRepository.getNavigationItem(req.params.siteKey, editId) : null;

    return renderAdmin(req, res, {
      title: '导航菜单 · 中文后台',
      pageTitle: '导航菜单',
      pageDescription: '管理站点顶部导航、层级关系与可见性。',
      bodyView: '../admin/lists/navigation',
      currentPath: `/admin/${req.params.siteKey}/navigation`,
      siteKey: req.params.siteKey,
      items,
      item,
      emptyItem: {
        id: null,
        label: '',
        href: '',
        parentId: null,
        position: items.length,
        kind: 'link',
        isVisible: true,
      },
    });
  });

  router.post('/:siteKey/navigation', requireKnownSite, (req, res) => {
    req.app.locals.siteRepository.saveNavigationItem({
      siteKey: req.params.siteKey,
      id: req.body?.id || null,
      label: req.body?.label?.trim() || '未命名导航',
      href: req.body?.href?.trim() || '#',
      parentId: req.body?.parentId || null,
      position: req.body?.position,
      kind: req.body?.kind?.trim() || 'link',
      isVisible: req.body?.isVisible === '1',
    });

    return res.redirect(`/admin/${req.params.siteKey}/navigation`);
  });

  router.post('/:siteKey/navigation/:id/delete', requireKnownSite, (req, res) => {
    req.app.locals.siteRepository.deleteNavigationItem(req.params.siteKey, req.params.id);
    return res.redirect(`/admin/${req.params.siteKey}/navigation`);
  });

  return router;
}

module.exports = {
  createAdminNavigationRouter,
};
