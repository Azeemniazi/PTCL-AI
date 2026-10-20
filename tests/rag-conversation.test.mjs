import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantIdentityAnswer,augmentConversationalQuery} from '../build/rag-conversation.js';
import {shouldQueryKnowledgeBase} from '../build/rag.js';

test('product identity handles everyday spelling without searching the knowledge base',()=>{
 for(const q of ['who are u','who r u?','who are you?','what is ur name','what’s your name?','introduce yourself','tell me about yourself please']){
  assert.match(assistantIdentityAnswer(q),/CloudCore AI/);
  assert.equal(shouldQueryKnowledgeBase(q),false,q);
  assert.equal(shouldQueryKnowledgeBase(q,{mode:'document',id:'any'}),false,q);
 }
 assert.equal(assistantIdentityAnswer('who are the ISO auditors?'),undefined);
 assert.equal(shouldQueryKnowledgeBase('who are the ISO auditors?'),true);
});

test('new certificate inventories do not inherit entities from previous assistant answers',()=>{
 const history=[{role:'user',content:'Tell me about Satellite Town certification'},{role:'assistant',content:'TIA-942-B, Garden Town, Satellite Town [S1]'}];
 for(const query of ['can u tell me all data center certifications?','what ISO certificates are available?','can u tell me the datacenter certifications'])assert.equal(augmentConversationalQuery(query,history),query);
 const followup=augmentConversationalQuery('all please',history);
 assert.match(followup,/Tell me about Satellite Town certification/);
 assert.doesNotMatch(followup,/Garden Town/);
 assert.match(augmentConversationalQuery('when does it expire?',history),/Satellite Town/);
 assert.match(augmentConversationalQuery('when does this certificate expire?',history),/Satellite Town/);
 assert.equal(augmentConversationalQuery('who are u',history),'who are u');
});
