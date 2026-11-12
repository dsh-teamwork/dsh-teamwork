# Basic Usage

## Install

```bash
dsh plugin --profile web add github:dsh-teamwork/dsh-teamwork
```

## Configure

Edit `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- id: dsh-teamwork
  name: '@dsh-teamwork/dsh-teamwork'
  config:
    apiEndpoint: https://api.dsh-teamwork.com
    autoSync: true
```

## Sign In

Open the DSH web UI, choose **Teamwork** in the left sidebar and sign in from the panel, or run `/teamwork login` in the command box.
