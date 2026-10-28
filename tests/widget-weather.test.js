import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRoute} from '../src/widget-weather.js';
function fixture() {
 let time=Date.parse('2026-10-28T12:00:00Z'),calls=0,handler=()=>new Response(JSON.stringify({current:{temperature_2m:8,weathercode:0}}));
 const entries=new Map(),cache={async match(key){return entries.get(key)?.clone();},async put(key,value){entries.set(key,value.clone());}};
 const options={cache,clock:()=>time,fetcher:async(...args)=>{calls++;return handler(...args);}};
 const get=(query='kind=weather&latitude=62.01&longitude=-6.02',method='GET')=>weatherRoute(new Request('https://weather-test.example/api/widget/weather?'+query,{method}),options);
 return {get,options,entries,get calls(){return calls;},advance:ms=>{time+=ms;},handle:fn=>{handler=fn;}};
}
test('100 concurrent weather clients share one bounded request on the rounded weather grid',async()=>{
 const f=fixture();let upstream;
 f.handle((url,opts)=>{upstream=new URL(url);assert.equal(opts.redirect,'error');assert.deepEqual(opts.headers,{Accept:'application/json'});return new Response(JSON.stringify({current:{temperature_2m:8,weathercode:0}}));});
 const responses=await Promise.all(Array.from({length:100},()=>f.get()));
 assert.equal(f.calls,1);for(const r of responses){assert.equal(r.status,200);assert.equal((await r.json()).current.temperature_2m,8);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');}
 assert.equal(upstream.origin,'https://api.open-meteo.com');assert.equal(upstream.searchParams.get('latitude'),'62');assert.equal(upstream.searchParams.get('longitude'),'-6');
 assert.equal(upstream.searchParams.get('current'),'temperature_2m,weathercode');
 await f.get('longitude=-6.03&latitude=62.02&kind=weather');assert.equal(f.calls,1);
 f.advance(15*60000);await f.get();assert.equal(f.calls,2);
});
test('429 preserves previous weather, backs off the host across profiles, and recovers after Retry-After',async()=>{
 const f=fixture();await f.get();f.advance(16*60000);
 f.handle(()=>new Response('{"error":true}',{status:429,headers:{'Retry-After':'1800'}}));
 const stale=await f.get();assert.equal(stale.status,200);assert.equal(stale.headers.get('X-Signage-Weather-Stale'),'1');assert.equal(stale.headers.get('X-Signage-Weather-Age'),'960');assert.equal((await stale.json()).current.temperature_2m,8);
 const limited=await f.get('kind=wind&latitude=60&longitude=-3');assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'1800');assert.equal(f.calls,2);
 await f.get();assert.equal(f.calls,2);
 f.advance(1800*1000);f.handle(()=>new Response('{"current":{"temperature_2m":9}}'));
 const recovered=await f.get();assert.equal(recovered.status,200);assert.equal(recovered.headers.get('X-Signage-Weather-Stale'),null);assert.equal((await recovered.json()).current.temperature_2m,9);assert.equal(f.calls,3);
});
test('unseeded 429 has a cooldown and expired weather is not presented as current',async()=>{
 const f=fixture();f.handle(()=>new Response('limited',{status:429}));
 assert.equal((await f.get()).status,429);await f.get();assert.equal(f.calls,1);
 f.advance(15*60000);f.handle(()=>new Response('{"current":{"temperature_2m":8}}'));await f.get();
 f.advance(6*3600000);f.handle(()=>new Response('offline',{status:503}));assert.equal((await f.get()).status,503);
});
test('weather input cannot select hosts, arbitrary fields, credentials, duplicate parameters or methods',async()=>{
 const f=fixture();
 for(const query of ['kind=__proto__&latitude=62&longitude=-6','kind=weather&latitude=91&longitude=0','kind=weather&latitude=&longitude=0','kind=weather&latitude=62&longitude=-181','kind=weather&latitude=NaN&longitude=0','kind=weather&latitude=62&longitude=-6&url=https://example.com','kind=weather&latitude=62&longitude=-6&kind=marine','kind=weather&latitude=62&longitude=-6&_=1'])assert.equal((await f.get(query)).status,400);
 assert.equal((await f.get(undefined,'POST')).status,405);assert.equal(f.calls,0);
});
test('bad and oversized weather responses back off without poisoning the last good result',async()=>{
 for(const body of ['{"error":true}','not json','x'.repeat(128*1024+1)]) {
  const f=fixture();await f.get();f.advance(16*60000);f.handle(()=>new Response(body));const r=await f.get();assert.equal(r.status,200);assert.equal(r.headers.get('X-Signage-Weather-Stale'),'1');assert.equal((await r.json()).current.temperature_2m,8);await f.get();assert.equal(f.calls,2);
 }
});
test('wind and marine profiles use only the fixed hosts, fields and units',async()=>{
 const f=fixture(),seen=[];f.handle(url=>{seen.push(new URL(url));return new Response('{"current":{"wind_speed_10m":4,"wave_height":2}}');});
 await f.get('kind=wind&latitude=61&longitude=-3');await f.get('kind=marine&latitude=61&longitude=-3');
 assert.equal(seen[0].host,'api.open-meteo.com');assert.equal(seen[0].searchParams.get('current'),'wind_speed_10m,wind_direction_10m');assert.equal(seen[0].searchParams.get('wind_speed_unit'),'ms');
 assert.equal(seen[1].host,'marine-api.open-meteo.com');assert.equal(seen[1].pathname,'/v1/marine');assert.equal(seen[1].searchParams.get('current'),'wave_height,wave_direction');
});
test('Retry-After dates persist longer cooldowns and invalid/unbounded delays stay finite',async()=>{
 for(const [header,delay] of [['Wed, 28 Oct 2026 20:00:00 GMT',8*3600],['9'.repeat(400),900],['31536000',7*86400]]) {
  const f=fixture();f.handle(()=>new Response('limited',{status:429,headers:{'Retry-After':header}}));const r=await f.get();assert.equal(r.headers.get('Retry-After'),String(delay));
  const cooldown=[...f.entries].find(([key])=>key.includes('/cooldown/'))[1];assert.equal(cooldown.headers.get('Cache-Control'),'public, max-age='+Math.max(6*3600,delay));
 }
});
test('stalled upstream requests abort after eight seconds and enter cooldown',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 f.handle((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
 const pending=f.get();await new Promise(setImmediate);t.mock.timers.tick(8000);
 assert.equal((await pending).status,503);assert.equal((await f.get()).status,503);assert.equal(f.calls,1);
});
