import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.location={origin:'http://test.local',hostname:'test.local',pathname:'/'};
const {createSync}=await import('../public/sync.js');
test('讀取忙碌期間儲存仍會重新排程上傳',async t=>{
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  let finishRead,reads=0,writes=0;globalThis.fetch=async (url,init={})=>{
    if(url==='/api/session')return Response.json({id:'test'});
    if(init.method==='PUT'){writes++;return Response.json({revision:1});}
    reads++;if(reads===2)return new Promise(resolve=>{finishRead=()=>resolve(Response.json({revision:0,payload:null}));});
    return Response.json({revision:0,payload:null});
  };
  t.mock.timers.enable({apis:['setTimeout']});
  const client=createSync({getPayload:()=>({version:3}),applyPayload:()=>{},onStatus:()=>{}});
  await client.start(()=>{});const refreshing=client.refresh();await Promise.resolve();client.changed();t.mock.timers.tick(901);await Promise.resolve();assert.equal(writes,0);finishRead();await refreshing;t.mock.timers.tick(901);await new Promise(resolve=>setImmediate(resolve));assert.equal(writes,1);
});
