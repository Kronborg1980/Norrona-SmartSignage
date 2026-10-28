import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnv,request} from './helpers/env.js';
import {validateWidgets} from '../src/worker.js';
const widget='<style>body{color:white}</style><h1>Large ship widget</h1><!--'+'x'.repeat(280000)+'-->';
test('large HTML layouts persist without truncation and retain explicit network permission',async()=>{
 const {env,close}=makeEnv();try{
  const token=(await (await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;
  const saved=await request(env,'/api/admin/layouts','POST',{name:'Large HTML',widgets:[{type:'html',html:widget,htmlNetwork:true}]},token);assert.equal(saved.status,200);const {id}=await saved.json();
  const list=await (await request(env,'/api/admin/layouts','GET',undefined,token)).json();const w=list.items.find(l=>l.id===id).widgets[0];assert.equal(w.html,widget);assert.equal(w.htmlNetwork,true);
  assert.equal(validateWidgets([{type:'html',html:widget}])[0].htmlNetwork,false);
  assert.equal(validateWidgets([{type:'html',html:widget,htmlNetwork:'true'}])[0].htmlNetwork,false);
 }finally{close();}
});
test('HTML and layout limits count UTF-8 bytes and reject oversized streamed bodies',async()=>{
 assert.doesNotThrow(()=>validateWidgets([{type:'html',html:'x'.repeat(512*1024)}]));
 assert.throws(()=>validateWidgets([{type:'html',html:'ø'.repeat(262145)}]),/512 KiB/);
 const {env,close}=makeEnv();try{
  const token=(await (await request(env,'/api/admin/login','POST',{password:'test-password'})).json()).token;
  const r=await request(env,'/api/admin/layouts','POST',{widgets:[{type:'html',html:'x'.repeat(520000)},{type:'html',html:'y'.repeat(520000)},{type:'text',text:'z'.repeat(15000)}]},token);
  assert.equal(r.status,413);assert.match((await r.json()).error,/1 MiB/);
  assert.equal((await request(env,'/api/admin/login','POST',{password:'ø'.repeat(130000)})).status,413);
 }finally{close();}
});
