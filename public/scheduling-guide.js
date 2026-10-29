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
  let step=s.target&&targets(s.scope).some(t=>t.id===s.target)?1:0,source='saved',choice=s.item_id?s.item_type+':'+s.item_id:'',message='',file=null;
  let timing=s.start_date||s.end_date||s.start_time!=='00:00'||s.end_time!=='23:59'||s.days.length!==7?'custom':'always';
  let uploaded=null,created=null,createdKey='',busy=false,body,error;
  function appendPosition(){if(!item&&seed.position==null){const positions=data.bookings.filter(b=>b.scope===s.scope&&b.target===s.target).map(b=>b.position);s.position=positions.length?Math.max(...positions)+1:0;}}
  const orientation=()=>s.scope==='screen'?(data.screens.find(screen=>screen.id===s.target)||{}).orientation||'landscape':'landscape';
  function selected(){
   const [kind,id]=choice.split(':');
   const value=(kind==='layout'?data.layouts:kind==='channel'?data.channels:data.content).find(x=>x.id===id);
   return value?{kind,id,value}:null;
  }
  function contentName(){if(source==='message')return message.trim().slice(0,65);if(source==='upload')return file&&file.name||'';const c=selected();return c?c.value.name:'';}
  function where(){return (targets(s.scope).find(t=>t.id===s.target)||{}).name||'Choose where to play';}
  function fail(text){error.textContent=text;error.classList.remove('hidden');error.focus();return false;}
  function validate(){
   if(!s.target||!targets(s.scope).some(t=>t.id===s.target))return fail('Choose a screen or playlist first.');
   if(step>=1){
    if(source==='saved'&&!selected())return fail('Choose saved content, upload a file, or write a message.');
    if(source==='message'&&!message.trim())return fail('Write the message you want to show.');
    if(source==='upload'&&!file)return fail('Choose an image or MP4 video.');
   }
   if(step===2){
    if(!Number.isSafeInteger(s.duration)||s.duration<1)return fail('Choose a whole number of seconds, at least 1.');
    if(timing==='custom'&&(!s.days.length||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time)))return fail('Choose at least one day and a start and end time.');
    if(timing==='custom'&&s.start_date&&s.end_date&&s.start_date>s.end_date)return fail('The end date must be on or after the start date.');
   }
   return true;
  }
  function timingText(){return timing==='always'?'Every day, all day':s.days.map(d=>dayNames[d]).join(', ')+' · '+s.start_time+'–'+s.end_time+' UTC · '+(s.start_date||'Any start date')+' to '+(s.end_date||'No end date');}
  function review(){return el('div',{class:'guide-review'},[el('strong',{text:'Ready to add'}),el('p',{text:contentName()+' → '+where()}),el('p',{text:timingText()}),el('small',{text:(s.enabled?'Enabled':'Paused')+' · '+s.duration+' seconds per turn. Players receive changes when they next connect.'})]);}
  function show(){
   body=el('div',{class:'scheduling-guide'});
   body.append(el('ol',{class:'guide-progress','aria-label':'Scheduling steps'},['Where','Content','When'].map((name,i)=>el('li',{'aria-current':i===step?'step':'false',class:i===step?'current':'',text:(i+1)+' · '+name}))));
   if(step>0)body.append(el('p',{class:'guide-destination',text:'Playing on: '+where()}));
   error=el('p',{class:'error hidden',role:'alert',tabindex:'-1'});body.append(error);
   const clearError=()=>error.classList.add('hidden');body.addEventListener('input',clearError);body.addEventListener('change',clearError);
   if(step===0){
    body.append(el('h3',{text:'Where should it play?'}));
    const scopeSelect=el('select',{},[['screen','One screen'],['zone','A group of screens'],['all','All screens'],['channel','Inside a shared playlist']].map(([id,name])=>option(id,name)));scopeSelect.value=s.scope;
    const targetSelect=el('select');
    function fill(){targetSelect.replaceChildren(option('','Choose '+(s.scope==='channel'?'a playlist':'a destination')));targets(s.scope).forEach(t=>targetSelect.append(option(t.id,t.name)));targetSelect.value=s.target;}
    scopeSelect.onchange=()=>{s.scope=scopeSelect.value;s.target=s.scope==='all'?'*':'';appendPosition();fill();};targetSelect.onchange=()=>{s.target=targetSelect.value;appendPosition();};fill();
    body.append(labeled('Play on',scopeSelect),labeled('Screen or playlist',targetSelect),el('p',{class:'muted',text:'For normal fullscreen playback, choose a screen. Shared playlists are optional.'}));
   }else if(step===1){
    body.append(el('h3',{text:'What would you like to show?'}));
    const sources=el('div',{class:'guide-choices'});
    [['saved','Choose saved content'],['upload','Upload image or video'],['message','Write a message']].forEach(([id,label])=>{const b=button(label,()=>{source=id;show();});b.setAttribute('aria-pressed',String(source===id));sources.append(b);});body.append(sources);
    if(source==='saved'){
     const select=el('select',{'aria-label':'Saved content'});select.append(option('','Choose content, a design or a playlist'));
     [[data.content,'content','Saved items'],[data.layouts,'layout','Designs'],[data.channels.filter(c=>!(s.scope==='channel'&&s.target===c.id)),'channel','Playlists']].forEach(([items,kind,label])=>{if(!items.length)return;const group=el('optgroup',{label});items.forEach(c=>group.append(option(kind+':'+c.id,c.name)));select.append(group);});
     select.value=choice;select.onchange=()=>{choice=select.value;};body.append(labeled('Saved content',select));
     if(!data.content.length&&!data.layouts.length&&!data.channels.length)body.append(el('p',{class:'muted',text:'No saved content yet. Upload an image or write your first message above.'}));
    }else if(source==='message'){
     const text=el('textarea',{rows:'5',maxlength:'20000',placeholder:'Welcome aboard!'});text.value=message;text.oninput=()=>{message=text.value;};body.append(labeled('Your message',text));
    }else{
     const upload=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,video/mp4'});
     upload.onchange=()=>{file=upload.files[0]||null;uploaded=null;created=null;createdKey='';show();};body.append(labeled('Choose image or video',upload),el('p',{class:'muted',text:file?'Selected: '+file.name:'JPG, PNG, WebP, GIF or MP4 · up to 25 MB. Your file is uploaded when you finish.'}));
    }
    body.append(el('p',{class:'muted',text:'Need several layers, a clock or your own HTML?'}),button('Create a design',()=>{
     ctx.designBooking(Object.assign({},s,{name:s.name||'New content'}),null,true,id=>{if(id){source='saved';choice='layout:'+id;}show();});
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
    const duration=inp(s.duration,'','number');duration.min='1';duration.step='1';duration.oninput=()=>{s.duration=Number(duration.value);};body.append(labeled('Seconds before the next item',duration),el('p',{class:'muted',text:'Items scheduled together take turns. A single item keeps showing.'}));
    const advanced=el('details',{class:'guide-advanced'},[el('summary',{text:'More options'})]);
    [['Name (optional)','name','text'],['Priority','priority','number'],['Order','position','number']].forEach(([label,key,type])=>{const input=inp(s[key],'',type);input.oninput=()=>{s[key]=type==='number'?Number(input.value):input.value;};advanced.append(labeled(label,input));});
    const enabled=el('input',{type:'checkbox'});enabled.checked=!!s.enabled;enabled.onchange=()=>{s.enabled=enabled.checked;};advanced.append(el('label',{class:'checkline'},[enabled,' Enabled']),el('p',{class:'muted',text:'Higher priority takes over lower priority. Editing a shared playlist affects every screen using it.'}));body.append(advanced);
    const summary=el('div');function updateReview(){summary.replaceChildren(review());}body.addEventListener('input',updateReview);body.addEventListener('change',updateReview);updateReview();body.append(summary,el('p',{class:'muted',text:'Other screen or group rules can affect playback. Preview the screen after saving; offline screens may still show older content.'}));
   }
   if(step>0)body.append(button('← Back',()=>{if(!busy){step--;show();}}));
   if(source==='saved'&&(!selected()||selected().kind!=='channel'))body.append(el('details',{class:'guide-advanced'},[el('summary',{text:'More editing tools'}),button('Advanced editor',()=>{
    if(busy)return;
    const draft=Object.assign({},s,{name:s.name||contentName()||'New booking'},selected()?{item_type:selected().kind,item_id:selected().id}:{});
    if(timing==='always')Object.assign(draft,{start_date:null,end_date:null,days:allDays.slice(),start_time:'00:00',end_time:'23:59'});
    ctx.advanced(item?draft:null,item?null:draft);
   })]));
   const generation=ctx.openModal(item?'Edit screen content':'Add content',body,async()=>{
    if(busy||!validate())return false;
    if(step<2){step++;show();return false;}
    busy=true;body.querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=true);
    try{
     const payload=Object.assign({},s,{name:(s.name||contentName()).trim().slice(0,90)});
     if(timing==='always')Object.assign(payload,{start_date:null,end_date:null,days:allDays.slice(),start_time:'00:00',end_time:'23:59'});
     let c=source==='saved'?selected():null,key=source==='message'?'message:'+message:source==='upload'?'upload:'+file.name:choice+':'+orientation();
     if(!c||c.kind==='channel'){
      if(createdKey!==key){
       if(source==='upload'&&!uploaded)uploaded=await ctx.uploadFile(file);
       const widget=source==='message'?{type:'text',text:message.trim(),fontSize:80,align:'center',verticalAlign:'middle',color:'#ffffff',background:'#071220',w:1920,h:1080}:{type:file&&file.type==='video/mp4'?'video':'image',src:uploaded&&uploaded.url,fit:'contain',w:1920,h:1080};
       const layout=c&&c.kind==='channel';
       const result=layout?await api('/api/admin/layouts','POST',{name:(c.value.name+' · Fullscreen').slice(0,90),orientation:orientation(),background:'#071220',widgets:[{id:'playlist',type:'channel',channel_id:c.id,x:0,y:0,w:orientation()==='portrait'?1080:1920,h:orientation()==='portrait'?1920:1080,z:0}]}):await api('/api/admin/content','POST',{name:payload.name,widget});
       created={kind:layout?'layout':'content',id:result.id};createdKey=key;
      }
      c=created;
     }
     payload.item_type=c.kind;payload.item_id=c.id;
     await api('/api/admin/bookings','POST',payload);
     ctx.notify('Content saved. Preview the screen to check playback.');
     if(ctx.modalCurrent(generation))ctx.onSaved(s.scope,s.target);
    }finally{busy=false;body.querySelectorAll('input,select,textarea,button').forEach(control=>control.disabled=false);}
   });
   document.getElementById('modal-save').textContent=step===0?'Next: choose content →':step===1?'Next: choose when →':item?'Save changes':'Add to '+(s.scope==='channel'?'playlist':'screen');
   document.getElementById('modal-content').parentElement.classList.add('guide-card');
   const heading=body.querySelector('h3');heading.tabIndex=-1;heading.focus();
  }
  show();
 }
 return guide;
};
})(window);
