const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const path = require('node:path');
const { createRequire } = require('node:module');

const { ADMINJS_COOKIE_NAME, buildAdminJsAuth, createAdminJsSessionRevalidationMiddleware } = require('./auth');
const { buildComponentLoader } = require('./component-loader');
const { createAdminJsDatabases } = require('./databases');
const { buildResources } = require('./resources/build-resources');
const { createAdminValidationError, isExpectedAdminError } = require('../../lib/admin-errors');
const {
  ensureUploadRoot,
  isAllowedUploadFilename,
  removeUploadedFile,
  sanitizeFilename,
  toInlineUploadPath,
  validateUploadedContent,
} = require('../../lib/uploads');
const { getCurrentAdminSiteKey, normalizeSiteKey } = require('./site-context');

const ADMINJS_ROOT_PATH = '/admin-next';
const ADMINJS_LOGIN_PATH = `${ADMINJS_ROOT_PATH}/login`;
const ADMINJS_LOGOUT_PATH = `${ADMINJS_ROOT_PATH}/logout`;
const ADMINJS_REFRESH_TOKEN_PATH = `${ADMINJS_ROOT_PATH}/refresh-token`;
const ADMINJS_COMPANY_NAME = 'B8 网站管理后台';
const ADMIN_JS_TMP_DIR = process.env.ADMIN_JS_TMP_DIR || path.join(process.cwd(), '.adminjs');
const ADMINJS_CORE_BUNDLE_ENV = process.env.ADMINJS_CORE_BUNDLE_ENV === 'development' ? 'development' : 'production';

let adapterRegistered = false;
const requireFromHere = createRequire(__filename);

function loadAdminJsLocale(language) {
  const adminJsPackageRoot = path.dirname(requireFromHere.resolve('adminjs'));
  const localeFilePath = path.join(adminJsPackageRoot, 'lib', 'locale', language, 'translation.json');

  return JSON.parse(fs.readFileSync(localeFilePath, 'utf8'));
}

function getAdminJsCoreAssetMappings() {
  const adminJsPackageRoot = path.dirname(requireFromHere.resolve('adminjs'));
  const designSystemEntry = requireFromHere.resolve('@adminjs/design-system');
  const designSystemRoot = path.dirname(path.dirname(designSystemEntry));
  const assetRoot = path.join(adminJsPackageRoot, 'lib', 'frontend', 'assets');

  return [
    {
      requestPath: '/frontend/assets/app.bundle.js',
      filePath: path.join(assetRoot, 'scripts', `app-bundle.${ADMINJS_CORE_BUNDLE_ENV}.js`),
    },
    {
      requestPath: '/frontend/assets/global.bundle.js',
      filePath: path.join(assetRoot, 'scripts', `global-bundle.${ADMINJS_CORE_BUNDLE_ENV}.js`),
    },
    {
      requestPath: '/frontend/assets/design-system.bundle.js',
      filePath: path.join(designSystemRoot, `bundle.${ADMINJS_CORE_BUNDLE_ENV}.js`),
    },
    { requestPath: '/frontend/assets/icomoon.css', filePath: path.join(assetRoot, 'styles', 'icomoon.css') },
    { requestPath: '/frontend/assets/icomoon.eot', filePath: path.join(assetRoot, 'fonts', 'icomoon.eot') },
    { requestPath: '/frontend/assets/icomoon.svg', filePath: path.join(assetRoot, 'fonts', 'icomoon.svg') },
    { requestPath: '/frontend/assets/icomoon.ttf', filePath: path.join(assetRoot, 'fonts', 'icomoon.ttf') },
    { requestPath: '/frontend/assets/icomoon.woff', filePath: path.join(assetRoot, 'fonts', 'icomoon.woff') },
    { requestPath: '/frontend/assets/tinymce/langs/zh_CN.js', filePath: path.join(__dirname, 'assets', 'tinymce', 'langs', 'zh_CN.js') },
    { requestPath: '/frontend/assets/logo.svg', filePath: path.join(assetRoot, 'images', 'logo.svg') },
    { requestPath: '/frontend/assets/logo-mini.svg', filePath: path.join(assetRoot, 'images', 'logo-mini.svg') },
  ];
}

