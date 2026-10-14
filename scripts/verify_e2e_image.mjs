// scripts/verify_e2e_image.mjs
// Full End-to-End Image Generation and Knowledge Hub Integration Verification
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
console.log(`Starting End-to-End Image Studio Verification against ${BASE_URL}...`);

async function run() {
  // 1. Authenticate
  console.log('1. Authenticating as dev user (azeemniazi)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'X-Requested-With': 'CloudCoreAI'
    },
    body: JSON.stringify({
      username: 'azeemniazi',
      password: 'fatimaarif'
    })
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'Expected session cookie');
  console.log('   Authenticated successfully.');

  // 2. Enhance Prompt Verification
  console.log('2. Testing prompt enhancement API (/api/images/enhance-prompt)...');
  const enhanceRes = await fetch(`${BASE_URL}/api/images/enhance-prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Origin': BASE_URL,
      'X-Requested-With': 'CloudCoreAI'
    },
    body: JSON.stringify({ prompt: 'Smart telecom satellite station' })
  });
  assert.equal(enhanceRes.status, 200, `Enhance prompt failed: ${enhanceRes.status}`);
  const enhanceData = await enhanceRes.json();
  assert.ok(enhanceData.enhancedPrompt, 'Expected enhancedPrompt in response');
  console.log(`   Enhanced prompt: "${enhanceData.enhancedPrompt.slice(0, 60)}..."`);

  // 3. Verify Generated Asset in History
  console.log('3. Fetching generated asset history (/api/images/history)...');
  const histRes = await fetch(`${BASE_URL}/api/images/history`, {
    headers: { 'Cookie': cookie }
  });
  assert.equal(histRes.status, 200);
  const histData = await histRes.json();
  assert.ok(Array.isArray(histData.assets) && histData.assets.length > 0, 'Expected at least 1 generated asset');
  const asset = histData.assets[0];
  console.log(`   Found generated asset: ID=${asset.id}`);
  console.log(`   Filename: ${asset.filename}`);
  console.log(`   URL: ${asset.url}`);
  console.log(`   Duration: ${asset.durationMs}ms`);
  assert.ok(asset.url.endsWith('.png'), `Expected PNG image, got: ${asset.url}`);

  // 4. Verify Image Binary Serving
  console.log('4. Verifying image binary delivery (/api/images/generated/...)...');
  const imgRes = await fetch(`${BASE_URL}${asset.url}`, {
    headers: { 'Cookie': cookie }
  });
  assert.equal(imgRes.status, 200, `Failed to fetch generated image binary: ${imgRes.status}`);
  assert.equal(imgRes.headers.get('content-type'), 'image/png');
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  assert.ok(imgBuffer.length > 50000, `Generated PNG file seems too small: ${imgBuffer.length} bytes`);
  // Verify PNG signature (89 50 4E 47 0D 0A 1A 0A)
  assert.equal(imgBuffer[0], 0x89);
  assert.equal(imgBuffer[1], 0x50);
  assert.equal(imgBuffer[2], 0x4e);
  assert.equal(imgBuffer[3], 0x47);
  console.log(`   Verified valid PNG header. Binary size: ${(imgBuffer.length / 1024).toFixed(1)} KB.`);

  // 5. Save Generated Asset to Knowledge Hub
  console.log('5. Saving generated image directly to Knowledge Hub (/api/images/:id/save-to-knowledge)...');
  const saveRes = await fetch(`${BASE_URL}/api/images/${asset.id}/save-to-knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Origin': BASE_URL,
      'X-Requested-With': 'CloudCoreAI'
    },
    body: JSON.stringify({
      filename: 'PTCL_Fiber_Network_Visual.png',
      isShared: true
    })
  });
  if (!saveRes.ok) throw new Error(`Save to Knowledge Hub failed: ${saveRes.status} ${await saveRes.text()}`);
  const saveData = await saveRes.json();
  assert.ok(saveData.success, 'Expected success=true');
  assert.equal(saveData.document.mimeType, 'image/png');
  assert.equal(saveData.document.filename, 'PTCL_Fiber_Network_Visual.png');
  console.log(`   Saved to Knowledge Hub as document ID: ${saveData.document.id}`);
  console.log(`   MIME: ${saveData.document.mimeType}, Size: ${(saveData.document.sizeBytes / 1024).toFixed(1)} KB`);

  // 6. Verify Document in Knowledge Hub
  console.log('6. Verifying saved document appears in Knowledge Hub documents list (/api/knowledge/documents)...');
  const docsRes = await fetch(`${BASE_URL}/api/knowledge/documents?scope=all`, {
    headers: { 'Cookie': cookie }
  });
  assert.equal(docsRes.status, 200);
  const docsData = await docsRes.json();
  const savedDoc = docsData.documents.find(d => d.id === saveData.document.id);
  assert.ok(savedDoc, 'Saved document should be listed in Knowledge Hub');
  console.log(`   Confirmed in Knowledge Hub: "${savedDoc.filename}" (${savedDoc.status}, ${(savedDoc.sizeBytes / 1024).toFixed(1)} KB)`);

  // 7. Verify Knowledge Hub Preview Serving
  console.log('7. Verifying document preview serving (/api/knowledge/documents/:id/preview)...');
  const prevRes = await fetch(`${BASE_URL}/api/knowledge/documents/${savedDoc.id}/preview`, {
    headers: { 'Cookie': cookie }
  });
  assert.equal(prevRes.status, 200);
  assert.equal(prevRes.headers.get('content-type'), 'image/png');
  const prevBuf = Buffer.from(await prevRes.arrayBuffer());
  assert.equal(prevBuf.length, imgBuffer.length);
  console.log(`   Verified preview streams exact PNG binary (${(prevBuf.length / 1024).toFixed(1)} KB)`);

  console.log('\n======================================================');
  console.log('  ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY!   ');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
