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

采用 **AdminJS**（前身 AdminBro）替换全部 `/admin` 路由。AdminJS 是 Node.js 生态中最成熟的后台管理框架（GitHub 8k+ Stars），所有前端资源通过 webpack 本地打包，运行时零外部 CDN 依赖，适合中国大陆使用。实施阶段允许先挂载到临时路径（如 `/admin-next`）做并行验证，最后再切换到正式 `/admin`。

---

## 架构

```
现有 Express App (src/server.js)
├── 公开路由 (src/routes/public.js 等)     ← 不变
├── 媒体路由 (src/routes/media.js)          ← 不变
├── better-sqlite3 repositories            ← 不变（供公开路由使用）
└── /admin/*  → AdminJS (最终切换)
    ├── 认证: admins 表 + bcryptjs
    ├── 内容: Sequelize 映射 9 张现有表
    ├── 文件上传: 本地磁盘 uploads/
    └── 前端资源: webpack 本地打包
```

**关键原则**：

- `better-sqlite3`（公开路由）与 `Sequelize + sqlite3`（AdminJS）并存，互不干扰
- 现有 `content.db` / `app.db` 直接使用，无需数据迁移
- 实施期间可暂挂 `/admin-next/*` 做并行验证，最终再删除所有旧 `src/routes/admin-*.js` 和 `src/views/admin/`

---

## 数据库映射

本项目使用两个 SQLite 文件，需配置两个独立的 Sequelize 连接：

| 文件 | 表 |
|------|----|
| `app.db` | `admins` |
| `content.db` | `site_settings`, `media_assets`, `pages`, `products`, `solutions`, `news_articles`, `case_studies`, `navigation_items`, `site_sections`, `redirect_rules` |

WAL 模式：两个连接均通过 `PRAGMA journal_mode=WAL` 开启 WAL，避免 `better-sqlite3`（公开路由）与 `Sequelize + sqlite3`（AdminJS）并发写入时出现 `SQLITE_BUSY` 错误。

`redirect_rules` 表：**本次实施范围外**，不在 AdminJS 中暴露该 Resource（功能极少用，维持原有重定向规则即可）。

## 内容资源（9 张表）

| Resource     | 表名              | 关键字段                         | 说明               |
|--------------|-------------------|----------------------------------|--------------------|
| 站点设置     | site_settings     | site_key, brand_name, domain     | 禁用 New/Delete 操作，只允许编辑 |
| 媒体库       | media_assets      | filename, mime_type, alt_text    | 图片预览 + 上传    |
| 页面         | pages             | title, body_html, publish_state  | 富文本编辑器       |
| 产品         | products          | title, body_html, brochure_media_id | 富文本 + 媒体关联 |
| 解决方案     | solutions         | title, body_html                 | 富文本             |
| 新闻         | news_articles     | title, body_html, hero_media_id  | 富文本 + 封面图    |
| 案例         | case_studies      | title, body_html                 | 富文本             |
| 导航菜单     | navigation_items  | label, href, parent_id           | 层级结构           |
| 首页板块     | site_sections     | section_key, heading, config_json | JSON 配置         |

**发布状态**：`publish_state` 字段支持三个值 `draft`（草稿）、`published`（已发布）、`archived`（已归档），对应数据库 CHECK 约束。AdminJS 下拉列表需枚举全部三个值。

---

## 多站点方案

- AdminJS session 中存储当前 `site_key`（`dma` 或 `bigfoot`，**首次登录默认为 `dma`**）
- 每个 Resource 通过 `before` action hook 向 Sequelize `where` 子句注入 `{ site_key: currentSite }`（`listProperties`、`new`、`show` 均适用）
- 顶部导航栏提供站点切换链接（`/admin/switch-site?site=dma`），写入 session 后重定向回列表

## 软删除

现有 schema 使用 `deleted_at IS NOT NULL` 实现软删除。AdminJS 默认执行硬删除，**必须覆盖**。所有支持软删除的 Resource（`pages`, `products`, `solutions`, `news_articles`, `case_studies`, `navigation_items`, `site_sections`）需配置自定义 delete action：

```js
actions: {
  delete: {
    handler: async (req, res, ctx) => {
      await ctx.record.update({ deleted_at: new Date().toISOString() });
      return { record: ctx.record.toJSON(ctx.currentAdmin) };
    }
  }
}
```

---

## 认证

- 使用 `@adminjs/express` 的 `buildAuthenticatedRouter`
- `authenticate(email, password)` 函数：
  1. 查询 `app.db` 中 `admins` 表，按 `username` 或 `email` 匹配
  2. 验证 `is_active = 1`（不活跃账号直接拒绝）
  3. 用 `bcryptjs.compare(password, row.password_hash)` 验证密码（字段名为 `password_hash`）
  4. 成功则返回 `{ email, username }` 用于 session；失败返回 `null`
- Session 存储：`express-session` + `connect-sqlite3`，存储文件为独立的 `sessions.db`（不使用 `app.db` 或 `content.db`，避免写入冲突）
- Cookie 配置：`httpOnly: true, sameSite: 'lax'`，提供基础 CSRF 防护（`sameSite: lax` 阻止跨站 POST，满足当前场景需求）
- 路由保护：所有 `/admin/*` 请求需通过 AdminJS 内置认证中间件

---

## 文件上传

- 使用 `@adminjs/upload` 本地磁盘 provider
- 上传目录沿用 `public/uploads/` 现有结构（`{site_key}/images/`、`{site_key}/docs/`）
- `storagePath` 使用绝对路径：`path.join(process.cwd(), 'public/uploads')`
- 上传后写入 `media_assets` 表，`asset_key` 字段与现有 `/media/:assetKey` 公开路由兼容

---

## 富文本编辑器

- 使用 `@adminjs/rich-text`（需单独安装）提供 Quill 编辑器，所有资源均为本地加载，无外部 CDN
- `body_html` 等 HTML 字段标注为 `type: 'richtext'`（通过 `@adminjs/rich-text` 组件渲染）

---

## 新增依赖

```json
{
  "adminjs": "^7.x",
  "@adminjs/express": "^6.x",
  "@adminjs/sequelize": "^4.x",
  "@adminjs/upload": "^4.x",
  "@adminjs/rich-text": "^4.x",
  "sequelize": "^6.x",
  "sqlite3": "^5.x",
  "express-session": "^1.x",
  "connect-sqlite3": "^0.x"
}
```

> **注意**：AdminJS 7.x 中 Quill 富文本编辑器需要单独安装 `@adminjs/rich-text`，并非内置。`body_html` 等字段必须配合此包才能渲染富文本组件。

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
