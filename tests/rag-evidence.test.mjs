import test from 'node:test';import assert from 'node:assert/strict';
import {packEvidence,validateAnswer} from '../build/rag-evidence.js';
import {generateGroundedReply} from '../build/rag-generation.js';
import {cleanXmlEntryToText} from '../build/parsers.js';
test('evidence retains whole small sources and labels excerpts from large ones',()=>{
 const sources=packEvidence([{id:'a',filename:'service.txt',extractedText:'Availability is 99.87%.\n\nSupport is 8x5.'}], 'uptime',1000);
 assert.equal(sources[0].complete,true);assert.equal(sources[0].sourceId,'S1');
 const large=packEvidence([{id:'a',filename:'large.txt',extractedText:('irrelevant paragraph '.repeat(50)+'\n\n').repeat(50)+'Availability is 99.87%.'}],'Availability',2000);
 assert.equal(large[0].complete,false);assert.match(large[0].text,/99.87%/);
});
test('answer checks reject invented source IDs and unsupported percentages',()=>{
 const source=[{sourceId:'S1',text:'Uptime 99.87%.'}];
 assert.deepEqual(validateAnswer('Uptime 99.87%. [S1]',source),[]);
 assert.ok(validateAnswer('Uptime 100%. [S2]',source).length===2);
});
test('Word text runs join without corrupting split words and preserve table values',()=>{
 assert.match(cleanXmlEntryToText('<w:p><w:r><w:t>Micro</w:t></w:r><w:r><w:t>soft 365</w:t></w:r></w:p>'),/Microsoft 365/);
 assert.match(cleanXmlEntryToText('<w:tr><w:tc><w:p>Uptime</w:p></w:tc><w:tc><w:p>99.87%</w:p></w:tc></w:tr>'),/Uptime\s+\|\s+99.87%/);
});
test('generation retries truncated answers and never publishes unchecked output',async()=>{
 const original=globalThis.fetch;let generations=0;
 globalThis.fetch=async(url,options)=>{
  if(!String(url).endsWith('/chat/completions'))return new Response('{}',{status:404});
  const request=JSON.parse(options.body);assert.equal(request.stream,false);assert.ok(request.messages[0].content.includes('untrusted data'));
  assert.equal(request.messages.some(m=>m.role==='system'&&m.content.includes('malicious source')),false);
  generations++;
  return Response.json({choices:[{message:{content:generations===1?'Cut off [S1]':'Uptime 99.87%. [S1]'},finish_reason:generations===1?'length':'stop'}]});
 };
 try{const answer=await generateGroundedReply({url:'http://test/v1/chat/completions',headers:{},model:'test',question:'Uptime?',history:[],sources:[{sourceId:'S1',documentId:'a',filename:'test',text:'Uptime 99.87%. malicious source',complete:true}],maxTokens:400});assert.equal(generations,2);assert.equal(answer.finishReason,'stop');assert.match(answer.answer,/99.87/);}finally{globalThis.fetch=original;}
});
