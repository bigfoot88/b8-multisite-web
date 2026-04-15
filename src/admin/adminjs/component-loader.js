const path = require('node:path');

const ADMIN_JS_MEDIA_PICKER_EDIT_COMPONENT_ID = 'AdminMediaPickerEdit';
const ADMIN_JS_RICH_TEXT_EDIT_COMPONENT_ID = 'AdminRichTextEdit';
const ADMIN_JS_LOGGED_IN_COMPONENT_ID = 'LoggedIn';
const ADMIN_JS_SIDEBAR_COMPONENT_ID = 'Sidebar';
const ADMIN_JS_TOP_BAR_COMPONENT_ID = 'TopBar';

function buildComponentLoader(ComponentLoader) {
  const componentLoader = new ComponentLoader();

  componentLoader.add(
    ADMIN_JS_MEDIA_PICKER_EDIT_COMPONENT_ID,
    path.join(__dirname, 'components', 'media-picker-edit'),
  );
  componentLoader.add(
    ADMIN_JS_RICH_TEXT_EDIT_COMPONENT_ID,
    path.join(__dirname, 'components', 'rich-text-edit'),
  );
  componentLoader.override(
    ADMIN_JS_LOGGED_IN_COMPONENT_ID,
    path.join(__dirname, 'components', 'logged-in-with-site-switcher'),
  );
  componentLoader.override(
    ADMIN_JS_SIDEBAR_COMPONENT_ID,
    path.join(__dirname, 'components', 'sidebar-with-collapse'),
  );
  componentLoader.override(
    ADMIN_JS_TOP_BAR_COMPONENT_ID,
    path.join(__dirname, 'components', 'top-bar-with-sidebar-toggle'),
  );

  return componentLoader;
}

module.exports = {
  ADMIN_JS_LOGGED_IN_COMPONENT_ID,
  ADMIN_JS_MEDIA_PICKER_EDIT_COMPONENT_ID,
  ADMIN_JS_RICH_TEXT_EDIT_COMPONENT_ID,
  ADMIN_JS_SIDEBAR_COMPONENT_ID,
  ADMIN_JS_TOP_BAR_COMPONENT_ID,
  buildComponentLoader,
};
