# Developer reference

[User documentation](README.md) covers installation and workflows. This file
owns build commands, runtime contracts, phone protocols and release operations.

## Build and verify

Use Node.js compatible with the host and pnpm 9.15.9 from `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

`build` compiles `src/` into committed `lib/`, declarations into `lib/types/`,
and the browser bundle into `lib/web/client.js`. The browser bundle embeds the
workspace `@dsh-teamwork/ui` components and takes React from DSH. Its ownership
rules are in [ui/README.md](../ui/README.md).

DSH core services are peer dependencies supplied by the host. Development
versions are pinned to rc.3 and Zod to 4.6.6 to avoid recursive type expansion
across mismatched versions. Never add `@deepseek-ai/dsh-*` to runtime dependencies:
hoisted installations can shadow the upgraded host even when the plugin is disabled.

For a live host, `pnpm dev` links this checkout into a `web` profile under the
gitignored `.dsh-home/` (as `DSH_HOME`, so `~/.dsh` is untouched), watch-builds `lib/`
with `dsh-hmr` reloading it, and boots `dsh web`; arguments after `pnpm dev` reach
`dsh web`. Put local overrides such as `apiEndpoint` in the gitignored
`cordis.local.patch.yml`, which outranks the generated `.dsh-home/cordis.patch.yml`.
`DSH_CLI` selects a specific host. `pnpm dev:reset` deletes the dev home, including
its sign-in cache. On exit the browser bundle is rebuilt without source maps.

The real-host suites install the packed plugin in temporary profiles and use
an isolated local fixture registry and package store:

```sh
npm install --prefix /tmp/dsh-test-runtime --no-package-lock @deepseek-ai/dsh@0.2.2-rc.3
export DSH_CLI=/tmp/dsh-test-runtime/node_modules/@deepseek-ai/dsh/lib/bin.js
pnpm test:host
pnpm test:presets
pnpm test:assistant
```

CI repeats this on DSH rc.1, rc.2 and rc.3 on Linux. Windows-safe argument
packing is covered by the archive tests; that is not a Windows Desktop GUI test.
The fixture profile sets `npm_config_ignore_workspace_root_check=true` for its
own workspace root. Successful runs clean up; failures retain diagnostics that
can contain a local browser token. Do not publish raw host logs.

## Bundled skills

Each folder under `skills/` with a `SKILL.md` ships in the package, and `src/bundled-skills.ts`
registers every one with DSH's skill registry (`ctx.skills.register`, resource base the skill's
folder) wherever the host has one, so the console's templates and any session find them without
an install. A skill is its `SKILL.md` (the model's instructions), a `template/` runtime the agent
copies beside the data file it writes, and a `check.mjs` that runs the runtime's own
`checks:start`…`checks:end` block on that file without a browser (a headless browser in the
agent's shell proved too unreliable to rely on). The agent never writes HTML or CSS.

- `teamwork-slides`: `deck.js`. The runtime computes each layout once as positioned elements on a
  1280x720 canvas, draws them as HTML, prints them to PDF and exports the same elements with
  pptxgenjs (pinned on jsDelivr with its integrity hash), so the page and the PowerPoint file
  match and stay editable.
- `teamwork-research`: `report.js`. The runtime draws the answer, sections with numbered
  citations, gaps and sources; prints to PDF and saves Markdown with footnotes. Its checks hold the
  citations together: every `[n]` names a source, every source is cited, has a URL, an access date
  and a quote from the page, and a figure outside the summary carries a citation.

Saving a file from a published artifact needs the artifacts sandbox's `allow-downloads` (platform
`docs/tech/artifacts.md`).

## Teamwork search

`src/web-search.ts` registers a web search provider, id `teamwork`, with DSH's web seam (`ctx.web`)
while the signed-in server offers search: after each sync the plugin asks `GET /api/web/search`, and
registers on `available: true`, unregisters on a 404, 401 or 403, and keeps its last answer when the
server cannot be reached. A search is `POST /api/web/search` with `{ query, count }` (count at most 20)
and the plugin's Bearer, nothing else; the server answers `{ sources }` in the seam's shape. The
hosted service offers it on its own DeepSeek key; a self-hosted server has no such route, so nothing
is registered there. DSH's default provider is unchanged: a member picks Teamwork under **Web search
and fetch** in DSH's settings. A refusal is worded for the model: a spent daily allowance (429), a
lapsed sign-in (401), any other failure with its status.

## Team knowledge

`src/knowledge-sync.ts` (`KnowledgeSync`) keeps a read-only copy of what the member reads of
each team's knowledge (the platform's `docs/tech/knowledge.md`). It runs at the end of
`ConfigSync`'s flight, after a successful configuration sync, so it shares the interval and never
overlaps itself; its failure is logged as `Teamwork knowledge sync failed: …` (a status and code,
a file system error code, or "could not be reached", never a transport message) and never fails
the configuration's sync. A server without `GET /api/knowledge` (404) holds no knowledge.

- The copy is `teamwork-knowledge/{team}/{space}/{folder…}/{title}.md` beside the cache, as
  `teamwork-packages` is. Each segment is made safe for any file system (`segment`: no separators,
  control or reserved characters, no leading dot, so grep and ripgrep do not skip it as hidden, no
  trailing dot or space, no Windows device name, at most 160 bytes); names that still collide,
  compared without case, take ` ({id})`, and a folder never ends in `.md`.
- A file is the document's text under `knowledge: {documentId}@{version}`, first in the text's own
  front matter when it opens with some, else in a block of its own; `stripFrontMatter` is its exact
  inverse. Files are written beside the tree, made 0444 and renamed into place.
- `<cache>.knowledge.json` maps each document id to its team, version and path. A sync fetches
  `GET /api/teams/{teamId}/knowledge/documents/{id}?version=n` only for a new or changed version or
  a missing file, renames a document whose path changed, then deletes every file the state does not
  name and every empty folder. A document that cannot be fetched keeps the version it had.
- `TeamworkClient.clear` (sign-out, a new sign-in, a 401/403 on `configs`) removes the copy and its
  state; a sync that finds the account changed under it removes them again when it finishes.

While the copy holds a document, every session gets the `teamwork:knowledge` system prompt section
(`knowledgeGuide` in `src/preset-context.ts`, order 95): the copy's absolute path, that it is
read-only, to search it with grep rather than list it, to cite
`knowledge:{documentId}@{version}#{heading}`, to name a conflict between documents and a gap in
them, and to change a document only by proposing. It says "documents (pages)" (platform ADR 0069).

