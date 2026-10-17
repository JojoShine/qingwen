# 部署与运维

本文提供 Docker 镜像部署和源码部署两条路径。新环境需要 PostgreSQL 数据库迁移和管理员初始化；用户、问卷、答卷、会话和 Banner 图片均存储在 PostgreSQL 中。

## 一、部署前准备

- Docker 路径：Docker Engine / Docker Desktop、Docker Compose v2、Git；构建阶段需要访问 npm、Debian 镜像源及 Docker Hub。
- 源码路径：Node.js 22.12+（推荐 Node.js 22 LTS）、pnpm 10.26.0、PostgreSQL 17、Git。
- 正式对外服务：域名、HTTPS 证书与反向代理。生产会话 Cookie 标记为 Secure，使用普通 HTTP 的远程地址无法正常保持登录。
- 镜像构建需要足够内存；建议从 2 核 / 4GB 的构建环境开始，运行资源按问卷规模调整。

## 二、Docker 镜像部署

### 1. 获取项目与配置

```sh
git clone https://github.com/JojoShine/qingwen.git
cd qingwen
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

编辑 `.env.docker`：

| 变量 | 用途 |
| --- | --- |
| `POSTGRES_PASSWORD` | 必填，数据库密码；建议 `openssl rand -hex 24` 生成，仅使用字母数字以便拼接连接 URL |
| `APP_URL` | 必填，实际公开访问地址，例如 `https://survey.example.com`；用于问卷链接、二维码和来源校验，不带路径 |
| `APP_BIND` | 默认 `127.0.0.1`，宿主机监听地址；适用于同机反向代理 |
| `APP_PORT` | 默认 `3218`，宿主机应用端口 |
| `ADMIN_USERNAME` | 初始管理员账号，默认 `admin` |
| `ADMIN_PASSWORD` | 管理员初始化所需密码，至少 8 位；无默认密码 |
| `ADMIN_NAME` | 初始管理员显示名称，默认“管理员” |
| `TRUSTED_CLIENT_IP_HEADER` | 默认空；需要 IP 次数限制时按下文配置可信代理 |
| `QINGWEN_IMAGE` | 应用镜像名，默认 `qingwen:local` |
| `QINGWEN_MIGRATION_IMAGE` | 迁移工具镜像名，默认 `qingwen-migrate:local` |

Compose 自动组装容器内的 `DATABASE_URL`，不使用开发 `.env` 中指向 localhost 的数据库地址。若更换数据库密码，请同步修改数据库角色密码；修改环境变量不会重置已经初始化的数据卷。

### 2. 构建和启动

```sh
docker compose --env-file .env.docker -f compose.prod.yaml up -d --build
docker compose --env-file .env.docker -f compose.prod.yaml run --rm --no-deps migrate pnpm db:seed
docker compose --env-file .env.docker -f compose.prod.yaml ps -a
```

启动顺序为 PostgreSQL 健康 → `migrate` 执行全部待应用迁移 → 应用启动。`migrate` 显示 `Exited (0)` 是正常结果；`app` 应显示 healthy。迁移失败时应用不会启动，请先检查日志。管理员初始化命令可重复执行，已有同名账号的密码不会被覆盖。

默认本机访问 <http://localhost:3218>；正式访问使用 HTTPS 域名。本机验证可以保留 `APP_URL=http://localhost:3218`，现代浏览器对 localhost 的 Secure Cookie 有特殊处理；不要把这个地址作为其他设备扫码的地址。

```sh
docker compose --env-file .env.docker -f compose.prod.yaml logs --tail=100 app migrate
curl -I http://127.0.0.1:3218/login
```

### 3. 镜像结构与独立构建

`Dockerfile` 有两个交付目标：

- `runner`：Next.js standalone 应用和静态文件，以非 root 用户运行；包含页面健康检查，不携带管理员密码或迁移 CLI。
- `migrator`：Prisma、迁移文件和管理员初始化工具；以非 root 用户运行，默认执行 `pnpm db:migrate`。

```sh
docker build --target runner -t qingwen:1.0.0 .
docker build --target migrator -t qingwen-migrate:1.0.0 .
```

密码在运行时通过配置传入，不作为构建参数；`.dockerignore` 排除 `.env`、本地依赖、截图、数据库备份与 Git 历史。镜像不包含演示答卷。

