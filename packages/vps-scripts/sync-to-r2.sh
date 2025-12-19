#!/bin/bash
# Sync workspace to R2

echo "$(date): Starting R2 sync..."

cd /workspace

# Compress and upload each project's node_modules
for dir in */; do
  if [ -d "${dir}node_modules" ]; then
    echo "Compressing ${dir}node_modules..."
    tar -czf "/tmp/${dir%/}-node_modules.tar.gz" -C "$dir" node_modules
    rclone copy "/tmp/${dir%/}-node_modules.tar.gz" "r2:bloom-repos/${dir}"
  fi
done

# Sync Kilo context
if [ -d ~/.kilocode ]; then
  rclone sync ~/.kilocode r2:bloom-state/kilo/
fi

# Create workspace snapshot
tar -czf /tmp/workspace-snapshot.tar.gz \
  --exclude='node_modules' \
  --exclude='.git/objects' \
  -C /workspace .

rclone copy /tmp/workspace-snapshot.tar.gz r2:bloom-state/current/

echo "$(date): R2 sync complete"
