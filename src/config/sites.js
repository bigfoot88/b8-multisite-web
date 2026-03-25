const sites = ['dma', 'bigfoot'];

function assertValidSiteKey(siteKey) {
  if (!sites.includes(siteKey)) {
    throw new Error(`siteKey must be one of: ${sites.join(', ')}`);
  }
}

module.exports = {
  assertValidSiteKey,
  sites,
};
