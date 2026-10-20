import test from 'node:test';import assert from 'node:assert/strict';
import {responsibilityAnswer,qualifiedFeatureAnswer,availabilityAnswer,serviceOverviewAnswer} from '../build/rag-tables.js';
test('responsibility output preserves actual assignment columns and separate conditional clauses',()=>{
 const source={id:'a',filename:'Other company.txt',extractedText:'1. Options\n| Option | Details |\n| --- | --- |\n| Managed operation | Provider operates jobs [if purchased] |\n\n2. Responsibilities\n| Area | Provider responsibility | Customer responsibility |\n| --- | --- | --- |\n| Encryption passwords and key safekeeping | YES | |\n| Backup schedules | | YES (provider advises) |\n| Restore validation | | YES (provider assists) |\n| Monitoring | | YES unless managed option purchased |\n\n3. Security\nKeys remain with the provider unless a customer-owned option is selected.'};
 const result=responsibilityAnswer([source],'Who safeguards encryption passwords, designs backup schedules and validates restores? Include managed qualifications.');
 assert.ok(result);assert.match(result.answer,/Encryption passwords and key safekeeping \| YES \|/);assert.match(result.answer,/Backup schedules \| \| YES/);assert.match(result.answer,/\[if purchased\]/);assert.match(result.answer,/Keys remain with the provider unless/);assert.equal(result.documents[0].id,'a');
});
test('service comparisons quote actual definitions and primary technology without adding feature promises',()=>{
 const a={id:'a',filename:'Ledger.txt',extractedText:'1.1 What is Ledger?\nLedger stores audit entries using StoneDB. It is used for immutable records.\n1.2 Benefits\nOther details.\n2.1 Architecture\nClients connect to StoneDB over a local endpoint. Other features are optional.\n2.2 Components\nDetails.'};
 const b={id:'b',filename:'Queue.txt',extractedText:'1.1 What is Queue?\nQueue delivers tasks using BirchBus. An unfinished source\n1.2 Benefits\nOther details.\n2.1 Architecture\nTasks are delivered by BirchBus workers. Optional recovery needs approval.\n2.2 Components\nDetails.'};
 const answer=serviceOverviewAnswer([a,b],'Explain the difference, technologies and when each is used.');
 assert.ok(answer);assert.match(answer.answer,/StoneDB/);assert.match(answer.answer,/BirchBus/);assert.ok(!answer.answer.includes('unfinished'));assert.ok(!answer.answer.includes('Optional recovery'));assert.equal(serviceOverviewAnswer([a,b],'Compare pricing and support.'),undefined);
});
test('availability comparison retains distinct percentages and complete stated hours handling',()=>{
 const a={id:'a',filename:'Facility.txt',extractedText:'| Facility Availability | 99.87% uptime, available 24×7×365. |\nOn-site technical support staffed 24×7×365.'};
 const b={id:'b',filename:'Storage.txt',extractedText:'99.61% uptime.\nTechnical support is available on an 8×5 basis during the following hours:\nMonday to Friday: 10:00 AM to 6:00 PM\nPublic holidays excluded.\nOutside-hours requests handled the next business day.\n5. Security'};
 const answer=availabilityAnswer([a,b],'Compare uptime and support coverage.');
 assert.ok(answer);assert.match(answer.answer,/99.87/);assert.match(answer.answer,/99.61/);assert.match(answer.answer,/next business day/);assert.match(answer.answer,/10:00/);assert.ok(!answer.answer.includes('5. Security'));assert.equal(answer.documents.length,2);
});
test('confirmation answers preserve only requested feature statements and their placeholders',()=>{
 const source={id:'b',filename:'Features.txt',extractedText:'Object storage cluster\n| Feature | Description |\n| --- | --- |\n| External identity | LDAP or OpenID Connect [confirm] |\n| Replication | To a second site [optional add-on, confirm] |\n| Notifications | Webhooks [confirm] |\n\nMFA for portal access [confirm enforcement]'};
 const result=qualifiedFeatureAnswer([source],'Does the OBS document unconditionally confirm LDAP/OpenID integration, enforced MFA and second-site replication?');
 assert.ok(result);assert.match(result.answer,/LDAP/);assert.match(result.answer,/MFA/);assert.match(result.answer,/second site/);assert.ok(!result.answer.includes('Webhooks'));assert.ok(!result.answer.includes('Object storage cluster'));assert.match(result.answer,/not unconditional/);
});
