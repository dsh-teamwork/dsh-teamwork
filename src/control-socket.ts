/**
 * The Teamwork panel's routes (`src/panel.ts`) on a Unix socket beside the plugin's files, so `dsh-teamwork`
 * (`src/teamwork-cli.ts`) can run the panel's actions on this machine — a shared DSH on a server has no browser. Its
 * directory is the user's alone (0700) and the socket 0600: whoever can open it is already this user, so it carries no
 * token. It is the panel's handlers, not a second copy of them.
 *
 * It never stops DSH: a socket that cannot be opened is a warning, and a socket another running DSH on this home
 * still answers is left to it. Windows has no Unix socket here; the command is not offered there.
 */
import { mkdir, chmod, rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { createServer, type IncomingMessage } from 'node:http';
import { dirname } from 'node:path';
import type { FetchRoute } from './panel.js';

export const controlSocketPath = (cachePath: string) => cachePath.replace(/(\.json)?$/, '.sock');

/** Whether something already answers on the socket: another DSH on this home serves it. */
const answers = (path: string) => new Promise<boolean>((done) => {
  const probe = createConnection(path);
  probe.once('connect', () => { probe.destroy(); done(true); });
  probe.once('error', () => done(false));
});

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Serves the routes on the socket at path until the returned close is called; failures go to log and leave nothing open. */
export async function serveControlSocket(path: string, routes: FetchRoute[], log: (message: string) => void): Promise<() => Promise<void>> {
  const nothing = async () => {};
  if (process.platform === 'win32') return nothing;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    if (await answers(path)) {
      log(`Another DSH using this home already serves ${path}; dsh-teamwork reaches that one.`);
      return nothing;
    }
    await rm(path, { force: true });
    const server = createServer(async (request, response) => {
      const route = routes.find((r) => r.path === request.url && r.methods.includes(request.method as 'POST'));
      if (!route) { response.writeHead(404).end(); return; }
      try {
        // The panel's routes admit only a JSON request, so the command's content type travels with its body.
        const answer = await route.fetch(new Request(`http://teamwork${request.url}`, {
          method: request.method, body: await body(request), headers: { 'content-type': request.headers['content-type'] ?? '' },
        }));
        response.writeHead(answer.status, { 'content-type': answer.headers.get('content-type') ?? 'application/json' }).end(Buffer.from(await answer.arrayBuffer()));
      } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: (error as Error).message }));
      }
    });
    await new Promise<void>((listening, failed) => { server.once('error', failed); server.listen(path, listening); });
    await chmod(path, 0o600);
    // Closing unlinks the socket itself; removing it here could remove the next one a reload has opened.
    return () => new Promise<void>((closed) => { server.close(() => closed()); server.closeAllConnections(); });
  } catch (error) {
    log(`dsh-teamwork cannot reach this DSH: the socket ${path} did not open (${(error as Error).message}).`);
    return nothing;
  }
}
