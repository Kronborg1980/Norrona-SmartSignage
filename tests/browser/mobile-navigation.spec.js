import {test,expect} from '@playwright/test';
const password='local-browser-test-password';
test('phone layout uses a bottom tab bar, a More menu with sign out and card-style screens',async({page,request})=>{
 const {token}=await(await request.post('/api/admin/login',{data:{password}})).json();
 const {code}=await(await request.post('/api/player/pair/start')).json();
 await request.post('/api/admin/pair/claim',{headers:{Authorization:'Bearer '+token},data:{code,name:'Phone nav screen',zone:'Deck 6'}});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.locator('#password').fill(password);await page.getByRole('button',{name:'Log ind'}).click();
 const bar=page.locator('.sidebar');await expect(bar).toBeVisible();
 const box=await bar.boundingBox();expect(box.y+box.height).toBeGreaterThanOrEqual(843);expect(box.width).toBeGreaterThanOrEqual(389);
 await expect(page.locator('#plan-detail .dest-card',{hasText:'Phone nav screen'})).toContainText('Deck 6');
 await page.locator('#plan-detail .dest-card',{hasText:'Phone nav screen'}).click();
 await expect(page.locator('#plan-detail').getByRole('button',{name:'Add content',exact:true})).toBeVisible();
 await expect(page.locator('.quick-steps')).toBeHidden();
 await page.locator('#plan-detail .back-link').click();await expect(page.locator('#plan-target')).toHaveValue('');
 await page.locator('#nav [data-view=screens]').click();
 await expect(page.locator('#screens-body tr td[data-label=Zone]').first()).toHaveText('Deck 6');
 expect(await page.locator('#view-screens').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await page.locator('#nav-advanced > summary').click();await expect(page.locator('#logout-menu')).toBeVisible();
 await page.locator('#nav [data-view=overview]').click();await expect(page.locator('#view-overview')).toBeVisible();
 await expect(page.locator('#logout-menu')).toBeHidden();await expect(page.locator('#nav-advanced')).toHaveClass(/has-active/);
 await page.locator('#nav-advanced > summary').click();await page.locator('#logout-menu').click();await expect(page.locator('#login')).toBeVisible();
});
test('desktop keeps the sidebar and hides phone-only controls',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');await page.locator('#password').fill(password);await page.getByRole('button',{name:'Log ind'}).click();
 await expect(page.locator('.sidebar .logo')).toBeVisible();await expect(page.locator('#logout')).toBeVisible();
 await page.locator('#nav-advanced > summary').click();await expect(page.locator('#logout-menu')).toBeHidden();
});
