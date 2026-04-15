const {
  applyContentHooks,
  buildContentResourceOptions,
  buildMediaPickerProperty,
  buildRichTextProperty,
  createModel,
  createPublishStateAttribute,
  createSiteKeyAttribute,
  createTimestampAttribute,
} = require('./shared');

function createPageModel(sequelize, DataTypes) {
  return createModel(sequelize, 'AdminJsPage', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    site_key: createSiteKeyAttribute(DataTypes),
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body_html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachment_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    seo_title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    seo_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    publish_state: createPublishStateAttribute(DataTypes),
    published_at: createTimestampAttribute(DataTypes, { allowNull: true }),
    deleted_at: createTimestampAttribute(DataTypes, { allowNull: true }),
    created_at: createTimestampAttribute(DataTypes),
    updated_at: createTimestampAttribute(DataTypes),
  }, {
    tableName: 'pages',
    excludeDeleted: true,
    hooks: {
      beforeValidate: applyContentHooks,
    },
  });
}

function createPagesResource(sequelize, DataTypes) {
  const Page = createPageModel(sequelize, DataTypes);

  return {
    resource: Page,
    options: buildContentResourceOptions({
      label: '页面',
      listProperties: ['id', 'site_key', 'path', 'title', 'publish_state', 'updated_at'],
      editProperties: ['site_key', 'parent_id', 'path', 'slug', 'title', 'summary', 'body_html', 'attachment_media_id', 'banner_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at'],
      filterProperties: ['site_key', 'path', 'slug', 'title', 'publish_state', 'updated_at'],
      showProperties: ['id', 'site_key', 'parent_id', 'path', 'slug', 'title', 'summary', 'body_html', 'attachment_media_id', 'banner_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'created_at', 'updated_at'],
      propertyOverrides: {
        summary: { type: 'textarea' },
        body_html: buildRichTextProperty(),
        attachment_media_id: buildMediaPickerProperty({ description: '选择页面附件素材。' }),
        banner_media_id: buildMediaPickerProperty({ description: '选择页面顶部 Banner 素材。' }),
        seo_description: { type: 'textarea' },
      },
    }),
  };
}

module.exports = {
  createPagesResource,
};
