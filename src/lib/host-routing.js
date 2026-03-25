const siteThemes = {
  dma: {
    name: 'dma',
    label: 'DMA',
    accent: '夜间最小流量监测',
  },
  bigfoot: {
    name: 'bigfoot',
    label: 'Bigfoot',
    accent: '智慧水务营收管理',
  },
  default: {
    name: 'default',
    label: 'B8',
    accent: '多站点内容平台',
  },
};

function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase();
}

function resolveSiteForHostname(siteRepository, hostname) {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    return null;
  }

  return siteRepository.getSiteSettingsByDomain(normalizedHostname);
}

function getThemeForSite(siteKey) {
  return siteThemes[siteKey] || siteThemes.default;
}

function createHostRoutingMiddleware(siteRepository) {
  return (req, res, next) => {
    const site = resolveSiteForHostname(siteRepository, req.hostname);
    req.site = site;
    req.siteTheme = getThemeForSite(site?.siteKey);
    res.locals.site = site;
    res.locals.siteTheme = req.siteTheme;
    next();
  };
}

module.exports = {
  createHostRoutingMiddleware,
  getThemeForSite,
  normalizeHostname,
  resolveSiteForHostname,
};
