import { closing, effectiveExpense, shiftMonth } from './finance.js';

// Read models only. Old records and incomplete drafts remain unchanged on disk.
const oldAccounts = [
  ['main', '主帳戶', 'daily'], ['emergency', '緊急備用金', 'savings'],
  ['bills', '必要支出專戶', 'reserved'], ['cardReserve', '信用卡預備金', 'reserved'],
  ['cardDebt', '信用卡未繳', 'credit'], ['wallet', '現金與電子錢包', 'daily'],
];
const valid = n => Number.isSafeInteger(n) && n >= 0;
export function hasContent(r) {
  return Boolean(r && (r.income != null || r.expense != null || r.accounts?.some(a => a.balance != null) || r.note?.trim() || r.action?.trim()));
}
export function dashboardEntries(state) {
  const entries = [];
  const oldDraft = state.legacy?.draft;
  const linked = r => oldDraft && r.month === oldDraft.month && r.note?.includes(oldDraft.note) && oldDraft.note;
  function modern(r, draft) {
    const endAccounts = closing(r);
    const historicalSource = linked(r) ? oldDraft.asOf : null;
    const date = historicalSource || (r.balanceMode === 'end' ? r.end : r.observedAt.slice(0, 10));
    entries.push({
      id: `${draft ? 'draft' : 'report'}:${r.month}`, month: r.month, date,
      type: draft ? 'draft' : 'report', status: draft ? '待確認草稿' : r.stale ? '待重新確認' : '已確認回報',
      historical: Boolean(historicalSource), timing: historicalSource ? '舊資料盤點，部分金額為沿用值' : r.balanceMode === 'current' && !endAccounts ? '當時盤點，尚非週期期末' : '薪資週期期末',
      accounts: (endAccounts || r.accounts).map(a => ({...a, balance: valid(a.balance) ? a.balance : null})),
      income: r.income, expense: draft ? null : effectiveExpense(r, state.reports),
      expenseSource: r.expenseSource, note: r.note, record: r,
    });
  }
  for (const r of state.reports) modern(r, false);
  for (const r of Object.values(state.drafts)) if (hasContent(r)) modern(r, true);
  function legacy(r, draft, index) {
    entries.push({id:`legacy:${draft ? 'draft' : index}`, month:r.month, date:r.asOf,
      type:'legacy', status:draft ? '舊版草稿 · 待確認' : '舊版已確認盤點', historical:true,
      timing:'舊版盤點口徑，未對應薪資週期',
      accounts:oldAccounts.map(([id,name,kind])=>({id,name,kind,balance:valid(r[id])?r[id]:null})),
      income:valid(r.salary)&&valid(r.otherIncome)?r.salary+r.otherIncome:null,
      expense:null, expenseSource:'unknown', note:r.note, record:r,
    });
  }
  for (const [i,r] of (state.legacy?.reports || []).entries()) legacy(r,false,i);
  // A legacy draft brought into a new draft is one observation, not two data points.
  if (oldDraft && ![...state.reports,...Object.values(state.drafts)].some(linked)) legacy(oldDraft,true,0);
  const priority={report:2,draft:1,legacy:0};
  return entries.sort((a,b)=>a.date.localeCompare(b.date)||priority[a.type]-priority[b.type]||a.id.localeCompare(b.id));
}
export function accountSummary(entry) {
  const accounts = entry?.accounts || [];
  const assets = accounts.filter(a=>a.kind!=='credit');
  const debts = accounts.filter(a=>a.kind==='credit');
  const missingAssets = assets.filter(a=>a.balance==null).length;
  const missingDebts = debts.filter(a=>a.balance==null).length;
  const assetSubtotal=assets.reduce((n,a)=>n+(a.balance??0),0);
  const debtSubtotal=debts.reduce((n,a)=>n+(a.balance??0),0);
  return {assets,debts,assetSubtotal,debtSubtotal,missingAssets,missingDebts,
    net:entry && !missingAssets&&!missingDebts?assetSubtotal-debtSubtotal:null};
}
export function goalObservation(state) {
  const all=dashboardEntries(state).reverse();
  for (const entry of all) {
    const account=entry.accounts.find(a=>a.id===state.settings.goalAccount&&a.kind!=='credit'&&a.balance!=null);
    if(account)return {entry,account,progress:account.balance/state.settings.goalAmount};
  }
  return null;
}
export function savingsHistory(state) {
  const points=[];
  for(const e of dashboardEntries(state)) {
    const a=e.accounts.find(a=>a.id===state.settings.goalAccount&&a.kind!=='credit'&&a.balance!=null);
    if(!a)continue;
    const key=`${e.date}|${e.type==='report'?'period':e.type==='draft'?'draft':'legacy'}`;
    const point={key,date:e.date,value:a.balance,type:e.type,label:e.status};
    const i=points.findIndex(p=>p.key===key);
    if(i<0)points.push(point);else points[i]=point;
  }
  return points.slice(-12);
}
export function missingItems(entry) {
  if(!entry)return [];
  const items=[];
  if(entry.income==null)items.push('本期收入與統計期間');
  for(const a of entry.accounts)if(a.balance==null)items.push(a.name);
  if(entry.expense==null)items.push('實際支出或可推估的連續期末資料');
  if(entry.type!=='report'||entry.historical)items.push('帳戶金額、盤點時間與來源核對');
  return items;
}
export function periodComparison(r,reports) {
  const p=reports.find(p=>p.month===shiftMonth(r.month,-1));
  const expense=effectiveExpense(r,reports),previousExpense=effectiveExpense(p,reports);
  if(!p||r.income==null||p.income==null||expense==null||previousExpense==null||new Date(Date.parse(p.end)+86400000).toISOString().slice(0,10)!==r.start)return null;
  return {income:r.income-p.income,expense:expense-previousExpense,surplus:(r.income-expense)-(p.income-previousExpense),estimated:r.expenseSource==='estimate'||p.expenseSource==='estimate'};
}
