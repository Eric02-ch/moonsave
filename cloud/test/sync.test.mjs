import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleSync } from '../lib/sync-handler.mjs';
import { defaultSettings, makeDemo } from '../public/app/core.js';
import { demo } from '../public/app/finance.js';
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE financial_snapshots (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)');
  return { prepare(query) { return { bind(...args) { return { async first() { return sql.prepare(query).get(...args) || null; } }; } }; } };
}
const payload = () => ({ version: 1, settings: { ...defaultSettings }, reports: makeDemo() });
test('新版回報與跨期草稿雲端往返，舊客戶端不得降版覆蓋', async () => {
  const db=database(),opts={db,userId:'a'},data=demo();
  assert.equal((await handleSync(request('a',{method:'PUT',data}),opts)).status,200);
  assert.deepEqual((await (await handleSync(request('a'),opts)).json()).payload,data);
  assert.equal((await handleSync(request('a',{method:'PUT',revision:1,data:payload()}),opts)).status,409);
  assert.equal((await (await handleSync(request('a'),opts)).json()).revision,1);
});
function request(user, { method = 'GET', revision = 0, data, origin = 'https://sync.test', extra = {} } = {}) {
  return new Request('https://sync.test/api/sync', { method, headers: { 'X-MoonSave-User': user, Origin: origin, 'Content-Type': 'application/json', 'If-Match': String(revision), ...extra }, ...(method === 'PUT' ? { body: JSON.stringify(data || payload()) } : {}) });
}
test('未登入、帳號已切換與跨站寫入一律拒絕', async () => {
  const db = database();
  assert.equal((await handleSync(request('a'), { db, userId: null })).status, 401);
  assert.equal((await handleSync(request('a'), { db, userId: 'b' })).status, 403);
  assert.equal((await handleSync(request('a', { method: 'PUT', origin: 'https://elsewhere.test' }), { db, userId: 'a' })).status, 403);
});
test('兩個帳號的資料由登入身分隔離，不接受 payload 偽造擁有者', async () => {
  const db = database();
  const put = await handleSync(request('a', { method: 'PUT', data: { ...payload(), userId: 'b' } }), { db, userId: 'a' });
  assert.equal(put.status, 200);
  const a = await (await handleSync(request('a'), { db, userId: 'a' })).json();
  const b = await (await handleSync(request('b'), { db, userId: 'b' })).json();
  assert.equal(a.revision, 1); assert.equal(b.revision, 0); assert.equal(b.payload, null); assert.equal(a.payload.userId, undefined);
});
test('舊裝置無法覆蓋新版本，兩個首次寫入也只能成功一份', async () => {
  const db = database(), opts = { db, userId: 'a' };
  assert.equal((await handleSync(request('a', { method: 'PUT' }), opts)).status, 200);
  assert.equal((await handleSync(request('a', { method: 'PUT' }), opts)).status, 409);
  assert.equal((await handleSync(request('a', { method: 'PUT', revision: 1 }), opts)).status, 200);
  assert.equal((await handleSync(request('a', { method: 'PUT', revision: 1 }), opts)).status, 409);
  assert.equal((await (await handleSync(request('a'), opts)).json()).revision, 2);
});
test('草稿缺漏值往返雲端仍為 null；正式回報仍需完整確認', async () => {
  const db = database(), draft = { ...makeDemo()[0], saved: null, wallet: null, confirmed: false };
  const data = { ...payload(), reports: [], draft };
  assert.equal((await handleSync(request('a', { method: 'PUT', data }), { db, userId: 'a' })).status, 200);
  const result = await (await handleSync(request('a'), { db, userId: 'a' })).json();
  assert.equal(result.payload.draft.saved, null); assert.equal(result.payload.draft.confirmed, false);
  assert.equal((await handleSync(request('a', { method: 'PUT', revision: 1, data: { ...data, reports: [draft] } }), { db, userId: 'a' })).status, 400);
});
test('缺少版本、過大請求與不合法資料拒絕，回覆不快取', async () => {
  const db = database(), opts = { db, userId: 'a' };
  assert.equal((await handleSync(request('a', { method: 'PUT', extra: { 'If-Match': '' } }), opts)).status, 400);
  assert.equal((await handleSync(request('a', { method: 'PUT', extra: { 'Content-Length': '600000' } }), opts)).status, 413);
  assert.equal((await handleSync(request('a', { method: 'PUT', data: { ...payload(), settings: { monthlyGoal: -1 } } }), opts)).status, 400);
  assert.match((await handleSync(request('a'), opts)).headers.get('Cache-Control'), /no-store/);
});
