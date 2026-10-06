import { recoverCheckout } from '@/services/checkout.service';
import { checkoutHttpScope, checkoutResponse, checkoutFailure } from '@/lib/commerce/checkout-http';
import { z } from 'zod';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await checkoutHttpScope();
    const id = z.string().uuid().parse((await context.params).id);
    return checkoutResponse(await recoverCheckout(scope, id));
  } catch (error) { return checkoutFailure(error); }
}
