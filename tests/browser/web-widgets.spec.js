import {test,expect} from '@playwright/test';
test('HTML code works in isolated editor and player preview and hosted PHP uses a sandboxed page',async({page,request,browser})=>{
 const login=await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}});const {token}=await login.json();
 await page.addInitScript(token=>{sessionStorage.setItem('signage-admin-token',token);localStorage.setItem('private-test','secret');},token);
 await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await page.locator('#new-layout').click();await page.locator('[data-add=html]').click();
 const html=`<style>body{background:#123;color:white}</style><h1 id="msg">Loading</h1><script>document.querySelector('#msg').textContent='Custom HTML working';try{parent.localStorage.getItem('private-test');document.body.dataset.isolated='no'}catch(e){document.body.dataset.isolated='yes'};fetch('/api/admin/screens').then(()=>document.body.dataset.network='allowed').catch(()=>document.body.dataset.network='blocked')</script>`;
 await page.getByLabel('HTML / CSS / JavaScript code',{exact:true}).fill(html);await page.getByRole('button',{name:'Update code preview'}).click();
 const editorFrame=page.frameLocator('.canvas-widget iframe');await expect(editorFrame.locator('#msg')).toHaveText('Custom HTML working');await expect(editorFrame.locator('body')).toHaveAttribute('data-isolated','yes');await expect(editorFrame.locator('body')).toHaveAttribute('data-network','blocked');
 await expect(page.locator('.canvas-widget iframe')).toHaveAttribute('sandbox','allow-scripts');await page.locator('#save-layout').click();await expect(page.locator('#save-layout')).toBeEnabled();
 const id=await page.locator('#layout-select').inputValue();const list=await request.get('/api/admin/layouts',{headers:{Authorization:'Bearer '+token}});const layout=(await list.json()).items.find(l=>l.id===id);expect(layout.widgets[0].html).toBe(html);
 const preview=await page.context().newPage();await preview.goto('/player.html?preview=1');
 await preview.evaluate(layout=>window.postMessage({type:'signage-preview',manifest:{screen:{id:'test',layout_id:layout.id},layouts:[layout],schedules:[]}},location.origin),layout);
 await expect(preview.frameLocator('#stage iframe').locator('#msg')).toHaveText('Custom HTML working');await expect(preview.frameLocator('#stage iframe').locator('body')).toHaveAttribute('data-isolated','yes');
 await page.locator('[data-add=webpage]').click();await page.getByLabel('Hosted HTTPS page URL',{exact:true}).fill('https://example.com/widget.php');
 await expect(page.locator('.canvas-widget.selected iframe')).toHaveAttribute('src','https://example.com/widget.php');await expect(page.locator('.canvas-widget.selected iframe')).toHaveAttribute('sandbox','allow-scripts');
 await preview.close();
 const pair=await (await request.post('/api/player/pair/start')).json();
 await request.post('/api/admin/pair/claim',{headers:{Authorization:'Bearer '+token},data:{code:pair.code,name:'Offline HTML test'}});
 const paired=await (await request.get('/api/player/pair/status?code='+pair.code)).json();
 await request.patch('/api/admin/screens/bulk',{headers:{Authorization:'Bearer '+token},data:{ids:[paired.screen_id],patch:{layout_id:id}}});
 const device=await browser.newContext();
 try{
  await device.addInitScript(p=>localStorage.setItem('signage-device-v1',JSON.stringify({id:p.screen_id,token:p.token})),paired);
  const player=await device.newPage();await player.goto('/player.html?debug=1');
  await expect(player.frameLocator('#stage iframe').locator('#msg')).toHaveText('Custom HTML working');
  await player.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>player.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await device.setOffline(true);await player.reload();await expect(player.frameLocator('#stage iframe').locator('#msg')).toHaveText('Custom HTML working');
 }finally{await device.close();}

});
