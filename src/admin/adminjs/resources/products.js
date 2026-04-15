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

function createProductModel(sequelize, DataTypes) {
  return createModel(sequelize, 'AdminJsProduct', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    site_key: createSiteKeyAttribute(DataTypes),
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
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
    brochure_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    attachment_media_id: {
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
    tableName: 'products',
    excludeDeleted: true,
    hooks: {
      beforeValidate: applyContentHooks,
    },
  });
}

function createProductsResource(sequelize, DataTypes) {
  const Product = createProductModel(sequelize, DataTypes);

  return {
    resource: Product,
    options: buildContentResourceOptions({
      label: '产品',
      listProperties: ['id', 'site_key', 'slug', 'title', 'publish_state', 'updated_at'],
      editProperties: ['site_key', 'slug', 'title', 'summary', 'body_html', 'brochure_media_id', 'attachment_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at'],
      filterProperties: ['site_key', 'slug', 'title', 'publish_state', 'updated_at'],
      showProperties: ['id', 'site_key', 'slug', 'title', 'summary', 'body_html', 'brochure_media_id', 'attachment_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'created_at', 'updated_at'],
      propertyOverrides: {
        summary: { type: 'textarea' },
        body_html: buildRichTextProperty(),
        brochure_media_id: buildMediaPickerProperty({ description: '选择产品手册素材。' }),
        attachment_media_id: buildMediaPickerProperty({ description: '选择产品附件素材。' }),
        seo_description: { type: 'textarea' },
      },
    }),
  };
}

module.exports = {
  createProductsResource,
};
