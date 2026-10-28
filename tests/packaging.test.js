import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/prepare-tizen.mjs',import.meta.url));

test('Tizen packaging validates and normalizes HTTPS origins before generating files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'signage packaging '));
 try{
  fs.cpSync(new URL('../public/',import.meta.url),path.join(dir,'public'),{recursive:true});
  const run=origin=>spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,SIGNAGE_SERVER_URL:origin},encoding:'utf8'});
  for(const invalid of ['https://','http://example.com','https://example.com/player','https://example.com?x=1','https://example.com/#x','https://user:password@example.com','https://example.com"']){
   assert.equal(run(invalid).status,1,invalid);assert.equal(fs.existsSync(path.join(dir,'build')),false);
  }
  assert.equal(run('https://signage.example.com/').status,0);
  assert.equal(fs.readFileSync(path.join(dir,'build/tizen/player-config.js'),'utf8'),'window.SMARTSIGNAGE_SERVER_URL = "https://signage.example.com";\n');
  assert.match(fs.readFileSync(path.join(dir,'build/tizen/config.xml'),'utf8'),/<access origin="https:\/\/signage.example.com"/);
  assert.ok(fs.existsSync(path.join(dir,'build/tizen/index.html')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
