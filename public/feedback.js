import {feedbackContext,contextDigest} from './feedback-context.js';
import {formatMoney as money} from './core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amt=v=>v==null?'待補':money(v);
const results=new Map();
export function feedbackSection(entryId) {
  return `<section class="card ai-feedback" data-ai-entry="${esc(entryId)}"><h2>✧ AI 回顧建議</h2><p class="muted">正在準備分析資料…</p></section>`;
}
function resultHTML(value) {
  const f=value.feedback;
  return `<div class="ai-result"><p class="ai-summary">${esc(f.summary)}</p>${f.observations.length?`<h3>這期值得注意</h3>${f.observations.map(v=>`<article><b>${esc(v.title)}</b><p>${esc(v.detail)}</p></article>`).join('')}`:''}${f.actions.length?`<h3>下一步，從這裡開始</h3><ol>${f.actions.map(v=>`<li><b>${esc(v.title)}</b><p>${esc(v.detail)}</p></li>`).join('')}</ol>`:''}${f.limitations.length?`<details><summary>這次分析的資料限制</summary><ul>${f.limitations.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details>`:''}<small class="fine-print">${value.cached?'重用相同資料的建議':'AI 生成建議'} · ${esc(new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'}).format(new Date(value.generatedAt)))}</small></div>`;
}
export function bindFeedback({root=document,state,user,isCloud}) {
  root.querySelectorAll('[data-ai-entry]').forEach(slot=>mount(slot,{state,user,isCloud}));
}
async function mount(slot,{state,user,isCloud}) {
  const entryId=slot.dataset.aiEntry;
  if(!isCloud){slot.innerHTML='<h2>✧ AI 回顧建議</h2><p class="muted">AI 分析提供於私人雲端版。公開體驗版不傳送資料或呼叫模型。</p>';return;}
  if(!user){slot.innerHTML='<h2>✧ AI 回顧建議</h2><p class="muted">請先登入私人版，再取得 AI 建議。</p>';return;}
  let context,includeNotes=false,enabled=false,loading=false,digest=null,result=null;
  const auth={'X-MoonSave-User':user.id};
  function draw(message='') {
    if(!slot.isConnected)return;
    try{context=feedbackContext(state,entryId,includeNotes);}catch{slot.innerHTML='<h2>✧ AI 回顧建議</h2><p>找不到本期資料，請返回首頁重新選擇。</p>';return;}
    slot.innerHTML=`<div class="section-heading"><h2>✧ AI 回顧建議</h2><span class="pill">${loading?'分析中':enabled?'可分析':'服務設定中'}</span></div><p class="fine-print">根據本筆與最近最多 3 筆紀錄，整理觀察和下一步。只在你按下按鈕後分析。</p><details class="ai-data-preview"><summary>檢視本次將送出的資料（${context.entries.length} 筆）</summary>${context.entries.map(e=>`<div><b>${esc(e.month)} · ${esc(e.observationDate)}</b><small>${esc(e.status)} · ${esc(e.timing)}</small><p>收入 ${amt(e.income)} · 支出 ${amt(e.expense)} · 已提供資產小計 ${amt(e.knownAssetSubtotal)}</p><ul>${e.accounts.map(a=>`<li>${esc(a.name)}：${amt(a.balance)}</li>`).join('')}</ul>${includeNotes?`<p class="source-note">備註：${esc(e.note||'無')}</p>`:''}</div>`).join('')}<p>目標：${esc(context.goal.name)} ${amt(context.goal.amount)}</p></details><label class="checkbox"><input type="checkbox" data-ai-notes ${includeNotes?'checked':''} ${loading?'disabled':''}>這次也傳送備註（預設不傳）</label><label class="checkbox"><input type="checkbox" data-ai-consent ${loading?'checked disabled':''}>同意將上述帳戶金額、回報及目標資料傳送給 OpenAI 分析；建議會保存在私人雲端供重用。</label><p class="fine-print">API 使用可能產生費用。每日最多 5 次新生成，每次間隔至少 30 秒；相同資料可重用結果。重新送出失敗請求也會計入次數。</p><button type="button" class="button primary" data-ai-generate disabled>${loading?'正在整理建議…':'取得 AI 回饋'}</button><p class="ai-status" role="status" aria-live="polite">${esc(message)}</p><div data-ai-result>${result?resultHTML(result):''}</div>`;
    const consent=slot.querySelector('[data-ai-consent]'),button=slot.querySelector('[data-ai-generate]');
    consent.onchange=()=>{button.disabled=!enabled||!consent.checked||loading;};
    slot.querySelector('[data-ai-notes]').onchange=e=>{includeNotes=e.target.checked;result=null;draw('分析資料已更新，請重新確認。');};
    button.onclick=generate;
  }
  async function generate() {
    if(!enabled||loading||!slot.querySelector('[data-ai-consent]').checked)return;
    loading=true;draw('正在根據本次資料分析，請稍候。');
    try {
      digest=await contextDigest(context);
      const response=await fetch('/api/feedback',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({entryId,includeNotes,consent:true,digest}),cache:'no-store',signal:AbortSignal.timeout(55000)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'目前無法取得 AI 建議，請稍後再試。');
      if(data.digest!==digest)throw Error('分析依據不一致，請重新載入資料後再試。');
      result=data;results.set(`${user.id}:${digest}`,data);loading=false;
      draw(data.cached?'已載入相同資料的建議，沒有重新生成。':'AI 回饋已完成。數字仍以你的回報為準。');
    }catch(error){loading=false;draw(error.name==='TimeoutError'?'分析等待逾時，請稍後手動重試。':error.message);}
  }
  draw('正在確認 AI 服務…');
  try {
    const response=await fetch('/api/feedback',{headers:auth,cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('暫時無法確認 AI 服務，請稍後重新開啟報告。');
    const status=await response.json();enabled=status.enabled===true;
    digest=await contextDigest(context);result=results.get(`${user.id}:${digest}`)||null;
    draw(enabled?'請檢視資料並勾選同意，再取得建議。':'AI 功能已接好，服務金鑰與模型尚未完成設定。');
  }catch(error){draw(error.message);}
}
