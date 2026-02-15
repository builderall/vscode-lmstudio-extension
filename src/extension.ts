import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  // Register the webview provider for the sidebar view
  const provider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('lmstudio-chat', provider)
  );

  // Track active editor
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        provider.setCurrentFile(editor.document.uri);
      }
    })
  );

  // Set initial file if there's an active editor
  if (vscode.window.activeTextEditor) {
    provider.setCurrentFile(vscode.window.activeTextEditor.document.uri);
  }
}

class ChatViewProvider implements vscode.WebviewViewProvider {
  private currentFile: vscode.Uri | null = null;
  private selectedFiles: vscode.Uri[] = [];
  private webviewView: vscode.WebviewView | null = null;
  private proxyProcess: any = null;

  constructor(private extensionUri: vscode.Uri) {}

  private getWindowsGatewayIP(): string | null {
    try {
      if (!fs.existsSync('/proc/version')) {
        return null;
      }
      const procVersion = fs.readFileSync('/proc/version', 'utf-8');
      const isWSL = procVersion.toLowerCase().includes('microsoft') || 
                    procVersion.toLowerCase().includes('wsl');
      
      if (!isWSL) {
        return null;
      }

      // Try to get the gateway IP from resolv.conf (common for WSL)
      try {
        const resolvConf = fs.readFileSync('/etc/resolv.conf', 'utf-8');
        const match = resolvConf.match(/nameserver\s+([0-9.]+)/);
        if (match && match[1]) {
          return match[1];
        }
      } catch (e) {
        // Ignore
      }

      // Fallback to common WSL gateway
      return '172.17.0.1';
    } catch (e) {
      return null;
    }
  }

  private startProxyIfNeeded() {
    if (this.proxyProcess) {
      return; // Already running
    }

    try {
      const proxyScript = vscode.Uri.joinPath(this.extensionUri, 'lm-studio-proxy.js').fsPath;
      const windowsIP = this.getWindowsGatewayIP() || '10.255.255.254';
      
      this.proxyProcess = spawn('node', [proxyScript, '9999', windowsIP, '1234'], {
        stdio: 'ignore',
        detached: true
      });

      this.proxyProcess.unref();
      console.log('[LM Studio] Proxy process started at localhost:9999');
    } catch (err) {
      console.warn('[LM Studio] Could not start proxy:', err instanceof Error ? err.message : err);
    }
  }

  private getApiUrl(): string {
    let apiUrl = vscode.workspace.getConfiguration('lmstudio').get<string>('apiBaseUrl');
    
    if (!apiUrl) {
      // Check if we're in WSL - if so, try using local proxy first
      const windowsIP = this.getWindowsGatewayIP();
      if (windowsIP) {
        this.startProxyIfNeeded();
        apiUrl = 'http://localhost:9999/v1';
        console.log('[LM Studio] Using local proxy at localhost:9999 to reach Windows');
      } else {
        apiUrl = 'http://localhost:1234/v1';
      }
    }
    
    return apiUrl;
  }

  setCurrentFile(uri: vscode.Uri) {
    this.currentFile = uri;
    this.updateWebviewFiles();
  }

  private updateWebviewFiles() {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        command: 'updateFiles',
        currentFile: this.currentFile?.fsPath,
        selectedFiles: this.selectedFiles.map(f => f.fsPath)
      });
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    // Load HTML from file
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview.html');
    fs.readFile(htmlPath.fsPath, 'utf-8', (err, data) => {
      if (err) {
        console.error('Failed to load webview:', err);
        webviewView.webview.html = '<h1>Error loading webview</h1>';
        return;
      }
      webviewView.webview.html = data;
    });
    
    this.updateWebviewFiles();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'sendMessage') {
        await this.handleSendMessage(webviewView, message);
      } else if (message.command === 'selectFiles') {
        await this.handleSelectFiles();
      } else if (message.command === 'clearFiles') {
        this.selectedFiles = [];
        this.updateWebviewFiles();
      }
    });
  }

  private async handleSendMessage(webviewView: vscode.WebviewView, message: any) {
    const apiUrl = this.getApiUrl();
    const apiKey = vscode.workspace.getConfiguration('lmstudio').get<string>('apiKey') || 'not-needed';
    const model = vscode.workspace.getConfiguration('lmstudio').get<string>('model') || '';

    if (!model) {
      vscode.window.showErrorMessage('Please set the LM Studio model in settings');
      return;
    }

    try {
      // Build messages with file context
      let messagesWithContext = [...message.messages];
      const fileContext = await this.buildFileContext();
      
      if (fileContext) {
        // Insert file context in the last user message
        if (messagesWithContext.length > 0) {
          const lastMessage = messagesWithContext[messagesWithContext.length - 1];
          if (lastMessage.role === 'user') {
            lastMessage.content += '\n\n' + fileContext;
          }
        }
      }

      console.log(`[LM Studio] Connecting to ${apiUrl}/chat/completions with model: ${model}`);

      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messagesWithContext,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      webviewView.webview.postMessage({
        command: 'receiveMessage',
        content: data.choices[0].message.content
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[LM Studio] Error:', errorMsg);
      
      let userMessage = errorMsg;
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Connection refused') || errorMsg.includes('Cannot reach')) {
        userMessage = `Cannot connect to LM Studio.\n\nWhen using WSL, the extension auto-starts a proxy at localhost:9999 BUT:\n\nLM Studio on Windows MUST listen on 0.0.0.0 (all interfaces), not just localhost/127.0.0.1\n\n━━━ FIX LM STUDIO ━━━\n1. Stop LM Studio \n2. Find config: AppData\\Local\\LM Studio\\config.json\n3. Change "host": "127.0.0.1" to "host": "0.0.0.0"\n4. Restart LM Studio\n5. Try again in VS Code\n\n━━ OR MANUAL SETUP ━━\nSet in VS Code settings:\n"lmstudio.apiBaseUrl": "http://10.255.255.254:1234/v1"`;
      }
      
      webviewView.webview.postMessage({
        command: 'error',
        message: userMessage
      });
    }
  }

  private async buildFileContext(): Promise<string> {
    const files = [
      ...(this.currentFile ? [this.currentFile] : []),
      ...this.selectedFiles
    ];

    const uniqueFiles = Array.from(new Map(files.map(f => [f.fsPath, f])).values());
    
    if (uniqueFiles.length === 0) {
      return '';
    }

    let context = '';
    for (const file of uniqueFiles) {
      try {
        const content = fs.readFileSync(file.fsPath, 'utf-8');
        const relPath = vscode.workspace.asRelativePath(file);
        context += `\n\n### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``;
      } catch (err) {
        // Skip files that can't be read
      }
    }
    
    return context ? '**Files included in context:**' + context : '';
  }

  private async handleSelectFiles() {
    const result = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      defaultUri: vscode.workspace.workspaceFolders?.[0].uri
    });

    if (result) {
      this.selectedFiles = [...this.selectedFiles, ...result];
      this.updateWebviewFiles();
    }
  }
}

export function deactivate() {}
