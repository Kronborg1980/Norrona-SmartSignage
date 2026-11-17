import {test,expect} from '@playwright/test';
test('help guides open from context links, can be searched and lead to the right page',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');await page.locator('#password').fill('local-browser-test-password');await page.getByRole('button',{name:'Log ind'}).click();
 await page.locator('#view-plan [data-help="setup-screen"]').click();
 await expect(page.locator('#view-help')).toBeVisible();await expect(page.locator('#help-setup-screen')).toHaveAttribute('open','');
 await expect(page.locator('#help-setup-screen .help-steps li')).toHaveCount(6);
 await page.locator('.help-search').fill('mp4 video');await expect(page.locator('#help-media')).toBeVisible();await expect(page.locator('#help-utc')).toBeHidden();
 await page.locator('.help-search').fill('zzzz');await expect(page.locator('#view-help .empty')).toBeVisible();
 await page.locator('.help-search').fill('');await page.locator('#help-playlists > summary').click();await page.locator('#help-playlists .help-go').click();
 await expect(page.locator('#view-channels')).toBeVisible();
 await page.locator('#nav-advanced > summary').click();await page.locator('#nav [data-view=help]').click();await expect(page.locator('#view-help')).toBeVisible();
});
