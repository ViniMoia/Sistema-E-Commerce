import { readFile } from 'node:fs/promises';
import path from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Observe immediately after spawn: an unsuccessful spawn has no PID and does
// not emit exit. Do not print stderr, which may contain URLs or environment data.
export function observeBrowserProcess(child) {
  let spawnCode, exited = false, closed = false, stderr = '', stderrBytes = 0;
  child.once('error', error => { spawnCode = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'UNKNOWN'; });
  child.once('exit', () => { exited = true; });
  child.once('close', () => { closed = true; });
  child.stderr?.on('data', chunk => {
    stderrBytes += chunk.length;
    stderr = (stderr + chunk.toString()).slice(-8192);
  });
  const stopped = () => closed;
  const failed = () => spawnCode || exited || closed || child.exitCode !== null || child.signalCode !== null;
  const diagnostic = () => {
    const reasons = [
      ['sandbox', /no usable sandbox|running as root.*no-sandbox|sandbox.*permission denied/i],
      ['profile_lock', /SingletonLock|ProcessSingleton|profile.*in use/i],
      ['resource_exhaustion', /cannot allocate memory|out of memory|resource temporarily unavailable|no space left/i],
      ['missing_library', /error while loading shared libraries/i],
    ].filter(([, pattern]) => pattern.test(stderr)).map(([name]) => name);
    return JSON.stringify({ spawnCode: spawnCode ?? null, exitCode: child.exitCode, signal: child.signalCode,
      closed, stderrBytes, reasons });
  };
  return { stopped, failed, diagnostic };
}

/** Read the private profile's port and wait for a usable page endpoint, not
 * merely for file creation. Never follow a redirect or connect off loopback. */
export async function waitForBrowserPage({ child, state, profile, timeoutMs = 20000,
  pollMs = 100, readPort = () => readFile(path.join(profile, 'DevToolsActivePort'), 'utf8'),
  fetchEndpoint = fetch }) {
  const deadline = Date.now() + timeoutMs;
  let phase = 'port-file';
  while (Date.now() < deadline) {
    if (state.failed()) throw new Error('BROWSER_START_EXITED: ' + state.diagnostic());
    try {
      const content = await readPort();
      const portText = content.split('\n')[0].trim();
      const port = Number(portText);
      if (/^\d+$/.test(portText) && Number.isInteger(port) && port > 0 && port <= 65535) {
        phase = 'devtools-http';
        const response = await fetchEndpoint(`http://127.0.0.1:${port}/json/list`, {
          redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
        });
        if (response.ok) {
          const tabs = await response.json();
          const page = Array.isArray(tabs) && tabs.find(tab => tab.type === 'page');
          if (page?.webSocketDebuggerUrl) {
            const url = new URL(page.webSocketDebuggerUrl);
            if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== port ||
              url.username || url.password || !url.pathname.startsWith('/devtools/page/')) {
              throw new Error('BROWSER_DEBUG_ENDPOINT_INVALID');
            }
            if (!state.failed()) return page;
          }
          phase = 'devtools-page';
        }
      }
    } catch (error) {
      if (error.message === 'BROWSER_DEBUG_ENDPOINT_INVALID') throw error;
      // File creation, HTTP listening and page creation are separate events.
    }
    await pause(Math.min(pollMs, Math.max(0, deadline - Date.now())));
  }
  if (state.failed()) throw new Error('BROWSER_START_EXITED: ' + state.diagnostic());
  throw new Error(`BROWSER_START_TIMEOUT: phase=${phase}; pid=${child.pid ?? 'none'}; ${state.diagnostic()}`);
}

export async function waitForBrowserStop(state, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!state.stopped() && Date.now() < deadline) await pause(50);
  return state.stopped();
}
