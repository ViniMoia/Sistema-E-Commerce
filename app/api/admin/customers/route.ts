import { requireAdmin } from '@/lib/auth-admin';
import { listCustomersSchema } from '@/lib/validators/customer.validators';
import { listCustomers } from '@/lib/services/customer.service';
import { ok } from '@/lib/api-response';
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
    return new Response('Parâmetros de consulta inválidos.', { status: 400 });
  }

  const customers = await listCustomers({
    lojaID: auth.user.lojaID,
    ...result.data
  });

  return ok(customers);
}