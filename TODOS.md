# Grove Bloom Implementation TODOs

> **Status**: Phase 4 Worker Development complete
>
> **Next**: Set up Cloudflare resources (Phase 1) or continue to Phase 5 (Dashboard)

---

## ✅ Phase 0: Project Initialization (COMPLETE)

- [x] Create monorepo structure with pnpm workspaces
- [x] Scaffold dashboard package (SvelteKit)
- [x] Scaffold worker package (Cloudflare Workers + Hono)
- [x] Extract VPS scripts (cloud-init, daemon, sync)
- [x] Extract D1 schema to `schemas/`
- [x] Create automation scripts (`setup-cloudflare.sh`, `prepare-repos.sh`, `set-secrets.sh`)
- [x] Generate `secrets_template.json`
- [x] Update AGENT.md and README.md with project details
- [x] Extract diagrams to `docs/diagrams.md`

---

## 📋 Phase 1: Cloudflare Setup

**Context**: Set up core Cloudflare infrastructure (R2, D1, DNS) before worker development.

**Prerequisites**: Cloudflare account with Workers/R2/D1/Pages enabled

### Tasks

- [ ] **Install wrangler CLI**: `npm install -g wrangler` (if not already installed)
- [ ] **Authenticate**: Run `wrangler login` to connect to Cloudflare account
- [ ] **Run setup script**: `./scripts/setup-cloudflare.sh` to create R2 buckets and D1 database
  - Creates `bloom-repos` R2 bucket
  - Creates `bloom-state` R2 bucket
  - Creates `bloom-db` D1 database
  - Applies schema from `schemas/d1-schema.sql`
- [ ] **Update wrangler.toml**: Copy D1 `database_id` output from setup script into `packages/worker/wrangler.toml`
- [ ] **Generate R2 API credentials**: Cloudflare dashboard → R2 → Manage R2 API Tokens → Create Token
  - Save `access_key_id` and `secret_access_key` for later
- [ ] **Get Cloudflare IDs**:
  - Account ID: Dashboard → Workers & Pages → Overview (right sidebar)
  - Zone ID: Dashboard → grove.place → Overview (right sidebar)
  - API Token: Dashboard → My Profile → API Tokens → Create (DNS Edit permission)
- [ ] **Create DNS A record**: Add `bloom` subdomain pointing to placeholder IP (will be updated by worker)
  - Name: `bloom`
  - Type: `A`
  - Content: `0.0.0.0` (placeholder)
  - Proxy: OFF (DNS only)
  - TTL: 60s

**Verification**: Run `wrangler r2 bucket list` and `wrangler d1 list` to confirm resources created

---

## 📦 Phase 2: Prepare Initial Repos

**Context**: Clone configured repos locally, install dependencies, compress node_modules, upload to R2.

**Prerequisites**: Phase 1 complete, rclone configured for R2

### Tasks

- [ ] **Install rclone**: `curl https://rclone.org/install.sh | bash`
- [ ] **Configure rclone for R2**: Run `rclone config`
  - Type: `s3`
  - Provider: `Cloudflare`
  - Access Key ID: (from Phase 1)
  - Secret Access Key: (from Phase 1)
  - Endpoint: `https://<account-id>.r2.cloudflarestorage.com`
  - Name remote: `r2`
- [ ] **Edit `scripts/prepare-repos.sh`**: Update `REPOS` array with your repositories
  - Default: `AutumnsGrove/GroveEngine:main`, `AutumnsGrove/GroveAuth:main`
  - Format: `owner/repo:branch`
- [ ] **Run prepare script**: `./scripts/prepare-repos.sh`
  - Clones each repo to `/tmp/bloom-workspace`
  - Runs `pnpm install` for each
  - Compresses `node_modules` to `.tar.gz`
  - Uploads repos and compressed modules to R2
  - Creates `manifest.json` with repo metadata
- [ ] **Verify upload**: `rclone ls r2:bloom-repos` should show all repos and tarballs

**Verification**: Check R2 bucket in Cloudflare dashboard, should see directories for each repo

---

## 🔐 Phase 3: Hetzner Setup

**Context**: Create Hetzner account and generate API credentials for VPS provisioning.

### Tasks

- [ ] **Create Hetzner account**: Sign up at https://console.hetzner.cloud/
- [ ] **Generate API token**: Security → API Tokens → Generate API Token
  - Description: "bloom-control-worker"
  - Permissions: Read & Write
  - Save token to `secrets.json` (hetzner.api_token)
- [ ] **Add SSH key**: Security → SSH Keys → Add SSH Key
  - Generate if needed: `ssh-keygen -t ed25519 -C "bloom@grove.place"`
  - Upload public key, note the key ID
  - Save key ID to `secrets.json` (hetzner.ssh_key_id)
