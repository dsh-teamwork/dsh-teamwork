# Using DSH Teamwork

[README](../../README.md) · [简体中文](../zh-CN/guide.md)

Connect a DSH host to your team's service, sync resources, then choose a preset
for a new conversation. Teamwork resources are additive: local configuration
and local default models remain independent.

## Installation and updates

Use the desktop application's **Plugins → Add plugin** for a Desktop profile.
For a CLI web profile use `dsh plugin --profile web add @dsh-teamwork/dsh-teamwork`.
Use the same profile's plugin manager for updates, enabling and diagnostics.
Follow its reload/restart prompts. On the CLI, update with
`dsh plugin --profile web update --latest @dsh-teamwork/dsh-teamwork`; without
`--latest`, a new minor version (0.11 after 0.10) is not picked up.

- **Version rejected:** check the installed plugin and DSH versions. The declared
  range is `>=0.2.2-rc.1 <0.3.0-0`; CI covers rc.1, rc.2 and rc.3. Install a
  compatible published version. A range is a declaration, not a test of every
  future release.
- **A new release is not selected:** some hosts apply a minimum release age.
  Select an exact version that is already visible on the
  [npm versions page](https://www.npmjs.com/package/@dsh-teamwork/dsh-teamwork?activeTab=versions).
  A version in GitHub's main branch may still await npm publication.
- **Build scripts await a decision:** pnpm 11 can stop for dependency scripts.
  Use your host's build review. In an isolated Linux CLI check, explicitly
  denying the `@google/genai` and `protobufjs` scripts allowed installation and
  the basic integration checks to pass. This is separate from DSH compatibility.
- **Installed, but missing in Desktop:** a `web` CLI install does not change
  Desktop's profile. Install through the application.
- **DSH fails after an older plugin install:** earlier packages could install
  their own DSH core dependencies into a hoisted profile. Back up the profile,
  upgrade the plugin and reinstall the profile dependencies using the host's
  recovery flow. Disabling the old plugin alone does not remove those packages.

## Sign in and select a team

Open Teamwork and choose the browser sign-in action. The plugin starts a
loopback callback for up to ten minutes. If the callback is inaccessible,
copy the authorization line shown by the service into the panel or DSH command
input. The one-use authorization code expires after two minutes.

Authorization immediately syncs resources; by default the plugin refreshes
every 60 seconds. Use the team selector to browse one team or all teams.
Browsing another team does not retarget an existing conversation or restrict
phone pairing to that team. A person may belong to several teams.

Each synced team has a **default workspace** on this computer: the folder a
session started for that team opens in, from one of its presets in the panel,
the phone app or the web console, unless the member picks another folder there.
Until you choose one it is DSH's default workspace, or else DSH's first
workspace; only with no workspace at all is it the folder DSH was started in.
Change it on the team's
**Settings** page (**My teams** → **Settings**) from DSH's own workspace menu,
where **Add workspace…** offers any folder. A session started in a workspace is
listed under it in DSH's sidebar; one started in a folder that is not a
workspace is listed under Ungrouped.

The same **Settings** page shows your own last 30 days in that team, laid out
as the web console's **My usage**: calls, points, input tokens (with cache hits)
and output tokens (with reasoning), each day's points, which models (and metered
services, such as a cloud computer) they went to, and your budget with when it
resets and any limit near its end. Points are shown as whole numbers. The web
console's **My usage** has each call.

Create or join teams in the web console. New teams receive a built-in assistant;
existing teams are unchanged. Team renaming does not automatically rename the
assistant. It leads the panel's presets: **Ask the assistant** starts a session
with it, and clicking one of its example questions starts one with that question
already typed in, ready to edit and send. Give it a working model and ask it to inspect real state. While an
administrator browses a team, the panel's header shows how many submissions wait
for review and opens them in the console.

### Without a browser

On a server with no browser, `dsh-teamwork` does what the Teamwork panel does from a shell on that
machine, while DSH runs there as the same user. The copy inside DSH's profile is
not on your `PATH`, so install the commands once (and again after an update):
`npm install -g @dsh-teamwork/dsh-teamwork`.

```sh
dsh-teamwork server https://teamwork.example.com   # a self-hosted team only, before signing in
dsh-teamwork login                # then: authorize <code>
dsh-teamwork status
dsh-teamwork device pair --guided # also: list, accept <id>, reject <id>, revoke <id>
dsh-teamwork web on               # native DSH Web (below); also: off, disconnect
```

It reaches the running DSH through a socket in the plugin's directory in the DSH
home (below), which only that user can open. It runs on Linux and macOS.

With `dsh-teamwork device pair --guided`, keep the pairing screen open on the device. Compare both safety codes, confirm on the device, then type the safety code shown on the device into the terminal.

