(function(){'use strict';
var token=sessionStorage.getItem('signage-admin-token')||'';
var data={screens:[],layouts:[],schedules:[],media:[],channels:[],bookings:[],content:[],programmingAvailable:false},view='overview',editing=null,selected=null;
var $=id=>document.getElementById(id);
var fleetSelection=new Set(),visibleScreens=[];
var core=window.SmartSignageCore;
var previewScreenId=null,customPreview=null;
function updateScreenPreview(){
 if(customPreview){$('preview-frame').contentWindow.postMessage({type:'signage-preview',manifest:customPreview()},location.origin);return;}
 if(!previewScreenId)return;
 var screen=data.screens.find(s=>s.id===previewScreenId);if(!screen)return;
 $('preview-title').textContent=screen.name;
 $('preview-status').textContent=core.screenStatus(screen,Date.now())+' · Last contact: '+(screen.last_seen?new Date(screen.last_seen).toLocaleString():'Never');
 $('preview-frame').contentWindow.postMessage({type:'signage-preview',manifest:{schema:1,programming:1,screen,layouts:data.layouts,schedules:data.schedules,channels:data.channels,bookings:data.bookings,content:data.content,assets:[]}},location.origin);
}
function previewScreen(s){customPreview=null;previewScreenId=s.id;$('screen-preview').classList.remove('hidden');$('preview-frame').src='/player.html?preview=1';}
function previewManifest(title,provider){previewScreenId=null;customPreview=provider;$('preview-title').textContent=title;$('preview-status').textContent='Planned content · current UTC time';$('screen-preview').classList.remove('hidden');$('preview-frame').src='/player.html?preview=1';}
$('preview-frame').onload=updateScreenPreview;
function closePreview(){previewScreenId=null;customPreview=null;$('screen-preview').classList.add('hidden');$('preview-frame').src='about:blank';}
$('preview-close').onclick=closePreview;
window.addEventListener('keydown',e=>{if(e.key==='Escape')closePreview();});

function el(tag,attrs,children){var a=document.createElement(tag);Object.keys(attrs||{}).forEach(k=>{if(k==='class')a.className=attrs[k];else if(k==='text')a.textContent=attrs[k];else if(k==='onclick')a.addEventListener('click',attrs[k]);else if(k==='value')a.value=attrs[k];else a.setAttribute(k,attrs[k]);});(children||[]).forEach(c=>a.append(typeof c==='string'?document.createTextNode(c):c));return a;}
function clear(parent){parent.replaceChildren();}
function notify(s,bad){var n=$('notice');n.textContent=s;n.classList.remove('hidden');n.classList.toggle('bad',!!bad);setTimeout(()=>n.classList.add('hidden'),5000);}
async function api(url,method='GET',body){var opts={method,headers:{Authorization:'Bearer '+token}};if(body!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}var r=await fetch(url,opts);var j=await r.json().catch(()=>({error:'Network response was not JSON'}));if(!r.ok){if(r.status===401)logout();throw Error(j.error||'HTTP '+r.status);}return j;}
function logout(){closePreview();fleetSelection.clear();sessionStorage.removeItem('signage-admin-token');token='';$('app').classList.add('hidden');$('login').classList.remove('hidden');}
function enter(){ $('login').classList.add('hidden');$('app').classList.remove('hidden');refresh();}
$('login-form').onsubmit=async e=>{e.preventDefault();$('login-error').textContent='';try{var r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});var j=await r.json();if(!r.ok)throw Error(j.error||'Access denied');token=j.token;sessionStorage.setItem('signage-admin-token',token);$('password').value='';enter();}catch(err){$('login-error').textContent=err.message;}};
var programmingUI=window.createProgrammingUI({data,el,option,labeled,inp,api,core,openModal,notify,refresh,uploadFile,preview:previewManifest,channelsChanged:()=>{if(view==='layouts'&&editing){renderCanvas();renderLayers();if(editing.widgets.some(w=>w.id===selected&&w.type==='channel'))renderInspector();}}});
$('logout').onclick=logout;if(token)enter();
async function refresh(){try{var results=await Promise.all([api('/api/admin/overview'),api('/api/admin/screens'),api('/api/admin/layouts'),api('/api/admin/schedules'),api('/api/admin/media'),api('/api/admin/programming')]);data.screens=results[1].items;data.layouts=results[2].items;data.schedules=results[3].items;data.media=results[4].items;data.programmingAvailable=results[5].available===true;data.channels=results[5].channels||[];data.content=results[5].content||[];data.bookings=results[5].bookings||[];$('stat-screens').textContent=results[0].screens;$('stat-online').textContent=results[0].online;$('stat-layouts').textContent=results[0].layouts;$('stat-schedules').textContent=results[0].schedules;$('screen-pill').textContent=data.screens.length;renderScreens();renderLayoutOptions();renderSchedules();renderMedia();programmingUI.render();}catch(e){notify(e.message,true);}}
var titles={overview:['OVERVIEW','Fleet overview'],screens:['DISPLAYS','Display fleet'],layouts:['STUDIO','Layout Studio'],channels:['CHANNELS','Reusable channels'],bookings:['BOOKINGS','Content bookings'],content:['CONTENT','Reusable content'],schedules:['SCHEDULING','Content scheduling'],media:['LIBRARY','Media Library']};
function show(v){view=v;document.querySelectorAll('.view').forEach(n=>n.classList.toggle('hidden',n.id!=='view-'+v));document.querySelectorAll('#nav button').forEach(n=>n.classList.toggle('active',n.dataset.view===v));$('crumb').textContent=titles[v][0];$('page-title').textContent=titles[v][1];if(v==='layouts'&&editing)renderEditor();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
function clock(){ $('utc-clock').textContent=new Date().toISOString().replace('T',' ').slice(0,19)+' UTC';}clock();setInterval(clock,1000);setInterval(()=>{if(token)refresh();},60000);
function option(value,label){return el('option',{value,text:label});}
function selectOptions(list,selected,placeholder){var s=el('select');s.append(option('',placeholder||'None'));list.forEach(x=>s.append(option(x.id,x.name)));s.value=selected||'';return s;}
function fleetFilters(){return {query:$('screen-search').value,zone:$('screen-zone').value,status:$('screen-status').value};}
function updateFleetSelection(){
 var count=visibleScreens.filter(s=>fleetSelection.has(s.id)).length;
 $('screen-count').textContent=visibleScreens.length+' of '+data.screens.length+' displays · '+count+' selected';
 $('screen-select-all').checked=count>0&&count===visibleScreens.length;
 $('screen-select-all').indeterminate=count>0&&count<visibleScreens.length;
 $('screen-select-all').disabled=!visibleScreens.length;
 $('screen-bulk').disabled=!count;$('screen-clear').disabled=!count;
}
function renderScreens(){
 var zone=$('screen-zone').value;clear($('screen-zone'));$('screen-zone').append(option('','All zones'));
 Array.from(new Set(data.screens.map(s=>s.zone))).sort().forEach(z=>$('screen-zone').append(option(z,z)));
 $('screen-zone').value=zone;if($('screen-zone').selectedIndex===-1)$('screen-zone').value='';
 visibleScreens=core.filterScreens(data.screens,fleetFilters(),Date.now());
 var visibleIds=new Set(visibleScreens.map(s=>s.id));fleetSelection.forEach(id=>{if(!visibleIds.has(id))fleetSelection.delete(id);});
 var body=$('screens-body');clear(body);$('screens-empty').classList.toggle('hidden',data.screens.length>0);
 $('screens-no-match').classList.toggle('hidden',!data.screens.length||visibleScreens.length>0);
 visibleScreens.forEach(s=>{
  var tr=el('tr'),state=core.screenStatus(s,Date.now());
  var check=el('input',{type:'checkbox','aria-label':'Select '+s.name});check.checked=fleetSelection.has(s.id);
  check.onchange=()=>{if(check.checked)fleetSelection.add(s.id);else fleetSelection.delete(s.id);updateFleetSelection();};
  var layoutSel=selectOptions(data.layouts,s.layout_id,'No layout');layoutSel.setAttribute('aria-label','Layout for '+s.name);
  layoutSel.onchange=async()=>{layoutSel.disabled=true;try{await api('/api/admin/screens/bulk','PATCH',{ids:[s.id],patch:{layout_id:layoutSel.value||null}});notify('Layout assigned to '+s.name);await refresh();}catch(e){layoutSel.value=s.layout_id||'';notify(e.message,true);}finally{layoutSel.disabled=false;}};
  var bookingButton=el('button',{class:'secondary',text:'+ Booking',onclick:()=>programmingUI.bookingModal(null,{scope:'screen',target:s.id})});bookingButton.disabled=!data.programmingAvailable;
  tr.append(el('td',{},[check]),el('td',{},[el('strong',{text:s.name}),el('small',{text:s.id.slice(0,12)})]),el('td',{text:s.zone}),el('td',{text:s.orientation}),el('td',{},[layoutSel]),el('td',{},[el('span',{class:'status '+(state==='Online'?'online':''),text:state})]),el('td',{text:s.last_seen?new Date(s.last_seen).toLocaleString():'Never'}),el('td',{},[el('button',{class:'secondary',text:'Preview',onclick:()=>previewScreen(s)}),bookingButton,el('button',{class:'secondary',text:'Edit',onclick:()=>editScreen(s)})]));
  body.append(tr);
 });updateFleetSelection();updateScreenPreview();
}
['screen-search','screen-zone','screen-status'].forEach(id=>{$(id).addEventListener(id==='screen-search'?'input':'change',()=>{fleetSelection.clear();renderScreens();});});
$('screen-select-all').onchange=()=>{visibleScreens.forEach(s=>{if($('screen-select-all').checked)fleetSelection.add(s.id);else fleetSelection.delete(s.id);});renderScreens();};
$('screen-clear').onclick=()=>{fleetSelection.clear();renderScreens();};
$('screen-bulk').onclick=()=>{
 var ids=Array.from(fleetSelection);if(!ids.length)return;
 var action=el('select',{},[option('layout_id','Assign default layout'),option('zone','Move to zone / group'),option('orientation','Set orientation'),option('enabled','Enable displays'),option('disabled','Disable displays')]);
 var value=el('div'),control;
 function updateValue(){clear(value);
  if(action.value==='layout_id')control=selectOptions(data.layouts,'','No layout (clear assignment)');
  else if(action.value==='zone')control=inp('','Zone / group');
  else if(action.value==='orientation')control=el('select',{},[option('landscape','Landscape'),option('portrait','Portrait')]);
  else {value.append(el('p',{text:action.value==='disabled'?'Disabled displays stop receiving updates. Cached playback continues.':'Displays resume syncing with their existing device credentials.'}));return;}
  value.append(labeled('New value',control));
 }action.onchange=updateValue;updateValue();
 var names=data.screens.filter(s=>ids.includes(s.id)).map(s=>s.name).join(', ');
 openModal('Update '+ids.length+' selected displays',el('div',{},[el('p',{text:names}),labeled('Action',action),value,el('p',{text:'Changes apply only to the selected displays. Zone schedules still override default layouts.'})]),async()=>{
  var patch={};
  if(action.value==='disabled'){if(!confirm('Disable syncing for '+ids.length+' selected displays? Cached playback will continue.'))return false;patch.enabled=false;}
  else if(action.value==='enabled')patch.enabled=true;
  else patch[action.value]=action.value==='layout_id'?(control.value||null):control.value;
  var result=await api('/api/admin/screens/bulk','PATCH',{ids,patch});fleetSelection.clear();notify(result.updated+' displays updated');
 });
};
var modalSave=()=>{},modalGeneration=0;
function openModal(title,content,onSave){modalGeneration++;$('modal-save').disabled=false;$('modal-title').textContent=title;clear($('modal-content'));$('modal-content').append(content);modalSave=onSave;$('modal').classList.remove('hidden');}
function closeModal(){modalGeneration++;$('modal-save').disabled=false;$('modal').classList.add('hidden');}
$('modal-close').onclick=closeModal;$('modal-cancel').onclick=closeModal;
$('modal-save').onclick=async()=>{
 if($('modal-save').disabled)return;
 var generation=modalGeneration,save=modalSave;$('modal-save').disabled=true;
 try{if(await save()===false)return;if(generation===modalGeneration)closeModal();await refresh();}
 catch(e){notify(e.message,true);}finally{if(generation===modalGeneration)$('modal-save').disabled=false;}
};
function labeled(label,control){if(['INPUT','SELECT','TEXTAREA'].includes(control.tagName))control.setAttribute('aria-label',label);return el('label',{},[document.createTextNode(label),control]);}
function inp(v,placeholder,type='text'){return el('input',{type,value:v==null?'':v,placeholder:placeholder||''});}
$('pair-open').onclick=()=>{var code=inp('','12-character code from player'),n=inp('','e.g. Reception — Port'),zone=inp('Reception','e.g. Reception'),orient=el('select',{},[option('landscape','Landscape'),option('portrait','Portrait')]);openModal('Pair a Samsung display',el('div',{},[el('p',{text:'Open /player.html on the display or a test browser and enter its pairing code.'}),labeled('Pairing code',code),labeled('Screen name',n),labeled('Zone / group',zone),labeled('Orientation',orient)]),async()=>{await api('/api/admin/pair/claim','POST',{code:code.value.trim(),name:n.value,zone:zone.value,orientation:orient.value});notify('Display paired successfully');});};
function editScreen(s){var n=inp(s.name),zone=inp(s.zone),orient=el('select',{},[option('landscape','Landscape'),option('portrait','Portrait')]);orient.value=s.orientation;var enabled=el('input',{type:'checkbox'});enabled.checked=!!s.enabled;var layout=selectOptions(data.layouts,s.layout_id,'No layout');var reset=el('button',{class:'secondary',text:'Revoke device token / require re-pair',onclick:async()=>{if(!confirm('This display will stop syncing until it is re-paired. Continue?'))return;await api('/api/admin/screens/reset','POST',{id:s.id});notify('Device token revoked');closeModal();refresh();}});openModal('Edit display',el('div',{},[labeled('Display name',n),labeled('Zone',zone),labeled('Orientation',orient),labeled('Default layout',layout),el('label',{class:'checkline'},[enabled,' Enabled']),reset]),async()=>{await api('/api/admin/screens','PATCH',{id:s.id,name:n.value,zone:zone.value,orientation:orient.value,layout_id:layout.value||null,enabled:enabled.checked});notify('Display updated');});}
// Layout editor
function freshLayout(){return {id:null,name:'New layout',orientation:'landscape',background:'#071220',widgets:[]};}
function renderLayoutOptions(){var select=$('layout-select'),id=editing&&editing.id;clear(select);select.append(option('','Select layout'));data.layouts.forEach(l=>select.append(option(l.id,l.name)));select.value=id||'';if(!editing){editing=data.layouts.length?JSON.parse(JSON.stringify(data.layouts[0])):freshLayout();renderEditor();select.value=editing.id||'';}}
$('layout-select').onchange=e=>{editing=JSON.parse(JSON.stringify(data.layouts.find(x=>x.id===e.target.value)||freshLayout()));selected=null;renderEditor();};
$('new-layout').onclick=()=>{editing=freshLayout();selected=null;$('layout-select').value='';renderEditor();};
$('save-layout').onclick=async()=>{
 if(!editing||$('save-layout').disabled)return;
 var saving=editing;
 saving.name=$('layout-name').value.trim()||'Untitled layout';saving.background=$('layout-bg').value;saving.orientation=$('layout-orientation').value;
 var payload=JSON.parse(JSON.stringify(saving));
 if(new TextEncoder().encode(JSON.stringify(payload)).byteLength>1024*1024)return notify('Layout exceeds 1 MiB. Reduce embedded code or media.',true);
 if(payload.widgets.some(w=>w.type==='html'&&new TextEncoder().encode(w.html||'').byteLength>512*1024))return notify('An HTML widget exceeds 512 KiB.',true);
 $('save-layout').disabled=true;
 try{var r=await api('/api/admin/layouts','POST',payload);saving.id=r.id;saving.version=r.version;notify('Layout saved, version '+r.version);await refresh();}
 catch(e){notify(e.message,true);}finally{$('save-layout').disabled=false;}
};
$('layout-name').oninput=e=>{if(editing)editing.name=e.target.value;};$('layout-bg').oninput=e=>{editing.background=e.target.value;renderCanvas();};$('layout-orientation').onchange=e=>{editing.orientation=e.target.value;renderCanvas();};
var defaults={channel:{w:800,h:450},html:{w:800,h:450},webpage:{w:800,h:450},text:{w:750,h:150,text:'WELCOME ABOARD',fontSize:78},clock:{w:420,h:130,fontSize:65},image:{w:600,h:360},video:{w:650,h:365},ticker:{w:1100,h:90,text:'Welcome aboard M/S Norröna · Smyril Line',fontSize:36}};
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{if(!editing)editing=freshLayout();var t=b.dataset.add;if(t==='channel'&&!data.channels.length){show('channels');return notify('Create a channel first, then place it in your layout.');}if(t==='video'&&editing.widgets.some(w=>w.type==='video'))return notify('Tizen supports a maximum of one video per layout',true);var w={id:'w'+Math.random().toString(36).slice(2,11),type:t,channel_id:t==='channel'?data.channels[0].id:'',x:130+editing.widgets.length*18,y:120+editing.widgets.length*25,w:defaults[t].w,h:defaults[t].h,z:editing.widgets.length+1,html:t==='html'?'<style>body{background:#123;color:white;display:grid;place-items:center;font:40px Arial}</style><h1>Welcome aboard</h1>':'',text:defaults[t].text||'',src:'',color:'#ffffff',background:'transparent',fontSize:defaults[t].fontSize||48,align:'left',fit:'contain',radius:0,speed:40};editing.widgets.push(w);selected=w.id;renderEditor();});
function renderEditor(){if(!editing)return;$('layout-name').value=editing.name;$('layout-bg').value=editing.background;$('layout-orientation').value=editing.orientation;renderLayers();renderInspector();renderCanvas();}
function renderLayers(){var c=$('layer-list');clear(c);editing.widgets.slice().sort((a,b)=>b.z-a.z).forEach(w=>{var channel=w.type==='channel'&&data.channels.find(c=>c.id===w.channel_id);c.append(el('button',{class:'layer-row '+(selected===w.id?'active':''),onclick:()=>{selected=w.id;renderEditor();}},[el('span',{text:w.type.toUpperCase()}),document.createTextNode((channel&&channel.name||w.text||w.src||w.id).slice(0,17))]));});}
function renderInspector(){var c=$('inspector');clear(c);var w=editing.widgets.find(x=>x.id===selected);if(!w){c.append(el('p',{class:'muted',text:'Choose or add a layer to edit it.'}));return;}
 function field(lbl,key,type='text'){var i=inp(w[key]===undefined?'':w[key],lbl,type);i.oninput=()=>{w[key]=type==='number'?Number(i.value):i.value;renderCanvas();renderLayers();};c.append(labeled(lbl,i));return i;}
 c.append(el('strong',{text:w.type.toUpperCase()+' · LAYER'}));
 if(w.type==='channel'){
  var channel=selectOptions(data.channels,w.channel_id,'Choose channel');channel.onchange=()=>{w.channel_id=channel.value;renderLayers();renderCanvas();};c.append(labeled('Channel in this area',channel));
  c.append(el('p',{class:'muted',text:'Move and resize this area. Its channel bookings choose the content. Canvas shows a snapshot; use Preview for playback.'}),el('button',{class:'secondary',text:'Manage channels',onclick:()=>show('channels')}),el('button',{class:'secondary',text:'+ Channel booking',onclick:()=>programmingUI.bookingModal(null,{scope:'channel',target:w.channel_id})}));
 }else if(data.programmingAvailable)c.append(el('button',{class:'secondary',text:'Save as reusable content',onclick:()=>programmingUI.contentModal(null,w)}));
 if(w.type==='html'){
  var code=el('textarea',{'aria-label':'HTML / CSS / JavaScript code',rows:'12',spellcheck:'false'});code.value=w.html||'';
  var size=el('p',{class:'muted','aria-live':'polite'});
  function codeSize(){var bytes=new TextEncoder().encode(code.value).byteLength;size.textContent=(bytes/1024).toFixed(1)+' / 512 KiB';size.classList.toggle('error',bytes>512*1024);}
  code.oninput=()=>{w.html=code.value;codeSize();};codeSize();c.append(labeled('HTML / CSS / JavaScript code',code),size);
  var network=el('input',{type:'checkbox','aria-label':'Allow external HTTPS resources'});network.checked=w.htmlNetwork===true;network.onchange=()=>{w.htmlNetwork=network.checked;renderCanvas();renderInspector();};c.append(el('label',{class:'checkline'},[network,' Allow external HTTPS resources']));
  if(core.widgetNetworkHint(w))c.append(el('p',{class:'hint',text:core.widgetNetworkHint(w)}));
  c.append(el('p',{class:'muted',text:'HTML limit: 512 KiB; layout request: 1 MiB. Enable external HTTPS resources for libraries, fonts and live APIs. Network access requires connectivity and the API’s CORS permission. PHP needs a hosted server.'}));
  c.append(el('button',{class:'secondary',text:'Update code preview',onclick:()=>renderCanvas()}));
 }
 if(w.type==='webpage'){field('Hosted HTTPS page URL','src');c.append(el('p',{class:'muted',text:'For hosted HTML/PHP pages. Requires network; the site must allow iframe embedding.'}));}
 ['lineHeight','letterSpacing','opacity','radius','speed'].forEach(key=>{if(w[key]==null)w[key]=core.normalizeWidget(w,editing.orientation)[key];});
 if(['text','ticker'].includes(w.type)){
  var text=el('textarea',{'aria-label':'Text',rows:'4'});text.value=w.text||'';text.oninput=()=>{w.text=text.value;renderCanvas();renderLayers();};c.append(labeled('Text',text));
 }
 if(['image','video'].includes(w.type)){
  var src=field('Media URL (HTTPS link or uploaded media)','src');src.placeholder='https://… or /media/…';
  var library=el('select',{'aria-label':'Uploaded media'});library.append(option('','Choose uploaded '+w.type));
  data.media.filter(m=>w.type==='video'?m.mime==='video/mp4':m.mime.startsWith('image/')).forEach(m=>library.append(option('/media/'+m.id,m.filename)));
  library.value=w.src||'';library.onchange=()=>{if(library.value){w.src=library.value;renderCanvas();renderInspector();}};c.append(labeled('Uploaded media',library));
  var owner=editing,upload=el('input',{type:'file','aria-label':'Upload '+w.type,accept:w.type==='video'?'video/mp4':'image/jpeg,image/png,image/webp,image/gif'});
  upload.onchange=async()=>{var file=upload.files[0];if(!file)return;upload.disabled=true;try{
   var media=await uploadFile(file);w.src=media.url;await refresh();if(editing===owner&&selected===w.id){renderCanvas();renderInspector();}notify('Uploaded and assigned '+file.name);
  }catch(e){notify(e.message,true);}finally{upload.disabled=false;upload.value='';}};
  c.append(labeled('Upload '+w.type,upload));c.append(el('p',{class:'muted',text:'Use a link, select library media, or upload here (max 25 MB). Uploaded media can play offline after sync; external links need network.'}));
  var fit=el('select',{},[option('contain','Show whole media'),option('cover','Fill and crop')]);fit.value=w.fit||'contain';fit.onchange=()=>{w.fit=fit.value;renderCanvas();};c.append(labeled('Media scaling',fit));
  c.append(el('button',{class:'secondary',text:'Fill canvas',onclick:()=>{w.x=0;w.y=0;w.w=editing.orientation==='portrait'?1080:1920;w.h=editing.orientation==='portrait'?1920:1080;renderEditor();}}));
 }
 if(['text','ticker','clock'].includes(w.type)){
  var family=el('select',{'aria-label':'Font family'});core.fonts.forEach(f=>family.append(option(f,f)));family.value=w.fontFamily||'Arial';family.onchange=()=>{w.fontFamily=family.value;renderCanvas();};c.append(labeled('Font family',family));
  c.append(el('p',{class:'muted',text:'Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway and Noto Sans are included. Other fonts use the display’s installed fonts.'}));
  ['bold','italic','underline'].forEach(key=>{var check=el('input',{type:'checkbox','aria-label':key[0].toUpperCase()+key.slice(1)});check.checked=!!w[key];check.onchange=()=>{w[key]=check.checked;renderCanvas();};c.append(el('label',{class:'checkline'},[check,' '+key[0].toUpperCase()+key.slice(1)]));});
  field('Font size','fontSize','number');field('Text colour','color','color');
  function choice(label,key,values,def){var control=el('select');values.forEach(v=>control.append(option(v,v[0].toUpperCase()+v.slice(1))));control.value=w[key]||def;control.onchange=()=>{w[key]=control.value;renderCanvas();};c.append(labeled(label,control));}
  choice('Text alignment','align',['left','center','right'],'left');choice('Vertical alignment','verticalAlign',['top','middle','bottom'],'middle');
  field('Line height','lineHeight','number').step='0.05';field('Letter spacing','letterSpacing','number').step='0.5';
 }
 if(w.type==='ticker')field('Scroll speed','speed','number');
 field('Opacity (0–1)','opacity','number').step='0.05';field('Corner radius','radius','number');
 var grid=el('div',{class:'row-fields'});['x','y','w','h','z'].forEach(k=>{var i=inp(w[k],k,'number');i.oninput=()=>{w[k]=Number(i.value);renderCanvas();};grid.append(labeled(k==='w'?'Width':k==='h'?'Height':k.toUpperCase(),i));});c.append(grid);
 var bg=inp(w.background==='transparent'?'#071220':w.background,'','#color');bg.type='color';bg.value=w.background==='transparent'?'#071220':w.background;bg.oninput=()=>{w.background=bg.value;renderCanvas();};c.append(labeled('Background colour (optional)',bg));
 var actions=el('div',{class:'inspector-actions'});actions.append(el('button',{class:'secondary',text:'Duplicate',onclick:()=>{if(w.type==='video')return notify('One video per layout is supported',true);var copy=JSON.parse(JSON.stringify(w));copy.id='w'+Math.random().toString(36).slice(2,11);copy.x=Math.min((copy.x||0)+20,editing.orientation==='portrait'?1060:1900);copy.y=Math.min((copy.y||0)+20,editing.orientation==='portrait'?1900:1060);copy.z=(copy.z||0)+1;editing.widgets.push(copy);selected=copy.id;renderEditor();}}),el('button',{class:'secondary',text:'↓ Backward',onclick:()=>{w.z=Math.max(0,(w.z||0)-1);renderEditor();}}),el('button',{class:'secondary',text:'↑ Forward',onclick:()=>{w.z+=1;renderEditor();}}),el('button',{class:'secondary',text:'Delete',onclick:()=>{editing.widgets=editing.widgets.filter(x=>x.id!==w.id);selected=null;renderEditor();}}));c.append(actions);
}
function renderCanvas(){if(!editing)return;var portrait=editing.orientation==='portrait', W=portrait?1080:1920,H=portrait?1920:1080;var area=$('canvas-stage');var width=Math.max(160,$('canvas-stage').parentElement.clientWidth-36),height=portrait?550:Math.min(540,width*9/16);var scale=Math.min(width/W,height/H);area.style.width=(W*scale)+'px';area.style.height=(H*scale)+'px';var canvas=$('layout-canvas');canvas.style.width=W+'px';canvas.style.height=H+'px';canvas.style.transform='scale('+scale+')';canvas.style.background=editing.background;canvas.style.setProperty('--editor-scale',scale);clear(canvas);
 editing.widgets.slice().sort((a,b)=>a.z-b.z).forEach(w=>{var box=el('div',{class:'canvas-widget '+(selected===w.id?'selected':'')});Object.assign(box.style,{left:w.x+'px',top:w.y+'px',width:w.w+'px',height:w.h+'px',zIndex:String(w.z),color:w.color,background:w.background||'transparent',borderRadius:(w.radius||0)+'px',fontSize:(w.fontSize||48)+'px',textAlign:w.align||'left'});
 Object.assign(box.style,core.widgetStyle(core.normalizeWidget(w,editing.orientation)));
 var visualWidget=w.type==='channel'?core.resolveWidgets({widgets:[w]},data,new Date())[0].widget:w;
 if(w.type==='channel'){var ch=data.channels.find(c=>c.id===w.channel_id);box.append(el('span',{class:'channel-label',text:'CHANNEL · '+(ch?ch.name:'Choose channel')}));Object.assign(box.style,core.widgetStyle(core.normalizeWidget(visualWidget,editing.orientation)),{color:visualWidget.color||'#fff',fontSize:(visualWidget.fontSize||48)+'px'});}
 if(visualWidget.type==='html'||visualWidget.type==='webpage'){box.append(core.webWidget(visualWidget));}else if(visualWidget.type==='text'||visualWidget.type==='ticker')box.append(el('div',{class:'editor-text',text:visualWidget.text||'Your text here'}));else if(visualWidget.type==='clock')box.append(el('div',{class:'editor-text',text:new Date().toISOString().slice(11,16)+' UTC'}));else if(visualWidget.src){var visual=el(visualWidget.type==='video'?'video':'img',{src:visualWidget.src});visual.style.objectFit=visualWidget.fit||'contain';visual.draggable=false;if(visualWidget.type==='video'){visual.muted=true;visual.loop=true;visual.autoplay=false;}box.append(visual);}else if(w.type!=='channel')box.append(el('div',{text:w.type.toUpperCase()+' · Choose media'}));
 var textBox=box.querySelector('.editor-text');if(textBox){textBox.style.alignItems=visualWidget.verticalAlign==='top'?'flex-start':visualWidget.verticalAlign==='bottom'?'flex-end':'center';textBox.style.justifyContent=visualWidget.align==='center'?'center':visualWidget.align==='right'?'flex-end':'flex-start';}
 ['nw','ne','sw','se'].forEach(corner=>{var handle=el('span',{class:'resize-handle resize-'+corner,'data-corner':corner,'aria-label':'Resize '+corner});box.append(handle);});
 box.onpointerdown=ev=>{
  if(ev.button!==0)return;ev.preventDefault();selected=w.id;
  canvas.querySelectorAll('.canvas-widget').forEach(n=>n.classList.toggle('selected',n===box));renderLayers();renderInspector();
  var corner=ev.target.dataset.corner,startX=ev.clientX,startY=ev.clientY;
  var x=Math.max(0,Math.min(W-20,Number(w.x)||0)),y=Math.max(0,Math.min(H-20,Number(w.y)||0));
  var width=Math.max(20,Math.min(W-x,Number(w.w)||400)),height=Math.max(20,Math.min(H-y,Number(w.h)||150));
  var right=x+width,bottom=y+height;
  box.setPointerCapture(ev.pointerId);
  box.onpointermove=e=>{
   var dx=(e.clientX-startX)/scale,dy=(e.clientY-startY)/scale;
   if(corner){
    var left=corner.includes('w')?Math.max(0,Math.min(right-20,x+dx)):x;
    var top=corner.includes('n')?Math.max(0,Math.min(bottom-20,y+dy)):y;
    var r=corner.includes('e')?Math.max(x+20,Math.min(W,right+dx)):right;
    var b=corner.includes('s')?Math.max(y+20,Math.min(H,bottom+dy)):bottom;
    w.x=Math.round(left);w.y=Math.round(top);w.w=Math.round(r-left);w.h=Math.round(b-top);
   }else{w.x=Math.max(0,Math.min(W-width,Math.round(x+dx)));w.y=Math.max(0,Math.min(H-height,Math.round(y+dy)));}
   Object.assign(box.style,{left:w.x+'px',top:w.y+'px',width:w.w+'px',height:w.h+'px'});
  };
  function finish(){box.onpointermove=null;box.onpointerup=null;box.onpointercancel=null;if(box.hasPointerCapture(ev.pointerId))box.releasePointerCapture(ev.pointerId);renderInspector();}
  box.onpointerup=finish;box.onpointercancel=finish;
 };canvas.append(box);});}
