#!/usr/bin/env node
/**
 * `dsh-teamwork`, run on the machine of a running DSH to do what its Teamwork panel does, without a browser — for a
 * DSH on a server:
 *
 *   dsh-teamwork server [url]             the Teamwork server it uses (a self-hosted team sets its own first);
 *                                         without a url, prints it
 *   dsh-teamwork login                    a sign-in link to open in any browser; the code it shows goes to authorize
 *   dsh-teamwork authorize <code>         finish signing in
 *   dsh-teamwork status                   sign-in, teams, sync, the relay and paired devices
 *   dsh-teamwork sync                     sync the team configuration now
 *   dsh-teamwork logout                   sign out
 *   dsh-teamwork device pair              a pairing code, and a QR code for the DSH Teamwork phone app; a browser
 *                                         types the code in My DSH
 *   dsh-teamwork device list              paired and waiting devices, with a waiting device's safety code
 *   dsh-teamwork device accept <id>       accept a waiting device, once its safety code matches the one listed here
 *   dsh-teamwork device reject <id>       refuse a waiting device
 *   dsh-teamwork device revoke <id>       remove a paired device
 *
 * It talks to that DSH over the plugin's socket (`src/control-socket.ts`) in the DSH home, `$DSH_HOME` or else ~/.dsh,
 * the same rule DSH itself follows; the plugin keeps its files in that home's `dsh-teamwork/`.
 */
import { realpathSync } from 'node:fs';
import { request } from 'node:http';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-generator';
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
const state = async (socketPath) => (await call(socketPath, 'state'));
/** The pairing link as a QR code a terminal shows: two rows per character line, so it stays square. */
export function terminalQr(link) {
    const code = qrcode(0, 'M');
    code.addData(link);
    code.make();
    return code.createASCII(1, 2);
}
const kinds = { ios: 'iOS phone', android: 'Android phone', web: 'web browser' };
const deviceLine = (p) => p.status === 'pending'
    ? `${p.id}  ${p.deviceName}${p.deviceKind ? ` (${kinds[p.deviceKind]})` : ''}  waiting: ${p.safetyCode && p.phoneConfirmed ? `safety code ${p.safetyCode}; if the device shows the same, dsh-teamwork device accept ${p.id}` : 'the device has not finished its encrypted handshake yet'}`
    : `${p.id}  ${p.deviceName}${p.deviceKind ? ` (${kinds[p.deviceKind]})` : ''}  paired${p.verified ? '' : ' (pair it again: its key is not verified)'}${p.lastUsedAt ? `, last used ${p.lastUsedAt}` : ''}`;
async function device(action, id, socketPath, out, err) {
    const phones = async () => (await state(socketPath)).phones;
    const needsId = () => { if (!id) {
        err(`${usage}\n(device ${action} needs the device's id, from dsh-teamwork device list)`);
        return false;
    } return true; };
    switch (action) {
        case 'pair': {
            const offer = (await call(socketPath, 'pair-phone'));
            out(terminalQr(offer.link));
            out(`Scan it in the DSH Teamwork app, or open: ${offer.link}`);
            out(`Or enter ${offer.code} in the app, or in My DSH in the Teamwork web console.`);
            out(`Valid until ${offer.expiresAt}. Then run dsh-teamwork device list to compare the safety code.`);
            return 0;
        }
        case 'list': {
            const listed = await phones();
            out(listed.length ? listed.map(deviceLine).join('\n') : 'No device is paired. Run dsh-teamwork device pair.');
            return 0;
        }
        case 'accept': {
            if (!needsId())
                return 2;
            const waiting = (await phones()).find((p) => p.id === id && p.status === 'pending');
            if (!waiting) {
                err(`No device waits as ${id}. Run dsh-teamwork device list.`);
                return 1;
            }
            // As in the panel: only a finished handshake has a safety code the person can have compared.
            if (!waiting.safetyCode || !waiting.phoneConfirmed) {
                err('The device has not finished its encrypted handshake yet; wait, then run dsh-teamwork device list.');
                return 1;
            }
            await call(socketPath, 'decide-phone', { id, accept: true });
            out(`Accepted ${waiting.deviceName}.`);
            return 0;
        }
        case 'reject':
            if (!needsId())
                return 2;
            await call(socketPath, 'decide-phone', { id, accept: false });
            out('Refused.');
            return 0;
        case 'revoke':
            if (!needsId())
                return 2;
            await call(socketPath, 'revoke-phone', { id });
            out('Removed.');
            return 0;
        default:
            err(usage);
            return 2;
    }
}
function describeState(s) {
    return [
        `Teamwork server: ${s.server}`,
        `Signed in: ${s.authenticated ? 'yes' : 'no — dsh-teamwork login'}`,
        ...(s.teams.length ? [`Teams: ${s.teams.map((t) => `${t.name} (${t.role})`).join(', ')}`] : []),
        `Sync: ${s.sync.running ? 'running' : s.sync.lastSuccess ? `last ${s.sync.lastSuccess}` : 'not yet'}${s.sync.auto ? ', automatic' : ''}`,
        ...(s.sync.lastError ? [`Sync error: ${s.sync.lastError}`] : []),
        `Relay: ${s.relay}`,
        `Devices: ${s.phones.length ? s.phones.map((p) => `${p.deviceName} (${p.status === 'pending' ? 'waiting' : 'paired'})`).join(', ') : 'none'}`,
    ].join('\n');
}
const usage = [
    'usage: dsh-teamwork server [url] | login | authorize <code> | status | sync | logout',
    '       dsh-teamwork device pair | list | accept <id> | reject <id> | revoke <id>',
].join('\n');
/** Runs one command against the DSH on socketPath, writing to out and err; returns the exit code. */
export async function run(args, socketPath, out, err) {
    const [group, action, value] = args;
    if (group === 'server') {
        if (action)
            await call(socketPath, 'server', { server: action });
        out(`Teamwork server: ${(await call(socketPath, 'state')).server}`);
        return 0;
    }
    switch (group) {
        case 'login': {
            const { url, automatic } = (await call(socketPath, 'login'));
            out(`Open this in a browser, sign in and confirm:\n${url}`);
            out(automatic
                ? 'A browser on this machine finishes by itself. Anywhere else, copy the code the page shows and run: dsh-teamwork authorize <code>'
                : 'Then copy the code the page shows and run: dsh-teamwork authorize <code>');
            return 0;
        }
        case 'authorize':
            if (!action) {
                err(`${usage}\n(authorize needs the code the sign-in page shows)`);
                return 2;
            }
            // The page shows a whole line, /teamwork authorize <code>; its last word is the code.
            await call(socketPath, 'authorize', { code: args.at(-1) });
            out('Signed in. The team configuration syncs now; dsh-teamwork status shows it.');
            return 0;
        case 'status':
            out(describeState(await state(socketPath)));
            return 0;
        case 'sync': {
            await call(socketPath, 'sync');
            const now = await state(socketPath);
            if (now.sync.lastError) {
                err(`Sync failed: ${now.sync.lastError}`);
                return 1;
            }
            out(`Synced ${now.teams.length} team${now.teams.length === 1 ? '' : 's'}.`);
            return 0;
        }
        case 'logout':
            await call(socketPath, 'logout');
            out('Signed out; the team configuration is removed from this DSH.');
            return 0;
        case 'device': return device(action, value, socketPath, out, err);
    }
    err(usage);
    return 2;
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
//# sourceMappingURL=teamwork-cli.js.map