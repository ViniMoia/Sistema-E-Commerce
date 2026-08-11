import { getCurrentUser } from '@/lib/session';
import { NextResponse } from 'next/server';
import { err } from '@/lib/api-response';

export async function requireAdmin(
  req: Request
): Promise<{ user: { id: string; role: string; lojaID: string } } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return err('Não autenticado.', 401);
  }
  if (user.role !== 'ADMIN') {
    return err('Acesso negado.', 403);
  }
  return { user: { id: user.id, role: user.role, lojaID: user.lojaID } };
}
