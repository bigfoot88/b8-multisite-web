const {
  buildSiteKeyProperty,
  createModel,
  createSiteKeyAttribute,
  createTimestampAttribute,
  mergeActionOptions,
} = require('./shared');
const { buildSiteScopedActions } = require('../site-context');

function createMediaAssetModel(sequelize, DataTypes) {
  return createModel(sequelize, 'AdminJsMediaAsset', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    asset_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    site_key: createSiteKeyAttribute(DataTypes, { allowNull: true }),
    source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    storage_path: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    alt_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata_json: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
    },
    created_at: createTimestampAttribute(DataTypes),
    updated_at: createTimestampAttribute(DataTypes),
  }, {
    tableName: 'media_assets',
  });
}

function createMediaAssetsResource(sequelize, DataTypes) {
  const MediaAsset = createMediaAssetModel(sequelize, DataTypes);

  return {
    resource: MediaAsset,
    options: {
      label: '媒体库',
      navigation: {
        name: '平台',
        icon: 'Image',
      },
      actions: mergeActionOptions(
        buildSiteScopedActions({ allowBlank: true }),
      ),
      properties: {
        site_key: {
          ...buildSiteKeyProperty({ allowBlank: true }),
          isVisible: { edit: false, filter: false, list: true, show: true },
          label: '站点',
        },
        asset_key: {
          label: '素材键',
        },
        source_url: {
          type: 'textarea',
          label: '来源 URL',
        },
        storage_path: {
          type: 'textarea',
          label: '存储路径',
        },
        filename: {
          label: '文件名',
        },
        mime_type: {
          label: '文件类型',
        },
        alt_text: {
          type: 'textarea',
          label: '替代文字',
        },
        metadata_json: {
          type: 'textarea',
          label: '元数据 JSON',
        },
        created_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
          label: '创建时间',
        },
        updated_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
          label: '更新时间',
        },
      },

      listProperties: ['id', 'site_key', 'asset_key', 'filename', 'mime_type', 'updated_at'],
      editProperties: ['site_key', 'asset_key', 'source_url', 'filename', 'mime_type', 'storage_path', 'alt_text', 'metadata_json'],
      filterProperties: ['site_key', 'asset_key', 'filename', 'mime_type'],
      showProperties: ['id', 'site_key', 'asset_key', 'source_url', 'filename', 'mime_type', 'storage_path', 'alt_text', 'metadata_json', 'created_at', 'updated_at'],
    },
  };
}

module.exports = {
  createMediaAssetsResource,
};
