# 🌸 Grove Bloom

> *Personal serverless remote coding agent infrastructure*

**"Text it and forget it."** Send a task from your phone, an autonomous coding agent works until done on a transient VPS, commits code, and the infrastructure self-destructs. Work that happens in the quiet hours, blooming into results by morning.

---

## 🎯 Overview

Grove Bloom orchestrates a complete remote development environment:

- **Mobile-first dashboard** for controlling coding sessions from anywhere
- **Transient Hetzner VPS** with Kilo Code CLI agent in autonomous mode
- **Cloudflare infrastructure** for orchestration, storage, and state
- **Auto-shutdown** on task completion or idle timeout
- **Cost-optimized**: <$1/month for ~20 hours coding + AI inference

### Key Features

✅ Start/stop coding sessions from your phone
✅ Choose EU (cheap) or US (fast) compute regions
✅ Web terminal access (ttyd over HTTPS)
✅ Automatic R2 sync on shutdown (no data loss)
✅ DeepSeek V3.2 + GLM 4.6V dual-model AI brain
✅ Session history and cost tracking
✅ Multi-project workspace support

---

## 📁 Project Structure

```
GroveBloom/
├── packages/
│   ├── dashboard/          # SvelteKit mobile-first UI
│   ├── worker/             # Cloudflare Worker orchestrator
│   └── vps-scripts/        # VPS provisioning scripts
├── schemas/
│   └── d1-schema.sql       # D1 database schema
├── scripts/
│   ├── setup-cloudflare.sh # Create R2 buckets, D1 database
│   ├── prepare-repos.sh    # Clone and upload repos to R2
│   └── set-secrets.sh      # Configure worker secrets
├── docs/
│   ├── grove-bloom-spec.md # Complete specification
│   └── diagrams.md         # Architecture diagrams
├── AgentUsage/             # Development workflow guides
└── secrets_template.json   # API key template
```

---

## 🚀 Quick Start

### Prerequisites

