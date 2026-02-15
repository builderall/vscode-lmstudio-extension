#!/bin/bash
# Push to GitHub from WSL using gh CLI token
# Usage: ./push.sh [--tags]

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

# Push branch (and tags if --tags flag is passed)
if [ "$1" = "--tags" ]; then
  echo "Pushing branch '$BRANCH' + tags to $REMOTE..."
  git push -u "$REMOTE" "$BRANCH" --tags
else
  echo "Pushing branch '$BRANCH' to $REMOTE..."
  git push -u "$REMOTE" "$BRANCH"
fi

# Remove token from remote URL
git remote set-url "$REMOTE" "$REPO_URL"

echo "Done. Remote URL cleaned."
