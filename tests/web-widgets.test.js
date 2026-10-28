import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnv,request} from './helpers/env.js';
import {validateWidgets} from '../src/worker.js';
test('HTML and hosted page widgets validate code, URL and PHP boundaries',()=>{
 const html='<style>h1{color:red}</style><h1>Hello</h1><script>document.body.dataset.ready=1</script>';
 assert.equal(validateWidgets([{type:'html',html}])[0].html,html);
 assert.equal(validateWidgets([{type:'webpage',src:'https://example.com/widget.php'}])[0].src,'https://example.com/widget.php');
 for(const src of ['javascript:alert(1)','data:text/html,test','http://example.com','https://user:pass@example.com','/api/admin/screens'])assert.throws(()=>validateWidgets([{type:'webpage',src}]),/HTTPS/);
 assert.throws(()=>validateWidgets([{type:'html',html:'<?php echo 1; ?>'}]),/PHP runs on a server/);
 assert.throws(()=>validateWidgets([{type:'html',html:'a'.repeat(20001)}]),/20000/);
});
test('custom HTML survives layout persistence and authenticated player sync',async()=>{
 const {env,close}=makeEnv();try{
  const admin=(await (await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;
  const html='<h1>Ship information</h1><script>document.querySelector("h1").textContent="Welcome"</script>';
  const saved=await request(env,'/api/admin/layouts','POST',{name:'HTML test',widgets:[{id:'html-code',type:'html',html}]},admin);assert.equal(saved.status,200);const {id}=await saved.json();
  const pair=await (await request(env,'/api/player/pair/start','POST')).json();await request(env,'/api/admin/pair/claim','POST',{code:pair.code},admin);
  const p=await (await request(env,'/api/player/pair/status?code='+pair.code)).json();await request(env,'/api/admin/screens/bulk','PATCH',{ids:[p.screen_id],patch:{layout_id:id}},admin);
  const sync=await request(env,'/api/player/sync','POST',undefined,'',{'X-Player-ID':p.screen_id,'X-Player-Token':p.token});assert.equal(sync.status,200);assert.equal((await sync.json()).layouts[0].widgets[0].html,html);
 }finally{close();}
});
