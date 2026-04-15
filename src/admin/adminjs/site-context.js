const { sites } = require('../../config/sites');

const DEFAULT_ADMINJS_SITE_KEY = sites[0];

function normalizeSiteKey(siteKey) {
  return sites.includes(siteKey) ? siteKey : DEFAULT_ADMINJS_SITE_KEY;
}

function getCurrentAdminSiteKey(currentAdmin) {
  return normalizeSiteKey(currentAdmin?.siteKey);
}

function getRecordSiteKey(record, property = 'site_key') {
  const value = record?.params?.[property];

  if (typeof value === 'string') {
    return value.trim();
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function recordMatchesCurrentSite(record, currentAdmin, { property = 'site_key', allowBlank = false } = {}) {
  const recordSiteKey = getRecordSiteKey(record, property);

  if (allowBlank && !recordSiteKey) {
    return true;
  }

  return recordSiteKey === getCurrentAdminSiteKey(currentAdmin);
}

function applySiteScopeToListRequest(request, currentAdmin, { property = 'site_key' } = {}) {
  return {
    ...request,
    query: {
      ...(request.query || {}),
      [`filters.${property}`]: getCurrentAdminSiteKey(currentAdmin),
    },
  };
}

function applyCurrentSiteToPayload(request, currentAdmin, { property = 'site_key' } = {}) {
  if ((request.method || 'get').toLowerCase() !== 'post') {
    return request;
  }

  return {
    ...request,
    payload: {
      ...(request.payload || {}),
      [property]: getCurrentAdminSiteKey(currentAdmin),
    },
  };
}

function buildSiteScopedActions({
  property = 'site_key',
  allowBlank = false,
  enforcePayloadSiteKey = true,
  scopeList = true,
} = {}) {
  const isAccessible = ({ record, currentAdmin }) => (
    recordMatchesCurrentSite(record, currentAdmin, { property, allowBlank })
  );
  const actions = {};

  if (scopeList) {
    actions.list = {
      before: async (request, context) => applySiteScopeToListRequest(request, context.currentAdmin, { property }),
    };
  }

  if (enforcePayloadSiteKey) {
    const before = async (request, context) => applyCurrentSiteToPayload(request, context.currentAdmin, { property });

    actions.new = { before };
    actions.edit = { isAccessible, before };
  } else {
    actions.edit = { isAccessible };
  }

  actions.show = { isAccessible };
  actions.delete = { isAccessible };
  actions.bulkDelete = { isAccessible };

  return actions;
}

module.exports = {
  DEFAULT_ADMINJS_SITE_KEY,
  buildSiteScopedActions,
  getCurrentAdminSiteKey,
  normalizeSiteKey,
  recordMatchesCurrentSite,
};