A personal DSH on a server works the same way: `dsh-teamwork login` prints a
sign-in link to open in any browser. Confirm authorization to reveal the code,
then run `dsh-teamwork authorize <code>` on the server. Use
`dsh-teamwork login --browser` for automatic sign-in with a browser on the
same machine as DSH. `dsh-teamwork status` and `dsh-teamwork sync` follow
the team's configuration. `dsh-teamwork device pair` prints a pairing code and
draws the phone app's QR code in the terminal; a browser types the code under
**My DSH** in the Teamwork web console. `dsh-teamwork device list` then shows
the waiting device's safety code, and what it is (an iOS or Android phone, or
a web browser). When the device shows the same code,
`dsh-teamwork device accept <id>` accepts it; `reject` and `revoke` refuse or
remove one.

## Choose a model or preset

Each team preset shows the avatar its admin chose in the web console, the same one the console and the phone app show.

**Start a session** on a team preset or a team model opens a session on it. An
unsent blank session in that workspace is reused rather than a new one piling
up, and the session already open is left as it is. Started sessions keep their preset generation;
use a new session to adopt an update. A restart cannot promise to reconstruct a
deleted old preset: a version mismatch blocks team inference and gives recovery
guidance.

Required tools and pinned plugin dependencies must be available. Optional
missing tools are warnings. A registered tool still follows DSH's authorization
and runtime conditions. Team model routes go through your service; a preset
that inherits a local model keeps that model instead.

## Share, review and restore

1. Ask the team assistant to prepare a plugin inside the session workspace,
   or submit a preset/plugin through **Sharing and review** in the web console.
2. Review the prepared package identity, version, file list and SHA-256 before
   upload. Preparation does not run package lifecycle scripts.
3. Submit the new resource or update for administrator review. An update names
   the existing configuration and its base version.
4. An administrator inspects the frozen contents and approves or rejects them.
   A conflicting newer publication requires a fresh submission.
5. Members sync the published resource. A plugin still needs a separate local
   installation confirmation; existing local packages are not silently upgraded.

Members see their own submissions. Administrators see the team's submissions.
Assistant writes also need host approval, including for administrators.
Provider secrets and new account passwords belong in the console's forms.

**Versions and backups** shows publication time, author/approver, changes and
retained versions. Exported resources can include retained private plugin bytes.
A restoration prepares a new publication for review; it does not erase history
or replace a running conversation's preset. A resource export is distinct from
a full database-and-file-storage backup managed by the server operator.

![Publication history of a demonstration team](../../assets/readme/versions-and-backups.png)

## Artifacts

Ask the agent for a report, a deck, a dashboard or a diagram and to publish it:
its `teamwork_artifact` tool uploads the artifact to your team, private to you, and the
agent gives you its link in the console; the conversation also shows a card
that opens it beside the conversation in the web console. Asking for a change adds a version; earlier versions stay. An artifact is
an `index.html` with the files it loads, or one `index.svg`,
from a folder in the session's workspace; at most 255 files and 16 MiB a
version. Only you share an artifact, from **Artifacts** in the console, with chosen
members or the whole team; the agent cannot. An artifact shared with you can be opened into
your own session's workspace by your agent, changed, and published as a new
version under your name. Artifacts run sandboxed: an artifact cannot act as
the person viewing it.

## Knowledge

Your team's knowledge, the documents (pages) kept under **Knowledge** in the
console, reaches your agents without being pointed at it. Each sync, the plugin
keeps a read-only copy of every document you may read in `teamwork-knowledge`
beside its cache (`~/.dsh/dsh-teamwork/teamwork-knowledge` by default), one
folder per team and space, and tells every session where it is. The agent
searches it, cites the document and heading an answer rests on as
`knowledge:{documentId}@{version}#{heading}`, and says so when two documents
disagree or when the knowledge does not hold the answer. Only new and changed
documents are downloaded, and a document you may no longer read is deleted from
the copy on the next sync. A document's images and files are beside it, in a
`{title}.files` folder; its text names them as `![[name]]` or `[[name]]`.

An agent never changes a document. Its `teamwork_knowledge` tool sends a
proposal, with any new image or file it names attached (at most 20 MiB each),
and an editor of the document's space accepts or declines it in the
console; until then the document is unchanged. Signing out removes the copy.
Knowledge needs a Teamwork server that offers it.

## Commands

Run these in DSH's command input, not your shell. IDs come from `/teamwork list`.

| Command | Purpose |
| --- | --- |
| `/teamwork login` | Open browser authorization. |
| `/teamwork authorize <code>` | Redeem a fallback authorization code. |
| `/teamwork pin reset` | Clear your own PIN and lock on this computer; set a new one from the Teamwork panel or with `dsh-teamwork pin set`. |
| `/teamwork status` | Show authentication, sync status and recent errors. |
| `/teamwork sync` | Refresh the team's resources. |
| `/teamwork list` | List configuration IDs. |
| `/teamwork info [id]` | Inspect active or available preset details and readiness. |
| `/teamwork new <id>` | Create a session from the latest preset without starting a task. |
| `/teamwork use <id>` | Select a team resource in a blank session. |
| `/teamwork tools` | Inspect visible tool names and conditions. |
| `/teamwork plugins [presetId]` | Check published plugin dependencies. |
| `/teamwork install <id>[@<version>]` | Preview an exact plugin installation; repeat with `confirm` after inspection. |
| `/teamwork session [check]` | Inspect session state; `check` refreshes team access/readiness. |
| `/teamwork continue <instruction>` | Send follow-up input after readiness checks. |
| `/teamwork cancel` | Request native cancellation; keep the inbox and existing file changes. |
| `/teamwork retry` | Preview recovery; `retry confirm` sends a recovery instruction, not tool replay. |
| `/teamwork logout` | Revoke the sign-in on the server, and drop the kept token, team cache and team registrations. |

