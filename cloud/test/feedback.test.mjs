import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleFeedback} from '../lib/feedback-handler.mjs';
import {demo} from '../public/app/finance.js';
import {feedbackContext,contextDigest} from '../public/app/feedback-context.js';

function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE financial_snapshots (user_id TEXT PRIMARY KEY, payload TEXT, revision INTEGER, updated_at TEXT)');
 sql.exec(readFileSync(new URL('../drizzle/0001_great_ender_wiggin.sql',import.meta.url),'utf8'));
 const state=demo();sql.prepare('INSERT INTO financial_snapshots VALUES (?, ?, 1, ?)').run('owner',JSON.stringify(state),'2026-11-19');
 const db={prepare(query){return {bind(...values){return {async first(){return sql.prepare(query).get(...values)||null;}};}};}};
 return {state,db};
}
const feedback={summary:'這期留下的結餘已有紀錄。',observations:[{title:'觀察',detail:'持續使用同一週期回報。'}],actions:[{title:'下一步',detail:'下次核對帳戶盤點。'}],limitations:[]};
async function request(state,{consent=true,includeNotes=false,digest,origin='https://test.local',entryId}={}){
 entryId??=`report:${state.reports.at(-1).month}`;
 digest??=await contextDigest(feedbackContext(state,entryId,includeNotes));
 return new Request('https://test.local/api/feedback',{method:'POST',headers:{Origin:origin,'X-MoonSave-User':'owner','Content-Type':'application/json'},body:JSON.stringify({entryId,includeNotes,consent,digest})});
}
test('未登入、跨站或未同意不呼叫模型',async()=>{
 const {state,db}=setup();let calls=0;const options={db,userId:'owner',apiKey:'fake-test-key',model:'test-model',fetchImpl:async()=>{calls++;throw Error('unexpected');}};
 assert.equal((await handleFeedback(await request(state),{...options,userId:null})).status,401);
 assert.equal((await handleFeedback(await request(state,{origin:'https://other.local'}),options)).status,403);
 assert.equal((await handleFeedback(await request(state,{consent:false}),options)).status,400);
 assert.equal(calls,0);
});
test('未配置金鑰時狀態明確，不宣稱 AI 可用',async()=>{
 const {state,db}=setup();const get=new Request('https://test.local/api/feedback',{headers:{'X-MoonSave-User':'owner'}});
 assert.equal((await (await handleFeedback(get,{db,userId:'owner'})).json()).enabled,false);
 assert.equal((await handleFeedback(await request(state),{db,userId:'owner'})).status,503);
});
test('從帳號資料建立上下文、備註預設不傳、相同資料重用結果',async()=>{
 const {state,db}=setup();let calls=0;const options={db,userId:'owner',apiKey:'fake-test-key',model:'test-model',fetchImpl:async(url,init)=>{
 calls++;const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');
 const context=JSON.parse(body.input);assert.ok(context.entries.every(e=>!Object.hasOwn(e,'note')));assert.ok(context.entries.length<=3);
 return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(feedback)}]}]});}};
 const first=await handleFeedback(await request(state),options);assert.equal(first.status,200);assert.equal((await first.json()).cached,false);
 const second=await handleFeedback(await request(state),options);assert.equal(second.status,200);assert.equal((await second.json()).cached,true);assert.equal(calls,1);
});
test('資料指紋不符時要求同步，未知紀錄無法送出',async()=>{
 const {state,db}=setup();const options={db,userId:'owner',apiKey:'fake-test-key',model:'test-model'};
 assert.equal((await handleFeedback(await request(state,{digest:'0'.repeat(64)}),options)).status,409);
 assert.equal((await handleFeedback(await request(state,{entryId:'report:1900-01',digest:'0'.repeat(64)}),options)).status,404);
});
test('模型失敗不洩漏內部錯誤，短時間重複新請求受到限制',async()=>{
 const {state,db}=setup();let calls=0;const options={db,userId:'owner',apiKey:'fake-test-key',model:'test-model',fetchImpl:async()=>{calls++;return new Response('provider secret details',{status:500});}};
 const first=await handleFeedback(await request(state),options);assert.equal(first.status,502);assert.ok(!(await first.text()).includes('provider secret details'));
 const second=await handleFeedback(await request(state),options);assert.equal(second.status,429);assert.equal(calls,1);
});
