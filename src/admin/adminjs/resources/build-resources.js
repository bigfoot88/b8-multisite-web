const { createSiteSettingsResource } = require('./site-settings');
const { createMediaAssetsResource } = require('./media-assets');
const { createPagesResource } = require('./pages');
const { createProductsResource } = require('./products');
const { createSolutionsResource } = require('./solutions');
const { createNewsArticlesResource } = require('./news-articles');
const { createCaseStudiesResource } = require('./case-studies');
const { createNavigationItemsResource } = require('./navigation-items');
const { createSiteSectionsResource } = require('./site-sections');

function buildResources(sequelize, DataTypes) {
  return [
    createSiteSettingsResource(sequelize, DataTypes),
    createMediaAssetsResource(sequelize, DataTypes),
    createPagesResource(sequelize, DataTypes),
    createProductsResource(sequelize, DataTypes),
    createSolutionsResource(sequelize, DataTypes),
    createNewsArticlesResource(sequelize, DataTypes),
    createCaseStudiesResource(sequelize, DataTypes),
    createNavigationItemsResource(sequelize, DataTypes),
    createSiteSectionsResource(sequelize, DataTypes),
  ];
}

module.exports = {
  buildResources,
};
