#!/usr/bin/env node
/**
 * `dsh-teamwork`, run on the machine of a running DSH to do what its Teamwork panel does for a shared DSH, without a
 * browser — a shared DSH usually runs on a server with none:
 *
 *   dsh-teamwork server [url]             the Teamwork server it uses (a self-hosted team sets its own before enabling);
 *                                         without a url, prints it
 *   dsh-teamwork share enable <key>       make this DSH its team's shared DSH with the console's team host key
 *   dsh-teamwork share audit-key <key>    seal its archive to the key `dsh-teamwork-audit keygen` printed
 *   dsh-teamwork share status             its name, team, audit key and any error
 *   dsh-teamwork share members            who may reach it, their devices and locks
 *   dsh-teamwork share invite <email>     a single-use pairing link for one listed member
 *   dsh-teamwork share unlock <email>     clear a member's PIN and lock
 *   dsh-teamwork share disable            end shared mode and delete the key
 *
 * It talks to that DSH over the plugin's socket (`src/control-socket.ts`) in the DSH home, `$DSH_HOME` or else ~/.dsh,
 * the same rule DSH itself follows; the plugin keeps its files in that home's `dsh-teamwork/`.
 */
import { realpathSync } from 'node:fs';
import { request } from 'node:http';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/** The DSH home as DSH resolves it: a non-blank `$DSH_HOME` (with `~` expanded), else ~/.dsh. */
export function dshHome(env = process.env) {
    const configured = env.DSH_HOME?.trim() ? env.DSH_HOME : join(homedir(), '.dsh');
    return resolve(configured === '~' ? homedir() : configured.replace(/^~[/\\]/, `${homedir()}/`));
}
export const socketIn = (home) => join(home, 'dsh-teamwork', 'cache.sock');
/** One panel route on the socket: its JSON answer, or its error as a thrown message. */
export function call(socketPath, route, body = {}) {
    return new Promise((done, failed) => {
        const req = request({ socketPath, path: `/api/teamwork/${route}`, method: 'POST', agent: false, headers: { 'content-type': 'application/json' } }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                let answer = null;
                try {
                    answer = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
                }
                catch { /* not JSON: said below */ }
                const error = answer?.error;
                if ((res.statusCode ?? 500) >= 400)
                    failed(new Error(typeof error === 'string' ? error : `The DSH answered ${res.statusCode}.`));
                else
                    done(answer);
            });
        });
        req.on('error', (error) => failed(error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
            ? new Error(`No running DSH with the Teamwork plugin at ${socketPath}. Start it (dsh web) with the same DSH_HOME, and run this as the same user.`)
            : error));
        req.end(JSON.stringify(body));
    });
}
const shared = async (socketPath) => (await call(socketPath, 'state')).shared;
const describe = (s) => [
    `Shared DSH: ${s.name ?? 'not yet confirmed'}`,
    `Team: ${s.teamName ?? 'unknown'}`,
    `Audit key: ${s.auditKey ?? 'not set — no member is admitted until dsh-teamwork share audit-key <key>'}`,
    ...(s.error ? [`Error: ${s.error}`] : []),
].join('\n');
const usage = 'usage: dsh-teamwork server [url] | dsh-teamwork share enable <key> | audit-key <key> | status | members | invite <email> | unlock <email> | disable';
/** Runs one command against the DSH on socketPath, writing to out and err; returns the exit code. */
export async function run(args, socketPath, out, err) {
    const [group, action, value] = args;
    const needs = (what) => { if (!value) {
        err(`${usage}\n(${action} needs ${what})`);
        return false;
    } return true; };
    if (group === 'server') {
        if (action)
            await call(socketPath, 'server', { server: action });
        out(`Teamwork server: ${(await call(socketPath, 'state')).server}`);
        return 0;
    }
    if (group !== 'share') {
        err(usage);
        return 2;
    }
    switch (action) {
        case 'enable': {
            if (!needs('the key'))
                return 2;
            await call(socketPath, 'share-enable', { key: value });
            const now = await shared(socketPath);
            out(now ? describe(now) : 'Shared mode is on.');
            out('Personal sign-in is off while it is shared. Next: dsh-teamwork share audit-key <key>.');
            return 0;
        }
        case 'audit-key': {
            if (!needs('the public key'))
                return 2;
            const { fingerprint } = (await call(socketPath, 'share-audit-key', { key: value }));
            out(`Audit key set (fingerprint ${fingerprint}). Members can now join.`);
            return 0;
        }
        case 'status': {
            const now = await shared(socketPath);
            out(now ? describe(now) : 'Shared mode is off. Run dsh-teamwork share enable <key> with the key from the team console.');
            return 0;
        }
        case 'members': {
            const now = await shared(socketPath);
            if (!now) {
                out('Shared mode is off.');
                return 0;
            }
            if (!now.members.length) {
                out('Nobody is listed yet: choose who may reach it in the team console, under Shared DSHs.');
                return 0;
            }
            for (const m of now.members)
                out(`${m.email ?? m.userId}${m.locked ? ' (locked)' : ''}: ${m.devices.join(', ') || 'no device yet'}`);
            return 0;
        }
        case 'invite': {
            if (!needs('the member\'s email'))
                return 2;
            const invite = (await call(socketPath, 'share-invite', { email: value }));
            out(`Invite for ${value}, single use, valid until ${invite.expiresAt}:`);
            out(invite.link);
            out('Hand it over yourself, in person or through a channel your team trusts, never through the Teamwork server.');
            return 0;
        }
        case 'unlock': {
            if (!needs('the member\'s email'))
                return 2;
            await call(socketPath, 'share-unlock', { email: value });
            out(`${value}'s PIN and lock are cleared; they set a new PIN on their next connection.`);
            return 0;
        }
        case 'disable':
            await call(socketPath, 'share-disable');
            out('Shared mode is off and its key deleted.');
            return 0;
        default:
            err(usage);
            return 2;
    }
}
// Run as a command (through npm's bin link too), not when imported by tests.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.platform === 'win32') {
        console.error('dsh-teamwork runs on Linux and macOS; on Windows use the Teamwork panel in DSH.');
        process.exit(1);
    }
    run(process.argv.slice(2), socketIn(dshHome()), console.log, console.error)
        .then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(1); });
}
//# sourceMappingURL=share-cli.js.map