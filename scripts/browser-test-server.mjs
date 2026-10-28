// Own a fresh, local-only database per test run; never touch development/remote state.
import {spawnSync,spawn} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
fs.mkdirSync(new URL('../.wrangler/',import.meta.url),{recursive:true});
const state=fs.mkdtempSync(new URL('../.wrangler/browser-tests-',import.meta.url));
const cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const config=fileURLToPath(new URL('../tests/browser/wrangler.toml',import.meta.url));
const migrate=spawnSync(process.execPath,[cli,'d1','migrations','apply','signage-browser-tests','--local','--config',config,'--persist-to',state],{stdio:'inherit'});
if(migrate.status!==0){fs.rmSync(state,{recursive:true,force:true});process.exit(migrate.status||1);}
const child=spawn(process.execPath,[cli,'dev','--local','--config',config,'--persist-to',state,'--ip','127.0.0.1','--port','8790','--inspector-port','0'],{stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{fs.rmSync(state,{recursive:true,force:true});process.exit(code||0);});
