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
    apiEndpoint: http://localhost:3000
    cachePath: /absolute/path/to/private/teamwork-cache.json
```

包的 `cordis.patch.yml` 使用 `insert` 声明新条目。手动 `--patch` 加载时也需使用 insert，并将 name 指向本仓库 `lib/index.js` 的绝对路径。

在 DSH 原生命令输入框中使用：

- `/team login`：打开输出的浏览器链接，完成邮箱 OTP 登录并确认授权。
- `/team authorize <code>`：兑换两分钟有效的一次性授权码。
- `/team sync`：拉取团队模型、预设和插件目录。
- `/team list`：查看配置 ID。
- `/team use <id>`：选择本会话使用的团队模型/预设，不修改本地默认模型。
- `/team install <id>`：查看固定版本插件的安装确认说明。
- `/team install <id> confirm`：通过 DSH 插件管理器先下载为禁用状态，检查配置覆盖和条目冲突后再启用。已有本地插件不会被覆盖或升级；有冲突的新包保持禁用，供用户在本地插件管理器中检查。
- `/team logout`：撤销插件会话并移除团队缓存和注册。

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
