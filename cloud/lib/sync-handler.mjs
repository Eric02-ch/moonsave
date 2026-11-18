import { validateBackup } from '../public/app/core.js';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie' };
const json = (status, data) => new Response(JSON.stringify(data), { status, headers });
export async function handleSync(request, { db, userId, now = () => new Date().toISOString() }) {
  if (!userId) return json(401, { error: '請先登入。' });
  if (request.headers.get('X-MoonSave-User') !== userId) return json(403, { error: '登入帳號已變更，請重新載入後再同步。' });
  if (!db) return json(503, { error: '資料庫暫時無法使用，本機資料已保留。' });
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT payload, revision, updated_at FROM financial_snapshots WHERE user_id = ?').bind(userId).first();
    return json(200, row ? { payload: JSON.parse(row.payload), revision: row.revision, updatedAt: row.updated_at } : { payload: null, revision: 0, updatedAt: null });
  }
  if (request.method !== 'PUT') return json(405, { error: '不支援這個方法。' });
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json(403, { error: '不接受跨站寫入。' });
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { error: '請傳送 JSON。' });
  const match = request.headers.get('If-Match'), revision = Number(match);
  if (!match || !/^\d+$/.test(match) || !Number.isSafeInteger(revision) || revision < 0) return json(400, { error: '缺少有效的同步版本。' });
  let payload;
  try {
    if (Number(request.headers.get('Content-Length') || 0) > 512000) return json(413, { error: '同步資料超過 500 KB，請先匯出備份。' });
    const reader = request.body?.getReader(), chunks = []; let size = 0;
    if (!reader) return json(400, { error: '缺少資料。' });
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 512000) { await reader.cancel(); return json(413, { error: '同步資料超過 500 KB。' }); } chunks.push(value); }
    const buffer = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    payload = validateBackup(JSON.parse(new TextDecoder().decode(buffer)));
  } catch (error) { return json(400, { error: error.message || '資料格式錯誤。' }); }
  const prior = await db.prepare('SELECT payload, revision, updated_at FROM financial_snapshots WHERE user_id = ?').bind(userId).first();
  if (prior && (JSON.parse(prior.payload).version || 1) > payload.version) return json(409, { error: '此裝置版本較舊，請重新載入新版再同步，避免覆蓋新資料。' });
  const serialized = JSON.stringify(payload), updatedAt = now();
  const updated = revision === 0
    ? await db.prepare('INSERT INTO financial_snapshots (user_id, payload, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision').bind(userId, serialized, updatedAt).first()
    : await db.prepare('UPDATE financial_snapshots SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? RETURNING revision').bind(serialized, updatedAt, userId, revision).first();
  if (!updated) return json(409, { error: '另一台裝置已更新資料。本機資料仍保留，請先處理版本衝突。' });
  return json(200, { revision: updated.revision, updatedAt });
}