项目没有预发布的公共镜像。如需在构建机和服务器间传递镜像，可使用自己的镜像仓库，或离线导出：

```sh
# 构建机
docker save qingwen:1.0.0 qingwen-migrate:1.0.0 -o qingwen-images.tar

# 将压缩包、compose.prod.yaml 和 .env.docker.example 传到服务器后：
docker load -i qingwen-images.tar
```

在服务器创建 `.env.docker` 并设置 `QINGWEN_IMAGE=qingwen:1.0.0`、`QINGWEN_MIGRATION_IMAGE=qingwen-migrate:1.0.0`，然后执行启动命令，使用 `up -d --no-build` 替代 `up -d --build`。仍需获取 `postgres:17-alpine`，完全离线环境也需提前导出该镜像。

### 4. HTTPS 反向代理

默认应用端口仅绑定宿主机 loopback，适合同机 Nginx。以下示例放入已有 HTTPS 虚拟主机，证书与 `server_name` 按实际域名配置：

```nginx
server {
    listen 443 ssl;
    server_name survey.example.com;
    ssl_certificate /etc/letsencrypt/live/survey.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/survey.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3218;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_buffering off;
    }
}

server {
    listen 80;
    server_name survey.example.com;
    return 301 https://$host$request_uri;
}
```

设置 `APP_URL=https://survey.example.com` 后重建应用容器：

```sh
docker compose --env-file .env.docker -f compose.prod.yaml up -d app
```

若反向代理也在容器中，须让它与应用处于同一 Docker 网络，通过 `app:3000` 访问；代理容器内的 `127.0.0.1` 不指向宿主机应用。不要为了代理连通而直接向公网开放应用和数据库端口。

需要 IP 次数限制时，设置 `TRUSTED_CLIENT_IP_HEADER=x-real-ip`，确保代理始终覆盖该头且无法绕过代理直连应用。默认留空时系统不允许开启 IP 限制；单值头不能填写逗号分隔的转发链。多层代理需先正确还原可信客户端 IP，再向应用传递一个值。

## 三、源码部署

### 1. 准备数据库

使用已有 PostgreSQL 17，或在数据库服务器安装 PostgreSQL。以数据库管理员身份创建专用账号和库：

```sh
sudo -u postgres createuser --pwprompt survey
sudo -u postgres createdb --owner=survey survey
```

为账号设置强密码，数据库网络只向应用开放。托管 PostgreSQL 请使用服务商提供的连接地址和 TLS 参数。

### 2. 安装依赖与初始化

```sh
git clone https://github.com/JojoShine/qingwen.git
cd qingwen
corepack enable
corepack prepare pnpm@10.26.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
```

编辑 `.env`：

```dotenv
DATABASE_URL="postgresql://survey:替换为数据库密码@127.0.0.1:5432/survey?schema=public"
APP_URL="https://survey.example.com"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="替换为至少8位的管理员密码"
ADMIN_NAME="管理员"
TRUSTED_CLIENT_IP_HEADER=""
```

密码包含 `@`、`:`、`/`、`#` 等特殊字符时，需对 `DATABASE_URL` 的密码部分做 URL 编码；管理员密码本身不做编码。

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm start
```

`pnpm start` 监听 `0.0.0.0:3218`。正式部署建议由进程管理器启动并绑定 loopback，例如：

```sh
pnpm exec next start --hostname 127.0.0.1 --port 3218
```

源码部署默认使用常规 Next.js 构建，不需要 standalone 静态文件复制步骤。`BUILD_STANDALONE=1` 仅由 Docker 构建设置。不要在同一目录同时运行开发服务器和生产构建。

### 3. systemd 示例（Linux）

假设项目位于 `/opt/qingwen`，Node.js 可执行文件在 `/usr/bin/node`。创建无登录权限的服务用户并授予项目目录访问权：

```sh
sudo useradd --system --home /opt/qingwen --shell /usr/sbin/nologin qingwen
sudo chown -R qingwen:qingwen /opt/qingwen
```

保存 `/etc/systemd/system/qingwen.service`，按实际安装路径调整 Node.js 和项目位置：

```ini
[Unit]
Description=Qingwen Survey
After=network.target