function registerAdminJsCoreAssets(router, extraTranslations) {
  const tinymceRoot = path.dirname(requireFromHere.resolve('tinymce/tinymce.min.js'));
  const tinymceScriptPath = requireFromHere.resolve('tinymce/tinymce.min.js');

  getAdminJsCoreAssetMappings().forEach(({ requestPath, filePath }) => {
    // Inject a small runtime merger into the global.bundle.js so that resource-level
    // translations (zh-CN) are merged into window.REDUX_STATE before AdminJS bootstraps.
    if (requestPath === '/frontend/assets/global.bundle.js' && extraTranslations) {
      router.get(requestPath, (_req, res) => {
        try {
          const injection = `(function(){try{if(window && window.REDUX_STATE && window.REDUX_STATE.locale && window.REDUX_STATE.locale.translations){window.REDUX_STATE.locale.translations['zh-CN']=Object.assign({}, window.REDUX_STATE.locale.translations['zh-CN']||{}, ${JSON.stringify({ resources: extraTranslations || {} })});}}catch(e){console.error('adminjs-i18n merge failed', e);} })();\n`;
          const content = injection + fs.readFileSync(filePath, 'utf8');
          res.type('application/javascript').send(content);
        } catch (e) {
          // Fallback to serving file directly if injection fails
          res.sendFile(path.basename(filePath), {
            root: path.dirname(filePath),
            dotfiles: 'allow',
          });
        }
      });
      return;
    }

    router.get(requestPath, (_req, res) => {
      res.sendFile(path.basename(filePath), {
        root: path.dirname(filePath),
        dotfiles: 'allow',
      });
    });
  });

  router.get('/frontend/assets/tinymce/tinymce.min.js', (_req, res) => {
    res.sendFile(path.basename(tinymceScriptPath), {
      root: path.dirname(tinymceScriptPath),
      dotfiles: 'allow',
    });
  });

  for (const tinymceDir of ['icons', 'models', 'plugins', 'skins', 'themes']) {
    const tinymceDirPath = path.join(tinymceRoot, tinymceDir);

    if (!fs.existsSync(tinymceDirPath)) {
      continue;
    }

    router.use(`/frontend/assets/tinymce/${tinymceDir}`, express.static(tinymceDirPath, {
      dotfiles: 'allow',
      fallthrough: false,
    }));
  }

  router.use('/frontend/assets/tinymce', (_req, res) => {
    res.sendStatus(404);
  });
}

function isSafeAdminRedirectUrl(redirectUrl) {
  return typeof redirectUrl === 'string'
    && (redirectUrl === ADMINJS_ROOT_PATH || redirectUrl.startsWith(`${ADMINJS_ROOT_PATH}/`));
}

function registerSiteSwitchRoute(router) {
  router.post('/switch-site', (req, res, next) => {
    if (!req.session?.adminUser) {
      return res.redirect(ADMINJS_LOGIN_PATH);
    }

    const siteKey = normalizeSiteKey(req.fields?.siteKey || req.query?.siteKey);
    const redirectUrl = isSafeAdminRedirectUrl(req.fields?.redirectTo)
      ? req.fields.redirectTo
      : ADMINJS_ROOT_PATH;

    req.session.adminUser = {
      ...req.session.adminUser,
      siteKey,
    };

    return req.session.save((error) => {
      if (error) {
        return next(error);
      }

      if ((req.get('accept') || '').includes('application/json')) {
        return res.json({ redirectUrl, siteKey });
      }

      return res.redirect(redirectUrl);
    });
  });
}

function normalizeInlineUploadFile(uploadRoot, file) {
  const originalFilename = file?.originalFilename || file?.name || file?.originalname || '';

  if (!originalFilename || !isAllowedUploadFilename(originalFilename)) {
    throw createAdminValidationError('不支持上传的文件类型，请上传图片或文档。', 'unsafe-upload-type');
  }

  const validatedFile = validateUploadedContent({
    path: file?.filepath || file?.path,
    originalname: originalFilename,
    mimetype: file?.mimetype || file?.type || 'application/octet-stream',
    size: file?.size || 0,
  });

  ensureUploadRoot(uploadRoot);
  const storagePath = path.join(
    uploadRoot,
    `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(originalFilename)}`,
  );

  fs.renameSync(validatedFile.path, storagePath);

  return {
    destination: uploadRoot,
    mimetype: validatedFile.mimetype,
    originalname: originalFilename,
    path: storagePath,
    size: validatedFile.size,
  };
}

