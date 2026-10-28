import {test,expect} from '@playwright/test';

const layout={id:'layout-A',name:'Existing layout',orientation:'landscape',background:'#071220',widgets:[]};
async function openAdmin(page,{screens=[],schedules=[],saveLayout,saveSchedule,onOverview}={}){
 await page.route('**/api/admin/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/admin/layouts'&&req.method()==='POST')return saveLayout(route,req.postDataJSON());
  if(path==='/api/admin/schedules'&&req.method()==='POST')return saveSchedule(route,req.postDataJSON());
  if(path.endsWith('/overview')&&onOverview)onOverview();
  const items=path.endsWith('/screens')?screens:path.endsWith('/layouts')?[layout]:path.endsWith('/schedules')?schedules:[];
  return route.fulfill({json:path.endsWith('/overview')?{screens:screens.length,online:0,layouts:1,schedules:schedules.length}:{items}});
 });
 await page.addInitScript(()=>sessionStorage.setItem('signage-admin-token','test-only-mocked-session'));
 await page.goto('/');await expect(page.locator('#layout-select')).toHaveValue(layout.id);
}

test('a delayed layout save cannot assign its id to a newly opened layout',async({page})=>{
 let release,started;
 const gate=new Promise(resolve=>{release=resolve;}),start=new Promise(resolve=>{started=resolve;});
 const posts=[];
 await openAdmin(page,{saveLayout:async(route,payload)=>{
  posts.push(payload);
  if(posts.length===1){started();await gate;}
  return route.fulfill({json:{id:posts.length===1?layout.id:'new-layout',version:2}});
 }});
 await page.locator('#nav [data-view=layouts]').click();
 await page.locator('#save-layout').click();await start;
 await expect(page.locator('#save-layout')).toBeDisabled();
 await page.locator('#new-layout').click();await expect(page.locator('#layout-name')).toHaveValue('New layout');
 release();await expect(page.locator('#save-layout')).toBeEnabled();
 await expect(page.locator('#layout-select')).toHaveValue('');
 await page.locator('#save-layout').click();await expect.poll(()=>posts.length).toBe(2);
 expect(posts[0].id).toBe(layout.id);expect(posts[1].id).toBeNull();expect(posts[1].name).toBe('New layout');
});

test('editing a schedule retains a target zone with no current displays',async({page})=>{
 let saved;
 const schedule={id:'schedule-1',name:'Reception schedule',scope:'zone',target:'Old Reception',layout_id:layout.id,start_time:'08:00',end_time:'22:00',days:[0,1,2,3,4,5,6],priority:0,enabled:true};
 await openAdmin(page,{screens:[{id:'a'.repeat(24),name:'Screen',zone:'Restaurant',orientation:'landscape',enabled:1}],schedules:[schedule],saveSchedule:async(route,payload)=>{saved=payload;return route.fulfill({json:{id:schedule.id}});}});
 await page.locator('#nav [data-view=schedules]').click();await page.locator('#schedule-list').getByRole('button',{name:'Edit',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Target',exact:true})).toHaveValue(schedule.target);
 await expect(page.getByLabel('Priority (higher overrides lower)',{exact:true})).toHaveValue('0');
 await page.getByLabel('Name',{exact:true}).fill('Renamed schedule');await page.locator('#modal-save').click();
 await expect(page.locator('#modal')).toBeHidden();expect(saved.target).toBe(schedule.target);expect(saved.name).toBe('Renamed schedule');expect(saved.priority).toBe(0);
});


test('a completed save cannot close a different modal opened while it was pending',async({page})=>{
 let release,started,overviews=0;
 const gate=new Promise(resolve=>{release=resolve;}),start=new Promise(resolve=>{started=resolve;});
 const schedule={id:'schedule-1',name:'Existing schedule',scope:'all',target:'*',layout_id:layout.id,start_time:'08:00',end_time:'22:00',days:[0,1,2,3,4,5,6],priority:10,enabled:true};
 await openAdmin(page,{schedules:[schedule],onOverview:()=>overviews++,saveSchedule:async(route)=>{started();await gate;return route.fulfill({json:{id:schedule.id}});}});
 await page.locator('#nav [data-view=schedules]').click();await page.locator('#schedule-list').getByRole('button',{name:'Edit',exact:true}).click();
 await page.locator('#modal-save').click();await start;await expect(page.locator('#modal-save')).toBeDisabled();
 await page.locator('#modal-cancel').click();await page.locator('#new-schedule').click();
 await page.getByLabel('Name',{exact:true}).fill('Unsaved new schedule');await expect(page.locator('#modal-save')).toBeEnabled();
 release();await expect.poll(()=>overviews).toBe(2);
 await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#modal-title')).toHaveText('New schedule');
 await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved new schedule');await expect(page.locator('#modal-save')).toBeEnabled();
});
