import { NextResponse } from 'next/server';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { adjustInventory, InventoryCommandError, inventoryCommandSchema } from '@/lib/commerce/inventory-command';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requirePurchaseAdmin(req);
  if (guard instanceof NextResponse) return guard;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const parsed = inventoryCommandSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Comando inválido.', details: parsed.error.flatten() }, { status: 422 });
  try {
    const { id } = await context.params;
    const data = await adjustInventory(id, guard.user.lojaID, guard.user.id, parsed.data);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof InventoryCommandError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_INPUT' ? 422 : 409 });
    console.error('[INVENTORY_COMMAND]', error);
    return NextResponse.json({ error: 'Falha ao ajustar estoque.' }, { status: 500 });
  }
}
