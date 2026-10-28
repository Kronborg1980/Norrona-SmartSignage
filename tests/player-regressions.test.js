import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';

const source=fs.readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
const coreSource=fs.readFileSync(new URL('../public/shared.js',import.meta.url),'utf8');
const screenId='a'.repeat(24);
function manifest(widgets=[],assets=[]){return {schema:1,screen:{id:screenId,name:'Test display',layout_id:'daily'},layouts:[{id:'daily',orientation:'landscape',widgets}],schedules:[],assets};}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function harness({saved={},responses=new Map(),failStore=false}={}){
 const elements=new Map(),storage=new Map(Object.entries(saved).map(([k,v])=>[k,JSON.stringify(v)])),created=[],revoked=[],requests=[];
 function element(){return {style:{},classList:{toggle(){},add(){},remove(){}},children:[],get firstChild(){return this.children[0]||null;},append(e){this.children.push(e);},removeChild(e){this.children.splice(this.children.indexOf(e),1);},querySelectorAll(){return [];},setAttribute(){}};}
 const localStorage={getItem:k=>storage.get(k)||null,setItem(k,v){if(failStore)throw Error('quota exceeded');storage.set(k,v);},removeItem:k=>storage.delete(k)};
 const cache={async match(key){return responses.get(key)?.clone();},async delete(key){responses.delete(key);},async put(key,r){responses.set(key,r);}};
 class PlayerURL extends URL{static createObjectURL(){const value='blob:test-'+created.length;created.push(value);return value;}static revokeObjectURL(value){revoked.push(value);}}
 const context={window:{addEventListener(){}},document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element},
  navigator:{},localStorage,location:{href:'https://signage.test/player.html',search:'',reload(){}},innerWidth:1920,innerHeight:1080,
  caches:{async open(){return cache;}},crypto:webcrypto,URL:PlayerURL,Blob,Response,TextEncoder,console,
  setInterval(){return 1;},clearInterval(){},setTimeout,confirm:()=>true,
  async fetch(url,options){requests.push({url,options});return new Response(null,{status:304});}
 };
 context.window.caches=context.caches;
 vm.createContext(context);vm.runInContext(coreSource,context);
 // Expose functions only in this isolated test VM; production keeps its IIFE.
 const instrumented=source.replace(/\nstart\(\);\n\}\)\(\);\s*$/,"\nwindow.playerTest={render:render,activate:activate,getUrls:getUrls,manifestValid:manifestValid,start:start,setActive:function(o){active=o;},snapshot:function(){return {active:active,etag:lastEtag,layoutId:layoutId};}};\n})();");
 assert.notEqual(instrumented,source,'player test harness must instrument the current entry point');
 vm.runInContext(instrumented,context);
 return {api:context.window.playerTest,core:context.window.SmartSignageCore,storage,elements,created,revoked,requests};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('scheduled layout renders again after an interval without a default layout',()=>{
 const h=harness(),m=manifest([{id:'text',type:'text',text:'Daily welcome'}]);
 let current=m.layouts[0];h.core.resolveLayout=()=>current;h.api.setActive(m);
 h.api.render();assert.equal(h.elements.get('stage').children.length,1);
 current=null;h.api.render();assert.equal(h.elements.get('stage').children.length,0);
 current=m.layouts[0];h.api.render();assert.equal(h.elements.get('stage').children.length,1);
});

test('player clears its stage without the newer replaceChildren DOM API',()=>{
 const h=harness(),m=manifest([{id:'text',type:'text',text:'Compatible playback'}]);h.api.setActive(m);
 h.api.render();assert.equal(h.elements.get('stage').replaceChildren,undefined);
 h.core.resolveLayout=()=>null;h.api.render();assert.equal(h.elements.get('stage').children.length,0);
});

test('invalid saved manifest cannot retain an ETag and strand a player on 304',async()=>{
 const h=harness({saved:{'signage-state-v2':{manifest:{schema:1,screen:{id:screenId},layouts:[{id:'broken'}],assets:[],schedules:[]},etag:'"old"'},'signage-device-v1':{id:screenId,token:'b'.repeat(64)}}});
 await h.api.start();await flush();
 assert.equal(h.api.snapshot().active,null);assert.equal(h.api.snapshot().etag,'');
 assert.equal(h.requests[0].options.headers['If-None-Match'],undefined);
});

