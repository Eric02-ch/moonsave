import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,blank,migrate,cycle} from '../public/finance.js';
import {defaultSettings,makeDemo} from '../public/core.js';
import {dashboardEntries,accountSummary,goalObservation,savingsHistory,missingItems,hasContent,periodComparison} from '../public/dashboard.js';
import {overviewView,observationDetail} from '../public/dashboard-view.js';

const legacy=()=>({version:1,settings:defaultSettings,reports:[],draft:{...makeDemo()[0],month:'2026-11',asOf:'2026-11-11',main:12000,emergency:24000,bills:6000,cardReserve:2000,cardDebt:null,wallet:null,otherIncome:null,note:'Synthetic old observation. Some values need review.',confirmed:false}});
function fixture(){const old=legacy(),s=migrate(old),r=blank('2026-11',s);r.accounts=r.accounts.map(a=>({...a,balance:old.draft[a.id]??null}));r.note=old.draft.note;r.balanceMode='current';r.observedAt='2026-11-19T00:00:00.000Z';s.drafts[r.month]=r;s.drafts['2026-10']=blank('2026-10',s);return s;}

test('Imported incomplete drafts appear once, empty drafts are hidden and source dates survive',()=>{
 const s=fixture(),before=JSON.stringify(s),rows=dashboardEntries(s);
 assert.equal(rows.length,1);assert.equal(rows[0].type,'draft');assert.equal(rows[0].date,'2026-11-11');
 assert.equal(rows[0].income,null);assert.equal(rows[0].expense,null);assert.equal(JSON.stringify(s),before);
 assert.equal(hasContent(s.drafts['2026-10']),false);
});
test('Known asset subtotal does not become net assets when debt or cash is missing',()=>{
 const e=dashboardEntries(fixture())[0],s=accountSummary(e);
 assert.equal(s.assetSubtotal,44000);assert.equal(s.net,null);assert.equal(s.missingAssets,1);assert.equal(s.missingDebts,1);
 assert.ok(missingItems(e).includes('信用卡未繳'));
});
test('Goal and single-point chart work before the first formal report',()=>{
 const s=fixture(),goal=goalObservation(s),points=savingsHistory(s),html=overviewView(s);
 assert.equal(goal.account.balance,24000);assert.equal(goal.progress,.48);assert.equal(points.length,1);
 assert.ok(html.includes('錢放在哪裡'));assert.ok(html.includes('儲蓄帳戶紀錄'));assert.ok(html.includes('48%'));
 assert.ok(html.includes('目前只有一個盤點'));assert.ok(!html.includes('開始第一次盤點'));
});
test('Old formal history is readable without mutating its accounting period or inventing expenses',()=>{
 const old=legacy();old.reports=[{...makeDemo()[0],month:'2026-09',asOf:'2026-09-12'}];
 const s=migrate(old),rows=dashboardEntries(s);assert.equal(rows.length,2);
 assert.equal(rows[0].date,'2026-09-12');assert.equal(rows[0].type,'legacy');assert.equal(rows[0].expense,null);
 const html=observationDetail(s,rows[0].id);assert.ok(html.includes('舊版盤點口徑'));assert.ok(html.includes('尚不可計算'));
 assert.equal(s.reports.length,0);assert.equal(s.legacy.reports[0].asOf,'2026-09-12');
});
test('A partial goal observation is not blocked by another missing account; zero remains valid',()=>{
 const s=fixture();s.drafts['2026-11'].accounts.find(a=>a.id==='emergency').balance=0;
 assert.equal(goalObservation(s).account.balance,0);assert.equal(savingsHistory(s)[0].value,0);
 assert.ok(overviewView(s).includes('$0'));
});
test('Formal period comparisons require continuous periods and retain estimate provenance',()=>{
 const s=empty(),a=blank('2026-09',s),b=blank('2026-10',s);
 for(const r of [a,b]){r.accounts.forEach(v=>v.balance=10000);r.income=40000;r.expense=30000;r.expenseSource='actual';r.confirmed=true;}
 b.expense=28000;assert.deepEqual(periodComparison(b,[a,b]),{income:0,expense:-2000,surplus:2000,estimated:false});
 a.month='2026-08';Object.assign(a,cycle(a.month,10));assert.equal(periodComparison(b,[a,b]),null);
});
test('Observation notes and account names are escaped in report HTML',()=>{
 const s=fixture();s.drafts['2026-11'].note='<img src=x onerror=alert(1)>';s.drafts['2026-11'].accounts[0].name='<script>bad</script>';
 const html=observationDetail(s,'draft:2026-11');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;'));
});
