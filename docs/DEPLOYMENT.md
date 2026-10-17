# 部署与运维

本文提供 Docker 镜像部署和源码部署两条路径。当前 `tbtparent.me` 服务器使用 `/opt/qingwen` 下的镜像部署，复用本机原生 PostgreSQL 14.24 中已有的 `qingwen` 数据库；不启动生产数据库容器。新环境需要 PostgreSQL 数据库迁移和管理员初始化；用户、问卷、答卷、会话和 Banner 图片均存储在 PostgreSQL 中。

## 一、部署前准备

- Docker 路径：Docker Engine / Docker Desktop、Docker Compose v2、curl；服务器需要访问 GitHub 配置文件、GHCR 和 Docker Hub，无需 Git、Node.js、pnpm 或源码构建环境。当前发布镜像支持 Linux amd64。
- 源码路径：Node.js 22.12+（推荐 Node.js 22 LTS）、pnpm 10.26.0、PostgreSQL 17、Git。
- 正式对外服务：域名、HTTPS 证书与反向代理。生产会话 Cookie 标记为 Secure，使用普通 HTTP 的远程地址无法正常保持登录。
- 应用运行资源按问卷规模调整；镜像由 GitHub Actions 构建，生产服务器只拉取和运行镜像。

GHCR 应用与迁移镜像应设置为公开可见，生产服务器可匿名拉取，无需保存 GitHub token。首次发布后，维护者需在 GitHub Packages 中确认两个包的可见性为 Public。

## 二、Docker 镜像部署

### 1. 已有 PostgreSQL：当前服务器使用此方案

使用 [compose.external-db.yaml](../compose.external-db.yaml) 和 [.env.external-db.example](../.env.external-db.example)，仅运行应用及迁移容器。数据库继续由宿主机的 PostgreSQL 服务管理，库名为 `qingwen`，端口为 `5432`。

```sh
sudo mkdir -p /opt/qingwen
sudo chown "$(id -u):$(id -g)" /opt/qingwen
cd /opt/qingwen
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/compose.external-db.yaml -o compose.external-db.yaml
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/.env.external-db.example -o .env.external-db
chmod 600 .env.external-db
```

编辑 `.env.external-db`，填写运行时必需的 `DATABASE_URL` 和初始管理员配置。数据库凭据只保存在服务器受限权限的环境文件中，不写入仓库或镜像：

```dotenv
# 将占位内容替换为应用专用角色与密码；密码中的特殊字符需要 URL 编码。
DATABASE_URL=postgresql://qingwen_app:替换为数据库密码@host.docker.internal:5432/qingwen?schema=public
QINGWEN_IMAGE=ghcr.io/jojoshine/qingwen:latest-surveys
QINGWEN_MIGRATION_IMAGE=ghcr.io/jojoshine/qingwen-migrate:latest
APP_URL=
APP_BIND=127.0.0.1
APP_PORT=3218
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为至少8位的管理员密码
ADMIN_NAME=管理员
TRUSTED_CLIENT_IP_HEADER=
```

`extra_hosts: host.docker.internal:host-gateway` 让容器使用该主机名访问宿主机，容器内的 `127.0.0.1` 指向容器本身。PostgreSQL 必须监听容器可达的宿主机地址；防火墙及 `pg_hba.conf` 仅允许实际应用 Docker 子网、`qingwen` 数据库和应用专用角色连接。先创建 Compose 网络、查看实际网段，再配置 PostgreSQL：

