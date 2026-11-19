import {feedbackSection} from './feedback.js';
import {formatMoney as money} from './core.js';
import {dashboardEntries,accountSummary,goalObservation,savingsHistory,missingItems,periodComparison} from './dashboard.js';
import {effectiveExpense} from './finance.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amt=n=>n==null?'—':money(n);
const colors=['#446d53','#9bae7e','#d0b890','#83a7a1','#c6cbb4','#a78f7b'];
const tag=s=>`<span class="pill">${esc(s)}</span>`;
const heading=(title,sub)=>`<div class="page-heading"><p class="eyebrow">YOUR FINANCIAL CHAPTER</p><h1>${esc(title)}</h1><p class="subtitle">${esc(sub)}</p></div>`;
const entryButton=(e,title='查看資料報告 ↗')=>`<button class="text-link" data-entry="${esc(e.id)}">${esc(title)}</button>`;

export function allocation(entry) {
  const s=accountSummary(entry),known=s.assets.filter(a=>a.balance!=null),positive=known.filter(a=>a.balance>0);
  let offset=0;
  const circles=positive.map((a,i)=>{const length=a.balance/s.assetSubtotal*100;const svg=`<circle cx="80" cy="80" r="60" pathLength="100" fill="none" stroke="${colors[i%colors.length]}" stroke-width="18" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"/>`;offset+=length;return svg;}).join('');
  return `<article class="card allocation-card"><div class="section-heading"><h2>錢放在哪裡</h2>${tag(entry.type==='report'?'帳戶盤點':'含待確認資料')}</div><div class="allocation-layout"><div class="donut"><svg viewBox="0 0 160 160" role="img" aria-label="${esc(`已提供資產分布，小計 ${amt(s.assetSubtotal)}；不包含未知金額及負債`)}"><circle cx="80" cy="80" r="60" fill="none" stroke="#edf0e7" stroke-width="18"/>${circles}</svg><div class="donut-caption"><small>已提供資產小計</small><b>${known.length?amt(s.assetSubtotal):'—'}</b></div></div><dl class="allocation-legend">${s.assets.map(a=>`<div><dt><i style="background:${a.balance>0?colors[positive.findIndex(v=>v.id===a.id)%colors.length]:'#dce3d5'}"></i>${esc(a.name)}</dt><dd>${amt(a.balance)}${a.balance==null?'<small>待補</small>':''}</dd></div>`).join('')}</dl></div><p class="fine-print">${esc(entry.date)} · ${esc(entry.timing)}。圖表只呈現已提供的資產金額，缺漏不當作 0。</p><div class="debt-summary">${s.debts.map(a=>`<span>${esc(a.name)} <b>${a.balance==null?'待補金額':amt(a.balance)}</b></span>`).join('')||'<span>尚無信用卡負債帳戶</span>'}</div>${s.missingAssets||s.missingDebts?'<p class="fine-print">帳戶尚未填齊，暫不計算完整帳戶淨額。</p>':`<p class="fine-print">本次帳戶淨額 ${amt(s.net)}；不是完整淨資產。</p>`}</article>`;
}

export function goalCard(state) {
  const g=goalObservation(state),n=g?.account.balance,target=state.settings.goalAmount;
  return `<article class="card goal"><div class="section-heading"><h2>${esc(state.settings.goalName)}</h2><a class="text-link" href="#settings">設定 ↗</a></div><p class="goal-amount">${amt(n)} <small>/ ${amt(target)}</small></p><div class="progress" role="progressbar" aria-label="儲蓄目標進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${g?Math.min(100,Math.round(g.progress*100)):0}"><i style="width:${g?Math.min(100,g.progress*100):0}%"></i></div><p class="muted">${g?`已達成 ${Math.round(g.progress*100)}% · ${n>=target?'目標達成':`還差 ${amt(target-n)}`}`:'指定帳戶尚無盤點資料'}</p><small>${g?`${esc(g.entry.date)} · ${esc(g.account.name)} · ${esc(g.entry.status)}`:'完成一次盤點，就能開始追蹤。'}</small></article>`;
}

