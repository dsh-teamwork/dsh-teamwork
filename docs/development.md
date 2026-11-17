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

Team models use `teamwork-platform` with the configuration ID as wire model.
`src/platform-models.ts` adapts text, tool calls and streamed output to the chosen
service's `/api/llm/chat/completions`. There is no provider-direct fallback or
local provider-key lookup. Model capability values come from team configuration;
missing context/output limits use 32K/4096, with output bounded by context.
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

## Phone transport

The hosted relay is optional and discovered through `GET /api/relay`. The host
connects out over WebSocket using its in-memory token and `<cache>.host.json`
identity. Logout disconnects it. Only confirmed pairings can reach allowlisted
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
