import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { observeBrowserProcess, waitForBrowserPage, waitForBrowserStop } from '../../scripts/lib/browser-startup.mjs';

function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 123, exitCode: null, signalCode: null, stderr: new PassThrough() });
  return { child, state: observeBrowserProcess(child), timeoutMs: 1000, pollMs: 1 };
}
const page = { type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1:12345/devtools/page/fixture' };
test('readiness tolerates partial port file, refused HTTP and page creation independently', async () => {
  let reads = 0, requests = 0;
  const result = await waitForBrowserPage({ ...fixture(), readPort: async () => ++reads === 1 ? '' : '12345\n/browser/id',
    fetchEndpoint: async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:12345/json/list');
      assert.equal(options.redirect, 'error');
      if (++requests === 1) throw new Error('ECONNREFUSED');
      return { ok: true, json: async () => requests === 2 ? [] : [page] };
    } });
  assert.deepEqual(result, page);
  assert.equal(requests, 3);
});
test('a child that exits before readiness reports exit and sanitized reason without stderr secrets', async () => {
  const options = fixture();
  options.child.stderr.write('https://user:private@example.invalid?token=hidden\nNo usable sandbox');
  options.child.exitCode = 1;
  options.child.emit('exit', 1);
  await assert.rejects(waitForBrowserPage({ ...options, readPort: async () => '' }), error => {
    assert.match(error.message, /BROWSER_START_EXITED.*"exitCode":1/);
    assert.match(error.message, /sandbox/);
    assert.doesNotMatch(error.message, /private|hidden|example/);
    return true;
  });
});
test('real spawn failure is handled without an unhandled error or an invented PID', async () => {
  const child = spawn(process.execPath + '-missing', [], { stdio: ['ignore', 'ignore', 'pipe'] });
  const state = observeBrowserProcess(child);
  await assert.rejects(waitForBrowserPage({ child, state, timeoutMs: 1000, pollMs: 1, readPort: async () => '' }),
    /BROWSER_START_EXITED.*ENOENT/);
  assert.equal(await waitForBrowserStop(state, 1000), true);
});
test('a live process without readiness hits a bounded diagnostic timeout', async () => {
  await assert.rejects(waitForBrowserPage({ ...fixture(), timeoutMs: 15, readPort: async () => '' }),
    /BROWSER_START_TIMEOUT: phase=port-file/);
});
test('a page endpoint cannot redirect the debugger outside its loopback port', async () => {
  for (const url of ['ws://evil.invalid:12345/devtools/page/1', 'ws://127.0.0.1:9999/devtools/page/1',
    'ws://user:secret@127.0.0.1:12345/devtools/page/1']) {
    await assert.rejects(waitForBrowserPage({ ...fixture(), readPort: async () => '12345\n',
      fetchEndpoint: async () => ({ ok: true, json: async () => [{ type: 'page', webSocketDebuggerUrl: url }] }) }),
    /BROWSER_DEBUG_ENDPOINT_INVALID/);
  }
});
test('cleanup waits for close after a signal exit and detects processes that remain open', async () => {
  const { child, state } = fixture();
  child.signalCode = 'SIGTERM';
  child.emit('exit', null, 'SIGTERM');
  assert.equal(await waitForBrowserStop(state, 10), false);
  child.emit('close');
  assert.equal(await waitForBrowserStop(state, 10), true);
});
