import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnv,request} from './helpers/env.js';
import {validateWidgets,allowedUrl} from '../src/worker.js';

async function login(env){
 const r=await request(env,'/api/admin/login','POST',{password:'test-password'});
 assert.equal(r.status,200);return (await r.json()).token;
}
async function screen(env,admin){
 const pair=await (await request(env,'/api/player/pair/start','POST')).json();
 const claim=await request(env,'/api/admin/pair/claim','POST',{code:pair.code,name:'Test screen'},admin);assert.equal(claim.status,200);
 const credentials=await (await request(env,'/api/player/pair/status?code='+pair.code)).json();
 return {id:credentials.screen_id,headers:{'X-Player-ID':credentials.screen_id,'X-Player-Token':credentials.token}};
}
async function assign(env,admin,id,widgets){
 const r=await request(env,'/api/admin/layouts','POST',{name:'Regression layout',widgets},admin);assert.equal(r.status,200);
 const layout=(await r.json()).id;
 assert.equal((await request(env,'/api/admin/screens/bulk','PATCH',{ids:[id],patch:{layout_id:layout}},admin)).status,200);
 return layout;
}

test('concurrent claims of a single pairing code create exactly one registered screen',async()=>{
 const {env,close}=makeEnv();try{
  const admin=await login(env);
  const pair=await (await request(env,'/api/player/pair/start','POST')).json();
  // Let both requests read the unclaimed code, then serialize atomic D1 batches.
  const originalPrepare=env.DB.prepare;let reads=0,release;
  const ready=new Promise(resolve=>{release=resolve;});
  env.DB.prepare=sql=>{
   const query=originalPrepare(sql);
   if(sql==='SELECT * FROM pairings WHERE code=? AND expires_at>?'){
    const bind=query.bind;query.bind=(...args)=>{const bound=bind(...args),first=bound.first;bound.first=async()=>{const result=await first();if(++reads===2)release();await ready;return result;};return bound;};
   }return query;
  };
  let queue=Promise.resolve();const batch=env.DB.batch;
  env.DB.batch=queries=>{const next=queue.then(()=>batch(queries));queue=next.catch(()=>{});return next;};
  const results=await Promise.all(['First','Second'].map(name=>request(env,'/api/admin/pair/claim','POST',{code:pair.code,name},admin)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM screens').first()).n,1);
  const winner=await results.find(r=>r.status===200).json();
  env.DB.prepare=originalPrepare;
  const paired=await (await request(env,'/api/player/pair/status?code='+pair.code)).json();assert.equal(paired.screen_id,winner.screen_id);
  assert.equal((await request(env,'/api/player/sync','POST',undefined,'',{'X-Player-ID':paired.screen_id,'X-Player-Token':paired.token})).status,200);
  assert.equal((await request(env,'/api/admin/pair/claim','POST',{code:pair.code},admin)).status,404);
 }finally{close();}
});

test('concurrent wrong-password requests cannot lose throttle increments',async()=>{
 const {env,close}=makeEnv();try{
  const responses=await Promise.all(Array.from({length:10},()=>request(env,'/api/admin/login','POST',{password:'wrong'})));
  assert.ok(responses.every(r=>r.status===401||r.status===429));
  const attempts=await env.DB.prepare('SELECT failures,blocked_until FROM login_attempts').first();assert.ok(attempts.failures>=5);assert.ok(attempts.blocked_until>Date.now());
  assert.equal((await request(env,'/api/admin/login','POST',{password:'test-password'})).status,429);
 }finally{close();}
});

test('sync refuses missing or invalid hosted asset metadata instead of publishing incomplete manifests',async()=>{
 const {env,close}=makeEnv();try{
  const admin=await login(env),player=await screen(env,admin);
  const url='/media/'+('a'.repeat(32)),layout=await assign(env,admin,player.id,[{id:'picture',type:'image',src:url}]);
  const valid={size:100,customMetadata:{sha256:'b'.repeat(64)},httpMetadata:{contentType:'image/png'}};
  for(const meta of [null,{...valid,customMetadata:{}},{...valid,size:0},{...valid,size:1.5},{...valid,httpMetadata:{contentType:'text/html'}}]){
   env.MEDIA.head=async()=>meta;
   assert.equal((await request(env,'/api/player/sync','POST',undefined,'',player.headers)).status,503);
  }
  env.MEDIA.head=async()=>valid;
  const r=await request(env,'/api/player/sync','POST',undefined,'',player.headers);assert.equal(r.status,200);const manifest=await r.json();assert.equal(manifest.assets.length,1);assert.equal(manifest.assets[0].url,url);
  await env.DB.prepare('UPDATE layouts SET widgets_json=? WHERE id=?').bind(JSON.stringify([{id:'legacy',type:'image',src:'/media/a-b'}]),layout).run();
  assert.equal((await request(env,'/api/player/sync','POST',undefined,'',player.headers)).status,503);
 }finally{close();}
});

test('hosted URLs match the media route and portrait layouts retain lower-half widgets',async()=>{
 assert.equal(allowedUrl('/media/a-b'),false);assert.equal(allowedUrl('/media/abcd'),false);assert.equal(allowedUrl('/media/'+('a'.repeat(32))),true);
 const [portrait]=validateWidgets([{id:'bottom',type:'text',x:1000,y:1700,w:100,h:150}], 'portrait');assert.equal(portrait.y,1700);assert.equal(portrait.x,1000);
 const [landscape]=validateWidgets([{id:'bottom',type:'text',y:1700,w:1800}]);assert.equal(landscape.y,1080);assert.equal(landscape.w,1800);
 const {env,close}=makeEnv();try{
  const admin=await login(env);
  const saved=await request(env,'/api/admin/layouts','POST',{name:'Portrait',orientation:'portrait',widgets:[{id:'bottom',type:'text',y:1700,h:150}]},admin);assert.equal(saved.status,200);const id=(await saved.json()).id;
  const list=await (await request(env,'/api/admin/layouts','GET',undefined,admin)).json();assert.equal(list.items.find(l=>l.id===id).widgets[0].y,1700);
 }finally{close();}
});

test('sync with 101 relevant layouts stays below D1 parameter limit',async()=>{
 const {env,close}=makeEnv();try{
  const admin=await login(env),player=await screen(env,admin);
  for(let i=0;i<101;i++){
   const id='layout-'+i;await env.DB.prepare('INSERT INTO layouts(id,name,updated_at) VALUES(?,?,?)').bind(id,id,'2026-10-28').run();
   await env.DB.prepare('INSERT INTO schedules(id,name,scope,target,layout_id,updated_at) VALUES(?,?,?,?,?,?)').bind('schedule-'+i,id,'all','*',id,'2026-10-28').run();
  }
  const prepare=env.DB.prepare;let layoutBinds=0;
  env.DB.prepare=sql=>{const q=prepare(sql),bind=q.bind;q.bind=(...params)=>{assert.ok(params.length<=100,'exceeded D1 bind limit');if(sql.includes('SELECT * FROM layouts WHERE id IN'))layoutBinds=params.length;return bind(...params);};return q;};
  const r=await request(env,'/api/player/sync','POST',undefined,'',player.headers);assert.equal(r.status,200);assert.equal((await r.json()).layouts.length,101);assert.equal(layoutBinds,1);
 }finally{close();}
});

test('malformed, nonobject and oversized JSON requests return client errors',async()=>{
 const {env,close}=makeEnv();try{
  const admin=await login(env);
  for(const payload of ['{bad json','null','[]','42'])assert.equal((await request(env,'/api/admin/layouts','POST',payload,admin)).status,400);
  assert.equal((await request(env,'/api/admin/layouts','POST','x'.repeat(1024*1024+1),admin)).status,413);
  assert.equal((await request(env,'/api/admin/login','POST','{bad json')).status,400);
 }finally{close();}
});

test('overview only counts enabled schedules and bulk preserves body limit status',async()=>{
 const {env,close}=makeEnv();try{
  const admin=await login(env);
  for(const [id,enabled] of [['active',1],['disabled',0]])await env.DB.prepare('INSERT INTO schedules(id,name,scope,target,layout_id,enabled,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,id,'all','*','test',enabled,'2026-10-28').run();
  const overview=await (await request(env,'/api/admin/overview','GET',undefined,admin)).json();assert.equal(overview.schedules,1);
  assert.equal((await request(env,'/api/admin/screens/bulk','PATCH','x'.repeat(250001),admin)).status,413);
 }finally{close();}
});
