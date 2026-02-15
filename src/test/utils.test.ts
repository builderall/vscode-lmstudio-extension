import * as assert from 'assert';
import {
  parseSSEChunk,
  truncateContent,
  sliceHistory,
  formatModelsOutput,
  formatConfigOutput
} from '../utils';

describe('parseSSEChunk', () => {
  it('should extract content from valid SSE chunk', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    assert.strictEqual(parseSSEChunk(line), 'Hello');
  });

  it('should return null for [DONE] signal', () => {
    assert.strictEqual(parseSSEChunk('data: [DONE]'), null);
  });

  it('should return null for malformed JSON', () => {
    assert.strictEqual(parseSSEChunk('data: {broken json'), null);
  });

  it('should return null for empty delta content', () => {
    const line = 'data: {"choices":[{"delta":{}}]}';
    assert.strictEqual(parseSSEChunk(line), null);
  });

  it('should return null for missing choices', () => {
    const line = 'data: {"id":"123"}';
    assert.strictEqual(parseSSEChunk(line), null);
  });

  it('should return null for non-data lines', () => {
    assert.strictEqual(parseSSEChunk('event: message'), null);
    assert.strictEqual(parseSSEChunk(''), null);
    assert.strictEqual(parseSSEChunk(':comment'), null);
  });

  it('should handle content with special characters', () => {
    const line = 'data: {"choices":[{"delta":{"content":"line1\\nline2"}}]}';
    assert.strictEqual(parseSSEChunk(line), 'line1\nline2');
  });

  it('should throw on SSE error events', () => {
    const line = 'data: {"error":{"message":"Cannot truncate prompt with n_keep (5103) >= n_ctx (4096)"},"message":"Cannot truncate prompt with n_keep (5103) >= n_ctx (4096)"}';
    assert.throws(() => parseSSEChunk(line), /n_ctx/);
  });

  it('should throw on SSE error with nested error object', () => {
    const line = 'data: {"error":{"message":"Server overloaded"}}';
    assert.throws(() => parseSSEChunk(line), /Server overloaded/);
  });
});

describe('truncateContent', () => {
  it('should not truncate content under the limit', () => {
    assert.strictEqual(truncateContent('short', 100), 'short');
  });

  it('should not truncate content exactly at the limit', () => {
    const content = 'a'.repeat(100);
    assert.strictEqual(truncateContent(content, 100), content);
  });

  it('should truncate content over the limit', () => {
    const content = 'a'.repeat(150);
    const result = truncateContent(content, 100);
    assert.ok(result.startsWith('a'.repeat(100)));
    assert.ok(result.includes('truncated at 100 chars'));
  });

  it('should handle empty content', () => {
    assert.strictEqual(truncateContent('', 100), '');
  });
});

describe('sliceHistory', () => {
  it('should return all items when under max', () => {
    const items = [1, 2, 3];
    assert.deepStrictEqual(sliceHistory(items, 10), [1, 2, 3]);
  });

  it('should return all items when exactly at max', () => {
    const items = [1, 2, 3];
    assert.deepStrictEqual(sliceHistory(items, 3), [1, 2, 3]);
  });

  it('should return last N items when over max', () => {
    const items = [1, 2, 3, 4, 5];
    assert.deepStrictEqual(sliceHistory(items, 3), [3, 4, 5]);
  });

  it('should handle empty array', () => {
    assert.deepStrictEqual(sliceHistory([], 5), []);
  });

  it('should handle max of 1', () => {
    assert.deepStrictEqual(sliceHistory([1, 2, 3], 1), [3]);
  });
});

describe('formatModelsOutput', () => {
  it('should show no models message for empty array', () => {
    const result = formatModelsOutput([], '');
    assert.ok(result.includes('No models currently loaded'));
  });

  it('should list a single model', () => {
    const result = formatModelsOutput([{ id: 'llama-3' }], '');
    assert.ok(result.includes('`llama-3`'));
  });

  it('should mark the active model', () => {
    const models = [{ id: 'llama-3' }, { id: 'mistral' }];
    const result = formatModelsOutput(models, 'mistral');
    assert.ok(result.includes('`mistral` (active)'));
    assert.ok(!result.includes('`llama-3` (active)'));
  });

  it('should show auto-detect notice when no model configured', () => {
    const models = [{ id: 'llama-3' }];
    const result = formatModelsOutput(models, '');
    assert.ok(result.includes('auto-detect'));
    assert.ok(result.includes('llama-3'));
  });

  it('should not show auto-detect notice when model is configured', () => {
    const models = [{ id: 'llama-3' }];
    const result = formatModelsOutput(models, 'llama-3');
    assert.ok(!result.includes('auto-detect'));
  });
});

describe('formatConfigOutput', () => {
  it('should include all config values', () => {
    const result = formatConfigOutput({
      apiUrl: 'http://localhost:1234/v1',
      model: 'llama-3',
      systemPrompt: 'Be helpful',
      maxFileSize: 10000,
      maxHistoryTurns: 20,
      temperature: 0.7,
      requestTimeout: 60000,
    });
    assert.ok(result.includes('http://localhost:1234/v1'));
    assert.ok(result.includes('llama-3'));
    assert.ok(result.includes('Be helpful'));
    assert.ok(result.includes('10,000'));
    assert.ok(result.includes('20'));
  });

  it('should show auto-detect when model is empty', () => {
    const result = formatConfigOutput({
      apiUrl: 'http://localhost:1234/v1',
      model: '',
      systemPrompt: '',
      maxFileSize: 10000,
      maxHistoryTurns: 20,
      temperature: 0.7,
      requestTimeout: 60000,
    });
    assert.ok(result.includes('(auto-detect)'));
  });

  it('should truncate long system prompts', () => {
    const longPrompt = 'a'.repeat(100);
    const result = formatConfigOutput({
      apiUrl: 'http://localhost:1234/v1',
      model: 'test',
      systemPrompt: longPrompt,
      maxFileSize: 10000,
      maxHistoryTurns: 20,
      temperature: 0.7,
      requestTimeout: 60000,
    });
    assert.ok(result.includes('...'));
    assert.ok(!result.includes('a'.repeat(100)));
  });

  it('should show (none) when system prompt is empty', () => {
    const result = formatConfigOutput({
      apiUrl: 'http://localhost:1234/v1',
      model: 'test',
      systemPrompt: '',
      maxFileSize: 10000,
      maxHistoryTurns: 20,
      temperature: 0.7,
      requestTimeout: 60000,
    });
    assert.ok(result.includes('(none)'));
  });
});
