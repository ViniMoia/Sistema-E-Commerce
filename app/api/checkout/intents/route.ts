import { z } from 'zod';
import { checkoutDraftSchema } from '@/lib/validators/checkout.validators';
import { checkoutContext, proposeCheckout } from '@/services/checkout-intent.service';
import { checkoutHttpScope, checkoutResponse, checkoutFailure } from '@/lib/commerce/checkout-http';
import { checkRateLimit } from '@/lib/rate-limit';

/** Bootstrap the opaque identity before quote requests, including parallel tabs. */
export async function GET() {
  try { return checkoutResponse(await checkoutContext(await checkoutHttpScope(true))); }
  catch (error) { return checkoutFailure(error); }
}
export async function POST(request: Request) {
  const limited = checkRateLimit(request, 'checkout_proposal', 30, 60000); if (limited) return limited;
  try {
    const scope = await checkoutHttpScope();
    const parsed = checkoutDraftSchema.safeParse(await request.json());
    if (!parsed.success) throw new Error('CHECKOUT_INPUT_INVALID');
    if (parsed.data.lojaID !== scope.lojaID) throw new Error('ACCOUNT_ACCESS_DENIED');
    const data = parsed.data;
    // Session identity is authoritative; guest declarations cannot bind accounts.
    data.customer.userId = scope.customer.userId;
    return checkoutResponse(await proposeCheckout({ ...data, freightOwnerKey: scope.freightOwnerKey }));
  } catch (error) { return checkoutFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const scope = await checkoutHttpScope();
    const { previousBasketID } = z.object({ previousBasketID: z.string().uuid() }).strict().parse(await request.json());
    return checkoutResponse(await checkoutContext(scope, previousBasketID));
  } catch (error) { return checkoutFailure(error); }
}
