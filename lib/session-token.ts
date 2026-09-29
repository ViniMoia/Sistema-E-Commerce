import { createHash } from 'node:crypto'

/** Shared by the session boundary and isolated HTTP fixtures; never persist the bearer. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
