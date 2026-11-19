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

The server selection persists beside the cache as `<cache>.server.json`.
Changing it clears old identity/resources. Tokens are memory-only. Configuration
caches use private file permissions and atomic replacement. Periodic/manual sync
requests coalesce; unload stops timers and waits before releasing registrations.
401/403 clear team resources and suspend automatic sync. Network/schema failures
retain the previous snapshot. Sync never installs plugins or uploads conversations.

## Models and preset generations

Each team is its own provider, `teamwork-platform-<teamId>`, named for the team, so
DSH's model menu groups a team's models under the team's name; the configuration
ID is the wire model. The routes follow the synced teams (`teamRoutes`).
`src/platform-models.ts` adapts text, tool calls and streamed output to the chosen
service's `/api/llm/chat/completions`. There is no provider-direct fallback or
local provider-key lookup. Model capability values come from team configuration.
A model, or a preset's model, without `contextWindow` is not guessed: the adapter
does not offer it; selection, readiness, `agent/request` and sync report
`modelLimitProblem` (`say('model.noContextWindow')`), and the panel words
`contextWindowMissing` itself. (A guessed 32K window left DSH's compaction,
which reserves 64K headroom by default, no budget: `MODEL_SWITCH_COMPACTION_FAILED`.)
A missing output limit uses 4096, bounded by the context window.
Multimodal input and other provider protocols are not implemented by this adapter.

Presets use native `agentPresets` registration, mounting, selection and revisions.
A preset has one of inherited selection, same-team model reference, or legacy
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

## Shared mode

`src/shared-mode.ts` makes a DSH its team's shared DSH (the server's
`docs/tech/shared-dsh.md`, part of the community edition). `/teamwork share enable <key>` trades a team
host key for a one-hour host token (platform ADR 0047): the server's nonce is
signed with this DSH's identity key from `<cache>.phone-keys.json`, and the first
exchange binds the key to that identity, so a copied key is refused elsewhere.
The key is saved to `<cache>.shared.json` (mode 0600) only once accepted, the
token reaches `TeamworkClient.useToken` like a host-provided one, and it is
renewed ten minutes before it ends, or a minute after a failure that may pass;
a key the server no longer accepts drops the token. Enabling signs a personal
account out first, and while shared, sign-in and sign-out are refused and the
relay connects with the host token. A host-provided token (`tokenFile`)
excludes shared mode.

`src/shared-roster.ts` is the DSH's own roster (`<cache>.shared-roster.json`,
mode 0600): invites (a single-use secret per listed member, kept as a hash, a
day long), each member's paired devices, and each session's starter. A member's
handset joins through the relay, pins this DSH's key from the invite, and hands
the secret over inside the channel; `PhoneSecurity` admits it through the
roster instead of a safety code. The relay's `members` list prunes the roster.
`src/shared-owner.ts` is what the bridge asks before any call or stream and
after `session/create` and `session/list`: a member reaches only sessions they
started, sees only their events, and answers only questions they were shown.
Whatever the bridge sends back fits one 1 MiB message of the encrypted channel
(`fitFrame`): long strings are cut short, a snapshot or a page keeps its newest
records and says `hasMore`, and a stream frame that still cannot fit ends its
stream with `too_large` rather than closing the channel.

`src/pin-lock.ts` is the PIN lock, on a shared DSH and on a personal computer
alike (`<cache>.pins.json`, mode 0600): one four-digit PIN per member (`owner`
on a personal computer), kept as scrypt, and a failure count that survives a
restart. Once a channel is authorized, `PhoneSecurity` tells the phone
`pinRequired` (with `set` when the member has none yet), answers `unlock` and
`setPin` with `unlocked`, `pinWrong`, `pinLocked` or `pinInvalid`, and refuses
every call (`teamwork/locked`) and stream until unlocked, and again after
fifteen minutes with nothing sent. Five wrong PINs lock the member on every
device until `/teamwork share unlock <email>` or `/teamwork pin reset` clears
it. Signing out, entering or leaving shared mode clears every PIN.

