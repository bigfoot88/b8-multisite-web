# AdminJS 后台管理替换设计

**日期**: 2026-03-31  
**状态**: 已批准  
**范围**: 用 AdminJS 替换现有不稳定的自定义后台路由

---

## 问题陈述

现有后台管理系统（`src/routes/admin-*.js` + `src/views/admin/`）存在以下问题：

- 无 CSRF 保护
- 管理员表单无 HTML 消毒（XSS 风险）
- 错误处理不一致（部分路由缺少 try-catch）
- 无审计日志
- UI 不稳定，体验欠佳

---

## 方案

采用 **AdminJS**（前身 AdminBro）替换全部 `/admin` 路由。AdminJS 是 Node.js 生态中最成熟的后台管理框架（GitHub 8k+ Stars），所有前端资源通过 webpack 本地打包，运行时零外部 CDN 依赖，适合中国大陆使用。

---

## 架构

```
现有 Express App (src/server.js)
├── 公开路由 (src/routes/public.js 等)     ← 不变
├── 媒体路由 (src/routes/media.js)          ← 不变
├── better-sqlite3 repositories            ← 不变（供公开路由使用）
└── /admin/*  → AdminJS (新增)
    ├── 认证: admins 表 + bcryptjs
    ├── 内容: Sequelize 映射 9 张现有表
    ├── 文件上传: 本地磁盘 uploads/
    └── 前端资源: webpack 本地打包
```

**关键原则**：

- `better-sqlite3`（公开路由）与 `Sequelize + sqlite3`（AdminJS）并存，互不干扰
- 现有 `content.db` / `app.db` 直接使用，无需数据迁移
- 删除所有旧 `src/routes/admin-*.js` 和 `src/views/admin/`

---

## 内容资源（9 张表）

| Resource     | 表名              | 关键字段                         | 说明               |
|--------------|-------------------|----------------------------------|--------------------|
| 站点设置     | site_settings     | site_key, brand_name, domain     | 只允许编辑，不可新建 |
| 媒体库       | media_assets      | filename, mime_type, alt_text    | 图片预览 + 上传    |
| 页面         | pages             | title, body_html, publish_state  | 富文本编辑器       |
| 产品         | products          | title, body_html, brochure_media_id | 富文本 + 媒体关联 |
| 解决方案     | solutions         | title, body_html                 | 富文本             |
| 新闻         | news_articles     | title, body_html, hero_media_id  | 富文本 + 封面图    |
| 案例         | case_studies      | title, body_html                 | 富文本             |
| 导航菜单     | navigation_items  | label, href, parent_id           | 层级结构           |
| 首页板块     | site_sections     | section_key, heading, config_json | JSON 配置         |

---

## 多站点方案

- AdminJS session 中存储当前 `site_key`（dma / bigfoot）
- 每个 Resource 的 `listProperties` 和创建操作通过 `before` hook 注入 `WHERE site_key = ?`
- 顶部导航栏提供站点切换链接（`/admin?site=dma`、`/admin?site=bigfoot`）

---

## 认证

- 使用 `@adminjs/express` 的 `buildAuthenticatedRouter`
- `authenticate(email, password)` 函数查询 `admins` 表，`bcryptjs.compare` 验证密码
- Session 存储：`express-session` + `connect-sqlite3`（本地文件，无需 Redis）
- 路由保护：所有 `/admin/*` 请求需通过 AdminJS 内置认证中间件

---

## 文件上传

- 使用 `@adminjs/upload` 本地磁盘 provider
- 上传目录沿用 `uploads/` 现有结构（`{site_key}/images/`、`{site_key}/docs/`）
- 上传后写入 `media_assets` 表，`asset_key` 字段与现有 `/media/:assetKey` 公开路由兼容

---

## 富文本编辑器

- AdminJS 内置 **Quill**（纯本地，无外部 CDN）
- `body_html` 等 HTML 字段标注为 `type: 'richtext'`

---

## 新增依赖

```json
{
  "adminjs": "^7.x",
  "@adminjs/express": "^6.x",
  "@adminjs/sequelize": "^4.x",
  "@adminjs/upload": "^4.x",
  "sequelize": "^6.x",
  "sqlite3": "^5.x",
  "express-session": "^1.x",
  "connect-sqlite3": "^0.x"
}
```

---

## 删除内容

- `src/routes/admin-auth.js`
- `src/routes/admin-dashboard.js`
- `src/routes/admin-sites.js`
- `src/routes/admin-sections.js`
- `src/routes/admin-navigation.js`
- `src/routes/admin-pages.js`
- `src/routes/admin-catalog.js`
- `src/routes/admin-news.js`
- `src/routes/admin-cases.js`
- `src/routes/admin-media.js`
- `src/routes/admin-shared.js`
- `src/views/admin/`（全部）
- `src/lib/session.js`（旧 session 工具）

---

## 测试策略

1. 单元测试：验证 AdminJS 路由 `/admin/login` 返回 200
2. 端到端：登录 → 创建新闻 → 确认写入 DB → 公开页面展示正确
3. 回归：现有 107 条测试全部通过（公开路由不受影响）

---

## 成功标准

- [ ] `/admin` 由 AdminJS 提供，登录可用
- [ ] 9 个内容类型均可增删改查
- [ ] 多站点切换正常（dma / bigfoot）
- [ ] 文件上传后公开媒体路由可访问
- [ ] 现有 107 条测试全部通过
- [ ] 前端资源全部本地加载，无外部 CDN
