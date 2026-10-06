import { NextResponse } from 'next/server';
export { POST } from './calculate/route';
// A city name alone no longer represents geographic eligibility or authority.
export async function GET() {
  return NextResponse.json({ error: 'Solicite cotação por CEP e itens no POST /api/freight/calculate.' }, { status: 410 });
}