`src/audit-archive.ts` is a shared DSH's audit archive (the server's ADR 0045):
every frame between a member's device and this DSH, both ways, becomes a record
(member, device, direction, time; a string over 64 KiB kept as its length and
SHA-256). Each record is appended as it is made to `<cache>.audit.json.journal`
(mode 0600), so a crash loses none: the next start seals what the journal holds
before anything else, and a batch the state names as sealed is never sealed
twice. Records collect for a minute or 1 MiB, are HPKE-sealed (`@hpke/core`,
exact version) to the admin's audit public key under a header the AEAD binds
(host, sequence, the previous segment's SHA-256, the key's fingerprint), signed
with the identity key the host key is bound to, written to
`<cache>.audit.json.queue/`, and uploaded in order to
`POST /relay/shared/archive`; a segment leaves the queue only once the server
holds it. `<cache>.audit.json` keeps the key and the chain's position. No
member is admitted until `/teamwork share audit-key` sets a key; leaving
shared mode flushes and forgets it. `src/audit-cli.ts` is the
`dsh-teamwork-audit` bin the admin runs on their own machine: `keygen` writes
a key pair (mode 0600, never overwriting), `read` opens an exported archive
and reports a gap, an alteration or another key.

The panel's **Team DSH** page (`Shared` in `src/web/TeamworkPanel.tsx`, the
`share-*` routes in `src/panel.ts`) runs the same functions as
`/teamwork share`; in shared mode `PanelState.shared` is set, no profile is
read, and the header offers that page in place of Phone and Account.

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
tests. `src/phone-security.ts` gates every request on the local roster.
`<cache>.phone-keys.json` atomically stores the identity seed and account/server
peers with restrictive permissions. Desktop revocation saves trust removal and
closes the channel before notifying the relay; phone revocation needs an encrypted
acknowledgement and can wait for an offline host.

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
`teamwork: { pinned, archived }` from DSH's workspace registry
(`pinnedSessionIds`, `archivedSessionIds`); a client hides the actions where an
item has no mark, an older plugin's list. On a shared DSH each action, like any
call naming a session, reaches only the member's own sessions, though pins and
archives land in the DSH's one registry, seen at its keyboard as well. Forking
and opening a session in another app stay on the desktop.

A session's permission preset (DSH's `@deepseek-ai/dsh-permission-presets`:
read-only, workspace write, full access and whatever else DSH composes) is in
`teamwork/configuration`'s `permissions` (`src/phone-permission.ts`): the
offered presets, the session's current one and the default. Each is `risky`
when it leaves the workspace's sandbox or skips approval, which a client
confirms once, and `allowed` unless the DSH is shared and the preset risky:
a Team DSH's members pick only read-only or workspace write, and the rest is
set at its keyboard. `teamwork/selectPermission` (`{ sessionId, preset }`, the
preset one word) switches an idle session by running DSH's own `/permission`
command in process (`commands.execute`), as DSH's picker does, so the switch is
logged in the session; `teamwork/permission_refused` answers a preset that is
not `allowed`.

A session's files are read, never written, through `teamwork/listFiles`
(`{ sessionId, path }`), `teamwork/searchFiles` (`{ sessionId, query }`, by
name) and `teamwork/readFile` (`{ sessionId, path }`), all in
`src/phone-files.ts` and all under the session's working directory: a path is
resolved to its real path first, so neither `..`, an absolute path elsewhere
nor a symbolic link reaches past it, and what does is `not_found`. DSH's own
`workspaceFiles` reads beyond the workspace, so it is not passed on. A folder
lists at most 500 entries, a search walks no link, `.git` or `node_modules`
and returns at most 200 names, and a file gives its first 256 KiB as text; one
with a NUL byte is `teamwork/not_text`. On a shared DSH they reach only the
member's own sessions, like every call naming one.

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
