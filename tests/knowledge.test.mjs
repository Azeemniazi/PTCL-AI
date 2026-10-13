import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../build/crypto.js';
import { Repository } from '../build/repository.js';

test('Knowledge Hub: folder creation, scope filtering, and permissions', async () => {
  const repo = new Repository();
  await repo.init();

  const devUser = await repo.findUserByUsername('azeemniazi');
  assert.ok(devUser);

  const newPass = await hashPassword('pass123');
  const regularUser = await repo.createUser({
    username: 'worker1',
    passwordHash: newPass.hash,
    salt: newPass.salt,
    displayName: 'Worker One',
    role: 'user'
  });

  // 1. Create a Shared folder by regularUser
  const sharedFolder = await repo.createFolder({
    userId: regularUser.id,
    name: 'RAN Architecture',
    isShared: true,
    color: '#005437'
  });
  assert.ok(sharedFolder.id);
  assert.equal(sharedFolder.name, 'RAN Architecture');
  assert.equal(sharedFolder.isShared, true);

  // 2. Create a Personal/Private folder by regularUser
  const personalFolder = await repo.createFolder({
    userId: regularUser.id,
    name: 'Private Notes',
    isShared: false
  });
  assert.equal(personalFolder.isShared, false);

  // 3. RegularUser lists folders:
  // - 'all' should see both
  const myAllFolders = await repo.listFolders(regularUser.id, 'all');
  assert.equal(myAllFolders.length, 2);

  // - 'personal' should see only Private Notes
  const myPersonal = await repo.listFolders(regularUser.id, 'personal');
  assert.equal(myPersonal.length, 1);
  assert.equal(myPersonal[0].name, 'Private Notes');

  // - 'shared' should see only RAN Architecture
  const sharedOnly = await repo.listFolders(regularUser.id, 'shared');
  assert.equal(sharedOnly.length, 1);
  assert.equal(sharedOnly[0].name, 'RAN Architecture');

  // 4. Another user (devUser) lists folders:
  // - should see sharedFolder, but NOT personalFolder!
  const devViewFolders = await repo.listFolders(devUser.id, 'all');
  assert.equal(devViewFolders.some(f => f.id === sharedFolder.id), true);
  assert.equal(devViewFolders.some(f => f.id === personalFolder.id), false, 'Private folder must be hidden from other users');

  // 5. Updating folder:
  // Another user cannot rename without privilege
  await assert.rejects(
    async () => repo.updateFolder(personalFolder.id, devUser.id, { name: 'Hacked' }, false),
    /Unauthorized/
  );

  // Dev user CAN rename with isPrivileged = true
  const updatedByDev = await repo.updateFolder(personalFolder.id, devUser.id, { name: 'Admin Renamed' }, true);
  assert.equal(updatedByDev?.name, 'Admin Renamed');

  // Owner can rename
  const updatedByOwner = await repo.updateFolder(sharedFolder.id, regularUser.id, { name: 'RAN & Microwave Specs' }, false);
  assert.equal(updatedByOwner?.name, 'RAN & Microwave Specs');
});

test('Knowledge Hub: document lifecycle, batch upload, moving, and cascading deletion', async () => {
  const repo = new Repository();
  await repo.init();

  const user = await repo.findUserByUsername('azeemniazi');
  assert.ok(user);

  // Create folder
  const folder = await repo.createFolder({
    userId: user.id,
    name: 'Operations Manuals',
    isShared: true
  });

  // Create 3 documents in folder
  const doc1 = await repo.createDocument({
    userId: user.id,
    folderId: folder.id,
    filename: 'RAN-Manual.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 102400,
    storagePath: 'doc1.pdf',
    isShared: true,
    extractedText: 'Microwave links and high frequency transmission antennas.'
  });

  const doc2 = await repo.createDocument({
    userId: user.id,
    folderId: folder.id,
    filename: 'Fiber-SLA.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 45000,
    storagePath: 'doc2.docx',
    isShared: true,
    extractedText: 'Service level agreement for dark fiber connectivity.'
  });

  const doc3 = await repo.createDocument({
    userId: user.id,
    folderId: null, // Root document
    filename: 'Unfiled-Notes.txt',
    mimeType: 'text/plain',
    sizeBytes: 1200,
    storagePath: 'doc3.txt',
    isShared: false,
    extractedText: 'Meeting reminders and to-do lists.'
  });

  // Check folder metrics
  const folderWithCounts = await repo.getFolderById(folder.id);
  assert.equal(folderWithCounts?.fileCount, 2);
  assert.equal(folderWithCounts?.totalSizeBytes, 102400 + 45000);

  // Filter documents by search
  const searchResults = await repo.listDocuments(user.id, { search: 'microwave' });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].filename, 'RAN-Manual.pdf');

  // Filter documents by type
  const pdfResults = await repo.listDocuments(user.id, { type: 'pdf' });
  assert.equal(pdfResults.length, 1);
  assert.equal(pdfResults[0].filename, 'RAN-Manual.pdf');

  const wordResults = await repo.listDocuments(user.id, { type: 'word' });
  assert.equal(wordResults.length, 1);
  assert.equal(wordResults[0].filename, 'Fiber-SLA.docx');

  // Batch move: move doc3 into the folder
  const moved = await repo.batchMoveDocuments([doc3.id], folder.id, user.id, false);
  assert.deepEqual(moved, [doc3.id]);

  const afterMove = await repo.getDocumentById(doc3.id);
  assert.equal(afterMove?.folderId, folder.id);

  // Batch delete: delete doc1 and doc2
  const deleted = await repo.batchDeleteDocuments([doc1.id, doc2.id], user.id, false);
  assert.equal(deleted.length, 2);

  const afterDeleteDocs = await repo.listDocuments(user.id, { folderId: folder.id });
  assert.equal(afterDeleteDocs.length, 1);
  assert.equal(afterDeleteDocs[0].id, doc3.id);

  // Cascade delete folder: should delete doc3 as well
  await repo.deleteFolder(folder.id, user.id, true, false);
  const remaining = await repo.getDocumentById(doc3.id);
  assert.equal(remaining, undefined, 'Document should be deleted when parent folder is deleted with cascade');
});
