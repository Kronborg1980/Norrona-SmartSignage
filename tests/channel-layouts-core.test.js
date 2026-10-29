import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sharedSource=fs.readFileSync(new URL('../public/shared.js',import.meta.url),'utf8');
const playerSource=fs.readFileSync(new URL('../public/player.js',import.meta.url),'utf8');
const context={module:{exports:{}}};vm.runInNewContext(sharedSource,context);const core=context.module.exports;
const every={days:[0,1,2,3,4,5,6],start_time:'00:00',end_time:'23:59',duration:1,position:0,priority:10,enabled:true};
function fixture(){return {
 schema:1,programming:1,channel_layouts:1,screen:{id:'screen-one',name:'Screen',layout_id:'root'},assets:[],schedules:[],
 layouts:[{id:'root',version:1,orientation:'landscape',widgets:[{id:'root-static',type:'html',html:'<h1>Root stays</h1>',w:400,h:100,z:0},{id:'outer-area',type:'channel',channel_id:'outer-channel',x:100,y:100,w:600,h:600,z:1,opacity:.5,radius:12}]},
 {id:'booked',version:2,orientation:'landscape',background:'#123456',widgets:[{id:'booked-static',type:'html',html:'<h1>Nested stays</h1>',x:0,y:0,w:900,h:200,z:0},{id:'inner-area',type:'channel',channel_id:'inner-channel',x:100,y:300,w:900,h:500,z:1}]}],
 channels:[{id:'outer-channel'},{id:'inner-channel'}],content:[{id:'clock-content',version:1,widget:{type:'clock',fontSize:80}},{id:'text-content',version:1,widget:{type:'text',text:'Next nested item'}}],
 bookings:[{id:'outer-booking',scope:'channel',target:'outer-channel',item_type:'layout',item_id:'booked',...every},{id:'clock-booking',scope:'channel',target:'inner-channel',item_type:'content',item_id:'clock-content',...every},{id:'text-booking',scope:'channel',target:'inner-channel',item_type:'content',item_id:'text-content',...every,position:1}]
};}
test('channel layout entries retain native layout and area geometry, version keys and independent channels',()=>{
 const m=fixture(),at=new Date('2026-10-28T00:00:00Z'),entries=core.resolveWidgets(m.layouts[0],m,at),composition=entries[1];
 assert.equal(entries[0].key,'root-static');assert.equal(composition.widget.type,'composition');assert.equal(composition.widget.x,100);assert.equal(composition.widget.w,600);assert.equal(composition.widget.h,600);assert.equal(composition.widget.opacity,.5);assert.equal(composition.widget.radius,12);assert.equal(composition.layout,m.layouts[1]);
 assert.equal(core.resolveWidgets(composition.layout,m,at)[1].widget.type,'clock');
 assert.equal(core.resolveWidgets(composition.layout,m,new Date('2026-10-28T00:00:01Z'))[1].widget.text,'Next nested item');
 const oldKey=composition.key;m.layouts[1].version++;assert.notEqual(core.resolveWidgets(m.layouts[0],m,at)[1].key,oldKey);assert.equal(core.resolveWidgets(m.layouts[0],m,at)[0].key,'root-static');
});
test('composition graph validation rejects absent markers, missing transitive references and cycles',()=>{
 const m=fixture();assert.equal(core.programmingReferencesValid(m),true);
 const unmarked=structuredClone(m);delete unmarked.channel_layouts;assert.equal(core.programmingReferencesValid(unmarked),false);
 const missingLayout=structuredClone(m);missingLayout.layouts.pop();assert.equal(core.programmingReferencesValid(missingLayout),false);
 const missingChannel=structuredClone(m);missingChannel.channels.pop();assert.equal(core.programmingReferencesValid(missingChannel),false);
 const missingContent=structuredClone(m);missingContent.content.pop();assert.equal(core.programmingReferencesValid(missingContent),false);
 const duplicate=structuredClone(m);duplicate.layouts.push(duplicate.layouts[0]);assert.equal(core.programmingReferencesValid(duplicate),false);
 const cycle=structuredClone(m);cycle.bookings.push({id:'cycle',scope:'channel',target:'inner-channel',item_type:'layout',item_id:'root',...every});assert.equal(core.programmingReferencesValid(cycle),false);
 const self=structuredClone(m);self.bookings[0].item_id='root';assert.equal(core.programmingReferencesValid(self),false);
});
test('composition graph validation handles a deep acyclic chain without a fixed nesting cap',()=>{
 const m={layouts:[],channels:[],content:[{id:'leaf'}],bookings:[],channel_layouts:1};
 for(let i=0;i<1200;i++){
  m.layouts.push({id:'layout-'+i,widgets:[{type:'channel',channel_id:'channel-'+i}]});m.channels.push({id:'channel-'+i});
  m.bookings.push({id:'booking-'+i,scope:'channel',target:'channel-'+i,item_type:i===1199?'content':'layout',item_id:i===1199?'leaf':'layout-'+(i+1)});
 }
 assert.equal(core.programmingReferencesValid(m),true);m.bookings.at(-1).item_type='layout';m.bookings.at(-1).item_id='layout-0';assert.equal(core.programmingReferencesValid(m),false);
});
function playerHarness(){
 let instant=Date.parse('2026-10-28T00:00:00Z'),nextTimer=1;const elements=new Map(),timers=new Set();
 class ClockDate extends Date{constructor(...args){super(args.length?args[0]:instant);}static now(){return instant;}}
 function element(tag='div'){return {tag,style:{},attrs:{},classList:{toggle(){},add(){},remove(){}},children:[],get firstChild(){return this.children[0]||null;},append(e){this.children.push(e);},removeChild(e){const i=this.children.indexOf(e);assert.ok(i>=0,'removed node belongs to this parent');this.children.splice(i,1);},querySelectorAll(){return [];},setAttribute(k,v){this.attrs[k]=v;}};}
 const root={addEventListener(){}};const ctx={window:root,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element},Date:ClockDate,
  navigator:{},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},location:{href:'https://signage.test/player.html',search:''},URL,Blob,Response,console,innerWidth:1920,innerHeight:1080,
  setInterval(){const id=nextTimer++;timers.add(id);return id;},clearInterval(id){timers.delete(id);},setTimeout,confirm:()=>false};
 vm.createContext(ctx);vm.runInContext(sharedSource,ctx);
 const source=playerSource.replace(/\nstart\(\);\n\}\)\(\);\s*$/,"\nwindow.playerTest={render:render,activate:activate,manifestValid:manifestValid,setActive:function(m){active=m;},snapshot:function(){return active;}};\n})();");assert.notEqual(source,playerSource);vm.runInContext(source,ctx);
 return {api:root.playerTest,elements,timers,setTime:time=>{instant=Date.parse(time);}};
}
test('nested layout rendering retains static iframe nodes, native scaling and cleans rotating clocks',()=>{
 const h=playerHarness(),m=fixture();h.api.setActive(m);h.api.render();const stage=h.elements.get('stage'),outside=stage.children[0],group=stage.children[1],logical=group.children[0],inside=logical.children[0];
 assert.equal(logical.style.width,'1920px');assert.equal(logical.style.height,'1080px');assert.equal(logical.style.transform,'scale(0.3125)');assert.equal(logical.style.top,'131.25px');assert.equal(group.style.opacity,'0.5');assert.equal(h.timers.size,1);
 h.setTime('2026-10-28T00:00:01Z');h.api.render();assert.equal(stage.children[0],outside);assert.equal(group.children[0].children[0],inside);assert.equal(h.timers.size,0);
 h.setTime('2026-10-28T00:00:02Z');h.api.render();assert.equal(h.timers.size,1);
 m.bookings[0].item_type='content';m.bookings[0].item_id='text-content';h.api.render();assert.equal(h.timers.size,0);assert.equal(stage.children[0],outside);assert.equal(stage.children.length,2);
});
test('incomplete or cyclic channel-layout manifests cannot replace the active manifest',async()=>{
 const h=playerHarness(),m=fixture();assert.equal(h.api.manifestValid(m),true);h.api.setActive(m);
 const invalid=structuredClone(m);invalid.bookings[0].item_id='root';assert.equal(h.api.manifestValid(invalid),false);await assert.rejects(h.api.activate(invalid,'"invalid"'),/Unsupported manifest/);assert.equal(h.api.snapshot(),m);
 const missing=structuredClone(m);missing.layouts.pop();assert.equal(h.api.manifestValid(missing),false);
 const badAsset=structuredClone(m);badAsset.layouts[1].widgets.push({id:'future-image',type:'image',src:'/media/'+'a'.repeat(32)});assert.equal(h.api.manifestValid(badAsset),false);
});
