# DSH Teamwork MVP

团队模型、预设和插件目录作为独立增量配置加入 DSH，不覆盖本地用户配置。适配 DSH `0.2.2-rc.1` / Cordis `4.1.0`。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
```

插件包含可发布的 `lib` 输出；修改源码后应重新构建。`pnpm build` 同时编译宿主端（`src/` → `lib/`）和浏览器端（`src/web/` → `lib/web/client.js`）。

仓库是 pnpm workspace：`ui/` 是共用组件库 `@dsh-teamwork/ui`，供本插件的面板使用，将来给 web 端和其他 DSH 插件共用，之后拆到独立仓库 `dsh-teamwork/dsh-teamwork-ui`。它的约定见 [`ui/README.md`](ui/README.md)。

## 接入 DSH

安装插件后，默认连接官方服务 `https://www.dshteamwork.com`，不用任何配置。自建团队可以在 Teamwork 面板的登录页更改服务器地址（例如本地开发的 `http://localhost:3800`），选择保存在配置缓存旁的 `<缓存名>.server.json`；也可以在 profile 的 `dsh-teamwork` 条目里改默认值：

```yaml
- id: dsh-teamwork
  config:
    apiEndpoint: https://teamwork.example.com   # 默认 https://www.dshteamwork.com
    cachePath: /absolute/path/to/private/teamwork-cache.json
    autoSync: true
    syncIntervalMs: 60000
```

**手机接入（托管服务）**：登录后，插件会向服务器询问 `GET /api/relay`。服务器提供中转时，插件主动连出一条 WebSocket，并用登录得到的令牌表明身份。服务器那边会把这台电脑登记为你的主机，面板顶部显示“手机可连接”。DSH Teamwork App 之后就能经由这条连接操作这台电脑上的 DSH。自建的社区版服务器不提供中转，插件也就不会连出。这台电脑的标识保存在缓存旁的 `<缓存名>.host.json`；退出登录会断开连接。

包的 `cordis.patch.yml` 使用 `insert` 声明新条目。手动 `--patch` 加载时也需使用 insert，并将 name 指向本仓库 `lib/index.js` 的绝对路径。

## 侧栏面板

DSH web 和桌面端的左侧栏有 Teamwork 入口，打开后是主区域的 Teamwork 面板：

- 未登录：三步完成登录（在浏览器中登录 → 复制授权码 → 粘贴授权）。页面底部显示当前服务器，可以改成自建或本地地址，或恢复默认；服务器只接受 https，本机地址可以用 http。更改服务器会退出当前登录并清除旧服务器的团队配置。
- 顶栏：团队名和身份、当前服务器、同步状态、立即同步、退出；管理员多一个跳到网页 `/team` 的"管理团队"。管理团队只在网页完成。
- 预设：每个预设的模型、就绪状态（必需工具、依赖插件），"用于当前会话"（仅限尚未开始对话的会话）和"新建会话"。
- 团队模型：用于当前会话，只改本会话，不改本地默认设置。
- 团队插件：固定版本的状态；安装前在面板里确认，确认绑定当时的精确版本。

面板通过宿主端的 `/api/teamwork/*` 路由（`src/panel.ts`）工作，与 `/teamwork` 命令调用同一组函数；平台令牌只留在宿主进程里，不会发到浏览器。DSH 只允许本机所有者访问这些路由。会话恢复相关的子命令（`session`、`continue`、`cancel`、`retry`）只保留为命令。

## 命令

在 DSH 原生命令输入框中使用：

