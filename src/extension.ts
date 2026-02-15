import * as vscode from 'vscode';
import { parseSSEChunk, truncateContent, sliceHistory, formatModelsOutput, formatConfigOutput } from './utils';

interface LMStudioConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxFileSize: number;
  maxHistoryTurns: number;
  temperature: number;
  maxTokens: number;
  requestTimeout: number;
  reviewInclude: string;
  reviewExclude: string;
}

class LMStudioService {
  private activeAbortController: AbortController | null = null;

  getConfig(): LMStudioConfig {
    const config = vscode.workspace.getConfiguration('lmstudio');
    return {
      apiUrl: config.get<string>('apiBaseUrl') || 'http://localhost:1234/v1',
      apiKey: config.get<string>('apiKey') || 'not-needed',
      model: config.get<string>('model') || '',
      systemPrompt: config.get<string>('systemPrompt') || '',
      maxFileSize: config.get<number>('maxFileSize') || 10000,
      maxHistoryTurns: config.get<number>('maxHistoryTurns') || 20,
      temperature: config.get<number>('temperature') ?? 0.7,
      maxTokens: config.get<number>('maxTokens') || 4096,
      requestTimeout: config.get<number>('requestTimeout') || 60000,
      reviewInclude: config.get<string>('reviewInclude') || '**/*.{ts,tsx,js,jsx,py,go,rs,java,c,cpp,h,hpp,cs,rb,php,swift,kt}',
      reviewExclude: config.get<string>('reviewExclude') || '{**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/test/**,**/tests/**,**/__tests__/**,**/*.test.*,**/*.spec.*,**/*.d.ts,**/*.min.js,**/*.map}',
    };
  }

