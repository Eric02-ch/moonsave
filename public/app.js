import { defaultSettings, today, formatMoney as money, metrics, comparison, localInsights, validateReport, validateSettings, validateBackup, sortReports, makeDemo, moneyKeys } from './core.js';

const KEY = 'moonsave.v1', DRAFT = 'moonsave.draft.v1';
const app = document.querySelector('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let state = { version: 1, settings: { ...defaultSettings }, reports: [] };
let storageError = false, editingMonth = null, aiReady = false;
try { const saved = localStorage.getItem(KEY); if (saved) state = validateBackup(JSON.parse(saved)); } catch { storageError = true; }
function persist(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); state = next; return true; }
  catch { toast('儲存失敗，資料尚未寫入。請先匯出備份並確認瀏覽器空間。'); return false; }
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); setTimeout(() => el.classList.remove('visible'), 4500); }
async function confirmAction(title, message) {
  const d = document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-title').textContent = title; document.querySelector('#confirm-message').textContent = message;
  d.returnValue = ''; d.showModal();
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'confirm'), { once: true }));
}
const latest = () => sortReports(state.reports).at(-1);
const monthLabel = month => `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`;
const heading = (eyebrow, title, subtitle, action = '') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
const pill = (text, kind = '') => `<span class="pill ${kind}">${text}</span>`;
const stat = (label, value, detail, cls = '') => `<article class="card stat ${cls}"><p>${label}</p><strong>${value}</strong><small>${detail}</small></article>`;
function garden(progress) {
  const stage = progress >= 1 ? 3 : progress >= .5 ? 2 : progress > 0 ? 1 : 0;
  return `<div class="garden" role="img" aria-label="隨備用金目標成長的小花園，目前第 ${stage + 1} 階段"><div class="moon"></div><div class="star s1">✦</div><div class="star s2">✧</div><div class="garden-ring"></div><div class="plant"><div class="stem"></div><div class="leaf l1"></div><div class="leaf l2"></div>${stage >= 2 ? '<div class="leaf l3"></div><div class="leaf l4"></div>' : ''}${stage >= 3 ? '<div class="flower">✿</div>' : ''}<div class="pot"></div></div><div class="ground"></div><div class="pebble"></div></div>`;
}
function overview() {
  const r = latest();
  if (!r) return heading('A LITTLE EACH MONTH', '把日子，慢慢存好。', '不必記下每一筆花費。從每月一次的回報，照顧自己的未來。') + `<section class="welcome card"><div><span class="pill">你的第一步</span><h2>留一點錢，<br>給未來的自己。</h2><p>設定目標、盤點餘額，看看這個月真正留下多少。<br>先用示範資料逛逛，也可以直接開始。</p><div class="actions"><a href="#report" class="button primary">開始第一次回報 ↗</a><button class="button secondary" id="load-demo">體驗示範資料</button></div><small>無須登入 · 無銀行串接 · 資料保留在本機</small></div>${garden(0)}</section><div class="intro-grid"><article><b>01 / 輸入數字</b><p>沿用熟悉的帳戶分區，每月更新餘額。</p></article><article><b>02 / 看見累積</b><p>將儲蓄、預留款和信用卡欠款分清楚。</p></article><article><b>03 / 留下下一步</b><p>回顧本月變化，慢慢找到自己的步調。</p></article></div>`;
  const m = metrics(r, state.settings), c = comparison(r, state.reports, state.settings);
  const progress = Math.min(100, Math.max(0, m.goalProgress * 100));
  return heading('YOUR MONTHLY CHAPTER', '每一小步，都算數。', `${monthLabel(r.month)} 的財務日記 · 盤點於 ${esc(r.asOf)}`, '<a class="button primary" href="#report">＋ 填寫月回報</a>') +
    `<div class="section-heading"><h2>本月一覽</h2>${pill('已確認回報', 'green')}</div><section class="stats-grid">${stat('本月實際收入', money(m.income), '僅包含已入帳的收入')}${stat('回報淨儲蓄', money(m.netSaved), '基本＋額外儲蓄－提領', 'accent')}${stat('回報儲蓄率', m.savingsRate === null ? '—' : `${(m.savingsRate * 100).toFixed(1)}<em>%</em>`, m.savingsRate === null ? '收入為 0，暫不計算' : '以回報淨儲蓄 ÷ 實際收入')}</section>` +
    `<section class="dashboard-grid"><article class="card goal-card"><div class="section-heading"><h2>我的安全感基金</h2>${pill('緊急備用金')}</div><p class="goal-amount">${money(r.emergency)} <span>/ ${money(state.settings.emergencyGoal)}</span></p><div class="progress" role="progressbar" aria-label="備用金目標達成率" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><div class="progress-label"><span>已達成 ${Math.round(m.goalProgress * 100)}%</span><span>${m.goalProgress >= 1 ? '這一站，抵達了！' : `還差 ${money(state.settings.emergencyGoal - r.emergency)}`}</span></div><div class="garden-panel">${garden(m.goalProgress)}<p>你存下的，是更多選擇。<small>花園隨備用金目標慢慢成長</small></p></div><a class="text-link" href="#settings">調整我的目標 ↗</a></article><div class="right-stack"><article class="card"><div class="section-heading"><h2>資金各就各位</h2><span class="muted">TWD</span></div><dl class="balance-list"><div><dt>日常可用資金估算</dt><dd>${money(m.available)}</dd></div><div><dt>必要支出專用款</dt><dd>${money(r.bills)}</dd></div><div><dt>信用卡預備金 / 未繳</dt><dd>${money(r.cardReserve)} / ${money(r.cardDebt)}</dd></div></dl><div class="notice ${m.cardGap ? 'warning' : 'success'}">${m.cardGap ? `預留缺口 ${money(m.cardGap)}，記得核對繳款日。` : '信用卡預備金已涵蓋本次回報的未繳金額。'}</div><small class="fine-print">可用資金＝主帳戶＋現金與電子錢包－信用卡預留缺口；已排除備用金與專用款。</small></article><article class="card reflection"><span class="eyebrow">MONTHLY REFLECTION</span><h2>${c ? `備用金較上月${c.emergencyDelta >= 0 ? '增加' : '減少'} ${money(Math.abs(c.emergencyDelta))}` : '你的第一篇財務日記，完成了。'}</h2><p>${c ? '餘額變化與儲蓄成果分開看，才更接近真實的累積。' : '累積每月紀錄之後，就能看見自己的步調。'}</p><a class="text-link" href="#assistant">一起回顧這個月 ✧</a></article></div></section>`;
}
const labels = {
  salary: ['實領薪資', '已實際入帳'], otherIncome: ['其他實際收入', '獎金、兼職等；未入帳不計'],
  main: ['主帳戶餘額', '日常生活使用'], emergency: ['緊急備用金', '本次確認的實際餘額'], bills: ['必要支出專用款', '房租、水電等專用帳戶合計'],
  cardReserve: ['信用卡預備金', '為繳卡費保留的現金'], cardDebt: ['信用卡未繳金額', '已出帳＋未出帳，勿重複列入'], wallet: ['現金與電子錢包', '現金、悠遊卡、LINE Pay Money 等合計'],
  saved: ['基本儲蓄', '本期由收入新存下的金額'], extraSaved: ['額外儲蓄', '不含既有資金搬移或投資漲跌'], withdrawn: ['從儲蓄領回使用', '本期從儲蓄提領用於支出的金額']
};
function field(key, r) { return `<label class="field"><span>${labels[key][0]}</span><div class="money-input"><span>NT$</span><input aria-label="${labels[key][0]}" name="${key}" inputmode="numeric" type="number" min="0" max="100000000" step="1" placeholder="0" value="${esc(r[key] ?? '')}" required></div><small>${labels[key][1]}</small></label>`; }
function reportPage() {
  let r = state.reports.find(r => r.month === editingMonth);
  let draft = null; try { draft = JSON.parse(localStorage.getItem(DRAFT)); } catch {}
  const edit = Boolean(r);
  if (!r) r = draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : { month: today().slice(0, 7), asOf: today() };
  return heading('A MOMENT FOR YOUR MONEY', edit ? '更新這個月的紀錄' : '這個月，過得如何？', '用數字留下紀錄，不需要逐筆記帳。沒有的項目請填 0。') +
    `<form id="report-form" class="report-form"><section class="card"><div class="section-heading"><h2><span class="step">01</span> 回報時間</h2>${pill(edit ? '編輯紀錄' : draft ? '已載入草稿' : '新的篇章')}</div><div class="form-grid"><label class="field"><span>回報月份</span><input type="month" name="month" value="${esc(r.month || '')}" required ${edit ? 'readonly' : ''}></label><label class="field"><span>實際盤點日期</span><input type="date" name="asOf" value="${esc(r.asOf || '')}" required></label></div><p class="fine-print">收入與儲蓄請固定採同一期間（例如上次發薪日至本次發薪日）；餘額採盤點當下數字。</p></section>` +
    `<section class="card"><h2><span class="step">02</span> 這一期的收入</h2><div class="form-grid">${['salary', 'otherIncome'].map(k => field(k, r)).join('')}</div></section>` +
    `<section class="card"><h2><span class="step">03</span> 錢現在放在哪裡？</h2><p class="fine-print">每筆現金只放一個分類；投資帳戶暫不列入。信用卡未繳金額是負債，其餘欄位為現金餘額。</p><div class="form-grid">${['main', 'emergency', 'bills', 'cardReserve', 'cardDebt', 'wallet'].map(k => field(k, r)).join('')}</div></section>` +
    `<section class="card"><h2><span class="step">04</span> 真正留下多少？</h2><div class="notice">從主帳戶轉到備用金，不代表多一份資產。這裡只記本期由收入新留下的儲蓄，並扣除提領使用。</div><div class="form-grid">${['saved', 'extraSaved', 'withdrawn'].map(k => field(k, r)).join('')}</div><div id="form-preview" class="form-preview" aria-live="polite"></div><label class="field"><span>給這個月一句話 <small>選填</small></span><textarea name="note" maxlength="1000" rows="3" placeholder="例如：這個月修了機車，有一筆臨時支出。">${esc(r.note || '')}</textarea></label></section>` +
    `<section class="submit-panel"><label class="checkbox"><input type="checkbox" name="confirmed" required><span>我已確認這次的實際餘額與收入，沒有將預計收入或舊餘額直接當成新數字。</span></label><div id="form-error" class="form-error" role="alert"></div><div class="actions"><button type="submit" class="button primary">儲存${edit ? '更新' : '月回報'} ↗</button><button type="button" class="button secondary" id="save-draft">暫存草稿</button></div></section></form>`;
}
function historyPage() {
  const reports = sortReports(state.reports), max = Math.max(1, ...reports.map(r => Math.abs(metrics(r).netSaved)));
  return heading('YOUR PROGRESS, OVER TIME', '累積，都留在這裡。', '一起看長期的變化，單月起伏不代表全部。') + (!reports.length ? empty('還沒有成長紀錄', '完成第一次月回報，就能開始累積。') :
    `<section class="card"><div class="section-heading"><h2>每月回報淨儲蓄</h2>${pill('最近 12 筆')}</div><div class="chart" aria-label="每月淨儲蓄長條圖">${reports.slice(-12).map(r => { const m = metrics(r); return `<div class="chart-col"><span>${money(m.netSaved)}</span><div class="bar-space"><div class="bar ${m.netSaved < 0 ? 'negative' : ''}" style="height:${Math.max(3, Math.abs(m.netSaved) / max * 100)}%"></div></div><small>${r.month.slice(2).replace('-', '/')}</small></div>`; }).join('')}</div><p class="fine-print">提領大於新增儲蓄時為負值，以橘色顯示。至少連續三個月再觀察趨勢。</p></section><div class="section-heading history-title"><h2>每月日記</h2><span class="muted">${reports.length} 篇紀錄</span></div><div class="history-list">${[...reports].reverse().map(r => { const m = metrics(r); return `<article class="card history-item"><div class="month-tile">${r.month.slice(0, 4)}<strong>${Number(r.month.slice(5))}<small>月</small></strong></div><div class="history-info"><h3>${monthLabel(r.month)}</h3><p>${esc(r.note || '沒有備註，數字也留下了足跡。')}</p><small>盤點 ${esc(r.asOf)} · 備用金 ${money(r.emergency)}</small></div><div class="history-amount"><strong>${money(m.netSaved)}</strong><small>回報淨儲蓄</small><div><button class="text-link" data-edit="${r.month}">編輯</button><button class="text-link danger" data-delete="${r.month}">刪除</button></div></div></article>`; }).join('')}</div>`);
}
function empty(title, detail) { return `<section class="card empty"><span>☾</span><h2>${title}</h2><p>${detail}</p><a href="#report" class="button primary">填寫月回報 ↗</a></section>`; }
function assistantPage() {
  const r = latest(); if (!r) return heading('A THOUGHTFUL SECOND LOOK', '你的每月回顧助手', '把數字看清楚，再決定下一步。') + empty('先留下一篇回報', '助手會根據你確認的數字，整理當月回顧。');
  const insights = localInsights(r, state.reports, state.settings);
  return heading('A THOUGHTFUL SECOND LOOK', '一起回顧這個月。', `${monthLabel(r.month)} · 計算交給程式，解釋與追問交給助手。`) +
    `<section class="card assistant-card"><div class="section-heading"><h2>✧ 本月回顧</h2>${pill('本機規則月報', 'green')}</div><div class="reading">${insights.observations.map(x => `<p>${esc(x)}</p>`).join('')}</div><h3>下一步，可以從這裡開始</h3><ol class="action-list">${insights.actions.map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="fine-print">淨儲蓄為你填寫的儲蓄流入減提領，尚未經完整收支對帳；不等同完整淨資產成長。</p></section>` +
    `<section class="card ai-panel"><div class="section-heading"><h2>和 AI 多聊一點</h2>${pill(aiReady ? '已連接 AI' : '尚未設定 AI')}</div><p class="subtitle">${aiReady ? '只會在你按下分析時，將這份回報、最近三個月紀錄、目標及問題傳送至 OpenAI。' : '目前使用本機規則月報。啟動附帶的 Node 後端並設定 API 金鑰與模型後，可啟用 AI 追問。'}</p><form id="ai-form"><label class="field"><span>想一起釐清什麼？</span><textarea name="question" maxlength="800" rows="3" placeholder="例如：根據最近幾個月的紀錄，有哪些變化值得注意？" ${aiReady ? '' : 'disabled'}></textarea></label><label class="checkbox"><input type="checkbox" name="consent" required ${aiReady ? '' : 'disabled'}><span>同意將上述財務資料（包含備註）傳送至 OpenAI 產生這次回覆。</span></label><button class="button primary" type="submit" ${aiReady ? '' : 'disabled'}>✧ 產生 AI 回顧</button></form><div id="ai-result" class="ai-result" aria-live="polite"></div><small class="fine-print">AI 可能解讀錯誤；實際數字以你確認的回報為準。每次分析為獨立請求，目前不儲存聊天紀錄。</small></section>`;
}
function settingsPage() {
  const s = state.settings;
  return heading('MAKE ROOM FOR YOUR FUTURE', '照自己的步調設定。', '目標可以調整，持續使用比漂亮的數字更重要。') +
    `<section class="card"><h2>我的儲蓄目標</h2><form id="settings-form"><div class="form-grid">${[['monthlyGoal', '每月基本儲蓄目標'], ['emergencyFloor', '備用金底線'], ['emergencyGoal', '下一階段備用金目標']].map(([key, label]) => `<label class="field"><span>${label}</span><div class="money-input"><span>NT$</span><input type="number" name="${key}" value="${s[key]}" min="1" max="100000000" step="1" required></div></label>`).join('')}</div><button class="button primary">儲存目標</button><p id="settings-error" class="form-error" role="alert"></p></form></section>` +
    `<section class="card settings-section"><h2>資料，留在自己手上。</h2><p>回報儲存在目前瀏覽器，沒有跨裝置同步。清除網站資料或更換手機可能遺失，記得定期匯出備份。</p><div class="actions"><button id="export" class="button secondary">↓ 匯出 JSON 備份</button><label class="button secondary file-button">↑ 匯入備份<input id="import" type="file" accept=".json,application/json"></label></div><p class="fine-print">備份包含已確認回報及目標，不含草稿。匯入前會檢查格式，並請你確認是否取代現有紀錄。</p></section>` +
    `<section class="card settings-section"><h2>先逛逛，再開始。</h2><p>載入三個月的虛構資料，體驗進度、紀錄與月報。</p><button id="load-demo" class="button secondary">載入示範資料</button><hr><h3>清除本機資料</h3><p class="fine-print">只影響這個瀏覽器。建議先匯出備份。</p><button id="clear" class="button secondary danger">清除全部回報與草稿</button></section>`;
}
function readForm(form, confirmed = false) {
  const data = Object.fromEntries(new FormData(form));
  for (const key of moneyKeys) data[key] = data[key] === '' ? null : Number(data[key]);
  data.confirmed = confirmed && form.elements.confirmed.checked;
  return data;
}
function bind() {
  document.querySelector('#load-demo')?.addEventListener('click', async () => {
    if (state.reports.length && !await confirmAction('載入示範資料？', '這會取代現有回報，請先匯出需要保留的資料。')) return;
    if (persist({ ...state, reports: makeDemo() })) { editingMonth = null; location.hash = 'overview'; render(); toast('已載入虛構示範資料。'); }
  });
  const form = document.querySelector('#report-form');
  if (form) {
    const preview = () => { const d = readForm(form); const n = (d.saved || 0) + (d.extraSaved || 0) - (d.withdrawn || 0); document.querySelector('#form-preview').textContent = `目前填寫的回報淨儲蓄：${money(n)}`; };
    form.addEventListener('input', preview); preview();
    document.querySelector('#save-draft').addEventListener('click', () => { try { localStorage.setItem(DRAFT, JSON.stringify(readForm(form))); toast('草稿已留在這台裝置。'); } catch { toast('無法暫存，請確認瀏覽器儲存空間。'); } });
    form.addEventListener('submit', async event => {
      event.preventDefault(); const error = document.querySelector('#form-error');
      try {
        const r = validateReport(readForm(form, true));
        if (!editingMonth && state.reports.some(old => old.month === r.month) && !await confirmAction('更新同月份回報？', `${monthLabel(r.month)} 已有紀錄。確認後會以這次填寫的資料取代。`)) return;
        const next = { ...state, reports: [...state.reports.filter(old => old.month !== r.month), r] };
        if (persist(next)) { try { localStorage.removeItem(DRAFT); } catch {} editingMonth = null; location.hash = 'overview'; toast('這個月的努力，留下來了。'); }
      } catch (e) { error.textContent = e.message; }
    });
  }
  document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => { editingMonth = btn.dataset.edit; location.hash = 'report'; }));
  document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (await confirmAction('刪除這個月的回報？', '刪除後可透過先前匯出的備份還原。')) { if (persist({ ...state, reports: state.reports.filter(r => r.month !== btn.dataset.delete) })) render(); }
  }));
  document.querySelector('#settings-form')?.addEventListener('submit', event => {
    event.preventDefault();
    try { const settings = validateSettings(Object.fromEntries([...new FormData(event.target)].map(([k, v]) => [k, Number(v)]))); if (persist({ ...state, settings })) toast('目標已更新。'); }
    catch (e) { document.querySelector('#settings-error').textContent = e.message; }
  });
  document.querySelector('#export')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `moonsave-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('備份已匯出，請妥善保管財務資料。');
  });
  document.querySelector('#import')?.addEventListener('change', async event => {
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 2000000) throw new Error('備份檔案過大，請使用小於 2 MB 的 JSON。');
      const next = validateBackup(JSON.parse(await file.text()));
      if (await confirmAction('匯入並取代資料？', `備份包含 ${next.reports.length} 個月的回報，將取代目前的回報與目標。`)) { if (persist(next)) { render(); toast('備份已還原。'); } }
    } catch (e) { toast(`匯入失敗：${e.message}`); } finally { event.target.value = ''; }
  });
  document.querySelector('#clear')?.addEventListener('click', async () => {
    if (await confirmAction('清除本機資料？', '將清除所有回報、目標設定與草稿。請先匯出需要的資料。')) {
      if (persist({ version: 1, reports: [], settings: { ...defaultSettings } })) { try { localStorage.removeItem(DRAFT); } catch {} editingMonth = null; render(); toast('本機資料已清除。'); }
    }
  });
  document.querySelector('#ai-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const button = event.target.querySelector('button'), result = document.querySelector('#ai-result');
    button.disabled = true; result.textContent = '正在根據已確認的資料整理回顧…';
    const selected = sortReports(state.reports).slice(-3);
    try {
      const response = await fetch('./api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reports: selected, settings: state.settings, question: new FormData(event.target).get('question') || '請整理本月回顧與最多三項下月行動。' }), signal: AbortSignal.timeout(65000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '分析暫時無法使用。');
      result.textContent = data.text;
    } catch (e) { result.textContent = `AI 回覆未完成：${e.name === 'TimeoutError' ? '請求逾時，請稍後再試。' : e.message}`; }
    finally { button.disabled = false; }
  });
}
const pages = { overview, report: reportPage, history: historyPage, assistant: assistantPage, settings: settingsPage };
let lastPage;
function render() {
  const page = Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  if (lastPage === 'report' && page !== 'report') editingMonth = null;
  app.innerHTML = (storageError ? '<div class="notice warning">本機資料無法讀取。為避免覆蓋原始資料，請先使用瀏覽器工具保留 moonsave.v1 的內容，再重新開始。此工作階段暫停寫入。</div>' : '') + pages[page]();
  document.querySelectorAll('[data-page]').forEach(a => { a.classList.toggle('active', a.dataset.page === page); if (a.dataset.page === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  lastPage = page; bind();
  if (storageError) app.querySelectorAll('button,input,textarea').forEach(el => el.disabled = true);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); app.focus({ preventScroll: true }); });
render();
fetch('./api/status').then(r => r.ok ? r.json() : null).then(data => { aiReady = data?.ai === true; if (location.hash === '#assistant') render(); }).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