export function savingsChart(state) {
  const points=savingsHistory(state),account=state.accounts.find(a=>a.id===state.settings.goalAccount);
  const hi=Math.max(1,...points.map(p=>p.value)),x=i=>points.length===1?160:30+i*260/(points.length-1),y=v=>130-v/hi*90;
  // Separate old, draft and period series; never imply that distinct date definitions are continuous.
  const lines=['report','legacy','draft'].map(type=>{
    const parts=[];let segment=[];
    points.forEach((p,i)=>{if(p.type===type)segment.push(`${x(i)},${y(p.value)}`);else {if(segment.length>1)parts.push(segment);segment=[];}});
    if(segment.length>1)parts.push(segment);
    return parts.map(p=>`<polyline points="${p.join(' ')}" fill="none" stroke="${type==='report'?'#446d53':'#a6ad8b'}" stroke-width="2.5" ${type==='report'?'':'stroke-dasharray="5 4"'}/>`).join('');
  }).join('');
  return `<article class="card savings-chart"><div class="section-heading"><h2>儲蓄帳戶紀錄</h2>${tag(`${points.length} 個盤點`)}</div><p class="muted chart-subtitle">${esc(account?.name||'目標帳戶')} · 依實際資料日期呈現</p>${points.length?`<svg viewBox="0 0 320 170" role="img" aria-label="${esc(points.map(p=>`${p.date} ${money(p.value)} ${p.label}`).join('；'))}"><path d="M25 135H295" stroke="#e3e7dd"/>${lines}${points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.value)}" r="5" fill="${p.type==='report'?'#446d53':'#b29b6e'}"/><text x="${x(i)}" y="${y(p.value)-13}" text-anchor="middle" font-size="10" fill="#526749">${esc(money(p.value))}</text><text x="${x(i)}" y="155" text-anchor="middle" font-size="9" fill="#7a8575">${esc(p.date.slice(5))}</text>`).join('')}</svg><p class="fine-print">${points.length===1?'目前只有一個盤點，先顯示單點，累積紀錄後再看變化。':'實線為同口徑正式回報，虛線為同類型觀察紀錄；不同資料來源不混接。'} 草稿／舊盤點不當成薪資週期儲蓄成果。</p>`:'<div class="empty-chart">填入目標帳戶餘額後，圖表就會出現。</div>'}</article>`;
}

export function historyList(state) {
  const entries=dashboardEntries(state).reverse();
  return `<section class="history"><div class="section-heading"><h2>我的回報與歷史盤點</h2><span class="muted">${entries.length} 筆資料</span></div>${entries.map(e=>{const s=accountSummary(e);return `<button class="history-row" data-entry="${esc(e.id)}"><span><b>${esc(e.month)} · ${e.type==='report'?'正式回報':e.type==='legacy'?'舊版紀錄':'草稿'}</b><small>${esc(e.date)} · ${esc(e.status)}</small></span><span>${s.net==null?'已提供資產小計':'帳戶淨額'}<br>${amt(s.net??s.assetSubtotal)} ↗</span></button>`;}).join('')}</section>`;
}

function missingCard(entry) {
  const items=missingItems(entry);
  if(!items.length)return '';
  return `<article class="card missing-card"><h2>完成回報，還差這幾項</h2><ul>${items.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>${entry.type==='legacy'?'<a class="text-link" href="#report">帶入回報後核對 ↗</a>':`<button class="text-link" data-edit="${esc(entry.month)}">繼續補齊這期 ↗</button>`}</article>`;
}