`src/knowledge-tool.ts` registers `teamwork_knowledge` with one action, `propose`: `documentId`,
`baseVersion`, `note`, and `content` or `path` (a file inside the session's folder, after following
links, at most 1 MiB). The team is the synced document's. The copy's `knowledge:` line is removed,
and one naming another document or version is refused. It posts
`POST /api/teams/{teamId}/knowledge/documents/{id}/proposals` with `{ baseVersion, text, note,
computer, sessionId }`; the server records a plugin's change as an agent's proposal, so the tool
cannot write a version or change access. A sent proposal's card is
`presentationMeta.teamworkKnowledgeProposal`; `knowledge_stale` is answered with the current version
and text, for the agent to reapply its change.

## Host and browser boundary

The package declares `dsh.bundle.patch` and `dsh.client`, exporting its browser
entry as `./client`. `cordis.patch.yml` inserts one root entry. A manual development
patch uses `insert` with an absolute path to `lib/index.js`; normal installations
load the package's patch automatically and must not duplicate that entry.

`src/panel.ts` defines `/api/teamwork/*`. The browser calls these host routes;
DSH admits only its owner. The platform token remains in the host. Commands and
panel actions reuse operations. Session continuation/retry/cancellation are commands.
State polls wait for the previous request, failures preserve the displayed data,
and dependency inventory is shared only within one state request.

The server selection persists beside the cache as `<cache>.server.json`. The owner's native Web switch (`NativeWebSwitch`, `src/web-relay.ts`) is `<cache>.web.json`, mode 0600, whose presence means on; signing out or changing server removes it. `WebTunnels` in the same file counts the tunnels it serves for the panel and status, and `disconnectNativeWeb` ends them and sends the relay `webRevoke`.
Changing it revokes the old token at its server and clears old identity/resources.
The token persists as `<cache>.token.json` (`{ server, token }`, mode 0600,
replaced atomically) and is restored only for the same server; it names a
revocable grant that lapses after 30 days unused (platform ADR 0060). Logout
and a 401/403 from `configs` delete it; logout also sends
`DELETE /api/auth/plugin/token`. A `tokenFile` host never writes it. Configuration
caches use private file permissions and atomic replacement. Periodic/manual sync
requests coalesce; unload stops timers and waits before releasing registrations.
401/403 clear team resources and suspend automatic sync. Network/schema failures
retain the previous snapshot. Sync never installs plugins or uploads conversations.

