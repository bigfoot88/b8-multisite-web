const express = require('express');

const { createHostRoutingMiddleware, getThemeForSite } = require('../lib/host-routing');
const { sites } = require('../config/sites');

function normalizePagePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function buildPageTitle(base, site) {
  return base ? `${base} · ${site.brandName}` : (site.seoTitle || site.brandName);
}

function normalizeBasePath(basePath) {
  if (!basePath) {
    return '';
  }

  return `/${String(basePath).replace(/^\/+|\/+$/g, '')}`;
}

function createSiteLink(basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);

  return function siteLink(target = '/') {
    if (!target || target === '/') {
      return normalizedBasePath || '/';
    }

    if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(target)) {
      return target;
    }

    if (!normalizedBasePath) {
      return target;
    }

    if (target.startsWith('/')) {
      return `${normalizedBasePath}${target}`;
    }

    return `${normalizedBasePath}/${target}`;
  };
}

function splitUrlPathAndSearch(url = '') {
  const questionMarkIndex = url.indexOf('?');
  if (questionMarkIndex === -1) {
    return { pathname: url, search: '' };
  }

  return {
    pathname: url.slice(0, questionMarkIndex),
    search: url.slice(questionMarkIndex),
  };
}

function resolvePrefixedSiteKey(pathname) {
  const normalizedPath = String(pathname || '/');

  for (const siteKey of sites) {
    if (normalizedPath === `/${siteKey}` || normalizedPath.startsWith(`/${siteKey}/`)) {
      return siteKey;
    }
  }

  return null;
}

function stripSitePrefix(pathname, siteKey) {
  const normalizedPath = String(pathname || '/');
  const prefix = `/${siteKey}`;

  if (normalizedPath === prefix) {
    return '/';
  }

  if (normalizedPath.startsWith(`${prefix}/`)) {
    return normalizedPath.slice(prefix.length) || '/';
  }

  return normalizedPath;
}

