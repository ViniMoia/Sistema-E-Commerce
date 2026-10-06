import { NextResponse } from 'next/server';
// Financial approval cannot be manufactured by an unauthenticated dev endpoint.
// Controlled adapters and disposable integration fixtures replace this shortcut.
export async function POST() {
  return NextResponse.json({ error: 'Endpoint de simulação indisponível. Utilize os ensaios isolados de pagamento.' },
    { status: process.env.NODE_ENV === 'production' ? 403 : 410 });
}
