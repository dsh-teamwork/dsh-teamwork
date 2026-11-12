import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod/v4';
const stampSchema = z.object({ teamId: z.string(), id: z.string(), version: z.number().int().positive() });
/**
 * The team preset revision each session started on, so a resumed session whose
 * preset has since changed is stopped instead of silently running the new one.
 *
 * Kept in a file of the plugin's own, beside the configuration cache, and not in
 * the session log: DSH refuses to reopen a session whose log holds an event type
 * it does not know, and a third-party plugin cannot write the ignorable records it
 * accepts. A fork is a new session id, so it starts without a stamp and takes the
 * revision it first runs on.
 */
export class PresetStamps {
    path;
    stamps = new Map();
    writes = Promise.resolve();
    constructor(path) {
        this.path = path;
    }
    /** Reads the file; a missing or unreadable one starts empty, since a lost stamp is retaken on the next request. */
    async load() {
        try {
            const raw = z.record(z.string(), stampSchema).parse(JSON.parse(await readFile(this.path, 'utf8')));
            this.stamps = new Map(Object.entries(raw));
        }
        catch {
            this.stamps = new Map();
        }
    }
    get(sessionId) { return this.stamps.get(sessionId) ?? null; }
    set(sessionId, preset) {
        this.stamps.set(sessionId, { teamId: preset.teamId, id: preset.id, version: preset.version });
        return this.save();
    }
    clear(sessionId) { return this.stamps.delete(sessionId) ? this.save() : this.writes; }
    /** Writes are serialized and atomic, with the same 0600 file mode as the configuration cache. */
    save() {
        const content = JSON.stringify(Object.fromEntries(this.stamps));
        this.writes = this.writes.catch(() => { }).then(async () => {
            await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
            const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
            try {
                await writeFile(temporary, content, { mode: 0o600 });
                await rename(temporary, this.path);
            }
            finally {
                await rm(temporary, { force: true });
            }
        });
        return this.writes;
    }
}
/** The stamp file sits beside the configuration cache: `teamwork-cache.json` → `teamwork-cache.sessions.json`. */
export function presetStampPath(cachePath) { return cachePath.replace(/(\.json)?$/, '.sessions.json'); }
export function sameRevision(stamp, current) {
    return stamp?.teamId === current.teamId && stamp.id === current.id && stamp.version === current.version;
}
export function toolReport(preset, lookup) {
    return [...preset.requiredTools.map(name => ({ name, required: true })), ...preset.optionalTools.map(name => ({ name, required: false }))].map(t => ({ ...t, state: lookup(t.name) }));
}
export function assertBlank(boundary) {
    if (boundary.openTurnStartSeq !== null || boundary.lastTurn > 0)
        throw new Error('会话已开始或正在执行，DSH 不允许切换预设。请新建会话后选择该预设。');
}
//# sourceMappingURL=preset-session.js.map