# 安装与部署

**第一次安装只需要下面三步。** 镜像内置 PostgreSQL，不需要下载源码、安装 Node.js 或单独准备数据库。

已安装的用户按需查看：[升级](#更新镜像) · [备份](#备份) · [恢复](#恢复到现有安装) · [换机器](#换机器恢复) · [公网访问](#公网访问)。

## 三步安装

默认从 **GHCR** 拉取公开镜像，无需登录镜像仓库。镜像已包含 PostgreSQL，安装时无需配置外部数据库。准备一台 **Linux x86_64** 机器，安装好 Docker、Docker Compose v2、`curl` 和 `openssl`。Docker 安装见[官方说明](https://docs.docker.com/engine/install/)。

以下仅用于**首次安装**；已有安装请看[升级](#更新镜像)。依次复制执行三组命令即可。

### 1. 下载部署文件

```sh
sudo mkdir -p /opt/qingwen
sudo chown "$(id -u):$(id -g)" /opt/qingwen
cd /opt/qingwen
curl -fSL https://raw.githubusercontent.com/JojoShine/qingwen/main/compose.prod.yaml -o compose.prod.yaml
```

### 2. 自动生成账号密码

```sh
(
  umask 077
  set -C
  printf 'POSTGRES_PASSWORD=%s\nADMIN_USERNAME=admin\nADMIN_PASSWORD=%s\n' \
    "$(openssl rand -hex 24)" "$(openssl rand -hex 16)" > .env.docker
)
sed -n '/^ADMIN_/p' .env.docker
```

保存终端显示的账号和密码。配置保存在 `.env.docker`，已有文件会拒绝覆盖，不要删除它重新生成。

### 3. 启动轻问

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml pull &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up \
  -d --no-build --pull never --wait --wait-timeout 180
```

启动时自动完成数据库初始化、建表和管理员创建。命令成功后：

- **装在自己的电脑上**：打开 <http://localhost:3218/login>，输入第二步的账号密码。
- **装在远程服务器上**：在自己的电脑另开终端执行下面的 SSH 转发，保持终端打开，再访问同一个 localhost 地址。

```sh
# 替换为你自己的服务器账号和 IP，在自己的电脑上执行。
ssh -N -L 3218:127.0.0.1:3218 用户名@服务器IP
```

SSH 转发用于自己登录试用。要让其他人访问或手机扫码填写，请为服务器配置 **HTTPS 域名**，反向代理到 `127.0.0.1:3218`，见[公网访问](#公网访问)。默认不开放公网端口，不能直接用服务器的 HTTP IP 地址登录。

遇到启动问题，查看日志：

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml logs --tail=100 app
```

附件提交失败时，页面会显示“诊断编号”。在应用日志中搜索该编号或 `[attachment diagnostic]`，可关联表单解析与拒绝原因。JPG 格式拒绝会记录文件头、结束标记、尾部附加数据长度、接收大小及 SHA-256，帮助排查手机浏览器兼容问题；不会记录照片原始内容、文件名、答卷正文、Cookie 或完整 User-Agent。每个进程每分钟最多输出 60 条诊断及一条限流提示。日志用于定位原因，不代表放宽文件校验；生产部署应配置容器日志轮转。

数据会自动保存在持久化卷中，正常更新容器不会丢失。后续操作按需查看：[升级](#更新镜像) · [备份](#备份) · [恢复或换机器](#换机器恢复) · [可选配置](#可选配置)。

## 备用镜像源

默认使用 GHCR，Docker Hub 提供相同版本的备用镜像。GHCR 无法连接时，在 `.env.docker` 设置下面这一行，再执行安装第三步的启动命令：

```dotenv
QINGWEN_IMAGE=docker.io/jojoshine/qingwen:latest
```

上述为根路径首次安装示例。`/surveys` 首次安装使用 `docker.io/jojoshine/qingwen:latest-surveys`。已有安装只将镜像地址中的 `ghcr.io/jojoshine/qingwen` 换成 `docker.io/jojoshine/qingwen`，保留原固定版本标签或摘要；不要借切换镜像源升级版本。切回 GHCR 时反向替换即可。

两处均为包含 PostgreSQL 的同版本镜像，切换来源无需迁移数据库；保持原 `.env.docker` 中其他配置、Compose 项目名和数据卷不变。Compose 不会自动切换备用源，两个仓库的可达性均取决于服务器网络。

## 公网访问

如果只在自己电脑试用，完成三步安装即可。对外发布问卷还需要一个已解析到服务器的域名和有效 HTTPS 证书。使用 Nginx 或已有反向代理，将该域名转发到 `127.0.0.1:3218`。

使用 Nginx 时，将以下内容保存为 `/etc/nginx/conf.d/qingwen.conf`，确认该目录在主配置中被加载。域名和证书路径换成自己的实际值：

```nginx
server {
    listen 443 ssl;
    server_name survey.example.com;
    ssl_certificate /etc/letsencrypt/live/survey.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/survey.example.com/privkey.pem;

    client_max_body_size 5m;

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

检查并重新加载 Nginx：

```sh
sudo nginx -t && sudo systemctl reload nginx
```

通过 `https://survey.example.com` 访问后台后，分享链接会自动使用该域名，无需设置 `APP_URL`。代理需按上例保留 Host 并覆盖 `X-Forwarded-Proto`，使 HTTPS 请求来源校验正常。

只有后台访问地址与分享域名不同时，才需要设置 `APP_URL=https://survey.example.com` 固定分享地址；环境配置变更后重建应用容器：

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up -d --no-build app
```

### 使用 `/surveys` 子路径

默认安装从网站根路径访问。如果需要与其他业务共用域名的 `/surveys` 路径，在 `.env.docker` 加入 `QINGWEN_IMAGE=ghcr.io/jojoshine/qingwen:latest-surveys`，然后按[更新镜像](#更新镜像)重新拉取和启动。

将 [独立 Nginx 路径配置](../deploy/nginx/qingwen.conf.example)放入自己的配置目录，并在已有 HTTPS `server` 内 `include`。它会保留 `/surveys` 原始路径转发到 `127.0.0.1:3218`，无需新增同域名 `server`。本项目演示服务器的具体目录与加载方式放在文末[正式环境附录](#附录当前正式环境)。

若反向代理也在容器中，须让它与应用处于同一 Docker 网络，通过 `app:3000` 访问；代理容器内的 `127.0.0.1` 不指向宿主机应用。不要为了代理连通而直接向公网开放应用和数据库端口。

需要 IP 次数限制时，设置 `TRUSTED_CLIENT_IP_HEADER=x-real-ip`，确保代理始终覆盖该头且无法绕过代理直连应用。默认留空时系统不允许开启 IP 限制；单值头不能填写逗号分隔的转发链。多层代理需先正确还原可信客户端 IP，再向应用传递一个值。

## 日常运维

以下命令在 `/opt/qingwen` 执行，固定使用 `-p qingwen`、`.env.docker` 和 `compose.prod.yaml`。应用和数据库在同一容器中，日常运维不再操作宿主机的 `qingwen` 库，不另起 `db` 或 `migrate` 服务。

### 备份

附件版本开始，**完整备份必须同时包含数据库和附件卷**。镜像内提供 `backup` / `restore-backup`，不需要单独安装脚本或数据库工具。备份期间短暂停止应用，备份容器只启动数据库，因此两部分属于同一个停写时间点。

以下命令适用于包含附件功能的新镜像；当前正式环境的历史版本仍按本文末尾的实际发布记录识别，不会因文档更新自动升级。

```sh
cd /opt/qingwen
umask 077
QINGWEN_BACKUP_DIR="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p backups && chmod 700 backups &&
mkdir -m 700 "$QINGWEN_BACKUP_DIR" &&
cp -p .env.docker compose.prod.yaml "$QINGWEN_BACKUP_DIR/" &&
docker inspect --format '{{.Config.Image}} {{.Image}}' \
  "$(docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml ps -q app)" \
  > "$QINGWEN_BACKUP_DIR/image-reference.txt" &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml stop app &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml run \
  --rm --no-deps -T app backup > "$QINGWEN_BACKUP_DIR/qingwen-backup.tar.partial" &&
mv "$QINGWEN_BACKUP_DIR/qingwen-backup.tar.partial" "$QINGWEN_BACKUP_DIR/qingwen-backup.tar" &&
(cd "$QINGWEN_BACKUP_DIR" && sha256sum qingwen-backup.tar > qingwen-backup.tar.sha256) &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up \
  -d --no-build --pull never --wait --wait-timeout 180
```

仅成功的归档才会由 `.partial` 改名。备份失败时命令链停止，服务保持停止；检查磁盘空间、日志和卷挂载，处理后重试或启动原应用，不能把半成品当成备份。归档包含 `database.dump`、`uploads.tar` 和两者的校验和；备份前会校验数据库引用的每个附件，缺失或损坏会明确报错。命令 stdout 是备份内容，请保留 `-T`，不要把 stderr 日志合并进去。

若存在发布记录，一并保存：

```sh
if [ -f release.json ]; then cp -p release.json "$QINGWEN_BACKUP_DIR/"; fi
```

**同一服务器上的数据卷和备份目录不能防止磁盘损坏。** 将整个备份目录复制到另一台机器或独立备份存储，建议每天备份，至少保留最近 7 个每日版本和 4 个每周版本；升级前额外备份。文件含用户数据和环境凭据，只允许管理员读取。定期在独立 Compose 项目、数据卷和端口试恢复，验证登录、答卷及附件下载后，才确认备份可恢复。保留策略和异机复制由部署者执行，本项目不会自动删除旧备份或声称已配置异机备份。

### 恢复到现有安装

先按上节备份当前目标。使用与备份兼容的固定版本镜像，镜像应在停机前拉取完成：

```sh
cd /opt/qingwen
QINGWEN_RESTORE_DIR=/opt/qingwen/backups/your-backup
(cd "$QINGWEN_RESTORE_DIR" && sha256sum -c qingwen-backup.tar.sha256) &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml stop app &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml run \
  --rm --no-deps -T app restore-backup < "$QINGWEN_RESTORE_DIR/qingwen-backup.tar" &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up \
  -d --no-build --pull never --wait --wait-timeout 180
```

恢复先检查归档路径、数据库及附件归档的 SHA-256，再导入数据库、恢复附件，并逐一校验附件内容。恢复容器不启动网页服务；原应用必须停止，不能让两个 PostgreSQL 进程打开同一数据目录。失败时不要启动应用，保留现场并使用恢复前备份处理。恢复会覆盖数据库的同名对象及数据，会舍弃备份之后的写入；它不是事务式的整机回滚，失败后不会自动恢复旧库。

### 换机器恢复

新机器安装 Docker 并创建 `/opt/qingwen`，复制整个备份目录。恢复原环境和 Compose，拉取原固定镜像，再执行上节的 `restore-backup` 和启动命令：

```sh
cd /opt/qingwen
QINGWEN_RESTORE_DIR=/opt/qingwen/backups/your-backup
install -m 600 "$QINGWEN_RESTORE_DIR/.env.docker" .env.docker &&
install -m 644 "$QINGWEN_RESTORE_DIR/compose.prod.yaml" compose.prod.yaml &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml pull
```

Compose 会创建本机的新数据库卷 `qingwen_qingwen_data` 和附件卷 `qingwen_qingwen_uploads`，内容来自完整备份。验证账号、问卷、答卷、附件下载及公开填写链接，配置目标机器 HTTPS/Nginx。保留 `/surveys` 镜像变体及代理路径；更换域名时检查可选 `APP_URL`。不要直接复制运行中的数据库目录，也不要跨 PostgreSQL 大版本挂载旧目录。

**旧版仅数据库备份：** 在尚无附件数据的历史版本中，`qingwen.dump` 包含全部业务数据、Banner 和二维码 Logo。使用匹配的原镜像，将上述恢复命令改为 `app restore < qingwen.dump`，并校验对应 `.sha256`。首次正式迁移的文件名为 `qingwen-final.dump`，配套环境为 `.env.embedded`、`compose.embedded.yaml`，具体位置见正式环境记录。附件功能启用后的仅数据库备份不完整，不能作为完整恢复依据。

### 更新镜像

1. 执行备份章节，保留旧镜像引用及升级前的 `.env.docker`、Compose 和发布记录。
2. 选择已通过 CI 的目标提交；`/surveys` 继续使用 `-surveys` 标签。下载同提交的 Compose 到临时文件，审核后替换；不要重新下载环境模板覆盖现有 `.env.docker`。
3. 仅将 `.env.docker` 中的 `QINGWEN_IMAGE` 改为目标固定标签，保留密码、项目名、卷名、端口及路径配置。若新 Compose 改变卷映射或 PostgreSQL 大版本，先另行验证迁移，不直接套用下面的日常升级命令。

下载匹配配置的示例，提交值替换为目标版本：

```sh
QINGWEN_TARGET_COMMIT=56260bca01fa839109d75e4e539170b6eeb1ce61
curl -fsSL "https://raw.githubusercontent.com/JojoShine/qingwen/$QINGWEN_TARGET_COMMIT/compose.prod.yaml" \
  -o compose.prod.yaml.next
```

审核后将临时文件替换为 `compose.prod.yaml`，完成镜像引用修改，再执行：

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml pull &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up \
  -d --no-build --pull never --wait --wait-timeout 180
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml ps
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml logs --tail=100 app
curl --fail --silent --show-error https://tbtparent.me/surveys/login > /dev/null
```

先拉取再重建，下载失败不会切换旧容器。若本地已有经官方摘要核验的镜像，可在确认固定引用存在后直接执行 `up --pull never`；这正是本次网络受限环境完成传输后采用的方式，不表示可以略过镜像校验。

容器启动入口自动执行增量迁移和管理员存在性检查，不再手动运行 `db:migrate`、`db:seed` 或独立迁移容器。检查健康状态后，还需实际登录并查看现有问卷、答卷和公开填写页，不能只凭登录页 HTTP 200 判断数据库正常。成功后记录新的发布版本、镜像摘要和备份位置；原 Nginx 不因单容器升级而重写。

### 回退

保留旧镜像及备份。若旧应用与当前数据库结构、PostgreSQL 数据目录版本兼容，可恢复升级前的 `.env.docker` 和 Compose，使用本地旧镜像重新启动：

```sh
cp -p "$QINGWEN_BACKUP_DIR/.env.docker" .env.docker &&
cp -p "$QINGWEN_BACKUP_DIR/compose.prod.yaml" compose.prod.yaml &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up \
  -d --no-build --pull never --wait --wait-timeout 180
```

这里的 `QINGWEN_BACKUP_DIR` 指升级前备份目录；不要指向其他部署。若数据库迁移不向后兼容，需要在维护窗口停止写入，先保存当前失败现场，再按恢复步骤导入升级前备份。回退至旧外部数据库方案还需恢复旧配置和相应数据库；不能只把不含 PostgreSQL 的旧镜像标签套给新 Compose。回退到备份时间点会舍弃其后的新写入，需先核对并处理这些数据。

不要修改已应用的历史迁移，不用 `prisma migrate reset` 修复生产库。源码附件默认写入项目 `uploads/`（已排除 Git 和镜像构建），可通过 `UPLOAD_DIR` 指定持久化绝对目录；更换工作目录或部署版本时必须保持该目录。源码备份先停应用，生成 `pg_dump -Fc` 并归档整个 `UPLOAD_DIR`，与配置一起保存；恢复时同时恢复数据库和附件，再执行迁移和启动，不能只恢复数据库。

源码部署仍按[源码部署](#源码部署)步骤进行，更新顺序是停止服务、拉取代码、安装冻结锁文件依赖、生成客户端、迁移、构建、再启动；备份与回退原则相同。

## 可选配置

首次安装只生成三个必需变量，其他配置均有默认值。有需要时编辑 `.env.docker`，再按[更新镜像](#更新镜像)中的启动方式重建容器。完整环境变量示例见 [.env.docker.example](../.env.docker.example)，不要用模板覆盖已有密码。

| 变量 | 用途 |
| --- | --- |
| `POSTGRES_PASSWORD` | 内置数据库密码，必填；可用 `openssl rand -hex 24` 生成 |
| `ADMIN_USERNAME` | 首次创建的管理员账号，默认 `admin` |
| `ADMIN_PASSWORD` | 管理员初始化密码，至少 8 位；没有默认密码 |
| `ADMIN_NAME` | 管理员显示名称，默认“管理员” |
| `QINGWEN_IMAGE` | 默认 `ghcr.io/jojoshine/qingwen:latest`；`/surveys` 使用 `latest-surveys`，Docker Hub 为备用源 |
| `APP_BIND` / `APP_PORT` | 默认 `127.0.0.1:3218`，映射至应用容器 `3000`，适用于同机 Nginx |
| `APP_URL` | 默认留空，分享地址自动跟随当前访问地址；需要固定时只填 origin，不带路径 |
| `TRUSTED_CLIENT_IP_HEADER` | 默认空；需要 IP 次数限制时配置可信代理覆盖的单值请求头 |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | 可选，在登录页提供已有普通体验账号的填入按钮；不自动创建该账号 |

不配置 `DATABASE_URL`。启动脚本自动生成内置 PostgreSQL 的连接地址，并对数据库密码进行 URL 编码。密码只在运行时注入，不写入镜像。已有数据库卷的密码不会因修改环境变量而改变；修改数据库密码需同步修改数据库角色密码和环境配置。

需要在自己的域名下使用 `/surveys` 子路径时设置：

```dotenv
QINGWEN_IMAGE=ghcr.io/jojoshine/qingwen:latest-surveys
APP_URL=
```

`/surveys` 在构建时写入页面、静态资源、接口和分享地址。不能通过运行时 `NEXT_PUBLIC_BASE_PATH` 改变已编译的路径。

### 持久化与体验账号

Compose 将 `qingwen_data` 挂载至 `/var/lib/postgresql/data`，将 `qingwen_uploads` 挂载至 `/var/lib/qingwen/uploads`。重建、更新或删除容器不会删除这两个命名卷；所有运维命令保持 `-p qingwen`，避免创建另一组空卷。

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml down
```

上述操作保留数据。`down -v` 会删除数据卷，不用于正常停止或升级。镜像不能代替数据备份，搬到另一台服务器时需要恢复数据库、附件和运行配置。不要修改 Compose 项目名或卷名，否则会连接到新空卷；旧卷仍在时应重新挂载旧卷，不要初始化后覆盖。

体验账号先在用户管理中创建为普通账号，再配置 `DEMO_USERNAME` 和 `DEMO_PASSWORD`。登录页按钮会填入公开凭据，不应使用管理员账号。`DEMO_USERNAME` 同时保护该账号：隐藏个人设置并拒绝修改密码。关闭体验入口时只清空 `DEMO_PASSWORD`、保留 `DEMO_USERNAME`，账号保护仍生效；需要停用时由管理员禁用账号。

### 答卷附件

附件保存于 `/var/lib/qingwen/uploads`，由 `qingwen_uploads` 独立数据卷持久化；PostgreSQL 只保存关联、原文件名、大小、类型、随机存储标识和 SHA-256。无需部署对象存储。写入使用排他创建、文件与目录同步落盘，成功后才提交答卷关联；失败清理只删除确认未被数据库引用的文件。启动前检查已保存附件的完整性，缺失或损坏时停止启动并提示恢复，不把空卷当成正常数据。正常重建、升级和 `down` 保留两卷；`down -v`、删除数据卷或磁盘故障仍会丢数据，因此必须使用前面的完整备份与异机副本。每题最多 5 个、单个最大 5MB，每份答卷最多 10 个，整个上传请求（含附件和答卷）最大 5MiB；应用对实际接收大小、文件类型和文件内容进行检查。不支持 ZIP、RAR、7z 等压缩包，以及可执行文件、HTML、SVG、宏文档和旧版二进制 Office 文件；普通 Office 仅支持结构校验通过的 DOCX/XLSX/PPTX，防止普通压缩包改后缀绕过。不在服务器解压附件，不执行用户文件。附件下载仅允许问卷所有者和管理员，公开填写链接不会公开已提交的附件。上传读取限时 30 秒，每个应用进程最多同时处理 4 个上传请求，超限返回 429；写入前保留至少 512MiB 可用磁盘空间。下载设置 `nosniff`，文档强制下载，只有允许的栅格图片支持预览。这些检查不等同于杀毒扫描或对文档内容的安全担保。

升级后需将实际生效的 Nginx 业务片段中的 `client_max_body_size` 调整为 `5m`（整个请求包含附件与答卷表单，应用端同步按 5MiB 硬限制），检查配置后平滑加载。已有 CDN、网关或其他反向代理也需允许相同请求大小；仅更新镜像不会修改服务器的 Nginx。上传超过限制时填写页会保留答案并提示失败，可移除或更换文件后重试。

## 常见问题

| 现象 | 检查方向 |
| --- | --- |
| 镜像拉取失败 | 检查 GHCR 网络、公开仓库及已发布标签，确认机器为 amd64；必要时切换[备用镜像源](#备用镜像源) |
| 启动失败或反复重启 | 查看 `logs app` 中 PostgreSQL、迁移、初始化或附件校验错误；检查两卷挂载、权限和空间，缺失附件用完整备份恢复 |
| 更新后数据为空 | 确认使用原 Compose 项目名和数据卷；旧外部数据库需显式导入备份 |
| 修改数据库密码变量后连接失败 | 已有数据库卷不会按环境变量重设密码，需修改数据库角色密码并同步配置 |
| 旧数据目录无法启动 | 核对 PostgreSQL 大版本和原数据来源；使用备份恢复，不强行修改 `PG_VERSION` |
| `/surveys` 资源 404 | 选择 `-surveys` 变体，Nginx 保留 URI，检查正则 location 是否截获资源 |
| 登录后返回登录页 | 检查 HTTPS、Secure Cookie、代理 Host 和 `X-Forwarded-Proto` |
| 手机二维码无法打开 | 从手机可访问的域名打开后台，清除错误的 `APP_URL` 覆盖值后重新分享 |
| IP 次数限制不可用 | 设置可信单值请求头，并防止绕过代理直接访问应用 |
| 忘记管理员密码 | 由其他管理员在用户管理中重置；再次启动不会覆盖已有密码 |

## 源码部署

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

## 从旧版迁入

此节适用于尚未迁移的旧版部署，正式环境 `tbtparent.me` 已完成迁移，不需要重复执行。旧版可能使用宿主机 PostgreSQL 14.24 的 `qingwen` 库或独立数据库容器，这些数据不会自动搬入新镜像。新标准使用新的 `qingwen_data` 卷；只更换镜像而不导入备份，会看到一个新库。

保留旧镜像、Compose、环境配置和原数据库。正式切换先做在线备份，在独立项目、数据卷及本地临时端口试恢复，验证账号、问卷和答卷后，再进入维护窗口停止旧应用写入。随后制作最终备份，按实际旧部署方式导入；以下展示宿主机数据库的最终备份。

```sh
# 宿主机 PostgreSQL：在宿主机使用相应数据库管理员权限。
mkdir -p backups
chmod 700 backups
sudo -u postgres pg_dump -d qingwen -Fc > backups/qingwen-before-embedded.dump
chmod 600 backups/qingwen-before-embedded.dump
```

旧数据库容器则使用保存的旧 Compose 执行 `exec -T db pg_dump -U survey -d survey -Fc`。最终备份前停止旧应用，数据库保持运行；不要删除原数据库或旧卷。旧外部库配置停止命令示例：`docker compose -p qingwen --env-file .env.external-db -f compose.external-db.yaml stop app`。

下载新 `compose.prod.yaml`，新建 `.env.docker` 并填写内置数据库密码和管理员配置；原环境部署 `/surveys` 时保留 `latest-surveys` 变体。确认旧应用已经停止后，导入备份：

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml pull &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml run --rm --no-deps -T app restore < backups/qingwen-before-embedded.dump &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up -d --no-build --wait
```

`restore` 使用同一个镜像，只启动内置数据库并导入备份，不启动网页服务；完成后关闭临时容器。恢复时忽略原对象所有者和权限，由内置数据库角色接管。之后正常启动会执行未应用的迁移，已有账号密码保持不变。实际切换先在临时本地端口启动候选容器，对照最终备份前的各表行数和内容摘要，验证登录、用户、问卷、答卷及图片，再切回原端口并检查 HTTPS 和扫码地址；此过程不需要改写 Nginx。成功后保留旧库作回退依据。

`compose.external-db.yaml` 仅为旧部署保留过渡兼容：设置 `DATABASE_URL` 时入口跳过内置 PostgreSQL，执行旧应用或显式迁移命令。新安装不使用此配置。此处的代码和文档更新不会自行切换正式服务器。

## 镜像发布

实际链路为：**提交 main → 源码构建、类型检查、接口和浏览器测试 → 构建内置 PostgreSQL 的镜像 → 单容器启动和数据恢复验证 → 同时发布到 GHCR（默认安装源）和 Docker Hub（备用源）**。服务器只拉取镜像，不上传源码或现场构建；当前没有自动 SSH 上线任务。

[CI 工作流](../.github/workflows/ci.yml) 分别构建根路径和 `/surveys` 两个变体，最终目标均为 `runner`。源码测试使用 CI 临时数据库；镜像验收只运行交付的单容器，验证自动迁移、管理员初始化、登录、问卷创建、正常停止、重建后数据和密码保留，以及含附件的完整备份恢复到空卷。验证成功才发布。

| 用途 | GHCR 默认镜像 | Docker Hub 备用镜像 |
| --- | --- | --- |
| 根路径 | `ghcr.io/jojoshine/qingwen:latest` | `docker.io/jojoshine/qingwen:latest` |
| `/surveys` | `ghcr.io/jojoshine/qingwen:latest-surveys` | `docker.io/jojoshine/qingwen:latest-surveys` |
| 固定提交，根路径 | `ghcr.io/jojoshine/qingwen:sha-<完整提交哈希>` | `docker.io/jojoshine/qingwen:sha-<完整提交哈希>` |
| 固定提交，`/surveys` | `ghcr.io/jojoshine/qingwen:sha-<完整提交哈希>-surveys` | `docker.io/jojoshine/qingwen:sha-<完整提交哈希>-surveys` |

生产推荐固定提交标签或 `ghcr.io/jojoshine/qingwen@sha256:<digest>`，下载配置时也将 GitHub URL 的 `main` 换为相同提交。安装默认使用 GHCR，Docker Hub 按[备用镜像源](#备用镜像源)手动切换。旧版标签可能不包含 PostgreSQL，不能用于新的单容器 Compose。

维护者只需一个公开 Docker Hub 仓库 `jojoshine/qingwen`：

1. 在 Docker Hub 创建具备 Read & Write 权限的[访问令牌](https://docs.docker.com/security/access-tokens/)。
2. 在 [GitHub Actions Variables](https://github.com/JojoShine/qingwen/settings/variables/actions) 设置 `DOCKERHUB_USERNAME=jojoshine`。
3. 在 [GitHub Actions Secrets](https://github.com/JojoShine/qingwen/settings/secrets/actions) 设置 `DOCKERHUB_TOKEN`。不把令牌写进代码、环境示例或聊天。

缺少 Hub 凭据或推送失败时发布任务失败，不会跳过 Hub。公开镜像可匿名拉取，安装用户不需要发布令牌；GHCR 包需要维护者在 Packages 中确认 Public 可见性。

自行构建仅在开发机或构建机执行：

```sh
# 省略构建参数则得到根路径版本；同一镜像已含 PostgreSQL。
docker build --target runner --build-arg NEXT_PUBLIC_BASE_PATH=/surveys -t qingwen:custom-surveys .
```

构建阶段不连接正式数据库，也不初始化账号；`.dockerignore` 排除环境文件、备份、Git 历史和本地依赖。PostgreSQL 继承官方镜像的初始化过程，容器入口使用 tini 管理退出与子进程；实际用户数据始终在运行时数据卷中。

## 附录：当前正式环境

当前版本于 **2026-10-19 21:56（Asia/Shanghai）** 部署，并于 **21:58** 完成验收。以下信息已通过运行容器及 `/opt/qingwen/release.json` 核对：

| 项目 | 当前实际配置 |
| --- | --- |
| 入口 | `https://tbtparent.me/surveys/login` |
| 部署目录与文件 | `/opt/qingwen`；`compose.prod.yaml`、`.env.docker` |
| Compose 项目 / 服务 / 容器 | `qingwen` / `app` / `qingwen-app-1`，一个业务容器 |
| 当前应用版本 | 提交 `45aa4b4bda26e625c9e86f99d2a90059304cc0b4`，`/surveys` 变体；包含附件数量提示澄清、多行输入框字数统计间距修复及键盘拖拽测试时序修正 |
| 实际运行镜像 | `ghcr.io/jojoshine/qingwen:sha-45aa4b4bda26e625c9e86f99d2a90059304cc0b4-surveys` |
| 数据库 | 内置 PostgreSQL 17，库名及角色为 `survey`，未使用外部 `DATABASE_URL` |
| 数据库卷 | `qingwen_qingwen_data` → `/var/lib/postgresql/data`，沿用原卷 |
| 附件卷 | `qingwen_qingwen_uploads` → `/var/lib/qingwen/uploads`，沿用原卷 |
| 应用端口 | `127.0.0.1:3218` → 容器 `3000`；数据库不向宿主机发布 |
| 独立 Nginx 配置 | `/etc/nginx/business/tbtparent.me/qingwen.conf`，本次未修改 |
| 上传上限 | 每题按设置最多 5 个，整份答卷的图片和附件合计最多 10 个；整个请求最多 5MiB（含表单），Nginx 保持 `client_max_body_size 5m` |
| 发布记录 | `/opt/qingwen/release.json` |
| 本次升级前完整备份 | `/opt/qingwen/backups/20261019T135629Z-45aa4b4-textarea-spacing/` |

### 本次备份与数据核对

镜像下载并核对摘要后，先停止应用写入，使用原镜像制作数据库与附件卷的完整备份；校验成功后才切换到新镜像。此次没有新增数据库迁移，原数据卷、Compose、端口及 `/surveys` 路径均保留。当前备份目录实际包含：

- `qingwen-backup.tar`、`qingwen-backup.tar.sha256`：完整备份及外层 SHA-256；归档内为 `database.dump`、`uploads.tar` 和 `SHA256SUMS`，内外校验均通过。
- `.env.docker`、`compose.prod.yaml`、`qingwen.nginx.conf`、`release.json`：升级前的配置和发布记录。
- `image-metadata.json`、`release.deployed.json`：本次镜像摘要及更新后的上线、验收记录。
- `backup.log`、`stop.log`、`start.log`、`qingwen-spacing-pull.log`、`qingwen-spacing-import.log`：备份、切换及镜像传输日志。

升级前后均为 **2 个用户、4 份问卷、1 份答卷、0 个附件记录**，数据库卷与附件卷映射一致。这次仅核对了升级前后的记录数量和卷映射，没有重新执行历史版本的逐行恢复审计。完整归档的内部校验和、外层校验和以及镜像启动时的附件完整性检查均通过。目录时间戳使用 UTC，与北京时间相差 8 小时。

这些备份当前保存在同一台服务器，**尚未配置异机定时备份**；不能据此声称已能抵御整盘故障。备份及环境文件含业务数据或凭据，仅保存在受限目录，不提交到 Git。

### 当前 GHCR 镜像与验收

[本次 CI 与镜像发布](https://github.com/JojoShine/qingwen/actions/runs/39260145261)全部成功后才部署此固定版本，包括生产构建、单元/接口检查、浏览器检查，以及根路径和 `/surveys` 两个镜像的容器重建、附件持久化和完整备份恢复验证。

正式部署后的核对结果：

- 容器健康，内部 `/surveys/login` 与正式 HTTPS 登录页均返回 HTTP 200。
- 正式域名返回的新 CSS 包含多行输入框字数统计的留白规则；使用该 CSS 在 390px 手机宽度和 1280px PC 宽度的浏览器布局中核对，字数统计与下方分类标题相距 22px，均无横向溢出。
- 数据库、附件卷映射、Compose 文件和 Nginx 配置均保持不变；附件数量、大小和类型规则未改动。

本次 GHCR 直连下载超时，按官方索引摘要从 `ghcr.nju.edu.cn` 获取相同镜像内容；其中一个镜像层通过独立下载校验后，由仅绑定服务器 `127.0.0.1` 的临时传输桥接交给 Docker。索引、镜像配置、提交标识和 `/surveys` 构建路径均已核对，桥接完成后关闭，临时镜像别名及下载文件已清理。正式配置仍使用上表中的官方 GHCR 地址，没有在服务器构建镜像，也未修改系统 DNS 或 Docker 配置。核验值为：

```text
GHCR 镜像索引：sha256:a2b70f6538adb7a838e6f822a71eeda567c6cdee178739d3e7bc4682ace618fd
linux/amd64 平台 manifest：sha256:a5908f0ea16f1932b8f082dd628e54908122f562371a145b84129b2ce186a74a
linux/amd64 镜像配置：sha256:cde2b91ca7db547cea20acc64ab919ab37b92aaccde5b6ac458b0dc490d80061
```

任何其他镜像副本都必须单独核对官方摘要；索引摘要与镜像配置 Id 属于不同对象，不能互相比较。文档提交不会自动更新正式容器，正式版本以 `release.json` 和运行容器为准，不能用 `latest` 推断。

### 正式服务器的 Nginx 加载方式

当前实际入口由 `/etc/nginx/conf.d/20-tbtparent.me.conf` 加载 `/etc/nginx/business/tbtparent.me/*.conf`。轻问使用 `/etc/nginx/business/tbtparent.me/qingwen.conf`（点号目录中的实际文件）。本次保留该文件，未修改或重载 Nginx；`client_max_body_size 5m` 沿用此前附件功能上线时的配置。

`location = /surveys` 和 `location ^~ /surveys/` 仍代理到 `http://127.0.0.1:3218`，`proxy_pass` 不增加尾部 `/`，继续保留 `/surveys` URI；域名、证书和其他业务路径未改动。后续确需修改 Nginx 时，先确认实际 `include` 和已有文件，再检查并平滑加载：

```sh
sudo nginx -t && sudo systemctl reload nginx
```

当前配置 SHA-256 为 `5151b0f20978168ce515262a9ee41e28edb857e9b97cad5ce5c7698238f5570e`。`APP_URL` 默认留空；若固定为 `https://tbtparent.me`，应用会自动附加 `/surveys`。

### 历史发布记录

- **2026-10-19 21:03 附件数量提示澄清**：提交 `94ae314d37605765f3480cfa70f0974557b10768`，备份 `/opt/qingwen/backups/20261019T130332Z-94ae314-attachment-hint/`；只澄清每题与整份答卷的数量提示，上传规则未改动。
- **2026-10-19 20:06 附件功能与上传安全限制**：提交 `d9c2458df7b9072395d55720e328e103bfdddacc`，完整备份 `/opt/qingwen/backups/20261019T120550Z-d9c2458-attachments/`；该次完成隔离恢复、原数据逐行核对，以及附件上传、预览、下载和非法文件拒绝验收。首次在线备份另存于 `/opt/qingwen/backups/20261019T113645Z-340ab71-attachments/`。新增迁移 `202610190001_response_attachments` 在该次执行，Nginx 上传上限由 `2m` 调整为 `5m`。
- **2026-10-18 黑白二维码与中心 Logo**：应用提交 `d115927cd777576f9d74f86ca23d82854b2e420e`，备份 `/opt/qingwen/backups/20261017T172943Z-d115927-qr-logo/`；该目录仍保留二维码浏览器、解码及并发写入核对记录。
- **切换 GHCR 地址**：备份 `/opt/qingwen/backups/20261017T170503Z-ghcr-registry-switch/`，包含切换前的 Docker Hub 镜像引用、配置及校验记录。
- **首次迁入内置 PostgreSQL**：备份 `/opt/qingwen/backups/20261017T163140Z-56260bc-embedded/`，数据库名为 `qingwen-final.dump`，新配置为 `.env.embedded` 与 `compose.embedded.yaml`。原宿主机 PostgreSQL 14.24 的 `qingwen` 库及旧配置继续保留作回退依据，不承担当前应用读写。

日常备份使用前文的 `qingwen-backup.tar`、`.env.docker` 和 `compose.prod.yaml`。跨版本恢复应先使用新的隔离数据卷试恢复，再安排切换；`pg_restore --clean` 只处理归档中的对象，不会自动删除新版新增的表，不能直接把旧版备份当作当前数据库的完整降级操作。

## 参考

- [Docker Engine 安装](https://docs.docker.com/engine/install/)
- [Docker 官方 PostgreSQL 镜像](https://hub.docker.com/_/postgres)
- [容器多进程与退出处理](https://docs.docker.com/engine/containers/multi-service_container/)
- [Docker CI 发布多个镜像仓库](https://docs.docker.com/build/ci/github-actions/push-multi-registries/)
- [Prisma 生产迁移](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
