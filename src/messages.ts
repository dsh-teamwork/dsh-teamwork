/**
 * The host's errors and results that the Teamwork panel can show. Everything
 * the host prints is English: `/teamwork` output, logs, the sign-in callback
 * page. Only while it answers one of the panel's requests (`speaking`) does it
 * word these in the panel's language: the Teamwork account's once the host has
 * read the profile, the system's before that (`setLocale`, `src/index.ts`).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { pickLocale, translator, type Locale } from './locale.js';

const en = {
  'request.invalid': 'The request could not be read.',
  'request.failed': 'The action did not complete.',
  'request.missing': '{field} is missing.',
  'field.team': 'Team',
  'field.code': 'Authorization code',
  'field.server': 'Server address',
  'field.session': 'Session',
  'field.config': 'Configuration ID',
  'field.plugin': 'Plugin ID',
  'field.version': 'Version',
  'field.device': 'Device',
  'profile.nameTooLong': 'A display name can be at most 80 characters.',
  'profile.badLocale': 'Choose English or Simplified Chinese.',
  'server.invalid': 'That is not a server address. Enter the full address, for example https://www.dshteamwork.com.',
  'server.https': 'A server address must use https; only this computer (localhost) may use http.',
  'server.extra': 'A server address cannot contain a query, a fragment or account details.',
  'auth.signedOut': 'Sign in to Teamwork first.',
  'auth.hostManaged': 'This DSH is signed in to Teamwork by its host, so it cannot sign in or out here.',
  'auth.changed': 'The signed-in account changed. Try again.',
  'summary.team': 'Sync first, and choose a team you are in.',
  'summary.unavailable': 'The team summary is unavailable right now.',
  'phone.notFound': 'This device is no longer paired.',
  'phone.relayBusy': 'The relay cannot handle this right now. Try again in a moment.',
  'phone.relayOff': 'Not connected to the relay, so phones cannot be managed.',
  'use.pick': 'Choose a team model or preset ID.',
  'use.modelGone': 'The team model this preset uses is no longer available. Ask an admin.',
  'model.noContextWindow': 'The team model “{name}” has no context window (contextWindow) configured, so it cannot be used yet. Ask a team admin to set it in the console, then sync again.',
  'use.missingTools': 'Required tools are missing: {tools}. Install or enable them in the local plugin manager first.',
  'use.started': 'This session has started, and DSH does not switch presets after that. Start a new session with this preset.',
  'use.notLoaded': 'This session is not loaded yet. Open it or send a message in it, then try again.',
  'use.done': 'This session now uses {name}. Your local defaults are unchanged.',
  'install.pick': 'Choose a team plugin ID.',
  'install.pinChanged': 'The team changed this plugin’s version. Confirm the install again.',
  'install.noManager': 'This DSH has no plugin manager.',
  'install.exists': 'This plugin is already installed. Manage it in the local plugin manager; team sync never overwrites it.',
  'install.changed': 'The account or the plugin changed during the install. Confirm it again.',
  'install.incomplete': 'The install did not finish ({reason}). Check the diagnostics in the local plugin manager, then check again.',
  'install.notEnabled': 'The plugin was downloaded but not enabled: it could not be confirmed to only add configuration, or it conflicts with local configuration. Check it in the local plugin manager.',
  'install.restart': 'Installed. Restart DSH to use it.',
  'install.done': 'Installed and enabled.',
};

const zhCN: Record<keyof typeof en, string> = {
  'request.invalid': '请求格式无效。',
  'request.failed': '操作没有完成。',
  'request.missing': '缺少{field}。',
  'field.team': '团队',
  'field.code': '授权码',
  'field.server': '服务器地址',
  'field.session': '会话',
  'field.config': '配置 ID',
  'field.plugin': '插件 ID',
  'field.version': '版本',
  'field.device': '设备',
  'profile.nameTooLong': '显示名称不能超过 80 个字符。',
  'profile.badLocale': '请选择 English 或简体中文。',
  'server.invalid': '服务器地址无效，请输入完整地址，例如 https://www.dshteamwork.com。',
  'server.https': '服务器地址必须使用 https；只有本机地址（localhost）可以用 http。',
  'server.extra': '服务器地址不能包含查询参数、片段或账号信息。',
  'auth.signedOut': '请先登录 Teamwork。',
  'auth.hostManaged': '这台 DSH 的 Teamwork 登录由宿主提供，无法在这里登录或退出。',
  'auth.changed': '登录状态已改变，请重试。',
  'summary.team': '请先同步，并选择你所在的团队。',
  'summary.unavailable': '团队摘要暂不可用。',
  'phone.notFound': '这台设备已不在配对列表中。',
  'phone.relayBusy': '中转服务暂时无法处理，请稍后再试。',
  'phone.relayOff': '还没有连上中转服务，无法管理手机。',
  'use.pick': '请选择团队模型或预设 ID。',
  'use.modelGone': '预设引用的团队模型已不可用，请联系管理员。',
  'model.noContextWindow': '团队模型「{name}」没有配置上下文窗口（contextWindow），暂时不能使用。请团队管理员在控制台补充后重新同步。',
  'use.missingTools': '缺少必需工具：{tools}。请先通过本地插件管理器安装或启用。',
  'use.started': '会话已开始或正在执行，DSH 不允许切换预设。请新建会话后选择该预设。',
  'use.notLoaded': '当前会话尚未加载，请先在会话中发送或打开它后再试。',
  'use.done': '本会话已选择 {name}。本地默认配置未改变。',
  'install.pick': '请选择团队插件 ID。',
  'install.pinChanged': '团队已更新这个插件的版本，请重新确认安装。',
  'install.noManager': '宿主没有插件管理服务。',
  'install.exists': '插件已存在，请通过本地插件管理器管理，团队同步不会覆盖它。',
  'install.changed': '安装期间账号或插件配置已变化，请重新确认。',
  'install.incomplete': '安装未完成（{reason}），请在本地插件管理器查看诊断后重新检查。',
  'install.notEnabled': '插件已下载但未启用：无法确认它只新增配置，或存在本地配置冲突。请在本地插件管理器中检查。',
  'install.restart': '已安装，请重启 DSH 生效。',
  'install.done': '插件已安装并启用。',
};

export type HostMessage = keyof typeof en;

/** The language of the machine DSH runs on, which the panel speaks until the account's is known. */
export function systemLocale(): Locale {
  return pickLocale(Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG);
}

let account: Locale | undefined;

/** The host has one member, so the panel has one language: the account's once read, the system's otherwise. */
export function setLocale(locale: Locale | null | undefined) { account = locale ?? undefined; }
export function panelLocale(): Locale { return account ?? systemLocale(); }

const speaker = new AsyncLocalStorage<Locale>();

/** Runs one panel request, so what it says is in the panel's language. */
export function speaking<T>(locale: Locale, answer: () => T): T { return speaker.run(locale, answer); }

/** English, except inside `speaking`. */
export function say(key: HostMessage, values?: Record<string, string | number>) {
  return translator({ en, 'zh-CN': zhCN }, speaker.getStore() ?? 'en')(key, values);
}
