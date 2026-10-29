(function(){'use strict';
var core=window.SmartSignageCore;
var debugMode=core.debugEnabled();
var previewMode=/(?:^|[?&])preview=1(?:&|$)/.test(location.search);
var server=(window.SMARTSIGNAGE_SERVER_URL||'').replace(/\/$/,'');
function endpoint(path){return server+path;}
var $=id=>document.getElementById(id);
var credentials=null,active=null,lastEtag='',layoutId='',lastVersion='',pairCode='',assets={},clockTimer=null,pairTimer=null,busy=false,lastSync=0;
var renderedWidgets=Object.create(null);
var status='Starting',appVisible=false;
var stateKey='signage-state-v2',manifestKey='signage-manifest-v1',credKey='signage-device-v1',etagKey='signage-etag-v1';
function state(s){status=s;$('debug-state').textContent=s;}
function show(id){['pair-screen','empty-state'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
function create(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function store(k,o){try{localStorage.setItem(k,JSON.stringify(o));return true;}catch(e){state('Storage unavailable');return false;}}
function load(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}}
function validCred(o){return o&&/^[a-f0-9]{24}$/.test(o.id)&&/^[a-f0-9]{64}$/.test(o.token);}
function manifestValid(o){
 if(!o||o.schema!==1||!o.screen||typeof o.screen.id!=='string'||!Array.isArray(o.layouts)||!Array.isArray(o.assets)||!Array.isArray(o.schedules))return false;
 if(!o.assets.every(a=>a&&typeof a.url==='string'&&typeof a.sha256==='string'&&/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isInteger(a.size)&&a.size>0)||!o.schedules.every(s=>s&&typeof s.id==='string'))return false;
 const widgetOK=w=>w&&typeof w.type==='string'&&(!/^\/media\//.test(w.src||'')||o.assets.some(a=>a.url===w.src));
 if(!o.layouts.every(l=>l&&typeof l.id==='string'&&Array.isArray(l.widgets)&&l.widgets.every(widgetOK)))return false;
 if(o.programming!==undefined&&o.programming!==1)return false;
 if(o.channel_layouts!==undefined&&(o.channel_layouts!==1||o.programming!==1))return false;
 if(o.programming===1){
  if(!Array.isArray(o.channels)||!Array.isArray(o.content)||!Array.isArray(o.bookings))return false;
  if(!o.channels.every(c=>c&&typeof c.id==='string')||!o.content.every(c=>c&&typeof c.id==='string'&&widgetOK(c.widget)&&c.widget.type!=='channel'))return false;
  if(!o.bookings.every(b=>b&&typeof b.id==='string'&&Number.isInteger(b.duration)&&b.duration>0&&Array.isArray(b.days)&&['screen','zone','all','channel'].includes(b.scope)&&
    (b.scope!=='channel'||o.channels.some(c=>c.id===b.target))&&
    (b.item_type==='content'?o.content.some(c=>c.id===b.item_id):b.item_type==='layout'&&o.layouts.some(l=>l.id===b.item_id))))return false;
  if(!core.programmingReferencesValid(o))return false;
 }
 return o.layouts.every(l=>l.widgets.every(w=>w.type!=='channel'||o.programming===1&&o.channels.some(c=>c.id===w.channel_id)));
}
function mediaKey(url){return new URL(endpoint(url),location.href).toString();}
async function digest(bytes){var result=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,'0')).join('');}
async function fetchVerified(manifest){
 var loaded={};if(!('caches' in window)||!crypto.subtle) {if(manifest.assets.length)throw Error('Offline media storage not supported by device');return loaded;}
 // Content-addressed cache keys. Old manifest remains active until the new one is ready.
 var next=await caches.open('signage-media-v1');
 for(var i=0;i<manifest.assets.length;i++){
  var item=manifest.assets[i];if(!item.sha256)throw Error('Missing asset SHA-256');
  var key=mediaKey(item.url),r=await next.match(key);
  if(r){var b=await r.clone().arrayBuffer();if(await digest(b)===item.sha256){loaded[item.url]=true;continue;}await next.delete(key);}
  r=await fetch(key,{cache:'no-store'});if(!r.ok)throw Error('Asset download failed: '+item.url);
  var raw=await r.arrayBuffer();if(item.size!==raw.byteLength)throw Error('Asset size mismatch');
  if(await digest(raw)!==item.sha256)throw Error('Asset verification failed');
  await next.put(key,new Response(raw,{headers:{'Content-Type':item.mime||'application/octet-stream'}}));loaded[item.url]=true;
 }
 return loaded;
}
async function getUrls(manifest){
 var next={};if(!manifest.assets.length)return next;
 if(!('caches' in window)||!crypto.subtle)throw Error('Offline media storage not supported by device');
 try{
  var c=await caches.open('signage-media-v1');for(var i=0;i<manifest.assets.length;i++){
   var x=manifest.assets[i],r=await c.match(mediaKey(x.url));if(!r)throw Error('Cached media missing: '+x.url);
   var raw=await r.arrayBuffer();
   if(raw.byteLength!==x.size||await digest(raw)!==x.sha256)throw Error('Cached media verification failed: '+x.url);
   next[x.url]=URL.createObjectURL(new Blob([raw],{type:x.mime||'application/octet-stream'}));
  }return next;
 }catch(e){freeUrls(next);throw e;}
}
function freeUrls(map){Object.keys(map||{}).forEach(k=>URL.revokeObjectURL(map[k]));}
async function activate(manifest,etag){
 if(!manifestValid(manifest))throw Error('Unsupported manifest');
 await fetchVerified(manifest);
 // Activate only after verified files are available as locally playable Blob URLs.
 var newUrls=await getUrls(manifest);
 // A single localStorage write commits manifest and ETag together. Separate
 // records can become mismatched after a crash or storage-quota failure.
 if(!store(stateKey,{manifest:manifest,etag:etag||''})){freeUrls(newUrls);throw Error('Cannot save offline manifest');}
 var old=assets;
 assets=newUrls;active=manifest;lastEtag=etag||'';lastVersion=lastEtag;layoutId='';render();freeUrls(old);
 state('Synced · offline-ready');
}
function getDimensions(l){return l&&l.orientation==='portrait'?[1080,1920]:[1920,1080];}
function resize(){if(!active)return;var l=core.resolveLayout(active,new Date()),dim=getDimensions(l),w=dim[0],h=dim[1];var sx=innerWidth/w,sy=innerHeight/h;var stage=$('stage');stage.style.width=w+'px';stage.style.height=h+'px';var s=Math.min(sx,sy);stage.style.left=((innerWidth-w*s)/2)+'px';stage.style.top=((innerHeight-h*s)/2)+'px';stage.style.transform='scale('+s+')';}
function render(){if(!active){show('pair-screen');return;}
 var at=new Date(),layout=core.resolveLayout(active,at);$('debug-name').textContent=active.screen.name||'';
 if(!layout){show('empty-state');$('empty-name').textContent=active.screen.name;layoutId='';clearStage();return;}
 show('');if(layout.id!==layoutId){clearStage();layoutId=layout.id;}var stage=$('stage');stage.style.background=layout.background||'#071220';
 // A work queue preserves each composition's local coordinate space without
 // recursive JavaScript rendering or restarting unaffected iframe/video nodes.
 var jobs=[{parent:stage,layout,records:renderedWidgets,lineage:[layout.id]}];
 for(var jobIndex=0;jobIndex<jobs.length;jobIndex++)renderEntries(jobs[jobIndex],at,jobs);
 resize();appVisible=true;
}
function renderEntries(job,at,jobs){
 var desired=Object.create(null),orientation=job.layout.orientation;
 core.resolveWidgets(job.layout,active,at).sort((a,b)=>a.widget.z-b.widget.z).forEach(function(inputEntry,index){
  var entry=inputEntry,slot=String(index);desired[slot]=true;
  // Preview data is intentionally read-only and may bypass manifest activation.
  // Do not recurse if an invalid preview contains a layout/channel cycle.
  if(entry.layout&&job.lineage.indexOf(entry.layout.id)>=0)entry={key:entry.key+':cycle',widget:Object.assign({},entry.widget,{type:'empty'})};
  var previous=job.records[slot];
  if(previous&&previous.key===entry.key){
   if(entry.layout)jobs.push({parent:previous.stage,layout:entry.layout,records:previous.children,lineage:job.lineage.concat(entry.layout.id)});
   return;
  }
  var input=entry.widget;
  var w=core.normalizeWidget(input,orientation),elem=create('div','widget');
  elem.setAttribute('data-widget-id',w.id);
  Object.assign(elem.style,{left:w.x+'px',top:w.y+'px',width:w.w+'px',height:w.h+'px',zIndex:String(w.z),color:w.color,background:w.background,borderRadius:w.radius+'px',fontSize:w.fontSize+'px',textAlign:w.align});
  Object.assign(elem.style,core.widgetStyle(w));
  var record={key:entry.key,elem};
  if(entry.layout){
   elem.setAttribute('data-booked-layout',entry.layout.id);
   var dim=getDimensions(entry.layout),scale=Math.min(w.w/dim[0],w.h/dim[1]),composition=create('div','composition-stage');
   Object.assign(composition.style,{position:'absolute',left:((w.w-dim[0]*scale)/2)+'px',top:((w.h-dim[1]*scale)/2)+'px',width:dim[0]+'px',height:dim[1]+'px',transformOrigin:'0 0',transform:'scale('+scale+')',background:entry.layout.background||'#071220',overflow:'hidden'});
   elem.append(composition);record.stage=composition;record.children=Object.create(null);
   jobs.push({parent:composition,layout:entry.layout,records:record.children,lineage:job.lineage.concat(entry.layout.id)});
  }else if(w.type==='html'||w.type==='webpage'){elem.append(core.webWidget(w,{diagnostics:debugMode}));var warning=core.widgetNetworkHint(w);if(debugMode&&warning)elem.append(create('div','widget-network-hint',warning));
  }else if(w.type==='text'){
   var t=create('div','text',w.text);t.style.lineHeight='inherit';t.style.alignItems=w.verticalAlign==='top'?'flex-start':w.verticalAlign==='bottom'?'flex-end':'center';t.style.justifyContent=w.align==='center'?'center':w.align==='right'?'flex-end':'flex-start';elem.append(t);
  }else if(w.type==='clock'){
   var t=create('div','clock');elem.append(t);t.style.lineHeight='inherit';t.style.alignItems=w.verticalAlign==='top'?'flex-start':w.verticalAlign==='bottom'?'flex-end':'center';t.style.justifyContent=w.align==='left'?'flex-start':w.align==='right'?'flex-end':'center';
   var tick=()=>t.textContent=new Date().toISOString().slice(11,16)+' UTC';tick();elem._clock=setInterval(tick,1000);(window._clocks=window._clocks||[]).push(elem._clock);
  }else if(w.type==='ticker'){
   var wrap=create('div','ticker');var span=create('span','',w.text);span.style.animationDuration=Math.max(8,(w.text.length+40)*100/w.speed/2)+'s';wrap.append(span);elem.append(wrap);
  }else if(w.type==='image'||w.type==='video'){
   var url=assets[w.src]||(w.src&&w.src.charAt(0)==='/'?endpoint(w.src):w.src);if(!url)return;var m=create(w.type==='image'?'img':'video');m.src=url;m.style.objectFit=w.fit;m.style.width='100%';m.style.height='100%';
   if(w.type==='video'){m.autoplay=true;m.muted=true;m.loop=true;m.playsInline=true;m.setAttribute('playsinline','');m.addEventListener('error',()=>state('Video playback error'));m.play().catch(()=>state('Video autoplay blocked'));}
   elem.append(m);
  }job.parent.append(elem);
  if(previous)removeRecord(previous,job.parent);
  job.records[slot]=record;
 });Object.keys(job.records).forEach(slot=>{if(!desired[slot]){removeRecord(job.records[slot],job.parent);delete job.records[slot];}});
}
function removeRecord(record,parent){
 var pending=[{record,parent,visited:false}];
 while(pending.length){
  var current=pending.pop(),item=current.record,elem=item.elem;
  if(!current.visited&&item.children){pending.push({record:item,parent:current.parent,visited:true});Object.keys(item.children).forEach(key=>pending.push({record:item.children[key],parent:item.stage,visited:false}));continue;}
  if(elem._clock){clearInterval(elem._clock);window._clocks=(window._clocks||[]).filter(x=>x!==elem._clock);}
  elem.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});current.parent.removeChild(elem);
 }
}
function clearStage(){(window._clocks||[]).forEach(clearInterval);window._clocks=[];renderedWidgets=Object.create(null);var stage=$('stage');stage.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});while(stage.firstChild)stage.removeChild(stage.firstChild);}
async function pairingStart(){try{show('pair-screen');var r=await fetch(endpoint('/api/player/pair/start'),{method:'POST'});if(!r.ok)throw Error('Pairing service unavailable');var j=await r.json();pairCode=j.code;$('pair-code').textContent=pairCode;$('pair-status').textContent='Waiting for administrator approval';$('try-again').classList.add('hidden');clearInterval(pairTimer);pairTimer=setInterval(pairingPoll,4000);}catch(e){state('Pairing unavailable');$('pair-status').textContent=e.message;$('try-again').classList.remove('hidden');}}
async function pairingPoll(){if(!pairCode||busy)return;busy=true;try{var r=await fetch(endpoint('/api/player/pair/status?code='+encodeURIComponent(pairCode)),{cache:'no-store'});if(r.status===410){clearInterval(pairTimer);$('pair-status').textContent='Code expired';$('try-again').classList.remove('hidden');return;}if(!r.ok)throw Error('Pair status failed');var j=await r.json();if(j.paired){credentials={id:j.screen_id,token:j.token};store(credKey,credentials);pairCode='';clearInterval(pairTimer);state('Paired');show('empty-state');setTimeout(sync,0);}}catch(e){state('Waiting for connection');}finally{busy=false;}}
$('try-again').onclick=pairingStart;
async function sync(){if(!validCred(credentials)||busy)return;busy=true;lastSync=Date.now();try{var h={'X-Player-ID':credentials.id,'X-Player-Token':credentials.token,'X-Player-Capabilities':'channels-v1,channel-layouts-v1'};if(lastEtag)h['If-None-Match']=lastEtag;var r=await fetch(endpoint('/api/player/sync'),{method:'POST',headers:h,cache:'no-store'});
 if(r.status===401){state('Device revoked — re-pair required');return;}
 if(r.status===304){state('Online · up to date');return;}
 if(!r.ok)throw Error('Sync HTTP '+r.status);var j=await r.json();await activate(j,r.headers.get('ETag')||'');
 }catch(e){state('Offline · playing cached content');if(!active)show('empty-state');}
 finally{busy=false;}
}
$('reset-player').onclick=()=>{if(confirm('Forget this display pairing?')){localStorage.removeItem(credKey);localStorage.removeItem(stateKey);localStorage.removeItem(manifestKey);localStorage.removeItem(etagKey);location.reload();}};
async function start(){
if(previewMode){
 // Preview uses the actual renderer/resolver without pairing, persistence or sync.
 window.addEventListener('message',function(e){
  if(e.origin!==location.origin||e.source!==window.parent||!e.data||e.data.type!=='signage-preview')return;
  var m=e.data.manifest;
  if(!m||!m.screen||!Array.isArray(m.layouts)||!Array.isArray(m.schedules)||!m.layouts.every(l=>l&&Array.isArray(l.widgets)))return;
  active=m;assets={};layoutId='';render();
 });
 window.addEventListener('resize',resize);
 setInterval(function(){if(active)render();},1000);
 return;
}
if(debugMode)$('debug').classList.remove('hidden');
 if(!server&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 credentials=load(credKey);
 var saved=load(stateKey);
 // Legacy manifests remain usable offline; their independently saved ETag is
 // not trusted, so the first online sync requests a complete manifest.
 active=saved?saved.manifest:load(manifestKey);lastEtag=saved&&typeof saved.etag==='string'?saved.etag:'';
 if(!manifestValid(active)){active=null;lastEtag='';}
 if(active&&manifestValid(active)){
  try{assets=await getUrls(active);render();state('Playing last saved content');}catch(e){active=null;lastEtag='';state('Offline media cache incomplete');}
 }
 if(!validCred(credentials)){credentials=null;pairingStart();}
 else{if(!active){show('empty-state');$('empty-name').textContent='Connecting…';}sync();}
 window.addEventListener('resize',resize);
 setInterval(()=>{if(credentials&&Date.now()-lastSync>55000)sync();},15000);
 setInterval(()=>{if(active)render();},1000);
}
start();
})();
