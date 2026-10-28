(function(root){'use strict';
root.createProgrammingUI=function(ctx){
 var data=ctx.data,el=ctx.el,option=ctx.option,labeled=ctx.labeled,inp=ctx.inp,api=ctx.api,core=ctx.core;
 var $=id=>document.getElementById(id),clear=n=>n.replaceChildren(),signature='';
 function button(text,action){return el('button',{class:'secondary',text,onclick:action});}
 async function remove(table,item){if(!confirm('Delete '+item.name+'?'))return;try{await api('/api/admin/'+table+'?id='+encodeURIComponent(item.id),'DELETE');await ctx.refresh();}catch(e){ctx.notify(e.message,true);}}
 function manifest(){return {schema:1,programming:1,screen:{id:'preview',name:'Preview',orientation:'landscape',layout_id:'preview-layout'},layouts:[],schedules:[],assets:[],channels:data.channels,content:data.content,bookings:data.bookings};}
 function previewChannel(channel){ctx.preview('Channel: '+channel.name,()=>{var m=manifest();m.bookings=m.bookings.filter(b=>b.scope==='channel');m.layouts=[{id:'preview-layout',widgets:[{id:'channel-preview',type:'channel',channel_id:channel.id,x:0,y:0,w:1920,h:1080,z:0}]}];return m;});}
 function previewContent(item){ctx.preview('Content: '+item.name,()=>{var m=manifest(),current=data.content.find(c=>c.id===item.id)||item;m.bookings=[];m.layouts=[{id:'preview-layout',widgets:[Object.assign({},current.widget,{x:0,y:0,w:1920,h:1080})]}];return m;});}
 function channelModal(item){var c=item||{},name=inp(c.name||''),description=el('textarea',{rows:'3'});description.value=c.description||'';
  ctx.openModal(item?'Edit channel':'New channel',el('div',{},[labeled('Channel name',name),labeled('Description',description),el('p',{class:'muted',text:'Reuse this channel in layout areas. Add content through bookings.'})]),async()=>{await api('/api/admin/channels','POST',{id:c.id,name:name.value,description:description.value});ctx.notify('Channel saved');});
 }
 function contentModal(item,seed){
  var content=item||{},widget=core.normalizeWidget(JSON.parse(JSON.stringify(content.widget||seed||{type:'text',text:'Welcome aboard',w:1920,h:1080,fontSize:80}))),name=inp(content.name||''),type=el('select'),fields=el('div',{class:'content-fields'});
  ['text','image','video','clock','ticker','html','webpage'].forEach(t=>type.append(option(t,t==='html'?'HTML / CSS / JavaScript':t==='webpage'?'Hosted web page':t[0].toUpperCase()+t.slice(1))));type.value=widget.type;
  function field(label,key,kind='text'){var i=inp(widget[key],label,kind);i.oninput=()=>widget[key]=kind==='number'?Number(i.value):i.value;fields.append(labeled(label,i));return i;}
  function choice(label,key,values){var select=el('select');values.forEach(v=>select.append(option(v,v)));select.value=widget[key];select.onchange=()=>widget[key]=select.value;fields.append(labeled(label,select));}
  function check(label,key){var i=el('input',{type:'checkbox'});i.checked=widget[key]===true;i.onchange=()=>widget[key]=i.checked;fields.append(el('label',{class:'checkline'},[i,' '+label]));}
  function draw(){clear(fields);
   if(['text','ticker','html'].includes(widget.type)){
    var code=widget.type==='html',area=el('textarea',{rows:code?'12':'4',spellcheck:code?'false':'true'}),key=code?'html':'text';area.value=widget[key]||'';area.oninput=()=>{widget[key]=area.value;};fields.append(labeled(code?'HTML / CSS / JavaScript code':'Text',area));
    if(code){check('Allow external HTTPS resources','htmlNetwork');fields.append(el('p',{class:'muted',text:'Up to 512 KiB. JavaScript is isolated. PHP needs a hosted HTTPS page.'}));}
   }
   if(['image','video','webpage'].includes(widget.type))field(widget.type==='webpage'?'Hosted HTTPS page URL':'Media URL (HTTPS or uploaded media)','src');
   if(['image','video'].includes(widget.type)){
    var library=el('select');library.append(option('','Choose uploaded media'));data.media.filter(m=>widget.type==='video'?m.mime==='video/mp4':m.mime.startsWith('image/')).forEach(m=>library.append(option('/media/'+m.id,m.filename)));library.value=widget.src;library.onchange=()=>{if(library.value){widget.src=library.value;draw();}};fields.append(labeled('Uploaded media',library));
    var upload=el('input',{type:'file',accept:widget.type==='video'?'video/mp4':'image/jpeg,image/png,image/webp,image/gif'}),uploadType=widget.type;
    upload.onchange=async()=>{var file=upload.files[0];if(!file)return;upload.disabled=true;try{var saved=await ctx.uploadFile(file);if(widget.type===uploadType)widget.src=saved.url;await ctx.refresh();draw();}catch(e){ctx.notify(e.message,true);}finally{upload.disabled=false;}};fields.append(labeled('Upload '+widget.type,upload));choice('Media scaling','fit',['contain','cover']);
   }
   if(['text','clock','ticker'].includes(widget.type)){
    choice('Font','fontFamily',core.fonts);field('Font size','fontSize','number');field('Text colour','color','color');check('Bold','bold');check('Italic','italic');check('Underline','underline');choice('Text alignment','align',['left','center','right']);choice('Vertical alignment','verticalAlign',['top','middle','bottom']);field('Line height','lineHeight','number').step='0.05';field('Letter spacing','letterSpacing','number').step='0.5';
   }
   if(widget.type==='ticker')field('Scroll speed','speed','number');
   field('Background (CSS hex or transparent)','background');field('Opacity (0–1)','opacity','number').step='0.05';
  }
  type.onchange=()=>{widget=core.normalizeWidget({type:type.value,w:1920,h:1080,fontSize:80,text:'Welcome aboard',html:'<h1>Welcome aboard</h1>'});draw();};draw();
  ctx.openModal(item?'Edit content':'New reusable content',el('div',{},[labeled('Content name',name),labeled('Content type',type),fields]),async()=>{await api('/api/admin/content','POST',{id:content.id,name:name.value,widget});ctx.notify('Content saved');});
 }
 function bookingModal(item,preset){
  var s=item||Object.assign({name:'New booking',scope:'channel',target:'',item_type:'content',item_id:'',start_date:'',end_date:'',start_time:'00:00',end_time:'23:59',days:[0,1,2,3,4,5,6],priority:10,duration:10,position:0,enabled:true},preset||{});
  var name=inp(s.name),scope=el('select'),target=el('select'),itemType=el('select'),itemSelect=el('select');
  [['channel','Channel'],['screen','One screen'],['zone','Zone / group'],['all','All screens']].forEach(([v,n])=>scope.append(option(v,n)));scope.value=s.scope;
  var start=inp(s.start_date||'','','date'),end=inp(s.end_date||'','','date'),from=inp(s.start_time,'','time'),to=inp(s.end_time,'','time'),duration=inp(s.duration,'','number'),priority=inp(s.priority,'','number'),position=inp(s.position,'','number');duration.min='1';duration.step='1';position.min='0';position.step='1';priority.min='0';priority.max='1000';
  var dayBoxes=[],days=el('div',{class:'booking-days'});['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((day,i)=>{var box=el('input',{type:'checkbox'});box.checked=s.days.includes(i);dayBoxes.push(box);days.append(el('label',{class:'checkline'},[box,day]));});
  var enabled=el('input',{type:'checkbox'});enabled.checked=!!s.enabled;
  function updateItems(){var previous=itemSelect.value;clear(itemSelect);itemSelect.append(option('','Choose '+itemType.value));(itemType.value==='layout'?data.layouts:data.content).forEach(c=>itemSelect.append(option(c.id,c.name)));itemSelect.value=previous||s.item_id;}
  function updateScope(){clear(target);var items=scope.value==='channel'?data.channels:scope.value==='screen'?data.screens:scope.value==='zone'?Array.from(new Set(data.screens.map(s=>s.zone))).map(z=>({id:z,name:z})):[{id:'*',name:'Every screen'}];items.forEach(t=>target.append(option(t.id,t.name)));
   if(scope.value===s.scope&&s.target&&!items.some(t=>t.id===s.target))target.append(option(s.target,s.target+' (no current target)'));
   if(scope.value===s.scope)target.value=s.target;if(target.selectedIndex<0)target.selectedIndex=0;
   var previous=itemType.value;clear(itemType);itemType.append(option('content','Content fullscreen / inside area'));if(scope.value!=='channel')itemType.append(option('layout','Whole layout'));itemType.value=scope.value==='channel'?'content':previous||s.item_type;updateItems();
  }
  scope.onchange=updateScope;itemType.onchange=updateItems;updateScope();itemType.value=s.scope==='channel'?'content':s.item_type;updateItems();
  ctx.openModal(item?'Edit booking':'New booking',el('div',{},[labeled('Booking name',name),labeled('Destination',scope),labeled('Target',target),labeled('Book',itemType),labeled('Content or layout',itemSelect),el('div',{class:'row-fields'},[labeled('Start date UTC (optional)',start),labeled('End date UTC (inclusive, optional)',end),labeled('Start time UTC',from),labeled('End time UTC',to)]),labeled('Weekdays UTC',days),el('div',{class:'row-fields'},[labeled('Duration (seconds)',duration),labeled('Playlist order (0 first)',position)]),labeled('Priority (higher plays first)',priority),el('label',{class:'checkline'},[enabled,' Enabled']),el('p',{class:'muted',text:'Only the highest active priority plays. Equal-priority bookings rotate in order using their durations. Overnight windows belong to their starting date/weekday. Screen bookings override the default layout and legacy schedules during their active window.'})]),async()=>{
   await api('/api/admin/bookings','POST',{id:s.id,name:name.value,scope:scope.value,target:target.value,item_type:itemType.value,item_id:itemSelect.value,start_date:start.value||null,end_date:end.value||null,start_time:from.value,end_time:to.value,days:dayBoxes.map((b,i)=>b.checked?i:null).filter(d=>d!==null),duration:Number(duration.value),position:Number(position.value),priority:Number(priority.value),enabled:enabled.checked});ctx.notify('Booking saved');
  });
 }
 function render(){
  var nextSignature=JSON.stringify([data.channels.map(c=>[c.id,c.version]),data.content.map(c=>[c.id,c.version]),data.bookings]);
  if(nextSignature!==signature){signature=nextSignature;ctx.channelsChanged();}
  document.querySelectorAll('.programming-setup').forEach(n=>n.classList.toggle('hidden',data.programmingAvailable));
  ['new-channel','new-content','new-booking'].forEach(id=>$(id).disabled=!data.programmingAvailable);
  var channels=$('channel-list');clear(channels);data.channels.forEach(c=>{var count=data.bookings.filter(b=>b.scope==='channel'&&b.target===c.id).length;channels.append(el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:c.name}),el('p',{text:c.description||'Reusable content stream'}),el('p',{text:count+' bookings'})]),el('div',{class:'card-actions'},[button('Preview',()=>previewChannel(c)),button('+ Booking',()=>bookingModal(null,{scope:'channel',target:c.id})),button('Edit',()=>channelModal(c)),button('Delete',()=>remove('channels',c))])]));});if(data.programmingAvailable&&!data.channels.length)channels.append(el('div',{class:'empty',text:'Create your first channel, then add content bookings and place it in a layout.'}));
  var content=$('content-list');clear(content);data.content.forEach(c=>content.append(el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:c.name}),el('p',{text:c.widget.type.toUpperCase()+' · version '+c.version})]),el('div',{class:'card-actions'},[button('Preview',()=>previewContent(c)),button('Edit',()=>contentModal(c)),button('Delete',()=>remove('content',c))])])));if(data.programmingAvailable&&!data.content.length)content.append(el('div',{class:'empty',text:'Create reusable text, media or HTML widgets here. Add them to channels or screens through Bookings.'}));
  var bookings=$('booking-list'),filter=$('booking-filter').value;clear(bookings);data.bookings.filter(b=>!filter||b.scope===filter).forEach(b=>{
   var target=b.scope==='all'?'All screens':(b.scope==='channel'?data.channels:b.scope==='screen'?data.screens:[]).find(t=>t.id===b.target),item=(b.item_type==='layout'?data.layouts:data.content).find(c=>c.id===b.item_id);
   bookings.append(el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:b.name+(b.enabled?'':' · Paused')}),el('p',{text:b.scope+': '+(target&&target.name||b.target)+' → '+(item&&item.name||'Missing content')}),el('p',{text:(b.start_date||'Any date')+' – '+(b.end_date||'No end date')+' · '+b.days.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')+' · '+b.start_time+'–'+b.end_time+' UTC'}),el('p',{text:b.duration+' sec · order '+b.position+' · priority '+b.priority})]),el('div',{class:'card-actions'},[button('Edit',()=>bookingModal(b)),button('Delete',()=>remove('bookings',b))])]));
  });if(data.programmingAvailable&&!bookings.children.length)bookings.append(el('div',{class:'empty',text:'No bookings here yet. Book content in a channel or book content / a whole layout directly on a screen.'}));
 }
 $('new-channel').onclick=()=>channelModal();$('new-content').onclick=()=>contentModal();$('new-booking').onclick=()=>bookingModal();$('booking-filter').onchange=render;
 document.querySelectorAll('.programming-activate').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/admin/programming/setup','POST',{});await ctx.refresh();ctx.notify('Channels, Content and Bookings enabled');}catch(e){ctx.notify(e.message,true);}finally{b.disabled=false;}});
 return {render,bookingModal,contentModal,previewChannel};
};
})(window);
