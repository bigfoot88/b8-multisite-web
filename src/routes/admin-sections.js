const express = require('express');

const { createAdminValidationError, isExpectedAdminError } = require('../lib/admin-errors');
const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function parseConfig(configJson) {
  if (!String(configJson || '').trim()) {
    return {};
  }

  try {
    return JSON.parse(configJson);
  } catch {
    throw createAdminValidationError('配置 JSON 格式不正确，请检查后重试。', 'invalid-section-config-json');
  }
}

function createAdminSectionsRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  function buildSectionDraft(input = {}, fallbackSectionKey = '') {
    return {
      sectionKey: typeof input.sectionKey === 'string' ? input.sectionKey.trim() : fallbackSectionKey,
      heading: input.heading || '',
      subheading: input.subheading || '',
      body: input.body || '',
      mediaAssetId: input.mediaAssetId ?? '',
      sortOrder: input.sortOrder ?? 0,
      isPublished: input.isPublished === '1' || input.isPublished === 1 || input.isPublished === true,
      config: input.config || {},
      configJson: typeof input.configJson === 'string' ? input.configJson : JSON.stringify(input.config || {}, null, 2),
    };
  }

  function resolveSectionMediaAssetId(body, existingSection = null) {
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'mediaAssetId')) {
      return existingSection?.mediaAssetId ?? null;
    }

    return body.mediaAssetId;
  }

  function renderSectionsPage(req, res, { status = 200, section = undefined, errorMessage = '' } = {}) {
    const sections = req.app.locals.siteRepository.listSections(req.params.siteKey);
    const editKey = req.query.edit || '';
    const selectedSection = section === undefined
      ? (editKey ? req.app.locals.siteRepository.getSection(req.params.siteKey, editKey) : null)
      : section;

    res.status(status);
    return renderAdmin(req, res, {
      title: '首页模块 · 中文后台',
      pageTitle: '首页模块',
      pageDescription: '管理 Hero、亮点、数据卡片和预览模块的发布状态。',
      bodyView: '../admin/lists/sections',
      currentPath: `/admin/${req.params.siteKey}/sections`,
      siteKey: req.params.siteKey,
      sections,
      section: selectedSection,
      emptySection: {
        sectionKey: '',
        heading: '',
        subheading: '',
        body: '',
        mediaAssetId: '',
        sortOrder: 0,
        isPublished: true,
        config: {},
        configJson: '{}',
      },
      errorMessage,
    });
  }

  router.get('/:siteKey/sections', requireKnownSite, (req, res) => renderSectionsPage(req, res));

  router.post('/:siteKey/sections', requireKnownSite, (req, res, next) => {
    const sectionKey = req.body?.sectionKey?.trim();
    if (!sectionKey) {
      return renderSectionsPage(req, res, {
        status: 400,
        errorMessage: '模块键名不能为空，请填写后重试。',
        section: buildSectionDraft(req.body),
      });
    }

    try {
      req.app.locals.siteRepository.saveSection({
        siteKey: req.params.siteKey,
        sectionKey,
        heading: req.body?.heading?.trim() || null,
        subheading: req.body?.subheading?.trim() || null,
        body: req.body?.body?.trim() || null,
        mediaAssetId: resolveSectionMediaAssetId(req.body),
        sortOrder: req.body?.sortOrder,
        isPublished: req.body?.isPublished === '1',
        config: parseConfig(req.body?.configJson),
      });
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderSectionsPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          section: buildSectionDraft(req.body),
        });
      }

      return next(error);
    }

    return res.redirect(`/admin/${req.params.siteKey}/sections`);
  });

  router.post('/:siteKey/sections/:sectionKey', requireKnownSite, (req, res, next) => {
    const existingSection = req.app.locals.siteRepository.getSection(req.params.siteKey, req.params.sectionKey);

    try {
      req.app.locals.siteRepository.saveSection({
        siteKey: req.params.siteKey,
        sectionKey: req.params.sectionKey,
        heading: req.body?.heading?.trim() || null,
        subheading: req.body?.subheading?.trim() || null,
        body: req.body?.body?.trim() || null,
        mediaAssetId: resolveSectionMediaAssetId(req.body, existingSection),
        sortOrder: req.body?.sortOrder,
        isPublished: req.body?.isPublished === '1',
        config: parseConfig(req.body?.configJson),
      });
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderSectionsPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          section: buildSectionDraft({
            mediaAssetId: resolveSectionMediaAssetId(req.body, existingSection) ?? '',
            ...req.body,
            sectionKey: req.params.sectionKey,
          }, req.params.sectionKey),
        });
      }

      return next(error);
    }

    return res.redirect(`/admin/${req.params.siteKey}/sections`);
  });

  router.post('/:siteKey/sections/:sectionKey/delete', requireKnownSite, (req, res) => {
    req.app.locals.siteRepository.deleteSection(req.params.siteKey, req.params.sectionKey);
    return res.redirect(`/admin/${req.params.siteKey}/sections`);
  });

  return router;
}

module.exports = {
  createAdminSectionsRouter,
};
