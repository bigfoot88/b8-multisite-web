const { sites } = require('../../../config/sites');
const {
  ADMIN_JS_MEDIA_PICKER_EDIT_COMPONENT_ID,
  ADMIN_JS_RICH_TEXT_EDIT_COMPONENT_ID,
} = require('../component-loader');
const { buildSiteScopedActions } = require('../site-context');

const publishStates = ['draft', 'published', 'archived'];
const FOCUSED_FORM_CONTAINER_WIDTH = [1, 1, 1, 1, 'calc(100vw - 128px)'];

function createTimestampAttribute(DataTypes, { allowNull = false } = {}) {
  return {
    type: DataTypes.DATE,
    allowNull,
    defaultValue: allowNull ? null : DataTypes.NOW,
  };
}

function createSiteKeyAttribute(DataTypes, { allowNull = false } = {}) {
  return {
    type: DataTypes.STRING,
    allowNull,
    validate: allowNull ? undefined : {
      isIn: [sites],
    },
  };
}

function createPublishStateAttribute(DataTypes) {
  return {
    type: DataTypes.ENUM(...publishStates),
    allowNull: false,
    defaultValue: 'draft',
    validate: {
      isIn: [publishStates],
    },
  };
}

function createModel(sequelize, modelName, definition, options = {}) {
  if (sequelize.models[modelName]) {
    return sequelize.models[modelName];
  }

  return sequelize.define(modelName, definition, {
    tableName: options.tableName,
    timestamps: false,
    hooks: options.hooks,
  });
}

function applyContentHooks(record) {
  const publishState = record.get('publish_state');

  if (publishState === 'published' && !record.get('published_at')) {
    record.set('published_at', new Date());
  }

  if (publishState !== 'published') {
    record.set('published_at', null);
  }

  record.set('updated_at', new Date());
}

function resolveResourceId(resource) {
  if (typeof resource?.id === 'function') {
    return resource.id();
  }

  if (typeof resource?._decorated?.id === 'function') {
    return resource._decorated.id();
  }

  return resource?._decorated?.id || resource?.options?.id || resource?.tableName || 'unknown';
}

function buildSoftDeleteActions() {
  async function performSoftDelete(records = []) {
    await Promise.all(records.map((record) => record.update({
      deleted_at: new Date(),
      updated_at: new Date(),
    })));
  }

  return {
    delete: {
      guard: 'confirmDelete',
      handler: async (request, _response, context) => {
        const { record, currentAdmin, h, resource } = context;

        if (!record) {
          return {
            notice: {
              message: 'Record not found',
              type: 'error',
            },
          };
        }

        if ((request.method || 'get').toLowerCase() !== 'post') {
          return {
            record: record.toJSON(currentAdmin),
          };
        }

        await performSoftDelete([record]);

        return {
          record: record.toJSON(currentAdmin),
          notice: {
            message: 'Successfully deleted given record',
            type: 'success',
          },
          redirectUrl: h.resourceUrl({ resourceId: resolveResourceId(resource) }),
        };
      },
    },
    bulkDelete: {
      handler: async (request, _response, context) => {
        const { records = [], currentAdmin, h, resource } = context;

        if ((request.method || 'get').toLowerCase() !== 'post') {
          return {
            records: records.map((record) => record.toJSON(currentAdmin)),
          };
        }

        await performSoftDelete(records);

        return {
          records: records.map((record) => record.toJSON(currentAdmin)),
          notice: {
            message: 'Successfully deleted selected records',
            type: 'success',
          },
          redirectUrl: h.resourceUrl({ resourceId: resolveResourceId(resource) }),
        };
      },
    },
  };
}

function mergeActionOptions(...actionGroups) {
  return actionGroups.reduce((mergedActions, actionGroup) => {
    Object.entries(actionGroup || {}).forEach(([actionName, actionOptions]) => {
      mergedActions[actionName] = {
        ...(mergedActions[actionName] || {}),
        ...actionOptions,
      };
    });

    return mergedActions;
  }, {});
}

