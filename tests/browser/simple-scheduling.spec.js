import {test,expect} from '@playwright/test';
const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:10,position:0,priority:10,enabled:true};
async function setup(page,request,name,orientation='landscape'){
 const {token}=await(await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}})).json();
 const headers={Authorization:'Bearer '+token};
 const post=async(table,data)=>{const r=await request.post('/api/admin/'+table,{headers,data});expect(r.status(),await r.text()).toBe(200);return r.json();};
 const model=async()=>await(await request.get('/api/admin/programming',{headers})).json();
 const pair=await(await request.post('/api/player/pair/start')).json();await post('pair/claim',{code:pair.code,name,orientation});const device=await(await request.get('/api/player/pair/status?code='+pair.code)).json();
 await page.addInitScript(t=>sessionStorage.setItem('signage-admin-token',t),token);await page.goto('/');await expect(page.locator('#plan-target option').filter({hasText:name})).toHaveCount(1);
 return {post,model,headers,device};
}
async function openScreen(page,id){await page.locator('#nav [data-view=plan]').click();await page.locator('#plan-scope').selectOption('screen');await page.locator('#plan-target').selectOption(id);await page.locator('#plan-detail').getByRole('button',{name:'Add content',exact:true}).click();}
async function message(page,text){await page.getByRole('button',{name:'Write a message',exact:true}).click();await page.getByLabel('Your message',{exact:true}).fill(text);await page.locator('#modal-save').click();await expect(page.getByRole('heading',{name:'When should it play?'})).toBeVisible();}
test('a beginner adds a message directly to a screen with no booking or channel decisions',async({page,request})=>{
 const {model,device}=await setup(page,request,'Simple welcome screen');
 await expect(page.locator('#view-plan')).toBeVisible();await expect(page.locator('#nav [data-view=bookings]')).toBeHidden();await expect(page.locator('#nav [data-view=schedules]')).toBeHidden();
 await openScreen(page,device.screen_id);await expect(page.getByRole('heading',{name:'What would you like to show?'})).toBeVisible();
 await page.locator('#modal-save').click();await expect(page.getByRole('alert')).toContainText('Choose saved content');
 const before=await model();await message(page,'A simple welcome aboard');await expect(page.getByLabel('Priority',{exact:true})).toBeHidden();await expect(page.locator('.guide-review')).toContainText('Every day, all day');expect((await model()).bookings.length).toBe(before.bookings.length);
 await page.screenshot({path:'test-results/simple-screen-review.png',fullPage:true});await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 const data=await model(),booking=data.bookings.find(b=>b.name==='A simple welcome aboard');expect(booking).toMatchObject({scope:'screen',target:device.screen_id,start_time:'00:00',end_time:'23:59',days:every.days,priority:10,enabled:true});expect(data.content.find(c=>c.id===booking.item_id).widget.text).toBe('A simple welcome aboard');
 await page.locator('#plan-detail').getByRole('button',{name:'Preview screen',exact:true}).click();await expect(page.frameLocator('#preview-frame').locator('#stage')).toContainText('A simple welcome aboard');
});
test('a beginner builds a playlist and uses it on a portrait screen without opening Studio',async({page,request})=>{
 const {model,device,headers}=await setup(page,request,'Simple portrait screen','portrait');
 await page.locator('#nav [data-view=channels]').click();await page.locator('#new-channel').click();await page.getByLabel('Playlist name',{exact:true}).fill('Simple shared playlist');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 const card=page.locator('#channel-list article').filter({hasText:'Simple shared playlist'});await card.getByRole('button',{name:'Add content',exact:true}).click();await message(page,'First simple playlist message');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 await page.locator('#plan-detail').getByRole('button',{name:'Add content',exact:true}).click();await message(page,'Second simple playlist message');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 let data=await model();const playlist=data.channels.find(c=>c.name==='Simple shared playlist'),items=data.bookings.filter(b=>b.target===playlist.id).sort((a,b)=>a.position-b.position);expect(items.map(b=>b.position)).toEqual([0,1]);
 await page.locator('#plan-detail').getByRole('button',{name:'Use on a screen',exact:true}).click();await page.getByLabel('Screen or playlist',{exact:true}).selectOption(device.screen_id);await page.locator('#modal-save').click();await expect(page.getByLabel('Saved content',{exact:true})).toHaveValue('channel:'+playlist.id);await page.locator('#modal-save').click();await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 data=await model();const booking=data.bookings.find(b=>b.target===device.screen_id);const layouts=await(await request.get('/api/admin/layouts',{headers})).json(),layout=layouts.items.find(l=>l.id===booking.item_id);expect(layout).toMatchObject({orientation:'portrait',widgets:[{type:'channel',channel_id:playlist.id,w:1080,h:1920}]});
 await page.locator('#plan-detail').getByRole('button',{name:'Preview screen',exact:true}).click();await expect(page.frameLocator('#preview-frame').locator('#stage')).toContainText(/First simple playlist message|Second simple playlist message/);
});
test('editing custom playback preserves paused state, overnight days, dates, priority and order',async({page,request})=>{
 const {post,model,device}=await setup(page,request,'Preserve simple schedule screen'),content=await post('content',{name:'Preserved simple content',widget:{type:'text',text:'PRESERVE'}});
 const booking=await post('bookings',{name:'Preserved custom plan',scope:'screen',target:device.screen_id,item_type:'content',item_id:content.id,...every,days:[1,3],start_date:'2020-01-01',end_date:'2099-12-31',start_time:'22:00',end_time:'04:00',priority:77,position:8,enabled:false,duration:17});
 await page.reload();await page.locator('#plan-target').selectOption(device.screen_id);await page.locator('.plan-bookings article').filter({hasText:'Preserved custom plan'}).getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#modal-save').click();
 await expect(page.getByLabel('From (UTC)',{exact:true})).toHaveValue('22:00');await page.getByLabel('Seconds before the next item',{exact:true}).fill('23');await page.getByRole('button',{name:'← Back',exact:true}).click();await page.locator('#modal-save').click();await expect(page.getByLabel('Seconds before the next item',{exact:true})).toHaveValue('23');await expect(page.locator('.guide-review')).toContainText('Paused');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 expect((await model()).bookings.find(b=>b.id===booking.id)).toMatchObject({days:[1,3],start_date:'2020-01-01',end_date:'2099-12-31',start_time:'22:00',end_time:'04:00',priority:77,position:8,enabled:false,duration:23});
});
test('image upload is deferred until confirmation and a failed booking can be retried without duplicate media',async({page,request})=>{
 const {device,model}=await setup(page,request,'Simple upload screen');let uploads=0,items=0,bookings=0;
 page.on('request',r=>{if(r.method()==='POST'){if(r.url().endsWith('/api/admin/media'))uploads++;if(r.url().endsWith('/api/admin/content'))items++;}});
 await page.route('**/api/admin/bookings',async route=>{if(route.request().method()==='POST'&&bookings++===0)await route.fulfill({status:503,json:{error:'Temporary test failure'}});else await route.continue();});
 await openScreen(page,device.screen_id);await page.getByRole('button',{name:'Upload image or video',exact:true}).click();await page.getByLabel('Choose image or video',{exact:true}).setInputFiles({name:'simple-upload.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII=','base64')});await page.locator('#modal-save').click();expect(uploads).toBe(0);expect(items).toBe(0);
 await page.locator('#modal-save').click();await expect(page.locator('#notice')).toContainText('Temporary test failure');await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#modal-save')).toBeEnabled();await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();expect(uploads).toBe(1);expect(items).toBe(1);expect((await model()).bookings.filter(b=>b.target===device.screen_id)).toHaveLength(1);
});
test('the guided designer returns to the same content and cancellation writes nothing',async({page,request})=>{
 const {device,model}=await setup(page,request,'Simple designer screen');const before=await model();await openScreen(page,device.screen_id);await page.getByRole('button',{name:'Write a message',exact:true}).click();await page.getByLabel('Your message',{exact:true}).fill('Unsaved simple message');await page.getByRole('button',{name:'Create a design',exact:true}).click();await page.locator('#booking-design-cancel').click();await expect(page.getByLabel('Your message',{exact:true})).toHaveValue('Unsaved simple message');
 await page.getByRole('button',{name:'Create a design',exact:true}).click();await page.locator('[data-add=text]').click();await page.getByLabel('Text',{exact:true}).fill('Designed through simple guide');await page.locator('#save-layout').click();await expect(page.getByRole('heading',{name:'What would you like to show?'})).toBeVisible();await expect(page.getByLabel('Saved content',{exact:true})).not.toHaveValue('');await page.locator('#modal-save').click();await expect(page.locator('.guide-review')).toContainText('Simple designer screen');await page.locator('#modal-cancel').click();expect((await model()).bookings.length).toBe(before.bookings.length);
});
test('the review stays usable on a narrow phone screen and validates empty day selections',async({page,request})=>{
 const {device}=await setup(page,request,'Simple mobile screen');await page.setViewportSize({width:390,height:844});await openScreen(page,device.screen_id);await message(page,'Hello from a phone');await page.getByRole('button',{name:'Choose days and times',exact:true}).click();
 for(const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])await page.locator('#modal').getByLabel(day,{exact:true}).uncheck();await page.locator('#modal-save').click();await expect(page.getByRole('alert')).toContainText('at least one day');await page.locator('#modal').getByLabel('Mon',{exact:true}).check();await expect(page.getByRole('alert')).toBeHidden();await expect(page.locator('.guide-review')).toContainText('Mon');expect(await page.locator('#modal-content').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);await page.screenshot({path:'test-results/simple-mobile-review.png',fullPage:true});
});
test('a delayed save cannot close a newer guide or change its chosen screen',async({page,request})=>{
 const {device}=await setup(page,request,'Simple delayed screen');let release,started;const gate=new Promise(r=>release=r),start=new Promise(r=>started=r);
 await page.route('**/api/admin/bookings',async route=>{if(route.request().method()==='POST'){started();await gate;}await route.continue();});
 await openScreen(page,device.screen_id);await message(page,'First delayed message');await page.locator('#modal-save').click();await start;await page.locator('#modal-close').click();await page.locator('#plan-detail').getByRole('button',{name:'Add content',exact:true}).click();await page.getByRole('button',{name:'Write a message',exact:true}).click();await page.getByLabel('Your message',{exact:true}).fill('Keep this newer draft');
 release();await expect(page.locator('#notice')).toContainText('Content saved');await expect(page.locator('#modal')).toBeVisible();await expect(page.getByLabel('Your message',{exact:true})).toHaveValue('Keep this newer draft');
});
