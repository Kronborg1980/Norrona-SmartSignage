/* Everyday scheduling. Existing booking/layout APIs remain the source of truth. */
(function(root){'use strict';
root.createSchedulingGuide=function(ctx){
 const {data,el,option,labeled,inp,api}=ctx;
 const allDays=[0,1,2,3,4,5,6],dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const button=(text,action,primary=false)=>el('button',{class:primary?'primary':'secondary',text,onclick:action});
 function targets(scope){return scope==='screen'?data.screens:scope==='channel'?data.channels:scope==='zone'?[...new Set(data.screens.map(s=>s.zone))].sort().map(name=>({id:name,name})):[{id:'*',name:'All screens'}];}
 function guide(item,preset){
  const seed=item||preset||{},scope=seed.scope||'screen',target=seed.target||'';
  const positions=data.bookings.filter(b=>b.scope===scope&&b.target===target).map(b=>b.position);
  const s=Object.assign({name:'',scope,target,item_type:'content',item_id:'',start_date:null,end_date:null,start_time:'00:00',end_time:'23:59',days:allDays.slice(),priority:10,duration:10,position:positions.length?Math.max(...positions)+1:0,enabled:true},seed);
  let step=s.target&&targets(s.scope).some(t=>t.id===s.target)?1:0,source='saved',choices=s.item_id?[s.item_type+':'+s.item_id]:[],message='',files=[];
  // Several items can be added in one go, except when editing one existing booking.
  const multiple=!item;
  // Where on the destination: '' = fullscreen on the screen itself, otherwise a playlist (channel id) already running there.
  let placement=null,sound=false,durationTouched=!!item,repeat=Number(s.repeat_minutes)||0;
  const videoLength=new Map();
  let timing=s.start_date||s.end_date||s.start_time!=='00:00'||s.end_time!=='23:59'||s.days.length!==7?'custom':'always';
  const uploaded=new Map(),created=new Map(),booked=new Set();let busy=false,body,error;
  function appendPosition(){if(!item&&seed.position==null){const positions=data.bookings.filter(b=>b.scope===s.scope&&b.target===s.target).map(b=>b.position);s.position=positions.length?Math.max(...positions)+1:0;}}
  const orientation=()=>s.scope==='screen'?(data.screens.find(screen=>screen.id===s.target)||{}).orientation||'landscape':'landscape';
  function lookup(key){
   const [kind,id]=key.split(':');
   const value=(kind==='layout'?data.layouts:kind==='channel'?data.channels:data.content).find(x=>x.id===id);
   return value?{kind,id,value,key}:null;
  }
  function selectedAll(){return choices.map(lookup).filter(Boolean).filter(c=>allowed(c.kind,c.id));}
  function selected(){return selectedAll()[0]||null;}
  // Playlists running on this screen/group: booked full layouts or the default layout that contain a playlist area.
  function runningPlaylists(){
   if(s.scope==='channel'||!s.target)return [];
   const layoutIds=data.bookings.filter(b=>b.enabled&&b.scope===s.scope&&b.target===s.target&&b.item_type==='layout').map(b=>b.item_id);
   if(s.scope==='screen'){const screen=data.screens.find(x=>x.id===s.target);if(screen&&screen.layout_id)layoutIds.push(screen.layout_id);}
   const ids=[];layoutIds.forEach(id=>{const layout=data.layouts.find(l=>l.id===id);(layout&&layout.widgets||[]).forEach(w=>{if(w.type==='channel'&&w.channel_id&&!ids.includes(w.channel_id))ids.push(w.channel_id);});});
   return ids.map(id=>data.channels.find(c=>c.id===id)).filter(Boolean);
  }
  function choosePlacement(){
   const running=runningPlaylists();
   if(placement!==null&&placement!==''&&!running.some(c=>c.id===placement))placement=null;
   // Default to the running playlist, so new items take turns inside it instead of interrupting it.
   if(placement===null)placement=!item&&running.length&&!(choices.length===1&&choices[0].startsWith('channel:'))?running[0].id:'';
   if(item)placement='';
   return running;
  }
  const inPlaylist=()=>s.scope==='channel'||!!placement;
  const playlistId=()=>s.scope==='channel'?s.target:placement;
  // Designs are not offered inside playlists, and a playlist cannot contain itself.
  function allowed(kind,id){if(!inPlaylist())return true;if(item&&kind===item.item_type&&id===item.item_id)return true;if(kind==='layout')return false;if(kind==='channel'&&id===playlistId())return false;return true;}
  const canRepeat=()=>!inPlaylist();
  // Bookings that compete with this one for the whole screen.
  function competing(scope,target){
   const zones=scope==='screen'?[(data.screens.find(x=>x.id===target)||{}).zone]:scope==='zone'?[target]:[];
   return data.bookings.filter(b=>b.enabled&&(!item||b.id!==item.id)&&(b.scope==='all'||b.scope===scope&&b.target===target||b.scope==='zone'&&zones.includes(b.target)));
  }
  const takesOver=()=>!inPlaylist()&&(repeat>0||(placement===''&&runningPlaylists().length>0));
  function measureVideo(f){
   if(videoLength.has(f)||!/^video\//.test(f.type)||!root.URL||!URL.createObjectURL)return;
   videoLength.set(f,null);const v=document.createElement('video'),url=URL.createObjectURL(f);v.preload='metadata';
   v.onloadedmetadata=()=>{const secs=Math.ceil(v.duration);URL.revokeObjectURL(url);if(isFinite(secs)&&secs>0){videoLength.set(f,secs);if(!durationTouched&&files.length===1&&files[0]===f){s.duration=secs;if(step===2)show();}}};
   v.onerror=()=>URL.revokeObjectURL(url);v.src=url;
  }
  function itemName(entry){return entry.kind==='message'?entry.text.trim().slice(0,65):entry.kind==='upload'?entry.file.name:entry.value.name;}
  function entries(){
   if(source==='message')return message.trim()?[{kind:'message',text:message,key:'message:'+message}]:[];
   if(source==='upload')return files.map(f=>({kind:'upload',file:f,key:'upload:'+f.name+':'+f.size+':'+f.lastModified}));
   return selectedAll();
  }
  function contentName(){const list=entries();if(!list.length)return '';if(list.length===1)return itemName(list[0]);return list.length+' items: '+list.map(itemName).join(', ').slice(0,120);}
  function where(){
   const base=(targets(s.scope).find(t=>t.id===s.target)||{}).name||'Choose where to play';
   if(step>0&&placement){const c=data.channels.find(x=>x.id===placement);if(c)return base+' › playlist '+c.name;}
   return base;
  }
  function fail(text){error.textContent=text;error.classList.remove('hidden');error.focus();return false;}
  function validate(){
   if(!s.target||!targets(s.scope).some(t=>t.id===s.target))return fail('Choose a screen or playlist first.');
   if(step>=1){
    if(source==='saved'&&!selected())return fail('Choose saved content, upload a file, or write a message.');
    if(source==='message'&&!message.trim())return fail('Write the message you want to show.');
    if(source==='upload'&&!files.length)return fail('Choose an image or MP4 video.');
    if(source==='upload'&&files.some(f=>!/^(image\/(jpeg|png|webp|gif)|video\/mp4)$/.test(f.type)))return fail('Only JPG, PNG, WebP, GIF and MP4 files can be added.');
   }
   if(step===2){
    if(!Number.isSafeInteger(s.duration)||s.duration<1)return fail('Choose a whole number of seconds, at least 1.');
    if(timing==='custom'&&(!s.days.length||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time)))return fail('Choose at least one day and a start and end time.');
    if(timing==='custom'&&s.start_date&&s.end_date&&s.start_date>s.end_date)return fail('The end date must be on or after the start date.');
    if(canRepeat()&&repeat>0&&s.duration>=repeat*60)return fail('It must play for less time than the repeat interval ('+repeat*60+' seconds).');
   }
   return true;
  }
  function timingText(){return timing==='always'?'Every day, all day':s.days.map(d=>dayNames[d]).join(', ')+' · '+s.start_time+'–'+s.end_time+' UTC · '+(s.start_date||'Any start date')+' to '+(s.end_date||'No end date');}
  function review(){return el('div',{class:'guide-review'},[el('strong',{text:'Ready to add'}),el('p',{text:contentName()+' → '+where()}),el('p',{text:timingText()+(canRepeat()&&repeat>0?' · repeats every '+repeat+' min':'')}),...(takesOver()?[el('p',{text:'Takes over the whole screen'+(sound&&source==='upload'&&files.some(f=>f.type==='video/mp4')?' with sound':'')+' while it plays.'})]:[]),el('small',{text:(s.enabled?'Enabled':'Paused')+' · '+s.duration+' seconds per turn'+(entries().length>1?' each':'')+'. Players receive changes when they next connect.'})]);}
  function show(){
   body=el('div',{class:'scheduling-guide'});
   body.append(el('ol',{class:'guide-progress','aria-label':'Scheduling steps'},['Where','Content','When'].map((name,i)=>el('li',{'aria-current':i===step?'step':'false',class:i===step?'current':'',text:(i+1)+' · '+name}))));
   const running=step>0?choosePlacement():[];
   if(step>0)body.append(el('p',{class:'guide-destination',text:'Playing on: '+where()}));
   error=el('p',{class:'error hidden',role:'alert',tabindex:'-1'});body.append(error);
   const clearError=()=>error.classList.add('hidden');body.addEventListener('input',clearError);body.addEventListener('change',clearError);
   if(step===0){
    body.append(el('h3',{text:'Where should it play?'}));
    const scopeSelect=el('select',{},[['screen','One screen'],['zone','A group of screens'],['all','All screens'],['channel','Inside a shared playlist']].map(([id,name])=>option(id,name)));scopeSelect.value=s.scope;
    const targetSelect=el('select');
    function fill(){targetSelect.replaceChildren(option('','Choose '+(s.scope==='channel'?'a playlist':'a destination')));targets(s.scope).forEach(t=>targetSelect.append(option(t.id,t.name)));targetSelect.value=s.target;}
    scopeSelect.onchange=()=>{placement=null;s.scope=scopeSelect.value;s.target=s.scope==='all'?'*':'';appendPosition();fill();};targetSelect.onchange=()=>{placement=null;s.target=targetSelect.value;appendPosition();};fill();
    body.append(labeled('Play on',scopeSelect),labeled('Screen or playlist',targetSelect),el('p',{class:'muted',text:'For normal fullscreen playback, choose a screen. Shared playlists are optional.'}));
   }else if(step===1){
    body.append(el('h3',{text:'What would you like to show?'}));
    if(running.length){
     const places=el('div',{class:'guide-choices guide-placement',role:'group','aria-label':'Where on the screen'});
     running.forEach(c=>{const b=button('In playlist “'+c.name+'”',()=>{placement=c.id;show();});b.setAttribute('aria-pressed',String(placement===c.id));places.append(b);});
     const full=button('Full screen · takes over',()=>{placement='';show();});full.setAttribute('aria-pressed',String(placement===''));places.append(full);
     body.append(el('p',{class:'guide-label',text:'A playlist is already playing here. Where should the new content go?'}),places,
      el('p',{class:'muted',text:placement?'The new content takes its turn inside the playlist, between the items already there.':'The new content takes over the whole screen and the playlist pauses. Under “When” you can repeat it, e.g. every 15 minutes, so the playlist plays in between.'}));
    }
    const sources=el('div',{class:'guide-choices'});
    [['upload','Upload image or video'],['message','Write a message'],['saved','Choose saved content']].forEach(([id,label])=>{const b=button(label,()=>{source=id;show();});b.setAttribute('aria-pressed',String(source===id));sources.append(b);});body.append(sources);
    if(source==='saved'){
     choices=choices.filter(key=>{const c=lookup(key);return c&&allowed(c.kind,c.id);});
     const groups=[[data.content,'content','Saved items'],[data.layouts,'layout','Designs'],[data.channels,'channel','Playlists']].map(([items,kind,label])=>[items.filter(c=>allowed(kind,c.id)),kind,label]).filter(([items])=>items.length);
     const picker=el('fieldset',{class:'saved-picker','aria-label':'Saved content'},[el('legend',{text:multiple?'Saved content · tick one or more':'Saved content'})]);
     groups.forEach(([items,kind,label])=>{
      const list=el('div',{class:'saved-group'},[el('strong',{text:label})]);
      items.forEach(c=>{const key=kind+':'+c.id,input=el('input',{type:multiple?'checkbox':'radio',name:'saved-content',value:key});input.checked=choices.includes(key);
       input.onchange=()=>{if(!multiple)choices=input.checked?[key]:[];else choices=input.checked?[...choices.filter(k=>k!==key),key]:choices.filter(k=>k!==key);};
       list.append(el('label',{class:'checkline'},[input,' '+c.name]));});
      picker.append(list);});
     if(groups.length)body.append(picker);
     else body.append(el('p',{class:'muted',text:'No saved content yet. Upload an image or write your first message above.'}));
     if(multiple&&groups.length)body.append(el('p',{class:'muted',text:'Items you tick are added in that order and take turns.'}));
    }else if(source==='message'){
     const text=el('textarea',{rows:'5',maxlength:'20000',placeholder:'Welcome aboard!'});text.value=message;text.oninput=()=>{message=text.value;};body.append(labeled('Your message',text));
    }else{
     const upload=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,video/mp4'});if(multiple)upload.multiple=true;
     upload.onchange=()=>{files=Array.from(upload.files||[]);files.forEach(measureVideo);show();};
     body.append(labeled(multiple?'Choose images or videos':'Choose image or video',upload));
     if(files.length){const list=el('ul',{class:'upload-list'});files.forEach((f,i)=>list.append(el('li',{},[f.name+' ',el('button',{type:'button',class:'icon-button',text:'✕','aria-label':'Remove '+f.name,onclick:()=>{files=files.filter((_,j)=>j!==i);show();}})])));body.append(el('p',{class:'muted',text:files.length+' file'+(files.length===1?'':'s')+' selected · uploaded when you finish.'}),list);}
     if(files.some(f=>f.type==='video/mp4')){const box=el('input',{type:'checkbox'});box.checked=sound;box.onchange=()=>{sound=box.checked;};body.append(el('label',{class:'checkline'},[box,' Play video with sound']));}
     if(!files.length)body.append(el('p',{class:'muted',text:'JPG, PNG, WebP, GIF or MP4 · up to 25 MB each.'+(multiple?' You can select several files at once.':'')+' Your files are uploaded when you finish.'}));
    }
    // Most people want it on screen now: skip the timing step with sensible defaults.
    const now=button('Show it now, all the time ✓',()=>{if(busy||!validate())return;timing='always';step=2;document.getElementById('modal-save').click();},true);now.classList.add('guide-now');body.append(now);
    if(!inPlaylist())body.append(el('p',{class:'muted',text:'Need several layers, a clock or your own HTML?'}),button('Create a design',()=>{
     ctx.designBooking(Object.assign({},s,{name:s.name||'New content'}),null,true,id=>{if(id){source='saved';choices=['layout:'+id];}show();});
    }));
   }else{
    body.append(el('h3',{text:'When should it play?'}));
    const modes=el('div',{class:'guide-choices'});
    [['always','Every day, all day'],['custom','Choose days and times']].forEach(([id,label])=>{const b=button(label,()=>{timing=id;show();});b.setAttribute('aria-pressed',String(timing===id));modes.append(b);});body.append(modes);
    if(timing==='custom'){
     const fields=el('div',{class:'row-fields'});
     [['First date (optional)','start_date','date'],['Last date (optional)','end_date','date'],['From (UTC)','start_time','time'],['Until (UTC)','end_time','time']].forEach(([label,key,type])=>{const input=inp(s[key]||'','',type);input.oninput=()=>{s[key]=input.value||null;};fields.append(labeled(label,input));});body.append(fields);
     const days=el('div',{class:'booking-days'});dayNames.forEach((name,day)=>{const input=el('input',{type:'checkbox'});input.checked=s.days.includes(day);input.onchange=()=>{s.days=input.checked?[...s.days,day].sort():s.days.filter(d=>d!==day);};days.append(el('label',{class:'checkline'},[input,name]));});body.append(el('fieldset',{class:'guide-days'},[el('legend',{text:'Days of the week (UTC)'}),days]),el('p',{class:'muted',text:'Times are UTC. A time range crossing midnight belongs to its starting day.'}));
    }
    if(canRepeat()){
     const every=el('select',{},[[0,'Don’t repeat'],[5,'Every 5 minutes'],[10,'Every 10 minutes'],[15,'Every 15 minutes'],[20,'Every 20 minutes'],[30,'Every 30 minutes'],[60,'Every hour'],[120,'Every 2 hours']].map(([v,t])=>option(String(v),t)));
     if(![0,5,10,15,20,30,60,120].includes(repeat))every.append(option(String(repeat),'Every '+repeat+' minutes'));
     every.value=String(repeat);every.onchange=()=>{repeat=Number(every.value);show();};
     body.append(labeled('Repeat',every),el('p',{class:'muted',text:repeat?'Plays at the start of every '+repeat+' minutes, counted from the start time (e.g. 10:00, 10:15, 10:30 …), takes over the whole screen, then the normal content continues.':'For e.g. a safety video: choose how often it should interrupt the screen.'}));
    }
    const duration=inp(s.duration,'','number');duration.min='1';duration.step='1';duration.oninput=()=>{durationTouched=true;s.duration=Number(duration.value);};
    const known=source==='upload'&&files.length===1&&videoLength.get(files[0]);
    body.append(labeled(canRepeat()&&repeat?'Seconds it plays each time':'Seconds before the next item',duration),el('p',{class:'muted',text:(known?'The video is '+known+' seconds long. ':'')+(canRepeat()&&repeat?'Set this to the length of the video so it plays to the end.':'Items scheduled together take turns. A single item keeps showing.')}));
    const advanced=el('details',{class:'guide-advanced'},[el('summary',{text:'More options'})]);
    [['Name (optional)','name','text'],['Priority','priority','number'],['Order','position','number']].forEach(([label,key,type])=>{const input=inp(s[key],'',type);input.oninput=()=>{s[key]=type==='number'?Number(input.value):input.value;};advanced.append(labeled(label,input));});
    const enabled=el('input',{type:'checkbox'});enabled.checked=!!s.enabled;enabled.onchange=()=>{s.enabled=enabled.checked;};advanced.append(el('label',{class:'checkline'},[enabled,' Enabled']),el('p',{class:'muted',text:'Higher priority takes over lower priority. Editing a shared playlist affects every screen using it.'}));body.append(advanced);
    const summary=el('div');function updateReview(){summary.replaceChildren(review());}body.addEventListener('input',updateReview);body.addEventListener('change',updateReview);updateReview();body.append(summary,el('p',{class:'muted',text:'Other screen or group rules can affect playback. Preview the screen after saving; offline screens may still show older content.'}));
   }
   if(step>0)body.append(button('← Back',()=>{if(!busy){step--;show();}}));
   if(source==='saved'&&choices.length<=1&&(!selected()||selected().kind!=='channel'))body.append(el('details',{class:'guide-advanced'},[el('summary',{text:'More editing tools'}),button('Advanced editor',()=>{
    if(busy)return;
    const draft=Object.assign({},s,{name:s.name||contentName()||'New booking',repeat_minutes:repeat},selected()?{item_type:selected().kind,item_id:selected().id}:{});
    if(timing==='always')Object.assign(draft,{start_date:null,end_date:null,days:allDays.slice(),start_time:'00:00',end_time:'23:59'});
    ctx.advanced(item?draft:null,item?null:draft);
   })]));
   const generation=ctx.openModal(item?'Edit screen content':'Add content',body,async()=>{
    if(busy||!validate())return false;
    if(step<2){step++;show();return false;}
    busy=true;body.querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=true);
    try{
     const list=entries(),dest=placement?{scope:'channel',target:placement}:{scope:s.scope,target:s.target};
     const base=Object.assign({},s,dest);
     if(timing==='always')Object.assign(base,{start_date:null,end_date:null,days:allDays.slice(),start_time:'00:00',end_time:'23:59'});
     if(!item&&(placement||seed.position==null)){const positions=data.bookings.filter(b=>b.scope===dest.scope&&b.target===dest.target).map(b=>b.position);base.position=positions.length?Math.max(...positions)+1:0;}
     const orient=dest.scope==='screen'?orientation():'landscape';
     base.repeat_minutes=dest.scope==='channel'?0:repeat;
     // Full screen content that should take over gets a priority above everything else on this screen.
     if(dest.scope!=='channel'&&takesOver()){const top=competing(dest.scope,dest.target).reduce((max,b)=>Math.max(max,b.priority),0);if(base.priority<=top)base.priority=Math.min(1000,top+1);}
     for(let i=0;i<list.length;i++){
      const entry=list[i],name=(list.length===1?(s.name||contentName()):(s.name?s.name+' '+(i+1):itemName(entry))).trim().slice(0,90);
      const key=entry.key+'@'+dest.scope+':'+dest.target;
      if(booked.has(key))continue;
      let c=entry.kind==='message'||entry.kind==='upload'?null:entry;
      if(!c||c.kind==='channel'){
       const cacheKey=c?key+':'+orient:entry.key+(sound?':sound':'');
       if(!created.has(cacheKey)){
        if(entry.kind==='upload'&&!uploaded.has(entry.key))uploaded.set(entry.key,await ctx.uploadFile(entry.file));
        const media=uploaded.get(entry.key);
        const widget=entry.kind==='message'?{type:'text',text:entry.text.trim(),fontSize:80,align:'center',verticalAlign:'middle',color:'#ffffff',background:'#071220',w:1920,h:1080}:{type:entry.file&&entry.file.type==='video/mp4'?'video':'image',src:media&&media.url,fit:'contain',w:1920,h:1080,...(sound&&entry.file&&entry.file.type==='video/mp4'?{sound:true}:{})};
        const result=c?await api('/api/admin/layouts','POST',{name:(c.value.name+' · Fullscreen').slice(0,90),orientation:orient,background:'#071220',widgets:[{id:'playlist',type:'channel',channel_id:c.id,x:0,y:0,w:orient==='portrait'?1080:1920,h:orient==='portrait'?1920:1080,z:0}]}):await api('/api/admin/content','POST',{name,widget});
        created.set(cacheKey,{kind:c?'layout':'content',id:result.id});
       }
       c=created.get(cacheKey);
      }
      const payload=Object.assign({},base,{name,item_type:c.kind,item_id:c.id,position:item?base.position:base.position+i});
      await api('/api/admin/bookings','POST',payload);booked.add(key);
     }
     ctx.notify((list.length>1?list.length+' items saved':'Content saved')+'. Preview the screen to check playback.');
     if(ctx.modalCurrent(generation))ctx.onSaved(s.scope,s.target);
    }finally{busy=false;body.querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=false);}
   });
   document.getElementById('modal-save').textContent=step===0?'Next: choose content →':step===1?'Next: choose when →':item?'Save changes':'Add to '+(inPlaylist()?'playlist':'screen');
   document.getElementById('modal-content').parentElement.classList.add('guide-card');
   const heading=body.querySelector('h3');heading.tabIndex=-1;heading.focus();
  }
  show();
 }
 return guide;
};
})(window);
