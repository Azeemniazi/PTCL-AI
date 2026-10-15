/** Explicit live-engine canary. Uses the configured engine and never changes its release flag. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {probeImageEngine,remixImage} from '../build/image-engine.js';

if(process.argv.includes('--help')) {
  console.log('Run against the configured IMAGE_ENGINE_URL. Creates three seeded image-to-image outputs in artifacts/studio-remix-canary, checks reference sensitivity, and leaves IMAGE_REMIX_VERIFIED unchanged. Review the output images before enabling Remix.');
  process.exit(0);
}
const base=(process.env.IMAGE_ENGINE_URL||process.env.FLUX_ENGINE_URL||'http://127.0.0.1:8006').replace(/\/$/,'');
const capabilities=await probeImageEngine(base,false);
if(!capabilities.generation||!capabilities.remixSupported) throw Error(capabilities.remixMessage);
const output=resolve('artifacts/studio-remix-canary');mkdirSync(output,{recursive:true});
const reference=async(color,shape)=>sharp(Buffer.from(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#f4f0e8"/>${shape==='circle'?`<circle cx="256" cy="256" r="140" fill="${color}"/>`:`<rect x="116" y="116" width="280" height="280" fill="${color}"/>`}</svg>`)).png().toBuffer();
const first=await reference('#b5342e','circle'),second=await reference('#2c5cab','square');
writeFileSync(resolve(output,'reference-a.png'),first);writeFileSync(resolve(output,'reference-b.png'),second);
const params={prompt:'A sculptural object on a warm neutral background, soft natural light. Retain the main color and shape of the reference.',width:512,height:512,seed:847231,strength:.35};
console.log(`Running three sequential reference tests with ${capabilities.model}. CPU inference can take several minutes per image.`);
const results=[];
for(const [name,image] of [['result-a.png',first],['result-a-repeat.png',first],['result-b.png',second]]) {
  console.log(`Creating ${name}…`);const result=await remixImage(base,{...params,reference:image});
  writeFileSync(resolve(output,name),result);results.push(await sharp(result).resize(64,64,{fit:'fill'}).removeAlpha().raw().toBuffer());
}
const difference=(a,b)=>a.reduce((sum,value,n)=>sum+Math.abs(value-b[n]),0)/(a.length*255);
const repeatDifference=difference(results[0],results[1]),referenceDifference=difference(results[0],results[2]);
const passed=repeatDifference<.01&&referenceDifference>.015&&referenceDifference>repeatDifference*5;
writeFileSync(resolve(output,'report.json'),JSON.stringify({model:capabilities.model,createdAt:new Date().toISOString(),seed:params.seed,strength:params.strength,repeatDifference,referenceDifference,passed},null,2));
if(!passed) throw Error('Reference sensitivity could not be established reliably. Keep IMAGE_REMIX_VERIFIED=false and inspect the model/adapter.');
console.log('Reference sensitivity check passed. Inspect both results for retained reference structure and the requested edit. Only after that review, set IMAGE_REMIX_VERIFIED=true and restart the app. No configuration was changed automatically.');
