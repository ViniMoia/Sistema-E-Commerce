import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { testServerConfig } from '../../lib/testing/database-policy.ts';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
/** Fixture-only browser/proxy. Never attaches to a user's browser/profile or
 * forwards HTTP to anything except the sentinel-verified isolated Next server. */
export async function isolatedBrowser({ host, intercept = async (_request) => null }) {
  const config = testServerConfig();
  const check = await fetch(config.baseUrl + '/api/test-environment', { headers: { 'x-test-environment-token': config.token }, redirect: 'error' });
  const identity = await check.json();
  if (!check.ok || identity.runId !== config.runId || identity.database !== config.database) throw new Error('BROWSER_TEST_SERVER_IDENTITY_MISMATCH');
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error('BROWSER_FIXTURE_HOST_INVALID');
  const candidates = [process.env.BROWSER_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  let executable;
  for (const candidate of candidates) { if (path.isAbsolute(candidate)) try { await access(candidate); executable = candidate; break; } catch {} }
  if (!executable) throw new Error('BROWSER_REQUIRED: configure BROWSER_BIN with installed Chrome/Chromium.');
  const profile = await mkdtemp(path.join(tmpdir(), 'commerce-browser-'));
  const target = new URL(config.baseUrl);
  const upgradeSockets = new Set();
  const proxy = createServer(async (request, response) => {
    try {
      if (!request.url?.startsWith('/') || request.url.startsWith('//')) throw new Error('BROWSER_PROXY_PATH_INVALID');
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 1000000) throw new Error('BROWSER_PROXY_PAYLOAD_TOO_LARGE'); chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const mocked = await intercept({ url: request.url, method: request.method, body: body.toString('utf8'), headers: request.headers });
      if (mocked) { response.writeHead(mocked.status ?? 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(mocked.body)); return; }
      const headers = { ...request.headers, host }; delete headers['accept-encoding'];
      if (headers.origin) headers.origin = 'http://' + host;
      const upstream = httpRequest({ hostname: target.hostname, port: target.port, path: request.url, method: request.method, headers }, remote => {
        response.writeHead(remote.statusCode ?? 503, remote.headers); remote.pipe(response);
      });
      upstream.on('error', () => { if (!response.headersSent) response.writeHead(503); response.end(); });
      upstream.setTimeout(45000, () => upstream.destroy()); upstream.end(body);
    } catch { if (!response.headersSent) response.writeHead(503); response.end(); }
  });
  // Next development/debug channels use WebSocket upgrades before hydration.
  // Forward only its internal path to the same verified isolated server.
  proxy.on('upgrade', (request, socket, head) => {
    if (!request.url?.startsWith('/_next/')) { socket.destroy(); return; }
    const upstream = httpRequest({ hostname: target.hostname, port: target.port, path: request.url, method: 'GET',
      headers: { ...request.headers, host: target.host, origin: target.origin } });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      upgradeSockets.add(socket); upgradeSockets.add(remote);
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(response.headers).map(([name,value]) => name + ': ' + value).join('\r\n') + '\r\n\r\n');
      if (head.length) remote.write(head); if (remoteHead.length) socket.write(remoteHead);
      socket.pipe(remote); remote.pipe(socket);
      socket.on('error', () => remote.destroy()); remote.on('error', () => socket.destroy());
      socket.on('close', () => { upgradeSockets.delete(socket); remote.destroy(); });
      remote.on('close', () => { upgradeSockets.delete(remote); socket.destroy(); });
    });
    upstream.on('response', () => socket.destroy()); upstream.on('error', () => socket.destroy()); upstream.end();
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + proxy.address().port;
  const child = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'], { shell: false, windowsHide: true, stdio: 'ignore' });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  let socket;
  const close = async () => {
    if (socket?.readyState === 1) { try { await send('Browser.close'); } catch {} socket.close(); }
    for (let i=0; child.exitCode === null && i<30; i++) await pause(100);
    if (child.exitCode === null) {
      if (process.platform === 'win32') await new Promise(resolve => { const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false }); kill.on('exit', resolve); kill.on('error', resolve); });
      else child.kill('SIGTERM');
    }
    for (const socket of upgradeSockets) socket.destroy();
    proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve));
    const absolute = path.resolve(profile), base = path.resolve(tmpdir());
    if (path.dirname(absolute) !== base || !path.basename(absolute).startsWith('commerce-browser-')) throw new Error('BROWSER_CLEANUP_SCOPE_INVALID');
    await rm(absolute, { recursive: true, force: true }).catch(() => {});
  };
  let serial = 0; const pending = new Map(); const events = new Map(); const diagnostics = [];
  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('BROWSER_PROTOCOL_TIMEOUT: ' + method)); }, 45000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  try {
    let port;
    for (let i=0; i<100; i++) { if (spawnError) throw spawnError; try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {} await pause(100); }
    if (!port) throw new Error('BROWSER_START_FAILED');
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = tabs.find(tab => tab.type === 'page'); if (!page) throw new Error('BROWSER_PAGE_MISSING');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); if (!item) return; clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }
      else {
        if (message.method === 'Runtime.exceptionThrown') diagnostics.push(JSON.stringify(message.params.exceptionDetails));
        if (message.method === 'Network.requestWillBeSent') diagnostics.push('HTTP ' + new URL(message.params.request.url).pathname);
        if (message.method === 'Network.loadingFailed') diagnostics.push(message.params.errorText);
        if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) diagnostics.push(message.params.response.status + ' ' + new URL(message.params.response.url).pathname);
        for (const callback of events.get(message.method) ?? []) callback(message.params);
      }
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['https://*', 'http://example.*'] });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 30000 });
      if (result.exceptionDetails) throw new Error('BROWSER_EVALUATION_FAILED: ' + (result.exceptionDetails.exception?.description ?? result.exceptionDetails.text));
      return result.result.value;
    };
    const waitFor = async (expression, timeout = 30000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) { try { if (await evaluate(expression)) return; } catch {} await pause(100); }
      const screen = await evaluate('document.body?.innerText?.slice(0,1200)').catch(() => 'unavailable');
      const state = await evaluate('JSON.stringify({ready:document.readyState,scripts:[...document.scripts].map(e=>e.src).filter(Boolean),resources:performance.getEntriesByType("resource").length})').catch(() => 'unavailable');
      throw new Error('BROWSER_EXPECTATION_TIMEOUT: ' + expression + '\nFixture screen: ' + screen + '\nFixture state: ' + state + '\nFixture diagnostics: ' + diagnostics.slice(-12).join('\n'));
    };
    return { origin, send, evaluate, waitFor, close,
      navigate: async pathname => { await send('Page.navigate', { url: origin + pathname }); },
      input: async (name, value) => evaluate('(() => { const e = document.querySelector(' + JSON.stringify('input[name="' + name + '"]') + '); if(!e) throw Error("input missing"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,' + JSON.stringify(value) + '); e.dispatchEvent(new Event("input",{bubbles:true})); })()'),
      click: async text => evaluate('(() => { const e=[...document.querySelectorAll("button")].find(e=>e.textContent.includes(' + JSON.stringify(text) + ')); if(!e||e.disabled) throw Error("button unavailable"); e.click(); })()'),
      on: (method, callback) => { const callbacks = events.get(method) ?? []; callbacks.push(callback); events.set(method, callbacks); },
    };
  } catch (error) { await close(); throw error; }
}
