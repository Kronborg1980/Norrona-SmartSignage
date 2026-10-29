(function(root){'use strict';
root.createProgrammingUI=function(ctx){
 var data=ctx.data,el=ctx.el,option=ctx.option,labeled=ctx.labeled,inp=ctx.inp,api=ctx.api,core=ctx.core;
 var $=id=>document.getElementById(id),clear=n=>n.replaceChildren(),signature='';
 function button(text,action){return el('button',{class:'secondary',text,onclick:action});}
 async function remove(table,item){if(!confirm('Delete '+item.name+'?'))return;try{await api('/api/admin/'+table+'?id='+encodeURIComponent(item.id),'DELETE');await ctx.refresh();}catch(e){ctx.notify(e.message,true);}}
 function manifest(){return {schema:1,programming:1,screen:{id:'preview',name:'Preview',orientation:'landscape',layout_id:'preview-layout'},layouts:[],schedules:[],assets:[],channels:data.channels,content:data.content,bookings:data.bookings};}
 function previewChannel(channel){ctx.preview('Channel: '+channel.name,()=>{var m=manifest();m.channel_layouts=1;m.screen.layout_id='@channel-preview';m.bookings=m.bookings.filter(b=>b.scope==='channel');m.layouts=data.layouts.concat([{id:'@channel-preview',widgets:[{id:'channel-preview',type:'channel',channel_id:channel.id,x:0,y:0,w:1920,h:1080,z:0}]}]);return m;});}
 function previewContent(item){ctx.preview('Content: '+item.name,()=>{var m=manifest(),current=data.content.find(c=>c.id===item.id)||item;m.bookings=[];m.layouts=[{id:'preview-layout',widgets:[Object.assign({},current.widget,{x:0,y:0,w:1920,h:1080})]}];return m;});}
 function channelModal(item,onSaved){var c=item||{},name=inp(c.name||''),description=el('textarea',{rows:'3'});description.value=c.description||'';
  var generation=ctx.openModal(item?'Edit channel':'New channel',el('div',{},[labeled('Channel name',name),labeled('Description',description),el('p',{class:'muted',text:'Reuse this channel in layout areas. Add content through bookings.'})]),async()=>{var saved=await api('/api/admin/channels','POST',{id:c.id,name:name.value,description:description.value});ctx.notify('Channel saved');if(onSaved){await ctx.refresh();if(ctx.modalCurrent(generation))await onSaved(saved.id);}});
 }
 function contentModal(item,seed,onSaved,onCancel){
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
  var generation=ctx.openModal(item?'Edit content':'New reusable content',el('div',{},[labeled('Content name',name),labeled('Content type',type),fields]),async()=>{var saved=await api('/api/admin/content','POST',{id:content.id,name:name.value,widget});ctx.notify('Content saved');if(onSaved){await ctx.refresh();if(ctx.modalCurrent(generation))onSaved(saved.id);return false;}},onCancel);
 }
 function bookingModal(item,preset){
  var s=Object.assign({name:'New booking',scope:'screen',target:'',item_type:'content',item_id:'',start_date:'',end_date:'',start_time:'00:00',end_time:'23:59',days:[0,1,2,3,4,5,6],priority:10,duration:10,position:0,enabled:true},item||preset||{});
  var name=inp(s.name),scope=el('select'),target=el('select'),itemType=el('select'),itemSelect=el('select');
  [['channel','Channel'],['screen','One screen'],['zone','Zone / group'],['all','All screens']].forEach(([v,n])=>scope.append(option(v,n)));scope.value=s.scope;
  var start=inp(s.start_date||'','','date'),end=inp(s.end_date||'','','date'),from=inp(s.start_time,'','time'),to=inp(s.end_time,'','time'),duration=inp(s.duration,'','number'),priority=inp(s.priority,'','number'),position=inp(s.position,'','number');duration.min='1';duration.step='1';position.min='0';position.step='1';priority.min='0';priority.max='1000';
  var dayBoxes=[],days=el('div',{class:'booking-days'});['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach((day,i)=>{var box=el('input',{type:'checkbox'});box.checked=s.days.includes(i);dayBoxes.push(box);days.append(el('label',{class:'checkline'},[box,day]));});
  var enabled=el('input',{type:'checkbox'});enabled.checked=!!s.enabled;
  function snapshot(){return {id:s.id,name:name.value,scope:scope.value,target:target.value,item_type:itemType.value,item_id:itemSelect.value,start_date:start.value||null,end_date:end.value||null,start_time:from.value,end_time:to.value,days:dayBoxes.map((b,i)=>b.checked?i:null).filter(d=>d!==null),duration:Number(duration.value),position:Number(position.value),priority:Number(priority.value),enabled:enabled.checked};}
  function selectedLayout(){return itemType.value==='layout'&&data.layouts.find(l=>l.id===itemSelect.value);}
  var designNew=button('Design new content',()=>ctx.designBooking(snapshot(),null,true));designNew.className='primary';
  var copyDesign=button('Design from template',()=>{var layout=selectedLayout();if(layout)ctx.designBooking(snapshot(),layout,true);});
  var editDesign=button('Edit selected design',()=>{var layout=selectedLayout();if(layout)ctx.designBooking(snapshot(),layout,false);});
  function editContent(existing){var draft=snapshot();contentModal(existing,null,id=>bookingModal(Object.assign(draft,{item_type:'content',item_id:id})),()=>bookingModal(draft));}
  var createContent=button('+ Media / widget',()=>editContent()),editItem=button('Edit selected item',()=>{var current=data.content.find(c=>c.id===itemSelect.value);if(current)editContent(current);});
  function updateActions(){copyDesign.classList.toggle('hidden',itemType.value!=='layout');editDesign.classList.toggle('hidden',itemType.value!=='layout');copyDesign.disabled=editDesign.disabled=!selectedLayout();editItem.classList.toggle('hidden',itemType.value!=='content');editItem.disabled=!itemSelect.value;}
  function updateItems(){var previous=itemSelect.value;clear(itemSelect);itemSelect.append(option('','Choose '+(itemType.value==='layout'?'template / design':'media / widget')));(itemType.value==='layout'?data.layouts:data.content).forEach(c=>itemSelect.append(option(c.id,c.name)));itemSelect.value=previous||s.item_id;updateActions();}
  function updateScope(){clear(target);var items=scope.value==='channel'?data.channels:scope.value==='screen'?data.screens:scope.value==='zone'?Array.from(new Set(data.screens.map(s=>s.zone))).map(z=>({id:z,name:z})):[{id:'*',name:'Every screen'}];items.forEach(t=>target.append(option(t.id,t.name)));
   if(scope.value===s.scope&&s.target&&!items.some(t=>t.id===s.target))target.append(option(s.target,s.target+' (no current target)'));
   if(scope.value===s.scope)target.value=s.target;if(target.selectedIndex<0)target.selectedIndex=0;
   var previous=itemType.value;clear(itemType);itemType.append(option('content','Media / widget'));itemType.append(option('layout','Template / multi-layer design'));itemType.value=previous||s.item_type;updateItems();
  }
  scope.onchange=updateScope;itemType.onchange=updateItems;itemSelect.onchange=updateActions;updateScope();itemType.value=s.item_type;updateItems();
  var authoring=el('div',{class:'booking-authoring'},[el('strong',{text:'Create or design what plays'}),el('p',{text:'Design with the full Studio: layers, text, fonts, images, videos, HTML, web pages, clocks, tickers and channels. Or add a single media item / widget here.'}),el('div',{class:'card-actions'},[designNew,createContent,copyDesign,editDesign,editItem]),el('small',{text:'Design from template creates a copy. Editing a shared item updates every booking using it.'})]);
  var summary=el('p',{class:'hint booking-summary',role:'status','aria-live':'polite'});
  var form=el('div',{class:'booking-form'},[labeled('Booking name',name),
   el('section',{class:'booking-step'},[el('h3',{text:'1 · Where should it play?'}),el('div',{class:'row-fields'},[labeled('Destination',scope),labeled('Target',target)]),el('p',{class:'muted',text:'Choose a screen for fullscreen playback. A channel is an optional playlist inside a layout area.'})]),
   el('section',{class:'booking-step'},[el('h3',{text:'2 · What should play?'}),labeled('Book',itemType),labeled('Content or layout',itemSelect),authoring]),
   el('section',{class:'booking-step'},[el('h3',{text:'3 · When and in what order?'}),el('p',{class:'muted',text:'Leave dates empty for daily playback. All times are UTC.'}),el('div',{class:'row-fields'},[labeled('Start date UTC (optional)',start),labeled('End date UTC (inclusive, optional)',end),labeled('Start time UTC',from),labeled('End time UTC',to)]),labeled('Weekdays UTC',days),el('div',{class:'row-fields'},[labeled('Duration (seconds)',duration),labeled('Playlist order (0 first)',position)]),labeled('Priority (higher plays first)',priority),el('label',{class:'checkline'},[enabled,' Enabled']),el('p',{class:'muted',text:'Only the highest active priority plays. Equal-priority bookings rotate in order using their durations. Overnight windows belong to their starting date/weekday. Screen bookings override the default layout and legacy schedules during their active window.'})]),summary]);
  function updateSummary(){var place=target.selectedOptions[0],content=itemSelect.selectedOptions[0];summary.textContent=(enabled.checked?'Will play: ':'Paused: ')+(itemSelect.value&&content?content.textContent:'Choose content')+' → '+(place?place.textContent:'Choose a destination')+' · '+from.value+'–'+to.value+' UTC. Saving this booking makes it available to players.';}
  form.addEventListener('change',updateSummary);form.addEventListener('input',updateSummary);updateSummary();
  ctx.openModal(s.id?'Edit booking':'New booking',form,async()=>{
   if(!target.value)throw Error('Choose a destination first. Pair a screen in Screens, or choose All screens to prepare a plan.');
   if(!itemSelect.value)throw Error('Choose content, design new content, or add a media / widget first.');
   await api('/api/admin/bookings','POST',snapshot());ctx.notify('Booking saved');
  });
 }
 // Keep selection in one planning workspace, including across refreshes and authoring.
 function renderPlan(){
  var scope=$('plan-scope').value,select=$('plan-target'),previous=select.value;
  var targets=scope==='screen'?data.screens:scope==='channel'?data.channels:scope==='zone'?Array.from(new Set(data.screens.map(s=>s.zone))).sort().map(z=>({id:z,name:z})):[{id:'*',name:'All screens'}];
  clear(select);targets.forEach(t=>select.append(option(t.id,t.name)));select.value=previous;if(select.selectedIndex<0)select.selectedIndex=0;
  select.disabled=!targets.length;$('plan-new-channel').classList.toggle('hidden',scope!=='channel');$('plan-new-channel').disabled=!data.programmingAvailable;
  var target=select.value,detail=$('plan-detail');clear(detail);
  if(!targets.length){detail.append(el('div',{class:'empty'},[el('h3',{text:scope==='screen'?'Pair a screen to get started':scope==='channel'?'Create a reusable channel':'No zones yet'}),el('p',{text:scope==='screen'?'Pair a display in Screens, or choose All screens to prepare content before pairing.':scope==='channel'?'Channels rotate content inside a layout area. For fullscreen playback, choose a screen instead.':'Create zones by editing a screen in Screens.'}),button(scope==='channel'?'+ New channel':'Manage screens',()=>scope==='channel'?newPlanChannel():ctx.show('screens'))]));return;}
  var destination=targets.find(t=>t.id===target),screen=scope==='screen'&&destination;
  var add=button('+ Add to plan',()=>bookingModal(null,{scope,target,name:'New booking'}));add.className='primary';add.disabled=!data.programmingAvailable;
  var actions=el('div',{class:'card-actions'},[add]);
  if(screen){actions.append(button('Preview screen',()=>ctx.previewScreen(screen)),button('Change default layout',()=>ctx.editScreen(screen)));}
  if(scope==='channel')actions.append(button('Preview channel',()=>previewChannel(destination)));
  detail.append(el('div',{class:'section-toolbar'},[el('div',{},[el('h3',{text:destination.name}),el('p',{text:scope==='channel'?'Reusable playlist · plays only when placed in a layout used by a screen.':'Fullscreen plan · active bookings override layout rules and the default layout.'})]),actions]));
  if(screen){var layout=data.layouts.find(l=>l.id===screen.layout_id);detail.append(el('div',{class:'hint'},[el('strong',{text:'Default: '+(layout?layout.name:'No layout assigned')}),el('p',{text:'Used when no booking or layout rule is active. Preview includes screen, zone and all-screen rules.'})]));}
  if(scope==='channel'){
   var used=data.layouts.filter(l=>(l.widgets||[]).some(w=>w.type==='channel'&&w.channel_id===target));
   detail.append(el('p',{class:'muted',text:used.length?'Placed directly in: '+used.map(l=>l.name).join(', '):'Not placed in a layout yet. In Layout Studio, add a Channel layer and select this channel, then assign or schedule that layout.'}));
  }
  var own=data.bookings.filter(b=>b.scope===scope&&b.target===target).sort((a,b)=>b.priority-a.priority||a.position-b.position||a.id.localeCompare(b.id));
  var list=el('div',{class:'schedule-list plan-bookings'});detail.append(el('h3',{text:'Scheduled here'}),list);
  own.forEach(b=>list.append(planCard(b,false)));
  if(!own.length)list.append(el('div',{class:'empty',text:'Nothing scheduled here yet. Add a design, image, video or widget to this plan.'}));
  if(scope==='screen'||scope==='zone'){
   var inherited=data.bookings.filter(b=>b.scope==='all'||(screen&&b.scope==='zone'&&b.target===screen.zone));
   if(inherited.length){detail.append(el('h3',{text:'Also applies here'}));inherited.forEach(b=>detail.append(planCard(b,true)));}
  }
  var legacy=data.schedules.filter(r=>r.scope==='all'||(r.scope===scope&&r.target===target)||(screen&&r.scope==='zone'&&r.target===screen.zone));
  if(scope!=='channel'&&legacy.length)detail.append(el('div',{class:'hint'},[el('strong',{text:legacy.length+' existing layout rule(s) also apply'}),el('p',{text:'Bookings take precedence while active. Review older rules before adding overlapping plans.'}),button('Review layout rules',()=>ctx.show('schedules'))]));
 }
 function planCard(b,inherited){
  var item=(b.item_type==='layout'?data.layouts:data.content).find(i=>i.id===b.item_id);
  return el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:b.name+(b.enabled?'':' · Paused')}),el('p',{text:(item?item.name:'Missing content')+(inherited?' · From '+(b.scope==='all'?'all screens':b.target):'')}),el('p',{text:(b.start_date||'Any date')+' – '+(b.end_date||'No end date')+' · '+b.days.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')+' · '+b.start_time+'–'+b.end_time+' UTC'}),el('small',{text:b.duration+' sec · order '+b.position+' · priority '+b.priority})]),el('div',{class:'card-actions'},[button('Edit booking',()=>bookingModal(b)),button('Delete booking',()=>remove('bookings',b))])]);
 }
 function newPlanChannel(){if(!data.programmingAvailable)return ctx.notify('Enable channels and bookings first.',true);channelModal(null,id=>{$('plan-scope').value='channel';renderPlan();$('plan-target').value=id;renderPlan();});}
 $('plan-scope').onchange=()=>{$('plan-target').value='';renderPlan();};$('plan-target').onchange=renderPlan;$('plan-new-channel').onclick=newPlanChannel;

 function render(){
  renderPlan();
  var nextSignature=JSON.stringify([data.channels.map(c=>[c.id,c.version]),data.content.map(c=>[c.id,c.version]),data.bookings]);
  if(nextSignature!==signature){signature=nextSignature;ctx.channelsChanged();}
  document.querySelectorAll('.programming-setup').forEach(n=>n.classList.toggle('hidden',data.programmingAvailable));
  ['new-channel','new-content','new-booking'].forEach(id=>$(id).disabled=!data.programmingAvailable);
  var channels=$('channel-list');clear(channels);data.channels.forEach(c=>{var count=data.bookings.filter(b=>b.scope==='channel'&&b.target===c.id).length;channels.append(el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:c.name}),el('p',{text:c.description||'Reusable content stream'}),el('p',{text:count+' bookings'})]),el('div',{class:'card-actions'},[button('Preview',()=>previewChannel(c)),button('+ Booking',()=>bookingModal(null,{scope:'channel',target:c.id})),button('Edit',()=>channelModal(c)),button('Delete',()=>remove('channels',c))])]));});if(data.programmingAvailable&&!data.channels.length)channels.append(el('div',{class:'empty',text:'Create your first channel, then add content bookings and place it in a layout.'}));
  var content=$('content-list');clear(content);data.content.forEach(c=>content.append(el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:c.name}),el('p',{text:c.widget.type.toUpperCase()+' · version '+c.version})]),el('div',{class:'card-actions'},[button('Preview',()=>previewContent(c)),button('Schedule',()=>bookingModal(null,{scope:'screen',item_type:'content',item_id:c.id,name:c.name})),button('Edit',()=>contentModal(c)),button('Delete',()=>remove('content',c))])])));if(data.programmingAvailable&&!data.content.length)content.append(el('div',{class:'empty',text:'Create reusable text, media or HTML widgets here. Add them to channels or screens through Bookings.'}));
  var bookings=$('booking-list'),filter=$('booking-filter').value;clear(bookings);data.bookings.filter(b=>!filter||b.scope===filter).forEach(b=>{
   var target=b.scope==='all'?'All screens':(b.scope==='channel'?data.channels:b.scope==='screen'?data.screens:[]).find(t=>t.id===b.target),item=(b.item_type==='layout'?data.layouts:data.content).find(c=>c.id===b.item_id);
   bookings.append(el('article',{class:'schedule-card'},[el('div',{},[el('h3',{text:b.name+(b.enabled?'':' · Paused')}),el('p',{text:b.scope+': '+(target&&target.name||b.target)+' → '+(item&&item.name||'Missing content')}),el('p',{text:(b.start_date||'Any date')+' – '+(b.end_date||'No end date')+' · '+b.days.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')+' · '+b.start_time+'–'+b.end_time+' UTC'}),el('p',{text:b.duration+' sec · order '+b.position+' · priority '+b.priority})]),el('div',{class:'card-actions'},[button('Edit',()=>bookingModal(b)),button('Delete',()=>remove('bookings',b))])]));
  });if(data.programmingAvailable&&!bookings.children.length)bookings.append(el('div',{class:'empty',text:'No bookings here yet. Book content in a channel or book content / a whole layout directly on a screen.'}));
 }
 $('new-channel').onclick=()=>channelModal();$('new-content').onclick=()=>contentModal();$('new-booking').onclick=()=>bookingModal();$('booking-filter').onchange=render;
 document.querySelectorAll('.programming-activate').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/admin/programming/setup','POST',{});await ctx.refresh();ctx.notify('Channels, Content and Bookings enabled');}catch(e){ctx.notify(e.message,true);}finally{b.disabled=false;}});
 function renderChannelPlan(node,id){var bookings=data.bookings.filter(b=>b.scope==='channel'&&b.target===id);bookings.forEach(b=>node.append(planCard(b,false)));if(!bookings.length)node.append(el('p',{class:'muted',text:'This channel is empty. Add content below to start its playlist.'}));}
 return {render,renderPlan,renderChannelPlan,channelModal,bookingModal,contentModal,previewChannel};
};
})(window);
