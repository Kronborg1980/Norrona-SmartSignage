import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnv,request} from './helpers/env.js';

const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:10,position:0,priority:10,enabled:true};
async function fixture(){
 const {env,close}=makeEnv();
 const token=(await(await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;
 const post=(table,data)=>request(env,'/api/admin/'+table,'POST',data,token);
 const save=async(table,data)=>{const r=await post(table,data);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const channel=id=>save('channels',{id,name:id});
 const layout=(id,widgets=[],extra={})=>save('layouts',{id,name:id,widgets,...extra});
 const book=(id,target,item_id,extra={})=>save('bookings',{id,name:id,scope:'channel',target,item_type:'layout',item_id,...every,...extra});
 const pair=async(layoutId)=>{
  const code=await(await request(env,'/api/player/pair/start','POST')).json();await save('pair/claim',{code:code.code});
  const d=await(await request(env,'/api/player/pair/status?code='+code.code)).json();
  if(layoutId)await request(env,'/api/admin/screens/bulk','PATCH',{ids:[d.screen_id],patch:{layout_id:layoutId}},token);
  return d;
 };
 const sync=(device,caps='channels-v1,channel-layouts-v1',etag='')=>request(env,'/api/player/sync','POST',undefined,'',{'X-Player-ID':device.screen_id,'X-Player-Token':device.token,'X-Player-Capabilities':caps,...(etag?{'If-None-Match':etag}:{})});
 return {env,close,token,post,save,channel,layout,book,pair,sync};
}
const area=(channel_id,extra={})=>({id:'area-'+channel_id,type:'channel',channel_id,x:10,y:20,w:900,h:500,z:1,...extra});

test('channel templates retain every layer type, expand nested future content, verify assets and require the new player capability',async()=>{
 const f=await fixture();try{
  await f.channel('main-channel');await f.channel('nested-channel');await f.channel('unrelated-channel');
  const media=await(await request(f.env,'/api/admin/media','POST',Uint8Array.from([137,80,78,71,13,10,26,10]),f.token,{'Content-Type':'image/png'})).json();
  const html='<h1>Full HTML widget</h1><!--'+'x'.repeat(280000)+'-->';
  const widgets=[{id:'text-layer',type:'text',text:'Styled content',fontFamily:'Inter',bold:true,italic:true},{id:'image-layer',type:'image',src:media.url},{id:'video-layer',type:'video',src:'https://example.test/video.mp4'},{id:'clock-layer',type:'clock'},{id:'ticker-layer',type:'ticker',text:'Ticker'},{id:'html-layer',type:'html',html,htmlNetwork:true},{id:'web-layer',type:'webpage',src:'https://example.test/widget.php'},area('nested-channel')];
  await f.layout('booked-template',widgets,{orientation:'portrait'});await f.layout('outer-template',[area('main-channel')]);
  await f.save('content',{id:'future-content',name:'Future content',widget:{type:'text',text:'Future nested booking'}});
  await f.book('nested-booking','nested-channel','future-content',{item_type:'content',start_date:'2099-01-01'});
  await f.book('main-booking','main-channel','booked-template');
  await f.layout('unrelated-template',[{type:'text',text:'Unrelated content'}]);await f.book('unrelated-booking','unrelated-channel','unrelated-template');
  const device=await f.pair('outer-template');
  assert.equal((await f.sync(device,'channels-v1')).status,409);
  const r=await f.sync(device);assert.equal(r.status,200);const m=await r.clone().json();
  assert.equal(m.programming,1);assert.equal(m.channel_layouts,1);
  assert.deepEqual(m.layouts.map(l=>l.id),['booked-template','outer-template']);assert.deepEqual(m.channels.map(c=>c.id),['main-channel','nested-channel']);
  assert.deepEqual(m.bookings.map(b=>b.id),['main-booking','nested-booking']);assert.deepEqual(m.content.map(c=>c.id),['future-content']);
  const template=m.layouts.find(l=>l.id==='booked-template');assert.equal(template.orientation,'portrait');assert.equal(template.widgets.length,8);assert.equal(template.widgets.find(w=>w.type==='html').html,html);assert.equal(template.widgets.find(w=>w.type==='html').htmlNetwork,true);assert.equal(template.widgets[0].bold,true);assert.equal(template.widgets[0].italic,true);
  assert.equal(m.assets.length,1);assert.equal(m.assets[0].sha256,media.sha256);
  const etag=r.headers.get('ETag');assert.equal((await f.sync(device,undefined,etag)).status,304);
  await f.layout('booked-template',widgets.map(w=>w.type==='text'?{...w,text:'Updated design'}:w));
  const updated=await f.sync(device,undefined,etag);assert.equal(updated.status,200);assert.notEqual(updated.headers.get('ETag'),etag);
  assert.equal((await request(f.env,'/api/admin/layouts?id=booked-template','DELETE',undefined,f.token)).status,409);
 }finally{f.close();}
});

test('self-reference and indirect disabled/future cycles are rejected without replacing valid bookings',async()=>{
 const f=await fixture();try{
  await f.channel('channel-one');await f.channel('channel-two');
  await f.layout('layout-one',[area('channel-one')]);await f.layout('layout-two',[area('channel-two')]);
  const self=await f.post('bookings',{id:'self-booking',name:'Self',scope:'channel',target:'channel-one',item_type:'layout',item_id:'layout-one',...every});assert.equal(self.status,400);assert.match((await self.json()).error,/cycle/);
  await f.book('forward-booking','channel-one','layout-two');
  const loop=await f.post('bookings',{id:'loop-booking',name:'Future disabled loop',scope:'channel',target:'channel-two',item_type:'layout',item_id:'layout-one',...every,enabled:false,start_date:'2099-01-01'});assert.equal(loop.status,400);assert.match((await loop.json()).error,/cycle/);
  const saved=await(await request(f.env,'/api/admin/programming','GET',undefined,f.token)).json();assert.deepEqual(saved.bookings.map(b=>b.id),['forward-booking']);
  // Updating an existing booking is checked against its prospective replacement.
  const replace=await f.post('bookings',{id:'forward-booking',name:'Replace with self',scope:'channel',target:'channel-one',item_type:'layout',item_id:'layout-one',...every});assert.equal(replace.status,400);
  assert.equal((await(await request(f.env,'/api/admin/programming','GET',undefined,f.token)).json()).bookings[0].item_id,'layout-two');
 }finally{f.close();}
});

test('editing a booked layout cannot create a cycle and disabled nested references are checked',async()=>{
 const f=await fixture();try{
  await f.channel('channel-one');await f.layout('plain-layout',[{type:'text',text:'Keep this design'}]);await f.book('disabled-booking','channel-one','plain-layout',{enabled:false,start_date:'2099-01-01'});
  const changed=await f.post('layouts',{id:'plain-layout',name:'Would recurse',widgets:[area('channel-one')]});assert.equal(changed.status,400);assert.match((await changed.json()).error,/cycle/);
  const list=await(await request(f.env,'/api/admin/layouts','GET',undefined,f.token)).json();assert.equal(list.items.find(l=>l.id==='plain-layout').widgets[0].text,'Keep this design');
  // Simulate an externally corrupted reference: write checks fail closed even
  // when the bad edge is disabled and will only become active in the future.
  await f.env.DB.prepare('UPDATE bookings SET item_id=? WHERE id=?').bind('missing-layout','disabled-booking').run();
  assert.equal((await f.post('layouts',{name:'Unrelated write',widgets:[]})).status,400);
  const bad=await f.post('bookings',{id:'other-booking',name:'Other',scope:'channel',target:'channel-one',item_type:'layout',item_id:'plain-layout',...every});assert.equal(bad.status,400);
 }finally{f.close();}
});

test('video capacity follows nested layout bookings, alternatives use a maximum and repeated areas are counted separately',async()=>{
 const f=await fixture();try{
  await f.channel('inner-channel');await f.channel('outer-channel');
  await f.layout('video-one',[{type:'video',src:'https://example.test/one.mp4'}]);await f.layout('video-two',[{type:'video',src:'https://example.test/two.mp4'}]);
  await f.book('alternative-one','inner-channel','video-one');await f.book('alternative-two','inner-channel','video-two');
  await f.layout('middle-layout',[area('inner-channel')]);await f.book('outer-booking','outer-channel','middle-layout');await f.layout('safe-root',[area('outer-channel')]);
  const duplicate=await f.post('layouts',{name:'Repeated channel',widgets:[area('outer-channel'),area('outer-channel',{id:'second-area',x:1000})]});assert.equal(duplicate.status,400);assert.match((await duplicate.json()).error,/multiple video areas/);
  const inline=await f.post('layouts',{name:'Video plus nested channel',widgets:[{type:'video',src:'https://example.test/inline.mp4'},area('outer-channel')]});assert.equal(inline.status,400);
 }finally{f.close();}
});

test('changing a booked design or nested reusable content cannot bypass video capacity',async()=>{
 const f=await fixture();try{
  await f.channel('main-channel');await f.channel('nested-channel');
  await f.save('content',{id:'reusable-content',name:'Text',widget:{type:'text',text:'Keep text'}});
  await f.book('nested-content','nested-channel','reusable-content',{item_type:'content'});
  await f.layout('booked-design',[{type:'text',text:'Keep design'},area('nested-channel')]);await f.book('main-booking','main-channel','booked-design');
  await f.layout('outer-design',[{type:'video',src:'https://example.test/video.mp4'},area('main-channel')]);
  const layoutChange=await f.post('layouts',{id:'booked-design',name:'Video design',widgets:[{type:'video',src:'https://example.test/another.mp4'},area('nested-channel')]});assert.equal(layoutChange.status,400);
  const contentChange=await f.post('content',{id:'reusable-content',name:'Video content',widget:{type:'video',src:'https://example.test/another.mp4'}});assert.equal(contentChange.status,400);
  const data=await(await request(f.env,'/api/admin/programming','GET',undefined,f.token)).json();assert.equal(data.content[0].widget.type,'text');
 }finally{f.close();}
});

test('unrelated or disabled channel templates do not demand a new capability',async()=>{
 const f=await fixture();try{
  await f.channel('main-channel');await f.channel('unrelated-channel');await f.layout('plain-design',[{type:'text',text:'Design'}]);await f.layout('root-design',[area('main-channel')]);
  await f.book('paused-template','main-channel','plain-design',{enabled:false});await f.book('unrelated-template','unrelated-channel','plain-design');
  const device=await f.pair('root-design');const old=await f.sync(device,'channels-v1');assert.equal(old.status,200);assert.equal((await old.json()).channel_layouts,undefined);
  await f.book('paused-template','main-channel','plain-design',{enabled:true});assert.equal((await f.sync(device,'channels-v1')).status,409);
 }finally{f.close();}
});

test('corrupt cycles, missing nested references and unavailable future media reject the complete manifest',async()=>{
 const f=await fixture();try{
  await f.channel('main-channel');await f.layout('booked-design',[{type:'image',src:'/media/'+'a'.repeat(32)}]);await f.layout('root-design',[area('main-channel')]);
  await f.book('main-booking','main-channel','booked-design',{start_date:'2099-01-01'});const device=await f.pair('root-design');
  assert.equal((await f.sync(device)).status,503);
  await f.layout('booked-design',[{type:'text',text:'Valid'}]);const good=await f.sync(device);assert.equal(good.status,200);const etag=good.headers.get('ETag');
  await f.env.DB.prepare('UPDATE bookings SET item_id=? WHERE id=?').bind('root-design','main-booking').run();const loop=await f.sync(device,undefined,etag);assert.equal(loop.status,503);assert.match((await loop.json()).error,/cycle/);
  await f.env.DB.prepare('UPDATE bookings SET item_id=? WHERE id=?').bind('missing-design','main-booking').run();assert.equal((await f.sync(device,undefined,etag)).status,503);
 }finally{f.close();}
});

test('100 concurrent nested-channel clients receive complete deduplicated layouts and assets',async()=>{
 const f=await fixture();try{
  await f.channel('main-channel');await f.channel('nested-channel');
  await f.layout('leaf-design',[{type:'text',text:'Reusable layered design'}]);await f.layout('middle-design',[area('nested-channel')]);await f.layout('root-design',[area('main-channel')]);
  await f.book('main-booking','main-channel','middle-design');await f.book('nested-booking','nested-channel','leaf-design');
  const devices=Array.from({length:100},(_,i)=>({screen_id:i.toString(16).padStart(24,'0'),token:'nested-token-'+i}));
  for(const device of devices){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(device.token)),hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');await f.env.DB.prepare('INSERT INTO screens(id,name,zone,layout_id,device_token_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(device.screen_id,'Nested TV','Lobby','root-design',hash,new Date().toISOString(),new Date().toISOString()).run();}
  const replies=await Promise.all(devices.map(d=>f.sync(d)));for(const r of replies){assert.equal(r.status,200);const m=await r.json();assert.equal(m.channel_layouts,1);assert.deepEqual(m.layouts.map(l=>l.id),['leaf-design','middle-design','root-design']);assert.equal(m.channels.length,2);assert.equal(m.bookings.length,2);assert.equal(m.assets.length,0);}
 }finally{f.close();}
});