function buildSiteKeyProperty({ allowBlank = false } = {}) {
  const availableValues = sites.map((value) => ({ value, label: value }));

  return allowBlank
    ? {
      availableValues: [{ value: '', label: 'global' }, ...availableValues],
    }
    : {
      availableValues,
    };
}

function buildRichTextProperty() {
  return {
    type: 'richtext',
    components: {
      edit: ADMIN_JS_RICH_TEXT_EDIT_COMPONENT_ID,
    },
    custom: {
      uploadEndpoint: '/admin-next/api/media/inline-upload',
      tinymceScriptSrc: '/admin-next/frontend/assets/tinymce/tinymce.min.js',
      tinymceLanguageUrl: '/admin-next/frontend/assets/tinymce/langs/zh_CN.js',
    },
  };
}

function buildMediaPickerProperty({ description = '仅显示当前站点及全局素材。' } = {}) {
  return {
    components: {
      edit: ADMIN_JS_MEDIA_PICKER_EDIT_COMPONENT_ID,
    },
    custom: {
      mediaPickerEndpoint: '/admin-next/api/media/options',
    },
    description,
  };
}

function buildPublishStateProperty() {
  return {
    label: '发布状态',
    description: '草稿前台不可见，发布后才公开显示。',
    availableValues: [
      { value: 'draft', label: '草稿（前台不可见）' },
      { value: 'published', label: '已发布（前台可见）' },
      { value: 'archived', label: '已归档' },
    ],
  };
}

function buildVisibilityToggleProperty() {
  return {
    label: '首页显示',
    description: '关闭后首页区块不在前台显示。',
  };
}

function buildContentResourceOptions({
  label,
  listProperties,
  editProperties,
  filterProperties,
  showProperties,
  propertyOverrides = {},
}) {
  return {
    navigation: {
      name: '内容',
      icon: 'Document',
    },
    ...(label ? { label } : {}),
    ...(label ? { translations: { 'zh-CN': { name: label } } } : {}),
    actions: mergeActionOptions(
      buildSiteScopedActions(),
      {
        new: { containerWidth: FOCUSED_FORM_CONTAINER_WIDTH },
        edit: { containerWidth: FOCUSED_FORM_CONTAINER_WIDTH },
      },
      buildSoftDeleteActions(),
    ),
    properties: {
      id: {
        isVisible: { edit: false, filter: true, list: true, show: true },
        label: 'ID',
      },
      site_key: {
        ...buildSiteKeyProperty(),
        isVisible: { edit: false, filter: false, list: true, show: true },
        label: '站点',
      },
      publish_state: buildPublishStateProperty(),
      deleted_at: {
        isVisible: false,
      },
      created_at: {
        isVisible: { edit: false, filter: true, list: true, show: true },
        label: '创建时间',
      },
      updated_at: {
        isVisible: { edit: false, filter: true, list: true, show: true },
        label: '更新时间',
      },
      title: { label: '标题' },
      slug: { label: '别名' },
      summary: { label: '摘要' },
      body_html: { label: '正文' },
      filename: { label: '文件名' },
      asset_key: { label: '素材键' },
      mime_type: { label: '文件类型' },
      ...propertyOverrides,
    },
    listProperties,
    editProperties: editProperties.filter((property) => property !== 'site_key'),
    filterProperties: filterProperties.filter((property) => property !== 'site_key'),
    showProperties,
  };
}

module.exports = {
  applyContentHooks,
  buildContentResourceOptions,
  buildMediaPickerProperty,
  buildRichTextProperty,
  buildPublishStateProperty,
  buildVisibilityToggleProperty,
  buildSiteKeyProperty,
  createModel,
  createPublishStateAttribute,
  createSiteKeyAttribute,
  createTimestampAttribute,
  mergeActionOptions,
  publishStates,
  sites,
};
