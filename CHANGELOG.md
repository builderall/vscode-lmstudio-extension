# Changelog

## [0.0.13] - 2026-02-15

### Added
- `lmstudio.contextLength` setting (default: 32768) to configure model context window
- `/context` slash command to reload the loaded model with the configured context length
- Auto-sets context length on extension activation (fire-and-forget, won't block if LM Studio isn't running)
- Context length shown in `/config` output

## [0.0.12] - 2026-02-15

### Added
- Apache 2.0 license
- PNG icon for marketplace listing
- Keywords for marketplace discoverability
- `icon` and `license` fields in `package.json`

## [0.0.11] - 2026-02-15

### Changed
- Reworked `/review` anti-hallucination prompt for streaming output
- Added "verify before writing" checklist — model must silently confirm exact line, trigger scenario, and correctness before emitting any finding
- Added "never retract" rule — if not 100% certain, don't start writing the finding
- Added mandatory verbatim code quoting for all findings
- Added "no narration" output format rule — only output findings or "No issues found."

## [0.0.10] - 2026-02-15

### Changed
- Normalized line endings to LF across codebase
- Added `.gitattributes` for consistent EOL handling
- Added `push.sh` convenience script

## [0.0.9] - 2025-12-01

### Changed
- Improved `/review` quality with anti-hallucination prompt (anti-speculation rules, severity-only findings)
- `/review` auto-includes project context files (`CLAUDE.md`, `README.md`, `package.json`)
- `/review` includes test files as read-only reference to prevent false "missing tests" claims
- Diagnostic output shows review/context/test file breakdown

## [0.0.8] - 2025-11-01

### Added
- Configurable `/review` file patterns (`reviewInclude`/`reviewExclude` settings)
- Broadened default language support (TS, JS, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin)
- `/review` shows file list in diagnostic output
- `icon.svg` for Chat panel participant
- `.vscodeignore` for clean VSIX packaging

### Fixed
- `/review` glob pattern that missed files directly in `src/`

## [0.0.7] - 2025-10-01

### Fixed
- AbortController race condition in concurrent requests

## [0.0.6] - 2025-09-01

### Added
- `/review` diagnostic output showing context size before sending
- `/review` auto-extends timeout to 3 minutes minimum for large codebases
- SSE error event handling in `parseSSEChunk` (surfaces LM Studio errors like context overflow)

## [0.0.5] - 2025-08-01

### Added
- `/review` slash command with workspace-wide file discovery
- Rolling timeout that resets on each SSE chunk
- Leftover SSE buffer processing
- Single config read per request

### Changed
- `@types/node` bumped to 18.x
- `vsce` moved to devDependencies

## [0.0.4] - 2025-07-01

### Added
- Async file reads via `vscode.workspace.fs`
- Configurable temperature and request timeout
- `response.body` null guard
- Config caching per request
- Graceful deactivation abort
- Timeout error handling

## [0.0.3] - 2025-06-01

### Added
- Configurable system prompt
- Context truncation at `maxFileSize`
- Slash commands: `/models`, `/config`
- Auto-detect loaded model from LM Studio API

## [0.0.2] - 2025-05-01

### Changed
- Migrated from left sidebar webview to right sidebar Chat panel participant
- Added SSE streaming for real-time responses
- Removed built-in WSL proxy (replaced with `setup-wsl-networking.ps1`)
- Bumped minimum VS Code version to 1.93.0

### Removed
- `src/webview.html` (replaced by native Chat panel API)

## [0.0.1] - 2025-04-01

### Added
- Initial release
- Left sidebar webview with custom HTML
- Non-streaming responses from LM Studio API
- Built-in WSL proxy via Node.js child process
