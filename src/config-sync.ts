import type { TeamworkClient, TeamOverlay } from './client.js';

/** One shared flight for manual and scheduled configuration synchronization. */
export class ConfigSync {
  private timer?: ReturnType<typeof setTimeout>;
  private flight?: Promise<void>;
  private stopped = false;
  private lastSuccess?: string;
  private lastError?: string;
  constructor(private client: TeamworkClient, private overlay: TeamOverlay,
    private enabled = true, private interval = 60000) {
    if (!Number.isInteger(interval) || interval < 10000 || interval > 86400000) throw new Error('syncIntervalMs must be between 10000 and 86400000');
  }
  status() {
    return { authenticated: this.client.authenticated(), autoSync: this.enabled,
      syncing: !!this.flight, lastSuccess: this.lastSuccess, lastError: this.lastError,
      teams: (this.client.current()?.teams ?? []).map(team => team.teamName),
      configCount: (this.client.current()?.teams ?? []).reduce((count, team) => count + team.configs.length, 0) };
  }
  sync(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Plugin stopped'));
    if (this.flight) return this.flight;
    this.flight = (async () => {
      try {
        try { await this.client.sync(); } finally { await this.overlay.apply(this.client.current()); }
        this.lastSuccess = new Date().toISOString(); this.lastError = undefined;
      } catch (error) {
        // Do not expose arbitrary transport errors, which can contain credentials.
        this.lastError = this.client.authenticated() ? '同步失败，保留已有配置；稍后重试或运行 /teamwork sync。' : '请重新登录后同步。';
        throw error;
      }
    })().finally(() => { this.flight = undefined; });
    return this.flight;
  }
  start() {
    if (!this.enabled || this.stopped || this.timer) return;
    this.timer = setTimeout(async () => {
      this.timer = undefined;
      try { if (this.client.authenticated()) await this.sync(); } catch { /* status retains the failure */ }
      finally { this.start(); }
    }, this.interval);
    this.timer.unref?.();
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.timer); this.timer = undefined;
    await this.flight?.catch(() => {});
  }
}
