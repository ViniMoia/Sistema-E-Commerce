// Test-only loader. No Next endpoint, .env loading or externally reachable server.
import { createServer } from 'vite';

if (!process.send || process.env.NODE_ENV !== 'test' || !/^[a-f0-9]{32}$/.test(process.env.TEST_RUN_ID ?? '')) {
  throw new Error('ISOLATED_PAYMENT_PROCESS_REQUIRED');
}
globalThis.fetch = async () => { throw new Error('EXTERNAL_NETWORK_FORBIDDEN_IN_PROCESS_FIXTURE'); };
const server = await createServer({
  configFile: false, envFile: false, logLevel: 'silent',
  resolve: { alias: { '@': process.cwd() } },
  server: { middlewareMode: true, watch: null, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let fixture;
try {
  fixture = await server.ssrLoadModule('/tests/helpers/payment-process-worker.ts');
  await fixture.run();
} catch (error) {
  // Only an allowlisted code leaves this process; never DB/credential diagnostics.
  process.send({ type: 'failure', code: error?.code === 'P2028' ? 'TRANSACTION_EXPIRED' : 'PROCESS_FIXTURE_FAILED' });
  process.exitCode = 1;
} finally {
  if (fixture) await fixture.disconnect();
  await server.close();
  process.disconnect();
}