  async fetchModels(cfg?: LMStudioConfig): Promise<Array<{ id: string }>> {
    const { apiUrl, apiKey, requestTimeout } = cfg || this.getConfig();
    const response = await fetch(`${apiUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(requestTimeout)
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    const json = await response.json() as { data: Array<{ id: string }> };
    return json.data || [];
  }

  private async resolveModel(cfg: LMStudioConfig): Promise<string> {
    if (cfg.model) { return cfg.model; }

    // Auto-detect: pick the first available model
    const models = await this.fetchModels(cfg);
    if (models.length === 0) {
      throw new Error('No models loaded in LM Studio. Please load a model first.');
    }
    return models[0].id;
  }

  async sendChatCompletion(
    messages: Array<{ role: string; content: string }>,
    token: vscode.CancellationToken,
    stream: vscode.ChatResponseStream,
    cfg?: LMStudioConfig
  ): Promise<void> {
    const config = cfg || this.getConfig();
    const model = await this.resolveModel(config);

    // Abort any in-flight request before starting a new one
    this.activeAbortController?.abort();

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    token.onCancellationRequested(() => abortController.abort());

    // Rolling timeout: resets on every chunk so long streams aren't killed
    let timeoutId = setTimeout(() => abortController.abort(), config.requestTimeout);
    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => abortController.abort(), config.requestTimeout);
    };

    try {
      const response = await fetch(`${config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: true
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('LM Studio returned an empty response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) { break; }

        resetTimeout();
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

      // Process any remaining data in the buffer
      if (buffer.trim()) {
        const content = parseSSEChunk(buffer);
        if (content) {
          stream.markdown(content);
        }
      }
    } finally {
      clearTimeout(timeoutId);
      this.activeAbortController = null;
    }
  }

  async buildFileContext(request: vscode.ChatRequest, maxFileSize: number): Promise<string> {
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
        const bytes = await vscode.workspace.fs.readFile(file);
        let content = Buffer.from(bytes).toString('utf-8');
        const relPath = vscode.workspace.asRelativePath(file);
        content = truncateContent(content, maxFileSize);
        context += `\n\n### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``;
      } catch {
        // Skip unreadable files
      }
    }

    return context ? '**Files included in context:**' + context : '';
  }

  async buildWorkspaceContext(cfg: LMStudioConfig): Promise<{
    context: string;
    reviewFiles: string[];
    contextFiles: string[];
    testFiles: string[];
  }> {
    const empty = { context: '', reviewFiles: [], contextFiles: [], testFiles: [] };

    // 1. Gather source files to review
    const uris = await vscode.workspace.findFiles(cfg.reviewInclude, cfg.reviewExclude, 50);

    if (uris.length === 0) { return empty; }

    // Deduplicate and sort by path for stable ordering
    const uniqueFiles = Array.from(
      new Map(uris.map(f => [f.fsPath, f])).values()
    ).sort((a, b) => a.fsPath.localeCompare(b.fsPath));

    let reviewContext = '';
    const reviewFiles: string[] = [];
    for (const file of uniqueFiles) {
      try {
        const bytes = await vscode.workspace.fs.readFile(file);
        let content = Buffer.from(bytes).toString('utf-8');
        const relPath = vscode.workspace.asRelativePath(file);
        content = truncateContent(content, cfg.maxFileSize);
        reviewContext += `\n\n### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``;
        reviewFiles.push(relPath);
      } catch {
        // Skip unreadable files
      }
    }

    // 2. Gather project context files (not reviewed, just for understanding)
    let projectContext = '';
    const contextFiles: string[] = [];
    const projectFiles = ['CLAUDE.md', 'README.md', 'package.json'];
    for (const name of projectFiles) {
      const found = await vscode.workspace.findFiles(name, undefined, 1);
      if (found.length > 0) {
        try {
          const bytes = await vscode.workspace.fs.readFile(found[0]);
          let content = Buffer.from(bytes).toString('utf-8');
          content = truncateContent(content, cfg.maxFileSize);
          projectContext += `\n\n### Project file: ${name}\n\`\`\`\n${content}\n\`\`\``;
          contextFiles.push(name);
        } catch {
          // Skip unreadable files
        }
      }
    }

    // 3. Gather test files (not reviewed, but provided as reference)
    let testContext = '';
    const testFiles: string[] = [];
    const testPatterns = '{**/test/**,**/tests/**,**/__tests__/**,**/*.test.*,**/*.spec.*}';
    const testExclude = '{**/node_modules/**,**/out/**,**/dist/**,**/build/**}';
    const testUris = await vscode.workspace.findFiles(testPatterns, testExclude, 20);
    for (const file of testUris) {
      // Only include test files matching the same extensions as reviewInclude
      const ext = file.fsPath.split('.').pop() || '';
      const reviewExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php', 'swift', 'kt'];
      if (!reviewExts.includes(ext)) { continue; }
      try {
        const bytes = await vscode.workspace.fs.readFile(file);
        let content = Buffer.from(bytes).toString('utf-8');
        const relPath = vscode.workspace.asRelativePath(file);
        content = truncateContent(content, cfg.maxFileSize);
        testContext += `\n\n### Test file (reference only — do not review): ${relPath}\n\`\`\`\n${content}\n\`\`\``;
        testFiles.push(relPath);
      } catch {
        // Skip unreadable files
      }
    }

    // Assemble full context
    let context = '';
    if (reviewContext) {
      context += `**Files to review (${reviewFiles.length}):**` + reviewContext;
    }
    if (projectContext) {
      context += `\n\n**Project context (do not review — use for understanding only):**` + projectContext;
    }
    if (testContext) {
      context += `\n\n**Existing tests (do not review — check these before claiming test gaps):**` + testContext;
    }

    return { context, reviewFiles, contextFiles, testFiles };
  }

