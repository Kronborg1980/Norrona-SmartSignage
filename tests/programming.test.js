import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {programmingSchema} from '../src/programming-schema.js';
import {makeEnv,request} from './helpers/env.js';
const ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(new URL('../public/shared.js',import.meta.url),'utf8'),ctx);const core=ctx.module.exports;
const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:10,position:0,priority:10,enabled:true};
function booking(x={}){return {id:'booking-one',name:'Booking',scope:'channel',target:'channel-one',item_type:'content',item_id:'content-one',...every,...x};}
const m={screen:{id:'screen-one',zone:'Lobby',layout_id:'base'},layouts:[{id:'base',widgets:[{id:'area-one',type:'channel',channel_id:'channel-one',x:100,y:200,w:600,h:400,z:3,opacity:.5}]}],schedules:[],channels:[{id:'channel-one'}],content:[{id:'content-one',version:1,widget:{type:'text',text:'One',opacity:.5}},{id:'content-two',version:2,widget:{type:'text',text:'Two'}}]};
test('channel playlists use deterministic order, durations, priority and independent destinations',()=>{
 const manifest={...m,bookings:[booking({id:'second',item_id:'content-two',position:1,duration:20}),booking({id:'first'})]};
 const at=t=>new Date('2026-10-28T00:00:'+t+'Z');
 assert.equal(core.pickBooking(manifest,'channel','channel-one',at('09')).id,'first');
 assert.equal(core.pickBooking(manifest,'channel','channel-one',at('10')).id,'second');
 assert.equal(core.pickBooking(manifest,'channel','channel-one',at('29')).id,'second');
 assert.equal(core.pickBooking(manifest,'channel','channel-one',at('30')).id,'first');
 assert.equal(core.pickBooking(manifest,'channel','other-channel',at('10')),null);
 const resolved=core.resolveWidgets(m.layouts[0],manifest,at('09'))[0];assert.equal(resolved.widget.text,'One');assert.equal(resolved.widget.x,100);assert.equal(resolved.widget.w,600);assert.equal(resolved.widget.z,3);assert.equal(resolved.widget.opacity,.25);
 manifest.bookings.push(booking({id:'urgent',priority:100,start_time:'00:01',end_time:'00:01'}));
 assert.equal(core.pickBooking(manifest,'channel','channel-one',new Date('2026-10-28T00:01:10Z')).id,'urgent');
 assert.equal(core.resolveWidgets(m.layouts[0],{...m,bookings:[]},at('00'))[0].widget.type,'empty');
});
test('booking dates and overnight weekdays belong to the starting day, including the end minute',()=>{
 const b=booking({days:[2],start_date:'2026-10-27',end_date:'2026-10-27',start_time:'22:00',end_time:'04:00'});
 for(const at of ['2026-10-27T22:00:00Z','2026-10-28T03:59:59Z','2026-10-28T04:00:59Z'])assert.notEqual(core.bookingWindow(b,new Date(at)),null);
 for(const at of ['2026-10-27T21:59:59Z','2026-10-28T04:01:00Z','2026-11-03T23:00:00Z'])assert.equal(core.bookingWindow(b,new Date(at)),null);
 assert.equal(core.bookingWindow({...b,enabled:false},new Date('2026-10-27T22:00:00Z')),null);
});
test('screen bookings support layouts and fullscreen content, specificity, expiry and legacy fallback',()=>{
 const manifest={...m,screen:{...m.screen,orientation:'portrait'},layouts:[...m.layouts,{id:'event',widgets:[]}],bookings:[booking({id:'all',scope:'all',target:'*',item_type:'layout',item_id:'event'}),booking({id:'screen',scope:'screen',target:'screen-one',start_time:'10:00',end_time:'10:59'})]};
 const full=core.resolveLayout(manifest,new Date('2026-10-28T10:00:00Z'));assert.match(full.id,/booking:screen/);assert.equal(full.widgets[0].text,'One');assert.equal(full.widgets[0].w,1080);assert.equal(full.widgets[0].h,1920);
 assert.equal(core.resolveLayout(manifest,new Date('2026-10-28T11:00:00Z')).id,'event');
 manifest.bookings[0].enabled=false;assert.equal(core.resolveLayout(manifest,new Date('2026-10-28T11:00:00Z')).id,'base');
 manifest.schedules=[{id:'legacy',enabled:true,scope:'all',layout_id:'event',days:every.days,start_time:'00:00',end_time:'23:59',priority:1000}];assert.equal(core.resolveLayout(manifest,new Date('2026-10-28T11:00:00Z')).id,'event');
 manifest.bookings[1].target='another-screen';assert.equal(core.resolveLayout(manifest,new Date('2026-10-28T10:00:00Z')).id,'event');
});
async function admin(env){return (await(await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;}
test('schema migration and explicit authenticated activation match and preserve existing data',async()=>{
 const sql=fs.readFileSync(new URL('../migrations/0003_channels_bookings.sql',import.meta.url),'utf8');assert.equal(sql.trim(),programmingSchema.trim());
 const {env,close}=makeEnv();try{
  await env.DB.prepare('DROP TABLE bookings').run();await env.DB.prepare('DROP TABLE content').run();await env.DB.prepare('DROP TABLE channels').run();
  assert.equal((await request(env,'/api/admin/programming/setup','POST',{})).status,401);
  const token=await admin(env);await request(env,'/api/admin/layouts','POST',{id:'legacy',name:'Keep',widgets:[]},token);
  assert.equal((await(await request(env,'/api/admin/programming','GET',undefined,token)).json()).available,false);
  assert.equal((await request(env,'/api/admin/channels','POST',{name:'Not ready'},token)).status,503);
  for(let i=0;i<2;i++)assert.equal((await request(env,'/api/admin/programming/setup','POST',{},token)).status,200);
  assert.equal((await(await request(env,'/api/admin/programming','GET',undefined,token)).json()).available,true);
  assert.equal((await(await request(env,'/api/admin/layouts','GET',undefined,token)).json()).items[0].name,'Keep');
 }finally{close();}
});
test('channel/content/bookings persist, guard references and reject invalid rules without altering data',async()=>{
 const {env,close}=makeEnv();try{
  const token=await admin(env),post=(table,data)=>request(env,'/api/admin/'+table,'POST',data,token);
  assert.equal((await post('channels',{id:'channel-one',name:'Lobby'})).status,200);
  assert.equal((await post('content',{id:'content-one',name:'Reusable HTML',widget:{type:'html',html:'<h1>Welcome</h1>',htmlNetwork:true}})).status,200);
  assert.equal((await post('bookings',booking())).status,200);
  assert.equal((await post('layouts',{id:'layout-one',name:'Channel layout',widgets:m.layouts[0].widgets})).status,200);
  for(const patch of [{duration:0},{duration:1.5},{start_date:'2026-02-30'},{start_date:'2026-12-01',end_date:'2026-01-01'},{days:[]},{start_time:'25:00'},{item_type:'layout'},{item_id:'missing'},{target:'missing'},{scope:'invalid'},{priority:-1}])assert.equal((await post('bookings',booking(patch))).status,400,JSON.stringify(patch));
  assert.equal((await request(env,'/api/admin/content?id=content-one','DELETE',undefined,token)).status,409);
  assert.equal((await request(env,'/api/admin/channels?id=channel-one','DELETE',undefined,token)).status,409);
  assert.equal((await post('layouts',{name:'Bad reference',widgets:[{type:'channel',channel_id:'missing'}]})).status,400);
  const data=await(await request(env,'/api/admin/programming','GET',undefined,token)).json();assert.equal(data.bookings.length,1);assert.equal(data.bookings[0].duration,10);assert.equal(data.content[0].widget.htmlNetwork,true);
  await request(env,'/api/admin/bookings?id=booking-one','DELETE',undefined,token);
  assert.equal((await request(env,'/api/admin/channels?id=channel-one','DELETE',undefined,token)).status,409);
  await request(env,'/api/admin/layouts?id=layout-one','DELETE',undefined,token);
  assert.equal((await request(env,'/api/admin/channels?id=channel-one','DELETE',undefined,token)).status,200);
 }finally{close();}
});
test('100 players receive complete relevant channel manifests, asset integrity and 304 updates',async()=>{
 const {env,close}=makeEnv();try{
  const token=await admin(env),post=(table,data)=>request(env,'/api/admin/'+table,'POST',data,token);
  await post('channels',{id:'channel-one',name:'Main channel'});await post('channels',{id:'unrelated-channel',name:'Unrelated'});
  const png=Uint8Array.from([137,80,78,71,13,10,26,10]);const media=await(await request(env,'/api/admin/media','POST',png,token,{'Content-Type':'image/png'})).json();
  await post('content',{id:'content-one',name:'Offline image',widget:{type:'image',src:media.url}});await post('content',{id:'unrelated-content',name:'Unrelated',widget:{type:'text',text:'Private other stream'}});
  await post('bookings',booking());await post('bookings',booking({id:'unrelated-booking',target:'unrelated-channel',item_id:'unrelated-content'}));
  const layout=await(await post('layouts',{id:'layout-one',name:'Main',widgets:m.layouts[0].widgets})).json();
  const devices=Array.from({length:100},(_,i)=>({id:i.toString(16).padStart(24,'0'),token:'device-'+i}));
  for(const d of devices){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d.token)),hash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');await env.DB.prepare('INSERT INTO screens(id,name,zone,layout_id,device_token_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(d.id,'TV','Lobby',layout.id,hash,new Date().toISOString(),new Date().toISOString()).run();}
  const sync=(d,etag='',cap=true)=>request(env,'/api/player/sync','POST',undefined,'',{'X-Player-ID':d.id,'X-Player-Token':d.token,...(cap?{'X-Player-Capabilities':'channels-v1'}:{}),...(etag?{'If-None-Match':etag}:{})});
  assert.equal((await sync(devices[0],'',false)).status,409);
  const replies=await Promise.all(devices.map(d=>sync(d)));for(const r of replies){assert.equal(r.status,200);const data=await r.clone().json();assert.equal(data.programming,1);assert.deepEqual(data.channels.map(c=>c.id),['channel-one']);assert.deepEqual(data.content.map(c=>c.id),['content-one']);assert.equal(data.bookings.length,1);assert.equal(data.assets[0].sha256,media.sha256);}
  const etag=replies[0].headers.get('ETag');assert.equal((await sync(devices[0],etag)).status,304);
  await post('content',{id:'content-one',name:'Updated text',widget:{type:'text',text:'Updated channel content'}});const updated=await sync(devices[0],etag);assert.equal(updated.status,200);assert.notEqual(updated.headers.get('ETag'),etag);assert.equal((await updated.json()).content[0].widget.text,'Updated channel content');
 }finally{close();}
});
test('direct screen bookings include booked layouts and protect them from deletion',async()=>{
 const {env,close}=makeEnv();try{
  const token=await admin(env),post=(table,data)=>request(env,'/api/admin/'+table,'POST',data,token);
  const pair=await(await request(env,'/api/player/pair/start','POST')).json();await post('pair/claim',{code:pair.code});const device=await(await request(env,'/api/player/pair/status?code='+pair.code)).json();
  await post('layouts',{id:'booked-layout',name:'Event',widgets:[]});await post('bookings',booking({scope:'screen',target:device.screen_id,item_type:'layout',item_id:'booked-layout'}));
  const r=await request(env,'/api/player/sync','POST',undefined,'',{'X-Player-ID':device.screen_id,'X-Player-Token':device.token,'X-Player-Capabilities':'channels-v1'});assert.equal(r.status,200);const manifest=await r.json();assert.equal(manifest.layouts[0].id,'booked-layout');assert.equal(manifest.bookings[0].scope,'screen');
  assert.equal((await request(env,'/api/admin/layouts?id=booked-layout','DELETE',undefined,token)).status,409);
 }finally{close();}
});
test('channel changes cannot bypass the existing one-video-area constraint',async()=>{
 const {env,close}=makeEnv();try{
  const token=await admin(env),post=(table,data)=>request(env,'/api/admin/'+table,'POST',data,token);
  await post('channels',{id:'channel-one',name:'Video channel'});await post('content',{id:'content-one',name:'Text first',widget:{type:'text',text:'Text'}});await post('bookings',booking());
  const widgets=[{type:'video',src:'https://example.test/video.mp4'},...m.layouts[0].widgets];assert.equal((await post('layouts',{name:'One video',widgets})).status,200);
  const video=await post('content',{id:'content-one',name:'Try video',widget:{type:'video',src:'https://example.test/video.mp4'}});assert.equal(video.status,400);assert.match((await video.json()).error,/multiple video areas/);
 }finally{close();}
});
