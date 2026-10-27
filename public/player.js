(function(){'use strict';
var core=window.SmartSignageCore;
var server=(window.SMARTSIGNAGE_SERVER_URL||'').replace(/\/$/,'');
function endpoint(path){return server+path;}
var $=id=>document.getElementById(id);
var credentials=null,active=null,lastEtag='',layoutId='',lastVersion='',pairCode='',assets={},clockTimer=null,pairTimer=null,busy=false,lastSync=0;
var status='Starting',appVisible=false;
var shellKey='smartsignage-player-shell-v1',manifestKey='signage-manifest-v1',credKey='signage-device-v1',etagKey='signage-etag-v1';
function state(s){status=s;$('debug-state').textContent=s;}
function show(id){['pair-screen','empty-state'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
function create(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function store(k,o){try{localStorage.setItem(k,JSON.stringify(o));return true;}catch(e){state('Storage unavailable');return false;}}
function load(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}}
function validCred(o){return o&&/^[a-f0-9]{24}$/.test(o.id)&&/^[a-f0-9]{64}$/.test(o.token);}
function manifestValid(o){return o&&o.schema===1&&o.screen&&Array.isArray(o.layouts)&&Array.isArray(o.assets)&&Array.isArray(o.schedules);}
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
 var next={};if(!('caches' in window))return next;
 var c=await caches.open('signage-media-v1');for(var i=0;i<manifest.assets.length;i++){
  var x=manifest.assets[i],r=await c.match(mediaKey(x.url));if(!r)throw Error('Cached media missing: '+x.url);
  if(r.blob)next[x.url]=URL.createObjectURL(await r.blob());
 }return next;
}
function freeUrls(map){Object.keys(map||{}).forEach(k=>URL.revokeObjectURL(map[k]));}
async function activate(manifest,etag){
 if(!manifestValid(manifest))throw Error('Unsupported manifest');
 await fetchVerified(manifest);
 // Activate only after verified files are available as locally playable Blob URLs.
 var newUrls=await getUrls(manifest);
 if(!store(manifestKey,manifest)){freeUrls(newUrls);throw Error('Cannot save offline manifest');}
 store(etagKey,etag||'');var old=assets;
 assets=newUrls;active=manifest;lastEtag=etag||'';lastVersion=lastEtag;layoutId='';render();freeUrls(old);
 state('Synced · offline-ready');
}
function getDimensions(l){return l&&l.orientation==='portrait'?[1080,1920]:[1920,1080];}
function resize(){if(!active)return;var l=core.resolveLayout(active,new Date()),dim=getDimensions(l),w=dim[0],h=dim[1];var sx=innerWidth/w,sy=innerHeight/h;var stage=$('stage');stage.style.width=w+'px';stage.style.height=h+'px';var s=Math.min(sx,sy);stage.style.left=((innerWidth-w*s)/2)+'px';stage.style.top=((innerHeight-h*s)/2)+'px';stage.style.transform='scale('+s+')';}
function render(){if(!active){show('pair-screen');return;}
 var layout=core.resolveLayout(active,new Date());$('debug-name').textContent=active.screen.name||'';
 if(!layout){show('empty-state');$('empty-name').textContent=active.screen.name;clearStage();return;}
 show('');if(layout.id===layoutId)return;layoutId=layout.id;clearStage();var stage=$('stage');stage.style.background=layout.background||'#071220';
 layout.widgets.slice().sort((a,b)=>a.z-b.z).forEach(function(input){
  var w=core.normalizeWidget(input),elem=create('div','widget');
  Object.assign(elem.style,{left:w.x+'px',top:w.y+'px',width:w.w+'px',height:w.h+'px',zIndex:String(w.z),color:w.color,background:w.background,borderRadius:w.radius+'px',fontSize:w.fontSize+'px',textAlign:w.align});
  if(w.type==='text'){
   var t=create('div','text',w.text);t.style.justifyContent=w.align==='center'?'center':w.align==='right'?'flex-end':'flex-start';elem.append(t);
  }else if(w.type==='clock'){
   var t=create('div','clock');elem.append(t);t.style.justifyContent='center';
   var tick=()=>t.textContent=new Date().toISOString().slice(11,16)+' UTC';tick();(window._clocks=window._clocks||[]).push(setInterval(tick,1000));
  }else if(w.type==='ticker'){
   var wrap=create('div','ticker');var span=create('span','',w.text);span.style.animationDuration=Math.max(8,(w.text.length+40)*100/w.speed/2)+'s';wrap.append(span);elem.append(wrap);
  }else if(w.type==='image'||w.type==='video'){
   var url=assets[w.src]||(w.src&&w.src.charAt(0)==='/'?endpoint(w.src):w.src);if(!url)return;var m=create(w.type==='image'?'img':'video');m.src=url;m.style.objectFit=w.fit;m.style.width='100%';m.style.height='100%';
   if(w.type==='video'){m.autoplay=true;m.muted=true;m.loop=true;m.playsInline=true;m.setAttribute('playsinline','');m.addEventListener('error',()=>state('Video playback error'));m.play().catch(()=>state('Video autoplay blocked'));}
   elem.append(m);
  }stage.append(elem);
 });resize();appVisible=true;
}
function clearStage(){(window._clocks||[]).forEach(clearInterval);window._clocks=[];var stage=$('stage');stage.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});stage.replaceChildren();}
async function pairingStart(){try{show('pair-screen');var r=await fetch(endpoint('/api/player/pair/start'),{method:'POST'});if(!r.ok)throw Error('Pairing service unavailable');var j=await r.json();pairCode=j.code;$('pair-code').textContent=pairCode;$('pair-status').textContent='Waiting for administrator approval';$('try-again').classList.add('hidden');clearInterval(pairTimer);pairTimer=setInterval(pairingPoll,4000);}catch(e){state('Pairing unavailable');$('pair-status').textContent=e.message;$('try-again').classList.remove('hidden');}}
async function pairingPoll(){if(!pairCode||busy)return;busy=true;try{var r=await fetch(endpoint('/api/player/pair/status?code='+encodeURIComponent(pairCode)),{cache:'no-store'});if(r.status===410){clearInterval(pairTimer);$('pair-status').textContent='Code expired';$('try-again').classList.remove('hidden');return;}if(!r.ok)throw Error('Pair status failed');var j=await r.json();if(j.paired){credentials={id:j.screen_id,token:j.token};store(credKey,credentials);pairCode='';clearInterval(pairTimer);state('Paired');show('empty-state');setTimeout(sync,0);}}catch(e){state('Waiting for connection');}finally{busy=false;}}
$('try-again').onclick=pairingStart;
async function sync(){if(!validCred(credentials)||busy)return;busy=true;lastSync=Date.now();try{var h={'X-Player-ID':credentials.id,'X-Player-Token':credentials.token};if(lastEtag)h['If-None-Match']=lastEtag;var r=await fetch(endpoint('/api/player/sync'),{method:'POST',headers:h,cache:'no-store'});
 if(r.status===401){state('Device revoked — re-pair required');return;}
 if(r.status===304){state('Online · up to date');return;}
 if(!r.ok)throw Error('Sync HTTP '+r.status);var j=await r.json();await activate(j,r.headers.get('ETag')||'');
 }catch(e){state('Offline · playing cached content');if(!active)show('empty-state');}
 finally{busy=false;}
}
$('reset-player').onclick=()=>{if(confirm('Forget this display pairing?')){localStorage.removeItem(credKey);localStorage.removeItem(manifestKey);localStorage.removeItem(etagKey);location.reload();}};
async function start(){if(location.search.indexOf('debug=1')>=0)$('debug').classList.remove('hidden');
 if(!server&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 credentials=load(credKey);active=load(manifestKey);lastEtag=load(etagKey)||'';
 if(active&&manifestValid(active)){
  try{assets=await getUrls(active);render();state('Playing last saved content');}catch(e){active=null;lastEtag='';state('Offline media cache incomplete');}
 }
 if(!validCred(credentials)){credentials=null;pairingStart();}
 else{if(!active){show('empty-state');$('empty-name').textContent='Connecting…';}sync();}
 window.addEventListener('resize',resize);
 setInterval(()=>{if(credentials&&Date.now()-lastSync>55000)sync();},15000);
 setInterval(()=>{if(active){var layout=core.resolveLayout(active,new Date());if((layout&&layout.id||'')!==layoutId)render();}},15000);
}
start();
})();
