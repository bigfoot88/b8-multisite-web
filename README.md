# B8 Multisite Website Platform

一个从零重建的多站点内容平台，用同一套 Node.js / Express / SQLite 应用同时承载以下两个品牌官网：

- `http://dma.b8water.com/`
- `https://www.chinabigfoot.com/`

平台内置统一的中文后台，支持管理员对站点设置、首页模块、导航、页面、产品、解决方案、新闻、案例和媒体素材进行增删改查，适合后续部署到阿里云 ECS。

## 技术栈

- Node.js 22.9+
- Express
- EJS
- SQLite (`better-sqlite3`)
- Multer
- `node:test` + `supertest`

## 当前能力

- 一套代码同时服务 `dma` 与 `bigfoot` 两个站点
- 按域名自动切换公开站点内容与主题
- 中文后台登录与内容管理
- 本地媒体文件管理与受控公开访问
- 旧链接重定向规则映射
- 基于种子数据的一键导入与端到端 smoke 验证

## 目录说明

- `src/`：应用主代码
- `public/`：静态资源与本地上传目录
- `data/seeds/`：两个站点的种子内容
- `scripts/import-seed-data.mjs`：导入站点内容与本地素材
- `scripts/seed-admin.mjs`：创建管理员账号
- `tests/end-to-end-smoke.test.js`：双站点 + 后台登录烟雾测试
- `docs/deployment/alicloud.md`：阿里云 ECS 部署说明

## 本机启动

1. 安装依赖：

```bash
npm install
```

建议本机使用 Node.js `22.9+`（当前部署文档按 Node.js 22 LTS 编写）。

2. 准备环境变量：

```bash
cp .env.example .env
```

`npm start` 与 `npm run dev` 会自动读取项目根目录下的 `.env`。

至少要确认：

- `PORT`
- `DATABASE_PATH`
- `ADMIN_SESSION_SECRET`

3. 导入两个站点的初始内容：

```bash
node scripts/import-seed-data.mjs --site dma --seed data/seeds/dma.json --database-path data/content.db --upload-root public/uploads --apply
node scripts/import-seed-data.mjs --site bigfoot --seed data/seeds/bigfoot.json --database-path data/content.db --upload-root public/uploads --apply
```

4. 创建后台管理员：

```bash
ADMIN_PASSWORD='ChangeMe123!' DATABASE_PATH=data/content.db node scripts/seed-admin.mjs
```

5. 启动服务：

```bash
npm start
```

默认监听 `http://127.0.0.1:3000`。

## 本地验证两个站点

应用按 `Host` 头识别站点。命令行验证可直接使用：

```bash
curl -H 'Host: dma.b8water.com' http://127.0.0.1:3000/
curl -H 'Host: www.chinabigfoot.com' http://127.0.0.1:3000/
```

如果需要在浏览器中本地查看，可临时把目标域名指向本机，再访问：

- `dma.b8water.com`
- `www.chinabigfoot.com`

## 后台入口

- 登录地址：`/admin/login`
- 默认示例账号：`admin`
- 密码由 `scripts/seed-admin.mjs` 运行时通过 `ADMIN_PASSWORD` 指定

登录后可进入：

- `/admin`：总览页
- `/admin/dma`：DMA 站点后台
- `/admin/bigfoot`：Bigfoot 站点后台
- `/admin/media`：媒体库

## 测试

运行全部测试：

```bash
npm test
```

只跑最终烟雾测试：

```bash
node --test tests/end-to-end-smoke.test.js
```

该 smoke test 会：

- 导入两个站点的真实种子数据
- 验证 DMA / Bigfoot 的首页、列表页、详情页、联系页
- 验证后台登录、总览页和站点控制台

## 常用维护命令

重新导入 DMA：

```bash
node scripts/import-seed-data.mjs --site dma --seed data/seeds/dma.json --database-path data/content.db --upload-root public/uploads --apply
```

重新导入 Bigfoot：

```bash
node scripts/import-seed-data.mjs --site bigfoot --seed data/seeds/bigfoot.json --database-path data/content.db --upload-root public/uploads --apply
```

下载/校验远端素材（如后续补充迁移用）：

```bash
node scripts/download-assets.mjs --site dma --seed data/seeds/dma.json --upload-root public/uploads
```

## 生产部署建议

推荐部署到阿里云 ECS（Ubuntu + Nginx + systemd），并配合：

- 独立的 `DATABASE_PATH`
- 持久化的 `public/uploads`
- 反向代理绑定两个正式域名

完整步骤见 `docs/deployment/alicloud.md`。
