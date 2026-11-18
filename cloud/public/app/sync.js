export const CLOUD_URL = 'https://moonsave-cloud-eric02.b0965160656.chatgpt.site';
export const isCloud = location.origin === new URL(CLOUD_URL).origin || (['127.0.0.1', 'localhost'].includes(location.hostname) && location.pathname.startsWith('/app/'));

// A revision belongs to one account. Unsynced work is never overwritten by polling.
export function createSync({ getPayload, applyPayload, onStatus, canApplyRemote = () => true }) {
  let user = null, revision = 0, generation = 0, dirty = false, busy = false, conflicted = false, timer, metaKey;
  const notify = (kind, text) => onStatus({ kind, text, user, busy, conflicted });
  function saveMeta() { localStorage.setItem(metaKey, JSON.stringify({ revision, dirty })); }
  async function request(method, payload) {
    const response = await fetch('/api/sync', { method, headers: { 'X-MoonSave-User': user.id, ...(method === 'PUT' ? { 'Content-Type': 'application/json', 'If-Match': String(revision) } : {}) }, ...(method === 'PUT' ? { body: JSON.stringify(payload) } : {}), cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || '同步暫時無法完成。'); error.conflict = response.status === 409; throw error; }
    return result;
  }
  async function refresh() {
    if (!user || busy || dirty || conflicted) return;
    busy = true;
    try {
      const result = await request('GET');
      if (dirty || !canApplyRemote()) return;
      if (result.revision !== revision && result.payload) { applyPayload(result.payload); revision = result.revision; saveMeta(); }
      notify('ok', revision ? '已與雲端同步' : '尚無雲端資料，可匯入備份或開始回報');
    } catch (error) { notify('error', error.message); }
    finally { busy = false; }
  }
  async function upload() {
    if (!user || busy || conflicted || !dirty) return;
    busy = true; const sendingGeneration = generation;
    notify('busy', '同步中…');
    try {
      const result = await request('PUT', getPayload());
      revision = result.revision; dirty = sendingGeneration !== generation; saveMeta();
      notify(dirty ? 'busy' : 'ok', dirty ? '仍有新變更等待同步' : '已與雲端同步');
    } catch (error) {
      conflicted = Boolean(error.conflict);
      notify(conflicted ? 'conflict' : 'error', conflicted ? '另一台裝置有新版本，本機變更已保留。請先解決衝突。' : `${error.message} 本機變更仍保留。`);
    } finally { busy = false; if (dirty && !conflicted && sendingGeneration !== generation) schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(upload, 900); }
  return {
    async start(onIdentity) {
      try {
        const response = await fetch('/api/session', { cache: 'no-store' });
        if (!response.ok) throw new Error('登入已過期，請重新登入。');
        user = await response.json(); metaKey = `moonsave.sync.${user.id}`;
        onIdentity(user);
        const meta = JSON.parse(localStorage.getItem(metaKey) || '{}'); revision = Number.isSafeInteger(meta.revision) ? meta.revision : 0; dirty = meta.dirty === true;
        const result = await request('GET');
        if (dirty && result.revision !== revision) { conflicted = true; notify('conflict', '雲端已有不同版本；本機資料已保留，請先解決衝突。'); }
        else if (dirty) await upload();
        else { if (result.payload) applyPayload(result.payload); revision = result.revision; saveMeta(); notify('ok', revision ? '已與雲端同步' : '尚無雲端資料，可匯入備份或開始回報'); }
      } catch (error) { notify('error', error.message); }
    },
    changed() { if (!user) return; dirty = true; generation++; saveMeta(); notify('busy', '本機已儲存，等待同步…'); schedule(); },
    retry: async () => { if (dirty) await upload(); else await refresh(); },
    async pullReplacingLocal() {
      if (!user || busy) throw new Error('請等待目前同步完成。');
      busy = true;
      try { const result = await request('GET'); if (!result.payload) throw new Error('雲端沒有可載入的版本。'); applyPayload(result.payload); revision = result.revision; dirty = false; conflicted = false; saveMeta(); notify('ok', '已載入雲端版本'); }
      finally { busy = false; }
    },
    refresh
  };
}