- `/teamwork login`：打开输出的浏览器链接，用 Google 或邮件验证码登录并确认授权。
- `/teamwork authorize <code>`：兑换两分钟有效的一次性授权码。
- `/teamwork status`：查看登录状态、自动同步开关、团队配置数量、最近同步成功时间和错误。
- `/teamwork sync`：拉取团队模型、预设和插件目录。
- `/teamwork list`：查看配置 ID。
- `/teamwork info [id]`：查看当前会话或指定预设的说明、版本、来源、提示词和工具状态。
- `/teamwork new <id>`：用最新团队预设创建新会话，在 DSH 会话列表打开；不复制旧历史、不启动任务。
- `/teamwork use <id>`：选择本会话使用的团队模型/预设，不修改本地默认模型。
- `/teamwork install <id>`：查看固定版本插件的安装确认说明。
- `/teamwork install <id> confirm`：通过 DSH 插件管理器先下载为禁用状态，检查配置覆盖和条目冲突后再启用。已有本地插件不会被覆盖或升级；有冲突的新包保持禁用，供用户在本地插件管理器中检查。
- `/teamwork logout`：在本地丢弃插件令牌，并移除团队缓存和注册。平台令牌无法在服务端撤销，但被移出团队的成员在下一次请求时即被拒绝。

凭据只保存在内存，重启需要重新登录。非敏感团队配置缓存以 0600 文件权限保存并原子替换，宿主重启时恢复。缓存路径应位于用户私有目录。网络失败保留现有配置；明确的 401/403 清除团队缓存。

团队提示词作为独立 scoped section 追加，按字面文本处理，不替换本地 persona，也不解释 `{{...}}` 模板。

团队注册 ID 以 `team:<teamId>:<configId>` 命名。插件只释放自己持有的注册，不枚举或删除本地配置。已运行会话可能继续持有旧的 DSH 预设版本；更新后的版本用于新选择或新会话。用户确认安装的插件不会因为退出团队而被自动卸载。

也可以用 `TEAMWORK_URL=... TEAMWORK_CACHE=... pnpm cli` 运行交互式同步客户端。CLI 写入缓存后，需要重新加载 DSH 插件；优先使用宿主中的 `/teamwork` 命令。

## 验证范围

单元测试验证配置隔离、幂等同步、失败保留、缓存恢复、权限失效清理，以及退出时同步/授权请求的并发取消。授权码换取令牌的服务端逻辑由 platform 仓库的 `packages/shared/src/server/auth/nextauth/__tests__/tokens.test.ts` 覆盖。

已在真实 DSH web 宿主验证团队预设注册、会话模型选择和 `/teamwork list`。真实模型调用需要本地配置的模型密钥。真实 DSH + 本地 npm 测试仓库已验证固定版本插件下载、校验、加载、确认安装、重复安装保护，以及退出团队后保留用户已安装插件。测试包为无外部依赖的受控 fixture；任意第三方包的兼容性仍由 DSH 管理器检查。


## 真实宿主集成测试

```sh
npm install --prefix /tmp/dsh-test-runtime --no-package-lock @deepseek-ai/dsh@0.2.2-rc.1
DSH_CLI=/tmp/dsh-test-runtime/node_modules/@deepseek-ai/dsh/lib/bin.js pnpm test:host
```

测试启动独立临时 profile 和本地 npm registry，创建并打包两个固定版本 fixture，提供 SHA-512 integrity，经真实 DSH 包管理器下载和加载。测试不会发布包，也不修改现有 DSH profile。成功后清理临时目录；失败时报告诊断目录。宿主日志可能含本地浏览器令牌，请勿公开上传完整日志。

安装确认绑定当前会话和包的精确版本；配置改变后必须重新查看安装说明。浏览器登录（Google 或邮件验证码）和授权仍由 platform 仓库提供。包声明 `dsh.bundle`（宿主端插件和原生命令）和 `dsh.client`（浏览器端面板，`exports["./client"]` 指向 `lib/web/client.js`）。

测试为隔离的临时 DSH profile 设置 `npm_config_ignore_workspace_root_check=true`，允许 pnpm 9 在该 profile 的 workspace 根目录安装受控包。

## 自动配置同步

默认授权完成后立即同步，并每 60 秒自动刷新团队配置；`autoSync: false` 可关闭这两个自动行为，仍可手动 `/teamwork sync`。`syncIntervalMs` 必须是 10000–86400000 之间的整数毫秒数。每次定时请求结束后才安排下一次，手动与自动请求合并，避免慢网络下堆积请求。

