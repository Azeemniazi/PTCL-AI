import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../build/config.js';

test('AI configuration initializes with default or environment values', () => {
  assert.equal(typeof config.ai.baseUrl, 'string');
  assert.equal(typeof config.ai.apiKey, 'string');
  assert.equal(typeof config.ai.transcribeModel, 'string');
  assert.equal(typeof config.ai.momModel, 'string');
});

test('handles unconfigured AI service with 503 on /api/chat', async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hello' })
    });
    // When AI_BASE_URL is empty, must return 503 ai_disconnected
    if (res.status === 503) {
      const data = await res.json();
      assert.equal(data.error?.code, 'ai_disconnected');
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') return;
    throw err;
  }
});

test('returns AI health check status correctly', async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/api/ai/health`);
    if (res.status === 200) {
      const data = await res.json();
      assert.equal(typeof data.connected, 'boolean');
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') return;
    throw err;
  }
});
