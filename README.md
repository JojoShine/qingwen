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
| 部署 | 多阶段 Docker 镜像、Next.js standalone、单镜像内置 PostgreSQL、自动迁移与初始化、Docker Compose |

不需要 Redis、对象存储或独立后端服务。普通账号由管理员创建，当前不提供公开注册、多租户、多人协作、复杂跳题、考试计分或答题附件上传。

## Docker 快速部署

[Docker Hub 镜像 `jojoshine/qingwen`](https://hub.docker.com/r/jojoshine/qingwen) 内置 **轻问应用、PostgreSQL 17、迁移与管理员初始化工具**。一个镜像、一个容器即可运行，无需预装或另起数据库服务，无需源码构建。首次启动自动建库、迁移并创建管理员；后续启动只应用新增迁移，不覆盖已有管理员密码。

数据库数据保存在独立持久化卷中，不随容器删除而丢失。迁移到另一台机器时，带上环境配置和数据库备份即可恢复用户、问卷、答卷及 Banner。

需要 Docker Engine / Docker Desktop 与 Docker Compose v2，当前发布镜像支持 Linux amd64。Docker 安装见 [Linux Docker Engine](https://docs.docker.com/engine/install/) 或 [Docker Desktop](https://docs.docker.com/desktop/)。先确认 `docker info` 和 `docker compose version` 均成功。

### 安装与启动

只下载 [compose.prod.yaml](compose.prod.yaml) 和 [.env.docker.example](.env.docker.example)：

```sh
sudo mkdir -p /opt/qingwen
sudo chown "$(id -u):$(id -g)" /opt/qingwen
cd /opt/qingwen
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/compose.prod.yaml -o compose.prod.yaml
curl -fsSL https://raw.githubusercontent.com/JojoShine/qingwen/main/.env.docker.example -o .env.docker
chmod 600 .env.docker
```

编辑 `.env.docker`，填写 `POSTGRES_PASSWORD`（可用 `openssl rand -hex 24` 生成）和至少 8 位的 `ADMIN_PASSWORD`。默认 `QINGWEN_IMAGE=docker.io/jojoshine/qingwen:latest`，`APP_URL` 留空即可自动获取当前访问地址。不要设置 `DATABASE_URL`，容器自动连接内置数据库。

```sh
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml pull &&
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml up -d --no-build --wait
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml ps
docker compose -p qingwen --env-file .env.docker -f compose.prod.yaml logs --tail=100 app
```

本机访问 <http://localhost:3218/login>，使用配置的管理员账号和密码。默认仅监听 `127.0.0.1:3218`，正式对外服务需配置 HTTPS 反向代理。内置 PostgreSQL 仅监听容器内部 loopback；数据挂载到 Compose 的 `qingwen_data` 卷，固定项目名 `qingwen` 后实际卷名为 `qingwen_qingwen_data`。停止服务使用 `down`，保留数据卷，不使用 `down -v`。

部署 `/surveys` 时选择 `docker.io/jojoshine/qingwen:latest-surveys`，路径前缀在构建时写入，不能通过运行时变量修改。公开安装镜像默认从 Docker Hub 获取，GHCR 保留同版本副本。GitHub CI 验证单容器启动、重建保留数据和备份恢复后才发布镜像；推送 GitHub 不会自动更新服务器。

**已有部署升级需注意**：旧版独立 PostgreSQL 容器或宿主机数据库的数据不会自动搬入新卷。先备份，再按[迁入内置数据库](docs/DEPLOYMENT.md#四迁入内置数据库)步骤导入。正式环境已完成这一迁移；宿主机旧库仅保留作回退依据，不再承担应用读写。旧外部数据库配置只用于尚未迁移的历史部署。

### 当前正式环境

[正式入口](https://tbtparent.me/surveys/login) 已于 **2026-10-18（北京时间）** 切换为内置 PostgreSQL 的单容器部署，目录为 `/opt/qingwen`，实际使用 `compose.prod.yaml` 与 `.env.docker`。当前固定版本为 `56260bca01fa839109d75e4e539170b6eeb1ce61` 的 `-surveys` 镜像；原账号、问卷和答卷已迁移并逐表核对。`/surveys` 路径、`127.0.0.1:3218` 端口及原独立 Nginx 配置保持不变。

Docker Hub 是默认镜像来源。本次正式切换因直连超时，经确认使用与 Docker Hub 摘要一致的 GHCR 副本传输；部署配置仍固定为 Docker Hub 发布标签。后续文档提交或镜像发布不会自动更新正式服务器，实际运行版本以服务器 `release.json` 和容器状态为准。

日常升级：先[备份数据库与配置](docs/DEPLOYMENT.md#备份)，固定目标版本，再拉取并重建同一容器；入口自动迁移，不再单独执行迁移或初始化命令。恢复：先停止应用，再通过同一镜像的 `app restore` 导入备份，成功后启动。完整的[安装、备份、恢复与升级流程](docs/DEPLOYMENT.md#五备份换机恢复与升级)包含命令、校验及回退说明。

安装、备份、换机恢复、固定版本和独立 Nginx 配置见[部署文档](docs/DEPLOYMENT.md)。本地源码开发仍使用 `.env` 和 `compose.yaml`，后者只启动开发数据库，与用户的单容器安装分开。

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
Dockerfile            内置应用、PostgreSQL、迁移与管理员初始化的 runner 镜像
compose.yaml          本地开发 PostgreSQL
compose.external-db.yaml  旧外部数据库部署的过渡兼容配置
compose.prod.yaml         单容器部署与持久化数据库卷
deploy/docker/        单容器启动、进程退出与备份恢复入口
deploy/nginx/         已有域名下 /surveys 的 Nginx 配置示例
docs/DEPLOYMENT.md    Docker / 源码部署与运维
```

## 开源协议

采用 [MIT License](LICENSE)，允许使用、修改、分发及商业使用，请保留版权和许可声明。依赖库与自行上传的图片分别遵循其原有许可证或授权。
