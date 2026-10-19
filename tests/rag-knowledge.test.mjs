import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../build/rag.js';

test('chunkText splits paragraph-dense text with sliding overlap', () => {
  const sampleDoc = `
# PTCL Smart Cloud - Data Center Facility

The Islamabad Data Center is a state-of-the-art tier-rated facility designed to ANSI/TIA-942 Rated-3 Constructed Facility standards.
It features redundant power supplies, precision cooling, and biometric multi-factor authentication.

## Network Architecture and Connectivity
High-speed redundant optical fiber connects the Islamabad facility directly to Lahore and Karachi core exchanges.
The dual active-active ring topology guarantees 99.982% uptime.

## Power and Cooling Infrastructure
Dual generator sets with 48 hours of autonomous diesel fuel storage provide uninterrupted backup power.
N+1 CRAC units maintain optimal temperature and humidity throughout server halls.
  `.repeat(4);

  const chunks = chunkText(sampleDoc, 80, 20);
  assert.ok(chunks.length >= 3, `Expected at least 3 chunks, got ${chunks.length}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    assert.equal(chunk.chunkIndex, i);
    assert.ok(chunk.content.length > 0);
    assert.ok(chunk.tokenCount > 0);
  }

  // Ensure content from beginning and end is preserved
  assert.ok(chunks[0].content.includes('ANSI/TIA-942'));
  assert.ok(chunks[chunks.length - 1].content.includes('temperature and humidity'));
});

test('chunkText handles empty and single sentence inputs gracefully', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('   \n\n  '), []);

  const single = chunkText('PTCL Smart Cloud provides secure cloud hosting.');
  assert.equal(single.length, 1);
  assert.equal(single[0].chunkIndex, 0);
  assert.equal(single[0].content, 'PTCL Smart Cloud provides secure cloud hosting.');
});
