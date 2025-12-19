#!/bin/bash
# Setup Cloudflare resources for Grove Bloom
# Run this script after setting up wrangler authentication

set -e

echo "🌸 Grove Bloom - Cloudflare Setup"
echo "=================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

# Check if authenticated
if ! wrangler whoami &> /dev/null; then
    echo "❌ Error: Not authenticated with Cloudflare"
    echo "Run: wrangler login"
    exit 1
fi

echo "✓ Wrangler CLI found and authenticated"
echo ""

# Create D1 Database
echo "📦 Creating D1 database..."
if wrangler d1 list | grep -q "bloom-db"; then
    echo "⚠ Database 'bloom-db' already exists, skipping creation"
else
    wrangler d1 create bloom-db
    echo "✓ D1 database 'bloom-db' created"
    echo "📝 Copy the database_id to packages/worker/wrangler.toml"
fi
echo ""

# Create R2 Buckets
echo "🗄️  Creating R2 buckets..."
if wrangler r2 bucket list | grep -q "bloom-repos"; then
    echo "⚠ Bucket 'bloom-repos' already exists, skipping"
else
    wrangler r2 bucket create bloom-repos
    echo "✓ R2 bucket 'bloom-repos' created"
fi

if wrangler r2 bucket list | grep -q "bloom-state"; then
    echo "⚠ Bucket 'bloom-state' already exists, skipping"
else
    wrangler r2 bucket create bloom-state
    echo "✓ R2 bucket 'bloom-state' created"
fi
echo ""

# Run D1 schema
echo "🔧 Applying D1 schema..."
read -p "Enter your D1 database ID (from wrangler.toml): " DB_ID
if [ -z "$DB_ID" ]; then
    echo "⚠ Skipping schema application (no database ID provided)"
else
    wrangler d1 execute "$DB_ID" --file=schemas/d1-schema.sql
    echo "✓ D1 schema applied"
fi
echo ""

echo "✅ Cloudflare setup complete!"
echo ""
echo "Next steps:"
echo "1. Update packages/worker/wrangler.toml with your database_id"
echo "2. Set worker secrets: ./scripts/set-secrets.sh"
echo "3. Prepare initial repos: ./scripts/prepare-repos.sh"
