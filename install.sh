#!/bin/bash
# Install script for LM Studio Chat extension (WSL/Ubuntu)

set -e  # Exit on error

echo "📦 Installing LM Studio Chat Extension..."

# Find the latest .vsix file
VSIX_FILE=$(ls -t lmstudio-chat-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
    echo "❌ Error: No .vsix file found!"
    echo "📝 Please run ./build.sh first to create the extension package"
    exit 1
fi

echo "📍 Found: $VSIX_FILE"

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ Error: VS Code command not found!"
    echo "📝 Make sure VS Code is installed and 'code' is in your PATH"
    exit 1
fi

# Uninstall any old versions
echo "🧹 Removing old versions..."
for ext in $(code --list-extensions 2>/dev/null | grep -i lmstudio); do
    echo "   Uninstalling: $ext"
    code --uninstall-extension "$ext" 2>/dev/null || true
done

# Install the latest extension
echo "⚙️  Installing $VSIX_FILE..."
code --install-extension "$VSIX_FILE" --force

echo "✅ Installation complete!"
echo "📋 Next steps:"
echo "   1. Reload VS Code (Ctrl+Shift+P → 'Reload Window')"
echo "   2. Configure settings:"
echo "      - lmstudio.model (required)"
echo "      - lmstudio.apiBaseUrl (default: http://localhost:1234/v1)"
echo "   3. Make sure LM Studio is running with a model loaded"
echo "   4. Open Chat panel, type @lmstudio followed by your message"
