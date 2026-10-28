import {test,expect} from '@playwright/test';
for(const type of ['image','video'])for(const orientation of ['landscape','portrait']){
 test(`${type} can resize, switch crop mode and persist in ${orientation}`,async({page,request})=>{
  const login=await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}});expect(login.status()).toBe(200);const {token}=await login.json();
  const created=await request.post('/api/admin/layouts',{headers:{Authorization:'Bearer '+token},data:{name:`Resize ${type} ${orientation}`,orientation,widgets:[{id:'resize-test',type,x:100,y:100,w:400,h:300,fit:'cover',src:''}]}});expect(created.status()).toBe(200);const {id}=await created.json();
  await page.setViewportSize({width:1800,height:1000});await page.addInitScript(token=>sessionStorage.setItem('signage-admin-token',token),token);
  await page.goto('/');await page.locator('#nav [data-view=layouts]').click();await expect(page.locator('#layout-select option[value="'+id+'"]').first()).toBeAttached();await page.locator('#layout-select').selectOption(id);
  await page.locator('#layer-list button').click();const widget=page.locator('.canvas-widget.selected');const canvas=await page.locator('#layout-canvas').boundingBox();const scale=canvas.width/(orientation==='portrait'?1080:1920);
  async function drag(corner,dx,dy){const handle=await page.locator('.resize-'+corner).boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+dx*scale,handle.y+handle.height/2+dy*scale,{steps:5});await page.mouse.up();}
  await drag('se',200,100);
  expect(Math.abs(Number(await page.getByLabel('Width',{exact:true}).inputValue())-600)).toBeLessThan(3);expect(Math.abs(Number(await page.getByLabel('Height',{exact:true}).inputValue())-400)).toBeLessThan(3);
  await drag('nw',50,60);expect(Math.abs(Number(await page.getByLabel('X',{exact:true}).inputValue())-150)).toBeLessThan(3);expect(Math.abs(Number(await page.getByLabel('Y',{exact:true}).inputValue())-160)).toBeLessThan(3);
  const width=await page.getByLabel('Width',{exact:true}).inputValue(),height=await page.getByLabel('Height',{exact:true}).inputValue();
  await page.getByRole('combobox',{name:'Media scaling',exact:true}).selectOption('contain');
  await page.locator('#save-layout').click();await expect(page.locator('#save-layout')).toBeEnabled();
  await page.reload();await page.locator('#nav [data-view=layouts]').click();await expect(page.locator('#layout-select option[value="'+id+'"]')).toBeAttached();await page.locator('#layout-select').selectOption(id);await page.locator('#layer-list button').click();
  await expect(page.getByLabel('Width',{exact:true})).toHaveValue(width);await expect(page.getByLabel('Height',{exact:true})).toHaveValue(height);await expect(page.getByRole('combobox',{name:'Media scaling',exact:true})).toHaveValue('contain');
  await page.getByRole('button',{name:'Fill canvas',exact:true}).click();await expect(widget).toHaveCSS('width',orientation==='portrait'?'1080px':'1920px');await expect(widget).toHaveCSS('height',orientation==='portrait'?'1920px':'1080px');
  await drag('se',-9999,-9999);await expect(page.getByLabel('Width',{exact:true})).toHaveValue('20');await expect(page.getByLabel('Height',{exact:true})).toHaveValue('20');
 });
}
