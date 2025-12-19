# VPS Scripts

Scripts for provisioning and managing Hetzner Cloud VPS instances for Grove Bloom.

## Files

### `cloud-init.yaml`
Complete cloud-init configuration for Hetzner Cloud. Includes:
- Package installation (Node.js, pnpm, Kilo Code, rclone, ttyd)
- Service configuration (ttyd, bloom-daemon)
- R2 sync on boot
- Webhook notification when ready

### `daemon.sh`
Bloom daemon that runs on the VPS to:
- Monitor terminal activity
- Send heartbeats to the worker
- Trigger shutdown on idle timeout
- Handle graceful shutdown

### `sync-to-r2.sh`
Syncs workspace state to R2:
- Compresses and uploads node_modules
- Syncs Kilo Code context
- Creates workspace snapshot
- Uploads to bloom-state bucket

### `run-task.sh`
Wrapper for autonomous task execution:
- Runs Kilo Code in autonomous mode
- Reports task completion via webhook
- Triggers auto-shutdown if configured

## Usage

These scripts are embedded in the `cloud-init.yaml` and deployed automatically when the VPS is provisioned.

### Manual Testing

To test individual scripts:

```bash
# Test sync
export R2_ACCESS_KEY="..."
export R2_SECRET_KEY="..."
export CF_ACCOUNT_ID="..."
./sync-to-r2.sh

# Test task runner
export WEBHOOK_URL="https://bloom.grove.place/api"
export WEBHOOK_SECRET="..."
./run-task.sh "Implement feature X"

# Test daemon (runs indefinitely)
export IDLE_TIMEOUT=7200
export WEBHOOK_URL="https://bloom.grove.place/api"
export WEBHOOK_SECRET="..."
./daemon.sh
```

## Environment Variables

Required for VPS operation:

- `WEBHOOK_URL` - Worker API base URL
- `WEBHOOK_SECRET` - Authentication token
- `IDLE_TIMEOUT` - Idle timeout in seconds (default: 7200)
- `R2_ACCESS_KEY` - R2 access key
- `R2_SECRET_KEY` - R2 secret key
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `OPENROUTER_API_KEY` - OpenRouter API key
- `AUTO_SHUTDOWN` - Auto-shutdown on task completion (true/false)

## Systemd Services

Created by cloud-init:

- `ttyd.service` - Web terminal on port 7681
- `bloom-daemon.service` - Bloom monitoring daemon

```bash
# Check service status
systemctl status ttyd bloom-daemon

# View logs
journalctl -u ttyd -f
journalctl -u bloom-daemon -f
```
