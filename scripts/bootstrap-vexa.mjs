import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const run=promisify(execFile),path=resolve('.env'),text=await readFile(path,'utf8');
const env=Object.fromEntries(text.split(/\r?\n/).filter(line=>line&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const gateway='http://127.0.0.1:8056';
if(env.VEXA_API_KEY){const check=await fetch(`${gateway}/bots/status`,{headers:{'x-api-key':env.VEXA_API_KEY}}).catch(()=>undefined);if(check?.ok){console.log('Existing Vexa API token is valid.');process.exit(0)}}
const found=await run('docker',['compose','--env-file','.env','ps','-q','vexa'],{cwd:resolve('.')});const container=found.stdout.trim();if(!container)throw new Error('The Vexa container is not running.');
async function admin(method,route,body){
  const command=body?`curl -sS -X ${method} -H "X-Admin-API-Key: $ADMIN_TOKEN" -H "Content-Type: application/json" --data '${body}' "http://127.0.0.1:8001${route}"`:`curl -sS -X ${method} -H "X-Admin-API-Key: $ADMIN_TOKEN" "http://127.0.0.1:8001${route}"`;
  const result=await run('docker',['exec',container,'sh','-lc',command]);return JSON.parse(result.stdout);
}
let user=await admin('POST','/admin/users','{"email":"meetings@cloudcore.local","name":"CloudCore Meetings","max_concurrent_bots":2}');if(!user?.id)user=await admin('GET','/admin/users/email/meetings%40cloudcore.local');
if(!user?.id)throw new Error('Unable to provision the Vexa user.');
const minted=await admin('POST',`/admin/users/${user.id}/tokens`,'{"scopes":["bot","tx"]}');if(!minted?.token)throw new Error('Unable to mint the Vexa token.');
const next=text.match(/^VEXA_API_KEY=/m)?text.replace(/^VEXA_API_KEY=.*$/m,`VEXA_API_KEY=${minted.token}`):`${text.trimEnd()}\nVEXA_API_KEY=${minted.token}\n`;
await writeFile(path,next,{encoding:'utf8',mode:0o600});try{await chmod(path,0o600)}catch{}
console.log('CloudCore Vexa user and private API token are ready. No token value was printed.');
