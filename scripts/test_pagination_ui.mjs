import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testPath = fileURLToPath(new URL('../tests/frontend-react.test.mjs', import.meta.url));
const result = spawnSync(process.execPath, [
  '--test', '--test-name-pattern', 'Knowledge Hub filters, paginates and selects', testPath,
], { stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
