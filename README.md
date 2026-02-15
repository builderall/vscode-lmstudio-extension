# LM Studio Chat for VS Code

A VS Code sidebar extension that connects to [LM Studio](https://lmstudio.ai)'s local OpenAI-compatible API.

## Prerequisites

- [LM Studio](https://lmstudio.ai) running with a model loaded
- Local server enabled (default: `http://localhost:1234/v1`)

## Install

**Build and install the VSIX:**

```bash
# Windows
.\build.bat && .\install.bat

# WSL / Linux
chmod +x build.sh install-wsl.sh
./build.sh && ./install-wsl.sh
```

Or install manually: `Ctrl+Shift+P` → "Install from VSIX" → select `lmstudio-chat-0.0.1.vsix`

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
| `lmstudio.model` | _(empty)_ | Model name (e.g. `mistral`, `neural-chat`) |

## Usage

1. Start LM Studio and load a model
2. Open the **LM Studio Chat** view in the Explorer sidebar
3. Start chatting

## WSL Note

If running VS Code from WSL while LM Studio runs on Windows, run the setup script from PowerShell to enable mirrored networking:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-wsl-networking.ps1
```

This configures WSL so `localhost` reaches the Windows host where LM Studio is running.
