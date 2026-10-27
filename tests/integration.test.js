import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../src/worker.js';

function makeEnv() {
 const sql=new DatabaseSync(':memory:');
 sql.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const q=sqlText=>{
  let bindings=[];
  const bind=(...params)=>{bindings=params;return {first:async()=>sql.prepare(sqlText).get(...bindings)||null,all:async()=>({results:sql.prepare(sqlText).all(...bindings)}),run:async()=>{sql.prepare(sqlText).run(...bindings);return {success:true};}};};
  return {bind,first:async()=>sql.prepare(sqlText).get()||null,all:async()=>({results:sql.prepare(sqlText).all()}),run:async()=>{sql.prepare(sqlText).run();return {success:true};}};
 };
 const objects=new Map();
 const MEDIA={
  put:async(key,body,opts)=>{objects.set(key,{bytes:new Uint8Array(body),opts});return {size:body.byteLength};},
  head:async(key)=>{const x=objects.get(key);return x?{size:x.bytes.length,customMetadata:x.opts.customMetadata,httpMetadata:x.opts.httpMetadata}:null;},
  get:async(key)=>{const x=objects.get(key);return x?{body:new Blob([x.bytes]).stream(),size:x.bytes.length,customMetadata:x.opts.customMetadata,httpEtag:'"unit-test"',writeHttpMetadata(h){h.set('Content-Type',x.opts.httpMetadata.contentType);}}:null;}
 };
 return {env:{ADMIN_PASSWORD:'test-password',ADMIN_SESSION_SECRET:'test-secret-64-characters-long-'+('a'.repeat(32)),DB:{prepare:q,batch:async qs=>{for(const x of qs)await x.run();}},MEDIA,ASSETS:{fetch:async()=>new Response('ok')}},close:()=>sql.close()};
}
async function request(env,url,method='GET',body,token='',extra={}){
 const headers={...extra};if(token)headers.Authorization='Bearer '+token;
 let payload=body;
 if(body!==undefined&&body!==null&&!(body instanceof Uint8Array)&&typeof body!=='string'){payload=JSON.stringify(body);headers['Content-Type']='application/json';}
 return worker.fetch(new Request('https://norrona.test'+url,{method,headers,body:payload===undefined?undefined:payload}),env);
}

test('integration: login, media upload, layout, pairing, assignment, manifest, revoke',async()=>{
 const {env,close}=makeEnv();
 try {
  let res=await request(env,'/api/admin/login','POST',{password:'test-password'});
  assert.equal(res.status,200);const admin=(await res.json()).token;
  const tinyPng=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
  res=await request(env,'/api/admin/media','POST',tinyPng,admin,{'Content-Type':'image/png','X-File-Name':'test.png'});
  assert.equal(res.status,200);const media=await res.json();assert.equal(media.sha256.length,64);
  res=await request(env,'/api/admin/layouts','POST',{name:'Reception',orientation:'landscape',background:'#102030',widgets:[{id:'hello-1',type:'text',x:10,y:20,w:600,h:120,text:'Welcome'}, {id:'image-1',type:'image',src:media.url,x:100,y:200,w:800,h:450}]},admin);
  assert.equal(res.status,200);const layout=(await res.json()).id;
  res=await request(env,'/api/player/pair/start','POST');assert.equal(res.status,200);const pair=await res.json();assert.match(pair.code,/^[A-F0-9]{12}$/);
  res=await request(env,'/api/admin/pair/claim','POST',{code:pair.code,name:'Reception Port',zone:'Reception'},admin);assert.equal(res.status,200);
  res=await request(env,'/api/player/pair/status?code='+pair.code);const paired=await res.json();assert.equal(paired.paired,true);
  res=await request(env,'/api/admin/screens','PATCH',{id:paired.screen_id,name:'Reception Port',zone:'Reception',orientation:'landscape',layout_id:layout},admin);assert.equal(res.status,200);
  const headers={'X-Player-ID':paired.screen_id,'X-Player-Token':paired.token};
  res=await request(env,'/api/player/sync','POST',undefined,'',headers);assert.equal(res.status,200);
  const etag=res.headers.get('ETag');const manifest=await res.json();
  assert.equal(manifest.layouts.length,1);assert.equal(manifest.assets.length,1);assert.equal(manifest.layouts[0].widgets[1].src,media.url);
  res=await request(env,'/api/player/sync','POST',undefined,'',{'If-None-Match':etag,...headers});assert.equal(res.status,304);
  res=await request(env,'/api/admin/screens/reset','POST',{id:paired.screen_id},admin);assert.equal(res.status,200);
  res=await request(env,'/api/player/sync','POST',undefined,'',headers);assert.equal(res.status,401);
 }finally{close();}
});

test('unauthorised media upload and dangerous file types rejected',async()=>{
 const {env,close}=makeEnv();try{
  const r=await request(env,'/api/admin/media','POST',Uint8Array.from([60,104,116,109,108,62]),'',{'Content-Type':'text/html'});
  assert.equal(r.status,401);
 }finally{close();}
});
