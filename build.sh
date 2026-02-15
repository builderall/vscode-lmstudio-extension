#!/bin/bash
# Build script for LM Studio Chat extension in WSL

set -e  # Exit on error

echo "🔨 Building LM Studio Chat Extension..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Compile TypeScript
echo "🔄 Compiling TypeScript..."
npm run compile

# Package extension
echo "📦 Packaging extension..."
npx vsce package --allow-missing-repository

# Show the packaged file
VSIX_FILE=$(ls -t lmstudio-chat-*.vsix 2>/dev/null | head -1)
echo "✅ Build complete!"
echo "📍 Extension packaged: $VSIX_FILE"
echo "📋 Next: run ./install-wsl.sh to install"
