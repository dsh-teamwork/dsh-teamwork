#!/usr/bin/env node
/**
 * `dsh-teamwork`, run on the machine of a running DSH to do what its Teamwork panel does, without a browser — for a
 * DSH on a server:
 *
 *   dsh-teamwork server [url]             the Teamwork server it uses (a self-hosted team sets its own first);
 *                                         without a url, prints it
 *   dsh-teamwork login [--browser]        a sign-in link; --browser enables callback on the same machine
 *   dsh-teamwork authorize <code>         finish signing in
 *   dsh-teamwork status                   sign-in, teams, sync, the relay and paired devices
 *   dsh-teamwork sync                     sync the team configuration now
 *   dsh-teamwork pin set | clear          set or disable the device PIN on this DSH
 *   dsh-teamwork web on | off             let the Teamwork server open this DSH's whole Web interface for the account
 *                                         signed in here (native DSH Web), or stop it
 *   dsh-teamwork web disconnect           end every native Web session open now; the switch stays on
 *   dsh-teamwork logout                   sign out
 *   dsh-teamwork device pair [--guided]   a pairing code, and a QR code for the DSH Teamwork phone app; a browser
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
import { createInterface } from 'node:readline';
import { createInterface as createPrompt } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Writable } from 'node:stream';
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
const handshakeHelp = 'Waiting for the encrypted connection. Keep the pairing screen open on the device.';
const confirmationHelp = 'Compare the safety code and confirm it on the device first.';
const deviceLine = (p, guided = false) => p.status === 'pending'
    ? `${p.id}  ${p.deviceName}${p.deviceKind ? ` (${kinds[p.deviceKind]})` : ''}  waiting: ${p.safetyCode
        ? `safety code ${p.safetyCode}; ${p.phoneConfirmed ? (guided ? 'confirmed on device' : `if the device shows the same, dsh-teamwork device accept ${p.id}`) : confirmationHelp}`
        : handshakeHelp}`
    : `${p.id}  ${p.deviceName}${p.deviceKind ? ` (${kinds[p.deviceKind]})` : ''}  paired${p.verified ? '' : ' (pair it again: its key is not verified)'}${p.lastUsedAt ? `, last used ${p.lastUsedAt}` : ''}`;
const codeKey = (code) => code.replace(/\s/g, '');
async function guidePairing(socketPath, offer, existing, input, out, err) {
    const deadline = Date.parse(offer.expiresAt);
    const pending = async () => (await state(socketPath)).phones.filter(phone => phone.status === 'pending' && !existing.has(phone.id));
    const prompt = createPrompt({ input });
    let cancelled = false;
    const cancel = new AbortController();
    prompt.once('close', () => { cancelled = true; cancel.abort(); });
    prompt.once('SIGINT', () => prompt.close());
    let last = '';
    try {
        while (Date.now() < deadline && !cancelled) {
            const devices = await pending();
            const display = devices.map(phone => deviceLine(phone, true)).join('\n');
            if (display && display !== last)
                out(display);
            last = display;
            if (!devices.some(phone => phone.safetyCode && phone.phoneConfirmed)) {
                await delay(Math.min(1000, Math.max(0, deadline - Date.now())));
                continue;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0)
                break;
            out('3. Type the safety code shown on the device, spaces optional, then press Enter. Press Enter on an empty line to cancel.');
            const signal = AbortSignal.any([cancel.signal, AbortSignal.timeout(remaining)]);
            const entered = await prompt.question('', { signal });
            if (!entered.trim()) {
                cancelled = true;
                break;
            }
            const matches = (await pending()).filter(phone => phone.phoneConfirmed && phone.safetyCode && codeKey(phone.safetyCode) === codeKey(entered));
            const [phone] = matches;
            if (matches.length !== 1 || !phone?.safetyCode) {
                err('The code does not match exactly one device that has confirmed. Keep the pairing screen open and check the current safety code.');
                continue;
            }
            if (Date.now() >= deadline)
                break;
            await call(socketPath, 'decide-phone', { id: phone.id, accept: true, safetyCode: phone.safetyCode });
            out(`Paired ${phone.deviceName}. If the app asks for a PIN, enter the PIN set on this DSH.`);
            return 0;
        }
    }
    catch (error) {
        if (error.name !== 'AbortError')
            throw new Error(`${error.message} To start over, run dsh-teamwork device pair --guided.`);
    }
    finally {
        prompt.close();
    }
    err(cancelled && Date.now() < deadline ? 'Pairing cancelled.' : 'Pairing code expired. Run dsh-teamwork device pair --guided to start again.');
    return 1;
}
async function device(action, id, socketPath, out, err, input) {
    const phones = async () => (await state(socketPath)).phones;
    const needsId = () => { if (!id) {
        err(`${usage}\n(device ${action} needs the device's id, from dsh-teamwork device list)`);
        return false;
    } return true; };
    switch (action) {
        case 'pair': {
            if (id !== undefined && id !== '--guided') {
                err(usage);
                return 2;
            }
            const guided = id === '--guided';
            const existing = guided ? new Set((await phones()).map(phone => phone.id)) : undefined;
            const offer = (await call(socketPath, 'pair-phone'));
            out(terminalQr(offer.link));
            out(`Scan it in the DSH Teamwork app, or open: ${offer.link}`);
            out(`Or enter ${offer.code} in the app, or in My DSH in the Teamwork web console.`);
            if (existing) {
                out('1. Open the pairing screen on the device and keep it open.');
                out('2. When safety codes appear on both screens, compare them and confirm on the device.');
                out(`Waiting for a new device. Pairing code valid until ${offer.expiresAt}.`);
                return guidePairing(socketPath, offer, existing, input, out, err);
            }
            out(`Valid until ${offer.expiresAt}. Run dsh-teamwork device list to compare the safety code and confirm it on the device first.`);
            return 0;
        }
        case 'list': {
            const listed = await phones();
            out(listed.length ? listed.map(phone => deviceLine(phone)).join('\n') : 'No device is paired. Run dsh-teamwork device pair.');
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
                err(waiting.safetyCode ? confirmationHelp : handshakeHelp);
                return 1;
            }
            await call(socketPath, 'decide-phone', { id, accept: true, safetyCode: waiting.safetyCode });
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
        ...(s.nativeWeb ? [`Native Web: ${s.nativeWeb.enabled ? 'on' : 'off'}${s.nativeWeb.blocked ? ` — ${blockedBy[s.nativeWeb.blocked]}` : ''}${nativeWebUse(s.nativeWeb.active)}`] : []),
    ].join('\n');
}
/** What this computer sees of native Web's use: tunnels open now, or when one last moved. */
function nativeWebUse(active) {
    if (!active)
        return '';
    if (active.tunnels > 0)
        return `, in use now (${active.tunnels} connection${active.tunnels === 1 ? '' : 's'})`;
    return active.lastActivity ? `, last used ${active.lastActivity}` : '';
}
/** Why native Web cannot work here while it is on, or cannot be turned on. */
const blockedBy = { pin: 'unavailable while a device PIN is set', web: 'needs DSH Web on this machine (dsh web)' };
const usage = [
    'usage: dsh-teamwork server [url] | login [--browser] | authorize <code> | status | sync | logout',
    '       dsh-teamwork pin set | clear',
    '       dsh-teamwork web on | off | disconnect',
    '       dsh-teamwork device pair [--guided] | list | accept <id> | reject <id> | revoke <id>',
].join('\n');
/** Runs one command against the DSH on socketPath, writing to out and err; returns the exit code. */
export async function run(args, socketPath, out, err, input = process.stdin) {
    const [group, action, value] = args;
    if (group === 'server') {
        if (action)
            await call(socketPath, 'server', { server: action });
        out(`Teamwork server: ${(await call(socketPath, 'state')).server}`);
        return 0;
    }
    switch (group) {
        case 'login': {
            if (args.length > 2 || (action !== undefined && action !== '--browser')) {
                err(usage);
                return 2;
            }
            const browser = action === '--browser';
            const { url, automatic } = (await call(socketPath, 'login', browser ? {} : { manual: true }));
            const link = new URL(url);
            // Older running plugins still return a loopback URL for every login request.
            if (!browser)
                link.searchParams.delete('redirect_uri');
            out(`Open this in a browser, sign in and confirm:\n${link}`);
            out(browser && automatic
                ? 'Open the link on this machine to finish automatically. For a browser on another machine, run dsh-teamwork login.'
                : 'After confirming, copy the code the page shows and run on this machine: dsh-teamwork authorize <code>');
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
        case 'pin': {
            if (args.length !== 2 || (action !== 'set' && action !== 'clear')) {
                err(usage);
                return 2;
            }
            let pin = null;
            if (action === 'set') {
                const terminal = input.isTTY === true;
                const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
                const lines = createInterface({ input, terminal, output: silent });
                try {
                    if (terminal)
                        err('Enter a four-digit device PIN:');
                    const first = await lines[Symbol.asyncIterator]().next();
                    if (first.done || !/^\d{4}$/.test(first.value)) {
                        err('A PIN is four digits.');
                        return 2;
                    }
                    pin = first.value;
                }
                finally {
                    lines.close();
                }
            }
            await call(socketPath, 'owner-pin', { pin });
            out(pin === null ? 'Device PIN disabled.' : 'Device PIN saved.');
            return 0;
        }
        case 'web': {
            if (args.length === 2 && action === 'disconnect') {
                await call(socketPath, 'native-web-disconnect');
                out('Every native DSH Web session is ended; opening it again needs a new entry from Teamwork. The switch stays on.');
                return 0;
            }
            if (args.length !== 2 || (action !== 'on' && action !== 'off')) {
                err(usage);
                return 2;
            }
            await call(socketPath, 'native-web', { enabled: action === 'on' });
            out(action === 'on'
                ? 'Native DSH Web is on: the Teamwork server can open this DSH\'s whole Web interface, settings and plugins included, for the account signed in here. dsh-teamwork web off stops it; signing out or changing server turns it off too.'
                : 'Native DSH Web is off.');
            return 0;
        }
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
        case 'device':
            if (args.length > 3) {
                err(usage);
                return 2;
            }
            return device(action, value, socketPath, out, err, input);
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