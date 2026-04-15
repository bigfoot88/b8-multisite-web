const {
  buildSiteKeyProperty,
  createModel,
  createSiteKeyAttribute,
  createTimestampAttribute,
  mergeActionOptions,
} = require('./shared');
const { buildSiteScopedActions } = require('../site-context');

function createNavigationItemModel(sequelize, DataTypes) {
  return createModel(sequelize, 'AdminJsNavigationItem', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    site_key: createSiteKeyAttribute(DataTypes),
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    href: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    kind: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'link',
    },
    is_visible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: createTimestampAttribute(DataTypes),
    updated_at: createTimestampAttribute(DataTypes),
  }, {
    tableName: 'navigation_items',
  });
}

function createNavigationItemsResource(sequelize, DataTypes) {
  const NavigationItem = createNavigationItemModel(sequelize, DataTypes);

  return {
    resource: NavigationItem,
    options: {
      label: '导航菜单',
      navigation: {
        name: '平台',
        icon: 'Menu',
      },
      actions: mergeActionOptions(
        buildSiteScopedActions(),
      ),
      properties: {
        site_key: {
          ...buildSiteKeyProperty(),
          isVisible: { edit: false, filter: false, list: true, show: true },
        },
        created_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
        updated_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
      },
      listProperties: ['id', 'site_key', 'label', 'href', 'position', 'kind', 'is_visible'],
      editProperties: ['site_key', 'label', 'href', 'parent_id', 'position', 'kind', 'is_visible'],
      filterProperties: ['site_key', 'label', 'href', 'kind', 'is_visible'],
      showProperties: ['id', 'site_key', 'label', 'href', 'parent_id', 'position', 'kind', 'is_visible', 'created_at', 'updated_at'],
    },
  };
}

module.exports = {
  createNavigationItemsResource,
};
