import * as vscode from 'vscode';
import * as fs from 'fs';

class LMStudioService {
  private getApiUrl(): string {
    const apiUrl = vscode.workspace.getConfiguration('lmstudio').get<string>('apiBaseUrl');
    return apiUrl || 'http://localhost:1234/v1';
  }

  async sendChatCompletion(
    messages: Array<{ role: string; content: string }>,
    token: vscode.CancellationToken,
    stream: vscode.ChatResponseStream
  ): Promise<void> {
    const apiUrl = this.getApiUrl();
    const apiKey = vscode.workspace.getConfiguration('lmstudio').get<string>('apiKey') || 'not-needed';
    const model = vscode.workspace.getConfiguration('lmstudio').get<string>('model') || '';

    if (!model) {
      throw new Error('Please set the LM Studio model in settings (lmstudio.model)');
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => abortController.abort());

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: true
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
    }

    // Parse SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              stream.markdown(content);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  }

  buildFileContext(request: vscode.ChatRequest): string {
    const files: vscode.Uri[] = [];

    // Include current active editor file
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      files.push(editor.document.uri);
    }

    // Include files from #file: references in the chat input
    for (const ref of request.references) {
      if (ref.value instanceof vscode.Uri) {
        files.push(ref.value);
      } else if (ref.value instanceof vscode.Location) {
        files.push(ref.value.uri);
      }
    }

    // Deduplicate
    const uniqueFiles = Array.from(
      new Map(files.map(f => [f.fsPath, f])).values()
    );

    if (uniqueFiles.length === 0) { return ''; }

    let context = '';
    for (const file of uniqueFiles) {
      try {
        const content = fs.readFileSync(file.fsPath, 'utf-8');
        const relPath = vscode.workspace.asRelativePath(file);
        context += `\n\n### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``;
      } catch {
        // Skip unreadable files
      }
    }

    return context ? '**Files included in context:**' + context : '';
  }
}

function buildMessagesFromHistory(
  chatContext: vscode.ChatContext
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  for (const turn of chatContext.history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      messages.push({ role: 'user', content: turn.prompt });
    } else if (turn instanceof vscode.ChatResponseTurn) {
      let text = '';
      for (const part of turn.response) {
        if (part instanceof vscode.ChatResponseMarkdownPart) {
          text += part.value.value;
        }
      }
      if (text) {
        messages.push({ role: 'assistant', content: text });
      }
    }
  }

  return messages;
}

export function activate(context: vscode.ExtensionContext) {
  const service = new LMStudioService();

  const participant = vscode.chat.createChatParticipant(
    'lmstudio-chat.participant',
    async (request, chatContext, stream, token) => {
      // Build conversation history
      const messages = buildMessagesFromHistory(chatContext);

      // Build file context from active editor + #file: references
      const fileContext = service.buildFileContext(request);

      // Append user message with file context
      const userContent = fileContext
        ? request.prompt + '\n\n' + fileContext
        : request.prompt;
      messages.push({ role: 'user', content: userContent });

      // Stream response from LM Studio
      stream.progress('Thinking...');

      try {
        await service.sendChatCompletion(messages, token, stream);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Cannot reach')) {
          stream.markdown(
            `**Cannot connect to LM Studio.**\n\n` +
            `Make sure LM Studio is running and the API server is enabled.\n\n` +
            `Check your settings:\n` +
            `- \`lmstudio.apiBaseUrl\`: ${vscode.workspace.getConfiguration('lmstudio').get('apiBaseUrl')}\n` +
            `- \`lmstudio.model\`: ${vscode.workspace.getConfiguration('lmstudio').get('model') || '(not set)'}\n\n` +
            `**WSL users:** Run \`setup-wsl-networking.ps1\` to enable mirrored networking.`
          );
        } else {
          stream.markdown(`**Error:** ${msg}`);
        }
      }
    }
  );

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
  context.subscriptions.push(participant);
}

export function deactivate() {}
