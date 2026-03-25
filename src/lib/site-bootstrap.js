const defaultSites = {
  dma: {
    brandName: 'DMA',
    domain: 'dma.local',
  },
  bigfoot: {
    brandName: 'Bigfoot',
    domain: 'bigfoot.local',
  },
};

function defaultSiteFor(siteKey) {
  return defaultSites[siteKey] || {
    brandName: siteKey.toUpperCase(),
    domain: `${siteKey}.local`,
  };
}

function createSiteBootstrap(db) {
  const insertSite = db.prepare(`
    INSERT INTO site_settings (site_key, brand_name, domain)
    VALUES (@siteKey, @brandName, @domain)
    ON CONFLICT(site_key) DO NOTHING
  `);

  return {
    ensureSite(siteKey) {
      const defaults = defaultSiteFor(siteKey);
      insertSite.run({
        siteKey,
        brandName: defaults.brandName,
        domain: defaults.domain,
      });
    },
  };
}

module.exports = {
  createSiteBootstrap,
};
