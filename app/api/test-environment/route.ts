import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { verifyTestDatabase } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Only the provisioned test server exposes this authenticated handshake. */
export async function GET(request: Request) {
  const expected = process.env.TEST_HTTP_TOKEN
  const supplied = request.headers.get('x-test-environment-token')
  if (!process.env.TEST_RUN_ID || !expected || !supplied
    || Buffer.byteLength(expected) !== Buffer.byteLength(supplied)
    || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return new NextResponse(null, { status: 404 })
  }
  const identity = await verifyTestDatabase()
  return NextResponse.json({ runId: identity.runId, database: identity.database }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
