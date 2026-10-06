import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { checkProductionEnvironment } from './lib/production-environment-policy.mjs';

if (process.argv.length !== 2) throw new Error('Este preflight não aceita overrides, URLs ou ativação de flags.');
const require = createRequire(import.meta.url);
// Same parser, expansion and precedence as the installed Next.js, in this
// short-lived process only. Never prints values or changes .env files.
process.env.NODE_ENV = 'production';
const { combinedEnv, loadedEnvFiles } = require('@next/env').loadEnvConfig(process.cwd(), false,
  { info() {}, error() { throw new Error('PRODUCTION_ENV_PARSE_FAILURE'); } }, true);
const declaredFile = loadedEnvFiles.find(file => Object.hasOwn(parseEnv(file.contents), 'ASAAS_API_KEY'));
const raw = declaredFile ? parseEnv(declaredFile.contents).ASAAS_API_KEY : '';
const report = checkProductionEnvironment(combinedEnv, {
  nonempty: Boolean(raw), unescapedDollarReference: /(?<!\\)\$[A-Za-z_][A-Za-z0-9_]*/.test(raw),
});
console.log(JSON.stringify({ ...report, files: loadedEnvFiles.map(file => file.path) }, null, 2));
if (!report.configurationPassed) process.exitCode = 1;
