import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker, {validateWidgets, allowedUrl} from '../src/worker.js';
const context={module:{exports:{}},console};
vm.runInNewContext(fs.readFileSync(new URL('../public/shared.js', import.meta.url),'utf8'),context);
const core=context.module.exports;
function sched(x={}){return {id:'s1',enabled:true,scope:'all',target:'*',layout_id:'special',priority:10,days:[0,1,2,3,4,5,6],start_time:'09:00',end_time:'17:00',...x};}
const screen={id:'one',zone:'Lobby',layout_id:'base'};
const layouts=[{id:'base'},{id:'special'},{id:'high'}];
test('normal time window UTC selects scheduled layout',()=>{
 const m={screen,layouts,schedules:[sched()]};
 assert.equal(core.resolveLayout(m,new Date('2026-10-27T10:00:00Z')).id,'special');
 assert.equal(core.resolveLayout(m,new Date('2026-10-27T21:00:00Z')).id,'base');
});
test('priority beats lower precedence, incorrect zone excluded',()=>{
 const m={screen,layouts,schedules:[sched(),sched({id:'s2',layout_id:'high',scope:'zone',target:'Lobby',priority:200}),sched({id:'s3',scope:'zone',target:'Pool',priority:900})]};
 assert.equal(core.resolveLayout(m,new Date('2026-10-27T10:00:00Z')).id,'high');
});
test('overnight rule respects weekday crossing UTC midnight',()=>{
 const s=sched({days:[2],start_time:'22:00',end_time:'04:00'}); // Tuesday 27 Oct 2026
 assert.equal(core.activeSchedule(s,screen,new Date('2026-10-27T23:45:00Z')),true);
 assert.equal(core.activeSchedule(s,screen,new Date('2026-10-28T02:00:00Z')),true);
 assert.equal(core.activeSchedule(s,screen,new Date('2026-10-28T05:00:00Z')),false);
});
test('screen schedule does not leak to different devices',()=>{
 assert.equal(core.activeSchedule(sched({scope:'screen',target:'not-one'}),screen,new Date('2026-10-27T10:00:00Z')),false);
});
test('no default layout means screen stays unassigned',()=>{
 assert.equal(core.resolveLayout({screen:{...screen,layout_id:null},layouts,schedules:[]},new Date()),null);
});
test('allowed URLs exclude scripts and non-https external sources',()=>{
 assert.equal(allowedUrl('/media/'+('a'.repeat(32))),true);
 assert.equal(allowedUrl('javascript:alert(1)'),false);
 assert.equal(allowedUrl('http://outside.test/asset.jpg'),false);
 assert.equal(allowedUrl('https://example.com/a.jpg'),true);
});
test('widget validator enforces one video per composition',()=>{
 assert.throws(()=>validateWidgets([{type:'video'},{type:'video'}]),/one video/);
 assert.throws(()=>validateWidgets([{type:'image',src:'javascript:boom'}]),/Media URL/);
 assert.equal(validateWidgets([{type:'text',x:-1,w:99999, text:'Hello'}])[0].w,1920);
});
test('administration and private screen API reject anonymous calls',async()=>{
 const env={ADMIN_PASSWORD:'secret',ADMIN_SESSION_SECRET:'abcdefghijklmnop'};
 const res=await worker.fetch(new Request('https://example.com/api/admin/screens'),env);
 assert.equal(res.status,401);
 const p=await worker.fetch(new Request('https://example.com/api/player/sync',{method:'POST'}),env);
 assert.equal(p.status,401);
});
test('login refuses to start without configured secrets',async()=>{
 const r=await worker.fetch(new Request('https://example.com/api/admin/login',{method:'POST'}),{});
 assert.equal(r.status,503);
});