export function overviewView(state,{isCloud=false}={}) {
  const entries=dashboardEntries(state),entry=entries.at(-1);
  if(!entry)return heading('把日子，慢慢存好。','每個發薪日，用幾分鐘看懂自己的財務進步。')+`<section class="hero welcome"><span class="pill">從一次盤點開始</span><h2>留一點錢，<br>給未來的選擇。</h2><p>設定帳戶、回報收入與餘額，從第一筆紀錄開始。</p><div class="actions"><a class="button primary" href="#report">開始第一次盤點 ↗</a>${isCloud?'':'<button id="demo" class="button secondary">體驗虛構資料</button>'}</div></section>${goalCard(state)}`;
  const s=accountSummary(entry),r=entry.record,validReport=entry.type==='report'&&!r.stale;
  const expense=validReport?effectiveExpense(r,state.reports):null,surplus=expense==null||r.income==null?null:r.income-expense;
  const comparison=validReport?periodComparison(r,state.reports):null;
  const stats=validReport?`<div class="stats-grid">${[['本期收入',r.income],[r.expenseSource==='estimate'?'推估支出':'實際支出',expense],['期末帳戶淨額',s.net]].map(([title,value])=>`<article class="card stat"><span>${title}</span><strong>${amt(value)}</strong></article>`).join('')}</div>`:'';
  const insight=surplus!=null?(comparison?`比上期${comparison.surplus>=0?'多':'少'}留下 ${amt(Math.abs(comparison.surplus))}`:'收入與支出採同一薪資週期。'):'先看已提供的帳戶分布，缺少的資料留待補齊。';
  return heading('每一小步，都算數。',`${entry.month} · 資料盤點 ${entry.date}`)+`<div class="section-heading">${tag(entry.status)}<a class="text-link" href="#report">填寫月回報 ＋</a></div><section class="hero"><div class="hero-top"><span>${surplus==null?'已提供資產小計':'這期留下'}</span><button id="ai" class="ai-button">✧ AI 建議</button></div><strong>${amt(surplus??s.assetSubtotal)}</strong><p>${esc(insight)}</p>${comparison?`<small>支出比上期${comparison.expense>=0?'多':'少'} ${amt(Math.abs(comparison.expense))}${comparison.estimated?' · 比較含推估':''}</small>`:''}${entry.type!=='report'||s.missingAssets||s.missingDebts?'<small>含待核對或缺漏資料，小計不代表完整資產或本期儲蓄。</small>':''}<div>${entryButton(entry,entry.type==='report'?'查看完整報告 ↗':'查看目前資料報告 ↗')}</div></section>${stats}<div class="dashboard-grid">${goalCard(state)}${savingsChart(state)}</div>${allocation(entry)}${missingCard(entry)}${r.action?`<article class="card"><h2>下期的一個小行動</h2><p>${esc(r.action)}</p></article>`:''}${historyList(state)}`;
}

export function observationDetail(state,id) {
  const entry=dashboardEntries(state).find(e=>e.id===id);
  if(!entry)return heading('找不到這筆紀錄','資料可能已修改，請返回首頁重新選擇。')+'<a class="button secondary" href="#overview">回首頁</a>';
  const s=accountSummary(entry);
  return heading(`${entry.month} · 資料報告`,`${entry.date} · ${entry.timing}`)+`<div class="section-heading">${tag(entry.status)}${entry.type==='draft'?`<button class="text-link" data-edit="${entry.month}">繼續編輯 ↗</button>`:''}</div><section class="hero"><span>已提供資產小計</span><strong>${amt(s.assetSubtotal)}</strong><p>保留原有紀錄與來源，尚未補齊的數字不視為 0。</p></section><div class="dashboard-grid">${goalCard(state)}${savingsChart(state)}</div>${allocation(entry)}<section class="card"><h2>收支資料</h2><dl class="balance-list"><div><dt>同週期收入總額</dt><dd>${amt(entry.income)}</dd></div><div><dt>本期支出</dt><dd>待補齊</dd></div><div><dt>本期結餘</dt><dd>尚不可計算</dd></div></dl><p class="fine-print">帳戶資料可先閱讀；完成核對前，不產生正式收支結論。</p></section>${missingCard(entry)}<section class="card"><h2>資料來源與備註</h2><p class="source-note">${esc(entry.note||'沒有備註。')}</p></section>${feedbackSection(entry.id)}<a class="button secondary" href="#overview">回首頁</a>`;
}
