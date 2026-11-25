import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import sharp from 'sharp';
import { extractKnowledgePdf, missingPdfTools } from '../build/knowledge-pdf.js';

export async function syntheticPdf() {
  const jpeg = await sharp(Buffer.from(
    '<svg width="600" height="220"><rect width="600" height="220" fill="white"/>' +
    '<text x="30" y="105" font-family="sans-serif" font-size="24">Scanned renewal period is 48 months.</text></svg>'
  )).jpeg().toBuffer();
  const pdfStream = (content, properties = '') => Buffer.concat([
    Buffer.from('<< /Length ' + content.length + ' ' + properties + ' >>\nstream\n'),
    Buffer.from(content), Buffer.from('\nendstream'),
  ]);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    pdfStream('BT /F1 20 Tf 50 700 Td (Synthetic contract reference number is CC-49215.) Tj ET'),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im 7 0 R >> >> /Contents 8 0 R >>',
    pdfStream(jpeg, '/Type /XObject /Subtype /Image /Width 600 /Height 220 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode'),
    pdfStream('q 550 0 0 200 20 530 cm /Im Do Q'),
  ];
  let pdf = Buffer.from('%PDF-1.4\n');
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf = Buffer.concat([pdf, Buffer.from((index + 1) + ' 0 obj\n'), Buffer.from(object), Buffer.from('\nendobj\n')]);
    return String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  return Buffer.concat([pdf, Buffer.from('xref\n0 ' + (offsets.length + 1) + '\n0000000000 65535 f \n' + offsets.join('') +
    'trailer\n<< /Size ' + (offsets.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + pdf.length + '\n%%EOF\n')]);
}

test('Knowledge PDF processes only scanned pages and rejects incomplete extraction', async t => {
  const missing = await missingPdfTools();
  if (missing.length) { t.skip('Poppler missing: ' + missing.join(', ')); return; }
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-pdf-test-'));
  try {
    const path = join(directory, 'mixed.pdf');
    await writeFile(path, await syntheticPdf());
    let pages = 0;
    const result = await extractKnowledgePdf(path, async image => {
      pages++;
      assert.equal((await sharp(image).metadata()).format, 'png');
      return 'Scanned renewal period is 48 months.';
    });
    assert.equal(pages, 1);
    assert.match(result, /Page 1[\s\S]+CC-49215[\s\S]+Page 2[\s\S]+48 months/);
    await assert.rejects(extractKnowledgePdf(path, async () => ''), /OCR could not read page 2/);
    const damaged = join(directory, 'damaged.pdf');
    await writeFile(damaged, '%PDF-1.4 incomplete fixture');
    await assert.rejects(extractKnowledgePdf(damaged, async () => ''), /could not read this file/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
