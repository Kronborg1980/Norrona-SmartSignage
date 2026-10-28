import {test,expect} from '@playwright/test';
const source=`<link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"><div id="map" style="width:100%;height:300px"></div><div id="ship">Waiting</div><script>
var map=L.map('map').setView([62,-6],5);L.circle([62,-6],{radius:10000}).addTo(map);document.body.dataset.library=L.version;
var xhr=new XMLHttpRequest();xhr.open('GET','https://data.example.test/vessel');xhr.onload=function(){document.querySelector('#ship').textContent=JSON.parse(xhr.responseText).name;try{parent.localStorage.getItem('private');document.body.dataset.isolated='no'}catch(e){document.body.dataset.isolated='yes'}};setTimeout(function(){xhr.send();},500);
</script>`;
// Delay the mock API transport until Playwright has attached to the opaque frame.
// Match the user's document ordering: external library before its startup code.
const html=source.replace('<div id="map"','<script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script><div id="map"');
async function preview(page,network,debug=false){
 await page.goto('/player.html?preview=1'+(debug?'&debug=1':''));await page.evaluate(({html,network})=>window.postMessage({type:'signage-preview',manifest:{screen:{id:'test',layout_id:'map'},layouts:[{id:'map',widgets:[{id:'map-widget',type:'html',html,htmlNetwork:network,w:1000,h:500}]}],schedules:[]}},location.origin),{html,network});
}
test('Leaflet and Inter load locally before startup, then ship-style XHR can load allowed data',async({page})=>{
 let cdn=0;page.on('request',r=>{if(/unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(r.url()))cdn++;});
 await page.context().route('https://data.example.test/**',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({name:'Controlled test vessel'})}));
 await preview(page,true);const frame=page.frameLocator('#stage iframe');await expect(frame.locator('body')).toHaveAttribute('data-library','1.7.1');await expect(frame.locator('.leaflet-container')).toBeVisible();await expect(frame.locator('#ship')).toHaveText('Controlled test vessel');await expect(frame.locator('body')).toHaveAttribute('data-isolated','yes');expect(cdn).toBe(0);
 const fonts=await frame.locator('body').evaluate(async()=>{await document.fonts.load('400 20px Inter');return Array.from(document.fonts).some(f=>f.family==='Inter'&&f.status==='loaded');});expect(fonts).toBe(true);
});
test('map library works with live access disabled and debug mode explains the disabled feed',async({page})=>{
 await preview(page,false,true);const frame=page.frameLocator('#stage iframe');await expect(frame.locator('body')).toHaveAttribute('data-library','1.7.1');await expect(page.locator('.widget-network-hint')).toContainText('External HTTPS is disabled');await expect(frame.locator('#ship')).toHaveText('Waiting');
});
test('normal playback keeps a disabled-network diagnostic off the screen',async({page})=>{
 await preview(page,false);await expect(page.frameLocator('#stage iframe').locator('body')).toHaveAttribute('data-library','1.7.1');await expect(page.locator('.widget-network-hint,.widget-runtime-hint')).toHaveCount(0);
});

test('network failures show only host/status and clear after a successful retry',async({page})=>{
 let fail=true;
 await page.context().route('https://data.example.test/**',r=>r.fulfill({status:fail?403:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({name:'Recovered vessel'})}));
 await preview(page,true,true);await expect(page.locator('.widget-runtime-hint')).toContainText('data.example.test (HTTP 403)');
 expect(await page.locator('.widget-runtime-hint').textContent()).not.toContain('/vessel');
 fail=false;
 await page.frameLocator('#stage iframe').locator('body').evaluate(()=>{var retry=new XMLHttpRequest();retry.open('GET','https://data.example.test/vessel?token=not-for-display');retry.send();});
 await expect(page.locator('.widget-runtime-hint')).toHaveCount(0);
 await page.evaluate(()=>window.postMessage({type:'signage-widget-network',host:'fake.example.test',status:403},'*'));
 await expect(page.locator('.widget-runtime-hint')).toHaveCount(0);
});

test('the real player retains a local Leaflet map across an offline reload',async({page,request})=>{
 const {token}=await(await request.post('/api/admin/login',{data:{password:'local-browser-test-password'}})).json();
 const saved=await request.post('/api/admin/layouts',{headers:{Authorization:'Bearer '+token},data:{name:'Offline Leaflet',widgets:[{id:'offline-map',type:'html',html,htmlNetwork:false,w:1000,h:500}]}});expect(saved.status()).toBe(200);const{id}=await saved.json();
 const pair=await(await request.post('/api/player/pair/start')).json();await request.post('/api/admin/pair/claim',{headers:{Authorization:'Bearer '+token},data:{code:pair.code}});const p=await(await request.get('/api/player/pair/status?code='+pair.code)).json();
 await request.patch('/api/admin/screens/bulk',{headers:{Authorization:'Bearer '+token},data:{ids:[p.screen_id],patch:{layout_id:id}}});
 await page.addInitScript(p=>localStorage.setItem('signage-device-v1',JSON.stringify({id:p.screen_id,token:p.token})),p);
 await page.goto('/player.html?debug=1');await expect(page.frameLocator('#stage iframe').locator('body')).toHaveAttribute('data-library','1.7.1');
 await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await page.context().setOffline(true);await page.reload();await expect(page.frameLocator('#stage iframe').locator('body')).toHaveAttribute('data-library','1.7.1');await expect(page.frameLocator('#stage iframe').locator('.leaflet-container')).toBeVisible();
});
