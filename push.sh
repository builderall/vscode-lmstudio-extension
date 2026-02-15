#!/bin/bash
# Push to GitHub from WSL using gh CLI token
# Usage: ./push.sh [--tags] [--force]

set -e

REMOTE="origin"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO_URL="https://github.com/builderall/vscode-lmstudio-extension.git"

# Verify gh is authenticated
if ! gh auth status &>/dev/null; then
  echo "ERROR: Not authenticated. Run: gh auth login"
  exit 1
fi

# Get token from gh CLI
TOKEN=$(gh auth status -t 2>&1 | grep 'Token:' | awk '{print $NF}')
if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not extract token from gh auth"
  exit 1
fi

# Temporarily set remote URL with token
git remote set-url "$REMOTE" "https://builderall:${TOKEN}@github.com/builderall/vscode-lmstudio-extension.git"

# Parse flags
PUSH_TAGS=false
PUSH_FORCE=false
for arg in "$@"; do
  case "$arg" in
    --tags) PUSH_TAGS=true ;;
    --force) PUSH_FORCE=true ;;
  esac
done

# Build push command
PUSH_CMD="git push -u $REMOTE $BRANCH"
if [ "$PUSH_TAGS" = true ]; then
  PUSH_CMD="$PUSH_CMD --tags"
fi
if [ "$PUSH_FORCE" = true ]; then
  PUSH_CMD="$PUSH_CMD --force"
  echo "WARNING: Force pushing branch '$BRANCH'${PUSH_TAGS:+ + tags} to $REMOTE..."
else
  echo "Pushing branch '$BRANCH'${PUSH_TAGS:+ + tags} to $REMOTE..."
fi

$PUSH_CMD

# Remove token from remote URL
git remote set-url "$REMOTE" "$REPO_URL"

echo "Done. Remote URL cleaned."
