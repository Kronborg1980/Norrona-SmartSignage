// Build the isolated document's dependencies from pinned, licensed local assets.
// Generated output is tracked so deployment needs no additional build step.
import fs from 'node:fs';
const root=new URL('../public/',import.meta.url),vendor=new URL('vendor/leaflet-1.7.1/',root);
let css=fs.readFileSync(new URL('leaflet.css',vendor),'utf8');
for(const name of ['layers.png','layers-2x.png','marker-icon.png','marker-icon-2x.png','marker-shadow.png']){
 css=css.replaceAll('images/'+name,'data:image/png;base64,'+fs.readFileSync(new URL('images/'+name,vendor)).toString('base64'));
}
let fonts=fs.readFileSync(new URL('fonts.css',root),'utf8').split('\n').filter(line=>line.includes('font-family:"Inter"')).join('\n');
fonts=fonts.replace(/url\("\.\/(fonts\/[^\"]+)"\)/g,(_,path)=>'url("data:font/woff2;base64,'+fs.readFileSync(new URL(path,root)).toString('base64')+'")');
const assets={leafletJs:fs.readFileSync(new URL('leaflet.js',vendor),'utf8'),leafletCss:css,interCss:fonts};
fs.writeFileSync(new URL('widget-assets.js',vendor),'/* Leaflet 1.7.1 BSD license: ./LICENSE. Inter font license: ../../fonts/inter/LICENSE. */\nwindow.SmartSignageWidgetAssets='+JSON.stringify(assets)+';\n');
console.log('Built self-contained Leaflet and Inter widget assets');