## Models and preset generations

Each team is its own provider, `teamwork-platform-<teamId>`, named `Teamwork <team>`
(`teamGroupName`), so DSH's model menu groups a team's models under that heading,
apart from the member's own providers; the configuration
ID is the wire model. Each team model is described by the model its configuration
calls (`data.model`), which DSH, the console and the phone show under its name in
place of the configuration ID. The routes follow the synced teams (`teamRoutes`).
`src/platform-models.ts` adapts text, tool calls and streamed output to the chosen
service's `/api/llm/chat/completions`. There is no provider-direct fallback or
local provider-key lookup. Model capability values come from team configuration.
A model, or a preset's model, without `contextWindow` is not guessed: the adapter
does not offer it; selection, readiness, `agent/request` and sync report
`modelLimitProblem` (`say('model.noContextWindow')`), and the panel words
`contextWindowMissing` itself. (A guessed 32K window left DSH's compaction,
which reserves 64K headroom by default, no budget: `MODEL_SWITCH_COMPACTION_FAILED`.)
A missing output limit uses 4096, bounded by the context window.
A hosted model its service took out of service carries `offline: true` in its
`data` and stays in the team: the adapter does not offer it, or a preset on it,
`modelLimitProblem` says `model.offline` first, and the panel words
`modelOffline`. It is offered again as soon as a sync brings it back without
the mark.
Multimodal input and other provider protocols are not implemented by this adapter.

Presets use native `agentPresets` registration, mounting, selection and revisions.
A team preset composes the plugin rows of the profile's declared default preset
(DSH's `standard`: its tools, persona, compaction and planning, read from the
loader as the preset registers) and then its own team context, so a template's
required tools such as `read`, `bash` or `web_search` are DSH's own. A profile
whose default is not a `dsh-agent-preset` row gives team presets no host rows,
and the plugin logs a warning. A preset has one of inherited selection, same-team model reference, or legacy
explicit provider/model. Human-readable instructions/output notes are not system
instructions; behavior belongs in `systemPrompt`. Team prompts are additive.
Required tools and pinned plugin dependencies are checked when selecting and
before team inference; optional tools warn. Tool registration is not permission.
Package-to-tool ownership is declared by the team, not inferred from DSH.

Started sessions keep their native generation. `<cache>.sessions.json` privately
records team/preset/version stamps instead of adding unknown events to DSH logs.
A restored session with an incompatible stamp is blocked; historical deleted
preset definitions are not reconstructed. Unstamped/forked sessions are stamped
on first inference. A pinned revision does not freeze current server permissions,
routing or budgets.

Task summaries use native session projections; `teamworkStep` gives the phone's
session list a running turn's tool-call count and the latest call's target (its
first line, at most 120 characters, never file contents). Follow-up/recovery checks model,
team access, generations and dependencies before admission. Retry confirms a new
recovery instruction for failed/blocked/cancelled/truncated/interrupted work; it
never replays tools. Queued/guidance input is not bypassed. Cancellation keeps
inbox/file changes; concurrent or cancelled preparation cannot dispatch a new turn.
Errors report bounded categories without upstream response bodies.

## Assistant and private resources

Tools bind to the active preset's team and current account epoch. DSH's actual
approval pipeline gates mutations, even in permissive sessions. Review reads
frozen server contents and checks revisions. Provider secrets and initial account
passwords use the console's forms. Server membership/role checks remain authoritative.

The tools' parameter schemas spell out a preset's fields (`PresetData`) and each
read's filters under the server's own names (`since`/`until` for usage), and a
filter a route would ignore is refused; a refused change returns the server's
error code and its field issues, so the model can correct itself. The built-in
assistant (`builtin: team-assistant`) also gets `ASSISTANT_GUIDE`
(`src/preset-context.ts`), a system prompt section ahead of the team's own
prompt: it is proactive, acts within the member's role, drafts a complete preset
before proposing or changing one, and uses only the Teamwork tools. It ships
with the plugin, so teams created before it get it too.

