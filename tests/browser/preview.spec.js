import {test,expect} from '@playwright/test';
test('backoffice preview resolves each display schedule without pairing or altering device state',async({page})=>{
 const screens=[{id:'a'.repeat(24),name:'Reception TV',zone:'Lobby',enabled:1,layout_id:'base'}, {id:'b'.repeat(24),name:'Restaurant TV',zone:'Restaurant',enabled:1,layout_id:'base'}];
 const layouts=[{id:'base',name:'Default',orientation:'landscape',widgets:[{id:'hello',type:'text',text:'Default content'}]}, {id:'special',name:'Special',orientation:'portrait',widgets:[{id:'scheduled',type:'text',text:'Lobby scheduled content',y:1700}]}];
 const schedules=[{id:'lobby',scope:'zone',target:'Lobby',layout_id:'special',enabled:true,priority:1,days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59'}];
 let playerRequests=0;await page.route('**/api/player/**',r=>{playerRequests++;return r.abort();});
 await page.route('**/api/admin/**',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({json:path.endsWith('/overview')?{screens:2,online:0,layouts:2,schedules:1}:{items:path.endsWith('/screens')?screens:path.endsWith('/layouts')?layouts:path.endsWith('/schedules')?schedules:[]}});});
 await page.addInitScript(()=>{sessionStorage.setItem('signage-admin-token','mocked');localStorage.setItem('signage-device-v1','existing-device');});
 await page.goto('/');await page.locator('#nav [data-view=screens]').click();
 await page.locator('#screens-body tr').filter({hasText:'Reception TV'}).getByRole('button',{name:'Preview',exact:true}).click();
 const frame=page.frameLocator('#preview-frame');await expect(frame.locator('#stage')).toContainText('Lobby scheduled content');await expect(frame.locator('.widget')).toHaveCSS('top','1700px');
 await expect(page.locator('#screen-preview')).toContainText('not a live screenshot');
 await page.getByRole('button',{name:'Close preview'}).click();
 await page.locator('#screens-body tr').filter({hasText:'Restaurant TV'}).getByRole('button',{name:'Preview',exact:true}).click();await expect(frame.locator('#stage')).toContainText('Default content');
 expect(playerRequests).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('signage-device-v1'))).toBe('existing-device');expect(await page.evaluate(()=>localStorage.getItem('signage-state-v2'))).toBeNull();
});
