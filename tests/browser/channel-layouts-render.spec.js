import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:1,position:0,priority:10,enabled:true};
function fixture(){return {
 schema:1,programming:1,channel_layouts:1,screen:{id:'preview',layout_id:'root'},assets:[],schedules:[],
 layouts:[{id:'root',version:1,widgets:[{id:'outside',type:'html',html:'<h1 id="outside">Outside static widget</h1>',x:0,y:0,w:900,h:100,z:0},
 {id:'left-area',type:'channel',channel_id:'main-channel',x:0,y:120,w:960,h:540,z:1},
 {id:'right-area',type:'channel',channel_id:'main-channel',x:1000,y:120,w:800,h:800,z:2,opacity:.6,radius:12}]},
 {id:'booked',version:2,background:'#123456',orientation:'landscape',widgets:[{id:'inside',type:'html',html:'<h1 id="inside">Inside static widget</h1>',x:0,y:0,w:1000,h:100,z:0},
 {id:'headline',type:'text',text:'Layered booking headline',x:100,y:150,w:1200,h:150,fontSize:100,z:1},
 {id:'inner',type:'channel',channel_id:'inner-channel',x:100,y:400,w:900,h:250,z:2}]}],
 channels:[{id:'main-channel'},{id:'inner-channel'}],content:[{id:'one',version:1,widget:{type:'text',text:'NESTED FIRST'}},{id:'two',version:1,widget:{type:'text',text:'NESTED NEXT'}}],
 bookings:[{id:'layout-booking',scope:'channel',target:'main-channel',item_type:'layout',item_id:'booked',...every},
 {id:'inner-one',scope:'channel',target:'inner-channel',item_type:'content',item_id:'one',...every},
 {id:'inner-two',scope:'channel',target:'inner-channel',item_type:'content',item_id:'two',...every,position:1}]
};}
async function preview(page,manifest){await page.goto('/player.html?preview=1');await page.evaluate(m=>window.postMessage({type:'signage-preview',manifest:m},location.origin),manifest);}
test('reused channel layouts scale and clip locally while nested rotation preserves static iframes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-28T00:00:00Z')});await preview(page,fixture());
 const left=page.locator('[data-widget-id="left-area"][data-booked-layout="booked"]'),right=page.locator('[data-widget-id="right-area"][data-booked-layout="booked"]');
 await expect(left).toBeVisible();await expect(right).toBeVisible();await expect(left.locator('.composition-stage').first()).toHaveCSS('transform','matrix(0.5, 0, 0, 0.5, 0, 0)');
 await expect(left.locator('[data-widget-id="headline"]')).toHaveCSS('left','100px');await expect(left.locator('[data-widget-id="headline"]')).toHaveCSS('font-size','100px');
 await expect(left).toHaveCSS('overflow','hidden');await expect(left.locator('.composition-stage').first()).toHaveCSS('overflow','hidden');await expect(right).toHaveCSS('opacity','0.6');await expect(right).toHaveCSS('border-radius','12px');
 await expect(left).toContainText('NESTED FIRST');await expect(right).toContainText('NESTED FIRST');
 await page.frameLocator('[data-widget-id="outside"] iframe').locator('body').evaluate(body=>body.dataset.sentinel='outside-preserved');
 await left.frameLocator('[data-widget-id="inside"] iframe').locator('body').evaluate(body=>body.dataset.sentinel='inside-preserved');
 await page.clock.fastForward(1100);await expect(left).toContainText('NESTED NEXT');await expect(right).toContainText('NESTED NEXT');
 await expect(page.frameLocator('[data-widget-id="outside"] iframe').locator('body')).toHaveAttribute('data-sentinel','outside-preserved');await expect(left.frameLocator('[data-widget-id="inside"] iframe').locator('body')).toHaveAttribute('data-sentinel','inside-preserved');
 expect(errors).toEqual([]);
});
test('portrait templates keep their logical height inside a landscape channel area',async({page})=>{
 const m=fixture();m.layouts[0].widgets=[{id:'portrait-area',type:'channel',channel_id:'main-channel',x:100,y:100,w:600,h:600,z:0}];m.layouts[1]={id:'booked',version:3,orientation:'portrait',background:'#345678',widgets:[{id:'bottom-label',type:'text',text:'Portrait lower area',x:100,y:1700,w:600,h:150,fontSize:80}]};
 await preview(page,m);const area=page.locator('[data-widget-id="portrait-area"]'),stage=area.locator('.composition-stage');await expect(stage).toHaveCSS('width','1080px');await expect(stage).toHaveCSS('height','1920px');await expect(stage).toHaveCSS('transform','matrix(0.3125, 0, 0, 0.3125, 0, 0)');await expect(stage).toHaveCSS('left','131.25px');await expect(stage).toHaveCSS('top','0px');await expect(area.locator('[data-widget-id="bottom-label"]')).toHaveCSS('top','1700px');await expect(area).toContainText('Portrait lower area');
});
test('a nested channel layout preloads media and resumes its timed content after an offline reload',async({page,request})=>{
 const {token}=await(await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}})).json();
 async function post(table,data){const r=await request.post('/api/admin/'+table,{headers:{Authorization:'Bearer '+token},data});expect(r.status(),await r.text()).toBe(200);return r.json();}
 const main=await post('channels',{name:'Nested offline main'}),inner=await post('channels',{name:'Nested offline inner'});
 const uploaded=await request.post('/api/admin/media',{headers:{Authorization:'Bearer '+token,'Content-Type':'image/png'},data:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=','base64')});expect(uploaded.status()).toBe(200);const media=await uploaded.json();
 const uploadedVideo=await request.post('/api/admin/media',{headers:{Authorization:'Bearer '+token,'Content-Type':'video/mp4'},data:fs.readFileSync(new URL('../fixtures/test-video.mp4',import.meta.url))});expect(uploadedVideo.status()).toBe(200);const video=await uploadedVideo.json();
 const picture=await post('content',{name:'Nested offline image',widget:{type:'image',src:media.url}}),text=await post('content',{name:'Nested offline text',widget:{type:'text',text:'Nested offline playlist'}});
 for(const [i,item] of [picture,text].entries())await post('bookings',{name:'Nested offline slot '+i,scope:'channel',target:inner.id,item_type:'content',item_id:item.id,...every,position:i});
 const design=await post('layouts',{name:'Nested offline design',widgets:[{id:'offline-html',type:'html',html:'<h1 id="offline-static">Composition remains available offline</h1>',x:0,y:0,w:1400,h:150,z:0},{id:'offline-video',type:'video',src:video.url,x:1500,y:0,w:200,h:150,z:1},{id:'offline-inner',type:'channel',channel_id:inner.id,x:100,y:200,w:1400,h:750,z:2}]});
 await post('bookings',{name:'Nested offline layout booking',scope:'channel',target:main.id,item_type:'layout',item_id:design.id,...every});const root=await post('layouts',{name:'Nested offline screen',widgets:[{id:'offline-main',type:'channel',channel_id:main.id,x:0,y:0,w:1920,h:1080,z:0}]});
 const pair=await(await request.post('/api/player/pair/start')).json();await post('pair/claim',{code:pair.code,name:'Nested offline render screen'});const device=await(await request.get('/api/player/pair/status?code='+pair.code)).json();const assigned=await request.patch('/api/admin/screens/bulk',{headers:{Authorization:'Bearer '+token},data:{ids:[device.screen_id],patch:{layout_id:root.id}}});expect(assigned.status()).toBe(200);
 await page.addInitScript(d=>localStorage.setItem('signage-device-v1',JSON.stringify({id:d.screen_id,token:d.token})),device);await page.goto('/player.html');await expect(page.frameLocator('#stage iframe').locator('#offline-static')).toBeVisible();await expect(page.locator('#stage img')).toBeVisible({timeout:10000});await expect.poll(()=>page.locator('#stage img').evaluateAll(images=>images.some(img=>img.src.startsWith('blob:')&&img.complete&&img.naturalWidth===1)),{timeout:10000}).toBe(true);
 await expect(page.locator('#stage video')).toHaveJSProperty('videoWidth',32);await page.locator('#stage video').evaluate(v=>v.dataset.sentinel='video-preserved');await expect(page.locator('#stage')).toContainText('Nested offline playlist',{timeout:10000});await expect(page.locator('#stage video')).toHaveAttribute('data-sentinel','video-preserved');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('signage-state-v2')).manifest);expect(saved.channel_layouts).toBe(1);expect(saved.layouts.some(l=>l.id===design.id)).toBe(true);expect(saved.assets.map(a=>a.url)).toContain(media.url);expect(saved.assets.map(a=>a.url)).toContain(video.url);
 await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await page.context().setOffline(true);await page.reload();await expect(page.frameLocator('#stage iframe').locator('#offline-static')).toBeVisible();await expect(page.locator('#stage')).toContainText('Nested offline playlist',{timeout:10000});await expect.poll(()=>page.locator('#stage img').evaluateAll(images=>images.some(img=>img.src.startsWith('blob:')&&img.complete&&img.naturalWidth===1)),{timeout:10000}).toBe(true);await expect(page.locator('#stage video')).toHaveJSProperty('videoWidth',32);expect(await page.locator('#stage video').evaluate(v=>v.src.startsWith('blob:')&&v.readyState>=2)).toBe(true);
});
