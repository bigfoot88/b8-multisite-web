const {
  buildMediaPickerProperty,
  buildSiteKeyProperty,
  buildRichTextProperty,
  buildVisibilityToggleProperty,
  createModel,
  createSiteKeyAttribute,
  createTimestampAttribute,
  mergeActionOptions,
} = require('./shared');
const { buildSiteScopedActions } = require('../site-context');

function createSiteSectionModel(sequelize, DataTypes) {
  return createModel(sequelize, 'AdminJsSiteSection', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    site_key: createSiteKeyAttribute(DataTypes),
    section_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    heading: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subheading: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    media_asset_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    config_json: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    published_at: createTimestampAttribute(DataTypes, { allowNull: true }),
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: createTimestampAttribute(DataTypes),
    updated_at: createTimestampAttribute(DataTypes),
  }, {
    tableName: 'site_sections',
    hooks: {
      beforeValidate(record) {
        if (record.get('is_published') && !record.get('published_at')) {
          record.set('published_at', new Date());
        }

        if (!record.get('is_published')) {
          record.set('published_at', null);
        }

        record.set('updated_at', new Date());
      },
    },
  });
}

function createSiteSectionsResource(sequelize, DataTypes) {
  const SiteSection = createSiteSectionModel(sequelize, DataTypes);

  return {
    resource: SiteSection,
    options: {
      label: '首页板块',
      navigation: {
        name: '平台',
        icon: 'Container',
      },
      actions: mergeActionOptions(
        buildSiteScopedActions(),
        {
          new: { containerWidth: [1, 1, 1, 1, 'calc(100vw - 128px)'] },
          edit: { containerWidth: [1, 1, 1, 1, 'calc(100vw - 128px)'] },
        },
      ),
      properties: {
        site_key: {
          ...buildSiteKeyProperty(),
          isVisible: { edit: false, filter: false, list: true, show: true },
        },
        is_published: buildVisibilityToggleProperty(),
        subheading: { type: 'textarea' },
        body: buildRichTextProperty(),
        media_asset_id: buildMediaPickerProperty({ description: '选择区块关联素材。' }),
        config_json: { type: 'textarea' },
        created_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
        updated_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
      },
      listProperties: ['id', 'site_key', 'section_key', 'heading', 'is_published', 'sort_order', 'updated_at'],
      editProperties: ['site_key', 'section_key', 'heading', 'subheading', 'body', 'media_asset_id', 'config_json', 'is_published', 'published_at', 'sort_order'],
      filterProperties: ['site_key', 'section_key', 'heading', 'is_published'],
      showProperties: ['id', 'site_key', 'section_key', 'heading', 'subheading', 'body', 'media_asset_id', 'config_json', 'is_published', 'published_at', 'sort_order', 'created_at', 'updated_at'],
    },
  };
}

module.exports = {
  createSiteSectionsResource,
};