window.addEventListener('resize',()=>{if(view==='layouts')renderCanvas();});
// Schedules
function renderSchedules(){var list=$('schedule-list');clear(list);$('schedules-empty').classList.toggle('hidden',data.schedules.length>0);data.schedules.forEach(s=>{var layout=data.layouts.find(x=>x.id===s.layout_id);var card=el('div',{class:'schedule-card'});card.append(el('div',{},[el('h3',{text:s.name}),el('p',{text:[s.scope==='all'?'All screens':s.scope+': '+s.target,layout?layout.name:'Missing layout',s.start_time+'–'+s.end_time+' UTC','Priority '+s.priority].join(' · ')})]),el('div',{},[el('button',{class:'secondary',text:'Edit',onclick:()=>scheduleModal(s)}),' ',el('button',{class:'icon-button',text:'✕',onclick:async()=>{if(!confirm('Delete schedule?'))return;try{await api('/api/admin/schedules?id='+encodeURIComponent(s.id),'DELETE');refresh();}catch(e){notify(e.message,true);}}})]));list.append(card);});}
$('new-schedule').onclick=()=>scheduleModal(null);
function scheduleModal(s){s=s||{id:null,name:'New schedule',scope:'all',target:'*',layout_id:'',start_time:'08:00',end_time:'22:00',days:[0,1,2,3,4,5,6],priority:10,enabled:true,start_utc:null,end_utc:null};var n=inp(s.name),scope=el('select',{},[option('all','All screens'),option('zone','Zone'),option('screen','One display')]);scope.value=s.scope;var target=el('select'),lay=selectOptions(data.layouts,s.layout_id,'Select layout');var start=inp(s.start_time,'HH:MM','time'),end=inp(s.end_time,'HH:MM','time'),priority=inp(s.priority,'Priority','number');var enabled=el('input',{type:'checkbox'});enabled.checked=s.enabled;var days=el('div',{class:'row-fields'});var dayBoxes=[];['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((d,i)=>{var check=el('input',{type:'checkbox'});check.checked=s.days.includes(i);dayBoxes.push(check);days.append(el('label',{class:'checkline'},[check,' '+d]));});function updateTarget(){clear(target);if(scope.value==='zone')Array.from(new Set(data.screens.map(x=>x.zone))).forEach(z=>target.append(option(z,z)));else if(scope.value==='screen')data.screens.forEach(x=>target.append(option(x.id,x.name)));else target.append(option('*','Every display'));if(scope.value===s.scope&&s.scope!=='all'&&s.target&&!Array.from(target.options).some(o=>o.value===s.target))target.append(option(s.target,s.target+' (no current displays)'));target.value=s.target;if(target.selectedIndex===-1)target.selectedIndex=0;}scope.onchange=updateTarget;updateTarget();openModal(s.id?'Edit schedule':'New schedule',el('div',{},[labeled('Name',n),labeled('Scope',scope),labeled('Target',target),labeled('Layout to play',lay),labeled('Start time UTC',start),labeled('End time UTC',end),labeled('Weekdays UTC',days),labeled('Priority (higher overrides lower)',priority),el('label',{class:'checkline'},[enabled,' Enabled'])]),async()=>{await api('/api/admin/schedules','POST',{id:s.id||undefined,name:n.value,scope:scope.value,target:target.value,layout_id:lay.value,start_time:start.value,end_time:end.value,priority:Number(priority.value),days:dayBoxes.map((b,i)=>b.checked?i:null).filter(x=>x!==null),enabled:enabled.checked,start_utc:s.start_utc,end_utc:s.end_utc});notify('Schedule saved');});}
// Media library
async function uploadFile(file){
 if(!file||file.size>25*1024*1024)throw Error('Maximum 25 MB per file');
 if(!['image/jpeg','image/png','image/webp','image/gif','video/mp4'].includes(file.type))throw Error('Use JPG, PNG, WebP, GIF or MP4');
 var r=await fetch('/api/admin/media',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});
 var j=await r.json();if(!r.ok){if(r.status===401)logout();throw Error(j.error||'Upload failed');}return j;
}
function renderMedia(){var list=$('media-grid');clear(list);if(!data.media.length){list.append(el('div',{class:'empty',text:'No media yet. Upload an image or short MP4.'}));return;}data.media.forEach(m=>{var url='/media/'+m.id;var thumb=el('div',{class:'media-thumb'},[m.mime.startsWith('image/')?el('img',{src:url,alt:m.filename}):el('video',{src:url,preload:'metadata'})]);var copy=el('button',{class:'secondary',text:'Copy media URL',onclick:()=>navigator.clipboard.writeText(url).then(()=>notify('Media URL copied'))});list.append(el('div',{class:'media-card'},[thumb,el('div',{class:'media-data'},[el('strong',{text:m.filename}),el('small',{text:(m.size/1024/1024).toFixed(2)+' MB'}),copy])]));});}
$('media-upload').onchange=async e=>{var file=e.target.files[0];if(!file)return;if(file.size>25*1024*1024)return notify('Maximum 25 MB',true);notify('Uploading '+file.name+'…');try{await uploadFile(file);notify('Media uploaded. Select it from Uploaded media in an image or video layer.');await refresh();}catch(e){notify(e.message,true);}e.target.value='';};
})();
