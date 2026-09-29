export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    { status: 'UP' },
    { headers: { 'cache-control': 'no-store' } }
  )
}
