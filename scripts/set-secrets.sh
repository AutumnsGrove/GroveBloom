#!/bin/bash
# Interactive script to set Cloudflare Worker secrets

set -e

cd packages/worker

echo "🌸 Grove Bloom - Set Worker Secrets"
echo "===================================="
echo ""
echo "This script will interactively set all required secrets for the worker."
echo ""

# List of required secrets
SECRETS=(
  "HETZNER_API_TOKEN:Hetzner Cloud API token"
  "CLOUDFLARE_API_TOKEN:Cloudflare API token (DNS edit permission)"
  "CLOUDFLARE_ZONE_ID:Cloudflare Zone ID for grove.place"
  "CLOUDFLARE_ACCOUNT_ID:Cloudflare Account ID"
  "R2_ACCESS_KEY:R2 Access Key ID"
  "R2_SECRET_KEY:R2 Secret Access Key"
  "OPENROUTER_API_KEY:OpenRouter API key"
  "WEBHOOK_SECRET:Random string for webhook authentication"
  "HEARTWOOD_CLIENT_ID:Heartwood OAuth client ID"
  "HEARTWOOD_CLIENT_SECRET:Heartwood OAuth client secret"
)

echo "Required secrets:"
for secret_config in "${SECRETS[@]}"; do
    IFS=':' read -r name desc <<< "$secret_config"
    echo "  - $name ($desc)"
done
echo ""

read -p "Continue with secret setup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""

# Set each secret
for secret_config in "${SECRETS[@]}"; do
    IFS=':' read -r name desc <<< "$secret_config"

    echo "Setting: $name"
    echo "  Description: $desc"

    # Check if already set
    if wrangler secret list | grep -q "$name"; then
        read -p "  Secret already exists. Update? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "  Skipped."
            echo ""
            continue
        fi
    fi

    # Set secret
    wrangler secret put "$name"
    echo "  ✓ Set"
    echo ""
done

echo "✅ All secrets configured!"
echo ""
echo "Verify with: wrangler secret list"