```sh
docker compose --env-file .env.external-db -f compose.external-db.yaml create
# /opt/qingwen 默认项目名为 qingwen；若自定义 -p，调整网络名。
docker network inspect qingwen_default --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

按实际检查结果在 `pg_hba.conf` 中添加精确规则，例如 `host qingwen qingwen_app <实际应用Docker子网> scram-sha-256`，将占位符替换为上一步网段；不要放开所有数据库、角色或 `0.0.0.0/0`。通过现有 PostgreSQL 管理流程创建应用专用角色，授予该库与业务 schema 的必要权限；迁移角色还需具备建表、修改表等 DDL 权限。首次迁移包含 `CREATE SCHEMA IF NOT EXISTS public`，还需要数据库级 `CREATE` 权限；仅授予 schema 内建表权限会导致 PostgreSQL 拒绝首次迁移。由数据库管理员执行（角色需先创建）：

```sql
GRANT CONNECT, CREATE ON DATABASE qingwen TO qingwen_app;
-- 以下语句连接 qingwen 数据库后执行。
GRANT USAGE, CREATE ON SCHEMA public TO qingwen_app;
```

已有表若属于其他角色，还需核对对象所有权及迁移权限，不能仅授予连接权限。修改监听地址可能需要重启数据库，修改访问规则后重新加载配置。

**首次执行迁移前，先备份现有数据库并保存环境配置。** 在宿主机执行：

```sh
mkdir -p backups
chmod 700 backups
sudo -u postgres pg_dump -d qingwen -Fc > backups/qingwen-before-migrate.dump
chmod 600 backups/qingwen-before-migrate.dump
```

确认备份成功、数据库连接和权限可用后，再启动：

```sh
docker compose --env-file .env.external-db -f compose.external-db.yaml pull
docker compose --env-file .env.external-db -f compose.external-db.yaml up -d --no-build
docker compose --env-file .env.external-db -f compose.external-db.yaml run --rm --no-deps migrate pnpm db:seed
docker compose --env-file .env.external-db -f compose.external-db.yaml ps -a
docker compose --env-file .env.external-db -f compose.external-db.yaml logs --tail=100 app migrate
curl -I http://127.0.0.1:3218/surveys/login
```

迁移成功后应用才会启动；`migrate` 显示 `Exited (0)` 是正常结果。`db:seed` 仅初始化管理员，已有同名账号的密码不会被覆盖。使用下文 Nginx 配置后，通过 `https://tbtparent.me/surveys` 登录。此方案的所有后续 Compose 命令均使用 `--env-file .env.external-db -f compose.external-db.yaml`；不要同时运行下面的新建数据库方案。

### 2. 可选：新安装时使用 PostgreSQL 容器

仅在没有现成 PostgreSQL 的新环境使用此方案；它会新建 PostgreSQL 17 容器及数据卷。当前服务器已有 `qingwen` 库，使用上一节。部署目录固定为 `/opt/qingwen`，只下载 Compose 和环境变量模板：

```sh
sudo mkdir -p /opt/qingwen
sudo chown "$(id -u):$(id -g)" /opt/qingwen
cd /opt/qingwen
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/compose.prod.yaml -o compose.prod.yaml
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/.env.docker.example -o .env.docker
chmod 600 .env.docker
```

编辑 `.env.docker`：

| 变量 | 用途 |
| --- | --- |
| `POSTGRES_PASSWORD` | 必填，数据库密码；建议 `openssl rand -hex 24` 生成，仅使用字母数字以便拼接连接 URL |
| `APP_URL` | 可选，默认留空；分享链接和二维码自动使用当前浏览器的协议、域名/IP 和端口。需要固定时填写 origin，例如 `https://tbtparent.me`，不带路径；构建路径前缀自动附加 |
| `APP_BIND` | 默认 `127.0.0.1`，宿主机监听地址；适用于同机反向代理 |
| `APP_PORT` | 默认 `3218`，宿主机应用端口 |
| `ADMIN_USERNAME` | 初始管理员账号，默认 `admin` |
| `ADMIN_PASSWORD` | 管理员初始化所需密码，至少 8 位；无默认密码 |
| `ADMIN_NAME` | 初始管理员显示名称，默认“管理员” |
| `TRUSTED_CLIENT_IP_HEADER` | 默认空；需要 IP 次数限制时按下文配置可信代理 |
| `QINGWEN_IMAGE` | 根路径默认 `ghcr.io/jojoshine/qingwen:latest`；部署 `/surveys` 时用 `ghcr.io/jojoshine/qingwen:latest-surveys` |
| `QINGWEN_MIGRATION_IMAGE` | 默认 `ghcr.io/jojoshine/qingwen-migrate:latest`，与应用使用同一提交版本 |

