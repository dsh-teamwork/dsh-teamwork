# DSH Teamwork MVP

团队模型、预设和插件目录作为独立增量配置加入 DSH，不覆盖本地用户配置。适配 DSH `0.2.2-rc.1` / Cordis `4.1.0`。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
```

插件包含可发布的 `lib` 输出；修改源码后应重新构建。

## 接入 DSH

安装插件后，在 profile 中配置 `dsh-teamwork` 条目：

```yaml
- id: dsh-teamwork
  config:
    apiEndpoint: http://localhost:3800
    cachePath: /absolute/path/to/private/teamwork-cache.json
    autoSync: true
    syncIntervalMs: 60000
```

包的 `cordis.patch.yml` 使用 `insert` 声明新条目。手动 `--patch` 加载时也需使用 insert，并将 name 指向本仓库 `lib/index.js` 的绝对路径。

在 DSH 原生命令输入框中使用：

- `/team login`：打开输出的浏览器链接，完成邮箱 OTP 登录并确认授权。
- `/team authorize <code>`：兑换两分钟有效的一次性授权码。
- `/team status`：查看登录状态、自动同步开关、团队配置数量、最近同步成功时间和错误。
- `/team sync`：拉取团队模型、预设和插件目录。
- `/team list`：查看配置 ID。
- `/team info [id]`：查看当前会话或指定预设的说明、版本、来源、提示词和工具状态。
- `/team new <id>`：用最新团队预设创建新会话，在 DSH 会话列表打开；不复制旧历史、不启动任务。
- `/team use <id>`：选择本会话使用的团队模型/预设，不修改本地默认模型。
- `/team install <id>`：查看固定版本插件的安装确认说明。
- `/team install <id> confirm`：通过 DSH 插件管理器先下载为禁用状态，检查配置覆盖和条目冲突后再启用。已有本地插件不会被覆盖或升级；有冲突的新包保持禁用，供用户在本地插件管理器中检查。
- `/team logout`：在本地丢弃插件令牌，并移除团队缓存和注册。平台令牌无法在服务端撤销，但被移出团队的成员在下一次请求时即被拒绝。

凭据只保存在内存，重启需要重新登录。非敏感团队配置缓存以 0600 文件权限保存并原子替换，宿主重启时恢复。缓存路径应位于用户私有目录。网络失败保留现有配置；明确的 401/403 清除团队缓存。

团队提示词作为独立 scoped section 追加，按字面文本处理，不替换本地 persona，也不解释 `{{...}}` 模板。

团队注册 ID 以 `team:<teamId>:<configId>` 命名。插件只释放自己持有的注册，不枚举或删除本地配置。已运行会话可能继续持有旧的 DSH 预设版本；更新后的版本用于新选择或新会话。用户确认安装的插件不会因为退出团队而被自动卸载。

也可以用 `TEAMWORK_URL=... TEAMWORK_CACHE=... pnpm cli` 运行交互式同步客户端。CLI 写入缓存后，需要重新加载 DSH 插件；优先使用宿主中的 `/team` 命令。

## 验证范围

单元测试验证配置隔离、幂等同步、失败保留、缓存恢复、权限失效清理，以及退出时同步/授权请求的并发取消。平台仓库的 `scripts/plugin-smoke.cjs` 验证真实 NextAuth 浏览器授权、Prisma/PostgreSQL 配置获取和插件客户端。

已在真实 DSH web 宿主验证团队预设注册、会话模型选择和 `/team list`。真实模型调用需要本地配置的模型密钥。真实 DSH + 本地 npm 测试仓库已验证固定版本插件下载、校验、加载、确认安装、重复安装保护，以及退出团队后保留用户已安装插件。测试包为无外部依赖的受控 fixture；任意第三方包的兼容性仍由 DSH 管理器检查。


## 真实宿主集成测试

```sh
npm install --prefix /tmp/dsh-test-runtime --no-package-lock @deepseek-ai/dsh@0.2.2-rc.1
DSH_CLI=/tmp/dsh-test-runtime/node_modules/@deepseek-ai/dsh/lib/bin.js pnpm test:host
```

测试启动独立临时 profile 和本地 npm registry，创建并打包两个固定版本 fixture，提供 SHA-512 integrity，经真实 DSH 包管理器下载和加载。测试不会发布包，也不修改现有 DSH profile。成功后清理临时目录；失败时报告诊断目录。宿主日志可能含本地浏览器令牌，请勿公开上传完整日志。

安装确认绑定当前会话和包的精确版本；配置改变后必须重新查看安装说明。固定 OTP 和浏览器授权仍由 platform 仓库提供。原生命令是宿主扩展，因此包声明 `dsh.bundle`，不声明不存在的浏览器客户端 bundle。

测试为隔离的临时 DSH profile 设置 `npm_config_ignore_workspace_root_check=true`，允许 pnpm 9 在该 profile 的 workspace 根目录安装受控包。

## 自动配置同步

默认授权完成后立即同步，并每 60 秒自动刷新团队配置；`autoSync: false` 可关闭这两个自动行为，仍可手动 `/team sync`。`syncIntervalMs` 必须是 10000–86400000 之间的整数毫秒数。每次定时请求结束后才安排下一次，手动与自动请求合并，避免慢网络下堆积请求。

网络或响应格式错误保留已有配置，下次定时重试；401/403 清除团队缓存、注册与内存登录状态，暂停自动请求，需重新登录。重启恢复的缓存不代表已登录，`/team status` 会明确区分。自动同步仅更新配置目录，不自动安装插件，不上传会话。插件卸载时停止定时器，等待当前同步结束后释放团队注册。

## Platform 模型网关

团队模型和预设统一选择 `teamwork-platform` provider，wire model 为团队配置 ID。插件把 DSH 的文本、工具调用和流式输出转换为 OpenAI Chat Completions 请求，发送到 `apiEndpoint/api/v1/llm/chat/completions`。认证使用内存中的 platform 插件会话令牌，不读取本地供应商密钥，也不提供供应商直连降级。

供应商地址和真实 API Key 仅配置在 platform 部署环境。缓存只保存配置描述；未登录时，即使有缓存也无法推理。当前适配器先支持文本和工具调用，模型目录读取团队配置中的 `contextWindow` 和 `maxTokens`。只有缺失字段才使用 32K 上下文、4096 输出的兼容值（确保输出不超过上下文）。管理员可在 platform 查询供应商模型列表并补充未提供的能力值；多模态和其他供应商协议后续补齐。

按已确认的产品边界，现有本地模型继续独立使用；teamwork 管理的模型和预设全部经 platform，不修改本地模型配置或凭据。

## Agent Preset

团队预设复用 DSH 原生 `agentPresets` 注册、挂载、选择及 revision 生命周期。管理员在 platform 配置简介、使用说明、输出要求、团队模型引用、增量提示词以及必需/可选工具名称。说明字段供用户阅读；需要模型执行的要求写入 `systemPrompt`。新预设引用同团队 `kind=model` 的配置 ID，旧版内嵌 provider/model 配置继续兼容，不允许两种方式混用。引用模型删除后，客户端不降级到本地模型，网关也拒绝该请求。

- `/team info` 显示实际挂载版本；`/team info <id>` 预览最新目录配置，工具检查基于当前会话。
- 工具按 DSH 注册名称检查，区分已注册、条件可用、缺失、无法检查。工具已注册不意味着已获得执行授权，运行时仍由宿主处理权限与条件。
- 必需工具缺失/无法检查时，`/team use` 拒绝选择；通过其他原生入口选择的预设，也在每次模型请求前重新检查。可选工具缺失只展示提示。
- DSH 只允许空白会话切换预设。开始第一轮后或执行中，使用 `/team new <id>` 创建新会话；不在原会话静默改提示词、不清空历史。
- 同步更新后，已有 Agent 保留 DSH 原生旧 revision，`/team info` 展示新版本；空白会话再次 `/team use` 可更新。
- 会话通过原生 session projection 记录团队/预设/版本。宿主恢复会话时若重新挂载的版本与记录不一致，阻止继续推理并提示新建会话；当前不保存历史预设定义，不承诺跨重启恢复已删除的旧 revision。上线前没有版本记录的旧会话从首次观察开始记录。
- 预设版本固定不冻结服务端策略：成员权限、模型路由和输出限制仍采用 platform 当前配置。

本地定向宿主检查：`DSH_CLI=/path/to/dsh/lib/bin.js pnpm test:presets`，不调用真实模型，不安装测试插件。

## 工具清单与插件依赖

- `/team tools`：列出当前会话可见的实际工具注册名及条件状态。DSH 工具接口未提供可靠的包归属，来源仅标记为「团队声明来源」或「宿主未提供归属信息」，不猜测运行时归属。已注册不代表已获执行权限。
- `/team plugins`：重新读取宿主插件清单，检查所有团队目录插件；`/team plugins <presetId>` 检查某预设的固定版本依赖。
- 预设的 `pluginDependencies` 是 `{pluginConfigId, version}[]`。目录记录消失或版本变化会提示管理员更新预设，不自动换成新版本。状态检查覆盖未安装、未启用、版本不符、加载失败、待加载/重启、正常和无法确认。
- 目录插件的 `providesTools` 是管理员声明的 DSH 工具注册名称，用于缺失工具的安装指引；实际可用性始终重新读取会话工具服务。
- 依赖未就绪时 `/team use` 拒绝选择；原生入口创建的预设在每次模型请求前也检查。已固定的旧预设依赖不随目录更新自动改写。
- `/team install` 仍需先查看说明再确认。已有插件的启用、升级和错误诊断交给 DSH 本地插件管理器，团队操作不覆盖它们。安装后刷新插件状态和当前预设必需工具；重启提示不会被误报为已就绪。

## 会话与任务操作

- `/team session`：查看原生运行状态、最近任务结果、最近已进入上下文的用户输入摘要、队列数量、模型、预设版本和本地恢复检查。`/team session check` 额外刷新团队配置，验证当前平台访问权限；不启动任务。
- `/team continue <后续指令>`：在空闲且无待处理输入时，检查模型、权限、预设版本、插件和工具，然后使用 DSH `followup` 发送新的用户消息。原有本地模型不要求 platform 登录。恢复已有会话沿用 DSH 原生入口，不覆盖其保存的模型选择。
- `/team cancel`：调用 DSH `cancel({kind:'user'}, {keepInbox:true})`，请求取消当前执行，保留待处理输入。取消是请求，不承诺同步停止；用概览确认状态。文件修改不会回滚，历史不会删除。
- `/team retry`：仅为失败、被阻止、取消、输出截断或意外中断的任务提供确认说明；`/team retry confirm` 在两分钟内提交一次恢复指令，要求先检查已有结果再继续。不是重放工具调用，也不是完全复现原请求；仍可能产生新操作，需要用户明确确认。

继续/重试不插队：如果有队列或引导输入，先在 DSH 原生界面检查处理。确认会在会话、模型、团队配置或登录身份变更后失效。权限检查期间取消不会在检查返回后启动任务；同时提交的请求也不会重复派发。

任务摘要和结果使用原生 session projection，在本地会话恢复时重建；不向 platform 上传会话。错误提示区分凭据、限流、网络和工具条件，不复制上游原始错误正文。恢复检查是启动前检查，不替代 platform 对实际每次请求的实时权限校验。
