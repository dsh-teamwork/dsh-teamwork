# Release notes

## Next release

- Team DSH (a shared DSH signed in with a team host key) is removed. The
  `dsh-teamwork-audit` command and the `@hpke/core` dependency go with it. A
  DSH left in shared mode by an older plugin no longer cleans up its
  `<cache>.shared.json`, `<cache>.shared-roster.json` and `<cache>.audit.json*`
  files; nothing reads them, and they can be deleted.
- Native Web Relay adds the runtime dependency `ws@8.23.0`. The outbound
  desktop connector uses its WebSocket stream to apply backpressure to uploads.
