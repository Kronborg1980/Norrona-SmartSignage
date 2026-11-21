import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {makeEnv,request} from './helpers/env.js';
const ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(new URL('../public/shared.js',import.meta.url),'utf8'),ctx);const core=ctx.module.exports;
const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:10,position:0,priority:10,enabled:true};
async function admin(env){return (await(await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;}
test('a repeating fullscreen booking takes over for its duration at the start of every interval',()=>{
 const manifest={screen:{id:'tv',zone:'Deck 7'},layouts:[],content:[],bookings:[
  {id:'playlist',name:'Playlist',scope:'screen',target:'tv',item_type:'layout',item_id:'wrap',...every},
  {id:'safety',name:'Safety video',scope:'screen',target:'tv',item_type:'content',item_id:'video',...every,priority:11,duration:90,repeat_minutes:15}]};
 const at=t=>new Date('2026-11-21T'+t+'Z');
 assert.equal(core.pickBooking(manifest,'screen','tv',at('10:00:00')).id,'safety');
 assert.equal(core.pickBooking(manifest,'screen','tv',at('10:01:29')).id,'safety');
 assert.equal(core.pickBooking(manifest,'screen','tv',at('10:01:30')).id,'playlist');
 assert.equal(core.pickBooking(manifest,'screen','tv',at('10:14:59')).id,'playlist');
 assert.equal(core.pickBooking(manifest,'screen','tv',at('10:15:00')).id,'safety');
 assert.equal(core.bookingWindow(manifest.bookings[1],at('10:15:45')),Date.parse('2026-11-21T10:15:00Z'));
 // Counted from the window start, also inside a custom time range.
 const windowed={...manifest.bookings[1],start_time:'08:05',end_time:'20:00'};
 assert.notEqual(core.bookingWindow(windowed,at('08:20:10')),null);assert.equal(core.bookingWindow(windowed,at('08:15:10')),null);assert.equal(core.bookingWindow(windowed,at('07:50:00')),null);
});
test('repeat is stored on demand, validated, preserved by older clients and gated by player capability',async()=>{
 const {env,close}=makeEnv();try{
  const token=await admin(env),post=(table,data)=>request(env,'/api/admin/'+table,'POST',data,token);
  const pair=await(await request(env,'/api/player/pair/start','POST')).json();await post('pair/claim',{code:pair.code});const device=await(await request(env,'/api/player/pair/status?code='+pair.code)).json();
  assert.equal((await post('content',{id:'safety-video',name:'Safety',widget:{type:'video',src:'https://example.com/v.mp4',sound:true}})).status,200);
  const base={name:'Safety',scope:'screen',target:device.screen_id,item_type:'content',item_id:'safety-video',...every};
  assert.equal((await post('bookings',{...base,id:'plain'})).status,200);
  assert.equal((await post('bookings',{...base,id:'bad',duration:900,repeat_minutes:15})).status,400);
  assert.equal((await post('bookings',{...base,id:'bad2',scope:'channel',target:'x',repeat_minutes:15})).status,400);
  assert.equal((await post('bookings',{...base,id:'safety',duration:90,priority:11,repeat_minutes:15})).status,200);
  assert.equal((await post('bookings',{...base,id:'safety',name:'Renamed',duration:90,priority:11})).status,200);
  const model=await(await request(env,'/api/admin/programming','GET',undefined,token)).json();
  assert.equal(model.bookings.find(b=>b.id==='safety').repeat_minutes,15);assert.equal(model.bookings.find(b=>b.id==='plain').repeat_minutes,0);
  assert.equal(model.content.find(c=>c.id==='safety-video').widget.sound,true);
  const sync=caps=>request(env,'/api/player/sync','POST',undefined,'',{'X-Player-ID':device.screen_id,'X-Player-Token':device.token,'X-Player-Capabilities':caps});
  assert.equal((await sync('channels-v1,channel-layouts-v1')).status,409);
  const ok=await sync('channels-v1,channel-layouts-v1,booking-repeat-v1');assert.equal(ok.status,200);const manifest=await ok.json();
  assert.equal(manifest.booking_repeat,1);assert.equal(manifest.bookings.find(b=>b.id==='safety').repeat_minutes,15);
 }finally{close();}
});
