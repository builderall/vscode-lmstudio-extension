#!/bin/bash
# Install script for LM Studio Chat extension (WSL/Ubuntu)

set -e  # Exit on error

echo "📦 Installing LM Studio Chat Extension..."

# Find the .vsix file
VSIX_FILE=$(ls -t lmstudio-chat-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
    echo "❌ Error: No .vsix file found!"
    echo "📝 Please run ./build-wsl.sh first to create the extension package"
    exit 1
fi

echo "📍 Found: $VSIX_FILE"

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ Error: VS Code command not found!"
    echo "📝 Make sure VS Code is installed and 'code' is in your PATH"
    exit 1
fi

# Install the extension
echo "⚙️  Installing extension..."
code --install-extension "$VSIX_FILE" --force

echo "✅ Installation complete!"
echo "📋 Next steps:"
echo "   1. Reload VS Code (Ctrl+Shift+P → 'Reload Window')"
echo "   2. Configure settings:"
echo "      - lmstudio.apiBaseUrl"
echo "      - lmstudio.apiKey"
echo "      - lmstudio.model (required)"
echo "   3. Make sure LM Studio is running with a model loaded"
echo "   4. Open the 'LM Studio Chat' view in the Explorer sidebar"
