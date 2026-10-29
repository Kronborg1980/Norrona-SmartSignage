import {test,expect} from '@playwright/test';
const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:10,position:0,priority:10,enabled:true};
async function setup(page,request){
 const {token}=await(await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}})).json();
 const post=async(table,data)=>{const r=await request.post('/api/admin/'+table,{headers:{Authorization:'Bearer '+token},data});expect(r.status(),await r.text()).toBe(200);return r.json();};
 await page.addInitScript(t=>sessionStorage.setItem('signage-admin-token',t),token);return {post,token};
}
test('one destination workspace creates a channel, designs content and retains the plan through editing',async({page,request})=>{
 const {post,token}=await setup(page,request);
 await page.goto('/');await page.getByRole('button',{name:'Plan what plays'}).click();await page.locator('#plan-scope').selectOption('channel');
 await page.locator('#plan-new-channel').click();await page.getByLabel('Channel name',{exact:true}).fill('Unified planning channel');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 await expect(page.locator('#plan-target option:checked')).toHaveText('Unified planning channel');
 await page.getByRole('button',{name:'+ Add to plan',exact:true}).click();await expect(page.getByLabel('Destination',{exact:true})).toHaveValue('channel');
 await page.getByLabel('Booking name',{exact:true}).fill('Unified welcome');await page.getByLabel('Duration (seconds)',{exact:true}).fill('25');await page.getByRole('button',{name:'Design new content',exact:true}).click();await page.locator('[data-add=text]').click();await page.getByLabel('Text',{exact:true}).fill('WELCOME FROM THE PLAN');await page.locator('#save-layout').click();
 await expect(page.locator('#view-plan')).toBeVisible();await expect(page.getByLabel('Duration (seconds)',{exact:true})).toHaveValue('25');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 const card=page.locator('.plan-bookings article').filter({hasText:'Unified welcome'});await expect(card).toBeVisible();await card.getByRole('button',{name:'Edit booking',exact:true}).click();await expect(page.getByLabel('Duration (seconds)',{exact:true})).toHaveValue('25');await page.locator('#modal-cancel').click();
 await page.getByRole('button',{name:'Preview channel',exact:true}).click();await expect(page.frameLocator('#preview-frame').locator('#stage')).toContainText('WELCOME FROM THE PLAN');await page.getByRole('button',{name:'Close preview',exact:true}).click();
 await page.screenshot({path:'test-results/unified-planning.png',fullPage:true});
 const model=await(await request.get('/api/admin/programming',{headers:{Authorization:'Bearer '+token}})).json();expect(model.bookings.find(b=>b.name==='Unified welcome')).toMatchObject({scope:'channel',duration:25});
});
test('Studio saves and schedules the current design directly on a screen, showing inherited plans and default',async({page,request})=>{
 const {post,token}=await setup(page,request),base=await post('layouts',{name:'Planning default',widgets:[{id:'base',type:'text',text:'DEFAULT'}]});
 // Player provisioning uses the public route, then the normal authenticated claim.
 const pairing=await(await request.post('/api/player/pair/start')).json();await post('pair/claim',{code:pairing.code,name:'Planning destination screen',zone:'Planning zone'});
 const screens=await(await request.get('/api/admin/screens',{headers:{Authorization:'Bearer '+token}})).json(),screen=screens.items.find(s=>s.name==='Planning destination screen');
 await request.patch('/api/admin/screens/bulk',{headers:{Authorization:'Bearer '+token},data:{ids:[screen.id],patch:{layout_id:base.id}}});
 await post('bookings',{name:'Inherited planning announcement',scope:'zone',target:screen.zone,item_type:'layout',item_id:base.id,...every});
 await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await page.locator('#new-layout').click();await page.locator('#layout-name').fill('Scheduled straight from Studio');await page.locator('[data-add=text]').click();await page.getByLabel('Text',{exact:true}).fill('DIRECT DESIGN');await page.locator('#schedule-layout').click();
 await expect(page.getByLabel('Destination',{exact:true})).toHaveValue('screen');await expect(page.getByLabel('Content or layout',{exact:true})).not.toHaveValue('');await page.getByLabel('Target',{exact:true}).selectOption(screen.id);await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();
 await page.locator('#nav [data-view=plan]').click();await page.locator('#plan-target').selectOption(screen.id);
 await expect(page.locator('#plan-detail')).toContainText('Default: Planning default');await expect(page.locator('.plan-bookings')).toContainText('Scheduled straight from Studio');await expect(page.locator('#plan-detail')).toContainText('Inherited planning announcement');
 await page.getByRole('button',{name:'Preview screen',exact:true}).click();await expect(page.frameLocator('#preview-frame').locator('#stage')).toContainText('DIRECT DESIGN');
});
test('Studio edits a channel playlist in place without losing the unsaved layout',async({page,request})=>{
 const {post}=await setup(page,request),channel=await post('channels',{name:'Inline planning channel'}),item=await post('content',{name:'Inline planning text',widget:{type:'text',text:'INLINE PLAYLIST'}});
 await post('bookings',{name:'Inline editable booking',scope:'channel',target:channel.id,item_type:'content',item_id:item.id,...every});
 await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await page.locator('#new-layout').click();await page.locator('#layout-name').fill('Unsaved planning layout');await page.locator('[data-add=channel]').click();await page.getByLabel('Channel in this area',{exact:true}).selectOption(channel.id);
 await page.locator('.inspector-playlist').getByRole('button',{name:'Edit booking',exact:true}).click();await page.getByLabel('Duration (seconds)',{exact:true}).fill('37');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();await expect(page.locator('#layout-name')).toHaveValue('Unsaved planning layout');await expect(page.locator('.inspector-playlist')).toContainText('37 sec');
});
test('adding the first channel in Studio returns to the unsaved design and selects the new channel',async({page,request})=>{
 await setup(page,request);let initial=true;
 await page.route('**/api/admin/programming',async route=>{const response=await route.fetch();const body=await response.json();if(initial){initial=false;body.channels=[];}await route.fulfill({response,json:body});});
 await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await page.locator('#new-layout').click();await page.locator('#layout-name').fill('First channel unsaved design');await page.locator('[data-add=channel]').click();
 await expect(page.locator('#modal-title')).toHaveText('New channel');await page.getByLabel('Channel name',{exact:true}).fill('First channel created in Studio');await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();await expect(page.locator('#view-layouts')).toBeVisible();await expect(page.locator('#layout-name')).toHaveValue('First channel unsaved design');await expect(page.getByLabel('Channel in this area',{exact:true}).locator('option:checked')).toHaveText('First channel created in Studio');
});
