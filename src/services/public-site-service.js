const sanitizeHtml = require('sanitize-html');

const richTextSanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td']),
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'class'],
    figure: ['class'],
    figcaption: ['class'],
    span: ['class', 'style'],
    p: ['class', 'style'],
    div: ['class', 'style'],
    blockquote: ['class', 'style'],
    pre: ['class', 'style'],
    code: ['class', 'style'],
    h1: ['class', 'style'],
    h2: ['class', 'style'],
    h3: ['class', 'style'],
    h4: ['class', 'style'],
    h5: ['class', 'style'],
    h6: ['class', 'style'],
    ul: ['class', 'style'],
    ol: ['class', 'style'],
    li: ['class', 'style'],
    table: ['class', 'style', 'border', 'cellpadding', 'cellspacing'],
    thead: ['class', 'style'],
    tbody: ['class', 'style'],
    tr: ['class', 'style'],
    th: ['class', 'style', 'colspan', 'rowspan'],
    td: ['class', 'style', 'colspan', 'rowspan'],
  },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
      'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/],
      'font-family': [/^[^<>]+$/],
      'font-size': [/^[0-9.]+(px|pt|em|rem|%)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'line-height': [/^[0-9.]+$/],
      width: [/^[0-9.]+(px|%|em|rem)?$/],
      height: [/^[0-9.]+(px|%|em|rem)?$/],
      'margin-left': [/^[0-9.]+(px|em|rem|%)?$/],
    },
  },
};

function createPublicSiteService({
  siteRepository,
  catalogRepository,
  mediaRepository,
  redirectRepository,
}) {
  function isSiteOwnedOrGlobalAsset(siteKey, asset) {
    return asset && (asset.siteKey === null || asset.siteKey === siteKey);
  }

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
      bodyHtml: typeof record.bodyHtml === 'string' ? sanitizeHtml(record.bodyHtml, richTextSanitizeOptions) : record.bodyHtml,
      brochureAsset: record.brochureMediaId ? assets.get(record.brochureMediaId) || null : null,
      attachmentAsset: record.attachmentMediaId ? assets.get(record.attachmentMediaId) || null : null,
      heroAsset: record.heroMediaId ? assets.get(record.heroMediaId) || null : null,
    };
  }

  function attachAssetList(records) {
    const assetMap = mapAssetsById(records);
    return records.map((record) => attachAssets(record, assetMap));
  }

  function attachSiteSettingsAssets(site) {
    if (!site) {
      return null;
    }

    const assetMap = new Map(
      mediaRepository.findByIds([
        site.homeBannerMediaId,
        site.homeBannerSecondaryMediaId,
        site.homeFeatureMediaId,
      ])
        .filter((asset) => isSiteOwnedOrGlobalAsset(site.siteKey, asset))
        .map((asset) => [asset.id, asset]),
    );

    return {
      ...site,
      homeHeroSlides: [site.homeBannerMediaId, site.homeBannerSecondaryMediaId]
        .filter(Boolean)
        .map((mediaId) => assetMap.get(mediaId) || null)
        .filter(Boolean),
      homeFeatureAsset: site.homeFeatureMediaId ? assetMap.get(site.homeFeatureMediaId) || null : null,
    };
  }

  function listVisibleNavigation(siteKey) {
    return siteRepository
      .listNavigation(siteKey)
      .filter((item) => item.isVisible);
  }

  function getSiteFrame(site) {
    const hydratedSite = attachSiteSettingsAssets(site);
    const siteKey = hydratedSite.siteKey;
    const publishedSections = siteRepository.listPublishedSections(siteKey);
    const heroSection = publishedSections.find((section) => section.sectionKey === 'hero' || section.sectionKey === 'hero-banner') || null;

    return {
      site: hydratedSite,
      navigation: listVisibleNavigation(siteKey),
      publishedSections,
      heroSection,
    };
  }

  function getHomePage(site) {
    const frame = getSiteFrame(site);
    const siteKey = frame.site.siteKey;

    return {
      ...frame,
      featuredProducts: attachAssetList(catalogRepository.listPublishedProducts(siteKey, { limit: 3 })),
      featuredSolutions: attachAssetList(catalogRepository.listPublishedSolutions(siteKey, { limit: 3 })),
      latestNews: attachAssetList(catalogRepository.listPublishedNewsArticles(siteKey, { limit: 3 })),
      featuredCases: attachAssetList(catalogRepository.listPublishedCaseStudies(siteKey, { limit: 3 })),
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
