import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEvidenceDate,statedValidity,extractCertificateFact,certificateAnswer,missingAmountAnswer} from '../build/rag-facts.js';
const doc=(id,text,filename='Acme Certificate.pdf')=>({id,userId:'owner',filename,mimeType:'application/pdf',sizeBytes:1,storagePath:'unused',isShared:false,status:'ready',createdAt:'',updatedAt:'',extractedText:text});
const cert=(id,until='9-Apr-2030')=>doc(id,`CERTIFICATE OF CONFORMANCE\nCONSTRUCTED FACILITY\nThis is to certify that the constructed data center facilities of\nAcme Limited\nCommercial Data Center E-17\nExample City\nhas been independently assessed and found to conform to the requirements of:\nANSI/TIA-942-C-2024\nRated-3\nCertificate Number: TIA942ACME123\nCertificate validity: 10-Apr-2027 until ${until}`);
test('evidence dates validate calendar values and compare future dates deterministically',()=>{
  assert.equal(parseEvidenceDate('9-Apr-2030'),'2030-04-09');assert.equal(parseEvidenceDate('04 June 2027'),'2027-06-04');
  assert.equal(parseEvidenceDate('31-Feb-2027'),undefined);
  assert.equal(statedValidity({validFrom:'2027-04-10',validUntil:'2030-04-09'},'2028-10-20'),'within-stated-period');
  assert.equal(statedValidity({validUntil:'2027-05-25'},'2026-10-20'),'within-stated-period');
  assert.equal(statedValidity({validUntil:'2025-12-22'},'2026-10-20'),'expired');
  assert.equal(statedValidity({validUntil:'2030-04-09'},'2030-04-09'),'within-stated-period');
  const invalid=certificateAnswer([cert('invalid-date')],'As of 31 February 2027, is the TIA-942 certificate valid?','2026-10-20');
  assert.match(invalid.answer,/not a valid calendar date/);assert.equal(invalid.complete,false);
});
test('certificate fields come from the body rather than filename',()=>{
  const source={...cert('a'),filename:'Design Certificate.pdf'};const fact=extractCertificateFact(source);
  assert.equal(fact.scope,'Constructed facility');assert.equal(fact.identifier,'TIA942ACME123');assert.equal(fact.validUntil,'2030-04-09');
});
test('inventory deduplicates copies but preserves conflicting versions',()=>{
  const answer=certificateAnswer([cert('a'),cert('b'),cert('c','9-Apr-2031')],'List every distinct TIA-942 certificate and expiry as of 20 October 2028','2026-10-20');
  assert.ok(answer.answer.includes('1 distinct certificate record'));assert.equal(answer.documents.length,2);assert.match(answer.answer,/Source conflict/);
  assert.ok(answer.answer.includes('9 April 2030'));assert.ok(answer.answer.includes('9 April 2031'));assert.ok(!answer.answer.includes('Expired stated period'));
  const changedStandard={...cert('different-standard'),extractedText:cert('a').extractedText.replace('TIA-942-C-2024','TIA-942-B-2017')};
  const conflict=certificateAnswer([cert('a'),changedStandard],'List all distinct TIA-942 certificates and validity','2028-10-20');
  assert.match(conflict.answer,/Source conflict/);assert.equal(conflict.documents.length,2);
});
test('unprovided price cannot become an invented numeric quote',()=>{
  const answer=missingAmountAnswer([doc('p','Object storage is billed by capacity used. SLA 99.95%.')],'What exact monthly PKR price is charged per TB?');
  assert.match(answer.answer,/do \*\*not state/);assert.ok(!answer.answer.includes('12000'));
  assert.equal(missingAmountAnswer([doc('p','Price: PKR 1234 per TB per month.')],'What exact monthly PKR price is charged per TB?'),undefined);
});

test('certificate overview retains rating, scope and expired dates with fewer columns',()=>{
 const source={...cert('rated','9-Apr-2025'),extractedText:cert('rated','9-Apr-2025').extractedText.replace('CONSTRUCTED FACILITY','DESIGN DOCUMENTS').replace('10-Apr-2027','10-Apr-2024')};
 const answer=certificateAnswer([source],'data center certifications','2026-10-20');
 assert.match(answer.answer,/Rated-3/);assert.match(answer.answer,/Design documents/);assert.match(answer.answer,/\*\*\(expired\)\*\*/);
 assert.match(answer.answer,/\| Site \| Certification \/ scope \| Valid until \| Source \|/);
 assert.doesNotMatch(answer.answer,/counted once/);
});
