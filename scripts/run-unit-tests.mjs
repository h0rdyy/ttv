import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const VITEST_VERSION = '4.1.10';
const runnerRoot = join(tmpdir(), `ttv-vitest-${VITEST_VERSION}`);
const vitestPackage = join(runnerRoot, 'node_modules', 'vitest', 'package.json');
const vitestEntry = join(runnerRoot, 'node_modules', 'vitest', 'vitest.mjs');

function installedRunnerIsCurrent() {
  if (!existsSync(vitestPackage) || !existsSync(vitestEntry)) return false;
  try {
    const pkg = JSON.parse(readFileSync(vitestPackage, 'utf8'));
    return pkg.version === VITEST_VERSION;
  } catch {
    return false;
  }
}

if (!installedRunnerIsCurrent()) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(
    npmCommand,
    [
      'install',
      '--prefix', runnerRoot,
      '--no-save',
      '--package-lock=false',
      `vitest@${VITEST_VERSION}`,
    ],
    { stdio: 'inherit' },
  );

  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const test = spawnSync(process.execPath, [vitestEntry, 'run', 'tests/unit'], {
  stdio: 'inherit',
});

if (test.error) throw test.error;
process.exit(test.status ?? 1);
