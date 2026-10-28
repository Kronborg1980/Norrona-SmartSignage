import {test,expect} from '@playwright/test';
const password='local-browser-test-password';
let admin,players,layout,alternate;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function json(request,path,body,token=admin,method='POST'){
 const r=await request.fetch(path,{method,headers:token?{Authorization:'Bearer '+token}:{},data:body});
 expect(r.status(),path).toBe(200);return r.json();
}
function headers(p){return {'X-Player-ID':p.screen_id,'X-Player-Token':p.token};}
async function sync(request,p,etag){return request.post('/api/player/sync',{headers:{...headers(p),...(etag?{'If-None-Match':etag}:{})}});}
async function wave(request,etag=false){
 return Promise.all(players.map(async p=>{
  const start=performance.now(),r=await sync(request,p,etag?p.etag:undefined);
  expect(r.status()).toBe(etag?304:200);
  const payload=etag?null:await r.json();
  if(!etag)p.etag=r.headers().etag;
  return {ms:performance.now()-start,manifest:payload};
 }));
}
test.describe.configure({mode:'serial'});
test.beforeAll(async({request})=>{
 admin=(await json(request,'/api/admin/login',{password},'')).token;
 const upload=await request.post('/api/admin/media',{headers:{Authorization:'Bearer '+admin,'Content-Type':'image/png','X-File-Name':'fleet-test.png'},data:png});expect(upload.status()).toBe(200);
 const media=await upload.json();
 const widgets=[{id:'welcome',type:'text',text:'Fleet Welcome',x:50,y:50,w:900,h:100},{id:'image',type:'image',src:media.url,x:50,y:200,w:200,h:200}];
 layout=(await json(request,'/api/admin/layouts',{name:'Browser Fleet Welcome',widgets})).id;
 alternate=(await json(request,'/api/admin/layouts',{name:'Browser Fleet Alternative',widgets:[{...widgets[0],text:'Fleet Updated'},widgets[1]]})).id;
 players=await Promise.all(Array.from({length:100},async(_,i)=>{
  const pair=await json(request,'/api/player/pair/start',undefined,'');
  await json(request,'/api/admin/pair/claim',{code:pair.code,name:'Virtual '+String(i).padStart(3,'0'),zone:i<50?'Reception':'Restaurant'});
  const r=await request.get('/api/player/pair/status?code='+pair.code);expect(r.status()).toBe(200);
  return r.json();
 }));
});

test('100 concurrent virtual players: assignment, sync, conditional requests and group update',async({request},testInfo)=>{
 const ids=players.map(p=>p.screen_id);
 expect((await json(request,'/api/admin/screens/bulk',{ids,patch:{layout_id:layout}},admin,'PATCH')).updated).toBe(100);
 const first=await wave(request);
 for(let i=0;i<first.length;i++){
  const m=first[i].manifest;expect(m.screen.id).toBe(players[i].screen_id);expect(m.screen.layout_id).toBe(layout);expect(m.assets).toHaveLength(1);expect(m.assets[0].sha256).toMatch(/^[a-f0-9]{64}$/);
 }
 const unchanged=await wave(request,true);
 const changedIds=ids.slice(0,50);
 expect((await json(request,'/api/admin/screens/bulk',{ids:changedIds,patch:{layout_id:alternate}},admin,'PATCH')).updated).toBe(50);
 const updated=await Promise.all(players.map(async(p,i)=>{
  const start=performance.now(),r=await sync(request,p,p.etag);expect(r.status()).toBe(i<50?200:304);
  if(i<50){const m=await r.json();expect(m.screen.layout_id).toBe(alternate);expect(m.layouts[0].widgets[0].text).toBe('Fleet Updated');p.etag=r.headers().etag;}
  return {ms:performance.now()-start};
 }));
 // A new connection without an ETag must receive a complete manifest.
 const reconnect=await wave(request);
 const list=await json(request,'/api/admin/screens',undefined,admin,'GET'),owned=list.items.filter(s=>ids.includes(s.id));expect(owned).toHaveLength(100);expect(owned.every(s=>s.last_seen)).toBe(true);
 const stats=rows=>{const ms=rows.map(x=>x.ms).sort((a,b)=>a-b);return {requests:ms.length,p50_ms:Math.round(ms[49]),p95_ms:Math.round(ms[94]),max_ms:Math.round(ms[99])};};
 const report={runtime:'local Wrangler D1/R2; 100 concurrent HTTP requests per wave; no physical devices',initial:stats(first),unchanged:stats(unchanged),group_update:stats(updated),reconnect:stats(reconnect)};
 console.log('Fleet load results:',JSON.stringify(report));
 await testInfo.attach('fleet-load-results',{body:JSON.stringify(report,null,2),contentType:'application/json'});
});

