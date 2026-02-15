# CLAUDE.md — Project Context for Claude Code

## Project

VS Code extension that registers a Chat panel participant (`@lmstudio`) connecting to LM Studio's local OpenAI-compatible API. Users type `@lmstudio` in VS Code's native Chat panel (right sidebar) to chat with local models.

## Key Files

- `src/extension.ts` — Extension logic: `LMStudioService` (API calls + SSE streaming + model auto-detect + request timeout + workspace file discovery + deactivation cleanup), `buildMessagesFromHistory` (conversation context with turn cap), slash command handlers (`/models`, `/config`, `/review`), and `activate` (participant registration via `vscode.chat.createChatParticipant`)
- `src/utils.ts` — Pure utility functions (no vscode dependency): `parseSSEChunk`, `truncateContent`, `sliceHistory`, `formatModelsOutput`, `formatConfigOutput`
- `src/test/utils.test.ts` — Unit tests for all utility functions (27 tests, mocha + assert)
- `package.json` — Extension manifest with `chatParticipants` contribution, `extensionDependencies` on `github.copilot-chat`, min VS Code 1.93.0
- `build.sh` / `build.bat` — Compile + package VSIX (dynamically detects output filename)
- `install.sh` / `install.bat` — Uninstalls ALL old lmstudio extensions first, then installs latest VSIX by date
- `setup-wsl-networking.ps1` — Enables WSL mirrored networking so `localhost` reaches Windows host

## Architecture

- **No webview** — Uses VS Code's native Chat panel API, not a custom webview
- Requires GitHub Copilot Chat extension (provides the Chat panel infrastructure)
- Streams responses via SSE from `/v1/chat/completions`
- Auto-includes active editor file as context; additional files via `#file:` references; `/review` discovers all workspace source files via `vscode.workspace.findFiles`
- Conversation history rebuilt from `vscode.ChatContext.history` (capped by `maxHistoryTurns`)
- File context truncated at `maxFileSize` chars to prevent token overflow
- Configurable system prompt sent with every request
- Auto-detects loaded model from `/v1/models` if `lmstudio.model` is empty
- Slash commands: `/models` (list loaded models), `/config` (show settings), `/review` (review workspace code with full context)
- Configurable temperature for model sampling
- Request timeout with user-friendly error messages
- Async file reads via `vscode.workspace.fs.readFile` (non-blocking)
- Graceful deactivation: aborts in-flight requests on extension shutdown

## Migration History

- **v0.0.1**: Left sidebar webview (`registerWebviewViewProvider`) with custom HTML (`src/webview.html`), non-streaming responses, built-in WSL proxy via Node.js child process
- **v0.0.2**: Migrated to right sidebar Chat panel participant (`vscode.chat.createChatParticipant`). Deleted `src/webview.html`. Removed webview views contribution from `package.json`. Added SSE streaming. Removed built-in proxy (replaced with `setup-wsl-networking.ps1`). Bumped min VS Code to 1.93.0
- **v0.0.3**: Added system prompt, context truncation, slash commands (`/models`, `/config`), and auto-detect model from LM Studio API
- **v0.0.4**: Async file reads (`vscode.workspace.fs`), configurable temperature & request timeout, `response.body` null guard, config caching per request, graceful deactivation abort, timeout error handling
- **v0.0.5**: `/review` slash command with workspace-wide file discovery (`vscode.workspace.findFiles`), rolling timeout that resets on each SSE chunk (prevents killing long streams), leftover SSE buffer processing, single config read per request, `@types/node` bumped to 18.x, `vsce` moved to devDependencies
- **v0.0.6**: `/review` diagnostic output (shows context size before sending), `/review` auto-extends timeout to 3 minutes minimum (large codebase context needs more time for first token), SSE error event handling in `parseSSEChunk` (surfaces LM Studio errors like context overflow instead of silently discarding them)
- **v0.0.7**: Fix AbortController race condition (abort previous in-flight request before starting a new one)
- **v0.0.8**: Configurable `/review` file patterns (`reviewInclude`/`reviewExclude` settings) with broadened defaults (supports TS, JS, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin), `/review` shows file list in diagnostic output, `icon.svg` for Chat panel participant, `.vscodeignore` for clean VSIX packaging, fix `/review` glob pattern that missed files directly in `src/` (changed from `{src/**,lib/**,app/**}/*.{ext}` to `**/*.{ext}` with test files added to default exclude)
- **v0.0.9**: Improved `/review` quality — reworked prompt to reduce hallucinations (anti-speculation rules, no forced section structure, severity-only findings), auto-includes project context files (`CLAUDE.md`, `README.md`, `package.json`) so the model understands architecture decisions, includes test files as read-only reference so the model won't claim missing test coverage, diagnostic output now shows review/context/test file breakdown

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
- `lmstudio.model` can be left empty for auto-detect, but LM Studio must have a model loaded
- `/review` requires sufficient context length in LM Studio — default 4096 is too small; set to 32768+ in LM Studio model settings

## Development Hardware

- **CPU/GPU**: AMD Ryzen AI Max 395+ (integrated RDNA 3.5 GPU)
- **Total memory**: 128 GB unified (LPDDR5x) — BIOS-configured as 64 GB system RAM + 64 GB VRAM
- **OS**: Windows 11 + WSL2 (Ubuntu)
- **GPU driver**: AMD AI drivers (NOT Adrenalin/gaming drivers — LM Studio requires the AI driver for ROCm/DirectML support)
- **Tested model**: Qwen3 Coder 30B A3B Instruct (`qwen3-coder-30ba3b-instruct`) via LM Studio
- **Context length**: 32K+ tokens (hardware supports much larger)

## Commands

- `npm run compile` — Compile TypeScript
- `npm test` — Compile + run unit tests (mocha)
- `npx vsce package --allow-missing-repository` — Package VSIX
- `code --list-extensions | grep -i lmstudio` — Check installed versions
