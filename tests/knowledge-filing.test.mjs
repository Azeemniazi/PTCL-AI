import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilingAudit, contractsRoot, manualFilingName, namedCustomerLookup } from '../build/knowledge-filing.js';
import { Repository } from '../build/repository.js';

const folder = (id, name, parentId, isShared = true) => ({ id, name, parentId, isShared });
const folders = [
  folder('contracts', 'Cloud Contracts'), folder('north', 'Contracts North', 'contracts'),
  folder('south', 'Contracts South', 'contracts'), folder('karachi', 'Karachi customer all possible data', 'south'),
  folder('askari', 'Askari Bank', 'north'), folder('hilton', 'Hilton Pharma', 'south'),
  folder('al1', 'Al-Ghazi', 'south'), folder('al2', 'Al Ghazi', 'karachi'),
  folder('mcb', 'MCB', 'north'), folder('mcb-islamic', 'MCB Islamic', 'mcb'),
  folder('private', 'Personal', 'contracts', false),
];
const doc = (id, folderId, filename, extractedText, options = {}) =>
  ({ id, folderId, filename, extractedText, status: 'ready', isShared: true, ...options });

test('filing uses counterparty text, keeps coherent groups and highlights conflicting clues', () => {
  const root = contractsRoot(folders);
  const { entries, customers } = buildFilingAudit(root, folders, [
    doc('askari', 'askari', 'PTCL DATA CENTER contract.pdf', '--- Page 1 ---\nCustomer: Askari Bank Limited'),
    doc('hilton', 'karachi', 'Order.pdf', 'Issued to: Hilton Pharma', { contentHash: 'same' }),
    doc('hilton-copy', 'hilton', 'Order (1).pdf', 'Issued to: Hilton Pharma', { contentHash: 'same' }),
    doc('conflict', 'al2', 'Al Ghazi invoice.pdf', 'Bill to: Hilton Pharma'),
    doc('mentioned', 'south', 'Newsletter.pdf', 'News from Hilton Pharma.'),
    doc('mcb', 'mcb-islamic', 'SLA.pdf', 'Customer: MCB Islamic Bank Limited'),
    doc('private', 'private', 'Letter.pdf', 'Customer: Askari Bank'),
  ]);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  assert.equal(byId.get('askari').action, 'keep');
  assert.equal(byId.get('askari').evidence.section, 'Page 1');
  assert.equal(byId.get('hilton').action, 'move');
  assert.deepEqual(byId.get('hilton').destination, ['Cloud Contracts', 'Hilton Pharma']);
  assert.equal(byId.get('hilton').site, 'Karachi');
  assert.equal(byId.get('hilton').region, 'South');
  assert.equal(byId.get('hilton').duplicate, 'identical');
  assert.equal(byId.get('hilton-copy').action, 'keep');
  assert.equal(byId.get('conflict').action, 'review');
  assert.equal(byId.get('conflict').canFileManually, true);
  assert.equal(byId.get('mentioned').action, 'review');
  assert.equal(byId.get('mcb').customer, 'MCB Islamic');
  assert.equal(byId.has('private'), false);
  assert.equal(customers.find(customer => customer.id === 'al1').aliases.length, 2);
  assert.equal(namedCustomerLookup('Find me the resources of Hilton Pharma', folders), 'hilton pharma');
  assert.equal(manualFilingName('../Hilton Pharma'), undefined);
  assert.equal(manualFilingName('Contracts North'), undefined);
  assert.equal(manualFilingName(' Hilton   Pharma '), 'Hilton Pharma');
});

test('unreadable files receive recovery actions and multi-customer trackers go to shared references', () => {
  const { entries } = buildFilingAudit(contractsRoot(folders), folders, [
    doc('pdf', 'south', 'Hilton Pharma.pdf', '', { status: 'failed' }),
    doc('archive', 'south', 'Hilton Pharma.rar', '', { status: 'failed' }),
    doc('tracker', 'south', 'Onboarding Tickets.xlsx', '| Customer | RAM |\n| --- | --- |\n| Askari Bank | 64 |'),
  ]);
  assert.deepEqual(entries.map(entry => [entry.action, entry.recovery, entry.destination?.at(-1)]), [
    ['review', 'pdf', undefined], ['review', 'archive', undefined], ['move', undefined, 'Shared references'],
  ]);
});

test('approved placement preserves document identity, visibility and region and rejects stale moves', async () => {
  const repository = new Repository();
  const user = await repository.createUser({ username: 'filing-test', passwordHash: 'unused', salt: 'unused', displayName: 'Filing', role: 'dev' });
  const root = await repository.createFolder({ name: 'Cloud Contracts', userId: user.id });
  const source = await repository.createFolder({ name: 'Contracts South', userId: user.id, parentId: root.id });
  const id = await repository.ensureSharedFilingFolder(root.id, 'Hilton Pharma', user.id);
  assert.equal(await repository.ensureSharedFilingFolder(root.id, 'Hilton Pharma', user.id), id);
  const record = await repository.createDocument({
    userId: user.id, folderId: source.id, filename: 'Invoice.pdf', mimeType: 'application/pdf',
    sizeBytes: 100, storagePath: 'invoice.pdf', isShared: true,
  });
  const filing = { sourceFolderId: source.id, rootId: root.id, updatedAt: record.updatedAt, location: { region: 'South', verifiedFolderId: id } };
  const updated = await repository.updateDocument(record.id, user.id, { folderId: id, filing }, true);
  assert.equal(updated.id, record.id);
  assert.equal(updated.storagePath, 'invoice.pdf');
  assert.equal(updated.isShared, true);
  assert.equal(updated.filingLocation.region, 'South');
  assert.equal(await repository.updateDocument(record.id, user.id, { folderId: id, filing }, true), undefined);
  await repository.close();
});
