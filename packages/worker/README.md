# Grove Bloom Control Worker

Cloudflare Worker that orchestrates the entire Bloom infrastructure.

## Responsibilities

- **VPS Management**: Provision/terminate Hetzner Cloud instances
- **R2 Sync**: Manage repository and workspace state in R2
- **D1 State**: Track sessions, tasks, and configuration
- **DNS Updates**: Update Cloudflare DNS on VPS boot
- **WebSocket Proxy**: Proxy terminal connections (future)
- **Webhooks**: Receive status updates from VPS daemon

## Tech Stack

- **Framework**: Hono (lightweight, fast routing)
- **Runtime**: Cloudflare Workers
- **Storage**: R2 (repos, state), D1 (database)
- **External APIs**: Hetzner Cloud API, Cloudflare API

## Structure

```
src/
├── index.ts                      # Main worker entry point
├── routes/
│   ├── api.ts                    # API routes (/api/*)
│   └── webhooks.ts               # Webhook handlers
├── services/
│   ├── hetzner.ts                # Hetzner API client
│   ├── r2-sync.ts                # R2 sync operations
│   ├── dns.ts                    # Cloudflare DNS updates
│   └── session.ts                # Session management
├── webhooks/
│   ├── ready.ts                  # VPS boot complete
│   ├── heartbeat.ts              # Status updates
│   ├── task-complete.ts          # Task completion
│   └── idle-timeout.ts           # Idle timeout trigger
└── types/
    └── index.ts                  # TypeScript types
```

## Development

```bash
# Install dependencies
pnpm install

# Start local dev server
pnpm dev

# Deploy to Cloudflare
pnpm deploy

# View live logs
pnpm tail

# Generate types from wrangler.toml
pnpm types
```

## Environment Setup

### 1. Create D1 Database

```bash
wrangler d1 create bloom-db
# Copy database_id to wrangler.toml

# Run schema
wrangler d1 execute bloom-db --file=../../schemas/d1-schema.sql
```

### 2. Create R2 Buckets

```bash
wrangler r2 bucket create bloom-repos
wrangler r2 bucket create bloom-state
```

### 3. Set Secrets

```bash
wrangler secret put HETZNER_API_TOKEN
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_ZONE_ID
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY
wrangler secret put R2_SECRET_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put WEBHOOK_SECRET
wrangler secret put HEARTWOOD_CLIENT_ID
wrangler secret put HEARTWOOD_CLIENT_SECRET
```

## API Endpoints

See `docs/grove-bloom-spec.md` for complete API specification.

### Public Routes

- `POST /api/start` - Start new session
- `POST /api/stop` - Stop current session
- `GET /api/status` - Get session status
- `POST /api/task` - Send task to agent
- `GET /api/projects` - List projects
- `POST /api/sync` - Manual R2 sync
- `GET /api/history` - Session history
- `POST /api/config` - Update configuration

### Webhook Routes (VPS → Worker)

- `POST /webhook/ready` - VPS boot complete
- `POST /webhook/heartbeat` - Status update
- `POST /webhook/task-complete` - Task done
- `POST /webhook/idle-timeout` - Idle timeout

## Testing

```bash
# Run tests
pnpm test

# Test specific endpoint
curl https://bloom.grove.place/api/status
```

## Deployment

```bash
# Deploy to production
pnpm deploy

# Deploy to staging (if configured)
wrangler deploy --env staging
```
