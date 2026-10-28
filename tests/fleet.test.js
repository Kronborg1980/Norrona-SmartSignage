import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {makeEnv,request} from './helpers/env.js';
const context={};vm.runInNewContext(fs.readFileSync(new URL('../public/shared.js',import.meta.url),'utf8'),context);
const core=context.SmartSignageCore;

test('fleet filters combine search, zone and status without mutating screens',()=>{
 const at=Date.parse('2026-10-28T10:00:00Z');
 const screens=[{id:'a',name:'Reception Port',zone:'Lobby',enabled:1,last_seen:new Date(at-180000).toISOString()}, {id:'b',name:'Restaurant',zone:'Deck 7',enabled:1,last_seen:null}, {id:'c',name:'Reception Starboard',zone:'Lobby',enabled:0,last_seen:new Date(at).toISOString()}];
 assert.equal(core.screenStatus(screens[0],at),'Online');
 assert.equal(core.screenStatus({...screens[0],last_seen:new Date(at-180001).toISOString()},at),'Offline');
 assert.equal(core.screenStatus({...screens[0],last_seen:'invalid'},at),'Offline');
 assert.equal(core.screenStatus(screens[2],at),'Disabled');
 assert.deepEqual(Array.from(core.filterScreens(screens,{query:'  RECEPTION ',zone:'Lobby',status:'Online'},at),s=>s.id),['a']);
 assert.equal(core.filterScreens(screens,{query:'deck 7'},at).length,1);
 assert.equal(core.filterScreens(screens,{status:'Disabled'},at).length,1);
 assert.equal(screens.length,3);
});

test('bulk updates 100 screens atomically, rejects invalid changes and preserves other properties',async()=>{
 const {env,close}=makeEnv();try{
  const admin=(await (await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;
  const ids=Array.from({length:101},(_,i)=>i.toString(16).padStart(24,'0'));
  for(const id of ids)await env.DB.prepare('INSERT INTO screens(id,name,zone,device_token_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,'Screen '+id,'Original','untouched','2026-01-01','2026-01-01').run();
  await env.DB.prepare('INSERT INTO layouts(id,name,updated_at) VALUES(?,?,?)').bind('layout-1','Welcome','2026-01-01').run();
  const bulk=(body,token=admin)=>request(env,'/api/admin/screens/bulk','PATCH',body,token);
  assert.equal((await bulk({ids,patch:{enabled:false}},'')).status,401);
  for(const patch of [{},{enabled:0},{orientation:'sideways'},{zone:' '},{zone:'x'.repeat(91)},{layout_id:'missing'},{device_token_hash:'injected'},{name:'Rename'},[]])assert.equal((await bulk({ids,patch})).status,400);
  for(const bad of [[],['bad'],[null],null])assert.equal((await bulk({ids:bad,patch:{enabled:false}})).status,400);
  assert.equal((await bulk('{not json')).status,400);
  const missing='f'.repeat(24);
  assert.equal((await bulk({ids:[ids[0],missing],patch:{enabled:false}})).status,409);
  assert.equal((await env.DB.prepare('SELECT enabled FROM screens WHERE id=?').bind(ids[0]).first()).enabled,1);
  let res=await bulk({ids:[...ids.slice(0,100),ids[0]],patch:{layout_id:'layout-1',zone:' Reception ',orientation:'portrait'}});
  assert.equal(res.status,200);assert.equal((await res.json()).updated,100);
  const rows=(await env.DB.prepare('SELECT * FROM screens ORDER BY id').all()).results;
  for(const s of rows.slice(0,100)){assert.equal(s.layout_id,'layout-1');assert.equal(s.zone,'Reception');assert.equal(s.orientation,'portrait');assert.equal(s.enabled,1);assert.equal(s.device_token_hash,'untouched');assert.equal(s.name,'Screen '+s.id);}
  assert.equal(rows[100].zone,'Original');assert.equal(rows[100].layout_id,null);
  res=await bulk({ids:ids.slice(0,100),patch:{layout_id:null,enabled:false}});assert.equal(res.status,200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM screens WHERE enabled=0 AND layout_id IS NULL').first()).n,100);
 }finally{close();}
});
