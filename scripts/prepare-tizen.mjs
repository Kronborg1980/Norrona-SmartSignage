/* Generates unsigned Tizen Web App source for import into Tizen Studio.
   Requires a unique, real application/package ID and device-approved signing
   certificate before the resulting app can be installed. */
import fs from 'node:fs';
import path from 'node:path';
let base;
try {
 const url=new URL(process.env.SIGNAGE_SERVER_URL||'');
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!/^([a-z\d.-]+|\[[a-f\d:.]+\])$/i.test(url.hostname))throw new Error('Invalid origin');
 base=url.origin;
} catch {
 console.error('Set SIGNAGE_SERVER_URL to the deployed HTTPS origin (e.g. https://signage.example.com).');
 process.exit(1);
}
const xmlOrigin=base.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&apos;');
const root=path.resolve('build/tizen');fs.mkdirSync(root,{recursive:true});
for(const file of ['player.html','player.css','player.js','shared.js']){
 fs.copyFileSync(path.join('public',file),path.join(root,file==='player.html'?'index.html':file));
}
fs.writeFileSync(path.join(root,'player-config.js'),`window.SMARTSIGNAGE_SERVER_URL = ${JSON.stringify(base)};\n`);
// The default development ID is a placeholder. Replace using Tizen Studio wizard.
const packageId='A1B2C3D4E5';
fs.writeFileSync(path.join(root,'config.xml'),`<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets"
  version="0.1.0" viewmodes="fullscreen" id="https://norrona.example.invalid/signage-player">
  <tizen:application id="${packageId}.SmartSignage" package="${packageId}" required_version="6.5"/>
  <content src="index.html"/>
  <name>Norrona Smart Player</name>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <access origin="${xmlOrigin}" subdomains="false"/>
  <tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" hwkey-event="enable"/>
</widget>\n`);
console.log('Unsigned Tizen source staged at build/tizen. Replace IDs, sign and test in Tizen Studio.');
