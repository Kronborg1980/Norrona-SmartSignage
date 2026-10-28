import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Leaflet runtime assets and license are included in the offline shell and Tizen package',()=>{
 const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 for(const path of ['widget-assets.js','leaflet.js','leaflet.css','images/layers.png','images/layers-2x.png','images/marker-icon.png','images/marker-icon-2x.png','images/marker-shadow.png']){
  const asset='vendor/leaflet-1.7.1/'+path;assert.ok(fs.statSync(new URL('../public/'+asset,import.meta.url)).size>0);assert.ok(sw.includes('/'+asset));
 }
 assert.match(fs.readFileSync(new URL('../public/vendor/leaflet-1.7.1/LICENSE',import.meta.url),'utf8'),/Redistribution/);
 assert.match(fs.readFileSync(new URL('../scripts/prepare-tizen.mjs',import.meta.url),'utf8'),/public','vendor/);
});
