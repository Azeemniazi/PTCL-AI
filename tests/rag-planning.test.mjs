import test from 'node:test';
import assert from 'node:assert/strict';
import {selectKnowledgeDocuments,sourceTextQuality} from '../build/rag-planning.js';
const doc=(id,filename,text)=>({id,userId:'u',filename,mimeType:'text/plain',sizeBytes:1,storagePath:'unused',isShared:true,status:'ready',createdAt:'',updatedAt:'',extractedText:text});
const tia=(id,filename,site)=>doc(id,filename,`CERTIFICATE OF CONFORMANCE\nCONSTRUCTED FACILITY\nThis is to certify that the constructed data center facilities of\nAcme\n${site}\nhas been independently assessed and found to conform to the requirements of:\nANSI/TIA-942-C-2024\nCertificate Number: TIA${id}\nCertificate validity: 1-Jan-2027 until 1-Jan-2030`);
test('catalog identity routing does not substitute a semantically similar facility',()=>{
  const docs=[tia('a','CDDT H9 Design Certificate.pdf','CDDT H9'),tia('b','CDDT H9 Facility Certificate.pdf','CDDT H9'),tia('c','Satellite Town Certificate.pdf','Satellite Town')];
  assert.deepEqual(selectKnowledgeDocuments(docs,'Compare CDDT H9 design and constructed-facility certificates').documents.map(d=>d.id).sort(),['a','b']);
});
test('multi-entity comparison preserves both requested entities',()=>{
  const docs=[tia('a','Lahore Certificate.pdf','Wafaqi Colony Lahore'),tia('b','Karachi Certificate.pdf','I.I. Chundrigar Road Karachi'),tia('c','Marston Certificate.pdf','Marston Road Karachi')];
  assert.deepEqual(selectKnowledgeDocuments(docs,'Compare Wafaqi Colony Lahore and I.I. Chundrigar Road Karachi certificates').documents.map(d=>d.id).sort(),['a','b']);
});
test('entity comparisons retain groups with unequal version counts',()=>{
 const docs=[tia('a','CDDT H9 Design Certificate.pdf','CDDT H9'),tia('b','CDDT H9 Facility Certificate.pdf','CDDT H9'),tia('c','Satellite Town Certificate.pdf','Satellite Town Rawalpindi'),tia('d','Garden Town Certificate.pdf','Garden Town')];
 assert.deepEqual(selectKnowledgeDocuments(docs,'Compare CDDT H9 and Satellite Town Rawalpindi certificates').documents.map(d=>d.id).sort(),['a','b','c']);
});
test('bad extraction is identified before it becomes model evidence',()=>{
  assert.equal(sourceTextQuality('en-US '.repeat(100)+'Adobe UCS MIT_License').usable,false);
  assert.equal(sourceTextQuality('Red Hat Partner Program\nTier: Ready').usable,true);
});
test('readable source rendition is chosen over corrupted PDF metadata',()=>{
  const docs=[doc('p','Example BaaS.pdf','en-PK '.repeat(100)+'Adobe UCS MIT_License'),doc('w','Example BaaS.docx','Backup as a Service\nData retained for 90 days.')];
  const plan=selectKnowledgeDocuments(docs,'What is BaaS retention?');
  assert.deepEqual(plan.documents.map(d=>d.id),['w']);assert.equal(plan.unusable.length,1);
});

test('broad certification requests are complete across colloquial and polite phrasing',()=>{
 const docs=[tia('a','Pakistan_PTCL_CDDT_H9_Certificate.pdf','CDDT H9'),tia('b','Garden_Town_Certificate.pdf','Garden Town'),tia('c','Satellite Town Certificate.pdf','Satellite Town Rawalpindi'),doc('iso','ISO 27001.pdf','Certificate PK25/123\nThis is to certify ISO/IEC 27001:2022'),doc('pci','PCI.pdf','CERTIFICATE OF COMPLIANCE\nThis is to certify PCI DSS v4.0.1'),doc('partner','Partner.pdf','Partner Program\nTier: Ready')];
 for(const q of ['can u tell me the datacenter certifications','can u tell me the datacenter certifications all please','can u tell me all data center certifications?','data center certifications','please list data centre certifications','what certifications do you have for data centers?']){
  const plan=selectKnowledgeDocuments(docs,q);
  assert.deepEqual(plan.documents.map(d=>d.id).sort(),['a','b','c','iso','pci'],q);assert.equal(plan.exhaustive,true,q);
 }
 assert.deepEqual(selectKnowledgeDocuments(docs,'Tell me the Garden Town certifications please').documents.map(d=>d.id),['b']);
 assert.deepEqual(selectKnowledgeDocuments(docs,'What certifications does Atlantis hold?').documents,[]);
});
