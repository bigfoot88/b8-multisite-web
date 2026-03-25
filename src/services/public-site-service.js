const sanitizeHtml = require('sanitize-html');

function createPublicSiteService({
  siteRepository,
  catalogRepository,
  mediaRepository,
  redirectRepository,
}) {
  function mapAssetsById(records) {
    const mediaIds = new Set();

    for (const record of records) {
      if (!record) {
        continue;
      }
      if (record.brochureMediaId) {
        mediaIds.add(record.brochureMediaId);
      }
      if (record.attachmentMediaId) {
        mediaIds.add(record.attachmentMediaId);
      }
      if (record.heroMediaId) {
        mediaIds.add(record.heroMediaId);
      }
    }

    return new Map(mediaRepository.findByIds([...mediaIds]).map((asset) => [asset.id, asset]));
  }

  function attachAssets(record, assetMap = null) {
    if (!record) {
      return null;
    }

    const assets = assetMap || mapAssetsById([record]);

    return {
      ...record,
      bodyHtml: typeof record.bodyHtml === 'string' ? sanitizeHtml(record.bodyHtml) : record.bodyHtml,
      brochureAsset: record.brochureMediaId ? assets.get(record.brochureMediaId) || null : null,
      attachmentAsset: record.attachmentMediaId ? assets.get(record.attachmentMediaId) || null : null,
      heroAsset: record.heroMediaId ? assets.get(record.heroMediaId) || null : null,
    };
  }

  function attachAssetList(records) {
    const assetMap = mapAssetsById(records);
    return records.map((record) => attachAssets(record, assetMap));
  }

  function listVisibleNavigation(siteKey) {
    return siteRepository
      .listNavigation(siteKey)
      .filter((item) => item.isVisible);
  }

  function getSiteFrame(site) {
    const siteKey = site.siteKey;
    const publishedSections = siteRepository.listPublishedSections(siteKey);
    const heroSection = publishedSections.find((section) => section.sectionKey === 'hero' || section.sectionKey === 'hero-banner') || null;

    return {
      site,
      navigation: listVisibleNavigation(siteKey),
      publishedSections,
      heroSection,
    };
  }

  function getHomePage(site) {
    const frame = getSiteFrame(site);

    return {
      ...frame,
      featuredProducts: attachAssetList(catalogRepository.listPublishedProducts(site.siteKey, { limit: 3 })),
      featuredSolutions: attachAssetList(catalogRepository.listPublishedSolutions(site.siteKey, { limit: 3 })),
      latestNews: attachAssetList(catalogRepository.listPublishedNewsArticles(site.siteKey, { limit: 3 })),
      featuredCases: attachAssetList(catalogRepository.listPublishedCaseStudies(site.siteKey, { limit: 3 })),
    };
  }

  function getProductsPage(site) {
    return {
      ...getSiteFrame(site),
      products: attachAssetList(catalogRepository.listPublishedProducts(site.siteKey)),
    };
  }

  function getProductDetail(site, slug) {
    return attachAssets(catalogRepository.findPublishedProductBySlug(site.siteKey, slug));
  }

  function getSolutionsPage(site) {
    return {
      ...getSiteFrame(site),
      solutions: attachAssetList(catalogRepository.listPublishedSolutions(site.siteKey)),
    };
  }

  function getSolutionDetail(site, slug) {
    return attachAssets(catalogRepository.findPublishedSolutionBySlug(site.siteKey, slug));
  }

  function getNewsPage(site) {
    return {
      ...getSiteFrame(site),
      articles: attachAssetList(catalogRepository.listPublishedNewsArticles(site.siteKey)),
    };
  }

  function getNewsDetail(site, slug) {
    return attachAssets(catalogRepository.findPublishedNewsArticleBySlug(site.siteKey, slug));
  }

  function getCasesPage(site) {
    return {
      ...getSiteFrame(site),
      cases: attachAssetList(catalogRepository.listPublishedCaseStudies(site.siteKey)),
    };
  }

  function getCaseDetail(site, slug) {
    return attachAssets(catalogRepository.findPublishedCaseStudyBySlug(site.siteKey, slug));
  }

  function getAboutPage(site) {
    return attachAssets(catalogRepository.findPublishedPageByPath(site.siteKey, '/about'));
  }

  function getGenericPage(site, pagePath) {
    return attachAssets(catalogRepository.findPublishedPageByHierarchicalPath(site.siteKey, pagePath));
  }

  function getContactPage(site) {
    return {
      ...getSiteFrame(site),
      page: attachAssets(catalogRepository.findPublishedPageByPath(site.siteKey, '/contact')),
    };
  }

  function findRedirect(siteKey, pathname, search = '') {
    return redirectRepository.findActiveRule(siteKey, pathname, search);
  }

  return {
    attachAssets,
    findRedirect,
    getAboutPage,
    getCaseDetail,
    getCasesPage,
    getContactPage,
    getGenericPage,
    getHomePage,
    getNewsDetail,
    getNewsPage,
    getProductDetail,
    getProductsPage,
    getSiteFrame,
    getSolutionDetail,
    getSolutionsPage,
  };
}

module.exports = {
  createPublicSiteService,
};
