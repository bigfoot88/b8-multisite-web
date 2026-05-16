# 阿里云 ECS 部署说明

本文档面向将本项目部署到阿里云 ECS 的场景，目标是让同一套应用同时服务：

- `dma.b8water.com`
- `www.chinabigfoot.com`

## 1. 推荐部署结构

推荐使用：

- 阿里云 ECS（Ubuntu 22.04 LTS）
- Nginx 作为反向代理
- Node.js 22 LTS
- systemd 托管应用进程
- SQLite 作为内容数据库
- 共享目录保存数据库与上传文件

建议目录：

```text
/srv/b8-multisite/
├── current/                  # 当前代码目录
├── shared/
│   ├── data/
│   │   └── content.db
│   └── uploads/
└── logs/
```

## 2. 服务器初始化

安装基础依赖：

```bash
sudo apt update
sudo apt install -y nginx curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

创建部署目录：

```bash
sudo mkdir -p /srv/b8-multisite/shared/data
sudo mkdir -p /srv/b8-multisite/shared/uploads
sudo mkdir -p /srv/b8-multisite/logs
sudo chown -R $USER:$USER /srv/b8-multisite
```

## 3. 上传代码并安装依赖

```bash
cd /srv/b8-multisite
git clone <your-repository-url> current
cd current
npm ci --omit=dev
```

如果你不是通过 Git 部署，也可以直接上传当前仓库内容到 `/srv/b8-multisite/current`。

## 4. 配置运行环境

在 `/srv/b8-multisite/current/.env` 中写入：

```bash
NODE_ENV=production
PORT=3000
DATABASE_PATH=/srv/b8-multisite/shared/data/content.db
ADMIN_SESSION_SECRET=<replace-with-a-long-random-secret>
```

说明：

- `ADMIN_SESSION_SECRET` 在生产环境必填
- `DATABASE_PATH` 建议放在 `shared/data/`，避免代码更新时丢失

## 5. 持久化上传目录

应用默认从仓库内的 `public/uploads` 提供媒体文件。首次部署时，先把仓库内已经提交的种子素材复制到共享目录，再把运行目录切到共享软链接：

```bash
cd /srv/b8-multisite/current
cp -a public/uploads/. /srv/b8-multisite/shared/uploads/
rm -rf public/uploads
ln -s /srv/b8-multisite/shared/uploads public/uploads
```

这样 `scripts/import-seed-data.mjs` 在首次导入时就能找到所需的本地种子素材文件。

## 6. 初始化数据库与内容

首次部署时导入两个站点的初始内容：

```bash
cd /srv/b8-multisite/current
node scripts/import-seed-data.mjs --site dma --seed data/seeds/dma.json --database-path /srv/b8-multisite/shared/data/content.db --upload-root public/uploads --apply
node scripts/import-seed-data.mjs --site bigfoot --seed data/seeds/bigfoot.json --database-path /srv/b8-multisite/shared/data/content.db --upload-root public/uploads --apply
```

然后创建后台管理员：

```bash
cd /srv/b8-multisite/current
ADMIN_PASSWORD='<replace-with-a-strong-password>' DATABASE_PATH=/srv/b8-multisite/shared/data/content.db node scripts/seed-admin.mjs
```

## 7. 配置 systemd

创建 `/etc/systemd/system/b8-multisite.service`：

```ini
[Unit]
Description=B8 Multisite Website Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/b8-multisite/current
EnvironmentFile=/srv/b8-multisite/current/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
User=<deploy-user>
Group=<deploy-user>

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable b8-multisite
sudo systemctl start b8-multisite
sudo systemctl status b8-multisite
```

## 8. 配置 Nginx

创建 `/etc/nginx/sites-available/b8-multisite.conf`：

```nginx
server {
    listen 80;
    server_name dma.b8water.com www.chinabigfoot.com;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/b8-multisite.conf /etc/nginx/sites-enabled/b8-multisite.conf
sudo nginx -t
sudo systemctl reload nginx
```

如果正式环境需要 HTTPS，建议在 Nginx 层接入证书（如阿里云证书服务或 Let's Encrypt）。

## 9. 上线前验证

在服务器本机执行：

```bash
curl -H 'Host: dma.b8water.com' http://127.0.0.1:3000/
curl -H 'Host: www.chinabigfoot.com' http://127.0.0.1:3000/
curl -I -H 'Host: dma.b8water.com' 'http://127.0.0.1:3000/nd.jsp?id=111'
```

确认：

- 两个站点首页均返回 `200`
- 旧链接重定向生效
- `/admin/login` 可访问
- 使用初始化管理员账号可登录后台

## 10. dev 分支自动部署

以下小节仅适用于 **测试服务器** 自动部署，不影响上面的正式部署配置。

测试服务器的运行目录和端口与正式环境不同，需配置为：

- 代码目录：`/opt/b8-multisite-web`
- 应用端口：`3008`

dev 分支 push 即触发 GitHub Actions 自动部署流程：

1. CI 检查（与主分支一致的安装与测试流程）
2. 通过 SSH 连接测试服务器
3. 在 `/opt/b8-multisite-web` 执行部署脚本并重启 `b8-multisite`
4. 使用 `3008` 端口进行健康检查

所需 GitHub Secrets：

- `DEPLOY_HOST`（测试服务器 IP）
- `DEPLOY_PORT`（SSH 端口，填写 `22`）
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS`
- `DEPLOY_PATH`（`/opt/b8-multisite-web`）
- `DEPLOY_SERVICE`（`b8-multisite`）

回滚方式：

1. 在 GitHub Actions 部署记录中找到「最近一次成功部署」的 commit SHA
2. 登录服务器并回退代码，然后重启服务

```bash
cd /opt/b8-multisite-web
git fetch --all
git checkout <last-successful-sha>
npm ci --omit=dev
sudo systemctl restart b8-multisite
curl http://127.0.0.1:3008/
```

## 11. 更新发布建议

建议发布流程：

1. 备份数据库和上传目录
2. 更新代码
3. 运行 `npm ci --omit=dev`
4. 保留共享 `content.db` 与 `public/uploads` 软链接
5. 重启 systemd 服务
6. 重新执行 smoke 验证

示例：

```bash
cd /srv/b8-multisite/current
git pull
npm ci --omit=dev
sudo systemctl restart b8-multisite
```

## 12. 备份建议

最重要的持久化数据有两类：

- SQLite 数据库：`/srv/b8-multisite/shared/data/content.db`
- 上传文件：`/srv/b8-multisite/shared/uploads/`

建议至少做：

- 每日数据库备份
- 上传目录定期归档
- 发布前手动快照

## 13. 回滚建议

如果新版本异常：

1. 回退到上一个代码版本
2. 保持 `shared/data` 与 `shared/uploads` 不变
3. 重启 `b8-multisite.service`
4. 用 `curl` + `Host` 头重新验证双站点首页和后台登录
