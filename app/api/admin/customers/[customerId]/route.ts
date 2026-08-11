import { requireAdmin } from '@/lib/auth-admin';
import { customerIdSchema } from '@/lib/validators/customer.validators';
import { getCustomerProfile } from '@/lib/services/customer.service';
import { ok, err } from '@/lib/api-response';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) {
    return auth;
  }

  const result = customerIdSchema.safeParse(params);
  if (!result.success) {
    return err('ID do cliente inválido.', 400);
  }

  const customer = await getCustomerProfile({
    customerId: result.data.customerId,
    lojaID: auth.user.lojaID
  });

  if (!customer) {
    return err('Cliente não encontrado.', 404);
  }

  return ok(customer);
}