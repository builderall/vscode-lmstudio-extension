# LM Studio Chat Extension - Requirements & Architecture

## Overview

VS Code sidebar extension that connects to LM Studio's local OpenAI-compatible API for code assistance with workspace file context.

## Architecture

- **Language**: TypeScript
- **Entry point**: `src/extension.ts` — `ChatViewProvider` implementing `WebviewViewProvider`
- **UI**: `src/webview.html` — HTML/CSS/JS loaded at runtime (not embedded)
- **Activation**: `onStartupFinished`

## Features

- Chat sidebar in the Explorer panel (left side)
- UI controls: **Add Files** button, **Clear Files** button, **Send** button, and a chat input box
- Auto-includes current editor file as context
- File selection dialog to add multiple workspace files to context
- Markdown rendering for assistant responses (headers, bold, code blocks)
- Streams responses from LM Studio's `/v1/chat/completions` endpoint

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `lmstudio.apiBaseUrl` | `http://localhost:1234/v1` | LM Studio API endpoint |
| `lmstudio.apiKey` | `not-needed` | API key |
| `lmstudio.model` | _(empty)_ | Model name (e.g. `mistral`, `neural-chat`) |

## Build & Install

```bash
npm install && npm run compile && npx vsce package
code --install-extension lmstudio-chat-0.0.1.vsix
```

Or use the provided scripts: `build.sh` / `build.bat` and `install-wsl.sh` / `install.bat`.

## WSL Setup

LM Studio runs on Windows. From WSL, `localhost` doesn't reach Windows by default. Run from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-wsl-networking.ps1
```

This enables `networkingMode=mirrored` in `.wslconfig` so WSL's `localhost` maps to Windows.

**Alternatives** (if mirrored networking isn't an option):
- Port proxy: `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=1234 connectaddress=127.0.0.1 connectport=1234`
- Use `http://host.docker.internal:1234/v1` as the endpoint
