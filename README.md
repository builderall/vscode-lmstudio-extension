# LM Studio Chat for VS Code

A VS Code Chat panel participant that connects to [LM Studio](https://lmstudio.ai)'s local OpenAI-compatible API. Type `@lmstudio` in the Chat panel to start chatting with your local models.

## Prerequisites

- [LM Studio](https://lmstudio.ai) running with a model loaded
- Local server enabled (default: `http://localhost:1234/v1`)
- [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension installed (provides the Chat panel)

## Install

**Build and install the VSIX:**

```bash
# Windows
.\build.bat && .\install.bat

# WSL / Linux
chmod +x build.sh install.sh
./build.sh && ./install.sh
```

Or install manually: `Ctrl+Shift+P` → "Install from VSIX" → select `lmstudio-chat-0.0.5.vsix`

**Development mode:**

```bash
npm install && npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lmstudio.apiBaseUrl` | `http://localhost:1234/v1` | LM Studio API endpoint |
| `lmstudio.apiKey` | `not-needed` | API key |
| `lmstudio.model` | _(empty — auto-detects)_ | Model name (leave empty to auto-detect from LM Studio) |
| `lmstudio.systemPrompt` | _(coding assistant prompt)_ | System prompt sent with every request |
| `lmstudio.maxFileSize` | `10000` | Max characters per file included in context |
| `lmstudio.maxHistoryTurns` | `20` | Max conversation turns to include in history |
| `lmstudio.temperature` | `0.7` | Sampling temperature (0 = deterministic, 2 = most creative) |
| `lmstudio.requestTimeout` | `60000` | Request timeout in milliseconds |

## Usage

1. Start LM Studio and load a model
2. Open the **Chat panel** in the right sidebar (View → Chat, or `Ctrl+Alt+I`)
3. In the chat input, type `@lmstudio` to select the LM Studio participant
4. Type your message and press Enter — responses stream in real-time
5. Your current editor file is automatically included as context
6. To add more files, use `#file:path/to/file` in your message

### Slash Commands

| Command | Description |
|---------|-------------|
| `@lmstudio /models` | List all models currently loaded in LM Studio |
| `@lmstudio /config` | Show current extension configuration |
| `@lmstudio /review` | Review workspace code with full project context |

## Testing

```bash
npm test
```

Runs unit tests covering SSE parsing, content truncation, history slicing, and command output formatting.

## WSL Note

If running VS Code from WSL while LM Studio runs on Windows, run the setup script from PowerShell to enable mirrored networking:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-wsl-networking.ps1
```

This configures WSL so `localhost` reaches the Windows host where LM Studio is running.
