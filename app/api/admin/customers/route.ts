import { requireAdmin } from '@/lib/auth-admin';
import { listCustomersSchema } from '@/lib/validators/customer.validators';
import { listCustomers } from '@/lib/services/customer.service';
import { ok, err } from '@/lib/api-response';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());
  const result = listCustomersSchema.safeParse(queryParams);

  if (!result.success) {
    return err('Parâmetros de consulta inválidos.', 400);
  }

  try {
    const customers = await listCustomers({ lojaID: auth.user.lojaID, ...result.data });
    const response = ok(customers);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'CUSTOMER_CURSOR_INVALID') return err('Cursor de cliente inválido.', 400);
    throw error;
  }
}
