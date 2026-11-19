/** One shared flight for manual and scheduled configuration synchronization. */
export class ConfigSync {
    client;
    overlay;
    enabled;
    interval;
    synced;
    timer;
    flight;
    stopped = false;
    lastSuccess;
    lastError;
    /** `synced` hears every successful sync, manual or scheduled. */
    constructor(client, overlay, enabled, interval, synced) {
        this.client = client;
        this.overlay = overlay;
        this.enabled = enabled;
        this.interval = interval;
        this.synced = synced;
        if (!Number.isInteger(interval) || interval < 10000 || interval > 86400000)
            throw new Error('syncIntervalMs must be between 10000 and 86400000');
    }
    status() {
        return { authenticated: this.client.authenticated(), autoSync: this.enabled,
            syncing: !!this.flight, lastSuccess: this.lastSuccess, lastError: this.lastError,
            teams: (this.client.current()?.teams ?? []).map(team => team.teamName),
            configCount: (this.client.current()?.teams ?? []).reduce((count, team) => count + team.configs.length, 0) };
    }
    sync() {
        if (this.stopped)
            return Promise.reject(new Error('Plugin stopped'));
        if (this.flight)
            return this.flight;
        this.flight = (async () => {
            try {
                try {
                    await this.client.sync();
                }
                finally {
                    await this.overlay.apply(this.client.current());
                }
                this.lastSuccess = new Date().toISOString();
                this.lastError = undefined;
                this.synced();
            }
            catch (error) {
                // Do not expose arbitrary transport errors, which can contain credentials.
                this.lastError = this.client.authenticated() ? 'Sync failed; the last synced configuration is kept. Try again later, or run /teamwork sync.' : 'Sign in again, then sync.';
                throw error;
            }
        })().finally(() => { this.flight = undefined; });
        return this.flight;
    }
    start() {
        if (!this.enabled || this.stopped || this.timer)
            return;
        this.timer = setTimeout(async () => {
            this.timer = undefined;
            try {
                if (this.client.authenticated())
                    await this.sync();
            }
            catch { /* status retains the failure */ }
            finally {
                this.start();
            }
        }, this.interval);
        this.timer.unref?.();
    }
    async stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        this.timer = undefined;
        await this.flight?.catch(() => { });
    }
}
//# sourceMappingURL=config-sync.js.map