Personal DSH hosts default to PIN protection off. On a headless server, run `dsh-teamwork pin set` and enter four digits at the hidden prompt. Run `dsh-teamwork pin clear` to disable PIN protection. Paired phones and remote web clients only verify the PIN. In the device pairing panel on the computer, set a four-digit PIN to enable it, change it, or turn it off. The PIN and any lockout belong to this host and persist when the signed-in account changes. The new owner can change or disable the PIN locally in the pairing panel.

Continue and retry do not jump ahead of queued input. A confirmation expires
when its session, model, configuration or login binding changes. Logout leaves
explicitly installed plugins in place. Removed members are refused by the
server on their next request.

## Configuration

The default server is `https://www.dshteamwork.com`. Change it on the sign-in
screen to a self-hosted server. HTTPS is required except on loopback. Changing
servers signs you out and clears the previous server's team resources.

The plugin keeps its sign-in, team cache and device PIN in `dsh-teamwork/` in the DSH home
(`$DSH_HOME`, else `~/.dsh`), wherever DSH was started.

Advanced profile configuration can override the inserted plugin entry:

```yaml
- id: dsh-teamwork
  config:
    apiEndpoint: https://teamwork.example.com
    cachePath: /absolute/path/to/private/teamwork-cache.json
    autoSync: true
    syncIntervalMs: 60000
```

`syncIntervalMs` accepts integer milliseconds from 10000 to 86400000.
`autoSync: false` disables login-triggered and periodic sync; manual sync remains.

A host that signs DSH in itself, such as a DSH Teamwork cloud computer, sets
`tokenFile` to the absolute path of a file holding a plugin token. The plugin
reads it at start and follows every change, including an atomic replacement;
an empty or missing file signs it out. In this mode sign-in, sign-out and
changing servers are refused, `apiEndpoint` names the server, and the phone
relay is never opened.
Do not duplicate the package's `insert` entry in a profile.

To open this DSH's full Web interface from My DSH on the web and from **Sessions → Settings (top right) → Web Relay** in the mobile app, turn on **Native DSH Web** under the device security settings in the Teamwork panel, or, on a server, run `dsh-teamwork web on` (`dsh-teamwork web off` stops it, and `dsh-teamwork status` shows it). It is off by default, and it applies at once, with no restart. It needs this computer's own DSH Web server (`dsh web`) and no device PIN, and it is offered on personal computers only. The Teamwork server terminates HTTPS for this entry and must have its desktop Web domain configured. Signing out or changing server turns it off again. While it is on, the panel shows whether it is in use; **Disconnect all**, or `dsh-teamwork web disconnect`, ends every session open now and leaves the switch on. A session also ends after thirty minutes without traffic, and after eight hours in any case.

## Data and device access

The sign-in is kept beside the cache, readable only by you, so a restart keeps
you signed in; it lapses after 30 days unused. Team configuration is
cached with private file permissions. A stale cache is not authorization.
Network failures preserve it; 401/403 clear team registrations and suspend sync
until sign-in. Provider keys remain on the service; team-model prompts and
context travel through that service's gateway.
Artifacts an agent publishes are stored on the Teamwork server, private until
their owner shares them; the rest of a session stays on the computer.
The knowledge copy holds only what you may read and is removed when you sign out;
a proposal sends the text, its note, this computer's name and the session id.

The hosted service may advertise a relay. A matching Teamwork App and an online
DSH web/desktop host are required. Headless-only hosts return 503 for device
requests. The community edition does not supply the hosted relay.

Pairing requires matching account identity, checking the safety code on both
devices and approval on the computer. It authorizes the owner's permitted
personal and team sessions on this DSH, across teams. It grants no additional
team permissions. A private, authenticated encrypted channel protects device
requests and ordinary file attachments; the relay can still see account/device
metadata, public keys, timing and sizes. The team-model gateway is a separate
boundary. Both endpoints must be on matching protocol versions.

Pairing keys persist locally. Changed or missing trusted keys require pairing
again. Desktop revocation closes the channel immediately; device-side revocation
needs the computer's encrypted acknowledgement and may wait for reconnection.

## Getting help

Use `/teamwork status`, the local plugin manager and your server's console.
Include DSH/plugin versions, OS, profile type, package-manager version and
redacted diagnostics in an [issue](https://github.com/dsh-teamwork/dsh-teamwork/issues).
Remove tokens, authorization lines, pairing codes, provider keys and private
team data before posting. [Developer details](../development.md) cover tests and protocols.
