import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { homologationSuites, selectIsolatedSuites } from '../../scripts/lib/homologation-suites.mjs';
import { browserExecutable } from '../../scripts/lib/browser-executable.mjs';

test('CI and optimized runtimes select the same audited inventory and commerce suites', () => {
  const selected = selectIsolatedSuites(['--homologation']);
  assert.deepEqual(selected, homologationSuites);
  assert.ok(selected.includes('tests/integration/inventory-admin-browser.test.ts'));
  assert.ok(selected.includes('tests/integration/inventory-admin-integrity.test.ts'));
  assert.equal(new Set(selected).size, selected.length);
});
test('audited selection cannot inject flags or escape isolated test directories', () => {
  for (const args of [['--homologation','--config=x'], ['--config=x'], ['tests/integration/../../other.ts'],
    ['tests\\integration\\file.test.ts'], ['/tmp/test.ts'], ['tests/unit/file.test.ts']]) {
    assert.throws(() => selectIsolatedSuites(args));
  }
  assert.deepEqual(selectIsolatedSuites(['tests/integration/inventory-admin-browser.test.ts']),
    ['tests/integration/inventory-admin-browser.test.ts']);
});
test('missing or relative requested browser fails instead of silently falling back', async () => {
  let attempts = 0;
  await assert.rejects(browserExecutable(path.resolve('missing-browser.exe'), async () => {
    attempts++; throw new Error('missing');
  }), /BROWSER_REQUIRED/);
  assert.equal(attempts, 1);
  await assert.rejects(browserExecutable('relative-browser.exe', async () => {}), /BROWSER_REQUIRED/);
  const requested = path.resolve('fixture-browser.exe');
  assert.equal(await browserExecutable(requested, async () => {}), requested);
});
