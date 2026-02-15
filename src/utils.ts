/**
 * Pure utility functions extracted for testability.
 * No vscode dependency — all functions work with plain data.
 */

/** Parse a single SSE line and return the content delta, or null. */
export function parseSSEChunk(line: string): string | null {
  if (!line.startsWith('data: ') || line === 'data: [DONE]') {
    return null;
  }
  try {
    const json = JSON.parse(line.slice(6));
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/** Truncate content to maxSize characters, appending a truncation notice. */
export function truncateContent(content: string, maxSize: number): string {
  if (content.length <= maxSize) {
    return content;
  }
  return content.substring(0, maxSize) + `\n... (truncated at ${maxSize} chars)`;
}

/** Return the last maxTurns items from an array. */
export function sliceHistory<T>(history: readonly T[], maxTurns: number): T[] {
  const start = Math.max(0, history.length - maxTurns);
  return history.slice(start);
}

/** Format the /models command output. */
export function formatModelsOutput(
  models: Array<{ id: string }>,
  currentModel: string
): string {
  if (models.length === 0) {
    return 'No models currently loaded in LM Studio.';
  }
  let output = '**Models available in LM Studio:**\n\n';
  for (const m of models) {
    const marker = m.id === currentModel ? ' (active)' : '';
    output += `- \`${m.id}\`${marker}\n`;
  }
  if (!currentModel) {
    output += `\n*No model configured — will auto-detect \`${models[0].id}\`*`;
  }
  return output;
}

/** Format the /config command output. */
export function formatConfigOutput(config: {
  apiUrl: string;
  model: string;
  systemPrompt: string;
  maxFileSize: number;
  maxHistoryTurns: number;
  temperature: number;
  requestTimeout: number;
}): string {
  const model = config.model || '(auto-detect)';
  const systemPrompt = config.systemPrompt || '(none)';
  return (
    `**LM Studio Configuration:**\n\n` +
    `| Setting | Value |\n` +
    `|---------|-------|\n` +
    `| API URL | \`${config.apiUrl}\` |\n` +
    `| Model | \`${model}\` |\n` +
    `| System Prompt | ${systemPrompt.length > 60 ? systemPrompt.substring(0, 60) + '...' : systemPrompt} |\n` +
    `| Max File Size | ${config.maxFileSize.toLocaleString()} chars |\n` +
    `| Max History Turns | ${config.maxHistoryTurns} |\n` +
    `| Temperature | ${config.temperature} |\n` +
    `| Request Timeout | ${(config.requestTimeout / 1000).toFixed(0)}s |\n\n` +
    `*Edit in Settings: \`Ctrl+,\` → search "lmstudio"*`
  );
}
