import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';

// Browser-level proof that a failed update cannot replace last-good playback or
// its persisted manifest/ETag, and that a later retry can recover normally.
test('corrupt next media preserves last-good playback and atomic state until a verified retry',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,serviceWorkers:'block'});
 try{
  const page=await context.newPage();
  const screenId='a'.repeat(24),token='b'.repeat(64);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const sha256=createHash('sha256').update(png).digest('hex');
  const corrupted=Buffer.from(png);corrupted[corrupted.length-1]^=1;
  const initialUrl='/media/'+'a'.repeat(32),nextUrl='/media/'+'c'.repeat(32);
  function manifest(text,url){return {schema:1,screen:{id:screenId,name:'Regression display',layout_id:'reception'},layouts:[{id:'reception',orientation:'landscape',widgets:[{id:'text',type:'text',text,x:10,y:10,w:900,h:100},{id:'image',type:'image',src:url,x:10,y:150,w:100,h:100}]}],schedules:[],assets:[{url,sha256,size:png.length,mime:'image/png'}]};}
  let phase='initial',attemptedCorrupt=0,attemptedRecovered=0;
  await context.addInitScript(({id,token})=>localStorage.setItem('signage-device-v1',JSON.stringify({id,token})),{id:screenId,token});
  await context.route('**/api/player/sync',async route=>{
   const initial=phase==='initial';
   await route.fulfill({status:200,headers:{'Content-Type':'application/json','ETag':initial?'"initial"':'"updated"'},body:JSON.stringify(manifest(initial?'Last good content':'Verified update',initial?initialUrl:nextUrl))});
  });
  await context.route('**/media/*',async route=>{
   const isNext=new URL(route.request().url()).pathname===nextUrl;
   if(isNext&&phase==='corrupt')attemptedCorrupt++;
   if(isNext&&phase==='recovered')attemptedRecovered++;
   await route.fulfill({status:200,contentType:'image/png',body:isNext&&phase==='corrupt'?corrupted:png});
  });
  await page.clock.install();await page.goto('/player.html?debug=1');
  await expect(page.locator('#stage')).toContainText('Last good content');
  await expect(page.locator('#stage img')).toHaveJSProperty('naturalWidth',1);
  const saved=await page.evaluate(()=>localStorage.getItem('signage-state-v2'));
  expect(JSON.parse(saved).etag).toBe('"initial"');
  const blobUrl=await page.locator('#stage img').getAttribute('src');

  phase='corrupt';await page.clock.fastForward(65000);
  await expect.poll(()=>attemptedCorrupt).toBe(1);
  await expect(page.locator('#debug-state')).toHaveText('Offline · playing cached content');
  await expect(page.locator('#stage')).toContainText('Last good content');
  await expect(page.locator('#stage img')).toHaveAttribute('src',blobUrl);
  expect(await page.evaluate(()=>localStorage.getItem('signage-state-v2'))).toBe(saved);

  phase='recovered';await page.clock.fastForward(65000);
  await expect.poll(()=>attemptedRecovered).toBe(1);
  await expect(page.locator('#stage')).toContainText('Verified update');
  await expect(page.locator('#stage img')).toHaveJSProperty('naturalWidth',1);
  const updated=JSON.parse(await page.evaluate(()=>localStorage.getItem('signage-state-v2')));
  expect(updated.etag).toBe('"updated"');
  expect(updated.manifest.layouts[0].widgets[0].text).toBe('Verified update');
 }finally{await context.close();}
});
