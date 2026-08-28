import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const VITEST_VERSION = '4.1.10';
const HAPPY_DOM_VERSION = '15.11.7';
const TESTING_LIBRARY_REACT_VERSION = '16.1.0';
const TESTING_LIBRARY_DOM_VERSION = '10.4.0';
const runnerRoot = join(tmpdir(), `ttv-vitest-${VITEST_VERSION}`);
const vitestPackage = join(runnerRoot, 'node_modules', 'vitest', 'package.json');
const vitestEntry = join(runnerRoot, 'node_modules', 'vitest', 'vitest.mjs');
const happyDomPackage = join(runnerRoot, 'node_modules', 'happy-dom', 'package.json');

function installedRunnerIsCurrent() {
  if (!existsSync(vitestPackage) || !existsSync(vitestEntry) || !existsSync(happyDomPackage)) return false;
  try {
    const v = JSON.parse(readFileSync(vitestPackage, 'utf8'));
    const h = JSON.parse(readFileSync(happyDomPackage, 'utf8'));
    return v.version === VITEST_VERSION && h.version === HAPPY_DOM_VERSION;
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
      `happy-dom@${HAPPY_DOM_VERSION}`,
      `@testing-library/react@${TESTING_LIBRARY_REACT_VERSION}`,
      `@testing-library/dom@${TESTING_LIBRARY_DOM_VERSION}`,
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );

  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const test = spawnSync(process.execPath, [vitestEntry, 'run', 'tests/unit'], {
  stdio: 'inherit',
});

if (test.error) throw test.error;
process.exit(test.status ?? 1);
