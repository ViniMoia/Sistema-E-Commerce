import { access } from 'node:fs/promises';
import path from 'node:path';

export async function browserExecutable(requested, check = access) {
  const candidates = requested ? [requested] : [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) continue;
    try { await check(candidate); return candidate; } catch { /* Try automatic candidates only. */ }
  }
  // An explicitly requested browser must never silently test a different one.
  throw new Error('BROWSER_REQUIRED: configure BROWSER_BIN with an existing absolute Chrome/Chromium/Edge path.');
}
