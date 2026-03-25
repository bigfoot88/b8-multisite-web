const { sites } = require('../config/sites');

const siteLabels = {
  dma: 'DMA 站点',
  bigfoot: '同创站点',
};

const siteDescriptions = {
  dma: '管理 DMA 中文站的站点设置、栏目与内容。',
  bigfoot: '管理同创中文站的站点设置、栏目与内容。',
};

const sectionLinks = [
  { key: 'settings', href: (siteKey) => `/admin/${siteKey}/settings`, label: '站点设置', description: '联系方式与 SEO' },
  { key: 'sections', href: (siteKey) => `/admin/${siteKey}/sections`, label: '首页模块', description: 'Hero 与首页区块' },
  { key: 'navigation', href: (siteKey) => `/admin/${siteKey}/navigation`, label: '导航菜单', description: '站点导航与层级' },
  { key: 'pages', href: (siteKey) => `/admin/${siteKey}/pages`, label: '页面', description: '层级路径页面' },
  { key: 'products', href: (siteKey) => `/admin/${siteKey}/products`, label: '产品', description: '产品内容与状态' },
  { key: 'solutions', href: (siteKey) => `/admin/${siteKey}/solutions`, label: '解决方案', description: '方案内容与状态' },
  { key: 'news', href: (siteKey) => `/admin/${siteKey}/news`, label: '新闻', description: '新闻资讯' },
  { key: 'cases', href: (siteKey) => `/admin/${siteKey}/cases`, label: '案例', description: '客户案例' },
];

function buildNavLinks(siteKey) {
  const links = [
    {
      key: 'dashboard',
      href: '/admin',
      label: '总控台',
      description: '返回多站点后台总览。',
    },
    ...sites.map((key) => ({
      key,
      href: `/admin/${key}`,
      label: siteLabels[key],
      description: siteDescriptions[key],
    })),
    {
      key: 'media',
      href: '/admin/media',
      label: '媒体库',
      description: '统一管理图片、附件与上传素材。',
    },
  ];

  if (siteKey && sites.includes(siteKey)) {
    links.push(
      ...sectionLinks.map((link) => ({
        key: `${siteKey}-${link.key}`,
        href: link.href(siteKey),
        label: link.label,
        description: link.description,
      })),
    );
  }

  return links;
}

function requireKnownSite(req, res, next) {
  if (!sites.includes(req.params.siteKey)) {
    return res.redirect('/admin');
  }

  return next();
}

function renderAdmin(req, res, {
  title,
  pageTitle,
  pageDescription,
  bodyView,
  currentPath,
  siteKey = null,
  ...locals
}) {
  return res.render('layouts/admin', {
    title,
    pageTitle,
    pageDescription,
    bodyView,
    currentPath,
    navLinks: buildNavLinks(siteKey),
    adminSession: req.adminSession,
    siteKey,
    siteLabel: siteLabels[siteKey] || null,
    ...locals,
  });
}

module.exports = {
  buildNavLinks,
  renderAdmin,
  requireKnownSite,
  sectionLinks,
  siteDescriptions,
  siteLabels,
};
