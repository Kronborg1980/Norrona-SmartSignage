import {weatherRoute} from './widget-weather.js';
import {programmingRoute, programmingReady, checkChannelReferences, checkVideoCapacity, screenBookings, manifestProgramming} from './programming.js';
const now = () => new Date().toISOString();
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff' };
function response(data, status=200, extra={}) { return new Response(JSON.stringify(data), { status, headers: {...headers, ...extra} }); }
function error(message, status=400) { return response({ error: message }, status); }
function rand(bytes=24) { const b = crypto.getRandomValues(new Uint8Array(bytes)); return Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); }
async function sha256(input) { const b = typeof input === 'string' ? new TextEncoder().encode(input) : input; return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)),x=>x.toString(16).padStart(2,'0')).join(''); }
function equal(a,b) { if(typeof a !== 'string'||typeof b!=='string'||a.length!==b.length)return false; let x=0; for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i); return x===0; }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function from64(text) { const s=text.replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0)); }
async function sign(content,secret) {const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(content))));}
async function adminAuth(req,env) {
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const fields=token.split('.'); if(fields.length!==3||!env.ADMIN_SESSION_SECRET)return false;
  const [exp,nonce,sig]=fields; if(!/^\d+$/.test(exp)||!/^[0-9a-f]{32}$/.test(nonce)||Date.now()>Number(exp)||Number(exp)>Date.now()+86400000)return false;
  return equal(await sign(exp+'.'+nonce,env.ADMIN_SESSION_SECRET),sig);
}
const MAX_HTML_BYTES=512*1024, MAX_LAYOUT_BYTES=1024*1024;
async function body(req) {
 const limit=['/api/admin/layouts','/api/admin/content'].includes(new URL(req.url).pathname)&&req.method==='POST'?MAX_LAYOUT_BYTES:250000;
 const tooLarge=()=>Object.assign(new Error(limit===MAX_LAYOUT_BYTES?'Layout exceeds 1 MiB. Reduce embedded code or media.':'Request JSON exceeds 250000 bytes'),{status:413});
 if(Number(req.headers.get('content-length'))>limit)throw tooLarge();
 const reader=req.body?.getReader();let length=0,chunks=[];
 if(reader){try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw tooLarge();}chunks.push(value);}}finally{reader.releaseLock();}}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const t=new TextDecoder().decode(bytes);
 let value;try{value=JSON.parse(t||'{}');}catch{throw Object.assign(new Error('Invalid JSON body'),{status:400});}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('JSON body must be an object'),{status:400});
 return value;
}
const name=(x,max=90)=>String(x||'').trim().slice(0,max);
const color=x=>/^#[a-f\d]{3,8}$/i.test(x||'')?x:'#071220';
const allowedUrl=x=> typeof x==='string' && (/^\/media\/[a-f0-9]{32}$/.test(x) || /^https:\/\/[^\s<>"']+$/i.test(x));
function validateWidgets(input,orientation='landscape') {
 if(!Array.isArray(input)||input.length>80)throw new Error('Invalid widgets (max 80)');
 const [width,height]=orientation==='portrait'?[1080,1920]:[1920,1080];
 let videos=0;
 return input.map((w,i)=>{
  if(!['text','clock','image','video','ticker','html','webpage','channel'].includes(w.type))throw new Error('Unknown widget');
  if(w.type==='channel'&&!/^[a-zA-Z0-9_-]{3,50}$/.test(w.channel_id||''))throw new Error('Choose a channel for this area');
  if(w.type==='video'&&++videos>1)throw new Error('Only one video per layout on Tizen');
  if(['image','video'].includes(w.type)&&w.src&&!allowedUrl(w.src))throw new Error('Media URL must be HTTPS or hosted library media');
  if(w.type==='html'&&(typeof w.html!=='string'||new TextEncoder().encode(w.html).byteLength>MAX_HTML_BYTES))throw new Error('HTML code must be text of at most 512 KiB (UTF-8)');
  if(w.type==='html'&&/<\?(?:php|=)/i.test(w.html))throw new Error('PHP runs on a server. Use a Web page widget with the hosted HTTPS URL.');
  if(w.type==='webpage'){
   try{const u=new URL(w.src);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw new Error('Web page widgets require an HTTPS URL without credentials');}
  }
  const clamp=(v,a,b,def)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):def;
  return {id:/^[a-zA-Z0-9_-]{3,50}$/.test(w.id||'')?w.id:rand(8),type:w.type,channel_id:w.type==='channel'?w.channel_id:'',
   x:clamp(w.x,0,width,0),y:clamp(w.y,0,height,0),w:clamp(w.w,20,width,400),h:clamp(w.h,20,height,150),z:clamp(w.z,0,999,i),
   html:w.type==='html'?w.html:'',htmlNetwork:w.type==='html'&&w.htmlNetwork===true,text:name(w.text,2000),src:w.type==='webpage'?new URL(w.src).href:allowedUrl(w.src)?w.src:'',color:color(w.color)||'#ffffff',background:w.background==='transparent'?'transparent':color(w.background),
   fontFamily:['Arial','Helvetica','Verdana','Tahoma','Trebuchet MS','Times New Roman','Georgia','Courier New','Impact','Comic Sans MS','Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Raleway','Noto Sans'].includes(w.fontFamily)?w.fontFamily:'Arial',
   bold:w.bold===true,italic:w.italic===true,underline:w.underline===true,
   lineHeight:clamp(w.lineHeight,0.8,3,1.16),letterSpacing:clamp(w.letterSpacing,-5,30,0),verticalAlign:['top','middle','bottom'].includes(w.verticalAlign)?w.verticalAlign:'middle',opacity:clamp(w.opacity,0,1,1),
   fontSize:clamp(w.fontSize,10,300,48),align:['left','center','right'].includes(w.align)?w.align:'left',fit:['cover','contain'].includes(w.fit)?w.fit:'contain',radius:clamp(w.radius,0,200,0),speed:clamp(w.speed,5,180,40)};
 });
}
function mapLayout(l) {return {...l,widgets:JSON.parse(l.widgets_json),widgets_json:undefined};}
function mapSchedule(s) {return {...s,days:JSON.parse(s.days_json),days_json:undefined,enabled:!!s.enabled};}
async function login(req,env) {
 if(!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET)return error('Configure ADMIN_PASSWORD and ADMIN_SESSION_SECRET first',503);
 const ip=(req.headers.get('CF-Connecting-IP')||'local').slice(0,80);
 let rec=await env.DB.prepare('SELECT * FROM login_attempts WHERE ip=?').bind(ip).first();
 if(rec&&rec.blocked_until>Date.now())return error('Too many attempts. Retry later.',429);
 const j=await body(req);
 if(!equal(await sha256(String(j.password||'')),await sha256(env.ADMIN_PASSWORD))) {
  // Increment inside SQLite, so concurrent requests cannot overwrite failures
  // with the same count read before password verification.
  await env.DB.prepare('INSERT INTO login_attempts(ip,failures,blocked_until) VALUES(?,1,0) ON CONFLICT(ip) DO UPDATE SET failures=login_attempts.failures+1,blocked_until=CASE WHEN login_attempts.failures+1>=5 THEN ? ELSE 0 END').bind(ip,Date.now()+15*60000).run();
  return error('Incorrect password',401);
 }
 await env.DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run();
 const exp=Date.now()+8*3600000, nonce=rand(16),p=exp+'.'+nonce;
 return response({token:p+'.'+await sign(p,env.ADMIN_SESSION_SECRET),expires_at:new Date(exp).toISOString()});
}
async function adminRoute(req,env,url) {
 const path=url.pathname;const method=req.method;
 if(path==='/api/admin/login'&&method==='POST')return login(req,env);
 if(!await adminAuth(req,env))return error('Not authorised',401);
 if(/^\/api\/admin\/(?:programming(?:\/setup)?|channels|content|bookings)$/.test(path))return programmingRoute(req,env,url,{body,response,rand,validateWidgets});
 if(path==='/api/admin/screens/bulk'&&method==='PATCH')return bulkScreens(req,env);
 if(path==='/api/admin/overview'&&method==='GET') {
  const [s,l,m,sc]=await Promise.all([
   env.DB.prepare('SELECT COUNT(*) AS total,SUM(CASE WHEN last_seen>=? AND enabled=1 THEN 1 ELSE 0 END) AS online FROM screens').bind(new Date(Date.now()-3*60000).toISOString()).first(),
   env.DB.prepare('SELECT COUNT(*) n FROM layouts').first(),env.DB.prepare('SELECT COUNT(*) n FROM media').first(),env.DB.prepare('SELECT COUNT(*) n FROM schedules WHERE enabled=1').first()]);
  return response({screens:s.total,online:s.online||0,layouts:l.n,media:m.n,schedules:sc.n});
 }
 if(path==='/api/admin/screens'&&method==='GET')return response({items:(await env.DB.prepare('SELECT id,name,zone,orientation,layout_id,last_seen,enabled,version,created_at FROM screens ORDER BY name COLLATE NOCASE').all()).results});
 if(path==='/api/admin/screens'&&method==='PATCH') {
  const j=await body(req);if(!j.id)return error('Missing screen id');
  if(j.layout_id&&!(await env.DB.prepare('SELECT id FROM layouts WHERE id=?').bind(j.layout_id).first()))return error('Layout missing');
  const found=await env.DB.prepare('SELECT id FROM screens WHERE id=?').bind(j.id).first(); if(!found)return error('Screen not found',404);
  await env.DB.prepare('UPDATE screens SET name=?,zone=?,orientation=?,layout_id=?,enabled=?,updated_at=? WHERE id=?').bind(name(j.name)||'Screen',name(j.zone)||'General',j.orientation==='portrait'?'portrait':'landscape',j.layout_id||null,j.enabled===false?0:1,now(),j.id).run();
  return response({ok:true});
 }
 if(path==='/api/admin/screens/reset'&&method==='POST') {
  const j=await body(req);if(!j.id)return error('Missing screen id');
  await env.DB.prepare('UPDATE screens SET device_token_hash=?,last_seen=NULL,updated_at=? WHERE id=?').bind('revoked-'+rand(),now(),j.id).run(); return response({ok:true});
 }
 if(path==='/api/admin/pair/claim'&&method==='POST') {
  const j=await body(req);const code=String(j.code||'').toUpperCase();
  const pairing=await env.DB.prepare('SELECT * FROM pairings WHERE code=? AND expires_at>?').bind(code,now()).first();
  if(!pairing||pairing.claimed_screen_id)return error('Invalid or expired pairing code',404);
  const id=rand(12),token=rand(32), stamp=now();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO screens(id,name,zone,orientation,layout_id,device_token_hash,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM pairings WHERE code=? AND expires_at>? AND claimed_screen_id IS NULL)').bind(id,name(j.name)||'New screen',name(j.zone)||'General',j.orientation==='portrait'?'portrait':'landscape',null,await sha256(token),stamp,stamp,code,stamp),
   env.DB.prepare('UPDATE pairings SET claimed_screen_id=?,claimed_token=? WHERE code=? AND claimed_screen_id IS NULL AND EXISTS (SELECT 1 FROM screens WHERE id=?)').bind(id,token,code,id)
  ]);
  const claimed=await env.DB.prepare('SELECT claimed_screen_id FROM pairings WHERE code=?').bind(code).first();
  if(claimed?.claimed_screen_id!==id)return error('Invalid or expired pairing code',404);
  return response({ok:true,screen_id:id});
 }
 if(path==='/api/admin/layouts'&&method==='GET')return response({items:(await env.DB.prepare('SELECT * FROM layouts ORDER BY updated_at DESC').all()).results.map(mapLayout)});
 if(path==='/api/admin/layouts'&&method==='POST') {
  const j=await body(req);let widgets;
  try{widgets=validateWidgets(j.widgets||[],j.orientation);}catch(e){return error(e.message);}
  const id=j.id||rand(12);if(!/^[a-zA-Z0-9_-]{3,50}$/.test(id))return error('Invalid layout id');
  await checkChannelReferences(env,widgets);
  await checkVideoCapacity(env,{layout:{id,name:name(j.name)||'Untitled layout',widgets}});
  if(new TextEncoder().encode(JSON.stringify(widgets)).byteLength>MAX_LAYOUT_BYTES)return error('Layout widget data exceeds 1 MiB',413);
  const existing=await env.DB.prepare('SELECT version FROM layouts WHERE id=?').bind(id).first();
  const stamp=now();
  await env.DB.prepare('INSERT INTO layouts(id,name,orientation,background,widgets_json,version,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,orientation=excluded.orientation,background=excluded.background,widgets_json=excluded.widgets_json,version=excluded.version,updated_at=excluded.updated_at')
    .bind(id,name(j.name)||'Untitled layout',j.orientation==='portrait'?'portrait':'landscape',color(j.background),JSON.stringify(widgets),(existing?.version||0)+1,stamp).run();
  return response({id,version:(existing?.version||0)+1});
 }
 if(path==='/api/admin/layouts'&&method==='DELETE') {
  const id=url.searchParams.get('id');if(!id)return error('Missing id');
  const uses=await env.DB.prepare('SELECT id FROM screens WHERE layout_id=? LIMIT 1').bind(id).first();
  const sched=await env.DB.prepare('SELECT id FROM schedules WHERE layout_id=? LIMIT 1').bind(id).first();
  if(uses||sched)return error('Layout is assigned to a screen or schedule',409);
  if(await programmingReady(env)&&await env.DB.prepare("SELECT id FROM bookings WHERE item_type='layout' AND item_id=? LIMIT 1").bind(id).first())return error('Layout is used by a booking',409);
  await env.DB.prepare('DELETE FROM layouts WHERE id=?').bind(id).run();return response({ok:true});
 }
 if(path==='/api/admin/schedules'&&method==='GET')return response({items:(await env.DB.prepare('SELECT * FROM schedules ORDER BY priority DESC').all()).results.map(mapSchedule)});
 if(path==='/api/admin/schedules'&&method==='POST') {
  const j=await body(req), id=j.id||rand(12);
  if(!['screen','zone','all'].includes(j.scope))return error('Invalid scope');
  if(j.scope!=='all'&&!name(j.target))return error('Missing target');
  if(!(await env.DB.prepare('SELECT id FROM layouts WHERE id=?').bind(j.layout_id).first()))return error('Layout not found');
  const time=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
  if(!time(j.start_time)||!time(j.end_time))return error('Time must be HH:MM UTC');
  const days=Array.isArray(j.days)?[...new Set(j.days.map(Number))].filter(x=>Number.isInteger(x)&&x>=0&&x<=6):[0,1,2,3,4,5,6];
  if(!days.length)return error('Choose at least one weekday');
  const start=j.start_utc?new Date(j.start_utc):null,end=j.end_utc?new Date(j.end_utc):null;
  if(start&&isNaN(+start)||end&&isNaN(+end)||start&&end&&start>end)return error('Invalid date range');
  await env.DB.prepare('INSERT INTO schedules(id,name,scope,target,layout_id,start_utc,end_utc,days_json,start_time,end_time,priority,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,scope=excluded.scope,target=excluded.target,layout_id=excluded.layout_id,start_utc=excluded.start_utc,end_utc=excluded.end_utc,days_json=excluded.days_json,start_time=excluded.start_time,end_time=excluded.end_time,priority=excluded.priority,enabled=excluded.enabled,updated_at=excluded.updated_at')
   .bind(id,name(j.name)||'Schedule',j.scope,j.scope==='all'?'*':name(j.target),j.layout_id,start?start.toISOString():null,end?end.toISOString():null,JSON.stringify(days),j.start_time,j.end_time,Math.max(0,Math.min(1000,Number(j.priority)||0)),j.enabled===false?0:1,now()).run();
  return response({id});
 }
 if(path==='/api/admin/schedules'&&method==='DELETE') {await env.DB.prepare('DELETE FROM schedules WHERE id=?').bind(url.searchParams.get('id')).run();return response({ok:true});}
 if(path==='/api/admin/media'&&method==='GET')return response({items:(await env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC').all()).results});
 if(path==='/api/admin/media'&&method==='POST') {
  const mime=req.headers.get('content-type')||'';
  let filename='media';try{filename=name(decodeURIComponent(req.headers.get('x-file-name')||'media'),160);}catch(e){return error('Invalid file name');}
  if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4'].includes(mime))return error('Unsupported file: use JPG/PNG/WebP/GIF/MP4');
  if(Number(req.headers.get('content-length'))>25*1024*1024)return error('File too large (25 MB maximum)',413);
  const blob=await req.arrayBuffer();if(blob.byteLength<1||blob.byteLength>25*1024*1024)return error('File must be 1 byte to 25 MB',413);
  // Signature check guards against active HTML disguised as media.
  const v=new Uint8Array(blob), str=(a,b)=>String.fromCharCode(...v.slice(a,b));
  const valid=mime==='image/jpeg'?v[0]===255&&v[1]===216:mime==='image/png'?str(1,4)==='PNG':mime==='image/gif'?str(0,3)==='GIF':mime==='image/webp'?str(0,4)==='RIFF'&&str(8,12)==='WEBP':str(4,8)==='ftyp';
  if(!valid)return error('File signature does not match type');
  const id=rand(16),digest=await sha256(blob);
  await env.MEDIA.put(id,blob,{httpMetadata:{contentType:mime},customMetadata:{sha256:digest}});
  await env.DB.prepare('INSERT INTO media(id,filename,mime,size,created_at) VALUES(?,?,?,?,?)').bind(id,filename,mime,blob.byteLength,now()).run();
  return response({id,url:'/media/'+id,sha256:digest});
 }
 return error('Not found',404);
}
async function bulkScreens(req,env) {
 const j=await body(req);
 if(!j||!Array.isArray(j.ids)||!j.ids.length||j.ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{24}$/.test(id)))return error('Choose valid screen ids');
 const ids=[...new Set(j.ids)],patch=j.patch;
 const fields=['layout_id','zone','orientation','enabled'];
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(k=>!fields.includes(k)))return error('Invalid screen changes');
 if('layout_id' in patch&&patch.layout_id!==null){
  if(typeof patch.layout_id!=='string'||!await env.DB.prepare('SELECT id FROM layouts WHERE id=?').bind(patch.layout_id).first())return error('Layout not found');
 }
 if('zone' in patch&&(typeof patch.zone!=='string'||!patch.zone.trim()||patch.zone.trim().length>90))return error('Zone must contain 1–90 characters');
 if('orientation' in patch&&!['landscape','portrait'].includes(patch.orientation))return error('Invalid orientation');
 if('enabled' in patch&&typeof patch.enabled!=='boolean')return error('Enabled must be a boolean');
 const keys=Object.keys(patch),values=keys.map(k=>k==='enabled'?Number(patch[k]):k==='zone'?patch[k].trim():patch[k]);
 // One JSON parameter avoids D1's SQL bind limit for fleets of 100+ screens.
 // The count guard and UPDATE run in one statement: a missing id changes nothing.
 const selection=JSON.stringify(ids);
 const result=await env.DB.prepare(`UPDATE screens SET ${keys.map(k=>k+'=?').join(',')},updated_at=?
  WHERE id IN (SELECT value FROM json_each(?))
  AND (SELECT COUNT(*) FROM screens WHERE id IN (SELECT value FROM json_each(?)))=?
  RETURNING id`).bind(...values,now(),selection,selection,ids.length).all();
 if(!result.results.length)return error('One or more screens no longer exist. Refresh and select again.',409);
 return response({ok:true,updated:result.results.length});
}
async function playerRoute(req,env,url) {
 const path=url.pathname;
 if(path==='/api/player/pair/start'&&req.method==='POST') {
  await env.DB.prepare('DELETE FROM pairings WHERE expires_at<?').bind(now()).run();
  const code=rand(6).toUpperCase();
  await env.DB.prepare('INSERT INTO pairings(code,expires_at) VALUES(?,?)').bind(code,new Date(Date.now()+15*60000).toISOString()).run();
  return response({code,expires_at:new Date(Date.now()+15*60000).toISOString()});
 }
 if(path==='/api/player/pair/status'&&req.method==='GET') {
  const code=url.searchParams.get('code')||'';
  const entry=await env.DB.prepare('SELECT * FROM pairings WHERE code=? AND expires_at>?').bind(code,now()).first();
  if(!entry)return error('Pairing expired',410);
  if(!entry.claimed_screen_id)return response({paired:false});
  return response({paired:true,screen_id:entry.claimed_screen_id,token:entry.claimed_token});
 }
 if(path==='/api/player/sync'&&req.method==='POST') {
  const id=req.headers.get('X-Player-ID')||'',token=req.headers.get('X-Player-Token')||'';
  if(!id||!token)return error('Player credentials required',401);
  const screen=await env.DB.prepare('SELECT * FROM screens WHERE id=?').bind(id).first();
  if(!screen||!screen.enabled||!equal(await sha256(token),screen.device_token_hash))return error('Device not registered or disabled',401);
  if(!screen.last_seen||Date.now()-Date.parse(screen.last_seen)>115000)await env.DB.prepare('UPDATE screens SET last_seen=? WHERE id=?').bind(now(),id).run();
  const schedules=(await env.DB.prepare('SELECT * FROM schedules WHERE enabled=1 AND (scope=? OR (scope=? AND target=?) OR (scope=? AND target=?))').bind('all','zone',screen.zone,'screen',id).all()).results.map(mapSchedule);
  const directBookings=await screenBookings(env,screen);
  const relevantIds=new Set([screen.layout_id,...schedules.map(s=>s.layout_id),...directBookings.filter(b=>b.item_type==='layout').map(b=>b.item_id)].filter(Boolean));
  const ids=[...relevantIds];
  const layoutRows=ids.length?(await env.DB.prepare('SELECT * FROM layouts WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(JSON.stringify(ids)).all()).results:[];
  let layouts=layoutRows.map(mapLayout);
  if(layouts.length!==ids.length)return error('Referenced layout is unavailable',503);
  const programming=await manifestProgramming(env,layouts,directBookings);
  const capabilities=String(req.headers.get('X-Player-Capabilities')||'').split(',').map(x=>x.trim());
  if(programming&&!capabilities.includes('channels-v1'))return error('Update the player before using channels and bookings',409);
  if(programming?.channel_layouts&&!capabilities.includes('channel-layouts-v1'))return error('Update the player before using layered channel bookings',409);
  if(programming?.layouts)layouts=programming.layouts;
  const refs=new Set();
  for(const w of [...layouts.flatMap(l=>l.widgets),...(programming?.content||[]).map(c=>c.widget)]){
   if(typeof w.src==='string'&&w.src.startsWith('/media/')){
    if(!/^\/media\/[0-9a-f]{32}$/.test(w.src))return error('Referenced media URL is invalid',503);
    refs.add(w.src.slice(7));
   }
  }
  const assets=[];
  for(const mediaId of refs) {
   const meta=await env.MEDIA.head(mediaId);
   if(!meta||!Number.isSafeInteger(meta.size)||meta.size<1||!/^[0-9a-f]{64}$/.test(meta.customMetadata?.sha256||'')||!['image/jpeg','image/png','image/webp','image/gif','video/mp4'].includes(meta.httpMetadata?.contentType))return error('Referenced media is unavailable or missing integrity metadata',503);
   assets.push({url:'/media/'+mediaId,sha256:meta.customMetadata.sha256,size:meta.size,mime:meta.httpMetadata.contentType});
  }
  const payload={schema:1,screen:{id:screen.id,name:screen.name,zone:screen.zone,orientation:screen.orientation,layout_id:screen.layout_id},layouts,schedules,assets};
  if(programming)Object.assign(payload,{programming:1},programming);
  const etag='"'+await sha256(JSON.stringify(payload))+'"';
  if(req.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{'ETag':etag,'Cache-Control':'no-store'}});
  return response(payload,200,{'ETag':etag});
 }
 return error('Not found',404);
}
async function mediaRoute(req,env,url) {
 if(req.method!=='GET'&&req.method!=='HEAD')return error('Method not allowed',405);
 const id=url.pathname.slice(7);if(!/^[0-9a-f]{32}$/.test(id))return error('Media not found',404);
 // Media have unguessable URLs but are not private once the URL is known.
 const range=req.headers.get('Range');
 const opts=range?{range:req.headers}:undefined;
 const obj=await env.MEDIA.get(id,opts);
 if(!obj)return error('Media not found',404);
 const h=new Headers();obj.writeHttpMetadata(h);h.set('ETag',obj.httpEtag);h.set('Accept-Ranges','bytes');h.set('X-Content-Type-Options','nosniff');h.set('Cache-Control','public, max-age=31536000, immutable');
 const total=obj.size;
 if(range&&obj.range&&typeof obj.range.offset==='number'&&typeof obj.range.length==='number') {
  h.set('Content-Range',`bytes ${obj.range.offset}-${obj.range.offset+obj.range.length-1}/${total}`);
  h.set('Content-Length',String(obj.range.length));
  return new Response(req.method==='HEAD'?null:obj.body,{status:206,headers:h});
 }
 h.set('Content-Length',String(total));return new Response(req.method==='HEAD'?null:obj.body,{headers:h});
}
export { validateWidgets, allowedUrl, equal };
export default {async fetch(req,env) {
 try {
  const url=new URL(req.url), p=url.pathname;
  if(p==='/api/widget/weather')return await weatherRoute(req);
  if(p.startsWith('/api/admin/'))return await adminRoute(req,env,url);
  if(p.startsWith('/api/player/')||p.startsWith('/media/')) {
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,HEAD,OPTIONS','Access-Control-Allow-Headers':'X-Player-ID,X-Player-Token,X-Player-Capabilities,If-None-Match,Content-Type,Range','Access-Control-Expose-Headers':'ETag,Content-Range'};
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
   const r=p.startsWith('/api/player/')?await playerRoute(req,env,url):await mediaRoute(req,env,url);
   const h=new Headers(r.headers);Object.entries(cors).forEach(([k,v])=>h.set(k,v));return new Response(r.body,{status:r.status,headers:h});
  }
  return env.ASSETS.fetch(req);
 }catch(e){if([400,404,405,409,413,503].includes(e?.status))return error(e.message,e.status);console.error('API error',String(e?.message||e));return error('Internal server error',500);}
}};
