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
npx vsce package

echo "✅ Build complete!"
echo "📍 Extension packaged: lmstudio-chat-0.0.1.vsix"
echo "📋 Next steps:"
echo "   1. Copy the .vsix file to Windows"
echo "   2. Open VS Code"
echo "   3. Press Ctrl+Shift+P → 'Install from VSIX'"
echo "   4. Select the .vsix file"
