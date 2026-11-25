import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

const scanTimeoutMs = 300_000;
const maxFindings = 100;
const report = z.object({
  version: z.string().optional(),
  results: z.array(z.object({
    check_id: z.string(),
    path: z.string(),
    start: z.object({ line: z.number().int().positive() }),
    extra: z.object({
      severity: z.string(),
      message: z.string(),
    }),
  })),
  errors: z.array(z.unknown()),
  paths: z.object({ scanned: z.array(z.string()) }),
});
const severity = new Map([['ERROR', 'High'], ['WARNING', 'Medium'], ['INFO', 'Low']]);

function runSemgrep(binary: string, rules: string, source: string, scratch: string, signal: AbortSignal) {
  return new Promise<string>((resolveOutput, reject) => {
    signal.throwIfAborted();
    const child = spawn('/usr/bin/python3', [
      resolve('pentesting/semgrep-offline.py'), binary,
      'scan', '--config', join(rules, 'javascript.yml'), '--config', join(rules, 'typescript.yml'),
      '--json', '--quiet', '--metrics=off', '--disable-version-check', '--no-rewrite-rule-ids', '--jobs=2', '.',
    ], {
      cwd: source, detached: true, stdio: ['ignore', 'pipe', 'ignore'],
      env: { PATH: '/usr/bin:/bin', SEMGREP_SETTINGS_FILE: join(scratch, 'settings.yml'), XDG_CACHE_HOME: scratch },
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    function terminate(error: Error) {
      failure ??= error;
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch { /* The process group may already have exited. */ }
      }
    }
    const abort = () => terminate(new Error('Semgrep cancelled'));
    const timer = setTimeout(() => terminate(new DOMException('Semgrep timed out', 'TimeoutError')), scanTimeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8_000_000) terminate(new Error('Semgrep output exceeded the limit'));
      else chunks.push(chunk);
    });
    child.on('error', error => { failure ??= error; });
    child.on('close', code => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (failure || code !== 0) reject(failure ?? new Error(`Semgrep exited with code ${code}`));
      else resolveOutput(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

export function createSemgrep(env: NodeJS.ProcessEnv) {
  const binary = env.PENTEST_SEMGREP_BIN;
  const rules = env.PENTEST_SEMGREP_RULES_DIR;
  if (!binary || !isAbsolute(binary) || !rules || !isAbsolute(rules)) return;
  const config = { binary, rules };
  const source = resolve(process.cwd(), 'src');

  async function scan(signal: AbortSignal) {
    const scratch = await mkdtemp(join(tmpdir(), 'cloudcore-semgrep-'));
    try {
      const stdout = await runSemgrep(config.binary, config.rules, source, scratch, signal);
      const output = report.parse(JSON.parse(stdout));
      if (!output.paths.scanned.length) throw new Error('No source files were scanned');
      const findings = output.results.slice(0, maxFindings).map(item => ({
        title: item.check_id.slice(0, 256),
        severity: severity.get(item.extra.severity) ?? item.extra.severity.slice(0, 32),
        endpoint: `src/${item.path}:${item.start.line}`.slice(0, 512),
        evidence: 'Review the referenced source location to confirm the rule match.',
        remediation: item.extra.message.slice(0, 1024),
      }));
      const summary = [
        `Semgrep CE ${output.version ?? ''} reviewed ${output.paths.scanned.length} CloudCore source files.`,
        `It reported ${output.results.length} rule matches. CloudCore saved ${findings.length} for review.`,
        ...(output.errors.length ? [`Semgrep reported ${output.errors.length} analysis warnings or errors. Review coverage accordingly.`] : []),
      ].join('\n');
      return { findings, summary, evidence: JSON.stringify(findings, null, 2).slice(0, 262_144) };
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }

  return { scan };
}
