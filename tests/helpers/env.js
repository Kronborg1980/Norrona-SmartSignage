import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../../src/worker.js';

export function makeEnv() {
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 const q=sqlText=>{
  let bindings=[];
  const bind=(...params)=>{bindings=params;return {first:async()=>sql.prepare(sqlText).get(...bindings)||null,all:async()=>({results:sql.prepare(sqlText).all(...bindings)}),run:async()=>{sql.prepare(sqlText).run(...bindings);return {success:true};}};};
  return {bind,first:async()=>sql.prepare(sqlText).get()||null,all:async()=>({results:sql.prepare(sqlText).all()}),run:async()=>{sql.prepare(sqlText).run();return {success:true};}};
 };
 const objects=new Map();
 const MEDIA={
  put:async(key,body,opts)=>{objects.set(key,{bytes:new Uint8Array(body),opts});return {size:body.byteLength};},
  head:async(key)=>{const x=objects.get(key);return x?{size:x.bytes.length,customMetadata:x.opts.customMetadata,httpMetadata:x.opts.httpMetadata}:null;},
  get:async(key)=>{const x=objects.get(key);return x?{body:new Blob([x.bytes]).stream(),size:x.bytes.length,customMetadata:x.opts.customMetadata,httpEtag:'"unit-test"',writeHttpMetadata(h){h.set('Content-Type',x.opts.httpMetadata.contentType);}}:null;}
 };
 return {env:{ADMIN_PASSWORD:'test-password',ADMIN_SESSION_SECRET:'test-secret-64-characters-long-'+('a'.repeat(32)),DB:{prepare:q,batch:async qs=>{sql.exec('BEGIN');try{for(const x of qs)await x.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}},MEDIA,ASSETS:{fetch:async()=>new Response('ok')}},close:()=>sql.close()};
}
export async function request(env,url,method='GET',body,token='',extra={}){
 const headers={...extra};if(token)headers.Authorization='Bearer '+token;
 let payload=body;
 if(body!==undefined&&body!==null&&!(body instanceof Uint8Array)&&typeof body!=='string'){payload=JSON.stringify(body);headers['Content-Type']='application/json';}
 return worker.fetch(new Request('https://norrona.test'+url,{method,headers,body:payload===undefined?undefined:payload}),env);
}
