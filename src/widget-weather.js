// A fixed, read-only integration, not a URL proxy. No caller-supplied hosts,
// headers, credentials, redirects or forecast fields reach the upstream service.
const profiles = {
 weather: ['api.open-meteo.com', '/v1/forecast', 'temperature_2m,weathercode', {temperature_unit:'celsius',timezone:'auto'}],
 wind: ['api.open-meteo.com', '/v1/forecast', 'wind_speed_10m,wind_direction_10m', {wind_speed_unit:'ms'}],
 marine: ['marine-api.open-meteo.com', '/v1/marine', 'wave_height,wave_direction', {}]
};
const FRESH = 15 * 60000, RETAIN = 6 * 3600000, MAX_BYTES = 128 * 1024;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Retry-After,X-Signage-Weather-Stale,X-Signage-Weather-Age','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const inflight = new Map();
function reply(data, status=200, extra={}) { return new Response(JSON.stringify(data), {status,headers:{...cors,...extra}}); }
async function read(cache, key) { try { return await (await cache?.match(key))?.json(); } catch { return null; } }
async function put(cache, key, value, ttl=RETAIN) { try { await cache?.put(key,new Response(JSON.stringify(value),{headers:{'Cache-Control':'public, max-age='+Math.ceil(ttl/1000)}})); } catch { /* Cache failure must not break playback. */ } }
function retryDelay(value, at, fallback) {
 const delay=value && /^\d+$/.test(value) ? Number(value)*1000 : Date.parse(value || '')-at;
 return Number.isFinite(delay) ? Math.min(7*86400000,Math.max(fallback,delay)) : fallback;
}
async function boundedJSON(response) {
 if (Number(response.headers.get('Content-Length')) > MAX_BYTES) throw Error('Weather response too large');
 const reader=response.body.getReader();let chunks=[],length=0;
 try { while(true) { const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES){await reader.cancel();throw Error('Weather response too large');}chunks.push(value); } } finally { reader.releaseLock(); }
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(!data || !data.current || typeof data.current !== 'object' || Array.isArray(data.current))throw Error('Missing current weather');
 return data;
}
export async function weatherRoute(req, {cache=globalThis.caches?.default, fetcher=globalThis.fetch, clock=Date.now}={}) {
 if(req.method!=='GET')return reply({error:'Method not allowed'},405,{'Allow':'GET'});
 const url=new URL(req.url), params=url.searchParams,kind=params.get('kind');
 if(!Object.hasOwn(profiles,kind)||[...params.keys()].some(k=>!['kind','latitude','longitude'].includes(k))||[...params.keys()].length!==3)return reply({error:'Invalid weather query'},400);
 const latitude=params.get('latitude'),longitude=params.get('longitude');
 if(!/^-?\d+(?:\.\d+)?$/.test(latitude||'')||!/^-?\d+(?:\.\d+)?$/.test(longitude||'')||Math.abs(Number(latitude))>90||Math.abs(Number(longitude))>180)return reply({error:'Invalid weather coordinates'},400);
 // Regional weather, rounded to a 0.25 degree grid, is shared across screens
 // instead of creating new cache entries for each moving ship fix.
 const lat=Math.round(Number(latitude)*4)/4,lon=Math.round(Number(longitude)*4)/4;
 const [host,path,current,units]=profiles[kind];
 const key=url.origin+'/__weather-cache/v1/'+kind+'/'+lat+'/'+lon;
 const cooldownKey=url.origin+'/__weather-cache/v1/cooldown/'+host;
 const cached=await read(cache,key), at=clock();
 const fresh=cached?.at<=at && at-cached.at<FRESH;
 if(fresh)return reply(cached.data);
 function unavailable(status,retryAt) {
  const extra={'Retry-After':String(Math.max(1,Math.ceil((retryAt-clock())/1000)))};
  if(cached?.at<=clock() && clock()-cached.at<RETAIN)return reply(cached.data,200,{...extra,'X-Signage-Weather-Stale':'1','X-Signage-Weather-Age':String(Math.floor((clock()-cached.at)/1000))});
  return reply({error:status===429?'Weather service rate limited':'Weather temporarily unavailable'},status,extra);
 }
 const cooldown=await read(cache,cooldownKey);
 if(cooldown?.retryAt>at)return unavailable(cooldown.status,cooldown.retryAt);
 // Coalesce concurrent screens in this isolate. Cache API shares completed
 // results/backoff within a Cloudflare data centre, not globally across regions.
 let task=inflight.get(key);
 if(!task) {
  task=(async()=>{
   const upstream=new URL('https://'+host+path);
   upstream.search=new URLSearchParams({latitude:String(lat),longitude:String(lon),current,...units}).toString();
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try {
    const response=await fetcher(upstream.href,{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
    if(!response.ok) {
     const status=response.status===429?429:503;
     const retryAt=clock()+retryDelay(response.headers.get('Retry-After'),clock(),status===429?15*60000:60000);
     await response.body?.cancel();await put(cache,cooldownKey,{status,retryAt},Math.max(RETAIN,retryAt-clock()));return {status,retryAt};
    }
    const data=await boundedJSON(response);await put(cache,key,{at:clock(),data});return {data};
   } catch {
    const retryAt=clock()+60000;await put(cache,cooldownKey,{status:503,retryAt});return {status:503,retryAt};
   } finally { clearTimeout(timer); }
  })();
  inflight.set(key,task);task.finally(()=>{if(inflight.get(key)===task)inflight.delete(key);});
 }
 const result=await task;return result.data?reply(result.data):unavailable(result.status,result.retryAt);
}
