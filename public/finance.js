export const kinds = { daily:'日常', savings:'儲蓄', reserved:'專用款', credit:'信用卡未繳' };
const monthOK = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');
const moneyOK = n => n === null || (Number.isSafeInteger(n) && n >= 0 && n <= 100000000);
export const shiftMonth = (m, n) => { const [y,v] = m.split('-').map(Number); return new Date(Date.UTC(y,v-1+n,1)).toISOString().slice(0,7); };
export function boundary(month, day) { const [y,m]=month.split('-').map(Number); return `${month}-${String(Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`; }
export function cycle(month, day) { const start=boundary(month,day), next=boundary(shiftMonth(month,1),day); return {start,end:new Date(Date.parse(next)-86400000).toISOString().slice(0,10)}; }
export function lastClosed(day, now=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})) { const m=now.slice(0,7); return shiftMonth(m,now>=boundary(m,day)?-1:-2); }
export const empty = () => ({version:3,settings:{payday:10,goalName:'我的儲蓄目標',goalAmount:50000,goalAccount:'savings'},accounts:[{id:'main',name:'主帳戶',kind:'daily',archived:false,statementDay:null,dueDay:null},{id:'savings',name:'儲蓄帳戶',kind:'savings',archived:false,statementDay:null,dueDay:null}],reports:[],drafts:{},legacy:null});
const fail = message => {throw new Error(message);};
export function validateV3(data) {
  if(!data || data.version!==3) fail('資料版本不相容，請使用新版月存。');
  const s=data.settings;
  if(!s || !Number.isInteger(s.payday)||s.payday<1||s.payday>31||!moneyOK(s.goalAmount)||!s.goalAmount||typeof s.goalName!=='string'||s.goalName.length>40||typeof s.goalAccount!=='string') fail('設定格式錯誤。');
  if(!Array.isArray(data.accounts)||!data.accounts.length||data.accounts.length>40) fail('請保留 1～40 個帳戶。');
  function account(a) {
    if(!a || !/^[\w-]{1,80}$/.test(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>30||!Object.hasOwn(kinds,a.kind)||typeof a.archived!=='boolean') fail('帳戶格式錯誤。');
    for(const key of ['statementDay','dueDay']) if(a[key]!=null&&(!Number.isInteger(a[key])||a[key]<1||a[key]>31)) fail('信用卡日期須為 1～31 日。');
    return {id:a.id,name:a.name,kind:a.kind,archived:a.archived,statementDay:a.statementDay??null,dueDay:a.dueDay??null};
  }
  const accounts=data.accounts.map(account);
  if(new Set(accounts.map(a=>a.id)).size!==accounts.length) fail('帳戶不可重複。');
  const text=(v,max=1000)=>{if(typeof v!=='string'||v.length>max) fail('文字長度或格式錯誤。');return v;};
  function report(r, draft=false) {
    if(!r||!monthOK(r.month)||!['end','current'].includes(r.balanceMode)||!['actual','estimate','unknown'].includes(r.expenseSource)||!Array.isArray(r.accounts)||!r.accounts.length||r.accounts.length>40) fail('回報格式錯誤。');
    if(!Number.isInteger(r.payday)||r.payday<1||r.payday>31) fail('回報週期錯誤。');
    const dates=cycle(r.month,r.payday);
    if(r.start!==dates.start||r.end!==dates.end) fail('回報週期範圍錯誤。');
    for(const n of [r.income,r.expense]) if(!moneyOK(n)) fail('金額須為 0～100,000,000 的整數或留白。');
    if(!Number.isSafeInteger(r.adjustment)||Math.abs(r.adjustment)>100000000) fail('調整金額格式錯誤。');
    const snapshots=r.accounts.map(a=>{account(a);if(!moneyOK(a.balance)||!Number.isSafeInteger(a.bridge)||Math.abs(a.bridge)>100000000) fail('帳戶金額格式錯誤。');return {...account(a),balance:a.balance,bridge:a.bridge};});
    if(new Set(snapshots.map(a=>a.id)).size!==snapshots.length) fail('回報帳戶重複。');
    if(!['','investment','transfer','borrowing','other'].includes(r.adjustmentReason)) fail('調整原因錯誤。');
    if(r.adjustment && !r.adjustmentReason) fail('請選擇特殊變動原因。');
    if(!['pending','done','skipped'].includes(r.actionReview)) fail('行動狀態錯誤。');
    if(typeof r.bridgeConfirmed!=='boolean'||typeof r.confirmed!=='boolean'||typeof r.stale!=='boolean'||typeof r.baseline!=='boolean') fail('確認狀態錯誤。');
    const result={month:r.month,payday:r.payday,...dates,income:r.income,expense:r.expense,expenseSource:r.expenseSource,adjustment:r.adjustment,adjustmentReason:r.adjustmentReason,accounts:snapshots,balanceMode:r.balanceMode,bridgeConfirmed:r.bridgeConfirmed,observedAt:text(r.observedAt,40),note:text(r.note),action:text(r.action,200),actionReview:r.actionReview,actionReflection:text(r.actionReflection,300),confirmed:r.confirmed,stale:r.stale,baseline:r.baseline,updatedAt:text(r.updatedAt,40),basis:r.basis==null?null:text(r.basis,10000)};
    if(!draft&&!r.confirmed) fail('正式回報尚未確認。');
    return result;
  }
  if(!Array.isArray(data.reports)||data.reports.length>600||!data.drafts||Array.isArray(data.drafts)||Object.keys(data.drafts).length>600) fail('回報數量或格式錯誤。');
  const reports=data.reports.map(r=>report(r));
  if(new Set(reports.map(r=>r.month)).size!==reports.length) fail('同一期只能有一份正式回報。');
  const drafts={};for(const [m,r] of Object.entries(data.drafts)){if(m!==r.month) fail('草稿週期錯誤。');drafts[m]=report(r,true);}
  if(data.legacy!=null && (data.legacy.version!==1 || !Array.isArray(data.legacy.reports))) fail('舊版備份格式錯誤。');
  return {version:3,settings:{payday:s.payday,goalName:s.goalName,goalAmount:s.goalAmount,goalAccount:s.goalAccount},accounts,reports,drafts,legacy:data.legacy??null};
}
export function closing(r) {
  if(!r || (r.balanceMode==='current'&&!r.bridgeConfirmed)) return null;
  const a=r.accounts.map(a=>({...a,balance:a.balance==null?null:a.balance-(r.balanceMode==='current'?a.bridge:0)}));
  return a.some(a=>a.balance==null||a.balance<0)?null:a;
}
export const net = r => {const a=closing(r);return a? a.reduce((n,a)=>n+(a.kind==='credit'?-a.balance:a.balance),0):null;};
export function comparable(a,b) {
  if(!a||!b||a.stale||b.stale||new Date(Date.parse(b.end)+86400000).toISOString().slice(0,10)!==a.start) return false;
  const x=closing(a),y=closing(b),key=xs=>xs.map(v=>`${v.id}:${v.kind}`).sort().join('|');
  return Boolean(x&&y&&key(x)===key(y));
}
export function estimate(r,reports) {
  const p=reports.find(p=>p.month===shiftMonth(r.month,-1));
  if(!p||p.stale||new Date(Date.parse(p.end)+86400000).toISOString().slice(0,10)!==r.start) return {value:null,reason:'需要連續上期的有效期末盤點。',basis:null};
  const a=closing(r),b=closing(p);
  if(!a||!b) return {value:null,reason:'請補齊期末餘額，或確認目前餘額的新期變動。',basis:null};
  const key=xs=>xs.map(a=>`${a.id}:${a.kind}`).sort().join('|');
  if(key(a)!==key(b)) return {value:null,reason:'兩期盤點範圍不同，請改填實際支出或補齊相同帳戶。',basis:null};
  if(r.income==null) return {value:null,reason:'請填本期收入。',basis:null};
  const value=r.income+r.adjustment-net(r)+net(p);
  const basis=JSON.stringify({month:p.month,end:p.end,accounts:b.map(a=>({id:a.id,kind:a.kind,balance:a.balance})).sort((a,b)=>a.id.localeCompare(b.id))});
  return {value:value<0?null:value,raw:value,reason:value<0?'推估為負數，請檢查特殊變動或改填實際支出。':'請確認推估符合本期情況。',basis};
}
export function effectiveExpense(r,reports) {
  if(!r||r.stale||r.expense==null) return null;
  if(r.expenseSource==='actual') return r.expense;
  if(r.expenseSource==='estimate'){const e=estimate(r,reports);return r.confirmed&&e.value===r.expense&&e.basis===r.basis?r.expense:null;}
  return null;
}
export function invalidate(reports) {
  const list=structuredClone(reports).sort((a,b)=>a.month.localeCompare(b.month));
  for(const r of list) if(r.expenseSource==='estimate'){const e=estimate(r,list);if(e.value!==r.expense||e.basis!==r.basis) r.stale=true;}
  return list;
}
export function migrate(old) {
  if(old.version===3) return validateV3(old);
  const s=empty();s.legacy=old;
  const names={main:['主帳戶','daily'],emergency:['緊急備用金','savings'],bills:['必要支出專戶','reserved'],cardReserve:['信用卡預備金','reserved'],cardDebt:['信用卡未繳','credit'],wallet:['現金與電子錢包','daily']};
  s.accounts=Object.entries(names).map(([id,[name,kind]])=>({id,name,kind,archived:false,statementDay:null,dueDay:null}));
  s.settings.goalAccount='emergency';s.settings.goalAmount=old.settings.emergencyGoal;
  return s;
}
export function blank(month,state) {return {month,payday:state.settings.payday,...cycle(month,state.settings.payday),income:null,expense:null,expenseSource:'estimate',adjustment:0,adjustmentReason:'',accounts:state.accounts.filter(a=>!a.archived).map(a=>({...a,balance:null,bridge:0})),balanceMode:'end',bridgeConfirmed:false,observedAt:new Date().toISOString(),note:'',action:'',actionReview:'pending',actionReflection:'',confirmed:false,stale:false,baseline:false,updatedAt:new Date().toISOString(),basis:null};}
export function demo() {
  const s=empty(),m=lastClosed(10);
  for(let i=2;i>=0;i--){const r=blank(shiftMonth(m,-i),s);r.income=42000;r.expense=29500-i*1500;r.expenseSource='actual';r.accounts[0].balance=14800;r.accounts[1].balance=32000-i*6000;r.confirmed=true;r.note='虛構示範資料';s.reports.push(r);}
  return s;
}