function registerInlineUploadRoute(router, { mediaRepository, uploadRoot }) {
  router.post('/api/media/inline-upload', (req, res) => {
    const rawFile = Array.isArray(req.files?.file) ? req.files.file[0] : req.files?.file;
    if (!rawFile) {
      return res.status(400).json({ error: '请先选择要上传的图片。' });
    }

    let uploadedFile = null;

    try {
      uploadedFile = normalizeInlineUploadFile(uploadRoot, rawFile);

      const asset = mediaRepository.createAsset({
        assetKey: crypto.randomUUID(),
        siteKey: getCurrentAdminSiteKey(req.session?.adminUser),
        sourceUrl: toInlineUploadPath(uploadedFile),
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        storagePath: uploadedFile.path,
        altText: path.basename(uploadedFile.originalname, path.extname(uploadedFile.originalname)) || null,
        metadata: {
          size: uploadedFile.size,
        },
      });

      return res.status(201).json({
        assetKey: asset.assetKey,
        altText: asset.altText,
        filename: asset.filename,
        url: asset.sourceUrl,
      });
    } catch (error) {
      removeUploadedFile(uploadedFile?.path || rawFile?.filepath || rawFile?.path);

      if (isExpectedAdminError(error)) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      throw error;
    }
  });
}

function serializeMediaPickerAsset(asset) {
  if (!asset) {
    return null;
  }

  return {
    id: asset.id,
    siteKey: asset.siteKey,
    filename: asset.filename,
    mimeType: asset.mimeType,
    altText: asset.altText,
    publicUrl: asset.publicUrl || asset.sourceUrl || null,
    sourceUrl: asset.sourceUrl || null,
  };
}

function registerMediaPickerRoute(router, { mediaRepository }) {
  router.get('/api/media/options', (req, res) => {
    const siteKey = getCurrentAdminSiteKey(req.session?.adminUser);
    const selectedId = Number.parseInt(req.query?.selectedId, 10);
    const includeAssets = String(req.query?.includeAssets || '1') !== '0';
    const assets = includeAssets
      ? mediaRepository.listAssets({ siteKey }).map(serializeMediaPickerAsset)
      : [];
    const selectedAsset = Number.isInteger(selectedId) && selectedId > 0
      ? mediaRepository.findById(selectedId)
      : null;

    return res.json({
      assets,
      selectedAsset: selectedAsset && (selectedAsset.siteKey === null || selectedAsset.siteKey === siteKey)
        ? serializeMediaPickerAsset(selectedAsset)
        : null,
    });
  });
}

function clearAdminJsComponentBundleCache(componentLoader) {
  const components = componentLoader?.getComponents?.() || {};

  if (!Object.keys(components).length) {
    return;
  }

  for (const fileName of ['entry.js', 'bundle.js']) {
    fs.rmSync(path.join(ADMIN_JS_TMP_DIR, fileName), { force: true });
  }
}

async function loadAdminJsModules() {
  const [adminJsModule, adminJsExpressModule, adminJsSequelizeModule] = await Promise.all([
    import('adminjs'),
    import('@adminjs/express'),
    import('@adminjs/sequelize'),
  ]);

  const AdminJS = adminJsModule.default || adminJsModule;
  const AdminJSExpress = adminJsExpressModule.default || adminJsExpressModule;
  const AdminJSSequelize = adminJsSequelizeModule.default || adminJsSequelizeModule;
  const ComponentLoader = adminJsModule.ComponentLoader;

  if (!adapterRegistered) {
    AdminJS.registerAdapter({
      Database: AdminJSSequelize.Database,
      Resource: AdminJSSequelize.Resource,
    });
    adapterRegistered = true;
  }

  return {
    AdminJS,
    AdminJSExpress,
    ComponentLoader,
  };
}

function isAdminJsPath(pathname) {
  return pathname === ADMINJS_ROOT_PATH || pathname.startsWith(`${ADMINJS_ROOT_PATH}/`);
}