网络或响应格式错误保留已有配置，下次定时重试；401/403 清除团队缓存、注册与内存登录状态，暂停自动请求，需重新登录。重启恢复的缓存不代表已登录，`/teamwork status` 会明确区分。自动同步仅更新配置目录，不自动安装插件，不上传会话。插件卸载时停止定时器，等待当前同步结束后释放团队注册。

## Platform 模型网关

团队模型和预设统一选择 `teamwork-platform` provider，wire model 为团队配置 ID。插件把 DSH 的文本、工具调用和流式输出转换为 OpenAI Chat Completions 请求，发送到当前服务器的 `/api/llm/chat/completions`。认证使用内存中的 platform 插件会话令牌，不读取本地供应商密钥，也不提供供应商直连降级。

供应商地址和真实 API Key 仅配置在 platform 部署环境。缓存只保存配置描述；未登录时，即使有缓存也无法推理。当前适配器先支持文本和工具调用，模型目录读取团队配置中的 `contextWindow` 和 `maxTokens`。只有缺失字段才使用 32K 上下文、4096 输出的兼容值（确保输出不超过上下文）。管理员可在 platform 查询供应商模型列表并补充未提供的能力值；多模态和其他供应商协议后续补齐。

按已确认的产品边界，现有本地模型继续独立使用；teamwork 管理的模型和预设全部经 platform，不修改本地模型配置或凭据。

## Agent Preset

团队预设复用 DSH 原生 `agentPresets` 注册、挂载、选择及 revision 生命周期。管理员在 platform 配置简介、使用说明、输出要求、团队模型引用、增量提示词以及必需/可选工具名称。说明字段供用户阅读；需要模型执行的要求写入 `systemPrompt`。新预设引用同团队 `kind=model` 的配置 ID，旧版内嵌 provider/model 配置继续兼容，不允许两种方式混用。引用模型删除后，客户端不降级到本地模型，网关也拒绝该请求。

- `/teamwork info` 显示实际挂载版本；`/teamwork info <id>` 预览最新目录配置，工具检查基于当前会话。
- 工具按 DSH 注册名称检查，区分已注册、条件可用、缺失、无法检查。工具已注册不意味着已获得执行授权，运行时仍由宿主处理权限与条件。
- 必需工具缺失/无法检查时，`/teamwork use` 拒绝选择；通过其他原生入口选择的预设，也在每次模型请求前重新检查。可选工具缺失只展示提示。
- DSH 只允许空白会话切换预设。开始第一轮后或执行中，使用 `/teamwork new <id>` 创建新会话；不在原会话静默改提示词、不清空历史。
- 同步更新后，已有 Agent 保留 DSH 原生旧 revision，`/teamwork info` 展示新版本；空白会话再次 `/teamwork use` 可更新。
- 每个会话开始时的团队/预设/版本记录在配置缓存旁的 `<缓存名>.sessions.json`（0600，原子替换），不写进会话日志：DSH 拒绝重新打开日志里含有它不认识的事件类型的会话，而第三方插件写不了它接受的可忽略记录。宿主恢复会话时若重新挂载的版本与记录不一致，阻止继续推理并提示新建会话；当前不保存历史预设定义，不承诺跨重启恢复已删除的旧 revision。没有记录的会话（包括分叉出的新会话）从首次请求开始记录。
- 预设版本固定不冻结服务端策略：成员权限、模型路由和输出限制仍采用 platform 当前配置。

本地定向宿主检查：`DSH_CLI=/path/to/dsh/lib/bin.js pnpm test:presets`，不调用真实模型，不安装测试插件。

## 工具清单与插件依赖

