const { QueryTypes } = require('sequelize');
const {
  buildMediaPickerProperty,
  buildSiteKeyProperty,
  createModel,
  createSiteKeyAttribute,
  createTimestampAttribute,
  mergeActionOptions,
} = require('./shared');
const { createAdminValidationError } = require('../../../lib/admin-errors');
const { buildSiteScopedActions, getCurrentAdminSiteKey } = require('../site-context');

const HOMEPAGE_MEDIA_FIELDS = [
  ['home_banner_media_id', '首页全宽图（第一张）'],
  ['home_banner_secondary_media_id', '首页全宽图（第二张）'],
  ['home_feature_media_id', '首页解决方案主图'],
];

function normalizeSiteSettingsMediaId(value, label) {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    throw createAdminValidationError(`${label}必须是有效的媒体资源编号，请重新选择。`, 'invalid-site-settings-media-asset');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    if (!/^\d+$/.test(trimmed)) {
      throw createAdminValidationError(`${label}必须是有效的媒体资源编号，请重新选择。`, 'invalid-site-settings-media-asset');
    }
    return Number.parseInt(trimmed, 10);
  }

  if (!Number.isInteger(value)) {
    throw createAdminValidationError(`${label}必须是有效的媒体资源编号，请重新选择。`, 'invalid-site-settings-media-asset');
  }

  return value;
}

function buildHomepageMediaValidationBeforeHook(sequelize) {
  return async (request, context) => {
    if ((request.method || 'get').toLowerCase() !== 'post') {
      return request;
    }

    const payload = { ...(request.payload || {}) };
    const siteKey = getCurrentAdminSiteKey(context.currentAdmin);

    for (const [field, label] of HOMEPAGE_MEDIA_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(payload, field)) {
        continue;
      }

      const mediaId = normalizeSiteSettingsMediaId(payload[field], label);
      if (mediaId === null) {
        payload[field] = null;
        continue;
      }

      const media = await sequelize.query(
        'SELECT id, site_key FROM media_assets WHERE id = ? LIMIT 1',
        {
          replacements: [mediaId],
          plain: true,
          type: QueryTypes.SELECT,
        },
      );

      if (!media) {
        throw createAdminValidationError(`${label}不存在，请重新选择。`, 'missing-site-settings-media-asset');
      }
      if (media.site_key !== null && media.site_key !== siteKey) {
        throw createAdminValidationError(`${label}必须属于当前站点或全局素材，请重新选择。`, 'cross-site-site-settings-media-asset');
      }

      payload[field] = mediaId;
    }

    return {
      ...request,
      payload,
    };
  };
}

function createSiteSettingsModel(sequelize, DataTypes) {
  return createModel(sequelize, 'AdminJsSiteSetting', {
    site_key: {
      ...createSiteKeyAttribute(DataTypes),
      primaryKey: true,
    },
    brand_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    domain: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    seo_title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    seo_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contact_email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    header_logo_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    footer_logo_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    home_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    home_banner_secondary_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    home_feature_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    about_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    products_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    solutions_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    news_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cases_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contact_banner_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contact_phone_icon_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contact_email_icon_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contact_address_icon_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: createTimestampAttribute(DataTypes),
    updated_at: createTimestampAttribute(DataTypes),
  }, {
    tableName: 'site_settings',
  });
}

function createSiteSettingsResource(sequelize, DataTypes) {
  const SiteSetting = createSiteSettingsModel(sequelize, DataTypes);
  const validateHomepageMediaOwnership = buildHomepageMediaValidationBeforeHook(sequelize);

  return {
    resource: SiteSetting,
    options: {
      label: '站点设置',
      navigation: {
        name: '平台',
        icon: 'Settings',
      },
      actions: mergeActionOptions(
        buildSiteScopedActions({ enforcePayloadSiteKey: false }),
        {
          new: { isAccessible: false, isVisible: false },
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
          edit: { before: validateHomepageMediaOwnership },
        },
      ),
      properties: {
        site_key: {
          ...buildSiteKeyProperty(),
          isTitle: true,
          isDisabled: true,
        },
        contact_address: {
          type: 'textarea',
        },
        seo_description: {
          type: 'textarea',
        },
        header_logo_media_id: buildMediaPickerProperty({ description: '站点头部 Logo。' }),
        footer_logo_media_id: buildMediaPickerProperty({ description: '站点底部 Logo。' }),
        home_banner_media_id: buildMediaPickerProperty({ description: '首页全宽图（第一张）。' }),
        home_banner_secondary_media_id: buildMediaPickerProperty({ description: '首页全宽图（第二张）。' }),
        home_feature_media_id: buildMediaPickerProperty({ description: '首页 split-grid 左侧主图。' }),
        about_banner_media_id: buildMediaPickerProperty({ description: '关于页 Banner。' }),
        products_banner_media_id: buildMediaPickerProperty({ description: '产品列表页 Banner。' }),
        solutions_banner_media_id: buildMediaPickerProperty({ description: '解决方案列表页 Banner。' }),
        news_banner_media_id: buildMediaPickerProperty({ description: '新闻列表页 Banner。' }),
        cases_banner_media_id: buildMediaPickerProperty({ description: '案例列表页 Banner。' }),
        contact_banner_media_id: buildMediaPickerProperty({ description: '联系页 Banner。' }),
        contact_phone_icon_media_id: buildMediaPickerProperty({ description: '底部联系电话图标。' }),
        contact_email_icon_media_id: buildMediaPickerProperty({ description: '底部联系邮箱图标。' }),
        contact_address_icon_media_id: buildMediaPickerProperty({ description: '底部联系地址图标。' }),
        created_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
        updated_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
      },
      listProperties: ['site_key', 'brand_name', 'domain', 'updated_at'],
      editProperties: [
        'site_key',
        'brand_name',
        'domain',
        'seo_title',
        'seo_description',
        'contact_email',
        'contact_phone',
        'contact_address',
        'header_logo_media_id',
        'footer_logo_media_id',
        'home_banner_media_id',
        'home_banner_secondary_media_id',
        'home_feature_media_id',
        'about_banner_media_id',
        'products_banner_media_id',
        'solutions_banner_media_id',
        'news_banner_media_id',
        'cases_banner_media_id',
        'contact_banner_media_id',
        'contact_phone_icon_media_id',
        'contact_email_icon_media_id',
        'contact_address_icon_media_id',
      ],
      filterProperties: ['site_key', 'brand_name', 'domain'],
      showProperties: [
        'site_key',
        'brand_name',
        'domain',
        'seo_title',
        'seo_description',
        'contact_email',
        'contact_phone',
        'contact_address',
        'header_logo_media_id',
        'footer_logo_media_id',
        'home_banner_media_id',
        'home_banner_secondary_media_id',
        'home_feature_media_id',
        'about_banner_media_id',
        'products_banner_media_id',
        'solutions_banner_media_id',
        'news_banner_media_id',
        'cases_banner_media_id',
        'contact_banner_media_id',
        'contact_phone_icon_media_id',
        'contact_email_icon_media_id',
        'contact_address_icon_media_id',
        'created_at',
        'updated_at',
      ],
    },
  };
}

module.exports = {
  createSiteSettingsResource,
};
