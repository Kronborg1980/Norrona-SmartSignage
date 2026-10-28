import {test,expect} from '@playwright/test';
const weather='https://api.open-meteo.com/v1/forecast?latitude=62.01&longitude=-6.02&current=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto';
const wind='https://api.open-meteo.com/v1/forecast?latitude=62.01&longitude=-6.02&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms';
async function preview(page,network=true,debug='') {
 await page.goto('/player.html?preview=1'+(debug?'&debug='+debug:''));
 const html='<div id="temp">Waiting</div><script>window.loadWeather=function(url){var x=new XMLHttpRequest();x.open("GET",url);x.onreadystatechange=function(){if(x.readyState===4){document.body.dataset.status=x.status;if(x.status===200)document.querySelector("#temp").textContent=JSON.parse(x.responseText).current.temperature_2m;}};x.send();};</script>';
 await page.evaluate(({html,network})=>window.postMessage({type:'signage-preview',manifest:{screen:{id:'test',layout_id:'weather'},layouts:[{id:'weather',widgets:[{id:'weather-widget',type:'html',html,htmlNetwork:network,w:1000,h:500}]}],schedules:[]}},location.origin),{html,network});
 await expect(page.frameLocator('#stage iframe').locator('#temp')).toBeVisible();
}
test('weather XHR and fetch use the shared endpoint, retain sandboxing and explain 429/stale/recovery',async({page})=>{
 let state='limited',calls=0,direct=0;
 await page.context().route('https://api.open-meteo.com/**',route=>{direct++;return route.abort();});
 await page.context().route('**/api/widget/weather?**',route=>{
  calls++;const url=new URL(route.request().url());expect(['weather','wind']).toContain(url.searchParams.get('kind'));expect(url.searchParams.has('_')).toBe(false);
  return route.fulfill({status:state==='limited'?429:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Signage-Weather-Stale,X-Signage-Weather-Age','X-Signage-Weather-Stale':state==='stale'?'1':'0','X-Signage-Weather-Age':'1200'},contentType:'application/json',body:JSON.stringify(state==='limited'?{error:'Rate limited'}:{current:{temperature_2m:8}})});
 });
 await preview(page,true,'1');const frame=page.frameLocator('#stage iframe');
 await frame.locator('body').evaluate((body,url)=>window.loadWeather(url+'&_=123'),weather);
 await expect(page.locator('.widget-runtime-hint')).toContainText('Weather service is busy (HTTP 429)');
 await expect(frame.locator('body')).toHaveAttribute('data-status','429');
 state='stale';await frame.locator('body').evaluate((body,url)=>window.loadWeather(url),weather);
 await expect(frame.locator('#temp')).toHaveText('8');await expect(page.locator('.widget-runtime-hint')).toContainText('cached weather from 20 min ago');
 // Wind recovering must not clear a still-stale temperature result on the same host.
 state='fresh';await frame.locator('body').evaluate(async(body,url)=>{var r=await fetch(url);document.body.dataset.wind=r.status;},wind);
 await expect(frame.locator('body')).toHaveAttribute('data-wind','200');await expect(page.locator('.widget-runtime-hint')).toContainText('cached weather');
 await frame.locator('body').evaluate((body,url)=>window.loadWeather(url),weather);await expect(page.locator('.widget-runtime-hint')).toHaveCount(0);
 expect(calls).toBe(4);expect(direct).toBe(0);await expect(page.locator('#stage iframe')).toHaveAttribute('sandbox','allow-scripts');
 const isolated=await frame.locator('body').evaluate(()=>{try{parent.localStorage.getItem('private');return false;}catch{return true;}});expect(isolated).toBe(true);
});
test('weather adaptation is disabled when external HTTPS permission is off',async({page})=>{
 let calls=0;page.on('request',r=>{if(r.url().includes('/api/widget/weather'))calls++;});
 await preview(page,false);await page.frameLocator('#stage iframe').locator('body').evaluate((body,url)=>window.loadWeather(url),weather);
 await expect(page.frameLocator('#stage iframe').locator('body')).toHaveAttribute('data-status','0');expect(calls).toBe(0);
});
test('normal playback hides weather diagnostics while shared weather requests still work',async({page})=>{
 let limited=true,calls=0;
 await page.context().route('**/api/widget/weather?**',route=>{calls++;return route.fulfill({status:limited?429:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Signage-Weather-Stale,X-Signage-Weather-Age','X-Signage-Weather-Stale':'1','X-Signage-Weather-Age':'1200'},contentType:'application/json',body:JSON.stringify(limited?{error:'Rate limited'}:{current:{temperature_2m:8}})});});
 for(const debug of ['','10','0&next=?debug=1']){
  await preview(page,true,debug);const frame=page.frameLocator('#stage iframe');limited=true;
  await frame.locator('body').evaluate((body,url)=>window.loadWeather(url),weather);await expect(frame.locator('body')).toHaveAttribute('data-status','429');await expect(page.locator('.widget-runtime-hint,.widget-network-hint')).toHaveCount(0);
  limited=false;await frame.locator('body').evaluate((body,url)=>window.loadWeather(url),weather);await expect(frame.locator('#temp')).toHaveText('8');await expect(page.locator('.widget-runtime-hint,.widget-network-hint')).toHaveCount(0);
 }
 expect(calls).toBe(6);
});
