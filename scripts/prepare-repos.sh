#!/bin/bash
# Prepare and upload initial repositories to R2
# This clones repos, installs dependencies, and uploads to bloom-repos bucket

set -e

echo "🌸 Grove Bloom - Prepare Repositories"
echo "======================================"
echo ""

# Configuration - Edit these to match your repos
REPOS=(
  "AutumnsGrove/GroveEngine:main"
  "AutumnsGrove/GroveAuth:main"
)

WORKSPACE_DIR="/tmp/bloom-workspace"
BUCKET_NAME="bloom-repos"

# Check if rclone is configured
if ! rclone listremotes | grep -q "r2:"; then
    echo "❌ Error: rclone not configured for R2"
    echo ""
    echo "Configure rclone with:"
    echo "  rclone config"
    echo ""
    echo "Settings:"
    echo "  Type: s3"
    echo "  Provider: Cloudflare"
    echo "  Access Key ID: <from Cloudflare>"
    echo "  Secret Access Key: <from Cloudflare>"
    echo "  Endpoint: https://<account-id>.r2.cloudflarestorage.com"
    exit 1
fi

echo "✓ rclone configured"
echo ""

# Create workspace
rm -rf "$WORKSPACE_DIR"
mkdir -p "$WORKSPACE_DIR"
cd "$WORKSPACE_DIR"

# Clone and prepare each repo
for repo_config in "${REPOS[@]}"; do
    IFS=':' read -r repo branch <<< "$repo_config"
    repo_name=$(basename "$repo")

    echo "📦 Processing $repo_name..."

    # Clone
    git clone --branch "$branch" "https://github.com/$repo.git" "$repo_name"
    cd "$repo_name"

    # Install dependencies
    if [ -f "package.json" ]; then
        echo "  Installing npm dependencies..."
        pnpm install

        # Compress node_modules
        echo "  Compressing node_modules..."
        tar -czf "../${repo_name}-node_modules.tar.gz" node_modules
        rm -rf node_modules
    fi

    cd ..

    # Upload to R2
    echo "  Uploading to R2..."
    rclone sync "$repo_name/" "r2:$BUCKET_NAME/$repo_name/"

    # Upload compressed node_modules
    if [ -f "${repo_name}-node_modules.tar.gz" ]; then
        rclone copy "${repo_name}-node_modules.tar.gz" "r2:$BUCKET_NAME/$repo_name/"
    fi

    echo "  ✓ $repo_name uploaded"
    echo ""
done

# Create manifest
echo "📝 Creating manifest..."
cat > manifest.json << EOF
{
  "version": "1.0.0",
  "lastUpdated": "$(date -Iseconds)",
  "repositories": [
EOF

for i in "${!REPOS[@]}"; do
    repo_config="${REPOS[$i]}"
    IFS=':' read -r repo branch <<< "$repo_config"
    repo_name=$(basename "$repo")

    if [ $i -gt 0 ]; then
        echo "," >> manifest.json
    fi

    cat >> manifest.json << EOF
    {
      "name": "$repo_name",
      "url": "https://github.com/$repo.git",
      "branch": "$branch",
      "path": "/workspace/$repo_name"
    }
EOF
done

cat >> manifest.json << EOF

  ]
}
EOF

rclone copy manifest.json "r2:$BUCKET_NAME/"

echo ""
echo "✅ Repository preparation complete!"
echo ""
echo "Uploaded repositories:"
for repo_config in "${REPOS[@]}"; do
    repo_name=$(basename "${repo_config%%:*}")
    echo "  - $repo_name"
done
echo ""
echo "Next steps:"
echo "1. Verify uploads: rclone ls r2:$BUCKET_NAME"
echo "2. Deploy worker: cd packages/worker && pnpm deploy"
