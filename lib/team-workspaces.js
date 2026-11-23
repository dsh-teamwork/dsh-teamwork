/**
 * Each team's default workspace on this computer: the folder a session started from a phone or the web console lands
 * in when its member does not pick one. Until the member picks one in the panel, a team's default is the fallback the
 * caller names: one of DSH's workspaces where there is one, so its sessions are listed under it rather than Ungrouped.
 * A default is only ever one of the directories a session may start in (`startDirectories`); a saved one that DSH no
 * longer offers falls back too.
 *
 * The file (`<cache>.workspaces.json`, mode 0600) keeps only the choices the member made, by team id.
 */
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
const fileSchema = z.record(z.string(), z.string());
/** The directories a session may start in: where DSH was started, then its workspaces, each once and in that order. */
export function startDirectories(started, workspaces) {
    const canonical = (path) => { try {
        return realpathSync(path);
    }
    catch {
        return path;
    } };
    return [...new Set([canonical(started), ...workspaces.map((workspace) => workspace.path)])];
}
export const teamWorkspacesPath = (cachePath) => cachePath.replace(/(\.json)?$/, '.workspaces.json');
export class TeamWorkspaces {
    path;
    state;
    writes = Promise.resolve();
    constructor(path) {
        this.path = path;
    }
    load() {
        return (this.state ??= readFile(this.path, 'utf8').then((text) => fileSchema.parse(JSON.parse(text)), (error) => { if (error.code === 'ENOENT')
            return {}; throw error; }));
    }
    /** Every listed team's default among `directories`: its saved choice, else `fallback`. */
    async defaults(teamIds, directories, fallback) {
        const saved = await this.load();
        const result = {};
        for (const id of teamIds) {
            const choice = saved[id];
            const path = choice !== undefined && directories.includes(choice) ? choice : fallback;
            if (path !== undefined)
                result[id] = path;
        }
        return result;
    }
    /** Saves a team's default; the caller has checked the team and that `path` is one of the offered directories. */
    set(teamId, path) {
        const task = this.writes.catch(() => { }).then(async () => {
            const state = { ...(await this.load()), [teamId]: path };
            await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
            const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
            try {
                await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
                await rename(temporary, this.path);
            }
            finally {
                await rm(temporary, { force: true });
            }
            this.state = Promise.resolve(state);
        });
        this.writes = task;
        return task;
    }
}
//# sourceMappingURL=team-workspaces.js.map