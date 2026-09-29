import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

if (!process.env.APP_ENV && existsSync('.env')) {
  process.loadEnvFile?.('.env')
}

const require = createRequire(import.meta.url)
const { EnvironmentValidationError, validateEnvironment } = require('../lib/config/environment.cjs')

const args = new Set(process.argv.slice(2))
const targetIndex = process.argv.indexOf('--target')
const targetEnvironment = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined

try {
  const result = validateEnvironment(process.env, {
    targetEnvironment,
    requireMigration: args.has('--migration'),
  })
  console.log(`Contrato de ambiente válido para ${result.appEnvironment}.`)
} catch (error) {
  if (error instanceof EnvironmentValidationError) {
    console.error(error.message)
    process.exitCode = 1
  } else {
    throw error
  }
}
