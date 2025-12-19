# Grove Bloom Scripts

Automation scripts for setting up and managing Grove Bloom infrastructure.

## Setup Scripts

Run these in order for initial setup:

### 1. `setup-cloudflare.sh`

Creates Cloudflare resources (D1 database, R2 buckets).

```bash
./scripts/setup-cloudflare.sh
```

**Prerequisites:**
- `wrangler` CLI installed (`npm install -g wrangler`)
- Authenticated with Cloudflare (`wrangler login`)

**Creates:**
- D1 database: `bloom-db`
- R2 bucket: `bloom-repos`
- R2 bucket: `bloom-state`
- Applies D1 schema from `schemas/d1-schema.sql`

### 2. `set-secrets.sh`

Interactively sets all worker secrets.

```bash
./scripts/set-secrets.sh
```

**Sets:**
- `HETZNER_API_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY`
- `R2_SECRET_KEY`
- `OPENROUTER_API_KEY`
- `WEBHOOK_SECRET`
- `HEARTWOOD_CLIENT_ID`
- `HEARTWOOD_CLIENT_SECRET`

### 3. `prepare-repos.sh`

Clones configured repos, installs dependencies, uploads to R2.

```bash
./scripts/prepare-repos.sh
```

**Prerequisites:**
- `rclone` configured for Cloudflare R2
- `pnpm` installed for dependency management

**Actions:**
- Clones repos from `REPOS` array in script
- Installs node_modules
- Compresses node_modules
- Uploads to `bloom-repos` R2 bucket
- Creates `manifest.json`

**Configuration:**

Edit the `REPOS` array in the script:

```bash
REPOS=(
  "AutumnsGrove/GroveEngine:main"
  "AutumnsGrove/GroveAuth:main"
  # Add more repos here
)
```

## Usage Example

Full setup workflow:

```bash
# 1. Install dependencies
npm install -g wrangler
npm install -g pnpm

# 2. Authenticate with Cloudflare
wrangler login

# 3. Configure rclone for R2
rclone config

# 4. Run setup scripts
./scripts/setup-cloudflare.sh
./scripts/set-secrets.sh
./scripts/prepare-repos.sh

# 5. Deploy worker
cd packages/worker
pnpm install
pnpm deploy

# 6. Deploy dashboard
cd ../dashboard
pnpm install
pnpm build
# Deploy to Cloudflare Pages via wrangler or dashboard
```

## Troubleshooting

### "wrangler not found"
```bash
npm install -g wrangler
```

### "Not authenticated with Cloudflare"
```bash
wrangler login
```

### "rclone not configured"
```bash
rclone config
# Choose:
# - Type: s3
# - Provider: Cloudflare
# - Enter R2 credentials from Cloudflare dashboard
```

### "Permission denied"
```bash
chmod +x scripts/*.sh
```
