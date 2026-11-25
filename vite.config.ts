import { defineConfig, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function productionHtml(): Plugin {
  return {
    name: 'cloudcore-html',
    async generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(output => output.type === 'chunk' && output.isEntry);
      if (!entry) this.error('CloudCore browser entry was not emitted.');
      const template = await readFile(resolve('frontend/index.html'), 'utf8');
      if (!template.includes('__CLOUDCORE_ENTRY__')) this.error('CloudCore HTML is missing its script placeholder.');
      this.emitFile({ type: 'asset', fileName: 'index.html', source: template.replace('__CLOUDCORE_ENTRY__', entry.fileName) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const fixtures = mode === 'frontend-test';
  return {
    publicDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    oxc: { jsx: { development: false } },
    plugins: fixtures ? [] : [productionHtml()],
    build: {
      outDir: fixtures ? 'build/frontend-test' : 'dist',
      // Production assets already live in dist. Retain old hashed scripts for pages still open.
      emptyOutDir: fixtures,
      target: 'es2022',
      lib: {
        entry: resolve(fixtures ? 'tests/frontend-fixtures.ts' : 'frontend/bootstrap.ts'),
        name: fixtures ? 'CloudCoreFixtures' : 'CloudCore',
        formats: ['iife'],
      },
      rolldownOptions: { output: { entryFileNames: fixtures ? 'fixtures.js' : 'react/cloudcore-[hash].js' } },
    },
  };
});
