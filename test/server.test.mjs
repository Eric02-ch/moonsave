import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../server.mjs';
import { makeDemo, defaultSettings } from '../public/core.js';

async function running(options, run) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('靜態檔案正常提供，環境設定不能被下載', async () => running({ apiKey: '', model: '' }, async base => {
  for (const file of ['/', '/app.js', '/styles.css', '/core.js', '/sw.js', '/manifest.webmanifest', '/icon.svg']) assert.equal((await fetch(base + file)).status, 200, file);
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e%5cserver.mjs')).status, 403);
  assert.equal((await (await fetch(base + '/api/status')).json()).ai, false);
  const badHostStatus = await new Promise((resolve, reject) => {
    const req = http.get(base, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
  assert.equal(badHostStatus, 403);
}));
test('未設定 AI 與跨站請求不會呼叫供應商', async () => running({ apiKey: '', model: '', fetchImpl: () => { throw new Error('不應呼叫'); } }, async base => {
  assert.equal((await fetch(base + '/api/insights', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(base + '/api/insights', { method: 'POST', headers: { Origin: base } })).status, 503);
}));
test('AI 正確傳送驗證後資料、不儲存遠端請求並解析回覆', async () => {
  let payload;
  await running({ apiKey: 'test-only', model: 'test-model', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    payload = JSON.parse(options.body);
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: '這是測試回覆' }] }] });
  } }, async base => {
    const res = await fetch(base + '/api/insights', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ reports: makeDemo(), settings: defaultSettings, question: '本月回顧' }) });
    assert.equal(res.status, 200); assert.equal((await res.json()).text, '這是測試回覆');
    assert.equal(payload.store, false); assert.equal(payload.model, 'test-model');
    assert.equal(JSON.parse(payload.input).reports.length, 3);
  });
});
test('不完整回報拒絕，供應商錯誤不洩露內部訊息', async () => running({ apiKey: 'test-only', model: 'test-model', fetchImpl: async () => Response.json({ secret: 'private upstream error' }, { status: 401 }) }, async base => {
  const post = data => fetch(base + '/api/insights', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  assert.equal((await post({ reports: [], settings: defaultSettings, question: '' })).status, 400);
  const res = await post({ reports: makeDemo(), settings: defaultSettings, question: '' });
  assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /private upstream error/);
}));
