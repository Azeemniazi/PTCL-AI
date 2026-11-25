import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { sourceTextQuality } from './rag-planning.js';
const exec = promisify(execFile);
const tools = ['pdfinfo', 'pdftotext', 'pdftoppm'];
const packagedRoot = fileURLToPath(new URL('../runtime/poppler/usr/', import.meta.url));
export class KnowledgePdfError extends Error {
}
function run(tool, args, timeout) {
    const packaged = resolve(packagedRoot, 'bin', tool);
    const options = { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 ** 2,
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, LC_ALL: 'C', OMP_THREAD_LIMIT: '1' } };
    if (process.platform === 'linux' && existsSync(packaged)) {
        options.env = { ...options.env, LD_LIBRARY_PATH: resolve(packagedRoot, 'lib', process.arch === 'arm64' ? 'aarch64-linux-gnu' : 'x86_64-linux-gnu') };
        return exec(packaged, args, options);
    }
    return exec(tool, args, options);
}
async function poppler(tool, args) {
    try {
        return (await run(tool, args, 30_000)).stdout;
    }
    catch (cause) {
        const error = cause;
        if (error.code === 'ENOENT')
            throw new KnowledgePdfError('PDF processing is unavailable. Ask an administrator to install Poppler and retry.');
        if (/password|encrypted/i.test(error.stderr ?? ''))
            throw new KnowledgePdfError('This PDF is password-protected. Upload an unlocked copy.');
        throw new KnowledgePdfError('PDF processing could not read this file. Open the original to check whether it is damaged, then retry.');
    }
}
export async function missingPdfTools() {
    const checks = await Promise.allSettled(tools.map(tool => run(tool, ['-v'], 5_000)));
    return tools.filter((_, index) => checks[index]?.status === 'rejected');
}
export async function extractLocalPdfPage(imagePath) {
    const tessdata = resolve(packagedRoot, 'share/tesseract-ocr/5/tessdata');
    const data = existsSync(resolve(tessdata, 'eng.traineddata')) ? ['--tessdata-dir', tessdata] : [];
    try {
        const { stdout } = await run('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '3',
            ...data, '-c', 'preserve_interword_spaces=1'], 25_000);
        return sourceTextQuality(stdout).usable ? stdout.trim() : '';
    }
    catch {
        return '';
    }
}
export async function extractKnowledgePdf(path, ocr, maxOcrPages = 50) {
    const info = await poppler('pdfinfo', [path]);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if (!Number.isSafeInteger(pages) || pages < 1)
        throw new KnowledgePdfError('No readable pages were found in this PDF.');
    const digitalPages = (await poppler('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'])).split('\f');
    const directory = await mkdtemp(join(tmpdir(), 'cloudcore-ocr-'));
    const output = [];
    let ocrPages = 0;
    let readablePages = 0;
    try {
        for (let page = 1; page <= pages; page++) {
            let text = digitalPages[page - 1]?.trim() ?? '';
            if (!sourceTextQuality(text).usable) {
                if (++ocrPages > maxOcrPages)
                    throw new KnowledgePdfError('This PDF needs OCR on too many pages. Split it into smaller PDFs and upload them.');
                const image = join(directory, 'page');
                await poppler('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-png', '-scale-to', '2000', path, image]);
                const imagePath = image + '.png';
                const statistics = await sharp(imagePath).stats();
                if (statistics.channels.every(channel => channel.min >= 250)) {
                    output.push('--- Page ' + page + ' ---\n[Blank page]');
                    continue;
                }
                text = (await ocr(imagePath)).trim();
                if (!sourceTextQuality(text).usable)
                    throw new KnowledgePdfError('OCR could not read page ' + page + '. Check the original scan quality and retry.');
            }
            readablePages++;
            output.push('--- Page ' + page + ' ---\n' + text);
        }
        if (!readablePages)
            throw new KnowledgePdfError('This PDF contains no readable text.');
        return output.join('\n\n');
    }
    finally {
        await rm(directory, { recursive: true, force: true });
    }
}
