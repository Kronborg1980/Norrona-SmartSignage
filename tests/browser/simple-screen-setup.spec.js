import {test,expect} from '@playwright/test';
const password='local-browser-test-password';
async function login(page,path='/'){await page.goto(path);await page.locator('#password').fill(password);await page.getByRole('button',{name:'Log ind'}).click();}
test('the player shows a grouped code and a QR code that opens Add a screen with the code filled in',async({page,browser})=>{
 const tv=await browser.newContext({viewport:{width:1920,height:1080}});const player=await tv.newPage();await player.goto('/player.html');
 await expect(player.locator('#pair-code')).toHaveText(/^[A-F0-9]{12}$/);const code=await player.locator('#pair-code').textContent();
 await expect(player.locator('#pair-code span')).toHaveCount(3);await expect(player.locator('#pair-qr img')).toHaveJSProperty('complete',true);
 expect(await player.locator('#pair-qr img').evaluate(i=>i.naturalWidth)).toBeGreaterThan(50);
 await page.setViewportSize({width:390,height:844});await login(page,'/?pair='+code);
 await expect(page.locator('#modal-title')).toHaveText('Add a screen');await expect(page.getByLabel('Pairing code',{exact:true})).toHaveValue(code.replace(/(.{4})(?=.)/g,'$1 '));
 await page.locator('#modal-save').click();await expect(page.getByRole('alert')).toContainText('name');
 await page.locator('.name-chips .chip',{hasText:'Restaurant'}).click();await page.locator('.orient-portrait').click();await page.locator('#modal-save').click();
 await expect(page.locator('#modal')).toBeHidden();expect(new URL(page.url()).search).toBe('');
 await expect(page.locator('#plan-detail h3').first()).toHaveText('Restaurant');await expect(player.locator('#pair-screen')).toBeHidden({timeout:15000});await expect(page.locator('#plan-detail')).toContainText('Portrait');
 await page.locator('#plan-detail').getByRole('button',{name:'Add content',exact:true}).click();await page.getByRole('button',{name:'Write a message',exact:true}).click();
 await page.getByLabel('Your message',{exact:true}).fill('Dinner is served');await page.locator('.guide-now').click();await expect(page.locator('#modal')).toBeHidden();
 await expect(page.locator('#plan-detail .plan-bookings')).toContainText('Every day · all day');
 await player.reload();await expect(player.locator('#stage')).toContainText('Dinner is served',{timeout:20000});await tv.close();
});
test('typing a code accepts spaces and lowercase, and an incomplete code is explained',async({page,request})=>{
 const {code}=await(await request.post('/api/player/pair/start')).json();
 await login(page);await page.locator('#nav [data-view=plan]').click();await page.getByRole('button',{name:'Screens',exact:true}).first().click();
 await page.locator('#plan-detail .add-card').click();const input=page.getByLabel('Pairing code',{exact:true});
 await input.fill(code.slice(0,5));await page.getByLabel('Screen name',{exact:true}).fill('Short code');await page.locator('#modal-save').click();await expect(page.getByRole('alert')).toContainText('12-character');
 await input.fill(code.toLowerCase().replace(/(.{3})/g,'$1 '));await expect(input).toHaveValue(code.replace(/(.{4})(?=.)/g,'$1 '));
 await page.locator('#modal-save').click();await expect(page.locator('#modal')).toBeHidden();await expect(page.locator('#plan-detail h3').first()).toHaveText('Short code');
});
