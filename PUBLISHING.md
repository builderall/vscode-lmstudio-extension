# Publishing to VS Code Marketplace

## Prerequisites

1. **Create a publisher account**
   - Go to https://marketplace.visualstudio.com/manage
   - Sign in with a Microsoft account
   - Create a publisher with ID `builderall` (must match `publisher` in `package.json`)

2. **Create a Personal Access Token (PAT)**
   - Go to https://dev.azure.com
   - Click your profile icon → **Personal Access Tokens**
   - Create a new token with:
     - **Organization**: All accessible organizations
     - **Scopes**: Custom → **Marketplace** → check **Manage**
     - Set an expiration date (max 1 year)
   - Copy the token — you won't be able to see it again

## Publish

```bash
# Login (paste your PAT when prompted)
npx vsce login builderall

# Publish current version
npx vsce publish
```

The extension should appear on the marketplace within a few minutes.

## Publish a New Version

```bash
# Option 1: Bump version manually in package.json, then publish
npx vsce publish

# Option 2: Let vsce bump the version automatically
npx vsce publish patch   # 0.0.12 -> 0.0.13
npx vsce publish minor   # 0.0.12 -> 0.1.0
npx vsce publish major   # 0.0.12 -> 1.0.0
```

## Manual Upload (Alternative)

If `vsce publish` doesn't work (e.g., auth issues from WSL):

```bash
# Package the VSIX
npx vsce package --allow-missing-repository

# Upload manually at:
# https://marketplace.visualstudio.com/manage/publishers/builderall
# Click "..." → "Update" on the extension → upload the .vsix file
```

## Verify

After publishing, check:
- https://marketplace.visualstudio.com/items?itemName=builderall.lmstudio-chat
- Or in VS Code: `Ctrl+Shift+X` → search "LM Studio Chat"

## Notes

- The marketplace uses `README.md` as the extension description page
- `CHANGELOG.md` appears as a "Changelog" tab on the extension page
- `icon.png` is displayed as the extension icon (must be PNG, 128x128+)
- `extensionDependencies` on `github.copilot-chat` means users must have Copilot Chat installed
