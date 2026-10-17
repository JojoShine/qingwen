# 轻问 · QINGWEN

一个以轻量、易用为目标的开源问卷系统。使用 Next.js、Ant Design 和 PostgreSQL，前后台在同一项目中，覆盖问卷创建、发布、填写与结果管理。

[MIT 许可证](LICENSE) · [部署文档](docs/DEPLOYMENT.md) · [参与贡献](CONTRIBUTING.md) · [问题反馈](https://github.com/JojoShine/qingwen/issues)

## 业务能力

| 模块 | 支持内容 |
| --- | --- |
| 问卷管理 | 创建、搜索、状态筛选、卡片/列表、复制、删除、发布、结束与恢复收集 |
| 可视化编辑 | 拖拽与键盘排序、分类标题、必填、选项配置、未保存离开提醒 |
| 基础题型 | 单选、多选、下拉、单行文字、多行文字、数字、日期（可选仅日期、日期＋时分、日期＋时分秒）、评分、排序、矩阵单选、矩阵多选 |
| 题目规则 | “其他”补充文字（默认多行，可切单行）、多选互斥、手机号/邮箱格式校验、前序选项控制显示 |
| 外观配置 | 手机/PC 背景模板、可选 Banner、上传图片与自定义标题、底部品牌开关与文案 |
| 预览分享 | 草稿试填、真实比例手机外壳、PC 预览、发布后链接与二维码分享 |
| 收集控制 | 开始/截止时间、最大答卷数、同一浏览器/IP 次数限制 |
| 数据结果 | 按题统计、原始答卷和详情、日期/答案/状态筛选、批量标记无效与恢复、CSV 导出 |
| 用户权限 | 管理员管理所有用户与问卷；普通用户管理自己的问卷和结果；公开问卷匿名填写 |

发布后锁定题目结构以保持统计一致，可继续调整外观；修改题目需复制为新问卷。预览支持试填与校验，不写入答卷。Banner 原图支持 PNG/JPG/WebP，最大 5MB，浏览器压缩后存入 PostgreSQL，不依赖额外文件存储。

## 技术栈

| 层次 | 技术与职责 |
| --- | --- |
| 全栈框架 | Next.js 16 App Router、React 19、TypeScript；页面与 Route Handlers 接口共用项目 |
| 界面交互 | Ant Design 6、Ant Design Icons、dnd-kit；统一轻问浅青绿主题 |
| 数据层 | PostgreSQL 17、Prisma 7、pg 驱动与版本化数据库迁移 |
| 校验与认证 | Zod、服务端角色/归属校验、加盐密码哈希、数据库会话与 HttpOnly Cookie |
| 验证 | Vitest 单元/接口测试、Playwright 浏览器测试 |
| 部署 | 多阶段 Docker 镜像、Next.js standalone、统一业务镜像与一次性迁移服务、Docker Compose |

不需要 Redis、对象存储或独立后端服务。普通账号由管理员创建，当前不提供公开注册、多租户、多人协作、复杂跳题、考试计分或答题附件上传。

## Docker 快速部署

默认安装包含轻问应用、数据库迁移和 PostgreSQL 17，使用 Docker Compose 成套部署。应用与迁移共用 [Docker Hub 镜像 `jojoshine/qingwen`](https://hub.docker.com/r/jojoshine/qingwen)，数据库使用 Docker Hub 官方镜像 `postgres:17-alpine`，通过命名卷持久化数据。PostgreSQL 单独运行在数据库容器中，不打包进轻问应用镜像；用户无需预先安装数据库，也无需下载源码或在服务器构建。

需要 Docker Engine / Docker Desktop 与 Docker Compose v2，当前发布镜像支持 Linux amd64。Docker 安装见 [Linux Docker Engine](https://docs.docker.com/engine/install/) 或 [Docker Desktop](https://docs.docker.com/desktop/)。先确认 `docker info` 和 `docker compose version` 均成功。

### 默认安装：自带 PostgreSQL

只下载 [compose.prod.yaml](compose.prod.yaml) 和 [.env.docker.example](.env.docker.example)：

```sh
sudo mkdir -p /opt/qingwen
sudo chown "$(id -u):$(id -g)" /opt/qingwen
cd /opt/qingwen
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/compose.prod.yaml -o compose.prod.yaml
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/.env.docker.example -o .env.docker
chmod 600 .env.docker
```

编辑 `.env.docker`，填写 `POSTGRES_PASSWORD`（建议用 `openssl rand -hex 24` 生成）和至少 8 位的 `ADMIN_PASSWORD`。默认 `QINGWEN_IMAGE=docker.io/jojoshine/qingwen:latest`，应用从根路径访问；`APP_URL` 留空即可自动获取当前访问地址。

```sh
docker compose --env-file .env.docker -f compose.prod.yaml pull &&
docker compose --env-file .env.docker -f compose.prod.yaml up -d --wait db &&
docker compose --env-file .env.docker -f compose.prod.yaml run --rm --no-deps -T migrate </dev/null &&
docker compose --env-file .env.docker -f compose.prod.yaml run --rm --no-deps -T migrate pnpm db:seed </dev/null &&
docker compose --env-file .env.docker -f compose.prod.yaml up -d --no-deps --no-build --wait app
docker compose --env-file .env.docker -f compose.prod.yaml ps -a
```

执行顺序为：从 Docker Hub 拉取应用和数据库镜像 → PostgreSQL 健康 → 迁移 → 初始化管理员 → 启动应用。`&&` 在任一步失败时停止。`db:seed` 仅首次初始化管理员，升级时无需再执行，不覆盖已有密码；镜像构建和应用启动不会自动生成账号或演示数据。

本机访问 <http://localhost:3218/login>。应用默认仅监听 `127.0.0.1:3218`，数据库不向宿主机发布端口，数据保存在 `survey_pgdata` 命名卷中。正式对外服务需配置 HTTPS 反向代理；停止服务时保留数据卷。部署 `/surveys` 时选择 `docker.io/jojoshine/qingwen:latest-surveys`，路径前缀在构建时写入，不能通过运行时变量修改。

### 可选：连接已有 PostgreSQL

已有数据库时改用 [compose.external-db.yaml](compose.external-db.yaml) 和 [.env.external-db.example](.env.external-db.example)，填写 `DATABASE_URL`，按[已有数据库步骤](docs/DEPLOYMENT.md#2-可选连接已有-postgresql)执行。这一路径仍从 Docker Hub 拉取轻问镜像，但不启动数据库容器。当前 `tbtparent.me` 服务器使用此方案，继续保留已有的 `qingwen` 库。

本地源码开发使用 `.env` 和 `compose.yaml`，后者只启动开发数据库。这三个 Compose 文件分别独立使用，不合并运行。

实际发布链路：**提交 main → GitHub CI 检查与测试 → 构建并验证统一业务镜像及配套 PostgreSQL → 发布 Docker Hub，同时同步 GHCR → 用户拉取镜像 → 迁移并启动**。Docker Hub 是面向用户的默认下载渠道，GHCR 保留为镜像副本。发布凭据配置、固定版本、Nginx、升级与备份见[部署文档](docs/DEPLOYMENT.md)。推送 GitHub 不会自动更新服务器。

## 本地开发

需要 Node.js 22.12+、pnpm 10.26.0，以及 PostgreSQL（本地配套容器为 17）。此路径是**本机运行应用、Docker 只运行数据库**，不拉取已发布的应用镜像。

```sh
git clone https://github.com/JojoShine/qingwen.git
cd qingwen
corepack enable
corepack prepare pnpm@10.26.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

编辑 `.env`，设置至少 8 位的 `ADMIN_PASSWORD`；默认 `DATABASE_URL` 已对应本地数据库容器的 `localhost:5436/survey`。如使用已有数据库，修改连接地址并跳过数据库容器启动。没有 `corepack` 时，可用 `npm install --global pnpm@10.26.0` 安装相同版本。

```sh
# compose.yaml 仅用于本地开发数据库，与生产配置分开。
docker compose -p qingwen-survey -f compose.yaml up -d --wait db
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

访问 <http://localhost:3218/login>，使用 `.env` 中配置的管理员账号和密码登录，没有通用默认密码。`db:generate` 生成 Prisma 客户端，`db:migrate` 建表或升级表结构，`db:seed` 创建管理员；`pnpm dev` 不会替你执行这三步。可选执行 `pnpm db:demo` 生成五份标有【示例】的问卷及示例答卷；该命令幂等，不覆盖自行创建的问卷，也不会创建体验用户。开发数据库默认密码只供本地使用。

本地运行正式构建时，先停止开发服务器，再执行 `pnpm build && pnpm start`；源码生产部署及 systemd 步骤见[部署文档](docs/DEPLOYMENT.md#三源码部署)。

## 使用流程

1. 管理员在“用户管理”创建普通账号，或直接创建自己的问卷。
2. 新建问卷，选择移动端或 PC；添加题目、分类、规则并拖拽排序。
3. 在“外观”配置背景、Banner 和品牌文案，在“收集设置”配置时间与次数。
4. 保存并预览试填。确认后发布，通过链接或二维码收集答卷。
5. 在“查看结果”中统计、筛选、查看答卷和导出 CSV，必要时结束或恢复收集。

分享链接默认跟随当前浏览器地址，自动保留 HTTP/HTTPS、域名或 IP 以及端口。手机扫码时，请通过手机可访问的域名或局域网 IP 打开后台再分享；二维码中的 `localhost` 无法从另一台设备访问。需要固定分享地址时可选填 `APP_URL`（只填 origin，不带路径），优先于自动获取；`/surveys` 等构建路径前缀会自动附加。已有部署若设置过 `APP_URL`，清空或删除并重启应用即可启用自动获取。

## 收集规则说明

- 收集份数与次数包含无效答卷；标记无效不会释放配额。统计排除无效答卷，CSV 遵循当前筛选条件并包含有效状态。
- 浏览器次数通过 HttpOnly Cookie 识别，清除 Cookie 或更换设备会成为新标识。
- IP 限制需可信反向代理覆盖单值 IP 请求头，并设置 `TRUSTED_CLIENT_IP_HEADER`；默认不信任客户端转发头。共享网络可能共用 IP。具体配置见部署文档。
- 条件显示支持前序单选/多选/下拉题的单个选项，可级联；隐藏题不校验、不提交、不入库。
- 单选、多选的“其他”默认多行输入；排序题不操作时使用默认顺序。非必填矩阵可全部不填，开始填写后需完成每一行。

## 测试

```sh
pnpm test
pnpm typecheck
pnpm build

# 应用运行后，在独立测试数据库执行集成与浏览器测试。
RUN_INTEGRATION=1 pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

接口与浏览器验收使用 `http://localhost:3218`，请按该端口启动测试应用；浏览器测试读取 `.env` 中的管理员配置并创建临时数据。测试结束会清理自身数据，仍应使用独立测试环境。可选设置 `LAN_TEST_URL` 验证同一局域网匿名填写。

## 项目结构

```text
src/app/              页面、布局与 API Route Handlers
src/components/       问卷库、编辑器、共享题型、填写页与结果页
src/lib/              题型校验、权限、会话、统计与数据库访问
prisma/               Schema、迁移、管理员初始化与示例数据
tests/                接口与浏览器验收
Dockerfile            包含应用、迁移与管理员初始化的统一 runner 镜像
compose.yaml          本地开发 PostgreSQL
compose.external-db.yaml  可选：Docker Hub 镜像连接已有 PostgreSQL
compose.prod.yaml         默认 Docker Hub 安装：应用、迁移与 PostgreSQL
deploy/nginx/         已有域名下 /surveys 的 Nginx 配置示例
docs/DEPLOYMENT.md    Docker / 源码部署与运维
```

## 开源协议

采用 [MIT License](LICENSE)，允许使用、修改、分发及商业使用，请保留版权和许可声明。依赖库与自行上传的图片分别遵循其原有许可证或授权。