- `/teamwork tools`：列出当前会话可见的实际工具注册名及条件状态。DSH 工具接口未提供可靠的包归属，来源仅标记为「团队声明来源」或「宿主未提供归属信息」，不猜测运行时归属。已注册不代表已获执行权限。
- `/teamwork plugins`：重新读取宿主插件清单，检查所有团队目录插件；`/teamwork plugins <presetId>` 检查某预设的固定版本依赖。
- 预设的 `pluginDependencies` 是 `{pluginConfigId, version}[]`。目录记录消失或版本变化会提示管理员更新预设，不自动换成新版本。状态检查覆盖未安装、未启用、版本不符、加载失败、待加载/重启、正常和无法确认。
- 目录插件的 `providesTools` 是管理员声明的 DSH 工具注册名称，用于缺失工具的安装指引；实际可用性始终重新读取会话工具服务。
- 依赖未就绪时 `/teamwork use` 拒绝选择；原生入口创建的预设在每次模型请求前也检查。已固定的旧预设依赖不随目录更新自动改写。
- `/teamwork install` 仍需先查看说明再确认。已有插件的启用、升级和错误诊断交给 DSH 本地插件管理器，团队操作不覆盖它们。安装后刷新插件状态和当前预设必需工具；重启提示不会被误报为已就绪。

## 会话与任务操作

- `/teamwork session`：查看原生运行状态、最近任务结果、最近已进入上下文的用户输入摘要、队列数量、模型、预设版本和本地恢复检查。`/teamwork session check` 额外刷新团队配置，验证当前平台访问权限；不启动任务。
- `/teamwork continue <后续指令>`：在空闲且无待处理输入时，检查模型、权限、预设版本、插件和工具，然后使用 DSH `followup` 发送新的用户消息。原有本地模型不要求 platform 登录。恢复已有会话沿用 DSH 原生入口，不覆盖其保存的模型选择。
- `/teamwork cancel`：调用 DSH `cancel({kind:'user'}, {keepInbox:true})`，请求取消当前执行，保留待处理输入。取消是请求，不承诺同步停止；用概览确认状态。文件修改不会回滚，历史不会删除。
- `/teamwork retry`：仅为失败、被阻止、取消、输出截断或意外中断的任务提供确认说明；`/teamwork retry confirm` 在两分钟内提交一次恢复指令，要求先检查已有结果再继续。不是重放工具调用，也不是完全复现原请求；仍可能产生新操作，需要用户明确确认。

继续/重试不插队：如果有队列或引导输入，先在 DSH 原生界面检查处理。确认会在会话、模型、团队配置或登录身份变更后失效。权限检查期间取消不会在检查返回后启动任务；同时提交的请求也不会重复派发。

任务摘要和结果使用原生 session projection，在本地会话恢复时重建；不向 platform 上传会话。错误提示区分凭据、限流、网络和工具条件，不复制上游原始错误正文。恢复检查是启动前检查，不替代 platform 对实际每次请求的实时权限校验。

## 发布

发布到 npm 用 trusted publishing（OIDC），不存任何 npm 令牌，做法和 `motionhub-dev/motions` 相同：

1. 把 `package.json` 的 `version` 改成新版本，合进 `main`。
2. 在 `main` 的那个提交上打 `v<version>` 并推送。`.github/workflows/publish.yaml` 分两步：`package` 不带 OIDC 权限，检查 tag 指向 `main` 的历史、和版本号一致、提交的 `lib/` 与源码构建一致，再测试并打包；`stage` 在受保护的 `npm-release` 环境里，核对拿到的正是打出来的那个包（SHA-256），关掉生命周期脚本后执行 `npm stage publish`。
3. 维护者用 `npm stage list` 找到这次暂存，再用 `npm stage approve <stage-id>`（需要 2FA）正式发布。

一次性设置：GitHub 仓库里建 `npm-release` 环境（限定维护者审批、只允许受保护的 tag）；npm 上给 `@dsh-teamwork/dsh-teamwork` 配置 Trusted Publisher，指向本仓库、`publish.yaml` 和 `npm-release` 环境。仓库变量 `PUBLISHING=off` 可暂停暂存。

## 许可证

Apache License 2.0（`LICENSE`）。名称“DSH Teamwork”和鲸鱼标志不随代码授权（`NOTICE`），派生项目需使用自己的名称和标志。
