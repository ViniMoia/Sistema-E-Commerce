import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SAFE_MARKERS = /(?:\[redacted\]|\[(?:usuario|senha|user|username|password|host|endpoint)\]|sua[_-]|seu[_-]|configure-no-secret-manager|placeholder|example|exemplo|fake|dummy|fixture|test[_-]|ci[_-]only|localhost(?::\d+)?\/ecommerce_test)/i
const CANDIDATES = [
  /postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@/i,
  /\b(?:sk|re|aact)_[A-Za-z0-9_$-]{12,}\b/i,
]

export function findPotentialSecrets(path, contents) {
  if (path === 'package-lock.json' || path.startsWith('docs/audits/')) return []

  const findings = []
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (SAFE_MARKERS.test(line)) continue
    if (CANDIDATES.some((pattern) => pattern.test(line))) {
      findings.push({ path, line: index + 1 })
    }
  }
  return findings
}

export function scanTrackedFiles() {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  const findings = []

  for (const path of files) {
    let contents
    try {
      contents = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    findings.push(...findPotentialSecrets(path.replaceAll('\\', '/'), contents))
  }
  return findings
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = scanTrackedFiles()
  if (findings.length) {
    console.error('Possíveis segredos encontrados (valores omitidos):')
    for (const finding of findings) console.error(`- ${finding.path}:${finding.line}`)
    process.exitCode = 1
  } else {
    console.log('Nenhum padrão de segredo não permitido foi encontrado nos arquivos rastreados.')
  }
}
