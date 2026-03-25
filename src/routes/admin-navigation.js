const express = require('express');

const { isExpectedAdminError } = require('../lib/admin-errors');
const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function createAdminNavigationRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  function renderNavigationPage(req, res, { status = 200, item = null, errorMessage = '' } = {}) {
    const items = req.app.locals.siteRepository.listNavigation(req.params.siteKey);
    const editId = item?.id ? Number.parseInt(item.id, 10) : (req.query.edit ? Number.parseInt(req.query.edit, 10) : null);
    const currentItem = item || (editId ? req.app.locals.siteRepository.getNavigationItem(req.params.siteKey, editId) : null);

    res.status(status);
    return renderAdmin(req, res, {
      title: '导航菜单 · 中文后台',
      pageTitle: '导航菜单',
      pageDescription: '管理站点顶部导航、层级关系与可见性。',
      bodyView: '../admin/lists/navigation',
      currentPath: `/admin/${req.params.siteKey}/navigation`,
      siteKey: req.params.siteKey,
      items,
      item: currentItem,
      emptyItem: {
        id: null,
        label: '',
        href: '',
        parentId: null,
        position: items.length,
        kind: 'link',
        isVisible: true,
      },
      errorMessage,
    });
  }

  router.get('/:siteKey/navigation', requireKnownSite, (req, res) => {
    return renderNavigationPage(req, res);
  });

  router.post('/:siteKey/navigation', requireKnownSite, (req, res, next) => {
    try {
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
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderNavigationPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          item: {
            id: req.body?.id || null,
            label: req.body?.label?.trim() || '未命名导航',
            href: req.body?.href?.trim() || '#',
            parentId: req.body?.parentId || null,
            position: req.body?.position ?? 0,
            kind: req.body?.kind?.trim() || 'link',
            isVisible: req.body?.isVisible === '1',
          },
        });
      }

      return next(error);
    }

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
