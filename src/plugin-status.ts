export type PluginState = 'missing' | 'disabled' | 'version-mismatch' | 'failed' | 'pending' | 'ready' | 'unknown' | 'catalog-changed';
export function pluginState(expected: string, bundle: {version?:string;availability:string;enabled:boolean;error?:unknown;rows:{entryId?:string}[]} | undefined,
  entries: {entryId:string;enabled:boolean;fiberPhase:string|null}[], restartRequired = false): PluginState {
  if (!bundle || bundle.availability === 'missing') return 'missing';
  if (bundle.error) return 'failed';
  if (bundle.version !== expected) return 'version-mismatch';
  if (!bundle.enabled) return 'disabled';
  const rows = bundle.rows.map(r=>entries.find(e=>e.entryId===r.entryId));
  if (rows.some(e=>e?.fiberPhase==='failed')) return 'failed';
  if (restartRequired || rows.some(e=>!e || !e.enabled || e.fiberPhase!=='active')) return 'pending';
  return rows.length ? 'ready' : 'unknown';
}
export const stateText: Record<PluginState,string> = {
  missing:'未安装：先查看安装说明并确认安装', disabled:'已安装未启用：请在 DSH 本地插件管理器启用',
  'version-mismatch':'版本不符：请在本地插件管理器检查，团队操作不会覆盖已有版本', failed:'加载失败：请查看本地插件管理器诊断并修复',
  pending:'尚未就绪：等待加载；如安装提示需要重启，请重启 DSH 后重新检查',ready:'正常',unknown:'无法确认运行状态：请在本地插件管理器检查',
  'catalog-changed':'目录缺失或版本已变化：请联系管理员更新预设依赖',
};