function createPublicRouter({ siteRepository, publicSiteService }) {
  const router = express.Router();

  router.use(createHostRoutingMiddleware(siteRepository));
  router.use((req, res, next) => {
    if (req.site) {
      req.siteBasePath = '';
      req.sitePath = createSiteLink('');
      res.locals.siteTheme = req.siteTheme;
      res.locals.siteBasePath = req.siteBasePath;
      res.locals.sitePath = req.sitePath;
      const frame = publicSiteService.getSiteFrame(req.site);
      res.locals.site = frame.site;
      res.locals.navigation = frame.navigation;
      res.locals.heroSection = frame.heroSection;
      res.locals.publishedSections = frame.publishedSections;
      return next();
    }

    const prefixedSiteKey = resolvePrefixedSiteKey(req.path);
    if (prefixedSiteKey) {
      const site = siteRepository.getSiteSettings(prefixedSiteKey);
      if (!site) {
        return next();
      }

      const strippedPath = stripSitePrefix(req.path, prefixedSiteKey);
      const { search } = splitUrlPathAndSearch(req.url);

      req.site = site;
      req.siteTheme = getThemeForSite(prefixedSiteKey);
      req.siteBasePath = `/${prefixedSiteKey}`;
      req.sitePath = createSiteLink(req.siteBasePath);
      req.url = `${strippedPath}${search}`;
      res.locals.siteTheme = req.siteTheme;
      res.locals.siteBasePath = req.siteBasePath;
      res.locals.sitePath = req.sitePath;

      const frame = publicSiteService.getSiteFrame(req.site);
      res.locals.site = frame.site;
      res.locals.navigation = frame.navigation;
      res.locals.heroSection = frame.heroSection;
      res.locals.publishedSections = frame.publishedSections;
      return next();
    }

    const sitesList = siteRepository.listSiteSettings();
    return res.status(200).render('public/landing', {
      pageTitle: 'B8 多站点内容平台',
      pageDescription: '选择 DMA 或 Bigfoot 站点继续访问。',
      currentPath: req.path,
      site: null,
      theme: req.siteTheme,
      sitePath: createSiteLink(''),
      siteCards: sitesList.map((item) => ({
        ...item,
        path: `/${item.siteKey}/`,
      })),
    });
  });

  router.use((req, res, next) => {
    const search = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
    const redirectRule = publicSiteService.findRedirect(req.site.siteKey, req.path, search);
    if (redirectRule) {
      return res.redirect(redirectRule.statusCode, redirectRule.targetPath);
    }
    return next();
  });

  function renderNotFound(req, res) {
    const site = res.locals.site || req.site;

    return res.status(404).render('public/not-found', {
      pageTitle: buildPageTitle('未找到相关页面', site),
      pageDescription: site.seoDescription || '',
      currentPath: req.path,
      site,
      theme: req.siteTheme,
      siteTheme: req.siteTheme,
      navigation: res.locals.navigation,
      sitePath: req.sitePath || createSiteLink(req.siteBasePath || ''),
      hero: {
        eyebrow: site.brandName,
        title: '未找到相关页面',
        summary: '请返回首页或通过导航继续浏览公开内容。',
      },
    });
  }

  function renderPage(req, res, view, payload) {
    const site = payload.site || res.locals.site || req.site;

    return res.render(view, {
      site,
      theme: req.siteTheme,
      siteBasePath: req.siteBasePath || '',
      sitePath: req.sitePath || createSiteLink(req.siteBasePath || ''),
      navigation: res.locals.navigation,
      publishedSections: res.locals.publishedSections,
      heroSection: res.locals.heroSection,
      currentPath: req.siteBasePath ? stripSitePrefix(req.path, site.siteKey) : req.path,
      ...payload,
    });
  }

  function buildHomeHeroActions(page) {
    const configuredHref = page.heroSection?.config?.ctaHref;
    const configuredLabel = page.heroSection?.config?.ctaLabel;
    if (!configuredHref || !configuredLabel) {
      return [];
    }

    return [{
      href: configuredHref,
      label: configuredLabel,
      variant: 'primary',
    }];
  }

  router.get('/', (req, res) => {
    const page = publicSiteService.getHomePage(req.site);
    return renderPage(req, res, 'public/home', {
      site: page.site,
      pageTitle: page.site.seoTitle || page.site.brandName,
      pageDescription: page.site.seoDescription || '',
      hero: {
        eyebrow: null,
        title: page.heroSection?.heading || page.site.brandName,
        summary: page.heroSection?.subheading || page.heroSection?.body || page.site.seoDescription || '',
        body: page.heroSection?.body || '',
        actions: buildHomeHeroActions(page),
        backgroundSlides: [],
        textOnly: true,
      },
      featuredProducts: page.featuredProducts,
      featuredSolutions: page.featuredSolutions,
      latestNews: page.latestNews,
      featuredCases: page.featuredCases,
    });
  });

  router.get('/products', (req, res) => {
    const page = publicSiteService.getProductsPage(req.site);
    return renderPage(req, res, 'public/products', {
      pageTitle: buildPageTitle('产品中心', req.site),
      pageDescription: req.site.seoDescription || '',
      hero: {
        eyebrow: req.site.brandName,
        title: '产品中心',
        summary: '围绕供水营收、分区治理与现场作业的数字化产品矩阵。',
      },
      products: page.products,
    });
  });

  router.get('/products/:slug', (req, res) => {
    const product = publicSiteService.getProductDetail(req.site, req.params.slug);
    if (!product) {
      return renderNotFound(req, res);
    }

    return renderPage(req, res, 'public/product-detail', {
      pageTitle: buildPageTitle(product.seoTitle || product.title, req.site),
      pageDescription: product.seoDescription || product.summary || '',
      hero: {
        eyebrow: '产品详情',
        title: product.title,
        summary: product.summary || '',
      },
      product,
    });
  });

  router.get('/solutions', (req, res) => {
    const page = publicSiteService.getSolutionsPage(req.site);
    return renderPage(req, res, 'public/solutions', {
      pageTitle: buildPageTitle('解决方案', req.site),
      pageDescription: req.site.seoDescription || '',
      hero: {
        eyebrow: req.siteTheme.accent,
        title: '解决方案',
        summary: '结合行业场景提供从感知采集到业务闭环的落地方案。',
      },
      solutions: page.solutions,
    });
  });

  router.get('/solutions/:slug', (req, res) => {
    const solution = publicSiteService.getSolutionDetail(req.site, req.params.slug);
    if (!solution) {
      return renderNotFound(req, res);
    }

    return renderPage(req, res, 'public/solution-detail', {
      pageTitle: buildPageTitle(solution.seoTitle || solution.title, req.site),
      pageDescription: solution.seoDescription || solution.summary || '',
      hero: {
        eyebrow: '解决方案详情',
        title: solution.title,
        summary: solution.summary || '',
      },
      solution,
    });
  });

  router.get('/news', (req, res) => {
    const page = publicSiteService.getNewsPage(req.site);
    return renderPage(req, res, 'public/news-index', {
      pageTitle: buildPageTitle('新闻中心', req.site),
      pageDescription: req.site.seoDescription || '',
      hero: {
        eyebrow: req.site.brandName,
        title: '新闻中心',
        summary: '了解产品更新、行业活动与项目实践。',
      },
      articles: page.articles,
    });
  });

  router.get('/news/:slug', (req, res) => {
    const article = publicSiteService.getNewsDetail(req.site, req.params.slug);
    if (!article) {
      return renderNotFound(req, res);
    }

    return renderPage(req, res, 'public/news-detail', {
      pageTitle: buildPageTitle(article.seoTitle || article.title, req.site),
      pageDescription: article.seoDescription || article.summary || '',
      hero: {
        eyebrow: '新闻详情',
        title: article.title,
        summary: article.summary || '',
      },
      heroAsset: article.heroAsset || null,
      article,
    });
  });

  function renderCasesIndex(req, res) {
    const page = publicSiteService.getCasesPage(req.site);
    return renderPage(req, res, 'public/cases', {
      pageTitle: buildPageTitle('客户案例', req.site),
      pageDescription: req.site.seoDescription || '',
      hero: {
        eyebrow: req.siteTheme.accent,
        title: '客户案例',
        summary: '查看不同供水企业的项目落地成果与业务改善。',
      },
      cases: page.cases,
    });
  }

  function renderCaseDetail(req, res) {
    const item = publicSiteService.getCaseDetail(req.site, req.params.slug);
    if (!item) {
      return renderNotFound(req, res);
    }

    return renderPage(req, res, 'public/case-detail', {
      pageTitle: buildPageTitle(item.seoTitle || item.title, req.site),
      pageDescription: item.seoDescription || item.summary || '',
      hero: {
        eyebrow: '案例详情',
        title: item.title,
        summary: item.summary || '',
      },
      caseStudy: item,
    });
  }

  router.get('/cases', renderCasesIndex);
  router.get('/cases/:slug', renderCaseDetail);

  router.get('/about', (req, res) => {
    const page = publicSiteService.getAboutPage(req.site);
    if (!page) {
      return renderNotFound(req, res);
    }

    return renderPage(req, res, 'public/about', {
      pageTitle: buildPageTitle(page.seoTitle || page.title, req.site),
      pageDescription: page.seoDescription || page.summary || '',
      hero: {
        eyebrow: req.site.brandName,
        title: page.title,
        summary: page.summary || req.site.seoDescription || '',
      },
      page,
    });
  });

  router.get('/contact', (req, res) => {
    const page = publicSiteService.getContactPage(req.site);
    return renderPage(req, res, 'public/contact', {
      pageTitle: buildPageTitle('联系我们', req.site),
      pageDescription: req.site.seoDescription || '',
      hero: {
        eyebrow: req.site.brandName,
        title: '联系我们',
        summary: '欢迎预约演示、方案交流或业务咨询。',
      },
      page: page.page,
    });
  });

  router.get(/^\/.+/, (req, res) => {
    const page = publicSiteService.getGenericPage(req.site, normalizePagePath(req.path));
    if (!page) {
      return renderNotFound(req, res);
    }

    return renderPage(req, res, 'public/page', {
      pageTitle: buildPageTitle(page.seoTitle || page.title, req.site),
      pageDescription: page.seoDescription || page.summary || '',
      hero: {
        eyebrow: req.site.brandName,
        title: page.title,
        summary: page.summary || '',
      },
      page,
    });
  });

  return router;
}

module.exports = {
  createPublicRouter,
};
