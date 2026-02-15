# CLAUDE.md — Project Context for Claude Code

## Project

VS Code extension that registers a Chat panel participant (`@lmstudio`) connecting to LM Studio's local OpenAI-compatible API. Users type `@lmstudio` in VS Code's native Chat panel (right sidebar) to chat with local models.

## Key Files

- `src/extension.ts` — Entire extension logic: `LMStudioService` (API calls + SSE streaming), `buildMessagesFromHistory` (conversation context), and `activate` (participant registration via `vscode.chat.createChatParticipant`)
- `package.json` — Extension manifest with `chatParticipants` contribution, `extensionDependencies` on `github.copilot-chat`, min VS Code 1.93.0
- `build.sh` / `build.bat` — Compile + package VSIX (dynamically detects output filename)
- `install.sh` / `install.bat` — Uninstalls ALL old lmstudio extensions first, then installs latest VSIX by date
- `setup-wsl-networking.ps1` — Enables WSL mirrored networking so `localhost` reaches Windows host

## Architecture

- **No webview** — Uses VS Code's native Chat panel API, not a custom webview
- Requires GitHub Copilot Chat extension (provides the Chat panel infrastructure)
- Streams responses via SSE from `/v1/chat/completions`
- Auto-includes active editor file as context; additional files via `#file:` references
- Conversation history rebuilt from `vscode.ChatContext.history`

## Migration History

- **v0.0.1**: Left sidebar webview (`registerWebviewViewProvider`) with custom HTML (`src/webview.html`), non-streaming responses, built-in WSL proxy via Node.js child process
- **v0.0.2**: Migrated to right sidebar Chat panel participant (`vscode.chat.createChatParticipant`). Deleted `src/webview.html`. Removed webview views contribution from `package.json`. Added SSE streaming. Removed built-in proxy (replaced with `setup-wsl-networking.ps1`). Bumped min VS Code to 1.93.0

## Build & Install

```bash
# WSL / Linux
./build.sh && ./install.sh

# Windows
.\build.bat && .\install.bat
```

Or press F5 in VS Code for Extension Development Host.

## Known Issues & Gotchas

- Extension won't activate without GitHub Copilot Chat installed (`extensionDependencies`)
- `@lmstudio` appears as a participant mention inside the Chat panel, NOT as a separate tab
- Duplicate extension installs (e.g., `undefined_publisher.lmstudio-chat` + `builderall.lmstudio-chat`) can prevent activation — install scripts now clean these up
- WSL: LM Studio on Windows requires mirrored networking or port proxy for `localhost` to work from WSL
- The `lmstudio.model` setting must be configured — it has no default

## Commands

- `npm run compile` — Compile TypeScript
- `npx vsce package --allow-missing-repository` — Package VSIX
- `code --list-extensions | grep -i lmstudio` — Check installed versions
