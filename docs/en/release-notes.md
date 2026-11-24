# Release notes

## Next release

- A session list names each workspace's registered parent folders
  (`teamwork.workspace.ancestors`: id, title and place, root first), so the
  console and the app can show workspaces as a tree. Folder paths stay on this
  computer; a Windows path matches its parent in any case and with either
  separator.
- A paired phone or browser manages this computer's automation tasks (DSH's
  Schedule): the bridge passes on `schedule/catalog`, `history`, `create`,
  `edit` and `run` unchanged, and the server's console and app draw them.
- Team DSH (a shared DSH signed in with a team host key) is removed. The
  `dsh-teamwork-audit` command and the `@hpke/core` dependency go with it. A
  DSH left in shared mode by an older plugin no longer cleans up its
  `<cache>.shared.json`, `<cache>.shared-roster.json` and `<cache>.audit.json*`
  files; nothing reads them, and they can be deleted.
- Native Web Relay adds the runtime dependency `ws@8.23.0`. The outbound
  desktop connector uses its WebSocket stream to apply backpressure to uploads.
