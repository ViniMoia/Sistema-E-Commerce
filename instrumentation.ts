export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { validateRuntimeEnvironment } = await import('./lib/config/environment.cjs')
  validateRuntimeEnvironment(process.env)
}
