import {test,expect} from '@playwright/test';
test('large pasted HTML saves and HTTPS resources require an explicit sandboxed opt-in',async({page,request})=>{
 const {token}=await (await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}})).json();
 await page.addInitScript(t=>sessionStorage.setItem('signage-admin-token',t),token);
 await page.context().route('https://widget-assets.example.test/**',r=>r.fulfill({contentType:'application/javascript',body:"document.querySelector('#large-widget').dataset.external='loaded';try{parent.sessionStorage.getItem('signage-admin-token');document.body.dataset.isolated='no'}catch(e){document.body.dataset.isolated='yes'}"}));
 await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await page.locator('#new-layout').click();await page.locator('[data-add=html]').click();
 let blocked=0;page.on('console',m=>{if(m.text().includes('violates')&&m.text().includes('script-src'))blocked++;});
 const html='<h1 id="large-widget">Ship dashboard</h1><script>setTimeout(function(){var s=document.createElement("script");s.src="https://widget-assets.example.test/widget.js";document.body.appendChild(s)},500)</script><!--'+'a'.repeat(280000)+'-->';
 await page.getByLabel('HTML / CSS / JavaScript code',{exact:true}).fill(html);await page.getByRole('button',{name:'Update code preview'}).click();
 await expect(page.frameLocator('.canvas-widget iframe').locator('#large-widget')).toHaveText('Ship dashboard');await expect(page.frameLocator('.canvas-widget iframe').locator('#large-widget')).not.toHaveAttribute('data-external','loaded');
 await expect.poll(()=>blocked).toBeGreaterThan(0);
 await page.getByLabel('Allow external HTTPS resources',{exact:true}).check();
 await expect(page.frameLocator('.canvas-widget iframe').locator('#large-widget')).toHaveAttribute('data-external','loaded');await expect(page.frameLocator('.canvas-widget iframe').locator('body')).toHaveAttribute('data-isolated','yes');await expect(page.locator('.canvas-widget iframe')).toHaveAttribute('sandbox','allow-scripts');
 await page.locator('#save-layout').click();await expect(page.locator('#save-layout')).toBeEnabled();const id=await page.locator('#layout-select').inputValue();const list=await request.get('/api/admin/layouts',{headers:{Authorization:'Bearer '+token}});const layout=(await list.json()).items.find(l=>l.id===id);expect(layout.widgets[0].html).toBe(html);expect(layout.widgets[0].htmlNetwork).toBe(true);
});
