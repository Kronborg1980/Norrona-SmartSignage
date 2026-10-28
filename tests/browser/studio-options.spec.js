import {test,expect} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function admin(page,request){const r=await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}});const {token}=await r.json();await page.addInitScript(t=>sessionStorage.setItem('signage-admin-token',t),token);await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await page.locator('#new-layout').click();return token;}
test('formatting renders in editor and player preview, persists and bundled fonts load offline',async({page,request})=>{
 const token=await admin(page,request);await page.locator('[data-add=text]').click();await page.getByLabel('Text',{exact:true}).fill('Norröna\nWelcome aboard');
 await page.getByRole('combobox',{name:'Font family',exact:true}).selectOption('Montserrat');for(const label of ['Bold','Italic','Underline'])await page.getByLabel(label,{exact:true}).check();
 await page.getByRole('combobox',{name:'Text alignment',exact:true}).selectOption('right');await page.getByRole('combobox',{name:'Vertical alignment',exact:true}).selectOption('bottom');
 await page.getByLabel('Line height',{exact:true}).fill('1.5');await page.getByLabel('Letter spacing',{exact:true}).fill('3');await page.getByLabel('Opacity (0–1)',{exact:true}).fill('0.6');
 const box=page.locator('.canvas-widget.selected');await expect(box).toHaveCSS('font-weight','700');await expect(box).toHaveCSS('font-style','italic');await expect(box).toHaveCSS('letter-spacing','3px');await expect(box).toHaveCSS('opacity','0.6');
 await page.evaluate(()=>document.fonts.load('italic 700 48px Montserrat'));expect(await page.evaluate(()=>document.fonts.check('italic 700 48px Montserrat'))).toBe(true);
 await page.locator('#save-layout').click();await expect(page.locator('#save-layout')).toBeEnabled();const id=await page.locator('#layout-select').inputValue();const r=await request.get('/api/admin/layouts',{headers:{Authorization:'Bearer '+token}});const layout=(await r.json()).items.find(l=>l.id===id);expect(layout.widgets[0].bold).toBe(true);expect(layout.widgets[0].fontFamily).toBe('Montserrat');
 const p=await page.context().newPage();await p.goto('/player.html?preview=1');await p.evaluate(layout=>window.postMessage({type:'signage-preview',manifest:{screen:{id:'text-preview',layout_id:layout.id},layouts:[layout],schedules:[]}},location.origin),layout);await expect(p.locator('#stage .widget')).toHaveCSS('font-weight','700');await expect(p.locator('#stage .widget')).toHaveCSS('font-style','italic');await expect(p.locator('#stage .text')).toHaveCSS('align-items','flex-end');await p.close();
 await page.reload();await page.locator('#nav [data-view=layouts]').click();await expect(page.locator('#layout-select option[value="'+id+'"]').first()).toBeAttached();await page.locator('#layout-select').selectOption(id);await page.locator('#layer-list button').click();await expect(page.getByLabel('Bold',{exact:true})).toBeChecked();await expect(page.getByRole('combobox',{name:'Font family',exact:true})).toHaveValue('Montserrat');
 // Fonts are installed into the same offline shell used by the actual player.
 const player=await page.context().newPage();await player.goto('/player.html?debug=1');await player.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>player.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await page.context().setOffline(true);await player.reload();await player.evaluate(()=>document.fonts.load('italic 700 48px Montserrat'));expect(await player.evaluate(()=>document.fonts.check('italic 700 48px Montserrat'))).toBe(true);await page.context().setOffline(false);await player.close();
});
test('image and video can upload directly, pick library media or use an external URL',async({page,request})=>{
 const token=await admin(page,request);
 for(const type of ['image','video']){
  await page.locator('[data-add='+type+']').click();
  const file=type==='image'?{name:'studio-picture.png',mimeType:'image/png',buffer:png}:new URL('../fixtures/test-video.mp4',import.meta.url).pathname;
  await page.getByLabel('Upload '+type,{exact:true}).setInputFiles(file);
  const source=page.getByLabel('Media URL (HTTPS link or uploaded media)',{exact:true});await expect(source).toHaveValue(/^\/media\/[a-f0-9]{32}$/);const uploaded=await source.inputValue();
  await source.fill('https://example.com/'+(type==='image'?'photo.png':'video.mp4'));await expect(page.locator('.canvas-widget.selected '+(type==='image'?'img':'video'))).toHaveAttribute('src',/^https:\/\/example.com/);
  await page.getByRole('combobox',{name:'Uploaded media',exact:true}).selectOption(uploaded);await expect(source).toHaveValue(uploaded);
  if(type==='image')await expect(page.locator('.canvas-widget.selected img')).toHaveJSProperty('naturalWidth',1);
 }
 await page.locator('#save-layout').click();await expect(page.locator('#save-layout')).toBeEnabled();const id=await page.locator('#layout-select').inputValue();const list=await request.get('/api/admin/layouts',{headers:{Authorization:'Bearer '+token}});const layout=(await list.json()).items.find(l=>l.id===id);expect(layout.widgets.filter(w=>w.src.startsWith('/media/'))).toHaveLength(2);
});