- [ ] **Test API**: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.hetzner.cloud/v1/datacenters`
  - Should return list of datacenters
- [ ] **Verify regions available**: Confirm `fsn1` (EU) and `ash` (US) in datacenters list

**Verification**: API call returns 200 OK with datacenter list

---

## ✅ Phase 4: Worker Development (COMPLETE)

**Context**: Implement worker routes for VPS provisioning, R2 sync, session management, webhooks.

**Location**: `packages/worker/src/`

### Infrastructure Routes (`src/index.ts`)

- [x] **Implement `POST /api/start`**: Provision VPS, insert session into D1, return status
- [x] **Implement `POST /api/stop`**: Trigger sync, delete VPS, update session end
- [x] **Implement `GET /api/status`**: Query D1, calculate uptime/costs, return full status
- [x] **Implement `POST /api/task`**: Send task to VPS, insert into D1 tasks table
- [x] **Implement `GET /api/projects`**: Query D1 repositories table
- [x] **Implement `POST /api/sync`**: Trigger manual R2 sync on VPS
- [x] **Implement `GET /api/history`**: Query sessions with pagination, return monthly summary
- [x] **Implement `POST /api/config`**: Update D1 config table

### Webhook Routes (`src/index.ts`)

- [x] **Implement `POST /webhook/ready`**: Update DNS, set state to RUNNING
- [x] **Implement `POST /webhook/heartbeat`**: Update last_heartbeat, last_activity
- [x] **Implement `POST /webhook/task-complete`**: Update task status, trigger shutdown if needed
- [x] **Implement `POST /webhook/idle-timeout`**: Trigger graceful shutdown

### Services (`src/services/`)

- [x] **Create `hetzner.ts`**: VPS create/delete/get via Hetzner Cloud API
- [x] **Create `vps.ts`**: VPS communication (sync triggers, task submission)
- [x] **Create `dns.ts`**: Update Cloudflare A record for bloom subdomain
- [x] **Create `session.ts`**: D1 session CRUD operations

### Testing

- [ ] Test locally with `pnpm dev`, verify all routes work
- [ ] Test D1 integration, verify database operations
- [ ] Dry-run Hetzner VPS creation

---

## 🎨 Phase 5: Dashboard (SvelteKit)

**Context**: Build mobile-first UI for session control, terminal view, settings.

**Location**: `packages/dashboard/src/`

### Core Pages

- [ ] **Main view** (`routes/+page.svelte`): Status polling, start/stop, region toggle, quick task, recent sessions
- [ ] **Settings view** (`routes/settings/+page.svelte`): Idle timeout, auto-shutdown, region, models, projects

### Components (`lib/components/`)

- [ ] **Terminal.svelte**: ttyd iframe embed with mobile controls
- [ ] **StatusBadge.svelte**: Color-coded state indicators
- [ ] **SessionHistory.svelte**: Past sessions list with durations/costs

### State & API

- [ ] **session.ts** store: Poll status endpoint, reactive state
- [ ] **config.ts** store: User config persistence
- [ ] **bloom.ts** API client: Type-safe worker API wrapper

### Auth & Styling

- [ ] Heartwood auth integration or simple password protection
- [ ] Mobile-first CSS, touch-friendly buttons, dark theme

---

## 🖥️ Phase 6: VPS Scripts Testing

- [ ] Review all scripts in `packages/vps-scripts/`
- [ ] Test on local VM or throwaway Hetzner VPS
- [ ] Verify systemd services, daemon logic, R2 sync

---

## 🧪 Phase 7: End-to-End Testing

- [ ] Full boot cycle (EU and US)
- [ ] Idle timeout → shutdown
- [ ] Task completion → shutdown
- [ ] Manual stop → sync → shutdown
- [ ] Region toggle between sessions
- [ ] Multi-project workspace
- [ ] Terminal on mobile
- [ ] Cost tracking accuracy

---

## 💅 Phase 8: Polish & Deployment

- [ ] Error handling in worker/dashboard/VPS
- [ ] Loading states and toast notifications
- [ ] Update documentation with implementation changes
- [ ] Deploy worker: `cd packages/worker && pnpm deploy`
- [ ] Deploy dashboard to Cloudflare Pages
- [ ] Monitor first production sessions

---

## 🚀 Future Enhancements

- [ ] Svelte-native terminal (replace ttyd)
- [ ] Model selection UI
- [ ] Cost alerts/budgets
- [ ] Scheduled tasks
- [ ] Multiple concurrent sessions
- [ ] Shared sessions (pair programming)
- [ ] VS Code tunnel option

---

## 📊 Progress Summary

- **Phase 0**: ✅ Complete
- **Phase 1**: ⏳ Pending (Cloudflare Setup - manual)
- **Phase 2**: ⏳ Pending (Prepare Repos - manual)
- **Phase 3**: ⏳ Pending (Hetzner Setup - manual)
- **Phase 4**: ✅ Complete (Worker Development)
- **Phase 5-8**: ⏳ Not started

*Last updated: 2025-12-20*
*Next session: Complete Phase 1-3 (infrastructure) or continue to Phase 5 (Dashboard)*
