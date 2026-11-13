import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { TeamworkClient } from './client.js';
const client = new TeamworkClient(process.env.TEAMWORK_URL ?? 'http://localhost:3800', resolve(process.env.TEAMWORK_CACHE ?? '.teamwork/cache.json'));
const terminal = createInterface({ input: stdin, output: stdout });
try {
  console.log('Open this URL in your browser:', client.beginLogin());
  await client.completeLogin((await terminal.question('Paste the line or code shown on the page: ')).trim());
  console.log('Signed in. Commands: sync, list, logout, quit. Tokens stay in memory.');
  for (;;) {
    const command = (await terminal.question('teamwork> ')).trim();
    if (command === 'quit') break;
    try {
      if (command === 'sync') { const next = await client.sync(); console.log(`Synced ${next.teams.reduce((n, t) => n + t.configs.length, 0)} configurations from ${next.teams.length} teams. Reload the DSH plugin to apply.`); }
      else if (command === 'list') console.log(JSON.stringify(client.current(), null, 2));
      else if (command === 'logout') { await client.logout(); console.log('Signed out. Reload the DSH plugin to remove team registrations.'); break; }
    } catch (error) { console.error((error as Error).message); }
  }
} finally { terminal.close(); }