test('legacy manifest remains playable offline but does not trust a separately stored ETag',async()=>{
 const m=manifest(),h=harness({saved:{'signage-manifest-v1':m,'signage-etag-v1':'"possibly-mismatched"','signage-device-v1':{id:screenId,token:'b'.repeat(64)}}});
 await h.api.start();await flush();
 assert.equal(h.api.snapshot().active.screen.id,screenId);
 assert.equal(h.requests[0].options.headers['If-None-Match'],undefined);
});

test('manifest and ETag commit atomically and a quota error preserves the previous saved state',async()=>{
 const previous={manifest:manifest([{id:'old',type:'text',text:'Old'}]),etag:'"old"'};
 const h=harness();await h.api.activate(previous.manifest,previous.etag);
 const record=JSON.parse(h.storage.get('signage-state-v2'));
 assert.equal(record.etag,'"old"');assert.equal(record.manifest.layouts[0].widgets[0].text,'Old');
 assert.equal(h.storage.has('signage-etag-v1'),false);
 const failed=harness({saved:{'signage-state-v2':previous},failStore:true});failed.api.setActive(previous.manifest);
 await assert.rejects(failed.api.activate(manifest([{id:'new',type:'text',text:'New'}]),'"new"'),/Cannot save offline manifest/);
 assert.equal(JSON.parse(failed.storage.get('signage-state-v2')).etag,'"old"');
 assert.equal(failed.api.snapshot().active.layouts[0].widgets[0].text,'Old');
});

test('offline restore verifies cached bytes and frees blob URLs on a later missing asset',async()=>{
 const bytes=Buffer.from('verified media'),asset={url:'/media/'+'a'.repeat(32),sha256:digest(bytes),size:bytes.length,mime:'image/png'};
 const missing={...asset,url:'/media/'+'b'.repeat(32)};
 const h=harness({responses:new Map([['https://signage.test'+asset.url,new Response(bytes)]])});
 await assert.rejects(h.api.getUrls(manifest([], [asset,missing])),/Cached media missing/);
 assert.equal(h.created.length,1);assert.equal(h.revoked[0],h.created[0]);
 const corrupt=harness({responses:new Map([['https://signage.test'+asset.url,new Response(Buffer.from('corrupt bytes!'))]])});
 await assert.rejects(corrupt.api.getUrls(manifest([], [asset])),/Cached media verification failed/);
 assert.equal(corrupt.created.length,0);
});

test('corrupt persisted media clears the conditional ETag before online recovery',async()=>{
 const bytes=Buffer.from('valid'),asset={url:'/media/'+'a'.repeat(32),sha256:digest(bytes),size:bytes.length};
 const h=harness({saved:{'signage-state-v2':{manifest:manifest([], [asset]),etag:'"old"'},'signage-device-v1':{id:screenId,token:'b'.repeat(64)}},responses:new Map([['https://signage.test'+asset.url,new Response('wrong')]])});
 await h.api.start();await flush();assert.equal(h.api.snapshot().active,null);
 assert.equal(h.requests[0].options.headers['If-None-Match'],undefined);
});

test('a hosted media reference without a verified asset entry cannot replace the active manifest',async()=>{
 const old=manifest([{id:'old',type:'text',text:'Keep playing'}]),h=harness();h.api.setActive(old);
 await assert.rejects(h.api.activate(manifest([{id:'image',type:'image',src:'/media/'+'a'.repeat(32)}]),'"bad"'),/Unsupported manifest/);
 assert.equal(h.api.snapshot().active.layouts[0].widgets[0].text,'Keep playing');
});
test('incomplete channel content and references cannot replace last-good playback',async()=>{
 const old=manifest([{id:'old',type:'text',text:'Keep playing'}]),h=harness();h.api.setActive(old);
 const candidate={...manifest([{id:'channel-area',type:'channel',channel_id:'main-channel'}]),programming:1,channels:[{id:'main-channel'}],content:[{id:'image-content',version:1,widget:{type:'image',src:'/media/'+'a'.repeat(32)}}],bookings:[{id:'book',scope:'channel',target:'main-channel',item_type:'content',item_id:'image-content',duration:10,days:[0,1,2,3,4,5,6]}]};
 await assert.rejects(h.api.activate(candidate,'"incomplete"'),/Unsupported manifest/);
 candidate.content[0].widget={type:'text',text:'Available'};candidate.bookings[0].item_id='missing-content';
 assert.equal(h.api.manifestValid(candidate),false);
 candidate.bookings[0].item_id='image-content';candidate.channels=[];assert.equal(h.api.manifestValid(candidate),false);
 assert.equal(h.api.snapshot().active.layouts[0].widgets[0].text,'Keep playing');
});