  abort(): void {
    this.activeAbortController?.abort();
    this.activeAbortController = null;
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
      // Read config once for the entire request
      const cfg = service.getConfig();

      // Handle slash commands
      if (request.command === 'models') {
        return handleModelsCommand(service, stream);
      }
      if (request.command === 'config') {
        return handleConfigCommand(cfg, stream);
      }
      if (request.command === 'review') {
        // Use lower temperature for analytical review, allow longer output, and extend timeout
        // Review sends all workspace files so the model needs more time for first token
        const reviewCfg = {
          ...cfg,
          temperature: 0.3,
          maxTokens: Math.max(cfg.maxTokens, 8192),
          requestTimeout: Math.max(cfg.requestTimeout, 180000), // at least 3 minutes
        };
        return handleReviewCommand(service, reviewCfg, stream, token);
      }

      const messages: Array<{ role: string; content: string }> = [];
      if (cfg.systemPrompt) {
        messages.push({ role: 'system', content: cfg.systemPrompt });
      }

      // Build conversation history (capped)
      messages.push(...buildMessagesFromHistory(chatContext, cfg.maxHistoryTurns));

      // Build file context (async)
      const fileContext = await service.buildFileContext(request, cfg.maxFileSize);
      const userContent = fileContext
        ? request.prompt + '\n\n' + fileContext
        : request.prompt;
      messages.push({ role: 'user', content: userContent });

      // Stream response
      stream.progress('Thinking...');

      try {
        await service.sendChatCompletion(messages, token, stream, cfg);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Cannot reach')) {
          stream.markdown(
            `**Cannot connect to LM Studio.**\n\n` +
            `Make sure LM Studio is running and the API server is enabled.\n\n` +
            `Check your settings:\n` +
            `- \`lmstudio.apiBaseUrl\`: ${cfg.apiUrl}\n` +
            `- \`lmstudio.model\`: ${cfg.model || '(auto-detect)'}\n\n` +
            `**WSL users:** Run \`setup-wsl-networking.ps1\` to enable mirrored networking.`
          );
        } else if (msg.includes('abort') || msg.includes('timeout')) {
          stream.markdown(`**Request timed out.** LM Studio may be overloaded or unresponsive. Check that LM Studio is running and try again.`);
        } else {
          stream.markdown(`**Error:** ${msg}`);
        }
      }
    }
  );

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.svg');
  context.subscriptions.push(participant);

  // Abort in-flight requests on deactivation
  context.subscriptions.push({ dispose: () => service.abort() });
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
  cfg: LMStudioConfig,
  stream: vscode.ChatResponseStream
): Promise<void> {
  stream.markdown(formatConfigOutput({
    apiUrl: cfg.apiUrl,
    model: cfg.model,
    systemPrompt: cfg.systemPrompt,
    maxFileSize: cfg.maxFileSize,
    maxHistoryTurns: cfg.maxHistoryTurns,
    temperature: cfg.temperature,
    requestTimeout: cfg.requestTimeout,
  }));
}

async function handleReviewCommand(
  service: LMStudioService,
  cfg: LMStudioConfig,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  stream.progress('Scanning workspace files...');
  try {
    const { context: fileContext, reviewFiles, contextFiles, testFiles } = await service.buildWorkspaceContext(cfg);
    if (!fileContext) {
      stream.markdown('**No files found to review.** Make sure your workspace contains source files.');
      return;
    }

    const contextSize = fileContext.length;
    const reviewList = reviewFiles.map((f: string) => `- \`${f}\``).join('\n');
    let diagnostic = `*Reviewing ${reviewFiles.length} files (${(contextSize / 1024).toFixed(1)} KB total context):*\n${reviewList}`;
    if (contextFiles.length > 0) {
      diagnostic += `\n\n*Project context: ${contextFiles.join(', ')}*`;
    }
    if (testFiles.length > 0) {
      diagnostic += `\n*Test reference: ${testFiles.join(', ')}*`;
    }
    diagnostic += `\n\n*Sending to LM Studio for review — this may take a minute or two...*\n\n`;
    stream.markdown(diagnostic);
    stream.progress('Waiting for LM Studio to process...');

    const messages: Array<{ role: string; content: string }> = [];
    if (cfg.systemPrompt) {
      messages.push({ role: 'system', content: cfg.systemPrompt });
    }
    messages.push({
      role: 'user',
      content: `Review the following codebase. Rules:

1. **Only report issues you can directly verify from the code provided.** Do not speculate about what "might" happen or what "could" be problematic. If you cannot point to the exact line causing the issue, do not report it.
2. **Do not report missing tests for code that has tests in the provided context.** Check the test/reference files before claiming test gaps.
3. **Do not suggest architectural changes unless there is a concrete bug or measurable problem.** "Could be cleaner" or "consider using X pattern" are not findings.
4. **Do not pad.** If there are no real issues, say so. A short review with zero findings is better than a long review with fabricated ones.

For each real finding:
- Rate severity: 🔴 Bug/security issue, 🟡 Warning, 🔵 Minor suggestion
- Show the exact code snippet and file name
- Explain the concrete impact (what breaks, what data is lost, what fails)

Do not use fixed section headers — just report what you find, grouped naturally.

` + fileContext
    });

    await service.sendChatCompletion(messages, token, stream, cfg);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
      stream.markdown(`**Cannot connect to LM Studio.** Make sure it's running and the API server is enabled.`);
    } else if (msg.includes('abort') || msg.includes('timeout')) {
      stream.markdown(`**Request timed out.** The review may require a longer timeout for large codebases. Current timeout: ${(cfg.requestTimeout / 1000).toFixed(0)}s`);
    } else {
      stream.markdown(`**Review failed:** ${msg}`);
    }
  }
}

export function deactivate() {}
