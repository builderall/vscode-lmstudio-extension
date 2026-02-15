# LM Studio Chat Extension - Requirements & Architecture

## Overview

VS Code Chat panel participant (`@lmstudio`) that connects to LM Studio's local OpenAI-compatible API for code assistance with workspace file context.

## Architecture

- **Language**: TypeScript
- **Entry point**: `src/extension.ts` — Chat participant registered via `vscode.chat.createChatParticipant`
- **UI**: VS Code's native Chat panel (requires GitHub Copilot Chat extension)
- **Activation**: `onStartupFinished`
- **Min VS Code**: 1.93.0

## Features

- Chat participant in VS Code's native Chat panel (right sidebar), invoked with `@lmstudio`
- Streaming responses from LM Studio's `/v1/chat/completions` endpoint via SSE
- Auto-includes the current active editor file as context
- Additional file references via `#file:` syntax in the chat input
- Native markdown rendering (code blocks, headers, bold, lists)
- Conversation history maintained automatically by the Chat panel (capped at configurable max turns)
- Cancellation support — stop responses mid-stream
- Connection error handling with WSL-specific guidance
- Configurable system prompt sent with every request
- Auto-detect model from LM Studio's `/v1/models` when no model is configured
- File context truncation to prevent token overflow
- Slash commands: `/models` (list loaded models), `/config` (show settings), `/review` (review workspace code)
- Configurable sampling temperature
- Request timeout with user-friendly error messages
- Async file reads (non-blocking extension host)
- Workspace-wide file discovery for `/review` command (scans `src/**/*.ts`, `package.json`, `tsconfig.json`)
- Graceful deactivation: aborts in-flight streaming requests

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `lmstudio.apiBaseUrl` | `http://localhost:1234/v1` | LM Studio API endpoint |
| `lmstudio.apiKey` | `not-needed` | API key |
| `lmstudio.model` | _(empty — auto-detects)_ | Model name (leave empty to auto-detect) |
| `lmstudio.systemPrompt` | _(coding assistant prompt)_ | System prompt sent with every request |
| `lmstudio.maxFileSize` | `10000` | Max characters per file in context |
| `lmstudio.maxHistoryTurns` | `20` | Max conversation turns in history |
| `lmstudio.temperature` | `0.7` | Sampling temperature (0–2) |
| `lmstudio.requestTimeout` | `60000` | Request timeout in ms |

## Build & Install

```bash
npm install && npm run compile && npx vsce package
code --install-extension lmstudio-chat-0.0.5.vsix
```

Or use the provided scripts: `build.sh` / `build.bat` and `install.sh` / `install.bat`.

## Testing

```bash
npm test
```

Unit tests (mocha + assert) cover pure utility functions extracted to `src/utils.ts`: SSE parsing, content truncation, history slicing, and command output formatting. Tests run without the VS Code extension host.

## WSL Setup

LM Studio runs on Windows. From WSL, `localhost` doesn't reach Windows by default. Run from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-wsl-networking.ps1
```

This enables `networkingMode=mirrored` in `.wslconfig` so WSL's `localhost` maps to Windows.

**Alternatives** (if mirrored networking isn't an option):
- Port proxy: `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=1234 connectaddress=127.0.0.1 connectport=1234`
- Use `http://host.docker.internal:1234/v1` as the endpoint