- [pnpm](https://pnpm.io/) 9.0+
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI
- [rclone](https://rclone.org/) (for R2 sync)
- Accounts: Cloudflare, Hetzner Cloud, OpenRouter

### 1. Clone and Install

```bash
git clone https://github.com/AutumnsGrove/GroveBloom.git
cd GroveBloom
pnpm install
```

### 2. Configure Cloudflare

```bash
# Authenticate
wrangler login

# Create resources (R2 buckets, D1 database)
./scripts/setup-cloudflare.sh

# Set worker secrets
./scripts/set-secrets.sh
```

### 3. Prepare Repositories

Edit `scripts/prepare-repos.sh` to configure your repos, then:

```bash
# Clone repos, install deps, upload to R2
./scripts/prepare-repos.sh
```

### 4. Deploy

```bash
# Deploy worker
cd packages/worker
pnpm deploy

# Deploy dashboard (via Cloudflare Pages)
cd ../dashboard
pnpm build
# Deploy to Pages via wrangler or dashboard
```

### 5. Configure Secrets

Copy `secrets_template.json` to `secrets.json` and fill in your credentials:

```bash
cp secrets_template.json secrets.json
# Edit secrets.json with your API keys
```

---

## 💰 Cost Breakdown

### Typical Month (~20 hours coding)

| Component | Cost |
|-----------|------|
| Hetzner CX33 (EU, 20hr) | ~$0.17 |
| Cloudflare R2 (7GB storage) | ~$0.11 |
| Cloudflare D1 (reads/writes) | Free tier |
| Cloudflare Workers | Free tier |
| OpenRouter (DeepSeek, 2M tokens) | ~$0.60 |
| **Total** | **~$0.88** |

### Region Pricing

- **EU (Falkenstein)**: €0.008/hr (~$0.0085) • 90-100ms latency to US
- **US (Ashburn)**: €0.021/hr (~$0.022) • 20-30ms latency to US

Toggle regions per session based on your needs.

---

## 🏗️ Architecture

### Components

**Frontend (Dashboard)**
- SvelteKit 2+ (Svelte 5 runes)
- Deployed to Cloudflare Pages
- Mobile-first responsive design

**Orchestrator (Worker)**
- Cloudflare Worker with Hono framework
- Manages VPS lifecycle (provision/terminate)
- R2 sync coordination
- WebSocket proxy for terminal

**Compute (VPS)**
- Hetzner Cloud (CX33 EU or CPX31 US)
- Kilo Code CLI in autonomous mode
- ttyd web terminal (HTTPS/WebSocket)
- Bloom daemon (heartbeat, idle detection)

**Storage & State**
- **R2 `bloom-repos`**: Cloned repos + node_modules
- **R2 `bloom-state`**: Workspace snapshots, Kilo context
- **D1 `bloom-db`**: Sessions, tasks, config

### Lifecycle States

```
OFFLINE → PROVISIONING → RUNNING → IDLE → SYNCING → TERMINATING → OFFLINE
```

**Shutdown Triggers:**
- Idle timeout (default: 2 hours)
- Task completion (autonomous mode)
- Manual stop

See [`docs/diagrams.md`](docs/diagrams.md) for visual architecture.

---

## 📖 Documentation

- **[Complete Specification](docs/grove-bloom-spec.md)** - Full technical spec
- **[Architecture Diagrams](docs/diagrams.md)** - Visual reference
- **[D1 Schema](schemas/d1-schema.sql)** - Database structure
- **[VPS Scripts](packages/vps-scripts/README.md)** - Cloud-init and daemons
- **[Worker README](packages/worker/README.md)** - API and webhooks
- **[Dashboard README](packages/dashboard/README.md)** - UI components

---

## 🛠️ Development

### Monorepo Commands

```bash
# Install all dependencies
pnpm install

# Dev mode (all packages)
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Run specific package
pnpm dashboard:dev
pnpm worker:dev
pnpm worker:deploy
```

### Local Development

**Dashboard:**
```bash
cd packages/dashboard
pnpm dev
# http://localhost:5173
```

**Worker:**
```bash
cd packages/worker
pnpm dev
# http://localhost:8787
```

---

## 🔐 Security

- All secrets stored in Cloudflare Worker secrets (encrypted)
- `secrets.json` in `.gitignore` (never committed)
- Webhook authentication via shared secret
- Heartwood OAuth 2.0 + PKCE for dashboard auth
- VPS auto-terminates on idle (no long-running exposure)

---

## 🧪 Testing

```bash
# Test worker locally
cd packages/worker
pnpm dev
curl http://localhost:8787/api/status

# Test dashboard
cd packages/dashboard
pnpm dev
# Open http://localhost:5173
```

---

## 🚢 Deployment Checklist

- [ ] Cloudflare account with Workers, R2, D1, Pages enabled
- [ ] Hetzner Cloud account with API token
- [ ] OpenRouter account with API key
- [ ] Heartwood auth configured (or alternative OAuth)
- [ ] DNS record for `bloom.grove.place` (or your domain)
- [ ] R2 buckets created (`bloom-repos`, `bloom-state`)
- [ ] D1 database created and schema applied
- [ ] Worker secrets set (see `scripts/set-secrets.sh`)
- [ ] Initial repos prepared and uploaded to R2
- [ ] Worker deployed and tested
- [ ] Dashboard deployed to Cloudflare Pages

---

## 🤝 Contributing

This is a personal infrastructure project. Feel free to fork and adapt for your own use!

If you find issues or have suggestions:
1. Open an issue describing the problem/idea
2. Submit a PR with fixes or enhancements
3. Follow the conventional commits format (see `AgentUsage/git_guide.md`)

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Credits

- **Kilo Code CLI** - [@kilocode](https://github.com/kilocode/cli)
- **Hetzner Cloud** - Affordable European VPS
- **Cloudflare** - Workers, R2, D1, Pages platform
- **DeepSeek** - Cost-effective reasoning model
- **ttyd** - Web terminal over HTTPS
- **BaseProject** - Development workflow patterns

---

*Last updated: 2025-12-19*
*Status: Initial scaffolding complete*