Local packages are prepared without lifecycle scripts and inspected before upload.
After review, private downloads authenticate to the service, verify SHA-256 and
persist a private content-addressed archive before installing disabled and checking
conflicts. Exact historical pins remain installable. Existing local plugins use
the host's separate update flow. See the community server's
[resource contract](https://github.com/dsh-teamwork/dsh-teamwork-platform/blob/main/docs/tech/team-assistant.md).

## Host-provided token

`tokenFile` (`src/token-file.ts`) is for hosts that sign DSH in themselves, such
as a DSH Teamwork cloud computer, where a supervisor writes a short-lived token
after DSH has booted. The file is polled once a second with `watchFile`, which
sees an atomic replacement that a directory watch can miss, and only a changed
value reaches `TeamworkClient.useToken`. Renewing one token with another keeps
the session revision, so pending approvals and preset stamps survive renewal;
gaining or losing a token moves it, and losing one drops the cache. A 401/403
still clears the token until the file changes. In this mode the relay is never
opened, and sign-in, sign-out and server changes are refused: the server reaches
a cloud computer itself, and the token belongs to the host, not a member.
The server reaches it through DSH's own web server: streams on DSH's
`/api/remote.mux`, and a phone's unary calls on `POST /api/teamwork/bridge`
(`bridgeRoute` in `src/bridge.ts`), registered only in this mode. Its body is a
relay `call` frame's `{ id, method, body }` and its answer the `result`'s
`{ status, body }`, through the same allow-list and session operations, under
the one pairing `cloud`; DSH's sign-in guards it as it guards `/api/`.
A host in this mode may also name local MCP servers in `mcpServers`
(`{ <name>: { command, args } }`, stdio): the plugin registers each with DSH's
MCP manager (`ctx.mcpManager.register`) for its own lifetime, so they never
replace the servers the owner configured in Settings. A cloud computer names
its desktop's browser this way, Playwright's MCP server over CDP.

## Phone transport

The hosted relay is optional and discovered through `GET /api/relay`. The host
connects out over WebSocket using its in-memory token and `<cache>.host.json`
identity. Logout disconnects it. A relay that refuses the account as no team
member (close 4401) stops the link until sign-in, or until a config sync finds a
team; one replaced by another connection from this computer (4409) waits for
sign-in only, so the two never take turns. Only confirmed pairings can reach allowlisted
DSH calls. Headless-only hosts return 503. Pairing is account/host-wide, not
limited by the panel's team filter. Model selection changes a session, not the
computer's default. Notifications omit conversation/question contents and session IDs.

Phone and desktop pin Ed25519 identities and authenticate through libp2p Noise XX.
A single-use six-letter locator and matching eight-digit safety codes establish
trust, with phone confirmation and desktop approval. QR links pin the desktop
public key. Missing/changed keys require new pairing; plaintext has no fallback.
After Noise authentication, endpoints exchange independent AES-256 sending keys.
Payloads use native AES-256-GCM (Node/OpenSSL and Expo Crypto), authenticating the
channel, direction and monotonic counter. Replay, reordering, cipher failure and
exhausted key budgets close the channel. The relay sees metadata, timing and
sizes but cannot read encrypted request content. Team gateway model traffic is
outside this channel. Upgrade relay and both clients together.

`src/secure-channel.ts` matches the mobile implementation, checked by integration
tests. `src/phone-security.ts` gates every request on the devices trusted here.
`<cache>.phone-keys.json` atomically stores the identity seed and account/server
peers with restrictive permissions. Desktop revocation saves trust removal and
closes the channel before notifying the relay; phone revocation needs an encrypted
acknowledgement and can wait for an offline host.

`src/pin-lock.ts` is the owner's optional PIN lock (`<cache>.pins.json`, mode
0600): one four-digit PIN, set or turned off in the Teamwork panel or with
`dsh-teamwork pin set | clear`, kept as scrypt under the key `owner`, with a
failure count that survives a restart. Once a channel is authorized,
`PhoneSecurity` tells the device `pinRequired`, answers `unlock` with
`unlocked`, `pinWrong` or `pinLocked` (a device never sets the PIN: `setPin` is
answered as if asked again), and refuses every call (`teamwork/locked`) and
stream until unlocked, and again after fifteen minutes with nothing sent. Five
wrong PINs lock every device until `/teamwork pin reset` clears the PIN, which
keeps the lock on until a new one is set. The PIN outlives a sign-out.

Whatever the bridge sends back fits one 1 MiB message of the encrypted channel
(`fitFrame`): long strings are cut short, a snapshot or a page keeps its newest
records and says `hasMore`, and a stream frame that still cannot fit ends its
stream with `too_large` rather than closing the channel.