Compose 自动组装容器内的 `DATABASE_URL`，不使用开发 `.env` 中指向 localhost 的数据库地址。若更换数据库密码，请同步修改数据库角色密码；修改环境变量不会重置已经初始化的数据卷。

部署到 `https://tbtparent.me/surveys` 时设置：

```dotenv
QINGWEN_IMAGE=ghcr.io/jojoshine/qingwen:latest-surveys
QINGWEN_MIGRATION_IMAGE=ghcr.io/jojoshine/qingwen-migrate:latest
APP_URL=
APP_BIND=127.0.0.1
APP_PORT=3218
```

`NEXT_PUBLIC_BASE_PATH=/surveys` 在构建时写入该镜像，页面、静态资源、接口和分享地址使用同一前缀。给已编译的根路径镜像设置运行时 `NEXT_PUBLIC_BASE_PATH` 不会改变路径；必须选择对应的 `-surveys` 镜像。

### 3. 容器数据库方案的拉取与启动

```sh
docker compose --env-file .env.docker -f compose.prod.yaml pull
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build
docker compose --env-file .env.docker -f compose.prod.yaml run --rm --no-deps migrate pnpm db:seed
docker compose --env-file .env.docker -f compose.prod.yaml ps -a
```

启动顺序为 PostgreSQL 健康 → `migrate` 执行全部待应用迁移 → 应用启动。`migrate` 显示 `Exited (0)` 是正常结果；`app` 应显示 healthy。迁移失败时应用不会启动，请先检查日志。管理员初始化命令可重复执行，已有同名账号的密码不会被覆盖。

根路径镜像本机访问 <http://localhost:3218>；`-surveys` 镜像本机访问 <http://localhost:3218/surveys>。正式服务使用 HTTPS 域名，`APP_URL` 留空即可自动获取访问地址；localhost 链接无法从另一台设备扫码访问。

```sh
docker compose --env-file .env.docker -f compose.prod.yaml logs --tail=100 app migrate
# /surveys 镜像；根路径镜像改为 /login。
curl -I http://127.0.0.1:3218/surveys/login
```

### 4. 发布流程与镜像版本

[CI and GHCR 工作流](../.github/workflows/ci.yml) 在单元测试、接口集成测试、类型检查、生产构建和浏览器测试通过后构建并发布 GHCR 镜像。PR 执行检查，推送到 `main` 或手动触发工作流后发布镜像；服务器只执行 `pull` 和 `up -d --no-build`。应用与迁移工具分别交付：

- 应用：Next.js standalone 与静态文件，以非 root 用户运行，包含健康检查，不携带管理员密码或迁移 CLI。
- 迁移工具：Prisma、迁移文件和管理员初始化工具，以非 root 用户运行，默认执行 `pnpm db:migrate`。

| 用途 | 应用镜像标签 | 迁移镜像标签 |
| --- | --- | --- |
| 根路径，跟随主分支 | `ghcr.io/jojoshine/qingwen:latest` | `ghcr.io/jojoshine/qingwen-migrate:latest` |
| `/surveys`，跟随主分支 | `ghcr.io/jojoshine/qingwen:latest-surveys` | `ghcr.io/jojoshine/qingwen-migrate:latest` |
| 根路径，固定提交 | `ghcr.io/jojoshine/qingwen:sha-<完整提交哈希>` | `ghcr.io/jojoshine/qingwen-migrate:sha-<完整提交哈希>` |
| `/surveys`，固定提交 | `ghcr.io/jojoshine/qingwen:sha-<完整提交哈希>-surveys` | `ghcr.io/jojoshine/qingwen-migrate:sha-<完整提交哈希>` |

生产推荐固定同一提交的不可变标签，记录升级前后的两个镜像引用；不要混用不同提交的应用与迁移工具。密码仅在运行时传入，镜像不包含演示答卷。

如需修改源码并自行构建，可在开发机或专用构建机执行以下可选流程；标准服务器部署不执行这些命令：

