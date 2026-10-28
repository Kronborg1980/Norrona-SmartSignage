import {programmingSchema} from './programming-schema.js';
const ready=new WeakMap();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{3,50}$/.test(id);
const mapContent=c=>({...c,widget:JSON.parse(c.widget_json),widget_json:undefined});
export const mapBooking=b=>({...b,days:JSON.parse(b.days_json),days_json:undefined,enabled:!!b.enabled});
export async function programmingReady(env) {
 if(!ready.has(env.DB))ready.set(env.DB,(async()=>{
  const rows=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('channels','content','bookings')").all();
  const result=rows.results.length===3;if(!result)ready.delete(env.DB);return result;
 })().catch(e=>{ready.delete(env.DB);throw e;}));
 return ready.get(env.DB);
}
export async function requireProgramming(env) {if(!await programmingReady(env))fail('Activate Channels and Bookings in the backoffice first.',503);}
export async function checkChannelReferences(env,widgets) {
 const ids=[...new Set(widgets.filter(w=>w.type==='channel').map(w=>w.channel_id))];if(!ids.length)return;
 await requireProgramming(env);
 const rows=await env.DB.prepare('SELECT id FROM channels WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all();
 if(rows.results.length!==ids.length)fail('Choose an existing channel for each channel area');
}
export async function checkVideoCapacity(env,changes={}) {
 if(!await programmingReady(env))return;
 const [types,bookRows,layoutRows]=await Promise.all([
  env.DB.prepare("SELECT id,json_extract(widget_json,'$.type') AS type FROM content").all(),
  env.DB.prepare("SELECT id,scope,target,item_type,item_id,enabled FROM bookings WHERE scope='channel'").all(),
  env.DB.prepare("SELECT id,name,widgets_json FROM layouts WHERE EXISTS (SELECT 1 FROM json_each(layouts.widgets_json) w WHERE json_extract(w.value,'$.type')='channel')").all()
 ]);
 const videos=new Set(types.results.filter(c=>c.type==='video').map(c=>c.id));
 if(changes.content){videos.delete(changes.content.id);if(changes.content.widget.type==='video')videos.add(changes.content.id);}
 const bookings=bookRows.results.filter(b=>b.id!==changes.booking?.id);if(changes.booking)bookings.push(changes.booking);
 const videoChannels=new Set(bookings.filter(b=>b.enabled&&b.scope==='channel'&&b.item_type==='content'&&videos.has(b.item_id)).map(b=>b.target));
 const layouts=layoutRows.results.filter(l=>l.id!==changes.layout?.id).map(l=>({...l,widgets:JSON.parse(l.widgets_json)}));if(changes.layout)layouts.push(changes.layout);
 for(const layout of layouts)if(layout.widgets.filter(w=>w.type==='video'||w.type==='channel'&&videoChannels.has(w.channel_id)).length>1)fail('Layout "'+layout.name+'" would have multiple video areas. Keep one possible video area per layout for the current Tizen player.');
}
export async function programmingRoute(req,env,url,{body,response,rand,validateWidgets}) {
 const path=url.pathname,method=req.method;
 if(path==='/api/admin/programming/setup'&&method==='POST'){
  await env.DB.batch(programmingSchema.split(';').map(s=>s.trim()).filter(Boolean).map(s=>env.DB.prepare(s)));
  ready.delete(env.DB);return response({ok:true,available:await programmingReady(env)});
 }
 if(path==='/api/admin/programming'&&method==='GET'){
  if(!await programmingReady(env))return response({available:false,channels:[],content:[],bookings:[]});
  const [channels,content,bookings]=await Promise.all(['SELECT * FROM channels ORDER BY name COLLATE NOCASE','SELECT * FROM content ORDER BY name COLLATE NOCASE','SELECT * FROM bookings ORDER BY priority DESC,position,id'].map(s=>env.DB.prepare(s).all()));
  return response({available:true,channels:channels.results,content:content.results.map(mapContent),bookings:bookings.results.map(mapBooking)});
 }
 await requireProgramming(env);
 if(!['/api/admin/channels','/api/admin/content','/api/admin/bookings'].includes(path))fail('Not found',404);
 const table=path.split('/').pop();
 if(method==='DELETE'){
  const id=url.searchParams.get('id');if(!validId(id))fail('Invalid id');
  if(table==='content'&&await env.DB.prepare("SELECT id FROM bookings WHERE item_type='content' AND item_id=? LIMIT 1").bind(id).first())fail('Content is used by a booking. Remove that booking first.',409);
  if(table==='channels'){
   if(await env.DB.prepare("SELECT id FROM bookings WHERE scope='channel' AND target=? LIMIT 1").bind(id).first())fail('Channel contains bookings. Remove those bookings first.',409);
   if(await env.DB.prepare("SELECT layouts.id FROM layouts,json_each(layouts.widgets_json) w WHERE json_extract(w.value,'$.type')='channel' AND json_extract(w.value,'$.channel_id')=? LIMIT 1").bind(id).first())fail('Channel is used in a layout. Remove that area first.',409);
  }
  await env.DB.prepare('DELETE FROM '+table+' WHERE id=?').bind(id).run();return response({ok:true});
 }
 if(method!=='POST')fail('Method not allowed',405);
 const j=await body(req),id=j.id||rand(12),stamp=new Date().toISOString();
 if(!validId(id))fail('Invalid id');
 const name=typeof j.name==='string'?j.name.trim():'';if(!name||name.length>90)fail('Name must contain 1–90 characters');
 if(table==='channels'){
  await env.DB.prepare("INSERT INTO channels(id,name,description,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,version=channels.version+1,updated_at=excluded.updated_at").bind(id,name,String(j.description||'').slice(0,2000),stamp).run();return response({id});
 }
 if(table==='content'){
  if(!j.widget||j.widget.type==='channel')fail('Choose image, video, text, clock, ticker, HTML or web page content');
  let widget;try{widget=validateWidgets([j.widget])[0];}catch(e){fail(e.message);}
  if(['image','video'].includes(widget.type)&&!widget.src)fail('Choose uploaded media or an HTTPS media URL');
  await checkVideoCapacity(env,{content:{id,widget}});
  await env.DB.prepare('INSERT INTO content(id,name,widget_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,widget_json=excluded.widget_json,version=content.version+1,updated_at=excluded.updated_at').bind(id,name,JSON.stringify(widget),stamp).run();return response({id});
 }
 if(!['channel','screen','zone','all'].includes(j.scope))fail('Choose a channel, screen, zone or all screens');
 const target=j.scope==='all'?'*':typeof j.target==='string'?j.target.trim():'';
 if(!target||target.length>90)fail('Choose a booking target');
 if(j.scope==='channel'&&!await env.DB.prepare('SELECT id FROM channels WHERE id=?').bind(target).first())fail('Channel not found');
 if(j.scope==='screen'&&!await env.DB.prepare('SELECT id FROM screens WHERE id=?').bind(target).first())fail('Screen not found');
 if(!['layout','content'].includes(j.item_type)||j.scope==='channel'&&j.item_type!=='content')fail('Channels accept content bookings; screens also accept whole layouts');
 if(!validId(j.item_id)||!await env.DB.prepare('SELECT id FROM '+(j.item_type==='layout'?'layouts':'content')+' WHERE id=?').bind(j.item_id).first())fail('Booked content or layout not found');
 const date=x=>x==null||x===''?null:typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x?x:fail('Dates must be valid YYYY-MM-DD values');
 const start=date(j.start_date),end=date(j.end_date);if(start&&end&&start>end)fail('End date must follow start date');
 const time=x=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
 if(!time(j.start_time)||!time(j.end_time))fail('Times must be HH:MM UTC');
 if(!Array.isArray(j.days)||!j.days.length||j.days.some(d=>!Number.isInteger(d)||d<0||d>6))fail('Choose valid weekdays');
 const days=[...new Set(j.days)].sort(),duration=Number(j.duration),position=Number(j.position??0),priority=Number(j.priority??10);
 if(!Number.isSafeInteger(duration)||duration<1||duration>Number.MAX_SAFE_INTEGER/1000)fail('Duration must be a positive whole number of seconds');
 if(!Number.isSafeInteger(position)||position<0)fail('Order must be a positive whole number or zero');
 if(!Number.isInteger(priority)||priority<0||priority>1000)fail('Priority must be 0–1000');
 await checkVideoCapacity(env,{booking:{id,scope:j.scope,target,item_type:j.item_type,item_id:j.item_id,enabled:j.enabled!==false}});
 await env.DB.prepare(`INSERT INTO bookings(id,name,scope,target,item_type,item_id,start_date,end_date,days_json,start_time,end_time,duration,position,priority,enabled,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,scope=excluded.scope,target=excluded.target,item_type=excluded.item_type,item_id=excluded.item_id,start_date=excluded.start_date,end_date=excluded.end_date,days_json=excluded.days_json,start_time=excluded.start_time,end_time=excluded.end_time,duration=excluded.duration,position=excluded.position,priority=excluded.priority,enabled=excluded.enabled,updated_at=excluded.updated_at`)
 .bind(id,name,j.scope,target,j.item_type,j.item_id,start,end,JSON.stringify(days),j.start_time,j.end_time,duration,position,priority,j.enabled===false?0:1,stamp).run();return response({id});
}
export async function screenBookings(env,screen) {
 if(!await programmingReady(env))return [];
 return (await env.DB.prepare("SELECT * FROM bookings WHERE enabled=1 AND (scope='all' OR (scope='screen' AND target=?) OR (scope='zone' AND target=?)) ORDER BY id").bind(screen.id,screen.zone).all()).results.map(mapBooking);
}
export async function manifestProgramming(env,layouts,directBookings) {
 const ids=[...new Set(layouts.flatMap(l=>l.widgets.filter(w=>w.type==='channel').map(w=>w.channel_id)))];
 if(!ids.length&&!directBookings.length)return null;
 await requireProgramming(env);
 const channels=(await env.DB.prepare('SELECT * FROM channels WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(JSON.stringify(ids)).all()).results;
 if(channels.length!==ids.length)fail('Referenced channel is unavailable',503);
 const channelBookings=(await env.DB.prepare("SELECT * FROM bookings WHERE enabled=1 AND scope='channel' AND target IN (SELECT value FROM json_each(?)) ORDER BY id").bind(JSON.stringify(ids)).all()).results.map(mapBooking);
 const bookings=[...directBookings,...channelBookings].sort((a,b)=>a.id.localeCompare(b.id));
 const contentIds=[...new Set(bookings.filter(b=>b.item_type==='content').map(b=>b.item_id))];
 const content=(await env.DB.prepare('SELECT * FROM content WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(JSON.stringify(contentIds)).all()).results.map(mapContent);
 if(content.length!==contentIds.length)fail('Booked content is unavailable',503);
 return {channels,bookings,content};
}