File intake uses `teamwork/uploadStart`, `uploadChunk`, `uploadFinish` and
`uploadCancel` after native admission. Receipt/transfer identity binds pairing and
session. Staging works during a busy/unavailable model; prompt readiness is checked
on send. Budgets: five files, 20 MiB each, 50 MiB total, 256 KiB chunks, one active
transfer per pairing and two per host. Idle/total expiry is 60 seconds/five minutes;
completed receipts expire after ten minutes. Cancellation/revocation release
transfer state, not stored DSH objects or workspace files. Native file receipts and
stable request IDs support deduplication. Ordinary files are supported; image input
and document extraction are not implemented in this slice.

A session's list row offers what DSH's own sidebar does that fits a phone:
`session/rename`, and `workspace/pinSession`, `unpinSession`, `archiveSession`
and `unarchiveSession`, each passed on only as `{ sessionId }` (a rename adds
`title`), so `stopActivity` never reaches DSH and a running session's archive
is refused as `workspace/session-active`. `session/list` marks every item with
`teamwork: { pinned, archived, workspace }` from DSH's workspace registry
(`pinnedSessionIds`, `archivedSessionIds`, and `list()` with each workspace's
`sessionIds`): `workspace` is `{ id, title, index, position }`, the workspace
that lists the session and both places in DSH's own order, or null for
Ungrouped, so a client groups the list as DSH's sidebar does. A client hides
the actions where an item has no mark, an older plugin's list. Forking
and opening a session in another app stay on the desktop.

A computer's automation tasks, DSH's Schedule, are passed on unchanged
(`SCHEDULE_CALLS` in `src/bridge.ts`): `schedule/catalog`, `history`,
`create`, `edit` (update, pause, resume, delete) and `run`, with
`schedule/changed` on `$events` after each committed change (the server's ADR
0066).

A session's permission preset (DSH's `@deepseek-ai/dsh-permission-presets`:
read-only, workspace write, full access and whatever else DSH composes) is in
`teamwork/configuration`'s `permissions` (`src/phone-permission.ts`): the
offered presets, the session's current one and the default. Each is `risky`
when it leaves the workspace's sandbox or skips approval, which a client
confirms once. `teamwork/selectPermission` (`{ sessionId, preset }`, the
preset one word) switches an idle session by running DSH's own `/permission`
command in process (`commands.execute`), as DSH's picker does, so the switch is
logged in the session; a preset DSH does not offer is `teamwork/invalid_request`.

A session's files are read, never written, through `teamwork/listFiles`
(`{ sessionId, path }`), `teamwork/searchFiles` (`{ sessionId, query }`, by
name) and `teamwork/readFile` (`{ sessionId, path }`), all in
`src/phone-files.ts` and all under the session's working directory: a path is
resolved to its real path first, so neither `..`, an absolute path elsewhere
nor a symbolic link reaches past it, and what does is `not_found`. DSH's own
`workspaceFiles` reads beyond the workspace, so it is not passed on. A folder
lists at most 500 entries, a search walks no link, `.git` or `node_modules`
and returns at most 200 names, and a file gives its first 256 KiB as text; one
with a NUL byte is `teamwork/not_text`.

## Publishing

Update `package.json`, build and commit the matching `lib/`, and merge reviewed
changes to main. A matching `v<version>` tag runs `.github/workflows/publish.yaml`:
its package job builds, verifies committed output, tests and packs; the protected
stage job verifies the exact SHA-256 and uses trusted OIDC publishing with lifecycle
scripts disabled. No npm token is stored in the repository.

A maintainer completes npm 2FA approval with `npm stage approve <stage-id>` after
checking `npm stage list`. A staged package is not public. `PUBLISHING=off` pauses
staging. The npm Trusted Publisher points at this repository, workflow and
`npm-release` environment. Run `npm pack --ignore-scripts --dry-run --json` to inspect the file list for
both READMEs, guides and images.

Keep `screenshots.json` to 1–8 relative GitHub-hosted images. Public catalog entries
belong in Awesome DSH's `data/plugins/<owner>__<repo>.yml`; never edit its generated
README or add an `npm:` key. dsh.so's existing entry is
[dsh-teamwork-2](https://www.dsh.so/artifact/dsh-teamwork-2/); update that record
rather than the unrelated same-name repository. Community verification remains
the community's own result, not this project's CI status.
