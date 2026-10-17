# 部署与运维

标准交付为 Docker Hub 上的单镜像 `docker.io/jojoshine/qingwen`，内部包含轻问应用、PostgreSQL 17、迁移和管理员初始化工具。一个容器即可运行，不依赖宿主机或另一个容器提供数据库；Compose 仅用于管理该容器、端口和持久化卷。

用户、问卷、答卷、会话和 Banner 图片保存在 PostgreSQL 数据卷中。镜像包含数据库程序，不包含用户数据或预设账号密码。源码开发仍可连接独立的本地 PostgreSQL，与标准镜像部署分开。

## 一、Docker Hub 镜像部署

### 1. 准备环境

需要 Docker Engine / Docker Desktop、Docker Compose v2 和 curl。部署机器需能访问 GitHub 配置文件及 Docker Hub，无需安装 Git、Node.js、pnpm 或 PostgreSQL。当前发布镜像支持 Linux amd64；ARM 机器可使用源码开发或自行配置 amd64 仿真。

- Linux：按发行版使用 [Docker Engine 官方安装步骤](https://docs.docker.com/engine/install/)，需要 Engine 和 Compose 插件。
- macOS / Windows：安装并启动 [Docker Desktop](https://docs.docker.com/desktop/)。

```sh
docker info
docker compose version
```

正式对外服务需域名、HTTPS 证书和反向代理。应用生产会话使用 Secure Cookie，普通 HTTP 远程地址不能正常保持登录；localhost 可用于本机验证。

### 2. 下载配置

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
| `POSTGRES_PASSWORD` | 内置数据库密码，必填；可用 `openssl rand -hex 24` 生成 |
| `ADMIN_USERNAME` | 首次创建的管理员账号，默认 `admin` |
| `ADMIN_PASSWORD` | 管理员初始化密码，至少 8 位；没有默认密码 |
| `ADMIN_NAME` | 管理员显示名称，默认“管理员” |
| `QINGWEN_IMAGE` | 默认 `docker.io/jojoshine/qingwen:latest`；`/surveys` 使用 `latest-surveys` |
| `APP_BIND` / `APP_PORT` | 默认 `127.0.0.1:3218`，映射至应用容器 `3000`，适用于同机 Nginx |
| `APP_URL` | 默认留空，分享地址自动跟随当前访问地址；需要固定时只填 origin，不带路径 |
| `TRUSTED_CLIENT_IP_HEADER` | 默认空；需要 IP 次数限制时配置可信代理覆盖的单值请求头 |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | 可选，在登录页提供已有普通体验账号的填入按钮；不自动创建该账号 |

不配置 `DATABASE_URL`。启动脚本自动生成内置 PostgreSQL 的连接地址，并对数据库密码进行 URL 编码。密码只在运行时注入，不写入镜像。已有数据库卷的密码不会因修改环境变量而改变；修改数据库密码需同步修改数据库角色密码和环境配置。

部署 `https://tbtparent.me/surveys` 时设置：

```dotenv
QINGWEN_IMAGE=docker.io/jojoshine/qingwen:latest-surveys
APP_URL=
```

`/surveys` 在构建时写入页面、静态资源、接口和分享地址。不能通过运行时 `NEXT_PUBLIC_BASE_PATH` 改变已编译的路径。

### 3. 拉取与启动

```sh
docker compose --env-file .env.docker -f compose.prod.yaml pull &&
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build --wait
docker compose --env-file .env.docker -f compose.prod.yaml ps
docker compose --env-file .env.docker -f compose.prod.yaml logs --tail=100 app
```

整个部署只有 `app` 一个服务，自动按以下顺序启动：

1. 初始化空数据库卷，或打开已有 PostgreSQL 数据目录。
2. 等待内置 PostgreSQL 就绪，执行未应用的 Prisma 迁移。
3. 创建配置的管理员；同名账号已存在时不覆盖密码，不生成演示数据。
4. 以 `node` 用户启动应用，PostgreSQL 以 `postgres` 用户运行。

应用和数据库由容器入口统一管理；任一进程退出会停止另一个进程，由容器重启策略重新启动。停止时先通知应用及数据库退出，Compose 预留 60 秒关闭时间。数据库仅监听容器内的 `127.0.0.1:5432`，部署只映射应用端口 `3000`。

根路径镜像访问 <http://localhost:3218/login>，`-surveys` 变体访问 <http://localhost:3218/surveys/login>。实际登录一次确认管理员和数据库可用，再配置 HTTPS 代理。手机扫码前需从手机可访问的域名打开后台，二维码中的 localhost 无法从另一台设备访问。

### 4. 不使用 Compose 时

同一个镜像也支持直接运行。先按前文准备 `.env.docker`，然后执行以下替代命令；不要和 Compose 同时占用相同端口或数据目录：

```sh
docker volume create qingwen_data
docker run -d --name qingwen --restart unless-stopped --stop-timeout 60 \
  --env-file .env.docker \
  -p 127.0.0.1:3218:3000 \
  --mount source=qingwen_data,target=/var/lib/postgresql/data \
  docker.io/jojoshine/qingwen:latest
docker logs --tail=100 qingwen
```

Compose 默认卷名带项目名前缀，例如 `/opt/qingwen` 下为 `qingwen_qingwen_data`；上面的直接运行示例使用 `qingwen_data`。迁移部署方式时应明确选择原卷或通过备份恢复，不要误用一个新的空卷。

### 5. 数据持久化与体验账号

Compose 将 `qingwen_data` 命名卷挂载至 `/var/lib/postgresql/data`。重建、更新或删除容器不会删除该卷；保持项目目录或 `-p` 项目名一致，避免创建另一个空卷。

```sh
docker compose --env-file .env.docker -f compose.prod.yaml down
```

上述操作保留数据。`down -v` 会删除数据卷，不用于正常停止或升级。镜像不能代替数据备份，搬到另一台服务器时需要恢复数据库备份和运行配置。

体验账号先在用户管理中创建为普通账号，再配置 `DEMO_USERNAME` 和 `DEMO_PASSWORD`。登录页按钮会填入公开凭据，不应使用管理员账号。`DEMO_USERNAME` 同时保护该账号：隐藏个人设置并拒绝修改密码。关闭体验入口时只清空 `DEMO_PASSWORD`、保留 `DEMO_USERNAME`，账号保护仍生效；需要停用时由管理员禁用账号。

## 二、HTTPS 与独立 Nginx 配置

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
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build app
```

### 已有域名下的 `/surveys`

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

### 本地开发：最短可执行链路

本机安装 Node.js 22.12+、pnpm 10.26.0 和 Git；如果没有现成 PostgreSQL，启动 Docker 后使用仓库的开发数据库配置。以下步骤在克隆出的源码目录中执行：

```sh
git clone https://github.com/JojoShine/qingwen.git
cd qingwen
corepack enable
corepack prepare pnpm@10.26.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
chmod 600 .env
```

如果 Node.js 未提供 Corepack，用 `npm install --global pnpm@10.26.0` 代替两条 `corepack` 命令。编辑 `.env`，配置 `ADMIN_PASSWORD`；保留模板的数据库连接地址即可使用下列本地数据库容器。

```sh
docker compose -p qingwen-survey -f compose.yaml up -d --wait db &&
pnpm db:generate &&
pnpm db:migrate &&
pnpm db:seed &&
pnpm dev
```

打开 <http://localhost:3218/login>，使用 `.env` 中的管理员账号和密码。应用在本机 Node.js 中运行；Compose 只启动 PostgreSQL，通过 `127.0.0.1:5436` 映射到数据库容器 `5432`。如果已有 PostgreSQL，修改 `DATABASE_URL` 并跳过首条 Docker 命令。修改本地数据库密码时，需要同时匹配 `POSTGRES_PASSWORD` 与连接 URL，而不是只修改 URL。

`pnpm dev` 本身不建表或创建账号。需要示例问卷时另行执行 `pnpm db:demo`，不在正式库自动生成。停止开发服务器使用 `Ctrl+C`；停止开发数据库使用 `docker compose -p qingwen-survey -f compose.yaml stop db`，保留数据卷。

### 本地验证正式构建

先停止当前开发服务器，在相同的数据库与环境配置下执行：

```sh
pnpm build && pnpm start
```

这仍然是源码运行，不拉取应用镜像。`pnpm start` 使用已生成的 `.next` 构建产物并监听 `3218`；生产模式依赖 Secure Cookie，localhost 可用于本机验证，对外的域名或局域网 IP 应通过 HTTPS 访问。开发和生产构建不要在同一源码目录同时运行。

下面是将源码部署到长期运行的服务器的步骤；采用 Docker 镜像部署时，不需要执行本节的 Node.js、pnpm 和 systemd 命令。

### 1. 准备数据库

使用已有 PostgreSQL，或在数据库服务器安装 PostgreSQL（新环境可选配套使用的 17）。以数据库管理员身份创建专用账号和库：

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

源码部署默认使用常规 Next.js 构建，不需要 standalone 静态文件复制步骤。`BUILD_STANDALONE=1` 仅由 Docker 构建设置。若源码部署也需要 `/surveys`，在 `.env` 中设置 `NEXT_PUBLIC_BASE_PATH=/surveys` 后再执行 `pnpm build`，启动时保留同一配置；更改路径后需重新构建。不要在同一目录同时运行开发服务器和生产构建。

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

## 四、迁入内置数据库

当前 `tbtparent.me` 仍使用宿主机 PostgreSQL 14.24 的 `qingwen` 库，旧版 Compose 也可能使用独立数据库容器。这些数据库不会自动搬入新镜像。新标准使用新的 `qingwen_data` 卷；只更换镜像而不导入备份，会看到一个新库。

保留旧镜像、Compose、环境配置和原数据库。先安排维护窗口停止旧应用写入，按实际旧部署方式备份：

```sh
# 宿主机 PostgreSQL：在宿主机使用相应数据库管理员权限。
mkdir -p backups
chmod 700 backups
sudo -u postgres pg_dump -d qingwen -Fc > backups/qingwen-before-embedded.dump
chmod 600 backups/qingwen-before-embedded.dump
```

旧数据库容器则使用保存的旧 Compose 执行 `exec -T db pg_dump -U survey -d survey -Fc`。备份前停止旧应用，数据库保持运行；不要删除原数据库或旧卷。

下载新 `compose.prod.yaml`，新建 `.env.docker` 并填写内置数据库密码和管理员配置；原环境部署 `/surveys` 时保留 `latest-surveys` 变体。确认旧应用已经停止后，导入备份：

```sh
docker compose --env-file .env.docker -f compose.prod.yaml pull &&
docker compose --env-file .env.docker -f compose.prod.yaml run --rm --no-deps -T app restore < backups/qingwen-before-embedded.dump &&
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build --wait
```

`restore` 使用同一个镜像，只启动内置数据库并导入备份，不启动网页服务；完成后关闭临时容器。恢复时忽略原对象所有者和权限，由内置数据库角色接管。之后正常启动会执行未应用的迁移，已有账号密码保持不变。核对用户、问卷、答卷、图片及扫码地址后，再结束维护并保留旧库作回退依据。

`compose.external-db.yaml` 仅为旧部署保留过渡兼容：设置 `DATABASE_URL` 时入口跳过内置 PostgreSQL，执行旧应用或显式迁移命令。新安装不使用此配置。此处的代码和文档更新不会自行切换正式服务器。

## 五、备份、换机恢复与升级

### 备份

```sh
cd /opt/qingwen
mkdir -p backups
chmod 700 backups
docker compose --env-file .env.docker -f compose.prod.yaml exec -T app pg_dump -U survey -d survey -Fc > backups/qingwen.dump
chmod 600 backups/qingwen.dump
```

使用不同文件名保留多个版本，将数据库备份与 `.env.docker` 分开存至其他设备。备份包含用户、问卷、答卷、会话和 Banner；环境文件包含密码，需限制访问。

### 恢复到新机器或现有数据卷

在目标机器安装 Docker，复制匹配版本的 Compose、`.env.docker` 和备份，先拉取镜像。恢复到现有部署前先备份当前目标库并停止应用；恢复会覆盖目标中的同名对象和数据：

```sh
docker compose --env-file .env.docker -f compose.prod.yaml stop app &&
docker compose --env-file .env.docker -f compose.prod.yaml run --rm --no-deps -T app restore < backups/qingwen.dump &&
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build --wait
```

新机器可省略第一条停止命令；`restore` 会初始化空卷的 PostgreSQL，再导入备份。保持原始数据卷或备份，恢复失败时先排错，不启动应用写入。不要将运行中的数据目录直接复制到另一台机器，也不要跨 PostgreSQL 大版本直接挂载旧数据目录；使用逻辑备份恢复。

### 更新镜像

先备份数据库和环境配置，记录旧镜像的固定提交标签或 digest。将 `.env.docker` 中的 `QINGWEN_IMAGE` 改为通过 CI 的目标版本，使用同提交的 Compose：

```sh
docker compose --env-file .env.docker -f compose.prod.yaml pull &&
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-build --wait
```

启动入口自动应用增量迁移，不重置已有数据或管理员密码。不要修改已经应用的历史迁移。回退需要同时核对应用与数据库结构兼容性：只有与当前数据库兼容的旧版内置数据库镜像才能直接回退；旧外部数据库方案需恢复旧配置和匹配的数据备份。代码回退不等于数据库回退，不用 `prisma migrate reset` 修复生产库。

源码部署更新：停止服务 → 拉取代码 → 安装冻结锁文件依赖 → `db:generate` → `db:migrate` → 构建 → 启动服务。数据库备份与回退规则相同。

## 六、GitHub CI 与镜像发布

实际链路为：**提交 main → 源码构建、类型检查、接口和浏览器测试 → 构建内置 PostgreSQL 的镜像 → 单容器启动和数据恢复验证 → 发布 Docker Hub 并同步 GHCR**。服务器只拉取镜像，不上传源码或现场构建；当前没有自动 SSH 上线任务。

[CI 工作流](../.github/workflows/ci.yml) 分别构建根路径和 `/surveys` 两个变体，最终目标均为 `runner`。源码测试使用 CI 临时数据库；镜像验收只运行交付的单容器，验证自动迁移、管理员初始化、登录、问卷创建、正常停止、重建后数据和密码保留，以及备份恢复到空卷。验证成功才发布。

| 用途 | Docker Hub 镜像 |
| --- | --- |
| 根路径 | `docker.io/jojoshine/qingwen:latest` |
| `/surveys` | `docker.io/jojoshine/qingwen:latest-surveys` |
| 固定提交，根路径 | `docker.io/jojoshine/qingwen:sha-<完整提交哈希>` |
| 固定提交，`/surveys` | `docker.io/jojoshine/qingwen:sha-<完整提交哈希>-surveys` |

生产推荐固定提交标签或 `docker.io/jojoshine/qingwen@sha256:<digest>`，下载配置时也将 GitHub URL 的 `main` 换为相同提交。GHCR 保留相同标签副本，例如 `ghcr.io/jojoshine/qingwen:latest`；用户默认安装使用 Docker Hub。旧版标签可能不包含 PostgreSQL，不能用于新的单容器 Compose。

维护者只需一个公开 Docker Hub 仓库 `jojoshine/qingwen`：

1. 在 Docker Hub 创建具备 Read & Write 权限的[访问令牌](https://docs.docker.com/security/access-tokens/)。
2. 在 [GitHub Actions Variables](https://github.com/JojoShine/qingwen/settings/variables/actions) 设置 `DOCKERHUB_USERNAME=jojoshine`。
3. 在 [GitHub Actions Secrets](https://github.com/JojoShine/qingwen/settings/secrets/actions) 设置 `DOCKERHUB_TOKEN`。不把令牌写进代码、环境示例或聊天。

缺少 Hub 凭据或推送失败时发布任务失败，不会跳过 Hub。公开镜像可匿名拉取，安装用户不需要发布令牌；GHCR 副本需要维护者在 Packages 中确认 Public 可见性。

自行构建仅在开发机或构建机执行：

```sh
# 省略构建参数则得到根路径版本；同一镜像已含 PostgreSQL。
docker build --target runner --build-arg NEXT_PUBLIC_BASE_PATH=/surveys -t qingwen:custom-surveys .
```

构建阶段不连接正式数据库，也不初始化账号；`.dockerignore` 排除环境文件、备份、Git 历史和本地依赖。PostgreSQL 继承官方镜像的初始化过程，容器入口使用 tini 管理退出与子进程；实际用户数据始终在运行时数据卷中。

## 七、常见问题

| 现象 | 检查方向 |
| --- | --- |
| 镜像拉取失败 | 检查 Docker Hub 网络、公开仓库及已发布标签，确认机器为 amd64 |
| 启动失败或反复重启 | 查看 `logs app` 中 PostgreSQL、迁移或初始化错误；检查密码、卷权限和空间 |
| 更新后数据为空 | 确认使用原 Compose 项目名和数据卷；旧外部数据库需显式导入备份 |
| 修改数据库密码变量后连接失败 | 已有数据库卷不会按环境变量重设密码，需修改数据库角色密码并同步配置 |
| 旧数据目录无法启动 | 核对 PostgreSQL 大版本和原数据来源；使用备份恢复，不强行修改 `PG_VERSION` |
| `/surveys` 资源 404 | 选择 `-surveys` 变体，Nginx 保留 URI，检查正则 location 是否截获资源 |
| 登录后返回登录页 | 检查 HTTPS、Secure Cookie、代理 Host 和 `X-Forwarded-Proto` |
| 手机二维码无法打开 | 从手机可访问的域名打开后台，清除错误的 `APP_URL` 覆盖值后重新分享 |
| IP 次数限制不可用 | 设置可信单值请求头，并防止绕过代理直接访问应用 |
| 忘记管理员密码 | 由其他管理员在用户管理中重置；再次启动不会覆盖已有密码 |

## 参考

- [Docker Engine 安装](https://docs.docker.com/engine/install/)
- [Docker 官方 PostgreSQL 镜像](https://hub.docker.com/_/postgres)
- [容器多进程与退出处理](https://docs.docker.com/engine/containers/multi-service_container/)
- [Docker CI 发布多个镜像仓库](https://docs.docker.com/build/ci/github-actions/push-multi-registries/)
- [Prisma 生产迁移](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
