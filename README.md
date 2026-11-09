# @dsh-teamwork/dsh-teamwork

Team collaboration plugin for DeepSeek Harness.

## Features

- Connect your local DSH to dsh-teamwork.com
- Sync local sessions to the cloud for team visibility
- Pull team presets, skills, and model policies
- Report audit events to the team workspace

## Installation

### From npm

```bash
dsh plugin --profile web add @dsh-teamwork/dsh-teamwork
```

### From GitHub

```bash
dsh plugin --profile web add github:dsh-teamwork/dsh-teamwork
```

## Configuration

After installation, edit your profile configuration:

```yaml
- id: dsh-teamwork
  name: '@dsh-teamwork/dsh-teamwork'
  config:
    apiEndpoint: https://api.dsh-teamwork.com
    autoSync: true
    syncIntervalMs: 300000
```

## Development

```bash
pnpm install
pnpm build
pnpm watch
```

## Security

This plugin only sends data to `api.dsh-teamwork.com`. No local code or files are uploaded without explicit user action. Session synchronization is opt-in per session.
