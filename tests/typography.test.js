import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateWidgets} from '../src/worker.js';
const context={};vm.runInNewContext(fs.readFileSync(new URL('../public/shared.js',import.meta.url),'utf8'),context);const core=context.SmartSignageCore;
test('font choices and formatting survive API validation and player normalization',()=>{
 for(const fontFamily of core.fonts){const saved=validateWidgets([{type:'text',fontFamily,bold:true,italic:true,underline:true,lineHeight:1.5,letterSpacing:3,opacity:0.6,verticalAlign:'bottom',align:'right'}])[0];const w=core.normalizeWidget(saved);const style=core.widgetStyle(w);assert.equal(w.fontFamily,fontFamily);assert.equal(style.fontWeight,'700');assert.equal(style.fontStyle,'italic');assert.equal(style.textDecoration,'underline');assert.equal(w.verticalAlign,'bottom');assert.equal(w.lineHeight,1.5);assert.equal(w.letterSpacing,3);assert.equal(w.opacity,0.6);}
 assert.equal(validateWidgets([{type:'text',fontFamily:'unexpected',opacity:9,lineHeight:9,letterSpacing:-100}])[0].fontFamily,'Arial');
 assert.equal(validateWidgets([{type:'text',opacity:9}])[0].opacity,1);assert.equal(validateWidgets([{type:'text',opacity:0}])[0].opacity,0);
});
test('bundled regular/bold/italic fonts include licenses and belong to the offline shell',()=>{
 const sources=JSON.parse(fs.readFileSync(new URL('../public/fonts/sources.json',import.meta.url)));const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 for(const slug of Object.keys(sources)){assert.ok(fs.existsSync(new URL('../public/fonts/'+slug+'/LICENSE',import.meta.url)));for(const weight of [400,700])for(const style of ['normal','italic']){const path='fonts/'+slug+'/'+slug+'-latin-'+weight+'-'+style+'.woff2';assert.ok(fs.statSync(new URL('../public/'+path,import.meta.url)).size>0);assert.ok(sw.includes('/'+path));}}
});
