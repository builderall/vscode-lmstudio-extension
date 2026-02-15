import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseSSEChunk, truncateContent, sliceHistory, formatModelsOutput, formatConfigOutput } from './utils';

class LMStudioService {
  private getConfig() {
    const config = vscode.workspace.getConfiguration('lmstudio');
    return {
      apiUrl: config.get<string>('apiBaseUrl') || 'http://localhost:1234/v1',
      apiKey: config.get<string>('apiKey') || 'not-needed',
      model: config.get<string>('model') || '',
      systemPrompt: config.get<string>('systemPrompt') || '',
      maxFileSize: config.get<number>('maxFileSize') || 10000,
      maxHistoryTurns: config.get<number>('maxHistoryTurns') || 20,
    };
  }

  async fetchModels(): Promise<Array<{ id: string }>> {
    const { apiUrl, apiKey } = this.getConfig();
    const response = await fetch(`${apiUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    const json = await response.json() as { data: Array<{ id: string }> };
    return json.data || [];
  }

  async resolveModel(): Promise<string> {
    const { model } = this.getConfig();
    if (model) { return model; }

    // Auto-detect: pick the first available model
    const models = await this.fetchModels();
    if (models.length === 0) {
      throw new Error('No models loaded in LM Studio. Please load a model first.');
    }
    return models[0].id;
  }

  async sendChatCompletion(
    messages: Array<{ role: string; content: string }>,
    token: vscode.CancellationToken,
    stream: vscode.ChatResponseStream
  ): Promise<void> {
    const { apiUrl, apiKey } = this.getConfig();
    const model = await this.resolveModel();

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
        const content = parseSSEChunk(line);
        if (content) {
          stream.markdown(content);
        }
      }
    }
  }

  buildFileContext(request: vscode.ChatRequest): string {
    const { maxFileSize } = this.getConfig();
    const files: vscode.Uri[] = [];

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      files.push(editor.document.uri);
    }

    for (const ref of request.references) {
      if (ref.value instanceof vscode.Uri) {
        files.push(ref.value);
      } else if (ref.value instanceof vscode.Location) {
        files.push(ref.value.uri);
      }
    }

    const uniqueFiles = Array.from(
      new Map(files.map(f => [f.fsPath, f])).values()
    );

    if (uniqueFiles.length === 0) { return ''; }

    let context = '';
    for (const file of uniqueFiles) {
      try {
        let content = fs.readFileSync(file.fsPath, 'utf-8');
        const relPath = vscode.workspace.asRelativePath(file);
        content = truncateContent(content, maxFileSize);
        context += `\n\n### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``;
      } catch {
        // Skip unreadable files
      }
    }

    return context ? '**Files included in context:**' + context : '';
  }
}

function buildMessagesFromHistory(
  chatContext: vscode.ChatContext,
  maxTurns: number
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  const trimmed = sliceHistory(chatContext.history, maxTurns);

  for (const turn of trimmed) {
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
      const config = vscode.workspace.getConfiguration('lmstudio');

      // Handle slash commands
      if (request.command === 'models') {
        return handleModelsCommand(service, stream);
      }
      if (request.command === 'config') {
        return handleConfigCommand(config, stream);
      }

      // Build system prompt
      const systemPrompt = config.get<string>('systemPrompt') || '';
      const maxHistoryTurns = config.get<number>('maxHistoryTurns') || 20;

      const messages: Array<{ role: string; content: string }> = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }

      // Build conversation history (capped)
      messages.push(...buildMessagesFromHistory(chatContext, maxHistoryTurns));

      // Build file context
      const fileContext = service.buildFileContext(request);
      const userContent = fileContext
        ? request.prompt + '\n\n' + fileContext
        : request.prompt;
      messages.push({ role: 'user', content: userContent });

      // Stream response
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
            `- \`lmstudio.apiBaseUrl\`: ${config.get('apiBaseUrl')}\n` +
            `- \`lmstudio.model\`: ${config.get('model') || '(auto-detect)'}\n\n` +
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

async function handleModelsCommand(
  service: LMStudioService,
  stream: vscode.ChatResponseStream
): Promise<void> {
  stream.progress('Fetching models from LM Studio...');
  try {
    const models = await service.fetchModels();
    const config = vscode.workspace.getConfiguration('lmstudio');
    const currentModel = config.get<string>('model') || '';
    stream.markdown(formatModelsOutput(models, currentModel));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    stream.markdown(`**Failed to fetch models:** ${msg}\n\nIs LM Studio running?`);
  }
}

async function handleConfigCommand(
  config: vscode.WorkspaceConfiguration,
  stream: vscode.ChatResponseStream
): Promise<void> {
  stream.markdown(formatConfigOutput({
    apiUrl: config.get<string>('apiBaseUrl') || 'http://localhost:1234/v1',
    model: config.get<string>('model') || '',
    systemPrompt: config.get<string>('systemPrompt') || '',
    maxFileSize: config.get<number>('maxFileSize') || 10000,
    maxHistoryTurns: config.get<number>('maxHistoryTurns') || 20,
  }));
}

export function deactivate() {}
