/**
 * Each team's default workspace on this computer: the folder a session started from a phone or the web console lands
 * in when its member does not pick one. Until the member picks one in the panel, a team's default is the directory DSH
 * was started in, so every synced team has one. A default is only ever one of the directories a session may start in
 * (`startDirectories`, src/shared-owner.ts); a saved one that DSH no longer offers falls back to the first of them.
 *
 * The file (`<cache>.workspaces.json`, mode 0600) keeps only the choices the member made, by team id.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
const fileSchema = z.record(z.string(), z.string());
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
    /** Every listed team's default among `directories`, the first of which is where DSH was started. */
    async defaults(teamIds, directories) {
        const saved = await this.load();
        const result = {};
        for (const id of teamIds) {
            const choice = saved[id];
            const path = choice !== undefined && directories.includes(choice) ? choice : directories[0];
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