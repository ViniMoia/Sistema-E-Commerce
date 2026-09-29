import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { validateRuntimeEnvironment } = require('../lib/config/environment.cjs')

validateRuntimeEnvironment(process.env)

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const standaloneServer = resolve(scriptDirectory, '..', 'server.js')

if (existsSync(standaloneServer)) {
  await import(pathToFileURL(standaloneServer).href)
} else {
  const nextBin = require.resolve('next/dist/bin/next')
  const child = spawn(process.execPath, [nextBin, 'start'], {
    env: process.env,
    stdio: 'inherit',
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
  }

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 1)
  })
}