```sh
# 在源码目录执行；省略 --build-arg 则构建根路径应用。
docker build --target runner --build-arg NEXT_PUBLIC_BASE_PATH=/surveys -t qingwen:custom-surveys .
docker build --target migrator -t qingwen-migrate:custom .
```

将自定义镜像发布到自己的仓库并设置 `QINGWEN_IMAGE` 与 `QINGWEN_MIGRATION_IMAGE` 后，仍使用拉取部署流程。`.dockerignore` 排除 `.env`、本地依赖、截图、数据库备份与 Git 历史。

### 5. HTTPS 反向代理

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

通过 `https://survey.example.com` 访问后台后，分享链接会自动使用该域名，无需设置 `APP_URL`。代理需按上例保留 Host 并覆盖 `X-Forwarded-Proto`，使 HTTPS 请求来源校验正常。

只有后台访问地址与分享域名不同时，才需要设置 `APP_URL=https://survey.example.com` 固定分享地址；环境配置变更后重建应用容器：

```sh
docker compose --env-file .env.external-db -f compose.external-db.yaml up -d --no-build app
```

#### 已有域名下的 `/surveys`

`https://tbtparent.me/surveys` 与已有业务共用域名和证书。使用 `-surveys` 应用镜像，将仓库中的 [Nginx 示例](../deploy/nginx/qingwen.conf.example) 保存为独立配置 `/etc/nginx/business/tbtparent-me/qingwen.conf`，在现有 HTTPS `server` 内加载，不新增同域名的 `server` 块。

现有主配置包含 `/etc/nginx/business/tbtparent.me/*.conf`（点号目录）。为保留该入口，并将实际配置放在要求的连字符目录中，建立单个文件的符号链接：

```sh
sudo mkdir -p /etc/nginx/business/tbtparent-me /etc/nginx/business/tbtparent.me
sudo curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/deploy/nginx/qingwen.conf.example -o /etc/nginx/business/tbtparent-me/qingwen.conf
sudo ln -s /etc/nginx/business/tbtparent-me/qingwen.conf /etc/nginx/business/tbtparent.me/qingwen.conf
sudo nginx -t
# 仅在配置检查成功后重新加载。
sudo systemctl reload nginx
```

已有该链接时无需重复创建；若同名文件已存在，先核对内容，不覆盖现有业务配置。确保上述通配符入口位于该域名的 HTTPS `server` 内，且该配置只加载一次。

示例使用 `location = /surveys` 和 `location ^~ /surveys/`，均代理到 `http://127.0.0.1:3218`，`proxy_pass` 后不加 `/`，保留原始 `/surveys` URI。`^~` 避免静态资源被现有正则 location 截获；其他业务路径继续由原配置处理。

配置完成后通过 `https://tbtparent.me/surveys` 登录，检查页面、静态资源、接口、分享链接与匿名填写。`APP_URL` 默认留空；如确需固定，可填 `https://tbtparent.me`，应用会自动附加 `/surveys`。

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
# 留空自动跟随浏览器；需要固定分享域名时再填写。
APP_URL=""
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

源码部署默认使用常规 Next.js 构建，不需要 standalone 静态文件复制步骤。`BUILD_STANDALONE=1` 仅由 Docker 构建设置。若源码部署也需要 `/surveys`，在 `pnpm build` 前设置 `NEXT_PUBLIC_BASE_PATH=/surveys`；更改路径后需重新构建。不要在同一目录同时运行开发服务器和生产构建。

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

### 访问地址规则

默认分享地址取自当前浏览器地址栏，保留协议、主机和端口，不会使用 Docker 内部的 `app:3000` 等地址。`APP_URL` 仅作为固定分享 origin 的可选覆盖，不带路径；构建路径前缀由应用自动附加。

已有部署若此前填写过 `APP_URL`，升级不会自动清除该值；需要自动获取时请清空或删除变量，然后重建应用容器或重启源码服务。后台从 localhost 打开时，生成的链接也会使用 localhost；手机扫码前应从可访问的域名或局域网 IP 打开后台。