test('browser fleet filtering, safe selection, bulk edit, pairing and offline playback',async({page,request,browser})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('#password').fill(password);await page.getByRole('button',{name:'Log ind'}).click();
 await page.locator('#nav [data-view=screens]').click();
 await page.locator('#screen-search').fill('Virtual ');
 await expect(page.locator('#screens-body tr')).toHaveCount(100);
 await page.locator('#screen-search').fill('Virtual 00');await expect(page.locator('#screens-body tr')).toHaveCount(10);
 await page.locator('#screen-select-all').check();await expect(page.locator('#screen-count')).toContainText('10 selected');
 await page.locator('#screen-zone').selectOption('Restaurant');await expect(page.locator('#screens-no-match')).toBeVisible();await expect(page.locator('#screen-bulk')).toBeDisabled();
 await page.locator('#screen-search').fill('');await expect(page.locator('#screens-body tr')).toHaveCount(50);
 await page.locator('#screen-select-all').check();await page.locator('#screen-bulk').click();
 await expect(page.locator('#modal-title')).toHaveText('Update 50 selected displays');
 await page.getByRole('combobox',{name:'Action',exact:true}).selectOption('orientation');await page.getByRole('combobox',{name:'New value',exact:true}).selectOption('portrait');await page.locator('#modal-save').click();
 await expect(page.locator('#modal')).toBeHidden();await expect(page.locator('#screens-body tr').first()).toContainText('portrait');
 const list=await json(request,'/api/admin/screens',undefined,admin,'GET');
 expect(list.items.filter(s=>s.zone==='Restaurant').every(s=>s.orientation==='portrait')).toBe(true);
 expect(list.items.filter(s=>s.zone==='Reception').every(s=>s.orientation==='landscape')).toBe(true);
 // Cancelling a destructive bulk action must leave both data and selection intact.
 await page.locator('#screen-select-all').check();await page.locator('#screen-bulk').click();await page.getByRole('combobox',{name:'Action',exact:true}).selectOption('disabled');
 page.once('dialog',d=>d.dismiss());await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeVisible();
 expect((await json(request,'/api/admin/screens',undefined,admin,'GET')).items.every(s=>s.enabled===1)).toBe(true);
 page.once('dialog',d=>d.accept());await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 await page.locator('#screen-status').selectOption('Disabled');await expect(page.locator('#screens-body tr')).toHaveCount(50);
 await page.locator('#screen-select-all').check();await page.locator('#screen-bulk').click();await page.getByRole('combobox',{name:'Action',exact:true}).selectOption('enabled');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();await expect(page.locator('#screens-no-match')).toBeVisible();
 await page.locator('#screen-zone').selectOption('');await page.locator('#screen-status').selectOption('');
 // Separate browser storage gives the actual player its own device identity.
 const playerContext=await browser.newContext();const player=await playerContext.newPage();
 player.on('pageerror',e=>errors.push(e.message));await player.clock.install();await player.goto('/player.html?debug=1');
 await expect(player.locator('#pair-code')).toHaveText(/^[A-F0-9]{12}$/);const code=await player.locator('#pair-code').innerText();
 await page.locator('#pair-open').click();await page.getByLabel('Pairing code',{exact:true}).fill(code);await page.getByLabel('Screen name',{exact:true}).fill('Browser Display');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 await page.locator('#screen-search').fill('Browser Display');await expect(page.locator('#screens-body tr')).toHaveCount(1);
 await page.getByLabel('Layout for Browser Display',{exact:true}).selectOption(layout);
 await player.clock.fastForward(65000);await expect(player.locator('#stage')).toContainText('Fleet Welcome');
 await expect(player.locator('#stage img')).toHaveJSProperty('naturalWidth',1);
 await player.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>player.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await playerContext.setOffline(true);await player.clock.fastForward(65000);await expect(player.locator('#stage')).toContainText('Fleet Welcome');
 await player.reload();await expect(player.locator('#stage')).toContainText('Fleet Welcome');await expect(player.locator('#stage img')).toHaveJSProperty('naturalWidth',1);
 await playerContext.setOffline(false);
 await page.getByLabel('Layout for Browser Display',{exact:true}).selectOption(alternate);
 await player.clock.fastForward(65000);await expect(player.locator('#stage')).toContainText('Fleet Updated');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#screen-search')).toBeVisible();await expect(page.locator('#screen-bulk')).toBeVisible();
 expect(errors).toEqual([]);await playerContext.close();
});