[Service]
Type=simple
User=qingwen
WorkingDirectory=/opt/qingwen
Environment=NODE_ENV=production
EnvironmentFile=/opt/qingwen/.env
ExecStart=/usr/bin/node /opt/qingwen/node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3218
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now qingwen
sudo systemctl status qingwen
journalctl -u qingwen -n 100 --no-pager
```

随后按前文配置 HTTPS 代理。更新依赖与构建时使用有权写入项目目录的部署账号，避免不同用户创建的文件导致权限错误。

## 四、升级与回退

升级前备份数据库和实际环境配置，记录当前 Git 提交及镜像版本。不要修改已经应用的历史迁移。

Docker 部署：

```sh
git pull --ff-only
docker compose --env-file .env.docker -f compose.prod.yaml build
docker compose --env-file .env.docker -f compose.prod.yaml stop app
docker compose --env-file .env.docker -f compose.prod.yaml run --rm migrate
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build
```

源码部署：

```sh
sudo systemctl stop qingwen
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm build
sudo systemctl start qingwen
```

迁移失败时停止升级，先排查数据库连接、权限和迁移日志；不要用 `prisma migrate reset` 修复生产库。代码回退不等于数据库回退：旧应用若不兼容新结构，需要恢复与旧版本匹配的数据库备份。

## 五、备份与恢复

### Docker 数据库备份

```sh
mkdir -p backups
docker compose --env-file .env.docker -f compose.prod.yaml exec -T db pg_dump -U survey -d survey -Fc > backups/qingwen.dump
```

将备份与 `.env.docker` 分开安全保存到其他设备或备份存储；备份包含用户、答卷、Banner 和会话等业务数据。轮换备份时使用不同文件名，避免覆盖唯一副本。

恢复会替换目标库中的同名表与数据，应先备份当前目标库并核对环境：

```sh
docker compose --env-file .env.docker -f compose.prod.yaml stop app
docker compose --env-file .env.docker -f compose.prod.yaml exec -T db pg_restore -U survey -d survey --clean --if-exists --no-owner < backups/qingwen.dump
docker compose --env-file .env.docker -f compose.prod.yaml run --rm migrate
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build
```

源码部署同样可使用 PostgreSQL 自带的 `pg_dump -Fc` 与 `pg_restore`，通过 `PGHOST`、`PGPORT`、`PGUSER`、`PGDATABASE` 和交互密码或受限权限的 `.pgpass` 配置连接，避免在命令历史中放明文密码。

停止 Docker 服务使用 `docker compose --env-file .env.docker -f compose.prod.yaml down`，命名卷会保留。不要使用 `down -v`，除非明确要永久删除该部署的数据。固定项目目录或使用一致的 `-p` 项目名，避免启动到另一个全新数据卷。

## 六、常见问题

| 现象 | 检查方向 |
| --- | --- |
| 构建拉取失败 | 检查 Docker Hub、Debian 和 npm 网络，代理/镜像源是否可用；构建机需要访问这些来源 |
| pnpm 锁文件不兼容 | 使用 `packageManager` 指定的 pnpm 10.26.0，不删除锁文件绕过 |
| `migrate` 失败 | 查看 `logs migrate`，核对数据库连接、密码和权限 |
| 修改密码变量后连库失败 | PostgreSQL 环境变量仅用于首次建库；已有卷中的密码需通过 SQL 修改 |
| 登录后又回登录页 | 核对 HTTPS、Secure Cookie、代理 Host 和 `APP_URL` |
| 二维码在手机无法打开 | `APP_URL` 使用手机可访问的域名，不能填写 localhost 或 Docker 内部服务名 |
| IP 次数开关不可用 | 配置并验证可信单值 IP 头，禁止客户端绕过代理 |
| 更新后看不到旧数据 | 检查 Compose 项目名、数据卷及 `DATABASE_URL` 是否仍指向原库 |
| 忘记管理员密码 | 已有其他管理员可在用户管理中重置；`db:seed` 不会覆盖已有密码 |

## 参考

- [Docker Compose 启动依赖](https://docs.docker.com/compose/how-tos/startup-order/)
- [Next.js standalone 输出](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Prisma 7 生产迁移](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/deploy-migrations-from-a-local-environment)