## 四、升级与回退

升级前备份数据库和实际环境配置，记录当前镜像标签或摘要；源码部署记录 Git 提交。不要修改已经应用的历史迁移。

已有数据库的 Docker 部署（当前服务器）：

```sh
cd /opt/qingwen
# 在 .env.external-db 中将应用和迁移镜像改为目标提交的配套标签。
docker compose --env-file .env.external-db -f compose.external-db.yaml pull
docker compose --env-file .env.external-db -f compose.external-db.yaml stop app
docker compose --env-file .env.external-db -f compose.external-db.yaml run --rm migrate
docker compose --env-file .env.external-db -f compose.external-db.yaml up -d --no-build
```

使用容器数据库方案时，上述命令改为 `--env-file .env.docker -f compose.prod.yaml`。若部署配置本身有更新，先从目标提交下载对应 Compose 文件并审核差异；不要覆盖已有环境配置。回退应用时将镜像引用改回已记录的版本，重新拉取并启动，同时核对数据库兼容性。

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

### 已有宿主机数据库：当前服务器

在宿主机使用 PostgreSQL 工具备份 `qingwen`，备份目录设为仅部署账号可访问；使用不同文件名保留多个版本：

```sh
mkdir -p backups
chmod 700 backups
sudo -u postgres pg_dump -d qingwen -Fc > backups/qingwen.dump
chmod 600 backups/qingwen.dump
```

将备份及 `.env.external-db` 分开保存在其他设备或备份存储。恢复前先核对目标并备份当前库；以下操作会替换同名表和数据：

```sh
docker compose --env-file .env.external-db -f compose.external-db.yaml stop app
sudo -u postgres pg_restore -d qingwen --clean --if-exists < backups/qingwen.dump
docker compose --env-file .env.external-db -f compose.external-db.yaml run --rm migrate
docker compose --env-file .env.external-db -f compose.external-db.yaml up -d --no-build
```

恢复保留备份中的对象所有权，目标服务器需存在对应角色。应用专用角色的权限与对象所有权应与恢复后的结构匹配。停止应用容器不会停止宿主机数据库。

### 可选容器数据库方案的备份

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
| 镜像拉取失败 | 检查 GHCR、Docker Hub 网络、标签是否已发布，以及两个 GHCR 包是否公开；确认服务器为 amd64 |
| `/surveys` 下资源 404 | 确认选择 `-surveys` 镜像，代理保留 URI，且 `^~ /surveys/` 未被其他配置覆盖 |
| 自行构建失败 | 仅开发构建需要访问 Docker Hub、Debian 和 npm，检查构建机网络与内存 |
| pnpm 锁文件不兼容 | 使用 `packageManager` 指定的 pnpm 10.26.0，不删除锁文件绕过 |
| `migrate` 失败 | 查看 `logs migrate`，核对数据库连接、密码、schema 权限与对象所有权；已有宿主机数据库同时检查监听地址和实际 Docker 子网的 `pg_hba.conf` 规则 |
| 修改密码变量后连库失败 | PostgreSQL 环境变量仅用于首次建库；已有卷中的密码需通过 SQL 修改 |
| 登录后又回登录页 | 核对 HTTPS、Secure Cookie，以及代理是否正确传递 Host 和 `X-Forwarded-Proto` |
| 二维码在手机无法打开 | 通过手机可访问的域名或局域网 IP 打开后台后重新分享；如果设置了 `APP_URL`，检查覆盖地址是否正确 |
| IP 次数开关不可用 | 配置并验证可信单值 IP 头，禁止客户端绕过代理 |
| 更新后看不到旧数据 | 检查 Compose 项目名、数据卷及 `DATABASE_URL` 是否仍指向原库 |
| 忘记管理员密码 | 已有其他管理员可在用户管理中重置；`db:seed` 不会覆盖已有密码 |

## 参考

- [Docker Compose 启动依赖](https://docs.docker.com/compose/how-tos/startup-order/)
- [Next.js standalone 输出](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Prisma 7 生产迁移](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/deploy-migrations-from-a-local-environment)