async function buildAdminJsRouter({
  adminRepository,
  databasePath,
  mediaRepository,
  sessionSecret,
  uploadRoot,
} = {}) {
  const [{ AdminJS, AdminJSExpress, ComponentLoader }, { DataTypes }, { close, databases, sequelize, sessionDatabasePath, sessionStore }] = await Promise.all([
    loadAdminJsModules(),
    import('sequelize'),
    createAdminJsDatabases({ databasePath }),
  ]);
  const { authentication, sessionOptions } = buildAdminJsAuth({
    adminRepository,
    sessionSecret,
  });
  sessionOptions.store = sessionStore;
  const componentLoader = buildComponentLoader(ComponentLoader);
  const resources = buildResources(sequelize, DataTypes);

  // Merge resource-level labels and property labels into the AdminJS zh-CN translations so list headers and column labels display correctly
  const mergedLocale = loadAdminJsLocale('zh-CN') || {};
  mergedLocale.resources = mergedLocale.resources || {};
  // labels.{resourceId} is what AdminJS translateLabel() uses for sidebar/breadcrumb display
  mergedLocale.labels = mergedLocale.labels || {};

  for (const resDef of resources) {
    const tableName = resDef?.resource?.tableName || (resDef?.resource && resDef.resource.getTableName && resDef.resource.getTableName()) || undefined;
    const resourceKey = (resDef.options && resDef.options.id) || tableName || (resDef.resource && (resDef.resource.name || resDef.resource.tableName));

    if (!resourceKey) continue;

    mergedLocale.resources[resourceKey] = mergedLocale.resources[resourceKey] || {};

    if (resDef.options && resDef.options.label) {
      mergedLocale.resources[resourceKey].name = resDef.options.label;
      // Also set labels.{id} so translateLabel() (sidebar/breadcrumb) resolves the Chinese name
      mergedLocale.labels[resourceKey] = resDef.options.label;
    }

    if (resDef.options && resDef.options.properties) {
      mergedLocale.resources[resourceKey].properties = mergedLocale.resources[resourceKey].properties || {};

      for (const [propName, propOptions] of Object.entries(resDef.options.properties)) {
        if (propOptions && propOptions.label) {
          mergedLocale.resources[resourceKey].properties[propName] = propOptions.label;
        }
      }
    }
  }

  const admin = new AdminJS({
    rootPath: ADMINJS_ROOT_PATH,
    loginPath: ADMINJS_LOGIN_PATH,
    logoutPath: ADMINJS_LOGOUT_PATH,
    refreshTokenPath: ADMINJS_REFRESH_TOKEN_PATH,
    databases,
    resources,
    componentLoader,
    branding: {
      companyName: ADMINJS_COMPANY_NAME,
      withMadeWithLove: false,
    },
    locale: {
      language: 'zh-CN',
      translations: {
        'zh-CN': mergedLocale,
      },
      availableLanguages: ['zh-CN'],
      partialBundledLanguages: false,
      withBackend: false,
    },
  });

  // Ensure merged resource-level translations are present on the AdminJS instance
  // Some AdminJS internals may normalize or rehydrate locale/translations; set them explicitly here.
  admin.options = admin.options || {};
  admin.options.locale = admin.options.locale || {};
  admin.options.locale.translations = admin.options.locale.translations || {};
  admin.options.locale.translations['zh-CN'] = mergedLocale;

  // Map resource option labels directly onto the AdminJS instance by decorated resource id.
  // This avoids relying on precomputed mergedLocale keys and ensures the frontend can find
  // resource-level translations (list headers, column labels) under the decorated ids it uses.
  try {
    const zh = admin.options.locale.translations['zh-CN'] || {};
    zh.resources = zh.resources || {};

    for (const decorated of admin.resources || []) {
      let decoratedId;
      try {
        if (typeof decorated._decorated?.id === 'function') {
          decoratedId = decorated._decorated.id();
        } else if (typeof decorated.id === 'function') {
          decoratedId = decorated.id();
        } else {
          decoratedId = decorated.id || decorated.name || (decorated.resource && (decorated.resource.tableName || decorated.resource.name));
        }
      } catch (e) {
        decoratedId = decorated.id || decorated.name || (decorated.resource && (decorated.resource.tableName || decorated.resource.name));
      }

      const opts = decorated.options || {};
      const labelName = opts.label;
      const props = opts.properties || {};

      console.log('[adminjs-i18n] mapping resource', { decoratedId, labelName, propCount: Object.keys(props || {}).length });

      if (labelName) {
        zh.resources[decoratedId] = zh.resources[decoratedId] || {};
        zh.resources[decoratedId].name = labelName;
      }

      if (props && Object.keys(props).length) {
        zh.resources[decoratedId] = zh.resources[decoratedId] || {};
        zh.resources[decoratedId].properties = zh.resources[decoratedId].properties || {};
        for (const [pname, popts] of Object.entries(props)) {
          if (popts && popts.label) {
            zh.resources[decoratedId].properties[pname] = popts.label;
          }
        }
        console.log('[adminjs-i18n] mapped', Object.keys(props).length, 'properties for', decoratedId);
      }
    }

    admin.options.locale.translations['zh-CN'] = zh;
  } catch (err) {
    console.error('Failed to map resource translations to decorated ids', err);
  }

  clearAdminJsComponentBundleCache(componentLoader);

  const predefinedRouter = express.Router();
  registerAdminJsCoreAssets(predefinedRouter, mergedLocale.resources || {});
  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    authentication,
    predefinedRouter,
    sessionOptions,
  );
  registerSiteSwitchRoute(router);
  registerInlineUploadRoute(router, { mediaRepository, uploadRoot });
  registerMediaPickerRoute(router, { mediaRepository });

  // Debug endpoint: expose resource decorated ids and the zh-CN translations currently attached.
  // Temporary: used to verify that resource-level translations are keyed by the same ids the frontend expects.
  router.get('/api/i18n-debug', (req, res) => {
    try {
      const zh = admin.options?.locale?.translations?.['zh-CN'] || {};
      const resources = (admin.resources || []).map((r) => {
        let id;
        try {
          if (typeof r._decorated?.id === 'function') id = r._decorated.id();
          else if (typeof r.id === 'function') id = r.id();
          else id = r.id || r.name || (r.resource && (r.resource.tableName || r.resource.name));
        } catch (e) {
          id = r.id || r.name || (r.resource && (r.resource.tableName || r.resource.name));
        }

        return {
          decoratedId: id,
          options: r.options || {},
          resourceName: r.resource && (r.resource.name || r.resource.tableName),
        };
      });

      return res.json({ zh, resources });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  });

  const protectedRoutesLayerIndex = router.stack.findIndex(
    (layer) => layer?.handle?.name === 'authorizedRoutesMiddleware',
  );

  if (protectedRoutesLayerIndex >= 0) {
    const middlewareRouter = express.Router();
    middlewareRouter.use(createAdminJsSessionRevalidationMiddleware({ adminRepository }));
    router.stack.splice(protectedRoutesLayerIndex, 0, middlewareRouter.stack[0]);
  }

  return {
    close,
    router,
    sessionDatabasePath,
  };
}

function createAdminJsRouter(options = {}) {
  const router = express.Router();
  let adminRouterPromise;
  let sessionDatabasePath = null;
  const lifecycle = {
    async close() {
      if (!adminRouterPromise) {
        return;
      }

      const adminJs = await adminRouterPromise;
      await adminJs.close?.();
    },
  };

  Object.defineProperty(lifecycle, 'sessionDatabasePath', {
    enumerable: true,
    get() {
      return sessionDatabasePath;
    },
  });

  router.use((req, res, next) => {
    if (!adminRouterPromise) {
      adminRouterPromise = buildAdminJsRouter(options)
        .then((adminJs) => {
          sessionDatabasePath = adminJs.sessionDatabasePath;
          return adminJs;
        });
    }

    adminRouterPromise
      .then((adminJs) => adminJs.router(req, res, next))
      .catch(next);
  });

  router.adminJs = lifecycle;

  return router;
}

module.exports = {
  ADMINJS_COOKIE_NAME,
  ADMINJS_LOGIN_PATH,
  ADMINJS_LOGOUT_PATH,
  ADMINJS_REFRESH_TOKEN_PATH,
  ADMINJS_ROOT_PATH,
  createAdminJsRouter,
  isAdminJsPath,
};
