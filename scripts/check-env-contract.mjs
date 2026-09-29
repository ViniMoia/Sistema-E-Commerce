import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_ROOTS = ['app', 'components', 'hooks', 'lib', 'services', 'scripts', 'tests']
const PROVIDED_BY_RUNTIME = new Set(['NODE_ENV', 'NEXT_RUNTIME', 'SKIP_RUNTIME_ENV_VALIDATION'])
const REQUIRED_BY_TOOLING = new Set(['DATABASE_URL', 'DIRECT_URL'])

function walk(path, files = []) {
  const stat = statSync(path)
  if (stat.isDirectory()) {
    for (const child of readdirSync(path)) walk(join(path, child), files)
  } else if (/\.(?:[cm]?[jt]sx?)$/.test(path)) {
    files.push(path)
  }
  return files
}

const used = new Set(REQUIRED_BY_TOOLING)
for (const root of SOURCE_ROOTS) {
  for (const path of walk(root)) {
    const contents = readFileSync(path, 'utf8')
    for (const match of contents.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) used.add(match[1])
    for (const match of contents.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)) used.add(match[1])
  }
}

const documented = new Set()
for (const line of readFileSync('.env.example', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=/)
  if (match) documented.add(match[1])
}

const missing = [...used]
  .filter((name) => !PROVIDED_BY_RUNTIME.has(name) && !documented.has(name))
  .sort()

if (missing.length) {
  console.error(`Variáveis usadas e ausentes de .env.example: ${missing.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`Contrato .env cobre ${used.size - PROVIDED_BY_RUNTIME.size} nomes usados ou exigidos por tooling.`)
}
