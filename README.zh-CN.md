<p align="center"><img src="https://raw.githubusercontent.com/dsh-teamwork/dsh-teamwork/main/assets/readme/icon-256.png" width="72" height="72" alt="DSH Teamwork"></p>

# DSH Teamwork

[English](README.md) · 简体中文

[![npm](https://img.shields.io/npm/v/@dsh-teamwork/dsh-teamwork)](https://www.npmjs.com/package/@dsh-teamwork/dsh-teamwork)
[![CI](https://github.com/dsh-teamwork/dsh-teamwork/actions/workflows/ci.yml/badge.svg)](https://github.com/dsh-teamwork/dsh-teamwork/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**把团队共享模型、预设和审批后的插件带入 DSH，通过团队助理完成日常协作与管理。**

将 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 连接到
[DSH Teamwork](https://www.dshteamwork.com) 或团队自建服务器。团队配置发布一次，成员同步到各自的 DSH；团队助理可在对话中协助分享资源、查看使用量和管理团队。

![真实 DSH 宿主中的 Teamwork 面板，使用本地演示团队](https://raw.githubusercontent.com/dsh-teamwork/dsh-teamwork/main/assets/readme/teamwork-panel.png)

插件面板目前使用简体中文；网页控制台支持英文和简体中文。截图均来自本地演示团队。

## 可以做什么

| 能力 | 为团队带来的功能 |
| --- | --- |
| 共享模型与预设 | 同步团队资源，使用 DSH 原生智能体预设创建会话。 |
| 团队助理 | 查询配置、个人使用量和适用预算；管理员可执行获授权的团队管理操作。 |
| 分享与审批 | 准备本地插件包，提交新插件、预设及更新，交由管理员审批。 |
| 版本历史 | 查看发布记录、导出资源备份，准备经审批的历史恢复。 |
| 团队治理 | 通过连接的团队服务管理配置、预算和审批。 |
| 手机连接 | 配合托管服务中转和匹配的 Teamwork App，将手机在线配对到正在运行的 DSH 电脑。 |

资源在所选团队内部分享。发布后团队成员可以使用；发布不会自动在成员电脑上安装代码。

## 安装

**DSH 桌面版：**在应用中打开 **Plugins → Add plugin（插件 → 添加插件）**，输入以下包名，安装并启用。若提示重启，按提示操作。

```text
@dsh-teamwork/dsh-teamwork
```

桌面版由应用管理自己的 profile。安装和更新都从应用内操作；CLI 中的 `web` 属于另一个 profile。

**DSH CLI／网页版：**安装到实际使用的 profile：

```sh
dsh plugin --profile web add @dsh-teamwork/dsh-teamwork
dsh web
```

如果 web 进程已经启动，遵循宿主的重新加载／重启提示。使用自定义 profile 时，将 `web` 换成对应名称。

| 要求 | 支持范围 |
| --- | --- |
| 声明的 DSH 兼容范围 | `>=0.2.2-rc.1 <0.3.0-0` |
| CI 宿主版本 | `0.2.2-rc.1`、`0.2.2-rc.2`、`0.2.2-rc.3` |
| Node.js | 以 DSH 宿主要求为准；当前 RC 系列要求 Node.js 24.9+。桌面版提供自己的运行时。 |

CI 使用 Linux 和 pnpm 9.15.9。其他宿主、包管理器组合仍遵循各自的构建脚本及安装策略，详见[安装与更新排查](docs/zh-CN/guide.md#安装与更新)。

## 开始使用

1. 在 DSH 侧栏打开 **Teamwork**，选择“在浏览器中登录”。
2. 在团队服务中登录并授权这台 DSH。若本机回传未完成，粘贴网页显示的备用授权行。
3. 选择团队并刷新资源。如果还没有团队成员身份，先在网页控制台创建或加入团队。
4. 选择团队助理预设并新建会话。新团队会获得以团队名命名的助理；已有团队不会被自动补建。

可以先问：

> 同步团队配置，并查看我本月的使用量。

助理可以继承当前会话的本地模型。它需要一个可用模型才能执行任务；继承模型不等于建立团队模型网关路由。

## 成员与管理员

| 成员 | 团队管理员 |
| --- | --- |
| 查看共享资源、自己的使用量及适用预算。 | 查看获授权的团队使用量，管理团队、成员和供应商预算。 |
| 提交预设和本地插件包，包括更新。 | 审核冻结后的提交内容，发布或拒绝。 |
| 使用已发布预设，明确确认后安装插件。 | 管理团队配置，准备历史版本恢复。 |

修改操作使用 DSH 的真实审批流程，服务端会重新检查权限。供应商密钥和账号密码通过网页安全表单输入。
[使用指南](docs/zh-CN/guide.md)说明了命令、配置、手机连接，以及“已提交、已发布、已同步、已安装”的区别。

![管理员审核演示预设提交；网页可切换中文](https://raw.githubusercontent.com/dsh-teamwork/dsh-teamwork/main/assets/readme/review-and-publish.png)

## 服务与数据

- 默认连接 `https://www.dshteamwork.com`。可在 Teamwork 登录页切换到[自建社区版服务器](https://github.com/dsh-teamwork/dsh-teamwork-platform)。
- 团队模型请求经过所选服务器。供应商密钥保留在服务端；提示词和模型上下文经过其模型网关。
- 插件登录令牌只保留在宿主内存中，重启后需要重新登录。配置缓存不能代替登录。
- 手机连接需要托管中转、匹配的 App 和在线的 web／桌面宿主；社区版不提供该中转。配对允许访问账号在这台 DSH 上有权限的个人与各团队会话。

[数据、手机配对和恢复说明](docs/zh-CN/guide.md#数据与手机连接)列出了本地信息、发往服务器的信息和配对通道的保护范围。

## 帮助与开发

- [中文使用指南](docs/zh-CN/guide.md) · [English guide](docs/en/guide.md)
- [开发参考](docs/development.md)（英文）：构建、真实宿主检查、运行机制及发布。
- [提交问题](https://github.com/dsh-teamwork/dsh-teamwork/issues)：附上 DSH／插件版本、系统、profile 类型及脱敏错误。
- [Teamwork 服务](https://www.dshteamwork.com) · [社区版服务器](https://github.com/dsh-teamwork/dsh-teamwork-platform)

## 许可证

[Apache License 2.0](LICENSE)。DSH Teamwork 名称和鲸鱼标识另受 [NOTICE](NOTICE) 约束，分叉项目应使用自己的品牌。
